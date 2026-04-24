use crate::models::McpServerSummary;
use crate::models::McpConnectionTest;

pub fn default_servers() -> Vec<McpServerSummary> {
    vec![McpServerSummary {
        id: "documentation".to_string(),
        name: "Documentation Lookup".to_string(),
        status: "Not configured".to_string(),
        trust: "limited".to_string(),
        tools: 0,
    }]
}

pub fn test_connection(target: String) -> McpConnectionTest {
    let trimmed = target.trim().to_string();
    if trimmed.is_empty() {
        return McpConnectionTest {
            target,
            reachable: false,
            status: "Missing target".to_string(),
            message: "Enter an MCP command or HTTP endpoint to test.".to_string(),
        };
    }

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return test_http_endpoint(trimmed);
    }

    test_command(trimmed)
}

fn test_http_endpoint(target: String) -> McpConnectionTest {
    match reqwest::blocking::Client::builder()
        .user_agent("Sync-Desktop-MVP")
        .build()
        .and_then(|client| client.get(&target).send())
    {
        Ok(response) => McpConnectionTest {
            target,
            reachable: response.status().is_success(),
            status: format!("HTTP {}", response.status()),
            message: "Endpoint responded to a read-only status probe.".to_string(),
        },
        Err(error) => McpConnectionTest {
            target,
            reachable: false,
            status: "Error".to_string(),
            message: format!("Endpoint probe failed: {error}"),
        },
    }
}

fn test_command(target: String) -> McpConnectionTest {
    let executable = target
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .trim_matches('"')
        .to_string();

    let output = if cfg!(windows) {
        std::process::Command::new("where.exe").arg(&executable).output()
    } else {
        std::process::Command::new("which").arg(&executable).output()
    };

    match output {
        Ok(result) if result.status.success() => McpConnectionTest {
            target,
            reachable: true,
            status: "Command found".to_string(),
            message: String::from_utf8_lossy(&result.stdout).trim().to_string(),
        },
        Ok(result) => McpConnectionTest {
            target,
            reachable: false,
            status: "Command not found".to_string(),
            message: String::from_utf8_lossy(&result.stderr).trim().to_string(),
        },
        Err(error) => McpConnectionTest {
            target,
            reachable: false,
            status: "Error".to_string(),
            message: format!("Command probe failed: {error}"),
        },
    }
}
