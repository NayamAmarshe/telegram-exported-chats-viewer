import { useRef, useCallback, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { Loader2 } from "lucide-react";
import type { ParsedMessage } from "../lib/file-handler";
import { parseHTML } from "../lib/file-handler";
import { parseMessage } from "../lib/parser";
import {
  chatDataAtom,
  loadingAtom,
  loadingProgressAtom,
  scrollToMessageIdAtom,
  searchOpenAtom,
  recentFoldersAtom,
  type RecentFolder,
} from "../lib/atoms";
import ChatHeader from "./chat-header";
import MessageBubble from "./message-bubble";
import MessageInput from "./message-input";
import SearchPanel from "./search-panel";
import RecentFolders from "./recent-folders";

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
  const [scrollToMessageId, setScrollToMessageId] = useAtom(
    scrollToMessageIdAtom
  );
  const [searchOpen] = useAtom(searchOpenAtom);
  const [recentFolders, setRecentFolders] = useAtom(recentFoldersAtom);
  const [displayedCount, setDisplayedCount] = useState(MESSAGES_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [navigatingToMessage, setNavigatingToMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const dateMarkersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Load recent folders from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("recentFolders");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RecentFolder[];
        setRecentFolders(parsed);
      } catch (e) {
        console.error("Failed to parse recent folders:", e);
      }
    }
  }, [setRecentFolders]);

  // Track which date is visible using scroll position
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

    // Find which date marker is at or above the top of the scroll area
    const containerTop = messagesAreaRef.current.getBoundingClientRect().top;
    let currentVisibleDate: string | null = null;

    for (const [date, element] of dateMarkersRef.current) {
      const rect = element.getBoundingClientRect();
      // If the marker is at or above the container top, this is our current date
      if (rect.top <= containerTop + 20) {
        currentVisibleDate = date;
      }
    }

    if (currentVisibleDate !== currentDate) {
      setCurrentDate(currentVisibleDate);
    }
  }, [chatData, displayedCount, loadingMore, currentDate]);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (area) {
      area.addEventListener("scroll", handleScroll);
      return () => area.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // Handle scroll to message from search
  // Handle scroll to message from search with chunked loading
  useEffect(() => {
    if (!scrollToMessageId || !chatData) return;

    // Find the message index
    const messageIndex = chatData.messages.findIndex(
      (m) => m.id === scrollToMessageId
    );
    if (messageIndex === -1) return;

    // If message is far ahead, load in chunks to prevent freeze
    if (messageIndex >= displayedCount) {
      setNavigatingToMessage(true);

      // Load larger chunk if we're far behind
      const chunkSize = 500;
      const nextCount = Math.min(
        displayedCount + chunkSize,
        chatData.messages.length
      );

      // Update count and let render happen
      setDisplayedCount(nextCount);
      return;
    }

    // Message is now loaded (or was already loaded)
    setNavigatingToMessage(false);

    // Wait for render then scroll
    setTimeout(() => {
      const element = messageRefsMap.current.get(scrollToMessageId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Highlight the message temporarily
        setHighlightedMessageId(scrollToMessageId);
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }
      setScrollToMessageId(null);
    }, 100);
  }, [scrollToMessageId, chatData, displayedCount, setScrollToMessageId]);

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

        // Extract folder name from path
        const firstFile = htmlFiles[0];
        const pathParts = firstFile.webkitRelativePath.split("/");
        const folderName = pathParts[pathParts.length - 2] || "Unknown Folder";

        // Save to recent folders
        const newFolder: RecentFolder = {
          folderName,
          chatName,
          timestamp: Date.now(),
          messageCount: processedMessages.length,
        };

        const updatedRecent = [newFolder, ...recentFolders].slice(0, 10); // Keep only last 10

        setRecentFolders(updatedRecent);
        localStorage.setItem("recentFolders", JSON.stringify(updatedRecent));

        // Reset pagination and date refs
        setDisplayedCount(MESSAGES_PER_PAGE);
        dateMarkersRef.current.clear();
        setCurrentDate(null);
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

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
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
      <div className="flex flex-col items-center justify-center mx-auto h-screen p-8 text-center">
        <div className="text-6xl mb-6">💬</div>
        <h1 className="text-2xl font-semibold mb-3 text-tg-text-primary">
          Telegram Chat Viewer
        </h1>
        <p className="text-[15px] text-tg-text-secondary mb-8 max-w-[400px] leading-relaxed">
          Select your Telegram export folder to view your chat history. The
          folder should contain messages.html files and any exported media.
        </p>
        <button
          className="bg-tg-accent text-white border-none px-8 py-3.5 rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 hover:bg-violet-500 hover:translate-y-0.5"
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
        <RecentFolders onFolderClick={() => fileInputRef.current?.click()} />
      </div>
    );
  }

  // Message direction logic
  const chatContactName = chatData.name;

  // Get messages to display (start from beginning, load more on scroll down)
  const displayedMessages = chatData.messages.slice(0, displayedCount);

  return (
    <div className="flex flex-col h-screen relative">
      <ChatHeader name={chatData.name} status="last seen recently" />
      {searchOpen && <SearchPanel />}

      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 relative"
        ref={messagesAreaRef}>
        {/* Single sticky date badge - positioned inside scroll container */}
        {currentDate && (
          <div className="sticky top-0 z-20 flex justify-center py-2 pointer-events-none">
            <span className="bg-black/50 px-3.5 py-1 rounded-2xl text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm">
              {currentDate}
            </span>
          </div>
        )}

        {/* Loading overlay when navigating to far message */}
        {navigatingToMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none">
            <div className="bg-black/80 px-4 py-3 rounded-xl flex items-center gap-3 text-white shadow-2xl">
              <Loader2 className="animate-spin text-tg-accent" size={24} />
              <div className="flex flex-col">
                <span className="font-medium">Locating message...</span>
                <span className="text-xs text-tg-text-secondary">
                  Loading history
                </span>
              </div>
            </div>
          </div>
        )}
        {displayedMessages.map((message, index) => {
          // Direction logic
          const isFromContact = message.from === chatContactName;
          const isOutgoing = !isFromContact && message.from !== "";

          // Service messages are date markers (invisible, used for tracking)
          if (message.type === "service") {
            const dateText = message.text || "";
            return (
              <div
                key={message.id || `service-${index}`}
                ref={(el) => {
                  if (el && dateText) {
                    dateMarkersRef.current.set(dateText, el);
                  }
                }}
                className="flex justify-center py-2">
                {/* Only show inline date when it's NOT the current sticky date */}
                {dateText !== currentDate && (
                  <span className="bg-black/50 px-3.5 py-1 rounded-2xl text-[13px] font-medium text-white/90 shadow-lg">
                    {dateText}
                  </span>
                )}
              </div>
            );
          }

          // Show avatar only for first message in a group from same sender
          const prevMessage = index > 0 ? displayedMessages[index - 1] : null;
          const showAvatar =
            !isOutgoing &&
            (!prevMessage ||
              prevMessage.from !== message.from ||
              prevMessage.type === "service");

          return (
            <div
              key={message.id || index}
              ref={(el) => {
                if (el && message.id) {
                  messageRefsMap.current.set(message.id, el);
                }
              }}
              className={
                highlightedMessageId === message.id
                  ? "animate-pulse bg-tg-accent/20 rounded-lg"
                  : ""
              }>
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
