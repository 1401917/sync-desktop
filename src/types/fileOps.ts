// Strict file-operation contract. Mirrors the Rust parser in
// src-tauri/src/workspace.rs (parse_sync_path, parse_sync_delete,
// extract_file_artifacts, extract_file_deletions). No fallback parsing —
// the AI must use the marker format or no operation is emitted.

export type FileOperationKind = "create" | "update" | "delete";

export interface FileOperation {
  kind: FileOperationKind;
  /** Project-root-relative path as it appeared after the marker. */
  path: string;
  /** File body for create/update; undefined for delete. */
  content?: string;
  /** The line that triggered detection. */
  rawMarker: string;
  /**
   * Frontend heuristic — true when the path looks sensitive
   * (.env, *.pem, *.key, secrets.*, paths inside .git/, node_modules/, etc.).
   * The Rust backend is the source of truth and may block additional cases;
   * this is purely for UI labelling.
   */
  isSensitive: boolean;
  /** True when the path is invalid or escapes the project root. */
  isUnsafe: boolean;
}

export type ParseWarningCode =
  | "no-markers-but-code-blocks"
  | "marker-empty-path"
  | "code-block-unterminated";

export interface ParseWarning {
  code: ParseWarningCode;
  message: string;
}

export interface ParsedAssistantMessage {
  /** Recognized operations in input order. */
  operations: FileOperation[];
  /** Human-readable warnings for the UI. */
  warnings: ParseWarning[];
  /**
   * Number of fenced code blocks whose first line did NOT contain
   * `sync:path=`. Used by the OperationsSummary banner.
   */
  codeBlocksWithoutMarkers: number;
  /** Total fenced code blocks seen, including those with markers. */
  totalCodeBlocks: number;
}
