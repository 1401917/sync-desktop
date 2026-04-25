import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileCode2, Search } from "lucide-react";
import { listProjectFiles, previewProjectFile } from "../../lib/backend";
import type { FilePreview, ProjectFileEntry, ProjectSummary } from "../../types/domain";

interface FileExplorerPanelProps {
  project: ProjectSummary;
  files: ProjectFileEntry[];
}

export function FileExplorerPanel({ project, files }: FileExplorerPanelProps) {
  const [query, setQuery] = useState("");
  const [loadedFiles, setLoadedFiles] = useState<ProjectFileEntry[]>(files);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoadedFiles(files);
  }, [files]);

  useEffect(() => {
    if (!project.id || loadedFiles.length > 0 || project.id === "sync-workspace") {
      return;
    }

    listProjectFiles(project.id)
      .then(setLoadedFiles)
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [loadedFiles.length, project.id]);

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return loadedFiles;
    }

    return loadedFiles.filter((file) => file.relativePath.toLowerCase().includes(normalized));
  }, [loadedFiles, query]);

  async function openPreview(file: ProjectFileEntry) {
    setMessage(null);
    setPreview(null);

    try {
      setPreview(await previewProjectFile(project.id, file.relativePath));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 bg-[#171717]">
      <section className="flex w-[340px] shrink-0 flex-col border-r border-[#292929] bg-[#1b1b1b]">
        <div className="border-b border-[#292929] p-3">
          <h1 className="text-[13px] font-medium text-[#eeeeee]">File Explorer</h1>
          <p className="mt-1 truncate text-[11px] text-[#777]">{project.path}</p>
          <div className="mt-3 flex h-8 items-center gap-2 rounded-lg border border-[#333] bg-[#202020] px-2.5">
            <Search size={13} className="text-[#777]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search indexed files"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#666]"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {visibleFiles.length === 0 ? (
            <div className="rounded-lg border border-[#2f2f2f] bg-[#202020] p-3 text-[11px] leading-5 text-[#8d8d8d]">
              Open a project folder to index files.
            </div>
          ) : (
            visibleFiles.map((file) => (
              <button
                key={file.id}
                className="group mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#242424]"
                onClick={() => openPreview(file)}
              >
                <FileCode2 size={13} className="shrink-0 text-[#777]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-[#d7d7d7]">{file.relativePath}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#707070]">
                    <span>{file.language}</span>
                    {file.sensitive ? (
                      <span className="text-[#f3b94e]">Sensitive</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1 overflow-hidden p-5">
        {message ? (
          <div className="mb-3 rounded-lg border border-[#553030] bg-[#2a1c1c] p-3 text-[11px] text-[#ff9b9b]">
            {message}
          </div>
        ) : null}

        {preview ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#2f2f2f] bg-[#1d1d1d]">
            <div className="flex h-11 items-center justify-between border-b border-[#2f2f2f] px-4">
              <div>
                <div className="text-[12px] font-medium text-[#eeeeee]">
                  {preview.relativePath}
                </div>
                <div className="text-[10px] text-[#777]">{preview.message}</div>
              </div>
              {preview.sensitive ? (
                <div className="flex items-center gap-1.5 rounded-full border border-[#4a3b1e] px-2 py-0.5 text-[10px] text-[#f3b94e]">
                  <AlertTriangle size={11} />
                  Protected
                </div>
              ) : null}
            </div>

            <pre className="min-h-0 flex-1 overflow-auto p-4 text-[12px] leading-5 text-[#d8d8d8]">
              {preview.content ?? preview.message}
            </pre>
          </div>
        ) : (
          <div className="grid h-full place-items-center rounded-xl border border-[#2f2f2f] bg-[#1d1d1d] text-[12px] text-[#777]">
            Select an indexed, non-sensitive file to preview.
          </div>
        )}
      </section>
    </div>
  );
}
