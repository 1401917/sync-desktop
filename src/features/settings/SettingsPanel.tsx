import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import type { BootstrapPayload } from "../../types/domain";

type Category =
  | "commonly-used"
  | "general"
  | "github"
  | "security"
  | "ai-models"
  | "mcp"
  | "about";

interface NavItem {
  id: Category;
  label: string;
  children?: { id: Category; label: string }[];
}

const NAV: NavItem[] = [
  { id: "commonly-used", label: "Commonly Used" },
  {
    id: "general",
    label: "General",
    children: [
      { id: "github",    label: "GitHub" },
      { id: "security",  label: "Security" },
      { id: "ai-models", label: "AI Models" },
      { id: "mcp",       label: "MCP" },
    ],
  },
  { id: "about", label: "About" },
];

interface SettingsPanelProps {
  payload: BootstrapPayload;
}

export function SettingsPanel({ payload }: SettingsPanelProps) {
  const [active, setActive]         = useState<Category>("commonly-used");
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({ general: true });
  const [search, setSearch]         = useState("");

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#1e1e1e]">
      {/* Search bar */}
      <div className="border-b border-[#252525] px-4 py-2">
        <div className="flex items-center gap-2 rounded border border-[#3c3c3c] bg-[#3c3c3c] px-3 py-1.5">
          <Search size={13} className="shrink-0 text-[#858585]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings"
            className="flex-1 bg-transparent text-[12px] text-[#cccccc] placeholder:text-[#858585] outline-none"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-[#252525] bg-[#1e1e1e] py-2">
          {NAV.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.children) toggle(item.id);
                  else setActive(item.id);
                }}
                className={cn(
                  "flex w-full items-center gap-1 px-4 py-[5px] text-left text-[12px] transition-colors",
                  active === item.id && !item.children
                    ? "bg-[#04395e] text-[#ffffff]"
                    : "text-[#cccccc] hover:bg-[#2a2d2e]"
                )}
              >
                {item.children && (
                  <ChevronRight
                    size={12}
                    className={cn(
                      "shrink-0 transition-transform text-[#858585]",
                      expanded[item.id] && "rotate-90"
                    )}
                  />
                )}
                {!item.children && <span className="w-3" />}
                <span className={cn(active === item.id && !item.children ? "font-semibold" : "")}>
                  {item.label}
                </span>
              </button>

              {item.children && expanded[item.id] && (
                <div>
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setActive(child.id)}
                      className={cn(
                        "flex w-full items-center pl-9 pr-4 py-[5px] text-left text-[12px] transition-colors",
                        active === child.id
                          ? "bg-[#04395e] text-white font-semibold"
                          : "text-[#cccccc] hover:bg-[#2a2d2e]"
                      )}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 pb-[126px]">
          {active === "commonly-used" && <CommonlyUsed payload={payload} />}
          {active === "github"        && <GitHubSettings />}
          {active === "security"      && <SecuritySettings payload={payload} />}
          {active === "ai-models"     && <AISettings />}
          {active === "mcp"           && <McpSettings payload={payload} />}
          {active === "about"         && <AboutSettings payload={payload} />}
          {active === "general"       && <CommonlyUsed payload={payload} />}
        </div>
      </div>
    </div>
  );
}

/* Setting building blocks */

function SettingTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 text-[20px] font-normal text-[#cccccc]">{children}</h2>;
}

function SettingItem({
  group,
  name,
  description,
  children,
}: {
  group?: string;
  name: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-1 text-[12px] text-[#cccccc]">
        {group && <span className="text-[#cccccc]">{group}: </span>}
        <span className="font-semibold">{name}</span>
      </div>
      {description && (
        <p className="mb-2 text-[12px] leading-5 text-[#9d9d9d]">{description}</p>
      )}
      {children}
    </div>
  );
}

function VsSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
  return (
    <div className="relative w-[320px]">
      <select
        defaultValue={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full appearance-none rounded border border-[#3c3c3c] bg-[#3c3c3c] px-3 py-1.5 text-[12px] text-[#cccccc] outline-none focus:border-[#0078d4] cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronRight size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#858585]" />
    </div>
  );
}

function VsInput({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      className="w-[320px] rounded border border-[#3c3c3c] bg-[#3c3c3c] px-3 py-1.5 text-[12px] text-[#cccccc] outline-none focus:border-[#0078d4]"
    />
  );
}

function VsCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange?: (v: boolean) => void;
}) {
  const [val, setVal] = useState(checked);
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={val}
        onChange={(e) => { setVal(e.target.checked); onChange?.(e.target.checked); }}
        className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-[#0078d4]"
      />
      <span className="text-[12px] leading-5 text-[#cccccc]">{label}</span>
    </label>
  );
}

/* Screens */

function CommonlyUsed({ payload }: { payload: BootstrapPayload }) {
  return (
    <div>
      <SettingTitle>Commonly Used</SettingTitle>

      <SettingItem group="Sync" name="Approval Mode" description="Controls how Sync handles sensitive file, command, and GitHub operations.">
        <VsSelect value={payload.securityMode} options={["Balanced Mode", "Strict Mode", "Auto Mode"]} />
      </SettingItem>

      <SettingItem group="Files" name="Auto Save" description="Controls auto save of files that have unsaved changes.">
        <VsSelect value="afterDelay" options={["off", "afterDelay", "onFocusChange", "onWindowChange"]} />
      </SettingItem>

      <SettingItem group="AI" name="Default Model" description="The Claude model used for AI operations by default.">
        <VsSelect value="claude-sonnet-4-6" options={["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"]} />
      </SettingItem>

      <SettingItem group="GitHub" name="Default Protocol" description="The protocol used when cloning repositories.">
        <VsSelect value="HTTPS" options={["HTTPS", "SSH"]} />
      </SettingItem>

      <SettingItem group="Sync" name="Telemetry" description="Send anonymous usage data to improve Sync.">
        <VsCheckbox checked={false} label="Enable usage telemetry" />
      </SettingItem>

      <SettingItem group="Sync" name="Notifications" description="Show system notifications for completed tasks and approvals.">
        <VsCheckbox checked={true} label="Enable desktop notifications" />
      </SettingItem>
    </div>
  );
}

function GitHubSettings() {
  return (
    <div>
      <SettingTitle>GitHub</SettingTitle>

      <SettingItem group="GitHub" name="Default Protocol" description="The protocol used when cloning or pushing repositories.">
        <VsSelect value="HTTPS" options={["HTTPS", "SSH"]} />
      </SettingItem>

      <SettingItem group="GitHub" name="Default Branch" description="The default branch name when creating new repositories.">
        <VsInput value="main" />
      </SettingItem>

      <SettingItem group="GitHub" name="Auto-fetch" description="Automatically refresh the repository list on startup.">
        <VsCheckbox checked={true} label="Fetch repositories on startup" />
      </SettingItem>

      <SettingItem group="GitHub" name="Write Operations" description="How Sync handles GitHub write operations such as push, PR, and issue creation.">
        <VsSelect value="Ask every time" options={["Ask every time", "Allow for this session", "Always allow"]} />
      </SettingItem>

      <SettingItem group="GitHub" name="Destructive Operations" description="How Sync handles destructive GitHub operations such as branch deletion.">
        <VsSelect value="Typed confirmation" options={["Typed confirmation", "Ask every time", "Disabled"]} />
      </SettingItem>
    </div>
  );
}

function SecuritySettings({ payload }: { payload: BootstrapPayload }) {
  return (
    <div>
      <SettingTitle>Security</SettingTitle>

      <SettingItem group="Security" name="Approval Mode" description="Controls the default approval level for sensitive operations.">
        <VsSelect value={payload.securityMode} options={["Balanced Mode", "Strict Mode", "Auto Mode"]} />
      </SettingItem>

      <SettingItem group="Security" name="File Writes" description="Require approval before Sync writes or modifies files.">
        <VsSelect value="Ask every time" options={["Ask every time", "Allow for this session", "Allow for this project", "Always allow"]} />
      </SettingItem>

      <SettingItem group="Security" name="Command Execution" description="Require approval before Sync runs terminal commands.">
        <VsSelect value="Ask every time" options={["Ask every time", "Allow for this session", "Always allow"]} />
      </SettingItem>

      <SettingItem group="Security" name="Secret Detection" description="Automatically detect and mask secrets in prompts and logs.">
        <VsCheckbox checked={true} label="Enable secret detection" />
      </SettingItem>

      <SettingItem group="Security" name="Path Traversal Protection" description="Prevent AI operations from accessing files outside the project root.">
        <VsCheckbox checked={true} label="Enable path traversal protection" />
      </SettingItem>
    </div>
  );
}

function AISettings() {
  return (
    <div>
      <SettingTitle>AI Models</SettingTitle>

      <SettingItem group="AI" name="Default Model" description="The Claude model used for all AI operations by default.">
        <VsSelect value="claude-sonnet-4-6" options={["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"]} />
      </SettingItem>

      <SettingItem group="AI" name="Max Tokens" description="Maximum number of tokens per AI request.">
        <VsSelect value="8192" options={["2048", "4096", "8192", "16384", "32768"]} />
      </SettingItem>

      <SettingItem group="AI" name="Prompt Caching" description="Cache prompts to reduce latency and API cost on repeated requests.">
        <VsCheckbox checked={true} label="Enable prompt caching" />
      </SettingItem>

      <SettingItem group="AI" name="Response Streaming" description="Stream AI responses as they arrive instead of waiting for the full response.">
        <VsCheckbox checked={true} label="Enable response streaming" />
      </SettingItem>

      <SettingItem group="AI" name="API Key Storage" description="API keys are stored in the local credential store and never appear in logs or prompts.">
        <div className="rounded border border-[#3c3c3c] bg-[#252526] px-3 py-2 text-[12px] text-[#858585]">
          Keys are stored securely — not configurable here.
        </div>
      </SettingItem>
    </div>
  );
}

function McpSettings({ payload }: { payload: BootstrapPayload }) {
  return (
    <div>
      <SettingTitle>MCP Servers</SettingTitle>

      {payload.mcpServers.map((server) => (
        <SettingItem
          key={server.id}
          group="MCP"
          name={server.name}
          description={`${server.tools} tools · Trust level: ${server.trust}`}
        >
          <VsSelect
            value={server.status}
            options={["Configured", "Disabled", "Not configured"]}
          />
        </SettingItem>
      ))}
    </div>
  );
}

function AboutSettings({ payload }: { payload: BootstrapPayload }) {
  return (
    <div>
      <SettingTitle>About</SettingTitle>

      <SettingItem group="Sync" name="Application Name" description="The display name of this application.">
        <div className="text-[12px] text-[#858585]">{payload.appName}</div>
      </SettingItem>

      <SettingItem group="Sync" name="Version" description="The current version of Sync Desktop.">
        <div className="text-[12px] text-[#858585]">{payload.version}</div>
      </SettingItem>

      <SettingItem group="Sync" name="Database Path" description="The local SQLite database used to store all project state.">
        <div className="w-[320px] truncate rounded border border-[#3c3c3c] bg-[#252526] px-3 py-1.5 text-[11px] text-[#858585]">
          {payload.databasePath}
        </div>
      </SettingItem>
    </div>
  );
}
