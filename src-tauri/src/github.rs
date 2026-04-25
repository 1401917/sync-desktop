use std::path::PathBuf;
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use reqwest::blocking::Client;
use serde::Deserialize;

use crate::models::{GitHubConnectionStatus, GitHubLoginResult, GitHubRepositorySummary};

const DEFAULT_GITHUB_CLIENT_ID: &str = "Ov23liTaKFcH2h6cAMXV";

fn token_path() -> PathBuf {
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join("Sync").join("github_token")
}

fn stored_token() -> Option<String> {
    std::fs::read_to_string(token_path())
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn save_token(token: &str) -> Result<(), String> {
    let path = token_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create token dir: {e}"))?;
    }
    std::fs::write(&path, token).map_err(|e| format!("Failed to save token: {e}"))
}

fn github_client_id() -> String {
    std::env::var("SYNC_GITHUB_CLIENT_ID")
        .ok()
        .filter(|client_id| !client_id.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_GITHUB_CLIENT_ID.to_string())
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: Option<u64>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

fn request_device_code(client_id: &str) -> Result<DeviceCodeResponse, String> {
    let response = client()
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", client_id), ("scope", "repo user")])
        .send()
        .map_err(|error| format!("GitHub device-code request failed: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("GitHub device-code response read failed: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "GitHub rejected the device-code request (HTTP {}): {}. \
             Set SYNC_GITHUB_CLIENT_ID to a valid GitHub OAuth App client ID \
             with Device Flow enabled.",
            status.as_u16(),
            truncate(&body, 240)
        ));
    }

    // GitHub's form-encoded error responses come back as `error=...&...` even
    // when we asked for JSON. Detect those and surface them clearly.
    let trimmed = body.trim_start();
    if !trimmed.starts_with('{') {
        if let Some(error_message) = parse_form_error(&body) {
            return Err(format!(
                "GitHub device-code request was rejected: {error_message}. \
                 Set SYNC_GITHUB_CLIENT_ID to a valid GitHub OAuth App client ID."
            ));
        }
        return Err(format!(
            "GitHub device-code response was not JSON: {}",
            truncate(&body, 240)
        ));
    }

    serde_json::from_str::<DeviceCodeResponse>(&body)
        .map_err(|error| format!("GitHub device-code response could not be parsed: {error}"))
}

fn parse_form_error(body: &str) -> Option<String> {
    let mut error_kind: Option<String> = None;
    let mut description: Option<String> = None;
    for pair in body.split('&') {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next()?.trim();
        let value = parts.next().unwrap_or("").trim();
        let decoded = urldecode(value);
        match key {
            "error" => error_kind = Some(decoded),
            "error_description" => description = Some(decoded),
            _ => {}
        }
    }
    match (error_kind, description) {
        (Some(kind), Some(desc)) => Some(format!("{kind} — {desc}")),
        (Some(kind), None) => Some(kind),
        (None, Some(desc)) => Some(desc),
        _ => None,
    }
}

fn urldecode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let byte = bytes[i];
        if byte == b'+' {
            out.push(' ');
            i += 1;
        } else if byte == b'%' && i + 2 < bytes.len() {
            if let Ok(code) =
                u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16)
            {
                out.push(code as char);
                i += 3;
                continue;
            }
            out.push(byte as char);
            i += 1;
        } else {
            out.push(byte as char);
            i += 1;
        }
    }
    out
}

fn truncate(value: &str, max: usize) -> String {
    if value.len() <= max {
        value.to_string()
    } else {
        format!("{}…", &value[..max])
    }
}

pub fn start_oauth() -> GitHubLoginResult {
    let client_id = github_client_id();
    let device = match request_device_code(&client_id) {
        Ok(device) => device,
        Err(error) => {
            return GitHubLoginResult {
                started: false,
                status: "Error".to_string(),
                message: error,
            };
        }
    };

    let verification_uri = device.verification_uri.clone();
    let user_code = device.user_code.clone();
    let device_code = device.device_code.clone();
    let expires_in = device.expires_in;
    let mut interval = device.interval.unwrap_or(5).max(1);

    thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(expires_in);

        while Instant::now() < deadline {
            thread::sleep(Duration::from_secs(interval));

            let response = client()
                .post("https://github.com/login/oauth/access_token")
                .header("Accept", "application/json")
                .form(&[
                    ("client_id", client_id.as_str()),
                    ("device_code", device_code.as_str()),
                    ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ])
                .send()
                .and_then(|response| response.json::<TokenResponse>());

            let Ok(response) = response else {
                continue;
            };

            if let Some(token) = response.access_token {
                let _ = save_token(&token);
                break;
            }

            match response.error.as_deref() {
                Some("authorization_pending") => {}
                Some("slow_down") => interval += 5,
                Some("expired_token") | Some("access_denied") => break,
                Some(_) => {
                    let _ = response.error_description;
                    break;
                }
                None => {}
            }
        }
    });

    GitHubLoginResult {
        started: true,
        status: verification_uri,
        message: format!(
            "Enter code {user_code} on GitHub. Sync will detect the authorization automatically."
        ),
    }
}

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
            message: "Login with GitHub CLI or set GITHUB_TOKEN/GH_TOKEN before launching Sync."
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
        "GitHub is not authenticated. Login with GitHub CLI or set GITHUB_TOKEN/GH_TOKEN."
            .to_string()
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

    match Command::new("gh")
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
    stored_token()
        .or_else(|| {
            std::env::var("GITHUB_TOKEN")
                .ok()
                .filter(|token| !token.trim().is_empty())
        })
        .or_else(|| {
            std::env::var("GH_TOKEN")
                .ok()
                .filter(|token| !token.trim().is_empty())
        })
        .or_else(github_cli_token)
}

fn client() -> Client {
    Client::builder()
        .user_agent("Sync-Desktop-MVP")
        .build()
        .expect("GitHub HTTP client")
}

fn github_cli_available() -> Result<(), String> {
    let output = hidden_command_output("gh", &["--version"])
        .map_err(|error| format!("GitHub CLI is not available: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn github_cli_token() -> Option<String> {
    let output = hidden_command_output("gh", &["auth", "token"]).ok()?;

    if !output.status.success() {
        return None;
    }

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

fn hidden_command_output(program: &str, args: &[&str]) -> std::io::Result<Output> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    command.output()
}
