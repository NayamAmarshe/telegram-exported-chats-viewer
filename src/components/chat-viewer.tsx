import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { Link } from "@tanstack/react-router";
import { GithubIcon, Loader2 } from "lucide-react";
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
const INITIAL_WINDOW_SIZE = 160;
const WINDOW_STEP_SIZE = 80;
const MAX_WINDOW_SIZE = 320;
const JUMP_WINDOW_SIZE = 200;
const WINDOW_EDGE_THRESHOLD_PX = 800;
const DEFAULT_MESSAGE_HEIGHT = 88;
const DEFAULT_SERVICE_HEIGHT = 40;

interface DateNavigationData {
  dates: string[];
  dateLabelByIso: Map<string, string>;
  dateByServiceIndex: Map<number, string>;
  serviceIndexByDate: Map<string, number>;
  targetMessageIdByDate: Map<string, string>;
}

interface MessageWindowRange {
  start: number;
  end: number;
}

interface PendingNavigation {
  type: "message" | "date";
  targetMessageId: string;
  targetDate?: string;
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildDateNavigationData(messages: ParsedMessage[]): DateNavigationData {
  const dates: string[] = [];
  const dateLabelByIso = new Map<string, string>();
  const dateByServiceIndex = new Map<number, string>();
  const serviceIndexByDate = new Map<string, number>();
  const targetMessageIdByDate = new Map<string, string>();
  let pendingService: { index: number; label: string } | null = null;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message.type === "service") {
      const label = message.text?.trim();
      if (label) {
        pendingService = { index, label };
      }
      continue;
    }

    if (!message.date || dateLabelByIso.has(message.date)) {
      continue;
    }

    dates.push(message.date);
    targetMessageIdByDate.set(message.date, message.id);

    if (pendingService) {
      dateLabelByIso.set(message.date, pendingService.label);
      dateByServiceIndex.set(pendingService.index, message.date);
      serviceIndexByDate.set(message.date, pendingService.index);
      pendingService = null;
      continue;
    }

    dateLabelByIso.set(message.date, formatDateLabel(message.date));
  }

  return {
    dates,
    dateLabelByIso,
    dateByServiceIndex,
    serviceIndexByDate,
    targetMessageIdByDate,
  };
}

function resolveDateTarget(selectedDate: string, availableDates: string[]) {
  for (const availableDate of availableDates) {
    if (availableDate >= selectedDate) {
      return availableDate;
    }
  }

  return availableDates.at(-1) ?? null;
}

function getTelegramMessagesFileOrder(fileName: string): number {
  if (fileName === "messages.html") {
    return 1;
  }

  const match = fileName.match(/^messages(\d+)\.html$/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[1]);
}

function getInitialWindowRange(totalMessages: number): MessageWindowRange {
  return {
    start: 0,
    end: Math.min(INITIAL_WINDOW_SIZE, totalMessages),
  };
}

function getWindowRangeAroundIndex(
  targetIndex: number,
  totalMessages: number,
): MessageWindowRange {
  const clampedStart = Math.max(
    0,
    Math.min(
      targetIndex - Math.floor(JUMP_WINDOW_SIZE / 2),
      Math.max(0, totalMessages - JUMP_WINDOW_SIZE),
    ),
  );

  return {
    start: clampedStart,
    end: Math.min(totalMessages, clampedStart + JUMP_WINDOW_SIZE),
  };
}

function estimateMessageHeight(message: ParsedMessage): number {
  if (message.type === "service") {
    return DEFAULT_SERVICE_HEIGHT;
  }

  let estimatedHeight = DEFAULT_MESSAGE_HEIGHT;

  if (message.replyTo) {
    estimatedHeight += 44;
  }

  if (message.text) {
    estimatedHeight += Math.min(
      140,
      Math.ceil(message.text.length / 42) * 18,
    );
  }

  if (message.media && message.media.length > 0) {
    estimatedHeight += 180;
  }

  return estimatedHeight;
}

function estimateRangeHeight(
  messages: ParsedMessage[],
  start: number,
  end: number,
  measuredHeights: Map<number, number>,
): number {
  let totalHeight = 0;

  for (let index = start; index < end; index += 1) {
    totalHeight +=
      measuredHeights.get(index) ?? estimateMessageHeight(messages[index]);
  }

  return totalHeight;
}

function findFirstDateInRange(
  messages: ParsedMessage[],
  start: number,
  end: number,
): string | null {
  for (let index = start; index < end; index += 1) {
    const message = messages[index];
    if (message.type === "message" && message.date) {
      return message.date;
    }
  }

  return null;
}

// Process messages to inherit "from" for joined messages
function processMessagesWithInheritance(
  messages: ParsedMessage[],
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

function getPreferredSenderKey(message: ParsedMessage): string | null {
  if (message.type === "service") return null;

  if (message.userpicClass && message.initials) {
    return `${message.userpicClass}:${message.initials}`;
  }

  if (message.from) {
    return message.from.trim().toLowerCase();
  }

  return null;
}

function getSenderClassKey(message: ParsedMessage): string | null {
  if (message.type === "service") return null;
  return message.userpicClass ?? null;
}

export default function ChatViewer() {
  const [chatData, setChatData] = useAtom(chatDataAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [loadingProgress, setLoadingProgress] = useAtom(loadingProgressAtom);
  const [scrollToMessageId, setScrollToMessageId] = useAtom(
    scrollToMessageIdAtom,
  );
  const [searchOpen] = useAtom(searchOpenAtom);
  const [recentFolders, setRecentFolders] = useAtom(recentFoldersAtom);
  const totalMessages = chatData?.messages.length ?? 0;
  const [windowRange, setWindowRange] = useState<MessageWindowRange>(() =>
    getInitialWindowRange(totalMessages),
  );
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [scrollToDate, setScrollToDate] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [navigatingToMessage, setNavigatingToMessage] = useState(false);
  const [navigatingToDate, setNavigatingToDate] = useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const [measuredHeightsVersion, setMeasuredHeightsVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const dateMarkersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());
  const rowObserversRef = useRef<Map<number, ResizeObserver>>(new Map());
  const dateNavigation = useMemo(
    () => buildDateNavigationData(chatData?.messages ?? []),
    [chatData],
  );
  const visibleMessages = useMemo(
    () =>
      chatData ? chatData.messages.slice(windowRange.start, windowRange.end) : [],
    [chatData, windowRange.end, windowRange.start],
  );
  const chatContactSenderKeys = useMemo(() => {
    if (!chatData) {
      return new Set<string>();
    }

    const keys = new Set<string>();
    for (const message of chatData.messages) {
      if (message.type !== "message") continue;
      if (message.from !== chatData.name) continue;

      const senderKey = getPreferredSenderKey(message);
      if (senderKey) {
        keys.add(senderKey);
      }
    }

    return keys;
  }, [chatData]);
  const chatContactSenderClassKeys = useMemo(() => {
    if (!chatData) {
      return new Set<string>();
    }

    const keys = new Set<string>();
    for (const message of chatData.messages) {
      if (message.type !== "message") continue;
      if (message.from !== chatData.name) continue;

      const senderClassKey = getSenderClassKey(message);
      if (senderClassKey) {
        keys.add(senderClassKey);
      }
    }

    return keys;
  }, [chatData]);
  const topSpacerHeight = useMemo(
    () =>
      chatData
        ? estimateRangeHeight(
            chatData.messages,
            0,
            windowRange.start,
            measuredHeightsRef.current,
          )
        : 0,
    [chatData, measuredHeightsVersion, windowRange.start],
  );
  const bottomSpacerHeight = useMemo(
    () =>
      chatData
        ? estimateRangeHeight(
            chatData.messages,
            windowRange.end,
            chatData.messages.length,
            measuredHeightsRef.current,
          )
        : 0,
    [chatData, measuredHeightsVersion, windowRange.end],
  );

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

  useEffect(() => {
    return () => {
      rowObserversRef.current.forEach((observer) => observer.disconnect());
      rowObserversRef.current.clear();
    };
  }, []);

  const recordRowHeight = useCallback((index: number, element: HTMLDivElement) => {
    const nextHeight = element.offsetHeight;
    const previousHeight = measuredHeightsRef.current.get(index);

    if (previousHeight !== nextHeight) {
      measuredHeightsRef.current.set(index, nextHeight);
      setMeasuredHeightsVersion((previous) => previous + 1);
    }
  }, []);

  const bindRowRef = useCallback(
    (index: number, messageId?: string, markerDate?: string) =>
      (element: HTMLDivElement | null) => {
        const existingObserver = rowObserversRef.current.get(index);
        if (existingObserver) {
          existingObserver.disconnect();
          rowObserversRef.current.delete(index);
        }

        if (messageId) {
          if (element) {
            messageRefsMap.current.set(messageId, element);
          } else {
            messageRefsMap.current.delete(messageId);
          }
        }

        if (markerDate) {
          if (element) {
            dateMarkersRef.current.set(markerDate, element);
          } else {
            dateMarkersRef.current.delete(markerDate);
          }
        }

        if (!element) {
          return;
        }

        recordRowHeight(index, element);

        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(() => {
            recordRowHeight(index, element);
          });
          observer.observe(element);
          rowObserversRef.current.set(index, observer);
        }
      },
    [recordRowHeight],
  );

  const updateCurrentDateFromViewport = useCallback(() => {
    if (!messagesAreaRef.current || !chatData) return;

    const containerTop = messagesAreaRef.current.getBoundingClientRect().top;
    let currentVisibleDate: string | null = null;

    for (const [date, element] of dateMarkersRef.current) {
      const rect = element.getBoundingClientRect();
      if (rect.top <= containerTop + 20) {
        currentVisibleDate = date;
      }
    }

    if (!currentVisibleDate) {
      currentVisibleDate = findFirstDateInRange(
        chatData.messages,
        windowRange.start,
        windowRange.end,
      );
    }

    if (currentVisibleDate !== currentDate) {
      setCurrentDate(currentVisibleDate);
    }
  }, [chatData, currentDate, windowRange.end, windowRange.start]);

  const maybeShiftWindow = useCallback(() => {
    if (!messagesAreaRef.current || !chatData || pendingNavigation) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    const renderedTopOffset = scrollTop - topSpacerHeight;
    const renderedBottomOffset =
      scrollHeight - bottomSpacerHeight - (scrollTop + clientHeight);

    if (renderedTopOffset < WINDOW_EDGE_THRESHOLD_PX && windowRange.start > 0) {
      const nextStart = Math.max(0, windowRange.start - WINDOW_STEP_SIZE);
      const nextEnd = Math.min(
        chatData.messages.length,
        Math.max(windowRange.end, nextStart + MAX_WINDOW_SIZE),
      );

      if (nextStart !== windowRange.start || nextEnd !== windowRange.end) {
        setWindowRange({ start: nextStart, end: nextEnd });
        return;
      }
    }

    if (
      renderedBottomOffset < WINDOW_EDGE_THRESHOLD_PX &&
      windowRange.end < chatData.messages.length
    ) {
      const nextEnd = Math.min(
        chatData.messages.length,
        windowRange.end + WINDOW_STEP_SIZE,
      );
      const nextStart = Math.max(0, nextEnd - MAX_WINDOW_SIZE);

      if (nextStart !== windowRange.start || nextEnd !== windowRange.end) {
        setWindowRange({ start: nextStart, end: nextEnd });
      }
    }
  }, [
    bottomSpacerHeight,
    chatData,
    pendingNavigation,
    topSpacerHeight,
    windowRange.end,
    windowRange.start,
  ]);

  const handleScroll = useCallback(() => {
    maybeShiftWindow();
    updateCurrentDateFromViewport();
  }, [maybeShiftWindow, updateCurrentDateFromViewport]);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (area) {
      area.addEventListener("scroll", handleScroll);
      return () => area.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    updateCurrentDateFromViewport();
  }, [updateCurrentDateFromViewport, visibleMessages.length, windowRange]);

  useEffect(() => {
    if (!scrollToMessageId || !chatData) return;

    const messageIndex = chatData.messages.findIndex((m) => m.id === scrollToMessageId);
    if (messageIndex === -1) {
      setScrollToMessageId(null);
      return;
    }

    setNavigatingToMessage(true);
    setPendingNavigation({
      type: "message",
      targetMessageId: scrollToMessageId,
    });
    setWindowRange(getWindowRangeAroundIndex(messageIndex, chatData.messages.length));
  }, [chatData, scrollToMessageId, setScrollToMessageId]);

  useEffect(() => {
    if (!scrollToDate || !chatData) return;

    const targetMessageId = dateNavigation.targetMessageIdByDate.get(scrollToDate);
    if (!targetMessageId) {
      setScrollToDate(null);
      return;
    }

    const messageIndex = chatData.messages.findIndex((m) => m.id === targetMessageId);
    if (messageIndex === -1) {
      setScrollToDate(null);
      return;
    }

    const targetIndex =
      dateNavigation.serviceIndexByDate.get(scrollToDate) ?? messageIndex;

    setNavigatingToDate(true);
    setPendingNavigation({
      type: "date",
      targetMessageId,
      targetDate: scrollToDate,
    });
    setWindowRange(getWindowRangeAroundIndex(targetIndex, chatData.messages.length));
  }, [chatData, dateNavigation.serviceIndexByDate, dateNavigation.targetMessageIdByDate, scrollToDate]);

  useEffect(() => {
    if (!pendingNavigation) return;

    const timer = window.setTimeout(() => {
      const messageElement = messageRefsMap.current.get(
        pendingNavigation.targetMessageId,
      );
      const dateElement = pendingNavigation.targetDate
        ? dateMarkersRef.current.get(pendingNavigation.targetDate)
        : null;
      const targetElement =
        pendingNavigation.type === "date"
          ? dateElement ?? messageElement
          : messageElement;

      if (!targetElement) {
        return;
      }

      targetElement.scrollIntoView({
        behavior: "smooth",
        block: pendingNavigation.type === "date" ? "start" : "center",
      });

      if (pendingNavigation.type === "message") {
        setHighlightedMessageId(pendingNavigation.targetMessageId);
        window.setTimeout(() => setHighlightedMessageId(null), 2000);
        setScrollToMessageId(null);
        setNavigatingToMessage(false);
      } else {
        if (pendingNavigation.targetDate) {
          setCurrentDate(pendingNavigation.targetDate);
        }
        setScrollToDate(null);
        setNavigatingToDate(false);
      }

      setPendingNavigation(null);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pendingNavigation, setScrollToMessageId]);

  const handleDatePillClick = useCallback(() => {
    const input = dateInputRef.current;
    if (!input || dateNavigation.dates.length === 0) return;

    input.value = currentDate ?? dateNavigation.dates[0];

    if ("showPicker" in input && typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  }, [currentDate, dateNavigation.dates]);

  const handleDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedDate = event.target.value;
      if (!selectedDate) return;

      const targetDate = resolveDateTarget(selectedDate, dateNavigation.dates);
      if (!targetDate) return;

      setScrollToDate(targetDate);
    },
    [dateNavigation.dates],
  );

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
          (f) => f.name.endsWith(".html") && f.name.startsWith("messages"),
        );
        htmlFiles.sort(
          (a, b) =>
            getTelegramMessagesFileOrder(a.name) -
            getTelegramMessagesFileOrder(b.name),
        );

        if (htmlFiles.length === 0) {
          alert(
            "No message HTML files found. Please select a Telegram export folder containing messages.html files.",
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
            `Parsing ${file.name} (${i + 1}/${htmlFiles.length})...`,
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

        // Reset buffered window and refs
        setWindowRange(getInitialWindowRange(processedMessages.length));
        dateMarkersRef.current.clear();
        messageRefsMap.current.clear();
        measuredHeightsRef.current.clear();
        rowObserversRef.current.forEach((observer) => observer.disconnect());
        rowObserversRef.current.clear();
        setMeasuredHeightsVersion(0);
        setCurrentDate(null);
        setScrollToDate(null);
        setScrollToMessageId(null);
        setPendingNavigation(null);
        setNavigatingToMessage(false);
        setNavigatingToDate(false);
        setLoading(false);
      } catch (error) {
        console.error("Error parsing chat:", error);
        alert(
          "Error parsing chat files. Please check the console for details.",
        );
        setLoading(false);
      }
    },
    [setChatData, setLoading, setLoadingProgress],
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
                Telegram
              </span>
            </div>
            <p className="text-xs text-tg-text-secondary pl-11">
              Exported Chats Viewer
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

          {/* Tools section — pinned at bottom of sidebar */}
          <div className="border-t border-tg-border p-4 shrink-0">
            <h3 className="text-xs font-semibold text-tg-text-secondary uppercase tracking-wider mb-3 px-2">
              Tools
            </h3>
            <Link
              to="/tools/markdown"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-tg-text-secondary hover:text-white hover:bg-tg-accent/10 transition-all duration-150 group">
              <span className="text-lg leading-none">✏️</span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-tg-text-primary group-hover:text-white transition-colors truncate">
                  Markdown Converter
                </div>
                <div className="text-[11px] text-tg-text-secondary truncate">
                  Convert to Telegram format
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Main Content - Hero */}
        <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-12">
          <div className="max-w-2xl w-full text-center space-y-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-purple-500 blur-2xl opacity-20" />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-linear-to-b from-white to-white/60 relative pb-2">
                Your Chats.
                <br />
                Reimagined.
              </h1>
            </div>

            <p className="text-lg md:text-xl text-tg-text-secondary max-w-lg mx-auto leading-relaxed">
              Experience your Telegram history in a beautiful, modern interface.{" "}
              <a
                className="underline cursor-pointer hover:text-white/80 inline-flex items-center gap-2 transition-colors"
                href="https://github.com/NayamAmarshe/telegram-exported-chats-viewer"
                target="_blank"
                rel="noopener noreferrer">
                <GithubIcon className="size-5" />
                Free & Open Source
              </a>
              , fast, and everything stays on your device.
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
                Supports standard HTML export format
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

  return (
    <div className="flex flex-col h-screen relative">
      <ChatHeader name={chatData.name} status="last seen recently" />
      {searchOpen && <SearchPanel />}

      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col relative"
        ref={messagesAreaRef}>
        {/* Single sticky date badge - positioned inside scroll container */}
        {currentDate && (
          <div className="sticky top-0 z-20 flex justify-center py-2">
            <button
              type="button"
              onClick={handleDatePillClick}
              className="bg-black/50 px-3.5 py-1 rounded-2xl text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm cursor-pointer transition-colors hover:bg-black/60 active:bg-black/70">
              {dateNavigation.dateLabelByIso.get(currentDate) ?? currentDate}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              tabIndex={-1}
              min={dateNavigation.dates[0]}
              max={dateNavigation.dates.at(-1)}
              className="absolute opacity-0 pointer-events-none w-px h-px"
              onChange={handleDateChange}
            />
          </div>
        )}

        {topSpacerHeight > 0 && (
          <div
            aria-hidden="true"
            style={{ height: `${topSpacerHeight}px` }}
            className="shrink-0"
          />
        )}

        {/* Loading overlay when navigating to far message */}
        {(navigatingToMessage || navigatingToDate) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none">
            <div className="bg-black/80 px-4 py-3 rounded-xl flex items-center gap-3 text-white shadow-2xl">
              <Loader2 className="animate-spin text-tg-accent" size={24} />
              <div className="flex flex-col">
                <span className="font-medium">
                  {navigatingToDate ? "Jumping to date..." : "Locating message..."}
                </span>
                <span className="text-xs text-tg-text-secondary">
                  Loading history
                </span>
              </div>
            </div>
          </div>
        )}

        {visibleMessages.map((message, offset) => {
          const index = windowRange.start + offset;
          // Direction logic
          const senderKey = getPreferredSenderKey(message);
          const senderClassKey = getSenderClassKey(message);
          const isFromContact =
            message.from === chatContactName ||
            (senderKey ? chatContactSenderKeys.has(senderKey) : false) ||
            (senderClassKey
              ? chatContactSenderClassKeys.has(senderClassKey)
              : false);
          const isOutgoing = !isFromContact && message.from !== "";

          // Service messages are date markers (invisible, used for tracking)
          if (message.type === "service") {
            const markerDate = dateNavigation.dateByServiceIndex.get(index);
            const dateText =
              (markerDate && dateNavigation.dateLabelByIso.get(markerDate)) ||
              message.text ||
              "";

            return (
              <div
                key={message.id || `service-${index}`}
                ref={bindRowRef(index, undefined, markerDate)}
                className="flex justify-center py-2">
                {/* Only show inline date when it's NOT the current sticky date */}
                {markerDate !== currentDate && (
                  <span className="bg-black/50 px-3.5 py-1 rounded-2xl text-[13px] font-medium text-white/90 shadow-lg">
                    {dateText}
                  </span>
                )}
              </div>
            );
          }

          // Show avatar only for first message in a group from same sender
          const prevMessage =
            index > 0 ? chatData.messages[index - 1] : null;
          const showAvatar =
            !isOutgoing &&
            (!prevMessage ||
              prevMessage.from !== message.from ||
              prevMessage.type === "service");

          return (
            <div
              key={message.id || index}
              ref={bindRowRef(index, message.id)}
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

        {bottomSpacerHeight > 0 && (
          <div
            aria-hidden="true"
            style={{ height: `${bottomSpacerHeight}px` }}
            className="shrink-0"
          />
        )}
      </div>

      <MessageInput />
    </div>
  );
}
