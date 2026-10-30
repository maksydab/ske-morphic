
mkdir -p dist
build() {
  npx postcss ske-morph/main.css -o dist/bundle.css
  echo "css rebuilt"
}
build
while inotifywait -r -e modify,create,delete,move ske-morph/; do
  build
done
