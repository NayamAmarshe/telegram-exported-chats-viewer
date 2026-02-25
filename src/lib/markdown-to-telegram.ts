/**
 * Convert standard Markdown to Telegram Desktop-compatible format.
 *
 * Telegram Desktop (as of 2024) natively supports:
 *   **bold**  __italic__  `inline code`  ```code blocks```  ~~strikethrough~~  ||spoiler||
 *
 * It does NOT support: headings, links with custom text, HTML, tables, blockquotes.
 * This converter maps such elements to readable equivalents using emojis and native formatting.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversionOptions {
  /** Emoji to prefix H1 headings */
  h1Emoji?: string;
  /** Emoji to prefix H2 headings */
  h2Emoji?: string;
  /** Emoji to prefix H3 headings */
  h3Emoji?: string;
  /** Emoji to prefix H4 headings */
  h4PlusEmoji?: string;
  /** Emoji to prefix H5–H6 headings */
  h5Emoji?: string;
  /** Emoji to prefix blockquotes */
  blockquoteEmoji?: string;
  /** Bullet character for unordered lists */
  bulletChar?: string;
  /** Divider string for horizontal rules */
  divider?: string;
}

// ---------------------------------------------------------------------------
// Heading presets
// ---------------------------------------------------------------------------

export interface HeadingPreset {
  id: string;
  label: string;
  /** Preview string shown in the dropdown (H1–H5 symbols joined by space) */
  preview: string;
  options: Required<
    Pick<
      ConversionOptions,
      "h1Emoji" | "h2Emoji" | "h3Emoji" | "h4PlusEmoji" | "h5Emoji"
    >
  >;
}

export const HEADING_PRESETS: HeadingPreset[] = [
  {
    id: "solid",
    label: "Solid",
    preview: "● ◼ ◆ ▸ ▪",
    options: {
      h1Emoji: "●",
      h2Emoji: "◼",
      h3Emoji: "◆",
      h4PlusEmoji: "▸",
      h5Emoji: "▪",
    },
  },
  {
    id: "geometric",
    label: "Geometric",
    preview: "■ ▣ ▢ ▫ ·",
    options: {
      h1Emoji: "■",
      h2Emoji: "▣",
      h3Emoji: "▢",
      h4PlusEmoji: "▫",
      h5Emoji: "·",
    },
  },
  {
    id: "color",
    label: "Color Blocks",
    preview: "🟥 🟧 🟨 🟩 🟦",
    options: {
      h1Emoji: "🟥",
      h2Emoji: "🟧",
      h3Emoji: "🟨",
      h4PlusEmoji: "🟩",
      h5Emoji: "🟦",
    },
  },
  {
    id: "circle-color-blocks",
    label: "Circle Color Blocks",
    preview: "🔴 🟠 🟡 🟢 🔵",
    options: {
      h1Emoji: "🔴",
      h2Emoji: "🟠",
      h3Emoji: "🟡",
      h4PlusEmoji: "🟢",
      h5Emoji: "🔵",
    },
  },
  {
    id: "Red Emoji",
    label: "Red Emoji",
    preview: "🟥 📌 📍 🔺 •",
    options: {
      h1Emoji: "🟥",
      h2Emoji: "📌",
      h3Emoji: "📍",
      h4PlusEmoji: "🔺",
      h5Emoji: "•",
    },
  },
  {
    id: "Flowers",
    label: "Flowers",
    preview: "🌸 🌺 🌻 🌼 🌷",
    options: {
      h1Emoji: "🌸",
      h2Emoji: "🌺",
      h3Emoji: "🌻",
      h4PlusEmoji: "🌼",
      h5Emoji: "🌷",
    },
  },
  {
    id: "Emojis",
    label: "Emojis",
    preview: "⭐ 💠 🚩 💎 👉",
    options: {
      h1Emoji: "⭐",
      h2Emoji: "💠",
      h3Emoji: "🚩",
      h4PlusEmoji: "💎",
      h5Emoji: "👉",
    },
  },
];

const DEFAULTS: Required<ConversionOptions> = {
  ...HEADING_PRESETS[1].options, // Geometric as default
  blockquoteEmoji: "💬",
  bulletChar: "•",
  divider: "—————————————————",
};

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

export function markdownToTelegram(
  input: string,
  options: ConversionOptions = {},
): string {
  const opts = { ...DEFAULTS, ...options };
  let text = input;

  // ── 1. Normalise line endings ──────────────────────────────────────────
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // ── 2. Fenced code blocks — protect them first so inner content isn't munged ──
  // We'll extract them, replace with placeholders, restore at the end.
  const codeBlocks: string[] = [];
  text = text.replace(/```([\s\S]*?)```/g, (_match, inner) => {
    const idx = codeBlocks.push("```" + inner + "```") - 1;
    return `\x00CODEBLOCK${idx}\x00`;
  });

  // ── 3. Inline code — protect similarly ────────────────────────────────
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_match, inner) => {
    const idx = inlineCodes.push("`" + inner + "`") - 1;
    return `\x00INLINECODE${idx}\x00`;
  });

  // ── 4. Bold — must run BEFORE headings so the **…** injected by heading
  //    rules is never re-processed by the italic step below.
  // Markdown __bold__ → Telegram **bold**
  text = text.replace(/__((?:[^_\n]|_(?!_))+)__/g, "**$1**");
  // **bold** is already correct — keep as-is

  // ── 5. Italic — convert *text* and _text_ to __text__ (TG double-underscore)
  //    Use negative lookaround so single * never matches inside **bold**.
  // Single *italic* — must NOT be preceded or followed by another *
  text = text.replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, "__$1__");
  // Single _italic_ — must NOT be preceded or followed by another _
  text = text.replace(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, "__$1__");

  // ── 6. Blockquotes (> text) → emoji + italic ──────────────────────────
  // Handle multiline blockquotes (consecutive > lines merged into one block)
  text = text.replace(/((?:^[ \t]*>[ \t]?.+\n?)+)/gm, (match) => {
    const lines = match
      .split("\n")
      .map((l) => l.replace(/^[ \t]*>[ \t]?/, "").trim())
      .filter(Boolean);
    const content = lines.join(" ");
    // Wrap in italic using double underscores
    return `${opts.blockquoteEmoji} __${content}__\n`;
  });

  // ── 7. Headings ────────────────────────────────────────────────────────
  //    Run AFTER bold/italic so the **…** we inject here is never re-processed.
  text = text.replace(/^#{6}\s+(.+)$/gm, `${opts.h5Emoji} $1`);
  text = text.replace(/^#{5}\s+(.+)$/gm, `${opts.h5Emoji} $1`);
  text = text.replace(/^#{4}\s+(.+)$/gm, `${opts.h4PlusEmoji} $1`);
  text = text.replace(/^###\s+(.+)$/gm, `${opts.h3Emoji} $1`);
  text = text.replace(/^##\s+(.+)$/gm, `${opts.h2Emoji} **$1**`);
  text = text.replace(/^#\s+(.+)$/gm, `${opts.h1Emoji} **$1**`);

  // ── 8. Setext-style headings (underlined with === or ---) ─────────────
  text = text.replace(/^(.+)\n={2,}$/gm, `${opts.h1Emoji} **$1**`);
  text = text.replace(/^(.+)\n-{2,}$/gm, `${opts.h2Emoji} **$1**`);

  // ── 9. Horizontal rules → divider string ──────────────────────────────
  text = text.replace(/^(?:\*{3,}|-{3,}|_{3,})$/gm, opts.divider);

  // ── 10. Strikethrough — keep ~~text~~ as-is (supported) ───────────────
  // Nothing to do.

  // ── 11. Links [text](url) → text (url) ───────────────────────────────
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // ── 12. Images ![alt](url) → 🖼 alt (url) ────────────────────────────
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "🖼 $1 ($2)");

  // ── 13. Unordered lists (-, *, +) → bullet char ───────────────────────
  text = text.replace(/^[ \t]*[-*+]\s+(.+)$/gm, `${opts.bulletChar} $1`);

  // ── 14. Ordered lists — keep numbers, clean indentation ───────────────
  text = text.replace(/^[ \t]*(\d+)\.\s+(.+)$/gm, "$1. $2");

  // ── 15. Restore placeholders ──────────────────────────────────────────
  text = text.replace(/\x00INLINECODE(\d+)\x00/g, (_m, i) => inlineCodes[+i]);
  text = text.replace(/\x00CODEBLOCK(\d+)\x00/g, (_m, i) => codeBlocks[+i]);

  // ── 16. Collapse excessive blank lines (max 2 in a row) ───────────────
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
