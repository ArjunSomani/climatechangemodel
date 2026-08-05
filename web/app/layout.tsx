import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Geist } from "next/font/google";
import { Nav } from "@/components/Nav";
import { PreviewBanner } from "@/components/PreviewBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

// Display serif for headings only -- gives the site an editorial,
// energy-and-climate-storytelling feel instead of generic app chrome.
// Body copy, UI, and all numeric data stay on Geist.
//
// Axes: opsz only. The variable file also ships SOFT and WONK, and requesting
// them cost 118 KB on every page -- more than the entire gzipped JS bundle on
// the static routes -- while nothing in the CSS ever varied either one
// (`font-optical-sizing: auto` uses opsz; SOFT and WONK appear nowhere). If a
// future design deliberately varies them, add them back and re-measure.
//
// Geist Mono is gone for the same reason: a whole family fetched to style four
// numeric readouts, each of which already carried `tabular-nums`. Geist's own
// tabular figures line up columns just as well without a second download.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
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

const footerLink =
  "flex min-h-6 items-center px-1 hover:text-accent hover:underline";

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
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
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
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <PreviewBanner />
        <Nav />
        <main id="main-content" className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0">{children}</div>
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:justify-between dark:text-zinc-400">
            {/* py-1 -mx-1 px-1 gives each link a >=24px hit box (WCAG 2.5.8)
                without changing where the text sits, and the negative margin
                keeps the row's visual alignment flush. */}
            <nav
              aria-label="Site information"
              className="-mx-1 flex flex-wrap gap-x-3 gap-y-0"
            >
              <Link href="/about" className={footerLink}>
                About
              </Link>
              <a
                href="https://github.com/ArjunSomani/climatechangemodel"
                className={footerLink}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <Link href="/methodology" className={footerLink}>
                Methodology
              </Link>
              <Link href="/data-explorer" className={footerLink}>
                Data sources
              </Link>
              <a
                href="https://levelmodel.vercel.app"
                className={footerLink}
                target="_blank"
                rel="noreferrer"
              >
                Level
              </a>
            </nav>
            <div>
              Modeling engine and data from{" "}
              <a
                href="https://github.com/cliffgold/Optimize"
                className="underline hover:text-accent"
                target="_blank"
                rel="noreferrer"
              >
                cliffgold/Optimize
              </a>
              . No open source license specified.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
