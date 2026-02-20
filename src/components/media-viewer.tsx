import { ImageIcon, SmileIcon, VideoIcon } from "lucide-react";
import type { MediaItem } from "../lib/file-handler";
import { useState } from "react";

interface MediaViewerProps {
  media?: MediaItem[];
}

export default function MediaViewer({ media }: MediaViewerProps) {
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  if (!media || media.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {media.map((item, index) => (
        <MediaItemRenderer
          key={index}
          item={item}
          playingVideo={playingVideo}
          setPlayingVideo={setPlayingVideo}
        />
      ))}
    </div>
  );
}

interface MediaItemRendererProps {
  item: MediaItem;
  playingVideo: string | null;
  setPlayingVideo: (url: string | null) => void;
}

function MediaItemRenderer({
  item,
  playingVideo,
  setPlayingVideo,
}: MediaItemRendererProps) {
  switch (item.type) {
    case "photo":
      if (!item.url && !item.thumb) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 px-6 bg-black/20 rounded-xl text-center max-w-64">
            <span className="text-3xl opacity-70">
              <ImageIcon />
            </span>
            <span className="text-[13px] text-tg-text-secondary text-balance">
              {item.description}
            </span>
            <span className="text-[13px] text-tg-text-secondary">
              {item.status}
            </span>
          </div>
        );
      }
      return (
        <div className="-mx-2 -mt-1 mb-1 rounded-xl overflow-hidden">
          <img
            src={item.url || item.thumb || ""}
            alt="Photo"
            loading="lazy"
            className="max-w-[280px] max-h-[320px] rounded-xl block"
          />
        </div>
      );

    case "video":
      if (!item.url) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 px-6 bg-black/20 rounded-xl text-center">
            <span className="text-3xl opacity-70">
              <VideoIcon />
            </span>
            <span className="text-[13px] text-tg-text-secondary italic">
              {item.description}
            </span>
            <span className="text-[13px] text-tg-text-secondary">
              {item.status}
            </span>
          </div>
        );
      }
      return (
        <div className="-mx-2 -mt-1 mb-1 rounded-xl overflow-hidden relative">
          {playingVideo === item.url ? (
            <video
              src={item.url}
              controls
              autoPlay
              onEnded={() => setPlayingVideo(null)}
              className="max-w-[280px] max-h-[320px] rounded-xl"
            />
          ) : (
            <>
              {item.thumb && (
                <img
                  src={item.thumb}
                  alt="Video thumbnail"
                  className="max-w-[280px] max-h-[320px] rounded-xl"
                />
              )}
              {item.duration && (
                <span className="absolute top-2 left-2 bg-black/60 px-1.5 py-0.5 rounded text-xs text-white">
                  {item.duration}
                </span>
              )}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 rounded-full flex items-center justify-center cursor-pointer"
                onClick={() => item.url && setPlayingVideo(item.url)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </>
          )}
        </div>
      );

    case "round_video":
      if (!item.url) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 px-6 bg-black/20 rounded-xl text-center">
            <span className="text-3xl opacity-70">⭕</span>
            <span className="text-[13px] text-tg-text-secondary italic">
              Video message not available
            </span>
          </div>
        );
      }
      return (
        <div className="w-[200px] h-[200px] rounded-full overflow-hidden">
          <video
            src={item.url}
            controls
            className="w-full h-full object-cover"
          />
        </div>
      );

    case "sticker":
    case "animated_sticker":
      if (item.description) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 bg-black/20 rounded-xl text-center max-w-64">
            <span className="opacity-70 text-3xl">
              {item.emoji || <SmileIcon />}
            </span>
            <span className="text-[13px] text-tg-text-secondary italic">
              Sticker {item.description}
            </span>
            <span className="text-[13px] text-tg-text-secondary">
              {item.status}
            </span>
          </div>
        );
      }
      if (!item.url && !item.thumb) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 px-6 bg-black/20 rounded-xl text-center">
            <span className="text-3xl opacity-70">{item.emoji || "🎨"}</span>
            <span className="text-[13px] text-tg-text-secondary italic">
              Sticker not available
            </span>
          </div>
        );
      }
      return (
        <div className="max-w-[180px]">
          <img
            src={item.url || item.thumb || ""}
            alt={item.emoji || "Sticker"}
            className="max-w-[180px] max-h-[180px]"
          />
        </div>
      );

    case "gif":
    case "animation":
      if (!item.url) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 px-6 bg-black/20 rounded-xl text-center">
            <span className="text-3xl opacity-70">🎞️</span>
            <span className="text-[13px] text-tg-text-secondary italic">
              Animation not available
            </span>
          </div>
        );
      }
      return (
        <div className="-mx-2 -mt-1 mb-1 rounded-xl overflow-hidden">
          <video
            src={item.url}
            autoPlay
            loop
            muted
            playsInline
            className="max-w-[280px] max-h-[320px] rounded-xl"
          />
        </div>
      );

    case "voice":
      if (!item.url) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 px-6 bg-black/20 rounded-xl text-center">
            <span className="text-3xl opacity-70">🎤</span>
            <span className="text-[13px] text-tg-text-secondary italic">
              Voice message not available
            </span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 p-2 min-w-[220px]">
          <div className="w-8 h-8 bg-tg-accent rounded-full flex items-center justify-center text-sm">
            🎤
          </div>
          <audio
            src={item.url}
            controls
            preload="metadata"
            className="h-8 max-w-[220px]"
          />
          {item.duration && (
            <span className="text-xs text-tg-text-secondary">
              {item.duration}
            </span>
          )}
        </div>
      );

    case "file":
      if (!item.url) {
        return (
          <div className="flex flex-col items-center gap-2 py-4 px-6 bg-black/20 rounded-xl text-center">
            <span className="text-3xl opacity-70">📄</span>
            <span className="text-[13px] text-tg-text-secondary italic">
              {item.title || "File not available"}
            </span>
          </div>
        );
      }
      return (
        <a
          href={item.url}
          className="flex items-center gap-3 px-3 py-2 bg-black/20 rounded-lg no-underline"
          target="_blank"
          rel="noopener noreferrer">
          <div className="w-10 h-10 bg-tg-accent rounded-lg flex items-center justify-center text-lg">
            📄
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm text-tg-text-primary">
              {item.title || "File"}
            </div>
            {item.size && (
              <div className="text-xs text-tg-text-secondary">{item.size}</div>
            )}
          </div>
        </a>
      );

    case "location":
      return (
        <a
          href={item.url || "#"}
          className="flex items-center gap-3 p-2 no-underline"
          target="_blank"
          rel="noopener noreferrer">
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-xl">
            📍
          </div>
          <div>
            <div className="text-tg-text-primary">Location</div>
            {item.coords && (
              <div className="text-xs text-tg-text-primary/60">
                {item.coords}
              </div>
            )}
          </div>
        </a>
      );

    case "contact":
      return (
        <div className="flex items-center gap-3 p-2">
          <div className="w-12 h-12 bg-tg-accent rounded-full flex items-center justify-center text-xl">
            👤
          </div>
          <div className="flex-1">
            <div className="font-medium text-tg-text-primary">
              {item.name || "Contact"}
            </div>
            {item.phone && (
              <div className="text-[13px] text-tg-text-secondary">
                {item.phone}
              </div>
            )}
          </div>
        </div>
      );

    case "call":
      return (
        <div className="flex items-center gap-2 p-2">
          <span className="text-xl">📞</span>
          <span className="text-tg-text-primary">{item.name}</span>
          {item.status && (
            <span className="text-xs text-tg-text-primary/60">
              {item.status}
            </span>
          )}
        </div>
      );

    default:
      return null;
  }
}
