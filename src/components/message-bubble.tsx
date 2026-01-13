import type { ParsedMessage } from "../lib/file-handler";
import MediaViewer from "./media-viewer";
import { CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  message: ParsedMessage;
  isOutgoing: boolean;
  showAvatar?: boolean;
}

export default function MessageBubble({
  message,
  isOutgoing,
  showAvatar = false,
}: MessageBubbleProps) {
  if (message.type === "service") {
    return (
      <div className="text-center py-2 text-tg-text-secondary text-[13px]">
        {message.text}
      </div>
    );
  }

  const hasMedia = message.media && message.media.length > 0;
  const hasText = message.text && message.text.trim().length > 0;
  const isSticker =
    hasMedia &&
    message.media?.some(
      (m) => m.type === "sticker" || m.type === "animated_sticker"
    );

  return (
    <div
      className={`flex gap-2 mb-0.5 ${isOutgoing ? "justify-end" : "justify-start"}`}>
      {/* Avatar for incoming messages */}
      {!isOutgoing && showAvatar && (
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 self-end ${message.userpicClass || "userpic1"}`}>
          {message.initials || message.from?.charAt(0).toUpperCase() || "?"}
        </div>
      )}
      {/* Spacer for grouped messages without avatar */}
      {!isOutgoing && !showAvatar && <div className="w-8 shrink-0"></div>}

      {/* Message bubble */}
      <div
        className={`
        max-w-[70%] px-3 py-2 rounded-2xl relative
        ${isSticker ? "bg-transparent max-w-[180px]" : ""}
        ${
          isOutgoing
            ? "bg-tg-bubble-outgoing rounded-br-sm"
            : "bg-tg-bubble-incoming rounded-bl-sm"
        }
      `}>
        {/* Reply Quote */}
        {message.replyTo && (
          <div className="bg-black/20 px-2.5 py-1.5 rounded-lg border-l-2 border-tg-accent mb-1.5">
            {/* Show sender name if available */}
            {message.replyTo.senderName && (
              <div className="text-tg-accent text-[13px] font-medium">
                {message.replyTo.senderName}
              </div>
            )}
            {/* Show message preview if available, otherwise fallback */}
            <div className="text-[13px] text-tg-text-secondary truncate max-w-[250px]">
              {message.replyTo.preview || message.replyTo.text}
            </div>
          </div>
        )}

        {/* Media */}
        {hasMedia && <MediaViewer media={message.media!} />}

        {/* Text */}
        {hasText && (
          <div
            className="wrap-break-word whitespace-pre-wrap [&_a]:text-tg-link [&_a]:no-underline hover:[&_a]:underline"
            dangerouslySetInnerHTML={{
              __html: message.formattedHTML || message.text || "",
            }}
          />
        )}

        {/* Footer: time + status */}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span
            className={`text-[11px] ${isOutgoing ? "text-white/50" : "text-tg-text-secondary"}`}>
            {message.time}
          </span>
          {isOutgoing && <CheckCheck size={16} className="text-green-400" />}
        </div>
      </div>
    </div>
  );
}

// Utility component for message reactions (to be used when needed)
export function MessageReactions() {
  return (
    <div className="flex gap-1 mt-1">
      <div className="flex items-center gap-0.5 bg-tg-reaction-bg px-1.5 py-0.5 rounded-xl text-sm">
        <span className="text-base">❤️</span>
        <div className="w-4 h-4 rounded-full bg-linear-to-br from-indigo-400 to-purple-600"></div>
      </div>
    </div>
  );
}
