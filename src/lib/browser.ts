import { chromium, type Browser, type Page } from "playwright";

let browser: Browser | null = null;

/** Get or create a persistent headless Chromium instance */
export async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  return browser;
}

/** Create a new page with standard viewport */
export async function newPage(): Promise<Page> {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  return page;
}

/** Safe page close */
export async function closePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch {
    // already closed
  }
}

/** Graceful shutdown */
export async function shutdownBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    browser = null;
  }
}
