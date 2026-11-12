import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages is a project site, so its assets must be served from /voka/react/.
// The default "/" continues to work for local Vite and native Capacitor builds.
const base = process.env.VITE_PAGES_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "Voka",
        short_name: "Voka",
        description: "Your Voka profile",
        theme_color: "#19452d",
        background_color: "#f6f7f2",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${base}icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        runtimeCaching: []
      }
    })
  ],
  server: { host: "127.0.0.1" },
  test: { environment: "jsdom", include: ["tests/unit/**/*.test.ts"] }
});
