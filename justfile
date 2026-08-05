set shell := ["/bin/bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

tauri_cli := "./ui/node_modules/.bin/tauri"
tauri_config := "tauri.conf.json"

# Regenerate cgo/internal/db (sqlc) and ui/src/lib/bindings.ts (specta)
bindings:
    cd cgo && sqlc generate
    cd cgo && sqlc diff
    cargo test --lib commands::tests::export_bindings -- --exact

## --- desktop (Tauri) ---

# Vite (ui, port 5173) + desktop_app via Tauri CLI
[default]
dev: bindings
    {{ tauri_cli }} dev --config {{ tauri_config }}

# Production UI build + packaged desktop app
build: bindings
    {{ tauri_cli }} build --config {{ tauri_config }}

## --- quality ---

# Test ui, rust, and cgo sources
# bindings first: sqlc for cgo/go tests; specta for UI tests (cargo test also re-exports)
test: bindings
    cargo test
    ( cd ui && bun run test )
    cd cgo && go test ./...

# Lint ui, rust, and cgo sources
lint: bindings
    ( cd ui && bun run lint && bun run check )
    cargo clippy -- -D warnings
    cd cgo && go vet ./...

# Format ui, rust, and cgo sources
# sqlc package must exist or `go fmt ./...` fails to load importers
fmt: bindings
    ( cd ui && bun run format )
    cargo fmt
    cd cgo && go fmt ./...

# Rust target/ (includes Go archive in OUT_DIR)
clean:
    cargo clean
