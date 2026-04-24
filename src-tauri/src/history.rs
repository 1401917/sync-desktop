use rusqlite::{params, Connection};
use uuid::Uuid;

pub fn record_system_event(
    connection: &Connection,
    event_type: &str,
    title: &str,
    status: &str,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO history_events (
                id, event_type, title, summary, status, severity, created_at, metadata_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'info', CURRENT_TIMESTAMP, '{}')",
            params![Uuid::new_v4().to_string(), event_type, title, title, status],
        )
        .map_err(|error| format!("Unable to record history event: {error}"))?;

    Ok(())
}

#[allow(dead_code)]
pub fn record_audit_event(
    connection: &Connection,
    action: &str,
    target: &str,
    risk_level: &str,
    decision: &str,
    result: &str,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO audit_logs (
                id, action, actor, target, risk_level, decision, result, created_at, metadata_json
            ) VALUES (?1, ?2, 'system', ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP, '{}')",
            params![
                Uuid::new_v4().to_string(),
                action,
                target,
                risk_level,
                decision,
                result
            ],
        )
        .map_err(|error| format!("Unable to record audit event: {error}"))?;

    Ok(())
}
