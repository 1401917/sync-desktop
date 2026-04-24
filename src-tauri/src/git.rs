use std::process::Command;

use crate::security;

pub fn status(root: String) -> Result<String, String> {
    let risk = security::classify_command("git status");
    if risk != "Safe" {
        return Err("git status unexpectedly classified as unsafe".to_string());
    }

    let output = Command::new("git")
        .arg("status")
        .arg("--short")
        .current_dir(root)
        .output()
        .map_err(|error| format!("Unable to run git status: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
