import { defineConfig } from "playwright/test";

export default defineConfig({
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  },
  // Chromium là đủ, không cần Firefox/WebKit
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
