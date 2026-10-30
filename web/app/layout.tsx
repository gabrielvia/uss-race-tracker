import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "USS Race Tracker | Competition Results",
  description: "Explore US Speedskating competition results, skater rosters, and the records behind every race.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
