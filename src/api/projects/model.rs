use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(deserialize_with = "crate::api::serde_sqlite::bool_from_int")]
    pub expanded_state: bool,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateProject {
    pub path: String,
}
