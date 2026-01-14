import { useAtom } from "jotai";
import { Clock, Folder } from "lucide-react";
import { recentFoldersAtom } from "../lib/atoms";

interface RecentFoldersProps {
  onFolderClick: () => void;
}

export default function RecentFolders({ onFolderClick }: RecentFoldersProps) {
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

  return (
    <div className="w-full max-w-[500px] mt-8">
      <h2 className="text-lg font-semibold text-tg-text-primary mb-4 flex items-center gap-2">
        <Clock size={20} className="text-tg-text-secondary" />
        Recent Folders
      </h2>
      <div className="flex flex-col gap-2">
        {recentFolders.map((folder) => (
          <button
            key={`${folder.folderName}-${folder.timestamp}`}
            onClick={onFolderClick}
            className="bg-tg-bubble-incoming/60 backdrop-blur-xs hover:bg-tg-message-in/50 border border-tg-border/50 rounded-xl p-4 transition-all duration-200 cursor-pointer text-left w-full">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <Folder size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] text-tg-text-primary truncate">
                  {folder.chatName}
                </div>
                <div className="text-[13px] text-tg-text-secondary truncate">
                  {folder.folderName}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[12px] text-tg-text-secondary">
                  <span>{folder.messageCount.toLocaleString()} messages</span>
                  <span>•</span>
                  <span>{formatRelativeTime(folder.timestamp)}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-tg-text-secondary/70 mt-3 text-center italic">
        📁 Click a folder to select it again
      </p>
    </div>
  );
}
