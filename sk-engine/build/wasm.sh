cargo build --release --target wasm32-unknown-unknown
ls .
cp ./target/wasm32-unknown-unknown/release/sk-engine.wasm ../frontend/dist/sk-engine.wasm