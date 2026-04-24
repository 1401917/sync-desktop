use std::path::{Path, PathBuf};

use regex::Regex;

use crate::models::ActionClassification;

const SENSITIVE_FILE_NAMES: &[&str] = &[
    ".env",
    ".env.local",
    ".env.production",
    "credentials.json",
    "secrets.json",
    "id_rsa",
    "id_ed25519",
    "token.json",
    "service-account.json",
];

const SENSITIVE_EXTENSIONS: &[&str] = &["pem", "key", "p12", "pfx", "crt"];

pub fn classify_action(action: &str, target: &str, tool: &str) -> ActionClassification {
    let risk = if action == "run_command" {
        classify_command(target)
    } else if is_sensitive_path(Path::new(target)) {
        "High".to_string()
    } else {
        "Low".to_string()
    };

    let approval_required = !matches!(risk.as_str(), "Safe" | "Low");

    ActionClassification {
        action: action.to_string(),
        risk: risk.clone(),
        target: target.to_string(),
        agent: "Security Agent".to_string(),
        task: "Permission gate".to_string(),
        required_tool: tool.to_string(),
        required_permission: permission_for_risk(&risk).to_string(),
        reason: reason_for_risk(&risk).to_string(),
        potential_impact: impact_for_risk(&risk).to_string(),
        sensitive_data_involved: contains_secret_like_value(target) || is_sensitive_path(Path::new(target)),
        approval_required,
        rollback_available: action != "run_command",
        recommended_decision: if approval_required {
            "Ask the user before continuing".to_string()
        } else {
            "Allow under current project scope".to_string()
        },
    }
}

pub fn classify_command(command: &str) -> String {
    let lower = command.to_lowercase();
    let normalized = lower.split_whitespace().collect::<Vec<_>>().join(" ");

    let critical_patterns = [
        "format ",
        "delete repository",
        "git push --force",
        "git push -f",
        "git reset --hard",
        "git clean -fd",
        "drop table",
        "set-executionpolicy",
    ];
    if critical_patterns
        .iter()
        .any(|pattern| normalized.contains(pattern))
    {
        return "Critical".to_string();
    }

    let high_patterns = [
        "remove-item -recurse -force",
        "rm -rf",
        "rmdir /s",
        "del /f",
        "invoke-expression",
        "iex ",
        "-encodedcommand",
        "curl ",
        "wget ",
        "invoke-webrequest",
        "git push",
        "git rebase",
        "git remote set-url",
    ];
    if high_patterns.iter().any(|pattern| normalized.contains(pattern)) {
        return "High".to_string();
    }

    let medium_patterns = [
        "npm install",
        "pnpm install",
        "yarn add",
        "cargo build",
        "cargo test",
        "npm run build",
        "npm test",
        "git add",
        "git commit",
        "git pull",
        "git merge",
    ];
    if medium_patterns
        .iter()
        .any(|pattern| normalized.contains(pattern))
    {
        return "Medium".to_string();
    }

    let safe_patterns = [
        "git status",
        "git diff",
        "git log",
        "node -v",
        "npm -v",
        "python --version",
        "cargo --version",
        "rustc --version",
    ];
    if safe_patterns.iter().any(|pattern| normalized == *pattern) {
        return "Safe".to_string();
    }

    "Low".to_string()
}

pub fn is_sensitive_path(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();

    SENSITIVE_FILE_NAMES
        .iter()
        .any(|sensitive_name| file_name == *sensitive_name)
        || SENSITIVE_EXTENSIONS
            .iter()
            .any(|sensitive_extension| extension == *sensitive_extension)
        || file_name.contains("secret")
        || file_name.contains("credential")
        || file_name.contains("token")
        || file_name.contains("private")
}

pub fn ensure_within_root(root: &Path, target: &Path) -> Result<PathBuf, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Unable to resolve root path: {error}"))?;
    let canonical_target = canonicalize_target(target)?;

    if !canonical_target.starts_with(&canonical_root) {
        return Err("Target path escapes the allowed project folder".to_string());
    }

    Ok(canonical_target)
}

fn canonicalize_target(target: &Path) -> Result<PathBuf, String> {
    if target.exists() {
        return target
            .canonicalize()
            .map_err(|error| format!("Unable to resolve target path: {error}"));
    }

    let parent = target
        .parent()
        .ok_or_else(|| "Target path has no parent directory".to_string())?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("Unable to resolve target parent path: {error}"))?;
    let file_name = target
        .file_name()
        .ok_or_else(|| "Target path has no file name".to_string())?;

    Ok(canonical_parent.join(file_name))
}

pub fn mask_secrets(input: &str) -> String {
    let patterns = [
        r"(?i)(sk-[a-z0-9_\-]{8,})",
        r"(?i)(ghp_[a-z0-9_]{8,})",
        r"(?i)(github_pat_[a-z0-9_]{8,})",
        r"(?i)(xox[baprs]-[a-z0-9\-]{8,})",
        r"(?i)(bearer\s+)([a-z0-9._\-]{12,})",
        r"(?i)(password\s*=\s*)([^\s]+)",
        r"(?i)(api[_-]?key\s*=\s*)([^\s]+)",
    ];

    patterns.iter().fold(input.to_string(), |masked, pattern| {
        let regex = Regex::new(pattern).expect("valid secret regex");
        regex
            .replace_all(&masked, |captures: &regex::Captures<'_>| {
                if captures.len() > 2 {
                    format!("{}{}", &captures[1], mask_value(&captures[2]))
                } else {
                    mask_value(&captures[1])
                }
            })
            .to_string()
    })
}

pub fn contains_secret_like_value(input: &str) -> bool {
    let lower = input.to_lowercase();
    lower.contains("sk-")
        || lower.contains("ghp_")
        || lower.contains("github_pat_")
        || lower.contains("bearer ")
        || lower.contains("api_key")
        || lower.contains("password=")
}

fn mask_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() <= 8 {
        return "****".to_string();
    }

    let prefix = &trimmed[..trimmed.char_indices().nth(4).map_or(4, |(index, _)| index)];
    let suffix_start = trimmed
        .char_indices()
        .rev()
        .nth(3)
        .map_or(trimmed.len().saturating_sub(4), |(index, _)| index);
    let suffix = &trimmed[suffix_start..];
    format!("{prefix}****{suffix}")
}

fn permission_for_risk(risk: &str) -> &'static str {
    match risk {
        "Safe" => "Allow for this project",
        "Low" => "Allow for this project",
        "Medium" => "Ask every time",
        "High" => "Ask every time",
        "Critical" => "Typed confirmation",
        _ => "Ask every time",
    }
}

fn reason_for_risk(risk: &str) -> &'static str {
    match risk {
        "Safe" => "Read-only project-scoped action",
        "Low" => "Low-risk project action under current scope",
        "Medium" => "May modify project state or run build tooling",
        "High" => "Can modify files, history, external state, or expose data",
        "Critical" => "Potentially destructive or irreversible action",
        _ => "Unknown action risk",
    }
}

fn impact_for_risk(risk: &str) -> &'static str {
    match risk {
        "Safe" => "No expected mutation",
        "Low" => "Limited local metadata or planning impact",
        "Medium" => "May change project files or dependencies after approval",
        "High" => "May affect local files, Git history, services, or secrets",
        "Critical" => "Can destroy data, expose secrets, or alter public state",
        _ => "Impact requires review",
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn classifies_dangerous_commands() {
        assert_eq!(classify_command("git status"), "Safe");
        assert_eq!(classify_command("npm install"), "Medium");
        assert_eq!(classify_command("git push origin main"), "High");
        assert_eq!(classify_command("git reset --hard HEAD"), "Critical");
    }

    #[test]
    fn detects_sensitive_paths() {
        assert!(is_sensitive_path(Path::new(".env")));
        assert!(is_sensitive_path(Path::new("credentials.json")));
        assert!(is_sensitive_path(Path::new("private.pem")));
        assert!(!is_sensitive_path(Path::new("src/main.tsx")));
    }

    #[test]
    fn masks_secret_like_values() {
        let masked = mask_secrets("OPENAI_API_KEY=sk-1234567890abcdef");
        assert!(masked.contains("sk-1"));
        assert!(masked.contains("cdef"));
        assert!(!masked.contains("1234567890abcdef"));
    }

    #[test]
    fn blocks_path_escape() {
        let directory = tempdir().expect("temp dir");
        let root = directory.path().join("project");
        let outside = directory.path().join("outside.txt");
        fs::create_dir_all(&root).expect("project dir");
        fs::write(&outside, "nope").expect("outside file");

        let result = ensure_within_root(&root, &outside);
        assert!(result.is_err());
    }
}
