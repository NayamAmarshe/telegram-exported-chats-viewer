import { MicIcon, PaperclipIcon } from "lucide-react";

export default function MessageInput() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-tg-header-bg border-t border-tg-border shrink-0">
      {/* Emoji button */}
      <div className="w-7 h-7 flex items-center justify-center text-tg-text-secondary cursor-pointer">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </div>

      {/* Input field */}
      <input
        type="text"
        className="flex-1 bg-transparent border-none outline-none text-tg-text-primary text-[15px] placeholder:text-tg-text-secondary"
        placeholder="Message"
        disabled
      />

      {/* Attach button */}
      <div className="w-7 h-7 flex items-center justify-center text-tg-text-secondary cursor-pointer">
        <PaperclipIcon />
      </div>

      {/* Mic button */}
      <div className="w-7 h-7 flex items-center justify-center text-tg-text-secondary cursor-pointer">
        <MicIcon />
      </div>
    </div>
  );
}
