//! Product constants from repo-root `constants.json` (shared with the UI).
//!
//! Only fields the Rust app actually uses are exposed. `build.rs` reads the same
//! JSON independently for the cgo archive / skip-env names.

use serde::Deserialize;
use std::sync::LazyLock;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConstantsJson {
    app_slug: String,
    env_prefix: String,
}

#[derive(Debug)]
pub struct Constants {
    pub env_data_dir: String,
    pub data_dir_dot_name: String,
    pub db_file_name: String,
}

impl Constants {
    fn load() -> Self {
        let c: ConstantsJson =
            serde_json::from_str(include_str!("../constants.json")).expect("constants.json");
        Self {
            env_data_dir: format!("{}_DATA_DIR", c.env_prefix),
            data_dir_dot_name: format!(".{}", c.app_slug),
            db_file_name: format!("{}.db", c.app_slug),
        }
    }
}

pub static CONSTANTS: LazyLock<Constants> = LazyLock::new(Constants::load);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_path_constants() {
        assert_eq!(CONSTANTS.env_data_dir, "ESKCODE_DATA_DIR");
        assert_eq!(CONSTANTS.data_dir_dot_name, ".esk-code");
        assert_eq!(CONSTANTS.db_file_name, "esk-code.db");
    }
}
