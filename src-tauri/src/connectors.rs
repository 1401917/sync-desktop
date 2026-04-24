use crate::models::ConnectorSummary;

pub fn default_connectors() -> Vec<ConnectorSummary> {
    vec![
        ConnectorSummary {
            id: "github".to_string(),
            name: "GitHub".to_string(),
            status: "Not connected".to_string(),
            permission: "Ask every time".to_string(),
        },
        ConnectorSummary {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            status: "Requires authentication".to_string(),
            permission: "Provider only".to_string(),
        },
    ]
}
