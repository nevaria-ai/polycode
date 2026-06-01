use std::path::PathBuf;

pub fn data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("POLYCODE_DATA_DIR") {
        PathBuf::from(dir)
    } else {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".polycode")
    }
}

pub fn db_path() -> PathBuf {
    data_dir().join("polycode.db")
}
