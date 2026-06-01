//! Builds the Go c-archive in OUT_DIR and links it into the Rust crate.
//! Optional env: `POLYCODE_SKIP_GO_BUILD`

use std::env;
use std::path::PathBuf;
use std::process::Command;

const CGO_DIR: &str = "cgo";
const ARCHIVE: &str = "libpolycode_cgo.a";

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let go_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join(CGO_DIR);
    let archive = out_dir.join(ARCHIVE);

    if env::var_os("POLYCODE_SKIP_GO_BUILD").is_some() {
        assert!(
            archive.is_file(),
            "POLYCODE_SKIP_GO_BUILD: missing {}; run `cargo build` first",
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

    let link_name = static_lib_name(ARCHIVE);
    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static={link_name}");

    #[cfg(target_os = "linux")]
    {
        println!("cargo:rustc-link-lib=dylib=pthread");
        println!("cargo:rustc-link-lib=dylib=m");
    }

    println!("cargo:rerun-if-env-changed=POLYCODE_SKIP_GO_BUILD");
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

/// `libpolycode_cgo.a` → `polycode_cgo` for `cargo:rustc-link-lib=static=…`
fn static_lib_name(archive: &str) -> String {
    let base = archive.strip_prefix("lib").unwrap_or(archive);
    let base = base.strip_suffix(".a").unwrap_or(base);
    base.into()
}
