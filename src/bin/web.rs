#[cfg(not(debug_assertions))]
use axum::body::Body;
#[cfg(not(debug_assertions))]
use axum::http::header;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Router;
use polycode::api::AppState;
use polycode::db::DbHandle;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let addr = std::env::var("ADDR").unwrap_or_else(|_| "127.0.0.1:3001".into());

    let db = polycode::db::init_db()?;
    let app = web_app(db);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Listening on {addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

pub fn web_app(db: DbHandle) -> Router {
    let app = polycode::api::routes().with_state(AppState { db });

    #[cfg(debug_assertions)]
    let app = app.fallback_service(axum::routing::get(dev_spa_disabled));

    #[cfg(not(debug_assertions))]
    let app =
        app.fallback_service(axum::routing::get(
            |req: axum::http::Request<_>| async move {
                serve_spa(req.uri().path()).await.into_response()
            },
        ));

    app
}

#[cfg(not(debug_assertions))]
async fn serve_spa(path: &str) -> Result<impl IntoResponse, StatusCode> {
    let path = path.trim_start_matches('/');
    let asset = if path.is_empty() || !path.contains('.') {
        "index.html"
    } else {
        path
    };
    let file = polycode::embed::Assets::get(asset).ok_or(StatusCode::NOT_FOUND)?;
    let mime = mime_guess::from_path(asset).first_or_octet_stream();
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, mime.as_ref().parse().unwrap());
    Ok((StatusCode::OK, headers, Body::from(file.data.into_owned())))
}

#[cfg(debug_assertions)]
async fn dev_spa_disabled() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        "Frontend assets are not embedded in debug mode. Run ui/web with `bun run dev`.",
    )
}
