set shell := ["/bin/bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

# --- cgo ---

go-test:
    cd cgo && go test ./...

go-sqlc:
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

# Go tests in cgo/, then Rust tests
test:
    just go-test
    cargo test

web-validate:
    ( cd ui && bun run test && bun run lint && bun run check )


# Rust target/ (includes Go archive in OUT_DIR)
clean:
    cargo clean
