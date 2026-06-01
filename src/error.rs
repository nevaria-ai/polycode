use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

use crate::db::DbError;

#[allow(dead_code)]
#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Database(String),
    Unauthorized,
}

#[allow(dead_code)]
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    code: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message, code) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg, "NOT_FOUND".into()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg, "BAD_REQUEST".into()),
            AppError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, e, "DATABASE".into()),
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "Unauthorized".into(),
                "UNAUTHORIZED".into(),
            ),
        };
        (
            status,
            axum::Json(ErrorResponse {
                error: message,
                code,
            }),
        )
            .into_response()
    }
}

impl From<DbError> for AppError {
    fn from(e: DbError) -> Self {
        AppError::Database(e.message)
    }
}
