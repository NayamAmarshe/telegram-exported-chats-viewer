import { atom } from "jotai";
import type { ChatInfo } from "./file-handler";

// Recent folder metadata type
export interface RecentFolder {
  folderName: string;
  chatName: string;
  timestamp: number;
  messageCount: number;
}

// Global state atoms - separated to preserve state during HMR
export const chatDataAtom = atom<ChatInfo | null>(null);
export const loadingAtom = atom<boolean>(false);
export const loadingProgressAtom = atom<string>("");

// Recent folders state
export const recentFoldersAtom = atom<RecentFolder[]>([]);

// Search state
export const searchQueryAtom = atom<string>("");
export const searchOpenAtom = atom<boolean>(false);
export const scrollToMessageIdAtom = atom<string | null>(null);
