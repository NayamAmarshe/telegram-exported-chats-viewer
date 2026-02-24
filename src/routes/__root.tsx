import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Telegram Exported Chats Viewer" },
      {
        name: "description",
        content:
          "Browse your exported Telegram chats in a beautiful, modern interface. Fast, private, and entirely local — no data ever leaves your device.",
      },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Telegram Exported Chats Viewer" },
      {
        property: "og:description",
        content:
          "Browse your exported Telegram chats in a beautiful, modern interface. Fast, private, and entirely local — no data ever leaves your device.",
      },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "2560" },
      { property: "og:image:height", content: "1600" },
      {
        property: "og:image:alt",
        content: "Telegram Exported Chats Viewer screenshot",
      },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Telegram Exported Chats Viewer" },
      {
        name: "twitter:description",
        content:
          "Browse your exported Telegram chats in a beautiful, modern interface. Fast, private, and entirely local.",
      },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
