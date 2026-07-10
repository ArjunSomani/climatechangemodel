import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Optimize — Grid Decarbonization Scenarios",
  description: "Explore US electricity-grid decarbonization scenarios.",
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
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0">{children}</div>
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:justify-between dark:text-zinc-400">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <a
                href="https://github.com/cliffgold/Optimize"
                className="hover:text-black dark:hover:text-zinc-50"
              >
                GitHub
              </a>
              <Link
                href="/methodology"
                className="hover:text-black dark:hover:text-zinc-50"
              >
                Methodology
              </Link>
              <Link
                href="/data-explorer"
                className="hover:text-black dark:hover:text-zinc-50"
              >
                Data sources
              </Link>
            </div>
            <div>
              Modeling engine and data from cliffgold/Optimize. No open
              source license specified.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
