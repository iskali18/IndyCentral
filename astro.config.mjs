import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://indycentral.com",
  trailingSlash: "always",
  output: "server",
  adapter: vercel({
    // Pages render on-demand, then Vercel caches the HTML at the edge for
    // 30 minutes and serves the cached copy to everyone else. After 30
    // minutes the next visitor triggers a fresh render (and a fresh
    // Google Calendar fetch) in the background. This is how new/edited
    // Calendar events show up without a new deploy, while keeping normal
    // traffic from hitting the Calendar API on every request.
    isr: {
      expiration: 1800,
    },
  }),
  integrations: [sitemap()],
});
