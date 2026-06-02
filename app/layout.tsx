import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kaelor AI",
  description: "AI Visibility Platform — understand how AI assistants perceive and recommend your company.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        Shell layout — Figma spec:
        - bg-background = light gray (#f4f4f4), sidebar is transparent so the gray shows through
        - Content is a white rounded-lg card with 12px margin top/right/bottom, flush left against sidebar
        - Topbar removed — each page renders its own page-header (Phase 2+)
      */}
      <body className="flex h-full overflow-hidden bg-background">
        <Sidebar />
        <div className="shell-card flex flex-1 flex-col my-3 mr-3 overflow-hidden rounded-lg bg-white dark:bg-card">
          <main className="flex-1 overflow-auto">
            <div className="px-6 py-6 sm:px-8 xl:px-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
