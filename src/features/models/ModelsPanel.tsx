import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { saveProviderKeyMetadata } from "../../lib/backend";
import type { BootstrapPayload, ModelProviderSummary } from "../../types/domain";

interface ModelsPanelProps {
  payload: BootstrapPayload;
  onProviderUpdated: (provider: ModelProviderSummary) => void;
}

export function ModelsPanel({ payload, onProviderUpdated }: ModelsPanelProps) {
  const [activeProviderId, setActiveProviderId] = useState(
    payload.modelProviders[0]?.id ?? "openai"
  );
  const [keyInput, setKeyInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const activeProvider =
    payload.modelProviders.find((provider) => provider.id === activeProviderId) ??
    payload.modelProviders[0];

  async function saveKey() {
    if (!activeProvider || !keyInput.trim()) {
      setMessage("Enter a provider key or token first.");
      return;
    }

    try {
      const result = await saveProviderKeyMetadata(activeProvider.id, keyInput);
      onProviderUpdated(result.provider);
      setKeyInput("");
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 bg-[#171717]">
      <aside className="w-[280px] shrink-0 border-r border-[#292929] bg-[#1b1b1b] p-3">
        <h1 className="mb-3 text-[13px] font-medium text-[#eeeeee]">API Keys / Models</h1>
        <div className="space-y-1">
          {payload.modelProviders.map((provider) => (
            <button
              key={provider.id}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                provider.id === activeProviderId
                  ? "bg-[#2a2a2a] text-[#f0f0f0]"
                  : "text-[#a9a9a9] hover:bg-[#242424]"
              }`}
              onClick={() => setActiveProviderId(provider.id)}
            >
              <span className="text-[12px]">{provider.name}</span>
              {provider.configured ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#7fc28a]" title="Configured" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a3a3a]" title="Not configured" />
              )}
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        {activeProvider ? (
          <section className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#343434] bg-[#222]">
                <KeyRound size={16} />
              </div>
              <div>
                <h2 className="text-[17px] font-medium text-[#eeeeee]">{activeProvider.name}</h2>
                <p className="mt-1 text-[11px] text-[#8d8d8d]">
                  {activeProvider.providerType} · {activeProvider.baseUrl || "User-configured URL"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Info
                label="Status"
                value={activeProvider.connectionStatus}
                tone={activeProvider.connectionStatus === "Connected" ? "ok" : "muted"}
              />
              <Info
                label="Configured"
                value={activeProvider.configured ? "Yes" : "No"}
                tone={activeProvider.configured ? "ok" : "muted"}
              />
              <Info
                label="Masked key"
                value={activeProvider.maskedKeyPreview ?? "None"}
              />
            </div>

            <div className="mt-5 rounded-xl border border-[#303030] bg-[#202020] p-4">
              <label className="text-[11px] font-medium text-[#d8d8d8]">Provider key/token</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value)}
                  type="password"
                  placeholder="Paste API key and press Save"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#343434] bg-[#1b1b1b] px-3 text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#666]"
                />
                <button className="integration-primary mb-0" onClick={saveKey}>
                  <Save size={13} />
                  Save
                </button>
              </div>
              <p className="mt-2 text-[10.5px] leading-5 text-[#777]">
                The key is saved to your per-user app-data folder. Only a masked preview is kept
                in the database. Sync marks the provider configured; connection status is updated
                only after a real provider call/test succeeds.
              </p>
            </div>

            {message ? (
              <div className="mt-3 rounded-lg border border-[#303030] bg-[#202020] px-3 py-2 text-[11px] text-[#9a9a9a]">
                {message}
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-[#303030] bg-[#202020] p-4">
              <h3 className="text-[12px] font-medium text-[#eeeeee]">Model profiles</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {payload.modelProfiles
                  .filter((profile) => profile.providerId === activeProvider.id)
                  .map((profile) => (
                    <div key={profile.id} className="rounded-lg border border-[#303030] bg-[#1b1b1b] p-3">
                      <div className="text-[11px] font-medium text-[#e8e8e8]">{profile.name}</div>
                      <div className="mt-1 text-[10px] text-[#777]">
                        {profile.role} · {profile.modelId}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Info({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "ok" | "muted";
}) {
  const valueClass =
    tone === "ok"
      ? "text-[#7fc28a]"
      : tone === "muted"
      ? "text-[#9a9a9a]"
      : "text-[#e8e8e8]";
  return (
    <div className="rounded-lg border border-[#303030] bg-[#202020] p-3">
      <div className="text-[10px] text-[#777]">{label}</div>
      <div className={`mt-1 truncate text-[12px] font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}
