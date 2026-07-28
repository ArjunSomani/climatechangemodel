import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { PreviewBanner } from "@/components/PreviewBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display serif for headings only -- gives the site an editorial,
// energy-and-climate-storytelling feel instead of generic app chrome.
// Body copy and UI stay on Geist for legibility at small sizes.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Optimize — Grid Decarbonization Scenarios",
  description: "Explore US electricity-grid decarbonization scenarios.",
};

// Explicit viewport so mobile scales to device width. No maximum-scale /
// user-scalable=no -- pinch-zoom must stay available for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Dark is the default theme; the pre-paint script below rewrites this to
      // the visitor's saved preference before first paint, so React's SSR value
      // and the client value can legitimately differ -- hence suppressHydrationWarning.
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Apply the stored theme before anything paints so a light-mode visitor
            never sees a dark flash. Runs synchronously as the first body node. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();",
          }}
        />
        <PreviewBanner />
        <Nav />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0">{children}</div>
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:justify-between dark:text-zinc-400">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <a
                href="https://github.com/cliffgold/Optimize"
                className="hover:text-accent"
              >
                GitHub
              </a>
              <Link href="/methodology" className="hover:text-accent">
                Methodology
              </Link>
              <Link href="/data-explorer" className="hover:text-accent">
                Data sources
              </Link>
              <a
                href="https://levelmodel.vercel.app"
                className="hover:text-accent"
                target="_blank"
                rel="noreferrer"
              >
                Level
              </a>
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
