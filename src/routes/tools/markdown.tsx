import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  ArrowLeftIcon,
  ClipboardCopyIcon,
  CheckIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  markdownToTelegram,
  HEADING_PRESETS,
} from "../../lib/markdown-to-telegram";

export const Route = createFileRoute("/tools/markdown")({
  component: MarkdownConverter,
});

const SAMPLE_MARKDOWN = `# Welcome to the Converter

## What this tool does

Convert your **Markdown** to a format that Telegram Desktop can render.

### Supported elements

- **Bold text** stays bold
- *Italic text* becomes italic (double underscore)
- \`inline code\` stays as-is
- ~~strikethrough~~ stays as-is

> This is a blockquote that will become emoji + italic text.

### Code blocks

\`\`\`
const greeting = "Hello, Telegram!";
console.log(greeting);
\`\`\`

### Links and lists

Check the [Telegram docs](https://telegram.org) for more info.

1. First item
2. Second item
3. Third item

---

That's it! Copy the output and paste it into Telegram Desktop.
`;

function MarkdownConverter() {
  const [input, setInput] = useState(SAMPLE_MARKDOWN);
  const [copied, setCopied] = useState(false);
  const [presetId, setPresetId] = useState(HEADING_PRESETS[1].id); // Geometric

  const activePreset =
    HEADING_PRESETS.find((p) => p.id === presetId) ?? HEADING_PRESETS[1];
  const output = markdownToTelegram(input, activePreset.options);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers/non-HTTPS
      const ta = document.createElement("textarea");
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [output]);

  const handleReset = useCallback(() => {
    setInput(SAMPLE_MARKDOWN);
  }, []);

  return (
    <div className="min-h-screen bg-black relative flex flex-col">
      {/* Background pattern */}
      <div
        className="absolute inset-0 gradient-default-dark pointer-events-none z-0"
        style={{
          maskImage: "url('/dark-pattern.svg')",
          WebkitMaskImage: "url('/dark-pattern.svg')",
          maskRepeat: "repeat",
          WebkitMaskRepeat: "repeat",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-5 py-3 bg-tg-header-bg border-b border-tg-border shrink-0">
        <Link
          to="/"
          className="p-1 text-tg-text-secondary hover:text-white transition-colors"
          title="Back to chat viewer">
          <ArrowLeftIcon className="size-5" />
        </Link>

        <div className="flex items-center gap-2.5">
          <span className="text-xl">✏️</span>
          <div>
            <h1 className="text-[15px] font-semibold text-tg-text-primary leading-tight">
              Markdown → Telegram
            </h1>
            <p className="text-[12px] text-tg-text-secondary leading-tight">
              Convert markdown to Telegram Desktop format
            </p>
          </div>
        </div>
      </header>

      {/* Info strip */}
      <div className="relative z-10 bg-tg-bubble-incoming/40 border-b border-tg-border px-5 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-tg-text-secondary">
        <span className="text-tg-text-primary font-medium mr-1">
          Supported:
        </span>
        <span>
          <code className="bg-tg-input-bg px-1 rounded text-[11px]">
            **bold**
          </code>
        </span>
        <span>
          <code className="bg-tg-input-bg px-1 rounded text-[11px]">
            __italic__
          </code>
        </span>
        <span>
          <code className="bg-tg-input-bg px-1 rounded text-[11px]">
            `code`
          </code>
        </span>
        <span>
          <code className="bg-tg-input-bg px-1 rounded text-[11px]">
            ```block```
          </code>
        </span>
        <span>
          <code className="bg-tg-input-bg px-1 rounded text-[11px]">
            ~~strike~~
          </code>
        </span>
        <span>
          <code className="bg-tg-input-bg px-1 rounded text-[11px]">
            ||spoiler||
          </code>
        </span>
        <span className="text-tg-text-secondary">
          • Headings → emoji + bold • Lists → • bullets • Links → text (url) •
          Blockquotes → 💬 italic
        </span>
      </div>

      {/* Main two-panel layout */}
      <main
        className="relative z-10 flex flex-1 overflow-hidden"
        style={{ minHeight: 0 }}>
        {/* Input panel */}
        <div className="flex-1 flex flex-col border-r border-tg-border min-w-0">
          <div className="flex items-center justify-between px-4 py-2 bg-tg-bg-secondary border-b border-tg-border shrink-0">
            <span className="text-[13px] font-medium text-tg-text-secondary uppercase tracking-wider">
              Markdown Input
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-[12px] text-tg-text-secondary hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
              title="Reset to sample">
              <RefreshCwIcon size={12} />
              Reset
            </button>
          </div>
          <textarea
            id="markdown-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 resize-none bg-transparent text-tg-text-primary text-[14px] font-mono leading-relaxed p-4 outline-none placeholder-tg-text-secondary focus:ring-0"
            placeholder="Paste your markdown here…"
            spellCheck={false}
            style={{ minHeight: "300px" }}
          />
        </div>

        {/* Output panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-tg-bg-secondary border-b border-tg-border shrink-0">
            <span className="text-[13px] font-medium text-tg-text-secondary uppercase tracking-wider mr-auto">
              Telegram Output
            </span>
            {/* Preset dropdown */}
            <select
              id="heading-preset"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="text-[12px] bg-tg-input-bg text-tg-text-primary border border-tg-border rounded px-2 py-1 cursor-pointer hover:border-tg-accent/60 transition-colors outline-none"
              title="Heading style preset">
              {HEADING_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.preview}
                </option>
              ))}
            </select>
            <button
              id="copy-button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${
                copied
                  ? "bg-green-600/80 text-white"
                  : "bg-tg-accent/80 hover:bg-tg-accent text-white"
              }`}>
              {copied ? (
                <>
                  <CheckIcon size={13} />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardCopyIcon size={13} />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre
            id="telegram-output"
            className="flex-1 overflow-auto whitespace-pre-wrap wrap-break-word text-tg-text-primary text-[14px] font-mono leading-relaxed p-4 select-all"
            style={{ minHeight: "300px" }}>
            {output || (
              <span className="text-tg-text-secondary italic">
                Output will appear here…
              </span>
            )}
          </pre>
        </div>
      </main>
    </div>
  );
}
