use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub path: String,
    pub created_at: i64,
    pub removed_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProject {
    pub path: String,
}
