import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["postgres", "pdf-lib"],
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera is needed only by the organizer scanner on this origin.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
