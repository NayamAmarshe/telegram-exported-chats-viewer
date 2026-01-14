import { useAtom } from "jotai";
import { Clock, Folder } from "lucide-react";
import { recentFoldersAtom } from "../lib/atoms";

interface RecentFoldersProps {
  onFolderClick: () => void;
  variant?: "default" | "sidebar";
}

export default function RecentFolders({
  onFolderClick,
  variant = "default",
}: RecentFoldersProps) {
  const [recentFolders] = useAtom(recentFoldersAtom);

  if (recentFolders.length === 0) {
    return null;
  }

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const isSidebar = variant === "sidebar";

  return (
    <div className={`w-full ${isSidebar ? "" : "max-w-[500px]"}`}>
      {!isSidebar && (
        <h2 className="text-lg font-semibold text-tg-text-primary mb-4 flex items-center gap-2">
          <Clock size={20} className="text-tg-text-secondary" />
          Recent Folders
        </h2>
      )}
      <div className="flex flex-col gap-2">
        {recentFolders.map((folder) => (
          <button
            key={`${folder.folderName}-${folder.timestamp}`}
            onClick={onFolderClick}
            className={`
              w-full text-left transition-all duration-200 cursor-pointer
              ${
                isSidebar
                  ? "p-3 rounded-lg hover:bg-white/5 border border-transparent"
                  : "bg-tg-message-in/30 hover:bg-tg-message-in/50 border border-tg-border/50 rounded-xl p-4"
              }
            `}>
            <div className="flex items-start gap-3">
              <div
                className={`
                shrink-0 flex items-center justify-center rounded-lg
                ${
                  isSidebar
                    ? "w-8 h-8 bg-white/5 text-white/70"
                    : "w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 text-white"
                }
              `}>
                <Folder size={isSidebar ? 16 : 20} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`font-semibold truncate ${
                    isSidebar
                      ? "text-sm text-tg-text-primary"
                      : "text-[15px] text-tg-text-primary"
                  }`}>
                  {folder.chatName}
                </div>
                <div className="text-[13px] text-tg-text-secondary truncate opacity-70">
                  {folder.folderName}
                </div>
                {!isSidebar && (
                  <div className="flex items-center gap-3 mt-1 text-[12px] text-tg-text-secondary">
                    <span>{folder.messageCount.toLocaleString()} messages</span>
                    <span>•</span>
                    <span>{formatRelativeTime(folder.timestamp)}</span>
                  </div>
                )}
                {isSidebar && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-tg-text-secondary opacity-60">
                      {folder.messageCount < 1000
                        ? folder.messageCount
                        : `${(folder.messageCount / 1000).toFixed(1)}k`}{" "}
                      msgs
                    </span>
                    <span className="text-[11px] text-tg-text-secondary opacity-60">
                      {formatRelativeTime(folder.timestamp)
                        .replace(" ago", "")
                        .replace("m", "m")
                        .replace("h", "h")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      {!isSidebar && (
        <p className="text-[13px] text-tg-text-secondary/70 mt-3 text-center italic">
          📁 Click a folder to select it again
        </p>
      )}
    </div>
  );
}
