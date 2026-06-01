#[cfg(not(debug_assertions))]
use rust_embed::Embed;

#[cfg(not(debug_assertions))]
#[derive(Embed)]
#[folder = "ui/build/"]
pub struct Assets;

#[cfg(debug_assertions)]
pub struct Assets;

#[cfg(debug_assertions)]
impl Assets {
    pub fn get(_path: &str) -> Option<EmbeddedFile> {
        None
    }
}

#[cfg(debug_assertions)]
pub struct EmbeddedFile {
    pub data: Vec<u8>,
}
