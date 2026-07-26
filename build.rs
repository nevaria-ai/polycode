//! Build script: runs `tauri-build`, then builds the Go c-archive in OUT_DIR and
//! links it into the Rust crate.

use std::env;
use std::path::PathBuf;
use std::process::Command;

use serde::Deserialize;

const CGO_DIR: &str = "cgo";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Constants {
    env_prefix: String,
}

fn main() {
    tauri_build::build();

    build_cgo();
}

/// Builds the Go c-archive in OUT_DIR and links it into the Rust crate.
fn build_cgo() {
    let Constants { env_prefix } =
        serde_json::from_str(include_str!("constants.json")).expect("constants.json");
    let app_id = env_prefix.to_ascii_lowercase();
    let cgo_archive = format!("lib{app_id}_cgo.a");
    let env_skip_go_build = format!("{env_prefix}_SKIP_GO_BUILD");

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let go_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join(CGO_DIR);
    let archive = out_dir.join(&cgo_archive);

    if env::var_os(&env_skip_go_build).is_some() {
        assert!(
            archive.is_file(),
            "{env_skip_go_build}: missing {}; run `cargo build` first",
            archive.display()
        );
    } else {
        let status = Command::new("go")
            .args(["build", "-buildmode=c-archive", "-o"])
            .arg(&archive)
            .arg(".")
            .current_dir(&go_dir)
            .env("CGO_ENABLED", "1")
            .status()
            .expect("failed to run `go` (is Go installed?)");
        assert!(status.success(), "`go build -buildmode=c-archive` failed");
    }

    let link_name = cgo_archive
        .strip_prefix("lib")
        .unwrap_or(&cgo_archive)
        .strip_suffix(".a")
        .unwrap_or(&cgo_archive);
    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static={link_name}");

    #[cfg(target_os = "linux")]
    {
        println!("cargo:rustc-link-lib=dylib=pthread");
        println!("cargo:rustc-link-lib=dylib=m");
    }

    println!("cargo:rerun-if-changed=constants.json");
    println!("cargo:rerun-if-env-changed={env_skip_go_build}");
    for path in [
        "main.go",
        "payload.go",
        "internal",
        "migrations",
        "go.mod",
        "go.sum",
    ] {
        println!("cargo:rerun-if-changed={}", go_dir.join(path).display());
    }
}
