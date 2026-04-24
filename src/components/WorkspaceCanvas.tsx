import {
  FileCode2,
  Paperclip,
  Send,
  SlidersHorizontal,
  TerminalSquare
} from "lucide-react";
import type { BootstrapPayload, NavKey, ProjectSummary, SyncTask } from "../types/domain";
import { ScreenPlaceholder } from "./ScreenPlaceholder";

interface WorkspaceCanvasProps {
  activeView: NavKey;
  selectedProject: ProjectSummary;
  payload: BootstrapPayload;
  tasks: SyncTask[];
  prompt: string;
  onPromptChange: (value: string) => void;
}

export function WorkspaceCanvas({
  activeView,
  selectedProject,
  payload,
  tasks,
  prompt,
  onPromptChange
}: WorkspaceCanvasProps) {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#202020]">
      {activeView === "projects" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 pb-[116px]">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-[#393939] bg-[#242424]">
            <div className="h-3 w-3 rounded-full border border-[#d9d9d9]" />
          </div>
          <h1 className="mt-3 text-[14px] font-medium text-[#f1f1f1]">Let's build</h1>
          <p className="mt-1 max-w-[260px] text-center text-[11px] leading-4 text-[#8d8d8d]">
            Open a project or ask Sync to plan, edit, review, and apply changes with approval.
          </p>
          <div className="mt-4 flex items-center gap-1.5 rounded-full border border-[#333] bg-[#242424] px-2.5 py-1 text-[10px] text-[#858585]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
            {payload.securityMode}
          </div>
        </div>
      ) : (
        <ScreenPlaceholder
          activeView={activeView}
          payload={payload}
          selectedProject={selectedProject}
          tasks={tasks}
        />
      )}

      <PromptComposer prompt={prompt} onPromptChange={onPromptChange} />
    </section>
  );
}

function PromptComposer({
  prompt,
  onPromptChange
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
}) {
  return (
    <div className="absolute bottom-5 left-1/2 w-[min(560px,calc(100%-56px))] -translate-x-1/2 rounded-xl border border-[#343434] bg-[#272727] px-3 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[#3a3a3a] bg-[#202020] px-2 py-0.5 text-[10px] text-[#cfcfcf]">
            Sync Core
          </span>
          <span className="rounded-md border border-[#3a3a3a] bg-[#202020] px-2 py-0.5 text-[10px] text-[#8c8c8c]">
            Plan
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="composer-icon" aria-label="Attach">
            <Paperclip size={13} />
          </button>
          <button className="composer-icon" aria-label="Tools">
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        className="min-h-[44px] w-full resize-none border-none bg-transparent text-[12px] leading-5 text-[#f2f2f2] outline-none placeholder:text-[#777]"
        placeholder="Ask Sync to build..."
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="composer-button">
            <TerminalSquare size={12} />
            Context
          </button>
          <button className="composer-button">
            <FileCode2 size={12} />
            File
          </button>
        </div>
        <button className="grid h-7 w-7 place-items-center rounded-full bg-[#f2f2f2] text-[#1f1f1f] transition hover:bg-white">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
