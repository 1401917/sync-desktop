use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use walkdir::{DirEntry, WalkDir};

use crate::models::{FileScanItem, ProjectScan};
use crate::security;

const MAX_SCAN_ITEMS: usize = 800;
const SKIPPED_DIRECTORIES: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".vite",
];

pub fn scan_project_folder(root: String) -> Result<ProjectScan, String> {
    let root_path = PathBuf::from(root);
    let canonical_root = root_path
        .canonicalize()
        .map_err(|error| format!("Unable to open selected project folder: {error}"))?;

    if !canonical_root.is_dir() {
        return Err("Selected project path is not a folder".to_string());
    }

    let mut files_scanned = 0usize;
    let mut directories_scanned = 0usize;
    let mut sensitive_files = Vec::new();
    let mut languages = BTreeSet::new();
    let mut package_managers = BTreeSet::new();
    let mut skipped = Vec::new();

    for entry in WalkDir::new(&canonical_root)
        .follow_links(false)
        .into_iter()
        .filter_entry(should_enter)
        .filter_map(Result::ok)
        .take(MAX_SCAN_ITEMS)
    {
        if entry.file_type().is_dir() {
            directories_scanned += 1;
            continue;
        }

        files_scanned += 1;
        let path = entry.path();
        let metadata = entry.metadata().ok();
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        let relative_path = path
            .strip_prefix(&canonical_root)
            .unwrap_or(path)
            .display()
            .to_string();
        let sensitive = security::is_sensitive_path(path);
        let binary = is_likely_binary(path);

        if let Some(language) = language_for_extension(&extension) {
            languages.insert(language.to_string());
        }
        detect_package_manager(path).map(|manager| package_managers.insert(manager.to_string()));

        if sensitive {
            sensitive_files.push(FileScanItem {
                path: path.display().to_string(),
                relative_path,
                size: metadata.map(|value| value.len()).unwrap_or_default(),
                extension,
                sensitive,
                binary,
            });
        }
    }

    if files_scanned >= MAX_SCAN_ITEMS {
        skipped.push(format!(
            "Scan capped at {MAX_SCAN_ITEMS} entries to keep MVP indexing responsive"
        ));
    }

    Ok(ProjectScan {
        root: canonical_root.display().to_string(),
        files_scanned,
        directories_scanned,
        sensitive_files,
        languages: languages.into_iter().collect(),
        package_managers: package_managers.into_iter().collect(),
        skipped,
    })
}

fn should_enter(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return true;
    }

    let name = entry.file_name().to_string_lossy().to_lowercase();
    !SKIPPED_DIRECTORIES
        .iter()
        .any(|skipped| name == skipped.to_lowercase())
}

fn language_for_extension(extension: &str) -> Option<&'static str> {
    match extension.to_lowercase().as_str() {
        "ts" | "tsx" => Some("TypeScript"),
        "js" | "jsx" => Some("JavaScript"),
        "rs" => Some("Rust"),
        "py" => Some("Python"),
        "sql" => Some("SQL"),
        "json" => Some("JSON"),
        "toml" => Some("TOML"),
        "yaml" | "yml" => Some("YAML"),
        "css" => Some("CSS"),
        "html" => Some("HTML"),
        _ => None,
    }
}

fn detect_package_manager(path: &Path) -> Option<&'static str> {
    match path.file_name().and_then(|value| value.to_str()) {
        Some("package-lock.json") => Some("npm"),
        Some("pnpm-lock.yaml") => Some("pnpm"),
        Some("yarn.lock") => Some("yarn"),
        Some("bun.lockb") => Some("bun"),
        Some("Cargo.toml") => Some("cargo"),
        Some("pyproject.toml") => Some("python"),
        Some("requirements.txt") => Some("pip"),
        _ => None,
    }
}

fn is_likely_binary(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "ico" | "exe" | "dll" | "pdf" | "zip"
    )
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn scans_project_without_reading_secret_contents() {
        let directory = tempdir().expect("temp dir");
        fs::write(directory.path().join("package-lock.json"), "{}").expect("lockfile");
        fs::write(directory.path().join(".env"), "SECRET=should-not-be-read").expect("env");
        fs::create_dir_all(directory.path().join("src")).expect("src dir");
        fs::write(directory.path().join("src").join("main.tsx"), "export {};").expect("source");

        let scan = scan_project_folder(directory.path().display().to_string()).expect("scan");

        assert_eq!(scan.sensitive_files.len(), 1);
        assert!(scan.languages.contains(&"TypeScript".to_string()));
        assert!(scan.package_managers.contains(&"npm".to_string()));
    }
}
