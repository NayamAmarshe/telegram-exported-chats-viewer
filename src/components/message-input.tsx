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
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </div>

      {/* Mic button */}
      <div className="w-7 h-7 flex items-center justify-center text-tg-text-secondary cursor-pointer">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>
    </div>
  );
}
