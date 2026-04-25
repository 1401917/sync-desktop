import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { BottomPanel, type BottomTab, type TerminalLine } from "./components/BottomPanel";
import { CommandPalette } from "./components/CommandPalette";
import { ignoreTask, restoreTask, updateTaskStatus } from "./features/tasks/taskLogic";
import { bootstrapSync, persistTaskStatus, runTerminalCommand } from "./lib/backend";
import {
  commandRegistry,
  registerBuiltInCommands,
  type CommandContext
} from "./lib/commandRegistry";
import type { ProblemItem } from "./lib/problems";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts";
import { demoPayload } from "./lib/seed";
import type {
  BootstrapPayload,
  ModelProviderSummary,
  NavKey,
  ProjectFileEntry,
  ProjectOpenResult,
  SyncTask
} from "./types/domain";

let commandsRegistered = false;

function nextLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function App() {
  const [payload, setPayload] = useState<BootstrapPayload>(demoPayload);
  const [viewHistory, setViewHistory] = useState<NavKey[]>(["projects"]);
  const [viewIndex, setViewIndex] = useState(0);
  const activeView = viewHistory[viewIndex] ?? "projects";
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFileEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [hasOpenedProject, setHasOpenedProject] = useState(false);

  // Workspace UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("terminal");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Terminal / Problems / Output state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [outputLines, setOutputLines] = useState<TerminalLine[]>([]);
  const [problems, setProblems] = useState<ProblemItem[]>([]);

  const composerFocusRef = useRef<(() => void) | null>(null);

  function navigate(view: NavKey) {
    setViewHistory((current) => {
      const truncated = current.slice(0, viewIndex + 1);
      if (truncated[truncated.length - 1] === view) return truncated;
      return [...truncated, view];
    });
    setViewIndex((current) => current + 1);
  }

  function goBack() {
    setViewIndex((current) => Math.max(0, current - 1));
  }
  function goForward() {
    setViewIndex((current) => Math.min(viewHistory.length - 1, current + 1));
  }

  const canGoBack = viewIndex > 0;
  const canGoForward = viewIndex < viewHistory.length - 1;

  useEffect(() => {
    let mounted = true;
    bootstrapSync().then((nextPayload) => {
      if (!mounted) return;
      setPayload(nextPayload);
    });
    return () => { mounted = false; };
  }, []);

  // Register built-in commands once.
  useEffect(() => {
    if (!commandsRegistered) {
      registerBuiltInCommands();
      commandsRegistered = true;
    }
  }, []);

  const selectedProject = useMemo(
    () => payload.recentProjects.find((p) => p.selected) ?? payload.recentProjects[0],
    [payload.recentProjects]
  );

  const workingDirectory = useMemo(() => {
    return selectedProject?.path || "(no project opened)";
  }, [selectedProject]);

  // ---- Command palette context ----
  const commandContext: CommandContext = useMemo(
    () => ({
      navigate,
      toggleBottomPanel: () => setBottomOpen((v) => !v),
      toggleSidebar: () => setSidebarOpen((v) => !v),
      focusComposer: () => composerFocusRef.current?.(),
      openTerminal: () => {
        setBottomOpen(true);
        setBottomTab("terminal");
      },
      clearTerminal: () => setTerminalLines([]),
      openCommandPalette: () => setPaletteOpen(true)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewIndex, viewHistory.length]
  );

  // ---- Keyboard shortcuts ----
  useKeyboardShortcuts({
    onCommandPalette: () => setPaletteOpen((v) => !v),
    onToggleSidebar: () => setSidebarOpen((v) => !v),
    onToggleBottomPanel: () => setBottomOpen((v) => !v),
    onToggleTerminal: () => {
      setBottomOpen(true);
      setBottomTab("terminal");
    },
    onFocusComposer: () => composerFocusRef.current?.(),
    onCloseOverlay: () => setPaletteOpen(false)
  });

  function handleProjectOpened(result: ProjectOpenResult) {
    setHasOpenedProject(true);
    setProjectFiles(result.files);
    setPayload((current) => ({
      ...current,
      recentProjects: [
        { ...result.project, selected: true },
        ...current.recentProjects
          .filter((project) => project.id !== result.project.id)
          .map((project) => ({ ...project, selected: false }))
      ],
      history: [result.historyEvent, ...current.history].slice(0, 10)
    }));
  }

  function handleTasksGenerated(nextTasks: SyncTask[]) {
    if (nextTasks.length > 0) setHasActiveSession(true);
    setTasks((currentTasks) => {
      const existing = new Set(currentTasks.map((task) => task.id));
      return [...nextTasks.filter((task) => !existing.has(task.id)), ...currentTasks];
    });
  }

  function handleProviderUpdated(provider: ModelProviderSummary) {
    setPayload((current) => ({
      ...current,
      modelProviders: current.modelProviders.map((item) =>
        item.id === provider.id ? provider : item
      )
    }));
  }

  function handleIgnoreTask(taskId: string) {
    setTasks((currentTasks) => ignoreTask(currentTasks, taskId, "Excluded by user"));
    persistTaskStatus(taskId, "Ignored", "Excluded by user").catch(console.warn);
  }
  function handleRestoreTask(taskId: string) {
    setTasks((currentTasks) => restoreTask(currentTasks, taskId));
    persistTaskStatus(taskId, "Pending").catch(console.warn);
  }
  function handleCompleteTask(taskId: string) {
    setTasks((currentTasks) => updateTaskStatus(currentTasks, taskId, "Completed"));
    persistTaskStatus(taskId, "Completed").catch(console.warn);
  }

  // ---- Terminal handler ----
  async function handleRunCommand(command: string) {
    setTerminalLines((current) => [
      ...current,
      { id: nextLineId(), kind: "command", text: command }
    ]);
    setTerminalRunning(true);
    try {
      const result = await runTerminalCommand(
        command,
        selectedProject?.path && hasOpenedProject ? selectedProject.path : null
      );
      const newLines: TerminalLine[] = [];
      if (result.stdout) newLines.push({ id: nextLineId(), kind: "stdout", text: result.stdout.trimEnd() });
      if (result.stderr) newLines.push({ id: nextLineId(), kind: "stderr", text: result.stderr.trimEnd() });
      newLines.push({
        id: nextLineId(),
        kind: "info",
        text: `Exit code ${result.exitCode}`
      });
      setTerminalLines((current) => [...current, ...newLines]);
      // Mirror to Output too so users can keep terminal clean.
      setOutputLines((current) => [...current, ...newLines]);

      // Naive problem extraction: TS/Rust style "file:line:col: message".
      if (result.stderr || result.exitCode !== 0) {
        const extracted = extractProblems(result.stderr + "\n" + result.stdout, command);
        if (extracted.length > 0) {
          setProblems((current) => [...extracted, ...current].slice(0, 200));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTerminalLines((current) => [
        ...current,
        { id: nextLineId(), kind: "stderr", text: message }
      ]);
    } finally {
      setTerminalRunning(false);
    }
  }

  function handleAskAiAboutProblem(problem: ProblemItem) {
    const composed =
      `Please debug this problem:\n` +
      `- File: ${problem.filePath}${problem.line ? `:${problem.line}` : ""}\n` +
      `- Severity: ${problem.severity}\n` +
      `- Source: ${problem.source ?? "unknown"}\n` +
      `- Message: ${problem.message}\n\n` +
      `Inspect the file, identify the root cause, propose a minimal patch, and tell me which validation command to run.`;
    setPrompt(composed);
    navigate("session");
    setTimeout(() => composerFocusRef.current?.(), 50);
  }

  return (
    <>
      <AppShell
        payload={payload}
        activeView={activeView}
        selectedProject={selectedProject}
        tasks={tasks}
        projectFiles={projectFiles}
        prompt={prompt}
        hasActiveSession={hasActiveSession}
        hasOpenedProject={hasOpenedProject}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        sidebarOpen={sidebarOpen}
        bottomPanel={
          <BottomPanel
            open={bottomOpen}
            activeTab={bottomTab}
            onChangeTab={setBottomTab}
            onClose={() => setBottomOpen(false)}
            onToggle={() => setBottomOpen((v) => !v)}
            workingDirectory={workingDirectory}
            problems={problems}
            output={outputLines}
            terminal={terminalLines}
            terminalRunning={terminalRunning}
            onRunCommand={handleRunCommand}
            onClearTerminal={() => setTerminalLines([])}
            onAskAiAboutProblem={handleAskAiAboutProblem}
          />
        }
        onPromptChange={setPrompt}
        onNavigate={navigate}
        onBack={goBack}
        onForward={goForward}
        onProjectOpened={handleProjectOpened}
        onTasksGenerated={handleTasksGenerated}
        onProviderUpdated={handleProviderUpdated}
        onIgnoreTask={handleIgnoreTask}
        onRestoreTask={handleRestoreTask}
        onCompleteTask={handleCompleteTask}
        onComposerRef={(focusFn) => { composerFocusRef.current = focusFn; }}
        onOpenCommandPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        context={commandContext}
      />
    </>
  );
}

function extractProblems(text: string, source: string): ProblemItem[] {
  const out: ProblemItem[] = [];
  const lines = text.split("\n");
  // TypeScript: "src/foo.tsx(12,34): error TS1234: message"
  // Rust:       "error[E0277]: message --> src/foo.rs:12:34"
  const tsRegex = /^(.*?)\((\d+),(\d+)\):\s+(error|warning)\s+([A-Z]+\d+):\s+(.*)$/;
  const rustRegex = /-->\s+([^\s]+):(\d+):(\d+)/;
  const genericRegex = /^([\w./\\-]+):(\d+)(?::(\d+))?:\s+(error|warning):\s+(.*)$/;

  for (const line of lines) {
    let match = line.match(tsRegex);
    if (match) {
      out.push({
        id: `p-${out.length}-${Date.now()}`,
        severity: match[4] === "error" ? "error" : "warning",
        message: match[6],
        filePath: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        source: source.split(/\s+/)[0] || "command"
      });
      continue;
    }
    match = line.match(rustRegex);
    if (match) {
      out.push({
        id: `p-${out.length}-${Date.now()}`,
        severity: "error",
        message: line.trim(),
        filePath: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        source: "cargo"
      });
      continue;
    }
    match = line.match(genericRegex);
    if (match) {
      out.push({
        id: `p-${out.length}-${Date.now()}`,
        severity: match[4] === "error" ? "error" : "warning",
        message: match[5],
        filePath: match[1],
        line: parseInt(match[2], 10),
        column: match[3] ? parseInt(match[3], 10) : undefined,
        source: source.split(/\s+/)[0] || "command"
      });
    }
  }
  return out;
}
