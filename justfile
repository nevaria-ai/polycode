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
build: bindings
    {{ tauri_cli }} build --config {{ tauri_config }}

# Escape hatch: regenerate ui/src/lib/bindings.ts via specta test (no GUI)
bindings:
    cargo test --lib commands::tests::export_bindings -- --exact

## --- quality ---

# Test ui, rust, and cgo sources
# cargo test first so export_bindings writes ui/src/lib/bindings.ts before UI vitest
test:
    cargo test
    ( cd ui && bun run test )
    cd cgo && go test ./...

# Lint ui, rust, and cgo sources
lint: bindings
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
