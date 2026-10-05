import type { NextConfig } from "next";

// Origins the browser is allowed to talk to (read from the same variables the app uses).
const apiOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin; } catch { return "https://api-seatly.onrender.com"; } })();
const mqttOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_MQTT_URL ?? "").origin.replace(/^http/, "ws"); } catch { return ""; } })();
const isProd = process.env.NODE_ENV === "production";

// Next.js needs inline scripts/styles for hydration and Tailwind; everything else is locked down.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${mqttOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api-seatly.onrender.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
