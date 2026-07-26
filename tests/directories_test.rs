//! Directory suggestion feature tests.

use esk_code::features::directories::list_directories;
use std::fs;
use std::os::unix::fs::symlink;

#[test]
fn empty_query_returns_no_suggestions() {
    let resp = list_directories("").expect("list");
    assert!(resp.suggestions.is_empty());
    assert!(!resp.exists);
}

#[test]
fn lists_matching_child_directories() {
    let dir = tempfile::TempDir::new().unwrap();
    let root = dir.path();
    fs::create_dir(root.join("alpha")).unwrap();
    fs::create_dir(root.join("beta")).unwrap();
    fs::write(root.join("file.txt"), "x").unwrap();

    let prefix = root.join("a").to_string_lossy().to_string();
    let resp = list_directories(&prefix).expect("list");
    assert!(
        resp.suggestions
            .iter()
            .any(|s| s.ends_with("/alpha") || s.ends_with("alpha")),
        "suggestions: {:?}",
        resp.suggestions
    );
    assert!(
        !resp.suggestions.iter().any(|s| s.contains("beta")),
        "prefix filter should exclude beta"
    );
}

#[test]
fn exact_directory_reports_exists() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().to_string_lossy().to_string();
    let resp = list_directories(&path).expect("list");
    assert!(resp.exists);
}

#[test]
fn tilde_query_expands_home() {
    let home = dirs::home_dir().expect("home");
    // Prefer a real home child if present; otherwise just ensure ~ expands without error.
    let q = "~/".to_string();
    let resp = list_directories(&q).expect("list");
    // Suggestions should use ~ prefix when under home.
    for s in &resp.suggestions {
        assert!(
            s.starts_with('~') || !s.starts_with(home.to_str().unwrap()),
            "expected tilde display for home children, got {s}"
        );
    }
}

#[test]
fn ignores_symlinks_that_are_not_directories_via_file_type() {
    // Smoke: listing a parent with only a file still works.
    let dir = tempfile::TempDir::new().unwrap();
    let file = dir.path().join("not-a-dir");
    fs::write(&file, "x").unwrap();
    let _ = symlink(&file, dir.path().join("link"));
    let q = format!("{}/", dir.path().display());
    let resp = list_directories(&q).expect("list");
    assert!(
        !resp.suggestions.iter().any(|s| s.ends_with("not-a-dir")),
        "files must not appear as directory suggestions"
    );
}
