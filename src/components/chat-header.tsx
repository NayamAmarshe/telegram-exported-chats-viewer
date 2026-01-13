import { ArrowLeftIcon, EllipsisVerticalIcon } from "lucide-react";

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
    <header className="flex items-center gap-4 px-4 py-2.5 bg-tg-header-bg border-b border-tg-border shrink-0">
      {/* Back button */}
      <ArrowLeftIcon className="text-tg-text-secondary size-6" />

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
      <EllipsisVerticalIcon
        size={24}
        className="text-tg-text-secondary cursor-pointer"
      />
    </header>
  );
}
