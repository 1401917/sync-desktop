import { useEffect, useRef, useState } from "react";
import {
  Github,
  MessageSquare,
  Mail,
  FileText,
  Ticket,
  Cloud,
  Bot,
  Zap,
  Figma,
  Search,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  HardDrive,
  Loader2,
} from "lucide-react";
import type { BootstrapPayload } from "../../types/domain";
import { checkGitHubConnection, startGitHubOAuth, openUrl } from "../../lib/integrations";
import { cn } from "../../lib/cn";

interface ConnectorDef {
  id: string;
  name: string;
  description: string;
  category: "development" | "communication" | "productivity" | "ai";
  icon: typeof Github;
  color: string;
  bg: string;
  website: string;
  privacy: string;
  createdAt: string;
  status: "connected" | "available";
  username?: string;
  actions: { name: string; description: string }[];
}

const BASE_CONNECTORS: Omit<ConnectorDef, "status">[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Repositories, branches, pull requests, and issues.",
    category: "development",
    icon: Github,
    color: "#e0e0e0",
    bg: "#161b22",
    website: "github.com",
    privacy: "github.com/site/privacy",
    createdAt: "Jan 2025",
    actions: [
      { name: "list_repos", description: "List repositories for the authenticated user." },
      { name: "create_branch", description: "Create a new branch in a repository." },
      { name: "open_pull_request", description: "Open a pull request between two branches." },
      { name: "create_issue", description: "Create a new issue in a repository." },
      { name: "push_commit", description: "Push a commit to a branch (approval required)." },
    ],
  },
  {
    id: "figma",
    name: "Figma",
    description: "Search, read, and export design files and components.",
    category: "development",
    icon: Figma,
    color: "#a259ff",
    bg: "#1a1025",
    website: "figma.com",
    privacy: "figma.com/privacy",
    createdAt: "Mar 2025",
    actions: [
      { name: "get_file", description: "Fetch the full content of a Figma file." },
      { name: "list_components", description: "List all components in a project." },
      { name: "export_asset", description: "Export a frame or component as PNG/SVG." },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, read channels, and post notifications.",
    category: "communication",
    icon: MessageSquare,
    color: "#4a90e2",
    bg: "#0f1823",
    website: "slack.com",
    privacy: "slack.com/intl/en-us/trust/privacy/privacy-policy",
    createdAt: "Feb 2025",
    actions: [
      { name: "send_message", description: "Send a message to a Slack channel or user." },
      { name: "list_channels", description: "List available channels in a workspace." },
      { name: "read_messages", description: "Read recent messages from a channel." },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send and read emails from your Gmail account.",
    category: "communication",
    icon: Mail,
    color: "#ea4335",
    bg: "#1f0f0e",
    website: "mail.google.com",
    privacy: "policies.google.com/privacy",
    createdAt: "Mar 2025",
    actions: [
      { name: "send_email", description: "Send an email to one or more recipients." },
      { name: "read_inbox", description: "Read recent emails from your inbox." },
      { name: "search_emails", description: "Search emails by subject, sender, or body." },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read and write pages, databases, and blocks.",
    category: "productivity",
    icon: FileText,
    color: "#d4d4d4",
    bg: "#141414",
    website: "notion.so",
    privacy: "notion.so/privacy",
    createdAt: "Mar 2025",
    actions: [
      { name: "create_page", description: "Create a new Notion page in a workspace." },
      { name: "update_page", description: "Update the content of an existing page." },
      { name: "query_database", description: "Query rows from a Notion database." },
    ],
  },
  {
    id: "jira",
    name: "Jira",
    description: "Manage issues, sprints, and projects.",
    category: "productivity",
    icon: Ticket,
    color: "#2684ff",
    bg: "#0d1526",
    website: "atlassian.com/software/jira",
    privacy: "atlassian.com/legal/privacy-policy",
    createdAt: "Apr 2025",
    actions: [
      { name: "create_issue", description: "Create a new Jira issue in a project." },
      { name: "update_issue", description: "Update the status or fields of an issue." },
      { name: "list_sprints", description: "List active sprints across boards." },
    ],
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Access, read, and create files in Google Drive.",
    category: "productivity",
    icon: HardDrive,
    color: "#34a853",
    bg: "#0d1a10",
    website: "drive.google.com",
    privacy: "policies.google.com/privacy",
    createdAt: "Apr 2025",
    actions: [
      { name: "list_files", description: "List files and folders in Drive." },
      { name: "read_file", description: "Read the content of a Google Doc or Sheet." },
      { name: "create_file", description: "Create a new file in Drive." },
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Manage deployments, projects, and custom domains.",
    category: "development",
    icon: Cloud,
    color: "#d4d4d4",
    bg: "#141414",
    website: "vercel.com",
    privacy: "vercel.com/legal/privacy-policy",
    createdAt: "Apr 2025",
    actions: [
      { name: "list_deployments", description: "List recent deployments for a project." },
      { name: "trigger_deploy", description: "Trigger a new deployment from a branch." },
      { name: "get_build_logs", description: "Fetch build logs for a deployment." },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Access GPT models, completions, and embeddings.",
    category: "ai",
    icon: Bot,
    color: "#10a37f",
    bg: "#091a16",
    website: "openai.com",
    privacy: "openai.com/policies/privacy-policy",
    createdAt: "Jan 2025",
    actions: [
      { name: "chat_completion", description: "Send a prompt and receive a model response." },
      { name: "create_embedding", description: "Generate vector embeddings for text." },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Access Claude models and the Anthropic API directly.",
    category: "ai",
    icon: Zap,
    color: "#d4a574",
    bg: "#1a140e",
    website: "anthropic.com",
    privacy: "anthropic.com/privacy",
    createdAt: "Jan 2025",
    actions: [
      { name: "messages", description: "Send messages to Claude and receive responses." },
      { name: "list_models", description: "List available Claude model versions." },
    ],
  },
];

type Category = "all" | "development" | "communication" | "productivity" | "ai";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "development", label: "Development" },
  { id: "communication", label: "Communication" },
  { id: "productivity", label: "Productivity" },
  { id: "ai", label: "AI" },
];

interface ConnectorsPanelProps {
  payload: BootstrapPayload;
}

export function ConnectorsPanel({ payload: _payload }: ConnectorsPanelProps) {
  const [connectors, setConnectors] = useState<ConnectorDef[]>(() =>
    BASE_CONNECTORS.map((c) => ({ ...c, status: "available" as const }))
  );
  const [selected, setSelected] = useState<ConnectorDef | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");

  // Check GitHub connection on mount
  useEffect(() => {
    checkGitHubConnection().then((status) => {
      if (status.connected) {
        setConnectors((prev) =>
          prev.map((c) =>
            c.id === "github"
              ? { ...c, status: "connected", username: status.username ?? undefined }
              : c
          )
        );
        setSelected((prev) =>
          prev?.id === "github"
            ? { ...prev, status: "connected", username: status.username ?? undefined }
            : prev
        );
      }
    });
  }, []);

  function updateGitHub(status: "connected" | "available", username?: string) {
    setConnectors((prev) =>
      prev.map((c) => (c.id === "github" ? { ...c, status, username } : c))
    );
    setSelected((prev) =>
      prev?.id === "github" ? { ...prev, status, username } : prev
    );
  }

  function toggleOther(id: string) {
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: c.status === "connected" ? "available" : "connected" }
          : c
      )
    );
    setSelected((prev) =>
      prev?.id === id
        ? { ...prev, status: prev.status === "connected" ? "available" : "connected" }
        : prev
    );
  }

  if (selected) {
    return (
      <DetailView
        connector={selected}
        onBack={() => setSelected(null)}
        onUpdateGitHub={updateGitHub}
        onToggleOther={toggleOther}
      />
    );
  }

  const featured = connectors.find((c) => c.id === "github")!;

  const filtered = connectors.filter((c) => {
    const matchesCategory = category === "all" || c.category === category;
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#141414]">
      <div className="mx-auto max-w-[640px] px-6 py-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold text-[#eeeeee]">Connectors</h1>
              <span className="rounded-full border border-[#2a2a2a] bg-[#1c1c1c] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-[#555]">
                Beta
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#444]">
              Connect external services so Sync can act on your behalf.
            </p>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] px-3 py-2">
          <Search size={13} className="shrink-0 text-[#444]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connectors"
            className="flex-1 bg-transparent text-[12px] text-[#ccc] placeholder:text-[#444] outline-none"
          />
        </div>

        {!search && category === "all" && (
          <button
            onClick={() => setSelected(featured)}
            className="mb-5 w-full overflow-hidden rounded-2xl border border-[#1e1e1e] text-left transition hover:border-[#2a2a2a]"
            style={{ background: `linear-gradient(135deg, ${featured.bg} 0%, #0d0d0d 100%)` }}
          >
            <div className="flex items-center gap-4 px-5 py-5">
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#252525]"
                style={{ background: featured.bg }}
              >
                <featured.icon size={26} style={{ color: featured.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#eeeeee]">{featured.name}</span>
                  {featured.status === "connected" && (
                    <CheckCircle2 size={13} className="text-[#4caf50]" />
                  )}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-[#666]">{featured.description}</div>
                {featured.status === "connected" && featured.username && (
                  <div className="mt-1 text-[10px] text-[#4caf50]">@{featured.username}</div>
                )}
              </div>
              <div className={cn(
                "shrink-0 rounded-lg px-3.5 py-1.5 text-[11px] font-semibold",
                featured.status === "connected"
                  ? "border border-[#2a2a2a] bg-[#1c1c1c] text-[#666]"
                  : "bg-white text-[#0d0d0d]"
              )}>
                {featured.status === "connected" ? "Connected" : "Connect"}
              </div>
            </div>
          </button>
        )}

        <div className="mb-4 flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition",
                category === cat.id
                  ? "bg-[#e0e0e0] text-[#0d0d0d]"
                  : "text-[#555] hover:text-[#999]"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {filtered.map((c) => {
            const Icon = c.icon;
            const connected = c.status === "connected";
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="flex items-center gap-3 rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] px-3.5 py-3 text-left transition hover:border-[#2a2a2a] hover:bg-[#141414]"
              >
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#252525]"
                  style={{ background: c.bg }}
                >
                  <Icon size={18} style={{ color: c.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-[#d8d8d8]">{c.name}</span>
                    {connected && <CheckCircle2 size={10} className="shrink-0 text-[#4caf50]" />}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-[#444]">{c.description}</div>
                </div>
                <ChevronRight size={12} className="shrink-0 text-[#2a2a2a]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DetailView({
  connector,
  onBack,
  onUpdateGitHub,
  onToggleOther,
}: {
  connector: ConnectorDef;
  onBack: () => void;
  onUpdateGitHub: (status: "connected" | "available", username?: string) => void;
  onToggleOther: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const Icon = connector.icon;
  const connected = connector.status === "connected";

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleConnect() {
    if (connector.id !== "github") {
      onToggleOther(connector.id);
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await startGitHubOAuth();
      if (result.started && result.status.startsWith("https://")) {
        await openUrl(result.status);
        setMessage("Waiting for authorization in browser...");
        setPolling(true);
        const interval = setInterval(async () => {
          try {
            const status = await checkGitHubConnection();
            if (status.connected) {
              clearInterval(interval);
              pollRef.current = null;
              setPolling(false);
              setMessage(null);
              onUpdateGitHub("connected", status.username ?? undefined);
            }
          } catch { /* ignore */ }
        }, 2000);
        pollRef.current = interval;
        setTimeout(() => {
          clearInterval(interval);
          setPolling(false);
          setMessage("Authorization timed out. Try again.");
        }, 5 * 60 * 1000);
      } else {
        setMessage(result.message);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    if (pollRef.current) { clearInterval(pollRef.current); setPolling(false); }
    setMessage(null);
    if (connector.id === "github") {
      onUpdateGitHub("available");
    } else {
      onToggleOther(connector.id);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#141414]">
      <div className="flex items-center gap-2 border-b border-[#1e1e1e] px-5 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-[#555] transition hover:text-[#999]"
        >
          <ArrowLeft size={13} />
          Connectors
        </button>
      </div>

      <div className="mx-auto max-w-[520px] px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#252525]"
              style={{ background: connector.bg }}
            >
              <Icon size={26} style={{ color: connector.color }} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold text-[#eeeeee]">{connector.name}</h1>
              {connected && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-[#4caf50]">
                  <CheckCircle2 size={11} />
                  {connector.username ? `Connected as @${connector.username}` : "Connected"}
                </div>
              )}
            </div>
          </div>

          {connected ? (
            <button
              onClick={handleDisconnect}
              className="shrink-0 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-4 py-1.5 text-[12px] font-medium text-[#777] transition hover:border-[#3a3a3a] hover:text-[#aaa]"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading || polling}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-[12px] font-medium text-[#0d0d0d] transition hover:bg-[#e0e0e0] disabled:opacity-50"
            >
              {(loading || polling) && <Loader2 size={12} className="animate-spin" />}
              Connect
            </button>
          )}
        </div>

        {message && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] px-3 py-2.5 text-[11px] text-[#666]">
            {polling && <Loader2 size={11} className="shrink-0 animate-spin" />}
            {message}
          </div>
        )}

        <p className="mt-4 text-[12px] leading-5 text-[#666]">{connector.description}</p>

        <hr className="my-6 border-[#1e1e1e]" />

        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#3a3a3a]">
            Information
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#1e1e1e]">
            {[
              { label: "Added", value: connector.createdAt, link: false },
              { label: "Website", value: connector.website, link: true },
              { label: "Privacy Policy", value: "View policy", link: true },
            ].map((row, i) => (
              <div
                key={row.label}
                className={cn("flex items-center justify-between px-4 py-2.5", i > 0 && "border-t border-[#1a1a1a]")}
              >
                <span className="text-[12px] text-[#555]">{row.label}</span>
                {row.link ? (
                  <a className="flex cursor-pointer items-center gap-1 text-[12px] text-[#4a90e2] hover:underline">
                    {row.value} <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-[12px] text-[#888]">{row.value}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#3a3a3a]">
            Actions
          </h2>
          <div className="space-y-1.5">
            {connector.actions.map((action) => (
              <div key={action.name} className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] px-4 py-3">
                <div className="text-[12px] font-medium text-[#d0d0d0]">{action.name}</div>
                <div className="mt-0.5 text-[11px] leading-4 text-[#555]">{action.description}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
