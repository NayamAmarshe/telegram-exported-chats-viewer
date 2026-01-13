import { useRef, useCallback, useEffect, useState } from "react";
import { atom, useAtom } from "jotai";
import type { ParsedMessage, ChatInfo } from "../lib/file-handler";
import { parseHTML } from "../lib/file-handler";
import { parseMessage } from "../lib/parser";
import ChatHeader from "./chat-header";
import MessageBubble from "./message-bubble";
import DateSeparator from "./date-separator";
import MessageInput from "./message-input";

// Jotai atoms for global state
export const chatDataAtom = atom<ChatInfo | null>(null);
export const loadingAtom = atom<boolean>(false);
export const loadingProgressAtom = atom<string>("");

// Pagination settings
const MESSAGES_PER_PAGE = 50;

// Process messages to inherit "from" for joined messages
function processMessagesWithInheritance(
  messages: ParsedMessage[]
): ParsedMessage[] {
  let lastFrom = "";
  let lastInitials = "";
  let lastUserpicClass = "userpic1";

  return messages.map((msg) => {
    if (msg.type === "service") return msg;

    // If joined message (no from_name), inherit from previous
    if (msg.isJoined || !msg.from) {
      return {
        ...msg,
        from: lastFrom,
        initials: lastInitials,
        userpicClass: lastUserpicClass,
      };
    } else {
      // Update tracking for next joined message
      lastFrom = msg.from;
      lastInitials = msg.initials || msg.from.charAt(0).toUpperCase();
      lastUserpicClass = msg.userpicClass || "userpic1";
      return msg;
    }
  });
}

export default function ChatViewer() {
  const [chatData, setChatData] = useAtom(chatDataAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [loadingProgress, setLoadingProgress] = useAtom(loadingProgressAtom);
  const [displayedCount, setDisplayedCount] = useState(MESSAGES_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentStickyDate, setCurrentStickyDate] = useState<string | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<
    Map<number, { element: HTMLDivElement; date: string }>
  >(new Map());

  // Infinite scroll - load more when reaching bottom
  const handleScroll = useCallback(() => {
    if (!messagesAreaRef.current || !chatData || loadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;

    // Load more when near the bottom
    if (
      scrollHeight - scrollTop - clientHeight < 200 &&
      displayedCount < chatData.messages.length
    ) {
      setLoadingMore(true);
      setTimeout(() => {
        setDisplayedCount((prev) =>
          Math.min(prev + MESSAGES_PER_PAGE, chatData.messages.length)
        );
        setLoadingMore(false);
      }, 300);
    }

    // Update sticky date based on scroll position
    let visibleDate: string | null = null;
    for (const [_, { element, date }] of messageRefs.current) {
      const rect = element.getBoundingClientRect();
      const containerRect = messagesAreaRef.current.getBoundingClientRect();
      if (
        rect.top <= containerRect.top + 50 &&
        rect.bottom > containerRect.top
      ) {
        visibleDate = date;
      }
    }
    if (visibleDate !== currentStickyDate) {
      setCurrentStickyDate(visibleDate);
    }
  }, [chatData, displayedCount, loadingMore, currentStickyDate]);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (area) {
      area.addEventListener("scroll", handleScroll);
      return () => area.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const handleFolderSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setLoading(true);
      setLoadingProgress("Reading files...");

      try {
        const allFiles = Array.from(files);

        // Find HTML files
        const htmlFiles = allFiles.filter(
          (f) => f.name.endsWith(".html") && f.name.startsWith("messages")
        );
        htmlFiles.sort((a, b) => a.name.localeCompare(b.name));

        if (htmlFiles.length === 0) {
          alert(
            "No message HTML files found. Please select a Telegram export folder containing messages.html files."
          );
          setLoading(false);
          return;
        }

        setLoadingProgress(`Found ${htmlFiles.length} message files...`);

        const allMessages: ParsedMessage[] = [];
        let chatName = "Chat";

        // Parse each HTML file
        for (let i = 0; i < htmlFiles.length; i++) {
          const file = htmlFiles[i];
          setLoadingProgress(
            `Parsing ${file.name} (${i + 1}/${htmlFiles.length})...`
          );

          const htmlContent = await file.text();
          const doc = parseHTML(htmlContent);

          // Get chat name from first file - this is the contact/chat we're viewing
          if (i === 0) {
            const nameEl = doc.querySelector(".page_header .text");
            chatName = nameEl?.textContent?.trim() || "Chat";
          }

          // Get base path for media files
          const basePath = file.webkitRelativePath
            .split("/")
            .slice(0, -1)
            .join("/");

          // Parse messages
          const messageDivs = doc.querySelectorAll(".message");
          for (const messageDiv of messageDivs) {
            const parsed = await parseMessage(messageDiv, allFiles, basePath);
            allMessages.push(parsed);
          }
        }

        setLoadingProgress("Processing messages...");

        // Process messages to handle "joined" inheritance
        const processedMessages = processMessagesWithInheritance(allMessages);

        // Resolve reply references
        const messageMap = new Map<string, ParsedMessage>();
        for (const msg of processedMessages) {
          if (msg.id) {
            const numId = msg.id.replace("message", "");
            messageMap.set(numId, msg);
          }
        }

        // Add reply content to messages
        for (const msg of processedMessages) {
          if (msg.replyTo?.messageId) {
            const referencedMsg = messageMap.get(String(msg.replyTo.messageId));
            if (referencedMsg) {
              msg.replyTo.senderName = referencedMsg.from || "Unknown";
              msg.replyTo.preview =
                referencedMsg.text?.substring(0, 100) || "Media message";
            }
          }
        }

        setLoadingProgress("Rendering...");

        setChatData({
          name: chatName,
          messages: processedMessages,
        });

        // Reset pagination
        setDisplayedCount(MESSAGES_PER_PAGE);
        setLoading(false);
      } catch (error) {
        console.error("Error parsing chat:", error);
        alert(
          "Error parsing chat files. Please check the console for details."
        );
        setLoading(false);
      }
    },
    [setChatData, setLoading, setLoadingProgress]
  );

  // Format date for display
  const formatDate = (dateStr: string): string => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-tg-bg-pattern">
        <div className="w-12 h-12 border-3 border-tg-border border-t-tg-accent rounded-full animate-spin"></div>
        <div className="text-tg-text-secondary text-[15px]">
          {loadingProgress}
        </div>
      </div>
    );
  }

  // Upload state
  if (!chatData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-tg-bg-pattern">
        <div className="text-6xl mb-6">💬</div>
        <h1 className="text-2xl font-semibold mb-3 text-tg-text-primary">
          Telegram Chat Viewer
        </h1>
        <p className="text-[15px] text-tg-text-secondary mb-8 max-w-[400px] leading-relaxed">
          Select your Telegram export folder to view your chat history. The
          folder should contain messages.html files and any exported media.
        </p>
        <button
          className="bg-tg-accent text-white border-none px-8 py-3.5 rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 hover:bg-violet-500 hover:-translate-y-0.5"
          onClick={() => fileInputRef.current?.click()}>
          Select Export Folder
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          // @ts-expect-error - webkitdirectory is not in standard types
          webkitdirectory="true"
          directory="true"
          multiple
          onChange={handleFolderSelect}
        />
      </div>
    );
  }

  // Message direction logic:
  // The chat name (page_header) is the contact's name
  // Messages where from matches chat name = incoming (from contact)
  // Messages where from does NOT match chat name = outgoing (from me)
  const chatContactName = chatData.name;

  // Get messages to display (start from beginning, load more on scroll down)
  const displayedMessages = chatData.messages.slice(0, displayedCount);

  // Track last date for date separators
  let lastDate: string | null = null;

  return (
    <div className="flex flex-col h-screen mx-auto bg-tg-bg-pattern shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      <ChatHeader name={chatData.name} status="last seen recently" />

      {/* Sticky date at top */}
      {currentStickyDate && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20">
          <span className="bg-tg-accent/85 backdrop-blur-sm px-3.5 py-1 rounded-2xl text-[13px] font-medium text-white shadow-lg">
            {formatDate(currentStickyDate)}
          </span>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 relative"
        ref={messagesAreaRef}>
        {displayedMessages.map((message, index) => {
          // Direction logic
          const isFromContact = message.from === chatContactName;
          const isOutgoing = !isFromContact && message.from !== "";

          // Service messages are dates
          if (message.type === "service") {
            return (
              <DateSeparator
                key={message.id || `service-${index}`}
                date={message.text || ""}
              />
            );
          }

          // Show avatar only for first message in a group from same sender
          const prevMessage = index > 0 ? displayedMessages[index - 1] : null;
          const showAvatar =
            !isOutgoing &&
            (!prevMessage ||
              prevMessage.from !== message.from ||
              prevMessage.type === "service");

          // Check for date change to show separator
          let showDateSeparator = false;
          if (message.date && message.date !== lastDate) {
            showDateSeparator = true;
            lastDate = message.date;
          }

          return (
            <div
              key={message.id || index}
              ref={(el) => {
                if (el && message.date) {
                  messageRefs.current.set(index, {
                    element: el,
                    date: message.date,
                  });
                }
              }}>
              {showDateSeparator && message.date && (
                <DateSeparator date={formatDate(message.date)} />
              )}
              <MessageBubble
                message={message}
                isOutgoing={isOutgoing}
                showAvatar={showAvatar}
              />
            </div>
          );
        })}

        {/* Load more indicator at bottom */}
        {displayedCount < chatData.messages.length && (
          <div className="flex justify-center py-4">
            {loadingMore ? (
              <div className="w-6 h-6 border-2 border-tg-border border-t-tg-accent rounded-full animate-spin"></div>
            ) : (
              <span className="text-tg-text-secondary text-[13px]">
                Scroll down for more messages
              </span>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <MessageInput />
    </div>
  );
}
