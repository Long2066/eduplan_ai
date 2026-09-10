import type { NextConfig } from "next";

const FIREBASE_AUTH_HELPER_ORIGIN = "https://edupaln-ai.firebaseapp.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: `${FIREBASE_AUTH_HELPER_ORIGIN}/__/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
