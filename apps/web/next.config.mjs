/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/db", "@repo/schemas", "@repo/core", "@repo/ai", "@repo/browser"],
  // Pin tracing to the monorepo root so Next doesn't mis-infer the workspace root
  // (it was picking up an unrelated lockfile at C:\Users\sande\package-lock.json).
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  outputFileTracingIncludes: {
    "/**": ["../../packages/db/drizzle/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/storage/:path*",
        headers: [{ key: "Cache-Control", value: "private, max-age=60" }],
      },
    ];
  },
};

export default nextConfig;