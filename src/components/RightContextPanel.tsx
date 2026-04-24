import { CircleDot, Database, ShieldCheck } from "lucide-react";
import type { BootstrapPayload, ProjectSummary, SyncTask } from "../types/domain";

interface RightContextPanelProps {
  payload: BootstrapPayload;
  selectedProject: ProjectSummary;
  tasks: SyncTask[];
}

export function RightContextPanel({ payload, selectedProject, tasks }: RightContextPanelProps) {
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const approvals = tasks.filter((task) => task.status === "Waiting for Approval").length;

  return (
    <aside className="w-[320px] shrink-0 border-l border-[#1B2430] bg-sync-sidebar p-[18px]">
      <h2 className="text-[15px] font-semibold text-[#EAF2FC]">Context</h2>

      <div className="mt-4 space-y-3">
        <ContextCard
          title="Current Project"
          main={selectedProject.name}
          secondary={selectedProject.description}
          status="Active"
        />
        <ContextCard
          title="Selected Mode"
          main="Build Foundation"
          secondary="Architecture, storage, security"
          status="Focused"
        />
        <ContextCard
          title="Next Step"
          main="Review guarded actions"
          secondary="Then enable provider calls"
          status="Planned"
        />
      </div>

      <h2 className="mt-6 text-[15px] font-semibold text-[#EAF2FC]">Quick Details</h2>
      <div className="mt-3 rounded-2xl border border-[#1F2B39] bg-sync-card">
        <Detail label="Product Type" value="Desktop EXE" />
        <Detail label="Style" value="Minimal / Premium" />
        <Detail label="Theme" value="Dark" />
        <Detail label="Layout" value="3-panel workspace" />
        <Detail label="Focus" value="AI coding workflow" />
      </div>

      <h2 className="mt-6 text-[15px] font-semibold text-[#EAF2FC]">Runtime</h2>
      <div className="mt-3 space-y-3">
        <RuntimeCard
          icon={Database}
          title="Local Storage"
          value={payload.databasePath}
          status="SQLite"
        />
        <RuntimeCard
          icon={ShieldCheck}
          title="Security"
          value={`${approvals} approval waiting`}
          status={payload.securityMode}
        />
        <RuntimeCard
          icon={CircleDot}
          title="Task Progress"
          value={`${completed}/${tasks.length} completed`}
          status="Traceable"
        />
      </div>
    </aside>
  );
}

function ContextCard({
  title,
  main,
  secondary,
  status
}: {
  title: string;
  main: string;
  secondary: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1F2B39] bg-sync-card p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-sync-muted">{title}</div>
        <span className="rounded-full border border-[#284362] bg-[#12243A] px-2 py-0.5 text-[11px] text-[#93BAFF]">
          {status}
        </span>
      </div>
      <div className="mt-2 truncate text-[14px] font-semibold text-sync-text">{main}</div>
      <div className="mt-1 text-[12px] text-sync-secondary">{secondary}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#1A2431] px-3 py-2.5 text-[12px] last:border-b-0">
      <span className="text-[#91A0B1]">{label}</span>
      <span className="text-right text-[#E4ECF7]">{value}</span>
    </div>
  );
}

function RuntimeCard({
  icon: Icon,
  title,
  value,
  status
}: {
  icon: typeof Database;
  title: string;
  value: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1F2B39] bg-sync-card p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] text-sync-muted">
          <Icon size={14} className="text-sync-accent" />
          {title}
        </div>
        <span className="text-[11px] text-sync-muted">{status}</span>
      </div>
      <div className="mt-2 break-words text-[12px] text-[#DCE6F2]">{value}</div>
    </div>
  );
}
