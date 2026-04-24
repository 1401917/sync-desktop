use serde::{Deserialize, Serialize};

use crate::models::ActionClassification;
use crate::security;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRequest {
    pub tool_name: String,
    pub category: String,
    pub target: String,
}

#[allow(dead_code)]
pub fn classify_tool_request(request: &ToolRequest) -> ActionClassification {
    security::classify_action(&request.tool_name, &request.target, &request.category)
}
