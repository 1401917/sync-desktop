pub const DEFAULT_APPROVAL_MODE: &str = "Balanced Mode";
pub const DEFAULT_RESPONSE_STYLE: &str = "balanced";
pub const DEFAULT_TASK_GENERATION: &str = "automatic";

pub fn protected_setting_keys() -> &'static [&'static str] {
    &[
        "permission_file_write",
        "permission_command_run",
        "permission_github_push",
        "permission_secret_access",
    ]
}
