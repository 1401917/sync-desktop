#[allow(dead_code)]
pub const DEFAULT_APPROVAL_MODE: &str = "Balanced Mode";
#[allow(dead_code)]
pub const DEFAULT_RESPONSE_STYLE: &str = "balanced";
#[allow(dead_code)]
pub const DEFAULT_TASK_GENERATION: &str = "automatic";

#[allow(dead_code)]
pub fn protected_setting_keys() -> &'static [&'static str] {
    &[
        "permission_file_write",
        "permission_command_run",
        "permission_github_push",
        "permission_secret_access",
    ]
}
