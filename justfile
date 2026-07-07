set shell := ["/bin/bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

# --- cgo ---

sqlc:
    cd cgo && sqlc diff
    cd cgo && sqlc generate

# --- app ---

# Vite (ui) + API; Vite proxies /api to the API bind addr (default 127.0.0.1:3001)
[default]
dev:
    #!/usr/bin/env bash
    ( cd ui && bun run dev ) &
    WEB_PID=$!
    cargo run &
    API_PID=$!
    trap 'kill $WEB_PID $API_PID 2>/dev/null || true' INT TERM EXIT
    wait $WEB_PID $API_PID

# SvelteKit static build + release binary (embedded frontend)
build:
    ( cd ui && bun run build )
    cargo build --release

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
