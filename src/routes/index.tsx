import { createFileRoute } from "@tanstack/react-router";
import ChatViewer from "../components/chat-viewer";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <div className="bg-black shadow-[0_0_40px_rgba(0,0,0,0.5)] relative">
      {/* Gradient pattern overlay - SVG used as mask to show gradient through the pattern */}
      <div
        className="absolute inset-0 gradient-default-dark pointer-events-none z-0"
        style={{
          maskImage: "url('/dark-pattern.svg')",
          WebkitMaskImage: "url('/dark-pattern.svg')",
          maskRepeat: "repeat",
          WebkitMaskRepeat: "repeat",
        }}
      />
      <div className="relative z-10">
        <ChatViewer />
      </div>
    </div>
  );
}
