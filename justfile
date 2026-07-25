set shell := ["/bin/bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

tauri_cli := "./ui/node_modules/.bin/tauri"
tauri_config := "tauri.conf.json"

## --- cgo ---

# Diff and regenerate cgo SQL bindings
sqlc:
    cd cgo && sqlc diff
    cd cgo && sqlc generate

## --- desktop (Tauri) ---

# Vite (ui, port 5173) + desktop_app via Tauri CLI
[default]
dev:
    {{ tauri_cli }} dev --config {{ tauri_config }}

# Production UI build + packaged desktop app
build:
    {{ tauri_cli }} build --config {{ tauri_config }}

## --- quality ---

# Test ui, rust, and cgo sources
test:
    ( cd ui && bun run test )
    cargo test
    cd cgo && go test ./...

# Lint ui, rust, and cgo sources
lint:
    ( cd ui && bun run lint && bun run check )
    cargo clippy -- -D warnings
    cd cgo && go vet ./...

# Format ui, rust, and cgo sources
fmt:
    ( cd ui && bun run format )
    cargo fmt
    cd cgo && go fmt ./...

# Rust target/ (includes Go archive in OUT_DIR)
clean:
    cargo clean
