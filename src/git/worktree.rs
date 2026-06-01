use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub name: String,
    pub path: String,
    pub is_current: bool,
    pub branch: Option<String>,
}

pub struct GitOps;

impl GitOps {
    fn git_output_checked(cmd: &mut std::process::Command, context: &str) -> Result<(), String> {
        let output = cmd
            .output()
            .map_err(|e| format!("failed to run {context}: {e}"))?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("exit status {}", output.status)
        };
        Err(format!("{context} failed: {details}"))
    }

    pub fn list_worktrees(repo_path: &Path) -> Result<Vec<WorktreeInfo>, String> {
        let repo = gix::open(repo_path).map_err(|e| e.to_string())?;
        let mut result = Vec::new();

        if let Some(wt) = repo.worktree() {
            let branch = repo
                .head_name()
                .ok()
                .flatten()
                .map(|name| name.shorten().to_string());
            result.push(WorktreeInfo {
                name: wt
                    .id()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "main".to_string()),
                path: wt.base().to_string_lossy().to_string(),
                is_current: true,
                branch,
            });
        }

        let linked = repo.worktrees().map_err(|e| e.to_string())?;
        for proxy in linked {
            let name = proxy.id().to_string();
            let wt_path = proxy.base().map_err(|e| e.to_string())?;
            let branch = proxy
                .into_repo()
                .ok()
                .and_then(|r| r.head_name().ok().flatten())
                .map(|name_ref| name_ref.shorten().to_string());
            result.push(WorktreeInfo {
                name,
                path: wt_path.to_string_lossy().to_string(),
                is_current: false,
                branch,
            });
        }

        Ok(result)
    }

    pub fn create_worktree(
        repo_path: &Path,
        worktree_path: &Path,
        branch: &str,
    ) -> Result<WorktreeInfo, String> {
        // Creating worktrees from an unborn HEAD repo leads to ambiguous branch behavior.
        // Require at least one commit before allowing worktree creation.
        let mut verify_head_cmd = std::process::Command::new("git");
        verify_head_cmd
            .args(["rev-parse", "--verify", "HEAD"])
            .current_dir(repo_path);
        Self::git_output_checked(
            &mut verify_head_cmd,
            "verify repository has at least one commit",
        )
        .map_err(|_| {
            "cannot create worktree: repository has no commits yet; create an initial commit first"
                .to_string()
        })?;

        if worktree_path.exists() {
            return Err(format!("path already exists: {}", worktree_path.display()));
        }

        let mut create_cmd = std::process::Command::new("git");
        create_cmd
            .args([
                "worktree",
                "add",
                &worktree_path.to_string_lossy(),
                "-b",
                branch,
            ])
            .current_dir(repo_path);
        Self::git_output_checked(&mut create_cmd, "create worktree")?;

        if !worktree_path.exists() {
            return Err("git worktree add did not create expected directory".into());
        }

        Ok(WorktreeInfo {
            name: worktree_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| branch.to_string()),
            path: worktree_path.to_string_lossy().to_string(),
            is_current: false,
            branch: Some(branch.to_string()),
        })
    }

    pub fn delete_worktree(
        repo_path: &Path,
        worktree_path: &Path,
        branch: &str,
    ) -> Result<(), String> {
        std::process::Command::new("git")
            .args(["worktree", "remove", &worktree_path.to_string_lossy()])
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("failed to run git worktree remove: {e}"))?;

        std::process::Command::new("git")
            .args(["branch", "-D", branch])
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("failed to delete branch: {e}"))?;

        Ok(())
    }

    pub fn rename_worktree_branch(
        repo_path: &Path,
        worktree_path: &Path,
        old_name: &str,
        new_name: &str,
    ) -> Result<(), String> {
        if old_name == new_name {
            return Err("new branch name must differ from current branch name".to_string());
        }

        let current = Self::get_worktree_branch(worktree_path)?
            .ok_or_else(|| "worktree is not on a branch".to_string())?;
        if current != old_name {
            return Err(format!(
                "worktree branch mismatch: expected '{old_name}', found '{current}'"
            ));
        }

        let verify_ref = format!("refs/heads/{new_name}");
        let mut exists_cmd = std::process::Command::new("git");
        exists_cmd
            .args(["show-ref", "--verify", "--quiet", &verify_ref])
            .current_dir(repo_path);
        let exists = exists_cmd
            .status()
            .map_err(|e| format!("failed to check branch existence: {e}"))?;
        if exists.success() {
            return Err(format!("branch '{new_name}' already exists"));
        }

        let mut rename_cmd = std::process::Command::new("git");
        rename_cmd
            .args(["branch", "-m", new_name])
            .current_dir(worktree_path);
        Self::git_output_checked(&mut rename_cmd, "rename branch")?;
        Ok(())
    }

    pub fn get_worktree_branch(path: &Path) -> Result<Option<String>, String> {
        let repo = gix::open(path).map_err(|e| e.to_string())?;
        Ok(repo
            .head_name()
            .ok()
            .flatten()
            .map(|name| name.shorten().to_string()))
    }

    pub fn get_default_branch(repo_path: &Path) -> Result<String, String> {
        let repo = gix::open(repo_path).map_err(|e| e.to_string())?;
        repo.head_name()
            .map_err(|e| e.to_string())?
            .map(|name| name.shorten().to_string())
            .ok_or_else(|| "no head branch".to_string())
    }

    pub fn resolve_repo_root(path: &Path) -> Result<std::path::PathBuf, String> {
        let repo = match gix::discover(path) {
            Ok(r) => r,
            Err(_) => return Ok(path.to_path_buf()),
        };
        let wt = repo
            .worktree()
            .ok_or_else(|| "repository has no worktree".to_string())?;
        Ok(wt.base().to_path_buf())
    }

    pub fn get_remote_origin_name(repo_path: &Path) -> Option<String> {
        let repo = gix::open(repo_path).ok()?;
        let remote = repo.find_remote("origin").ok()?;
        let url = remote.url(gix::remote::Direction::Fetch)?.to_string();
        let stripped = url
            .trim_start_matches("https://")
            .trim_start_matches("git@")
            .trim_start_matches("ssh://")
            .trim_end_matches(".git");
        let separator_pos = stripped.find(|c: char| c == '/' || c == ':')?;
        let name = &stripped[separator_pos + 1..];
        if name.contains('/') {
            Some(name.replace(':', "/"))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::TempDir;

    fn init_repo(dir: &TempDir) {
        let path = dir.path();
        Command::new("git")
            .args(["init", "-b", "main"])
            .current_dir(path)
            .output()
            .expect("git init");
        Command::new("git")
            .args(["config", "user.email", "test@test.com"])
            .current_dir(path)
            .output()
            .expect("git config email");
        Command::new("git")
            .args(["config", "user.name", "Test"])
            .current_dir(path)
            .output()
            .expect("git config name");
        Command::new("touch")
            .arg(path.join("README.md"))
            .output()
            .expect("touch");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(path)
            .output()
            .expect("git commit");
    }

    fn init_repo_no_commit(dir: &TempDir) {
        let path = dir.path();
        Command::new("git")
            .args(["init", "-b", "main"])
            .current_dir(path)
            .output()
            .expect("git init");
        Command::new("git")
            .args(["config", "user.email", "test@test.com"])
            .current_dir(path)
            .output()
            .expect("git config email");
        Command::new("git")
            .args(["config", "user.name", "Test"])
            .current_dir(path)
            .output()
            .expect("git config name");
    }

    #[test]
    fn test_list_worktrees_empty() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let result = GitOps::list_worktrees(dir.path()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "main");
        assert!(result[0].is_current);
        assert_eq!(result[0].branch.as_deref(), Some("main"));
    }

    #[test]
    fn test_get_default_branch() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let branch = GitOps::get_default_branch(dir.path()).unwrap();
        assert_eq!(branch, "main");
    }

    #[test]
    fn test_get_default_branch_nonexistent() {
        let result = GitOps::get_default_branch(Path::new("/nonexistent/path"));
        assert!(result.is_err());
    }

    #[test]
    fn test_create_and_delete_worktree() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("feature-x");
        let wt = GitOps::create_worktree(dir.path(), &wt_path, "feature-x").unwrap();
        assert_eq!(wt.name, "feature-x");
        assert_eq!(wt.branch.as_deref(), Some("feature-x"));
        assert!(!wt.is_current);

        let list = GitOps::list_worktrees(dir.path()).unwrap();
        assert_eq!(list.len(), 2);

        let wt_path_obj = Path::new(&wt.path);
        GitOps::delete_worktree(dir.path(), wt_path_obj, "feature-x").unwrap();

        let list = GitOps::list_worktrees(dir.path()).unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_resolve_repo_root_main_repo() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let resolved = GitOps::resolve_repo_root(dir.path()).unwrap();
        assert_eq!(resolved, dir.path());
    }

    #[test]
    fn test_resolve_repo_root_non_git_fallback() {
        let dir = TempDir::new().unwrap();
        let resolved = GitOps::resolve_repo_root(dir.path()).unwrap();
        assert_eq!(resolved, dir.path());
    }

    #[test]
    fn test_get_remote_origin_name_no_remote() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let result = GitOps::get_remote_origin_name(dir.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_create_worktree_rejects_existing_branch_name() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);

        let first_path = dir.path().join("wt-a");
        GitOps::create_worktree(dir.path(), &first_path, "feature-a").unwrap();

        let second_path = dir.path().join("wt-b");
        let err = GitOps::create_worktree(dir.path(), &second_path, "feature-a").unwrap_err();
        assert!(err.contains("already exists") || err.contains("exists"));
    }

    #[test]
    fn test_create_worktree_allows_different_branch_names() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);

        let first_path = dir.path().join("wt-a");
        GitOps::create_worktree(dir.path(), &first_path, "feature-a").unwrap();

        let second_path = dir.path().join("wt-b");
        GitOps::create_worktree(dir.path(), &second_path, "feature-b").unwrap();
    }

    #[test]
    fn test_rename_branch_rejects_same_name() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("wt-a");
        GitOps::create_worktree(dir.path(), &wt_path, "feature-a").unwrap();

        let err = GitOps::rename_worktree_branch(dir.path(), &wt_path, "feature-a", "feature-a")
            .unwrap_err();
        assert!(err.contains("must differ"));
    }

    #[test]
    fn test_rename_branch_rejects_existing_branch_name() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_a_path = dir.path().join("wt-a");
        let wt_b_path = dir.path().join("wt-b");
        GitOps::create_worktree(dir.path(), &wt_a_path, "feature-a").unwrap();
        GitOps::create_worktree(dir.path(), &wt_b_path, "feature-b").unwrap();

        let err = GitOps::rename_worktree_branch(dir.path(), &wt_a_path, "feature-a", "feature-b")
            .unwrap_err();
        assert!(err.contains("already exists"));
    }

    #[test]
    fn test_create_worktree_requires_existing_commit() {
        let dir = TempDir::new().unwrap();
        init_repo_no_commit(&dir);
        let wt_path = dir.path().join("wt-a");

        let err = GitOps::create_worktree(dir.path(), &wt_path, "feature-a").unwrap_err();
        assert!(err.contains("repository has no commits yet"));
    }
}
