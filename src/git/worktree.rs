//! Git worktree and branch helpers.
//!
//! Reads and ref lookups use [`gix`]. Mutations delegate to `git` where gitoxide has no API
//! (worktree add/remove, `git branch -d`) or where `git` is simpler (branch rename).
//!
//! Worktree delete preflights the same merge check as `git branch -d` (upstream if set, else
//! `HEAD`) so an unmerged branch fails *before* `worktree remove`. If `-d` still fails after
//! remove (race), the checkout is best-effort re-added so the tree stays consistent.

use std::path::Path;

use gix::reference::find::existing::Error as FindReferenceError;
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

    /// Tracking upstream for `branch`, if configured (`branch@{upstream}`).
    fn branch_upstream(repo_path: &Path, branch: &str) -> Option<String> {
        let output = std::process::Command::new("git")
            .args([
                "rev-parse",
                "--abbrev-ref",
                &format!("{branch}@{{upstream}}"),
            ])
            .current_dir(repo_path)
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if name.is_empty() {
            None
        } else {
            Some(name)
        }
    }

    /// Same merge gate as `git branch -d`: fully merged into upstream if set, else into `HEAD`.
    fn ensure_branch_safe_to_delete(repo_path: &Path, branch: &str) -> Result<(), String> {
        let into = Self::branch_upstream(repo_path, branch).unwrap_or_else(|| "HEAD".into());
        let output = std::process::Command::new("git")
            .args(["merge-base", "--is-ancestor", branch, &into])
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("failed to run git merge-base --is-ancestor: {e}"))?;
        if output.status.success() {
            return Ok(());
        }
        Err(format!(
            "git branch -d failed: the branch '{branch}' is not fully merged"
        ))
    }

    /// `git branch -d` (`--delete`): refuse when not fully merged.
    fn delete_local_branch_safe(repo_path: &Path, branch: &str) -> Result<(), String> {
        let mut delete_cmd = std::process::Command::new("git");
        delete_cmd
            .args(["branch", "-d", branch])
            .current_dir(repo_path);
        Self::git_output_checked(&mut delete_cmd, "git branch -d")
    }

    /// Recreate a linked checkout at `worktree_path` on an existing local branch.
    fn readd_linked_worktree(
        repo_path: &Path,
        worktree_path: &Path,
        branch: &str,
    ) -> Result<(), String> {
        let mut add_cmd = std::process::Command::new("git");
        add_cmd
            .args(["worktree", "add", &worktree_path.to_string_lossy(), branch])
            .current_dir(repo_path);
        Self::git_output_checked(&mut add_cmd, "re-add worktree")
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

        // Refuse unmerged branches before removing the checkout so the worktree stays in the
        // tree (sessions visible) until the user merges or otherwise resolves.
        if let Some(ref branch) = branch {
            let main_repo = Self::main_storage_repo(repo_path)?;
            if Self::local_branch_exists(&main_repo, branch)? {
                Self::ensure_branch_safe_to_delete(repo_path, branch)?;
            }
        }

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
                if let Err(err) = Self::delete_local_branch_safe(repo_path, &branch) {
                    // Rare race: preflight passed but `-d` failed. Restore checkout so the
                    // sidebar/tree still show the worktree for the user to fix.
                    let _ = Self::readd_linked_worktree(repo_path, worktree_path, &branch);
                    return Err(err);
                }
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

    #[test]
    fn test_delete_worktree_rejects_dirty_checkout() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("dirty-wt");
        GitOps::create_worktree(dir.path(), &wt_path, "dirty-branch").unwrap();

        std::fs::write(wt_path.join("dirty.txt"), "uncommitted").unwrap();

        let err = GitOps::delete_worktree(dir.path(), &wt_path).unwrap_err();
        assert!(err.contains("modified or untracked"));
        assert!(wt_path.exists(), "dirty checkout must not be removed");
        let listed = GitOps::list_worktrees(dir.path()).unwrap();
        assert!(listed.iter().any(|w| w.path == wt_path.to_string_lossy()));
        let branch_list = Command::new("git")
            .args(["branch", "--list", "dirty-branch"])
            .current_dir(dir.path())
            .output()
            .expect("git branch");
        assert!(String::from_utf8_lossy(&branch_list.stdout).contains("dirty-branch"));
    }

    #[test]
    fn test_delete_worktree_rejects_unmerged_branch() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("unmerged-wt");
        GitOps::create_worktree(dir.path(), &wt_path, "unmerged-branch").unwrap();

        std::fs::write(wt_path.join("feature.txt"), "feature work").unwrap();
        Command::new("git")
            .args(["add", "feature.txt"])
            .current_dir(&wt_path)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "feature-only commit"])
            .current_dir(&wt_path)
            .output()
            .expect("git commit");

        let err = GitOps::delete_worktree(dir.path(), &wt_path).unwrap_err();
        assert!(
            err.contains("not fully merged"),
            "expected -d-style message, got: {err}"
        );
        assert!(
            err.contains("git branch -d failed"),
            "preflight should surface as branch -d failure: {err}"
        );
        assert!(
            wt_path.exists(),
            "preflight must keep checkout so the worktree stays in the tree"
        );
        let branch_list = Command::new("git")
            .args(["branch", "--list", "unmerged-branch"])
            .current_dir(dir.path())
            .output()
            .expect("git branch");
        assert!(String::from_utf8_lossy(&branch_list.stdout).contains("unmerged-branch"));
        let listed = GitOps::list_worktrees(dir.path()).unwrap();
        assert!(listed.iter().any(|w| w.path == wt_path.to_string_lossy()));
    }

    #[test]
    fn test_delete_worktree_succeeds_after_merge_regression() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("later-merged-wt");
        GitOps::create_worktree(dir.path(), &wt_path, "later-merged").unwrap();

        std::fs::write(wt_path.join("feature.txt"), "feature work").unwrap();
        Command::new("git")
            .args(["add", "feature.txt"])
            .current_dir(&wt_path)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "feature-only commit"])
            .current_dir(&wt_path)
            .output()
            .expect("git commit");

        let err = GitOps::delete_worktree(dir.path(), &wt_path).unwrap_err();
        assert!(err.contains("not fully merged"));
        assert!(wt_path.exists());

        Command::new("git")
            .args(["merge", "--no-ff", "later-merged", "-m", "merge feature"])
            .current_dir(dir.path())
            .output()
            .expect("git merge");

        GitOps::delete_worktree(dir.path(), &wt_path).unwrap();
        assert!(!wt_path.exists());
        let branch_list = Command::new("git")
            .args(["branch", "--list", "later-merged"])
            .current_dir(dir.path())
            .output()
            .expect("git branch");
        assert!(
            !String::from_utf8_lossy(&branch_list.stdout).contains("later-merged"),
            "branch should be deleted after merge + retry"
        );
        let listed = GitOps::list_worktrees(dir.path()).unwrap();
        assert_eq!(listed.len(), 1);
    }

    #[test]
    fn test_ensure_branch_safe_to_delete_matches_branch_d() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("gate-wt");
        GitOps::create_worktree(dir.path(), &wt_path, "gate-branch").unwrap();

        GitOps::ensure_branch_safe_to_delete(dir.path(), "gate-branch").unwrap();

        std::fs::write(wt_path.join("only-here.txt"), "x").unwrap();
        Command::new("git")
            .args(["add", "only-here.txt"])
            .current_dir(&wt_path)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "ahead of main"])
            .current_dir(&wt_path)
            .output()
            .expect("git commit");

        let err = GitOps::ensure_branch_safe_to_delete(dir.path(), "gate-branch").unwrap_err();
        assert!(err.contains("not fully merged"));
    }

    #[test]
    fn test_readd_linked_worktree_restores_checkout_after_remove() {
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("readd-wt");
        GitOps::create_worktree(dir.path(), &wt_path, "readd-branch").unwrap();

        Command::new("git")
            .args(["worktree", "remove", wt_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .expect("git worktree remove");
        assert!(!wt_path.exists());

        GitOps::readd_linked_worktree(dir.path(), &wt_path, "readd-branch").unwrap();
        assert!(wt_path.exists());
        let listed = GitOps::list_worktrees(dir.path()).unwrap();
        let wt = listed
            .iter()
            .find(|w| w.path == wt_path.to_string_lossy())
            .expect("re-added worktree listed");
        assert_eq!(wt.branch.as_deref(), Some("readd-branch"));
        assert!(wt.is_linked_worktree);
    }

    #[test]
    fn test_delete_worktree_readd_on_branch_d_race() {
        // Simulate preflight-passed then `-d` failing: remove checkout first, leave an
        // unmerged branch, then exercise the re-add recovery path used after `-d` errors.
        let dir = TempDir::new().unwrap();
        init_repo(&dir);
        let wt_path = dir.path().join("race-wt");
        GitOps::create_worktree(dir.path(), &wt_path, "race-branch").unwrap();

        std::fs::write(wt_path.join("ahead.txt"), "ahead").unwrap();
        Command::new("git")
            .args(["add", "ahead.txt"])
            .current_dir(&wt_path)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "ahead"])
            .current_dir(&wt_path)
            .output()
            .expect("git commit");

        Command::new("git")
            .args(["worktree", "remove", wt_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .expect("git worktree remove");

        let err = GitOps::delete_local_branch_safe(dir.path(), "race-branch").unwrap_err();
        assert!(err.contains("not fully merged"));
        GitOps::readd_linked_worktree(dir.path(), &wt_path, "race-branch").unwrap();
        assert!(wt_path.exists());
        assert_eq!(
            GitOps::get_worktree_branch(&wt_path).unwrap().as_deref(),
            Some("race-branch")
        );
    }
}
