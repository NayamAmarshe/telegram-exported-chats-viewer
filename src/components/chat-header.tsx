interface ChatHeaderProps {
  name: string;
  status?: string;
  avatar?: string;
  initials?: string;
}

export default function ChatHeader({
  name,
  status,
  avatar,
  initials,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-2.5 bg-tg-header-bg border-b border-tg-border shrink-0">
      {/* Back button with notification badge */}
      <div className="relative w-6 h-6 flex items-center justify-center text-tg-accent cursor-pointer">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-green-400 rounded-full text-[11px] flex items-center justify-center text-white font-semibold">
          1
        </span>
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-400 to-purple-600 flex items-center justify-center font-semibold text-base text-white overflow-hidden">
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          initials || name.charAt(0).toUpperCase()
        )}
      </div>

      {/* Info */}
      <div className="flex-1">
        <div className="font-semibold text-base text-tg-text-primary">
          {name}
        </div>
        {status && (
          <div className="text-[13px] text-tg-text-secondary">{status}</div>
        )}
      </div>

      {/* Menu */}
      <div className="w-6 h-6 flex items-center justify-center text-tg-text-secondary cursor-pointer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </div>
    </header>
  );
}
