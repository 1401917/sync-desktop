import { Boxes } from "lucide-react";
import type { BootstrapPayload } from "../../types/domain";

interface ConnectorsPanelProps {
  payload: BootstrapPayload;
}

export function ConnectorsPanel({ payload }: ConnectorsPanelProps) {
  return (
    <div className="integration-panel">
      <div className="integration-heading">
        <div className="integration-icon">
          <Boxes size={16} />
        </div>
        <div>
          <h1>Connectors</h1>
          <p>External services are visible here with their current status and permission level.</p>
        </div>
      </div>

      <div className="integration-list">
        {payload.connectors.map((connector) => (
          <div key={connector.id} className="integration-row">
            <div>
              <strong>{connector.name}</strong>
              <span>
                {connector.status} · {connector.permission}
              </span>
            </div>
            <span className="integration-pill">{connector.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
