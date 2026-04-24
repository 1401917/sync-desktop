import { useState } from "react";
import { Network, Play } from "lucide-react";
import { testMcpConnection } from "../../lib/integrations";
import type { BootstrapPayload, McpConnectionTest } from "../../types/domain";

interface McpPanelProps {
  payload: BootstrapPayload;
}

export function McpPanel({ payload }: McpPanelProps) {
  const [target, setTarget] = useState("node");
  const [result, setResult] = useState<McpConnectionTest | null>(null);
  const [loading, setLoading] = useState(false);

  async function testConnection() {
    setLoading(true);
    setResult(await testMcpConnection(target));
    setLoading(false);
  }

  return (
    <div className="integration-panel">
      <div className="integration-heading">
        <div className="integration-icon">
          <Network size={16} />
        </div>
        <div>
          <h1>MCP Servers</h1>
          <p>Validate a command or endpoint before enabling it for agent tool calls.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="integration-input"
          placeholder="node, npx server-name, or https://server"
        />
        <button className="integration-primary" onClick={testConnection} disabled={loading}>
          <Play size={13} />
          {loading ? "Testing..." : "Test"}
        </button>
      </div>

      {result ? (
        <div className="integration-card">
          <span>{result.target}</span>
          <strong>{result.status}</strong>
          <p>{result.message}</p>
        </div>
      ) : null}

      <div className="integration-list">
        {payload.mcpServers.map((server) => (
          <div key={server.id} className="integration-row">
            <div>
              <strong>{server.name}</strong>
              <span>
                {server.status} · {server.trust} · {server.tools} tools
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
