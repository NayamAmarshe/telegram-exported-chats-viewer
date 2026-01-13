import { createFileRoute } from "@tanstack/react-router";
import ChatViewer from "../components/chat-viewer";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return <ChatViewer />;
}
