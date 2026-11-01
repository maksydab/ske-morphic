package pages

import (
	"errors"
	"fmt"
	"html"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	tokenRegex      = regexp.MustCompile(`\{\|([^|]+)\|\}`)
	headerRegex     = regexp.MustCompile(`^\s*\(([^)]*)\)\s*\r?\n`)
	identifierRegex = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)
	pageNameRegex   = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	includeRegex    = regexp.MustCompile(`^include\s+([^\s|]+)\s*(?:\(([^)]*)\))?$`)
)

type Scope map[string]string

type TemplateError struct {
	File       string
	Line       int
	Directive  string
	Message    string
	Cause      error
	StatusCode int
}

func (e *TemplateError) Error() string {
	if e.Line > 0 {
		return fmt.Sprintf("%s:%d: %s", e.File, e.Line, e.Message)
	}

	return fmt.Sprintf("%s: %s", e.File, e.Message)
}

func (e *TemplateError) Unwrap() error {
	return e.Cause
}

func makeTemplateError(
	file string,
	content string,
	position int,
	directive string,
	message string,
	cause error,
	status int,
) *TemplateError {
	if position < 0 {
		position = 0
	}
	if position > len(content) {
		position = len(content)
	}
	line := strings.Count(content[:position], "\n") + 1

	return &TemplateError{
		File:       file,
		Line:       line,
		Directive:  directive,
		Message:    message,
		Cause:      cause,
		StatusCode: status,
	}
}

func lookup(scopes []Scope, name string) (string, bool) {
	for i := len(scopes) - 1; i >= 0; i-- {
		value, ok := scopes[i][name]
		if ok {
			return value, true
		}
	}

	return "", false
}

func cloneScopes(scopes []Scope) []Scope {
	result := make([]Scope, len(scopes))

	for i, scope := range scopes {
		copied := Scope{}

		for key, value := range scope {
			copied[key] = value
		}

		result[i] = copied
	}

	return result
}

func validPath(path string) (string, error) {
	cleaned := filepath.Clean(filepath.FromSlash(path))

	if cleaned == "." ||
		filepath.IsAbs(cleaned) ||
		cleaned == ".." ||
		strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid include path: %q", path)
	}

	root, err := filepath.Abs("frontend")
	if err != nil {
		return "", fmt.Errorf("resolve frontend directory: %w", err)
	}

	target := filepath.Join(root, cleaned)

	rel, err := filepath.Rel(root, target)
	if err != nil {
		return "", fmt.Errorf("validate include path: %w", err)
	}
	if rel == ".." ||
		strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("include path escapes frontend directory: %q", path)
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", fmt.Errorf("resolve frontend directory: %w", err)
	}
	resolvedTarget, err := filepath.EvalSymlinks(target)
	if err != nil {
		return "", fmt.Errorf("resolve include %q: %w", path, err)
	}
	rel, err = filepath.Rel(resolvedRoot, resolvedTarget)
	if err != nil {
		return "", fmt.Errorf("validate resolved include path: %w", err)
	}
	if rel == ".." ||
		strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("include symlink escapes frontend directory: %q", path)
	}
	return resolvedTarget, nil
}

func compileContent(
	content string,
	scopes []Scope,
	depth int,
	source string,
) (string, error) {
	// just in case
	if depth > 32 {
		return "", makeTemplateError(
			source,
			content,
			0,
			"",
			"maximum component nesting depth exceeded",
			nil,
			http.StatusInternalServerError,
		)
	}

	scopes = cloneScopes(scopes)
	baseDepth := len(scopes)

	var result strings.Builder

	matches := tokenRegex.FindAllStringSubmatchIndex(content, -1)
	last := 0

	for _, match := range matches {
		result.WriteString(content[last:match[0]])

		token := strings.TrimSpace(content[match[2]:match[3]])
		last = match[1]

		if strings.HasPrefix(token, "include ") ||
			strings.HasPrefix(token, "include\t") {

			parts := includeRegex.FindStringSubmatch(token)

			if len(parts) == 0 {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					"Invalid include directive",
					nil,
					http.StatusInternalServerError,
				)
			}

			includeName := parts[1]

			path, err := validPath(includeName)
			if err != nil {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					fmt.Sprintf("invalid component path %q", includeName),
					err,
					http.StatusInternalServerError,
				)
			}
			component, err := os.ReadFile(path)
			if err != nil {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					fmt.Sprintf("could not read component %q", includeName),
					err,
					http.StatusInternalServerError,
				)
			}

			body := string(component)

			var params []string

			if header := headerRegex.FindStringSubmatch(body); len(header) > 0 {
				body = headerRegex.ReplaceAllString(body, "")

				seen := map[string]bool{}

				if strings.TrimSpace(header[1]) != "" {
					for _, param := range strings.Split(header[1], ",") {
						param = strings.TrimSpace(param)
						// just lovely
						if !identifierRegex.MatchString(param) {
							return "", makeTemplateError(
								source,
								content,
								match[0],
								token,
								fmt.Sprintf("invalid component parameter %q", param),
								nil,
								http.StatusInternalServerError,
							)
						}

						if seen[param] {
							return "", makeTemplateError(
								source,
								content,
								match[0],
								token,
								fmt.Sprintf("duplicate component parameter %q", param),
								nil,
								http.StatusInternalServerError,
							)
						}

						seen[param] = true
						params = append(params, param)
					}
				}
			}

			var args []string

			if len(parts) > 2 && strings.TrimSpace(parts[2]) != "" {
				for _, arg := range strings.Split(parts[2], ",") {
					arg = strings.TrimSpace(arg)

					if !identifierRegex.MatchString(arg) {
						return "", makeTemplateError(
							source,
							content,
							match[0],
							token,
							fmt.Sprintf("invaldi component argument %q", arg),
							nil,
							http.StatusInternalServerError,
						)
					}

					args = append(args, arg)
				}
			}

			if len(params) != len(args) {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					fmt.Sprintf(
						"component %q expects %d arguments, but received %d",
						includeName,
						len(params),
						len(args),
					),
					nil,
					http.StatusInternalServerError,
				)
			}

			componentScope := Scope{}

			var dict strings.Builder
			dict.WriteString("(dict")

			for i, param := range params {
				value, ok := lookup(scopes, args[i])

				if !ok {
					return "", makeTemplateError(
						source,
						content,
						match[0],
						token,
						fmt.Sprintf("UNknown variable %q passed to component %q", args[i], includeName),
						nil,
						http.StatusInternalServerError,
					)
				}

				fmt.Fprintf(&dict, " %q %s", param, value)
				componentScope[param] = "." + param
			}

			dict.WriteString(")")

			compiled, err := compileContent(
				body,
				[]Scope{componentScope},
				depth+1,
				includeName,
			)

			if err != nil {
				return "", fmt.Errorf("component %q: %w", includeName, err)
			}

			if len(params) == 0 {
				result.WriteString(compiled)
			} else {
				result.WriteString("{{with " + dict.String() + "}}")
				result.WriteString(compiled)
				result.WriteString("{{end}}")
			}

			continue
		}

		if token == "endfor" {
			if len(scopes) <= baseDepth {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					"enexpected endfor no loop to be ended",
					nil,
					http.StatusInternalServerError,
				)
			}

			scopes = scopes[:len(scopes)-1]
			result.WriteString("{{end}}")
			continue
		}

		if strings.HasPrefix(token, "for ") {
			parts := strings.Fields(token)

			if len(parts) != 4 || parts[2] != "in" {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					"invalid loop syntax. Expected: {|for item in collection|}",
					nil,
					http.StatusInternalServerError,
				)
			}

			variable := parts[1]
			collection := parts[3]

			if !identifierRegex.MatchString(variable) ||
				!identifierRegex.MatchString(collection) {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					"invalid loop variable or collection name",
					nil,
					http.StatusInternalServerError,
				)
			}

			expr, ok := lookup(scopes, collection)

			if !ok {
				return "", makeTemplateError(
					source,
					content,
					match[0],
					token,
					fmt.Sprintf("unknown collection %q", collection),
					nil,
					http.StatusInternalServerError,
				)
			}

			result.WriteString(
				fmt.Sprintf("{{range $%s := %s}}", variable, expr),
			)

			nextScope := Scope{}

			for key, value := range scopes[len(scopes)-1] {
				nextScope[key] = value
			}

			nextScope[variable] = "$" + variable
			scopes = append(scopes, nextScope)

			continue
		}

		if !identifierRegex.MatchString(token) {
			return "", makeTemplateError(
				source,
				content,
				match[0],
				token,
				fmt.Sprintf("unknown directive %q", token),
				nil,
				http.StatusInternalServerError,
			)
		}

		value, ok := lookup(scopes, token)

		if !ok {
			return "", makeTemplateError(
				source,
				content,
				match[0],
				token,
				fmt.Sprintf("unknown variable %q", token),
				nil,
				http.StatusInternalServerError,
			)
		}

		result.WriteString("{{" + value + "}}")
	}

	result.WriteString(content[last:])

	if len(scopes) != baseDepth {
		return "", makeTemplateError(
			source,
			content,
			len(content),
			"",
			"enclosed for loop expected {|endfor|}",
			nil,
			http.StatusInternalServerError,
		)
	}

	return result.String(), nil
}

func dict(values ...any) (map[string]any, error) {
	if len(values)%2 != 0 {
		return nil, fmt.Errorf("dict requires key  value pairs")
	}

	result := make(map[string]any)

	for i := 0; i < len(values); i += 2 {
		key, ok := values[i].(string)

		if !ok {
			return nil, fmt.Errorf("dict keys must be strings")
		}

		result[key] = values[i+1]
	}

	return result, nil
}

func render(
	content string,
	data map[string]any,
	source string,
) (string, error) {
	scope := Scope{}

	for key := range data {
		if !identifierRegex.MatchString(key) {
			return "", &TemplateError{
				File:       source,
				Message:    fmt.Sprintf("Invalid data key %q", key),
				StatusCode: http.StatusInternalServerError,
			}
		}

		scope[key] = "." + key
	}

	compiled, err := compileContent(
		content,
		[]Scope{scope},
		0,
		source,
	)

	if err != nil {
		return "", fmt.Errorf("compile template: %w", err)
	}

	tmpl, err := template.New("page").Funcs(
		template.FuncMap{
			"dict": dict,
		},
	).Parse(compiled)

	if err != nil {
		return "", &TemplateError{
			File:       source,
			Message:    "HTML template parsing failed: " + err.Error(),
			Cause:      err,
			StatusCode: http.StatusInternalServerError,
		}
	}

	var output strings.Builder

	if err := tmpl.Execute(&output, data); err != nil {
		return "", &TemplateError{
			File:       source,
			Message:    "HTML template execution failed: " + err.Error(),
			Cause:      err,
			StatusCode: http.StatusInternalServerError,
		}
	}

	return output.String(), nil
}

func buildPage(
	page string,
	data map[string]any,
) (string, error) {
	if !pageNameRegex.MatchString(page) {
		return "", &TemplateError{
			File:       "page",
			Message:    fmt.Sprintf("Invalid page name %q", page),
			StatusCode: http.StatusBadRequest,
		}
	}

	layout, err := os.ReadFile("frontend/index.html")
	if err != nil {
		return "", &TemplateError{
			File:       "frontend/index.html",
			Message:    "could not read layout file",
			Cause:      err,
			StatusCode: http.StatusInternalServerError,
		}
	}

	pagePath := filepath.Join(
		"frontend",
		"src",
		"pages",
		page+".html",
	)

	content, err := os.ReadFile(pagePath)
	if err != nil {
		status := http.StatusInternalServerError
		message := "Could not read page"

		if os.IsNotExist(err) {
			status = http.StatusNotFound
			message = "Page not found"
		}

		return "", &TemplateError{
			File:       filepath.ToSlash(pagePath),
			Message:    message,
			Cause:      err,
			StatusCode: status,
		}
	}

	compiledPage, err := compileContent(
		string(content),
		[]Scope{makeScope(data)},
		0,
		filepath.ToSlash(pagePath),
	)
	if err != nil {
		return "", err
	}

	compiledLayout, err := compileContent(
		string(layout),
		[]Scope{makeScope(data)},
		0,
		"frontend/index.html",
	)
	if err != nil {
		return "", err
	}

	combined := strings.Replace(
		compiledLayout,
		"{body}",
		compiledPage,
		1,
	)

	return executeTemplate(combined, data)
}

func makeScope(data map[string]any) Scope {
	scope := Scope{}

	for key := range data {
		if identifierRegex.MatchString(key) {
			scope[key] = "." + key
		}
	}

	return scope
}

func executeTemplate(
	compiled string,
	data map[string]any,
) (string, error) {
	tmpl, err := template.New("page").Funcs(
		template.FuncMap{
			"dict": dict,
		},
	).Parse(compiled)

	if err != nil {
		return "", &TemplateError{
			File:       "compiled template",
			Message:    "template parsing failed: " + err.Error(),
			Cause:      err,
			StatusCode: http.StatusInternalServerError,
		}
	}

	var output strings.Builder

	if err := tmpl.Execute(&output, data); err != nil {
		return "", &TemplateError{
			File:       "compiled template",
			Message:    "template execution failed: " + err.Error(),
			Cause:      err,
			StatusCode: http.StatusInternalServerError,
		}
	}

	return output.String(), nil
}

func writeTemplateError(w http.ResponseWriter, err error) {
	log.Printf("Template error: %v", err)

	status := http.StatusInternalServerError

	var templateErr *TemplateError
	if errors.As(err, &templateErr) && templateErr.StatusCode != 0 {
		status = templateErr.StatusCode
	}

	errorMessage := err.Error()

	if templateErr != nil {
		errorMessage = fmt.Sprintf(
			"File: %s\nLine: %s\nDirective: %s\n\nError: %s",
			templateErr.File,
			lineText(templateErr.Line),
			templateErr.Directive,
			templateErr.Message,
		)

		if templateErr.Cause != nil {
			errorMessage += "\n\nCause: " + templateErr.Cause.Error()
		}
	}

	errorPage, readErr := os.ReadFile("frontend/src/pages/error.html")

	if readErr != nil {
		log.Printf("Could not load error.html: %v", readErr)
		http.Error(w, "Internal server error", status)
		return
	}

	output := strings.ReplaceAll(
		string(errorPage),
		"{|error|}",
		html.EscapeString(errorMessage),
	)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)

	if _, writeErr := w.Write([]byte(output)); writeErr != nil {
		log.Printf("Could not write error response: %v", writeErr)
	}
}

func lineText(line int) string {
	if line == 0 {
		return "Unavailable"
	}

	return fmt.Sprintf("%d", line)
}

func errorAs(err error, target any) bool {
	switch value := target.(type) {
	case **TemplateError:
		for err != nil {
			if templateErr, ok := err.(*TemplateError); ok {
				*value = templateErr
				return true
			}

			err = unwrap(err)
		}
	}

	return false
}

func unwrap(err error) error {
	type unwrapper interface {
		Unwrap() error
	}

	if value, ok := err.(unwrapper); ok {
		return value.Unwrap()
	}

	return nil
}

func ServePage(page string, pageData ...map[string]any) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		data := map[string]any{}

		if len(pageData) > 0 && pageData[0] != nil {
			data = pageData[0]
		}

		output, err := buildPage(page, data)

		if err != nil {
			writeTemplateError(w, err)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)

		if r.Method == http.MethodHead {
			return
		}

		if _, err := w.Write([]byte(output)); err != nil {
			log.Printf("Response write error: %v", err)
		}
	}
}
