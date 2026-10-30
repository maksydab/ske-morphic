package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"ske-morph/algorithm"
	"ske-morph/pages"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			serve404(w, r)
			return
		}

		pages.ServePage("home", map[string]any{"featured": algorithm.GetFeatured()})(w, r)
	})

	mux.HandleFunc("/about", pages.ServePage("about"))

	mux.Handle(
		"/assets/",
		http.StripPrefix(
			"/assets/",
			http.FileServer(http.Dir("frontend/assets")),
		),
	)

	mux.Handle(
		"/dist/",
		http.StripPrefix(
			"/dist/",
			http.FileServer(http.Dir("frontend/dist")),
		),
	)

	mux.Handle(
		"/frt/",
		http.StripPrefix(
			"/frt/",
			http.FileServer(http.Dir("frontend")),
		),
	)

	mux.HandleFunc("/v/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"package":"ske-morph","version":"0.1"}`)
	})

	fmt.Println("Server running at http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", mux))
}

func serve404(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile("frontend/src/pages/404.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	_, _ = w.Write(data)
}
