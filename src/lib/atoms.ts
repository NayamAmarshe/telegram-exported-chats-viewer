import { atom } from "jotai";
import type { ChatInfo } from "./file-handler";

// Global state atoms - separated to preserve state during HMR
export const chatDataAtom = atom<ChatInfo | null>(null);
export const loadingAtom = atom<boolean>(false);
export const loadingProgressAtom = atom<string>("");
