import type { MetadataRoute } from "next";

// Keep every NON-production deployment out of search indexes. Preview builds
// of this branch assign dollar values to human lives with not-yet-final
// numbers, and must not be crawled or indexed while in development.
//
// VERCEL_ENV is read at build time; each Vercel environment is a separate
// build (production | preview | development), so production emits the normal
// allow-all robots.txt and every preview/dev build emits a blanket disallow.
// Locally (`next dev`) VERCEL_ENV is undefined, which also disallows -- the
// safe default.
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
