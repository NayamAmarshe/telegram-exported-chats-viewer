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
      <div className="flex h-screen w-full bg-black text-tg-text-primary overflow-hidden relative">
        {/* Dynamic Background Pattern */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('/dark-pattern.svg')] opacity-[0.03]" />
          {/* Subtle gradients using theme accent colors */}
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-tg-accent/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full mix-blend-screen" />
        </div>

        {/* Sidebar - Recent History */}
        <div className="w-[320px] h-full border-r border-tg-border bg-tg-header-bg/50 backdrop-blur-xl relative z-10 flex flex-col hidden md:flex">
          <div className="p-6 border-b border-tg-border">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 text-white"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path
                    d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="font-bold text-lg tracking-tight text-white">
                Viewer
              </span>
            </div>
            <p className="text-xs text-tg-text-secondary pl-11">
              Telegram Archive
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <h3 className="text-xs font-semibold text-tg-text-secondary uppercase tracking-wider mb-4 px-2">
              Recent History
            </h3>
            <RecentFolders
              variant="sidebar"
              onFolderClick={() => fileInputRef.current?.click()}
            />
          </div>

          <div className="p-4 border-t border-tg-border bg-black/20">
            <div className="flex items-center gap-3 text-xs text-tg-text-secondary">
              <div className="w-2 h-2 rounded-full bg-green-500/50 animate-pulse" />
              <span>System Ready</span>
            </div>
          </div>
        </div>

        {/* Main Content - Hero */}
        <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-12">
          <div className="max-w-2xl w-full text-center space-y-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-purple-500 blur-[40px] opacity-20" />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-linear-to-b from-white to-white/60 relative">
                Your Chats.
                <br />
                Reimagined.
              </h1>
            </div>

            <p className="text-lg md:text-xl text-tg-text-secondary max-w-lg mx-auto leading-relaxed">
              Experience your Telegram history in a beautiful, modern interface.
              Fast, secure, and entirely local.
            </p>

            <div className="pt-8 flex flex-col items-center gap-4">
              <button
                className="group relative px-8 py-4 bg-white text-black rounded-2xl font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] overflow-hidden cursor-pointer"
                onClick={() => fileInputRef.current?.click()}>
                <div className="absolute inset-0 bg-linear-to-r from-indigo-200 via-purple-200 to-indigo-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <span className="relative flex items-center gap-3">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Select Export Folder
                </span>
              </button>

              <p className="text-sm text-tg-text-secondary/70">
                Supports standard export format
              </p>
            </div>
            {/* Mobile-only recent folders */}
            <div className="md:hidden w-full mt-12 pt-8 border-t border-tg-border">
              <RecentFolders
                onFolderClick={() => fileInputRef.current?.click()}
              />
            </div>
          </div>
        </div>

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
