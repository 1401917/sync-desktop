use reqwest::blocking::Client;
use serde::Deserialize;

use crate::models::{GitHubConnectionStatus, GitHubLoginResult, GitHubRepositorySummary};

#[derive(Debug, Deserialize)]
struct GitHubUser {
    login: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRepository {
    name: String,
    full_name: String,
    private: bool,
    html_url: String,
    default_branch: Option<String>,
}

pub fn connection_status() -> GitHubConnectionStatus {
    let Some(token) = github_token() else {
        return GitHubConnectionStatus {
            connected: false,
            status: "Requires authentication".to_string(),
            username: None,
            message: "Set GITHUB_TOKEN or GH_TOKEN before launching Sync to enable GitHub API access."
                .to_string(),
        };
    };

    match client()
        .get("https://api.github.com/user")
        .bearer_auth(token)
        .send()
    {
        Ok(response) if response.status().is_success() => match response.json::<GitHubUser>() {
            Ok(user) => GitHubConnectionStatus {
                connected: true,
                status: "Connected".to_string(),
                username: Some(user.login.clone()),
                message: format!("Connected as {}", user.login),
            },
            Err(error) => GitHubConnectionStatus {
                connected: false,
                status: "Error".to_string(),
                username: None,
                message: format!("GitHub user response could not be parsed: {error}"),
            },
        },
        Ok(response) => GitHubConnectionStatus {
            connected: false,
            status: "Error".to_string(),
            username: None,
            message: format!("GitHub rejected the token with HTTP {}", response.status()),
        },
        Err(error) => GitHubConnectionStatus {
            connected: false,
            status: "Error".to_string(),
            username: None,
            message: format!("GitHub connection failed: {error}"),
        },
    }
}

pub fn list_repositories(limit: u8) -> Result<Vec<GitHubRepositorySummary>, String> {
    let token = github_token().ok_or_else(|| {
        "GitHub is not authenticated. Set GITHUB_TOKEN or GH_TOKEN before launching Sync.".to_string()
    })?;
    let page_size = limit.clamp(1, 100);
    let url = format!(
        "https://api.github.com/user/repos?sort=updated&per_page={page_size}&affiliation=owner,collaborator,organization_member"
    );

    let response = client()
        .get(url)
        .bearer_auth(token)
        .send()
        .map_err(|error| format!("GitHub repository request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub repository request failed with HTTP {}",
            response.status()
        ));
    }

    let repositories = response
        .json::<Vec<GitHubRepository>>()
        .map_err(|error| format!("GitHub repository response could not be parsed: {error}"))?;

    Ok(repositories
        .into_iter()
        .map(|repository| GitHubRepositorySummary {
            name: repository.name,
            full_name: repository.full_name,
            private: repository.private,
            html_url: repository.html_url,
            default_branch: repository
                .default_branch
                .unwrap_or_else(|| "main".to_string()),
        })
        .collect())
}

pub fn start_cli_login() -> GitHubLoginResult {
    if github_cli_available().is_err() {
        return GitHubLoginResult {
            started: false,
            status: "GitHub CLI missing".to_string(),
            message: "Install GitHub CLI, then use Login with GitHub again.".to_string(),
        };
    }

    match std::process::Command::new("gh")
        .args([
            "auth",
            "login",
            "--hostname",
            "github.com",
            "--web",
            "--git-protocol",
            "https",
        ])
        .spawn()
    {
        Ok(_) => GitHubLoginResult {
            started: true,
            status: "Login started".to_string(),
            message: "GitHub CLI opened the browser login flow. Complete it, then refresh Sync."
                .to_string(),
        },
        Err(error) => GitHubLoginResult {
            started: false,
            status: "Login failed".to_string(),
            message: format!("Could not start GitHub CLI login: {error}"),
        },
    }
}

fn github_token() -> Option<String> {
    std::env::var("GITHUB_TOKEN")
        .ok()
        .filter(|token| !token.trim().is_empty())
        .or_else(|| {
            std::env::var("GH_TOKEN")
                .ok()
                .filter(|token| !token.trim().is_empty())
        })
}

fn client() -> Client {
    Client::builder()
        .user_agent("Sync-Desktop-MVP")
        .build()
        .expect("GitHub HTTP client")
}

fn github_cli_available() -> Result<(), String> {
    let output = std::process::Command::new("gh")
        .arg("--version")
        .output()
        .map_err(|error| format!("GitHub CLI is not available: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
