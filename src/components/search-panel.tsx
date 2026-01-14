import { useState, useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  searchQueryAtom,
  searchOpenAtom,
  scrollToMessageIdAtom,
  chatDataAtom,
} from "../lib/atoms";
import type { ParsedMessage } from "../lib/file-handler";

interface SearchResult {
  message: ParsedMessage;
  matchIndex: number;
}

// Chunk size for async processing
const CHUNK_SIZE = 500;

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchPanel() {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [isOpen, setIsOpen] = useAtom(searchOpenAtom);
  const setScrollToMessageId = useSetAtom(scrollToMessageIdAtom);
  const chatData = useAtomValue(chatDataAtom);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [inputValue, setInputValue] = useState(searchQuery);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [displayedResultsCount, setDisplayedResultsCount] = useState(50);
  const abortRef = useRef<boolean>(false);
  const resultsListRef = useRef<HTMLDivElement>(null);

  // Debounce search query for performance
  const debouncedQuery = useDebounce(inputValue, 300);

  // Sync debounced value to atom
  useEffect(() => {
    setSearchQuery(debouncedQuery);
  }, [debouncedQuery, setSearchQuery]);

  // Async chunked search - runs in background without freezing UI
  useEffect(() => {
    if (!chatData || !debouncedQuery.trim() || debouncedQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Abort any previous search
    abortRef.current = true;

    const query = debouncedQuery.toLowerCase();
    const messages = chatData.messages;
    const results: SearchResult[] = [];

    setIsSearching(true);
    setSearchProgress(0);
    setSearchResults([]);
    setDisplayedResultsCount(50); // Reset when new search starts

    // Start new search
    abortRef.current = false;

    const processChunk = (startIndex: number) => {
      if (abortRef.current) return;

      const endIndex = Math.min(startIndex + CHUNK_SIZE, messages.length);

      for (let i = startIndex; i < endIndex; i++) {
        const message = messages[i];
        if (message.type === "service") continue;
        if (message.text?.toLowerCase().includes(query)) {
          results.push({ message, matchIndex: i });
        }
      }

      // Update progress
      const progress = Math.round((endIndex / messages.length) * 100);
      setSearchProgress(progress);

      // Update results incrementally (every few chunks)
      if (endIndex % (CHUNK_SIZE * 3) === 0 || endIndex >= messages.length) {
        setSearchResults([...results]);
      }

      if (endIndex < messages.length) {
        // Use setTimeout to yield to UI
        setTimeout(() => processChunk(endIndex), 0);
      } else {
        // Done
        setSearchResults([...results]);
        setIsSearching(false);
      }
    };

    // Start processing
    setTimeout(() => processChunk(0), 0);

    return () => {
      abortRef.current = true;
    };
  }, [chatData, debouncedQuery]);

  // Navigate to a specific result
  const goToResult = useCallback(
    (result: SearchResult) => {
      if (result.message.id) {
        setScrollToMessageId(result.message.id);
      }
    },
    [setScrollToMessageId]
  );

  // Navigate between results
  const goToNextResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
    goToResult(searchResults[nextIndex]);
  }, [searchResults, currentResultIndex, goToResult]);

  const goToPrevResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex =
      currentResultIndex === 0
        ? searchResults.length - 1
        : currentResultIndex - 1;
    setCurrentResultIndex(prevIndex);
    goToResult(searchResults[prevIndex]);
  }, [searchResults, currentResultIndex, goToResult]);

  // Format date for display
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Highlight search term in text
  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
      return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-tg-accent/50 text-white px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-tg-text-secondary hover:text-white transition-colors"
        title="Search messages">
        <Search size={20} />
      </button>
    );
  }

  return (
    <div className="flex flex-col bg-tg-header-bg border-b border-tg-border">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Search size={20} className="text-tg-text-secondary shrink-0" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setCurrentResultIndex(0);
          }}
          placeholder="Search messages..."
          className="flex-1 bg-transparent border-none outline-none text-white text-[15px] placeholder:text-tg-text-secondary"
          autoFocus
        />
        {isSearching ? (
          <span className="text-tg-text-secondary text-sm flex items-center gap-1">
            <Loader2 size={14} className="animate-spin" />
            {searchProgress}%
          </span>
        ) : searchResults.length > 0 ? (
          <span className="text-tg-text-secondary text-sm">
            {currentResultIndex + 1} / {searchResults.length}
          </span>
        ) : null}
        <button
          onClick={goToPrevResult}
          className="p-1 text-tg-text-secondary hover:text-white"
          title="Previous">
          <ChevronUp size={20} />
        </button>
        <button
          onClick={goToNextResult}
          className="p-1 text-tg-text-secondary hover:text-white"
          title="Next">
          <ChevronDown size={20} />
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            setInputValue("");
            setSearchQuery("");
          }}
          className="p-1 text-tg-text-secondary hover:text-white"
          title="Close">
          <X size={20} />
        </button>
      </div>

      {/* Search results */}
      {inputValue.length >= 2 && (
        <div
          ref={resultsListRef}
          className="max-h-[400px] overflow-y-auto"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const { scrollTop, scrollHeight, clientHeight } = target;
            // Load more when near bottom
            if (
              scrollHeight - scrollTop - clientHeight < 100 &&
              displayedResultsCount < searchResults.length
            ) {
              setDisplayedResultsCount((prev) =>
                Math.min(prev + 50, searchResults.length)
              );
            }
          }}>
          {isSearching && searchResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-tg-text-secondary flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin" />
              Searching... {searchProgress}%
            </div>
          ) : searchResults.length === 0 && !isSearching ? (
            <div className="px-4 py-8 text-center text-tg-text-secondary">
              No messages found
            </div>
          ) : (
            <>
              {searchResults
                .slice(0, displayedResultsCount)
                .map((result, index) => (
                  <div
                    key={result.message.id || index}
                    onClick={() => {
                      setCurrentResultIndex(index);
                      goToResult(result);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 border-b border-tg-border/50 ${
                      index === currentResultIndex ? "bg-white/10" : ""
                    }`}>
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 ${result.message.userpicClass || "userpic1"}`}>
                      {result.message.initials ||
                        result.message.from?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white truncate">
                          {result.message.from || "Unknown"}
                        </span>
                        <span className="text-xs text-tg-text-secondary shrink-0 flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(result.message.date)}
                        </span>
                      </div>
                      <p className="text-sm text-tg-text-secondary truncate mt-0.5">
                        {highlightMatch(
                          result.message.text?.substring(0, 100) || "",
                          debouncedQuery
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              {displayedResultsCount < searchResults.length && (
                <div className="px-4 py-3 text-center text-tg-text-secondary text-sm">
                  Showing {displayedResultsCount} of {searchResults.length}{" "}
                  results. Scroll for more.
                </div>
              )}
              {isSearching && (
                <div className="px-4 py-2 text-center text-tg-text-secondary text-xs flex items-center justify-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                  Still searching...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
