import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@richfeed/ui/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Social Queue",
  description:
    "Social media scheduling and multi-account publishing for Blue Beacon Research",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-app font-sans text-primary antialiased">{children}</body>
    </html>
  );
}
