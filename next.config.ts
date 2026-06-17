import type { NextConfig } from "next";

// Povolený CORS origin – nastavuje sa cez env premennú CORS_ORIGIN.
// V produkcii: nastavíme v docker-compose.prod.yml
// V dev: fallback na localhost:3000
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ?? "https://konfigurator.fabrick.sk";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Povolí CORS pre všetky API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: CORS_ORIGIN },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
