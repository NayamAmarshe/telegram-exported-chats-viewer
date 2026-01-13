export interface ReplyTo {
  text: string;
  isAnotherChat: boolean;
  messageId: number | null;
  senderName?: string;
  preview?: string;
}

export interface MediaItem {
  type:
    | "photo"
    | "video"
    | "round_video"
    | "sticker"
    | "animated_sticker"
    | "gif"
    | "voice"
    | "file"
    | "location"
    | "contact"
    | "call"
    | "animation";
  url?: string | null;
  thumb?: string | null;
  duration?: string;
  title?: string;
  size?: string;
  emoji?: string;
  coords?: string;
  name?: string;
  phone?: string;
  status?: string;
  description?: string; // For unavailable media
}

export interface ParsedMessage {
  id: string;
  type: "message" | "service";
  from?: string;
  time?: string;
  date?: string; // Added for date separators
  text?: string;
  formattedHTML?: string;
  replyTo?: ReplyTo | null;
  media?: MediaItem[];
  initials?: string;
  userpicClass?: string;
  isJoined?: boolean; // True if this is a continuation message
}

export interface ChatInfo {
  name: string;
  messages: ParsedMessage[];
}

export const getRelativePath = (
  href: string | null,
  basePath: string
): string | null => {
  if (!href) return null;
  const cleanPath = href.replace(/^\.\//, "");
  return basePath + "/" + cleanPath;
};

export const findFileInFolder = async (
  files: File[],
  path: string | null
): Promise<string | null> => {
  if (!path) return null;
  for (const file of files) {
    if (file.webkitRelativePath === path) {
      return URL.createObjectURL(file);
    }
  }
  return null;
};

export const parseHTML = (htmlString: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, "text/html");
};
