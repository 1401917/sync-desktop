import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

const INITIAL_RENDER_LIMIT = 80_000;
const RENDER_STEP = 80_000;

export function MarkdownView({ source }: { source: string }) {
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);
  const isTruncated = source.length > renderLimit;
  const visibleSource = isTruncated
    ? `${source.slice(0, renderLimit)}\n\n[Response continues below. Render more to keep Sync responsive.]`
    : source;
  const blocks = useMemo(() => parseBlocks(visibleSource), [visibleSource]);

  if (!source) return null;

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} />
      ))}
      {isTruncated ? (
        <button
          className="rounded-md border border-[#303030] bg-[#202020] px-2.5 py-1 text-[11px] text-[#a9a9a9] transition hover:bg-[#292929] hover:text-[#ededed]"
          onClick={() => setRenderLimit((current) => current + RENDER_STEP)}
        >
          Render more of this response
        </button>
      ) : null}
    </div>
  );
}

type Block =
  | { kind: "code"; language: string; content: string }
  | { kind: "heading"; level: 1 | 2 | 3; content: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; content: string };

function parseBlocks(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      const fenceLine = line.trimStart();
      const language = fenceLine.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "code", language: language || "text", content: codeLines.join("\n") });
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, content: headingMatch[2] });
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (
        i < lines.length &&
        ((!ordered && /^\s*[-*]\s+/.test(lines[i])) ||
          (ordered && /^\s*\d+\.\s+/.test(lines[i])))
      ) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      const next = lines[i];
      if (
        next.trimStart().startsWith("```") ||
        /^(#{1,3})\s+/.test(next) ||
        /^\s*[-*]\s+/.test(next) ||
        /^\s*\d+\.\s+/.test(next)
      )
        break;
      paragraphLines.push(next);
      i++;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ kind: "paragraph", content: paragraphLines.join("\n") });
    }
  }

  return blocks;
}

function BlockRenderer({ block }: { block: Block }) {
  if (block.kind === "code") {
    return <CodeBlock language={block.language} content={block.content} />;
  }
  if (block.kind === "heading") {
    const sizes = { 1: "text-[15px]", 2: "text-[13.5px]", 3: "text-[12.5px]" };
    return (
      <div className={`mt-1 font-semibold text-[#f0f0f0] ${sizes[block.level]}`}>
        <Inline source={block.content} />
      </div>
    );
  }
  if (block.kind === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag className={`ml-4 ${block.ordered ? "list-decimal" : "list-disc"} space-y-1 text-[12.5px]`}>
        {block.items.map((item, index) => (
          <li key={index}>
            <Inline source={item} />
          </li>
        ))}
      </Tag>
    );
  }
  return (
    <div className="text-[12.5px]">
      <Inline source={block.content} />
    </div>
  );
}

function CodeBlock({ language, content }: { language: string; content: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#111]">
      <div className="flex items-center justify-between border-b border-[#222] bg-[#171717] px-3 py-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-[#7a7a7a]">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[10.5px] text-[#9a9a9a] transition hover:bg-[#222] hover:text-[#dcdcdc]"
          aria-label="Copy code"
        >
          {copied ? <Check size={11} className="text-[#7fc28a]" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 text-[11.5px] leading-[1.55] text-[#e0e0e0]">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function Inline({ source }: { source: string }) {
  const tokens: Array<{ type: string; value: string; href?: string }> = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: source.slice(lastIndex, match.index) });
    }
    if (match[2]) tokens.push({ type: "bold", value: match[2] });
    else if (match[3]) tokens.push({ type: "italic", value: match[3] });
    else if (match[4]) tokens.push({ type: "code", value: match[4] });
    else if (match[5] && match[6]) tokens.push({ type: "link", value: match[5], href: match[6] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < source.length) {
    tokens.push({ type: "text", value: source.slice(lastIndex) });
  }

  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {tokens.map((token, index) => {
        switch (token.type) {
          case "bold":
            return (
              <strong key={index} className="font-semibold text-[#f0f0f0]">
                {token.value}
              </strong>
            );
          case "italic":
            return (
              <em key={index} className="italic">
                {token.value}
              </em>
            );
          case "code":
            return (
              <code key={index} className="rounded bg-[#222] px-1 py-0.5 font-mono text-[11px] text-[#e6c068]">
                {token.value}
              </code>
            );
          case "link":
            return (
              <a key={index} href={token.href} target="_blank" rel="noreferrer" className="text-[#7fc28a] underline hover:text-[#a3d8aa]">
                {token.value}
              </a>
            );
          default:
            return <span key={index}>{token.value}</span>;
        }
      })}
    </span>
  );
}
