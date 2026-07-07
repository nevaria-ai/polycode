//! Git worktree and branch helpers.
//!
//! Reads and ref lookups use [`gix`]. Mutations delegate to `git` where gitoxide has no API
//! (worktree add/remove, worktree-aware branch rename) or where `git` is simpler (branch rename).

use std::path::Path;

use gix::reference::find::existing::Error as FindReferenceError;
use gix::refs::transaction::{Change, PreviousValue, RefEdit, RefLog};
use gix::refs::FullName;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub path: String,
    /// `true` for checkouts added via `git worktree add`; `false` for the main repo worktree.
    pub is_linked_worktree: bool,
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

    fn open_repo(path: &Path) -> Result<gix::Repository, String> {
        gix::open(path).map_err(|e| e.to_string())
    }

    /// Main repository backing `path` (follows linked worktrees to common storage).
    fn main_storage_repo(path: &Path) -> Result<gix::Repository, String> {
        let repo = Self::open_repo(path)?;
        if repo.kind() == gix::repository::Kind::LinkedWorkTree {
            repo.main_repo().map_err(|e| e.to_string())
        } else {
            Ok(repo)
        }
    }

    fn local_branch_exists(repo: &gix::Repository, branch: &str) -> Result<bool, String> {
        let ref_name = format!("refs/heads/{branch}");
        match repo.find_reference(ref_name.as_str()) {
            Ok(_) => Ok(true),
            Err(FindReferenceError::NotFound { .. }) => Ok(false),
            Err(e) => Err(e.to_string()),
        }
    }

    fn delete_local_branch(repo: &gix::Repository, branch: &str) -> Result<(), String> {
        let name: FullName = format!("refs/heads/{branch}")
            .try_into()
            .map_err(|e: gix::validate::reference::name::Error| e.to_string())?;
        repo.edit_reference(RefEdit {
            change: Change::Delete {
                expected: PreviousValue::MustExist,
                log: RefLog::AndReference,
            },
            name,
            deref: false,
        })
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_worktrees(repo_path: &Path) -> Result<Vec<WorktreeInfo>, String> {
        let repo = Self::open_repo(repo_path)?;
        let mut result = Vec::new();

        if let Some(wt) = repo.worktree() {
            let branch = repo
                .head_name()
                .ok()
                .flatten()
                .map(|name| name.shorten().to_string());
            result.push(WorktreeInfo {
                path: wt.base().to_string_lossy().to_string(),
                is_linked_worktree: false,
                branch,
            });
        }

        let linked = repo.worktrees().map_err(|e| e.to_string())?;
        for proxy in linked {
            let wt_path = proxy.base().map_err(|e| e.to_string())?;
            let branch = proxy
                .into_repo()
                .ok()
                .and_then(|r| r.head_name().ok().flatten())
                .map(|name_ref| name_ref.shorten().to_string());
            result.push(WorktreeInfo {
                path: wt_path.to_string_lossy().to_string(),
                is_linked_worktree: true,
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
        Self::open_repo(repo_path)?.head_id().map_err(|_| {
            "cannot create worktree: repository has no commits yet; create an initial commit first"
                .to_string()
        })?;

        if worktree_path.exists() {
            return Err(format!("path already exists: {}", worktree_path.display()));
        }

        // gix has no linked-worktree creation API; delegate to git.
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
            path: worktree_path.to_string_lossy().to_string(),
            is_linked_worktree: true,
            branch: Some(branch.to_string()),
        })
    }

    pub fn delete_worktree(repo_path: &Path, worktree_path: &Path) -> Result<(), String> {
        let branch = if worktree_path.exists() {
            Self::get_worktree_branch(worktree_path)?
        } else {
            None
        };

        if worktree_path.exists() {
            // gix has no linked-worktree removal API; delegate to git.
            let mut remove_cmd = std::process::Command::new("git");
            remove_cmd
                .args(["worktree", "remove", &worktree_path.to_string_lossy()])
                .current_dir(repo_path);
            Self::git_output_checked(&mut remove_cmd, "remove worktree")?;
        }

        if let Some(branch) = branch {
            let main_repo = Self::main_storage_repo(repo_path)?;
            if Self::local_branch_exists(&main_repo, &branch)? {
                Self::delete_local_branch(&main_repo, &branch)?;
            }
        }
        Ok(())
    }

    /// Rename the branch checked out in `worktree_path` (`git branch -m`). Path and worktree id stay
    /// the same; only the branch name changes.
    pub fn rename_worktree_branch(
        repo_path: &Path,
        worktree_path: &Path,
        new_name: &str,
    ) -> Result<(), String> {
        let current = Self::get_worktree_branch(worktree_path)?
            .ok_or_else(|| "worktree is not on a branch".to_string())?;
        if current == new_name {
            return Err("new branch name must differ from current branch name".to_string());
        }

        let main_repo = Self::main_storage_repo(repo_path)?;
        if Self::local_branch_exists(&main_repo, new_name)? {
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
        let repo = Self::open_repo(path)?;
        Ok(repo
            .head_name()
            .ok()
            .flatten()
            .map(|name| name.shorten().to_string()))
    }

    pub fn resolve_repo_root(path: &Path) -> Result<std::path::PathBuf, String> {
        let repo = match gix::discover(path) {
            Ok(r) => r,
            Err(_) => return Ok(path.to_path_buf()),
        };

        let main = if repo.kind() == gix::repository::Kind::LinkedWorkTree {
            repo.main_repo().map_err(|e| e.to_string())?
        } else {
            repo
        };

        let wt = main
            .worktree()
            .ok_or_else(|| "repository has no worktree".to_string())?;
        Ok(wt.base().to_path_buf())
    }

    pub fn get_remote_origin_name(repo_path: &Path) -> Option<String> {
        let repo = Self::open_repo(repo_path).ok()?;
        let remote = repo.find_remote("origin").ok()?;
        let url = remote.url(gix::remote::Direction::Fetch)?.to_string();
        let stripped = url
            .trim_start_matches("https://")
            .trim_start_matches("git@")
            .trim_start_matches("ssh://")
            .trim_end_matches(".git");
        let separator_pos = stripped.find(['/', ':'])?;
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
        assert!(!result[0].is_linked_worktree);
        assert_eq!(result[0].branch.as_deref(), Some("main"));
    }

    #[test]
    fn test_create_and_delete_worktree() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("feature-x");
        let wt = GitOps::create_worktree(dir.path(), &wt_path, "feature-x").unwrap();
        assert_eq!(wt.branch.as_deref(), Some("feature-x"));
        assert!(wt.is_linked_worktree);

        let list = GitOps::list_worktrees(dir.path()).unwrap();
        assert_eq!(list.len(), 2);

        let wt_path_obj = Path::new(&wt.path);
        GitOps::delete_worktree(dir.path(), wt_path_obj).unwrap();

        let list = GitOps::list_worktrees(dir.path()).unwrap();
        assert_eq!(list.len(), 1);
        assert!(!list
            .iter()
            .any(|w| w.branch.as_deref() == Some("feature-x")));
    }

    #[test]
    fn test_resolve_repo_root_main_repo() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let resolved = GitOps::resolve_repo_root(dir.path()).unwrap();
        assert_eq!(resolved, dir.path());
    }

    #[test]
    fn test_resolve_repo_root_from_linked_worktree() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        Command::new("touch")
            .arg(dir.path().join("README.md"))
            .output()
            .expect("touch");
        Command::new("git")
            .args(["add", "."])
            .current_dir(dir.path())
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(dir.path())
            .output()
            .expect("git commit");

        let linked = dir.path().join("linked-wt");
        GitOps::create_worktree(dir.path(), &linked, "linked-branch").unwrap();

        let resolved = GitOps::resolve_repo_root(&linked).unwrap();
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

        let err = GitOps::rename_worktree_branch(dir.path(), &wt_path, "feature-a").unwrap_err();
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

        let err = GitOps::rename_worktree_branch(dir.path(), &wt_a_path, "feature-b").unwrap_err();
        assert!(err.contains("already exists"));
    }

    #[test]
    fn test_rename_branch_updates_listed_branch() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("wt-a");
        GitOps::create_worktree(dir.path(), &wt_path, "feature-a").unwrap();

        GitOps::rename_worktree_branch(dir.path(), &wt_path, "feature-renamed").unwrap();

        let listed = GitOps::list_worktrees(dir.path()).unwrap();
        let wt = listed
            .iter()
            .find(|w| w.path == wt_path.to_string_lossy())
            .unwrap();
        assert_eq!(wt.branch.as_deref(), Some("feature-renamed"));
        assert_eq!(wt.path, wt_path.to_string_lossy());
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
