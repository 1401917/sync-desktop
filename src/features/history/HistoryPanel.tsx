import { Clock, History as HistoryIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { BootstrapPayload, HistorySummary } from "../../types/domain";

interface HistoryPanelProps {
  payload: BootstrapPayload;
}

const STATUS_TONE: Record<string, string> = {
  Completed: "bg-[#1f2a20] text-[#7fc28a] border-[#2a3f2c]",
  "In Progress": "bg-[#1f2530] text-[#9cb8e0] border-[#2c3a4d]",
  Failed: "bg-[#2a1d1d] text-[#e08585] border-[#4a2a2a]",
  Blocked: "bg-[#2a1d1d] text-[#e08585] border-[#4a2a2a]",
  Pending: "bg-[#26241d] text-[#cfb56a] border-[#3f3a25]",
  Active: "bg-[#1f2a20] text-[#7fc28a] border-[#2a3f2c]"
};

export function HistoryPanel({ payload }: HistoryPanelProps) {
  const [filter, setFilter] = useState("");

  const grouped = useMemo(() => groupByBucket(payload.history, filter), [
    payload.history,
    filter
  ]);

  const total = payload.history.length;
  const matched = grouped.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#171717]">
      <header className="border-b border-[#222] px-6 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#2c2c2c] bg-[#222] text-[#cfcfcf]">
            <HistoryIcon size={15} />
          </div>
          <div>
            <h1 className="text-[16px] font-medium text-[#ededed]">History</h1>
            <p className="mt-0.5 text-[11px] text-[#8a8a8a]">
              Sessions, tasks, tool calls, approvals and audits, grouped by recency.
            </p>
          </div>
          <div className="ml-auto rounded-md border border-[#2a2a2a] bg-[#202020] px-2.5 py-1 text-[10.5px] text-[#9a9a9a]">
            {filter ? `${matched} of ${total}` : `${total} events`}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1d1d1d] px-3">
          <Search size={13} className="text-[#7a7a7a]" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search by title, kind, or status…"
            className="h-9 min-w-0 flex-1 border-none bg-transparent text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#666]"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {matched === 0 ? (
          <div className="grid h-full place-items-center text-[12px] text-[#7a7a7a]">
            {filter ? "No events match that search." : "No history yet — your sessions will appear here."}
          </div>
        ) : (
          <div className="mx-auto max-w-[760px] space-y-7">
            {grouped.map((group) => (
              <section key={group.label}>
                <div className="mb-2 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-wider text-[#7a7a7a]">
                  <span>{group.label}</span>
                  <span className="text-[10px] normal-case text-[#5e5e5e]">
                    {group.entries.length}
                  </span>
                </div>
                <ul className="space-y-1">
                  {group.entries.map((entry) => (
                    <HistoryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistorySummary }) {
  const tone = STATUS_TONE[entry.status] ?? "bg-[#222] text-[#a0a0a0] border-[#2a2a2a]";
  const relative = relativeTime(entry.timestamp);
  const absolute = formatAbsolute(entry.timestamp);

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-[#222] bg-[#1c1c1c] px-3 py-2 transition hover:bg-[#212121]">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#2a2a2a] bg-[#191919] text-[#9a9a9a]">
        <Clock size={12} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] font-medium text-[#ededed]">
            {entry.title}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${tone}`}>
            {entry.status}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[#7a7a7a]">
          <span>{entry.kind}</span>
          <span>·</span>
          <span title={absolute}>{absolute}</span>
        </div>
      </div>
      <div className="shrink-0 text-[10.5px] text-[#7a7a7a]" title={absolute}>
        {relative}
      </div>
    </li>
  );
}

interface Group {
  label: string;
  entries: HistorySummary[];
}

function groupByBucket(history: HistorySummary[], filter: string): Group[] {
  const filtered = filter.trim()
    ? history.filter((entry) =>
        [entry.title, entry.kind, entry.status]
          .join(" ")
          .toLowerCase()
          .includes(filter.toLowerCase())
      )
    : history;

  const buckets: Record<string, HistorySummary[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 days": [],
    "Last 30 days": [],
    Older: []
  };

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  for (const entry of filtered) {
    const ts = parseTimestamp(entry.timestamp);
    const age = ts ? now - ts : Number.POSITIVE_INFINITY;
    if (age < oneDay) buckets.Today.push(entry);
    else if (age < 2 * oneDay) buckets.Yesterday.push(entry);
    else if (age < 7 * oneDay) buckets["Last 7 days"].push(entry);
    else if (age < 30 * oneDay) buckets["Last 30 days"].push(entry);
    else buckets.Older.push(entry);
  }

  return Object.entries(buckets)
    .filter(([, entries]) => entries.length > 0)
    .map(([label, entries]) => ({
      label,
      entries: entries.sort(
        (a, b) => (parseTimestamp(b.timestamp) ?? 0) - (parseTimestamp(a.timestamp) ?? 0)
      )
    }));
}

function parseTimestamp(value: string): number | null {
  if (!value) return null;
  // Accept ISO-8601 and SQLite datetime ('YYYY-MM-DD HH:MM:SS' UTC).
  const isoCandidate = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const parsed = Date.parse(isoCandidate);
  return Number.isNaN(parsed) ? null : parsed;
}

function relativeTime(timestamp: string): string {
  const ts = parseTimestamp(timestamp);
  if (ts === null) return "—";
  const diffSeconds = Math.floor((Date.now() - ts) / 1000);
  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}

function formatAbsolute(timestamp: string): string {
  const ts = parseTimestamp(timestamp);
  if (ts === null) return timestamp;
  const date = new Date(ts);
  return date.toLocaleString();
}
