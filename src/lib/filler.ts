import { newPage, closePage } from "./browser";
import { clickSubmitButton, findNextButton, clickNextButton, findSubmitButton, waitForPageTransition } from "./scanner";
import type { FormConfig, RoundResult, FieldConfig } from "@/types";
import type { Page } from "playwright";

/** Min & max delay between fills (10-15s = 4-6 forms/min) */
const MIN_DELAY = 10_000;
const MAX_DELAY = 15_000;

/** Random delay within rate-limit bounds */
function randomDelay(): number {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

/** Select an option key based on configured ratios */
function pickByRatio(ratios: Record<string, number>): string {
  const entries = Object.entries(ratios);
  if (entries.length === 0) return "";
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const [key, pct] of entries) {
    cumulative += pct;
    if (rand <= cumulative) return key;
  }
  return entries[entries.length - 1][0];
}

/** Check for captcha presence on the page */
async function detectCaptcha(page: Page): Promise<boolean> {
  try {
    // reCAPTCHA iframe
    const recaptcha = page.locator('iframe[src*="recaptcha"], iframe[src*="google.com/recaptcha"]');
    if ((await recaptcha.count()) > 0) return true;

    // Error / challenge text
    const body = await page.locator("body").textContent();
    if (
      body?.includes("unusual traffic") ||
      body?.includes("can't access this form") ||
      body?.includes("not available") ||
      body?.includes("reCAPTCHA")
    )
      return true;
  } catch {
    // page may be in transition
  }
  return false;
}

/* ===== Page-level field filler helpers ===== */

/**
 * Fill a single field on the current page.
 * Uses Playwright's `:visible` selector to interact only with visible
 * listitems, which ensures correct targeting on multi-page forms where
 * hidden elements from other pages coexist in the DOM.
 *
 * @param fieldConfig — The configuration for this field (ratios, text, etc.)
 * @param localIndex — The field's position (index) within current visible page
 * @returns The value that was filled, or null if the field wasn't found
 */
async function fillSingleField(
  page: Page,
  fieldConfig: FieldConfig,
  localIndex: number,
  radioGroupIndex?: number // index among all radiogroups on the page (for grids)
): Promise<string | null> {
  const { type, ratios, textValue } = fieldConfig;

  // Locate the visible listitem for this field by its local index on the page.
  // Using :visible ensures we only match items on the current page, even when
  // Google Forms keeps hidden items from other pages in the DOM.
  // For grid rows, there may be no listitem at this index — handled by
  // the radiogroup-index fallback in the radio section below.
  const listitem = page.locator('div[role="listitem"]:visible').nth(localIndex);
  const hasListitem = (await listitem.count()) > 0;
  if (!hasListitem && type !== "radio") return null;

  try {
    if (type === "short_text") {
      const input = listitem.locator('input[type="text"], input:not([type])').first();
      if ((await input.count()) > 0) {
        const value = textValue || "Auto-filled";
        await input.fill(value);
        return value;
      }
    } else if (type === "long_text") {
      const textarea = listitem.locator("textarea").first();
      if ((await textarea.count()) > 0) {
        const value = textValue || "Auto-filled";
        await textarea.fill(value);
        return value;
      }
    } else if (type === "radio" && ratios) {
      const picked = pickByRatio(ratios);

      // Helper: click a radio with the given data-value within a parent locator.
      // Uses Playwright native click (real mouse events) so Google Forms React
      // handlers fire correctly.
      async function _clickRadioOption(
        parent: ReturnType<Page["locator"]>,
        value: string
      ): Promise<string | null> {
        // Match by data-value (most reliable)
        const byVal = parent.locator(
          `div[role="radio"][data-value="${value}"]`
        ).first();
        if ((await byVal.count()) > 0 && (await byVal.isVisible())) {
          await byVal.click();
          return value;
        }
        // Match by aria-label (some older forms)
        const byLabel = parent.locator(
          `div[role="radio"][aria-label*="${value}"]`
        ).first();
        if ((await byLabel.count()) > 0 && (await byLabel.isVisible())) {
          await byLabel.click();
          return value;
        }
        return null;
      }

      // Helper: click ANY visible radio in the group as last resort.
      // This ensures at least one option is selected when the specific
      // value isn't found (e.g., form options changed after scan).
      async function _clickFirstRadio(
        parent: ReturnType<Page["locator"]>
      ): Promise<string | null> {
        const first = parent.locator('div[role="radio"]').first();
        if ((await first.count()) > 0 && (await first.isVisible())) {
          await first.click();
          const val = await first.getAttribute("data-value");
          return val || "(first option)";
        }
        return null;
      }

      // Strategy 1 — radiogroup-index (works for ALL cases, including grids).
      // Grid/matrix rows share one listitem, so locating by radiogroup index
      // is more reliable than listitem-scoped matching.
      let filled: string | null = null;
      if (radioGroupIndex !== undefined) {
        const group = page
          .locator('div[role="radiogroup"]:visible')
          .nth(radioGroupIndex);
        if ((await group.count()) > 0) {
          filled = await _clickRadioOption(group, picked);
          if (!filled) {
            filled = await _clickFirstRadio(group);
          }
        }
      }

      // Strategy 2 — listitem-scoped (fallback for pages without grid).
      if (!filled && hasListitem) {
        filled = await _clickRadioOption(listitem, picked);
        if (!filled) {
          filled = await _clickFirstRadio(listitem);
        }
      }

      if (filled) {
        return picked;
      }
      // If nothing worked, log a warning so the operator can diagnose
      console.warn(
        `[filler] Could not fill radio field "${fieldConfig.fieldId}" (value: "${picked}")`
      );
    } else if (type === "checkbox" && ratios) {
      // For checkboxes, select each option independently based on its ratio
      const selected: string[] = [];
      for (const [option, pct] of Object.entries(ratios)) {
        const chance = pct / 100;
        if (Math.random() < chance) {
          let cb = listitem.locator(`div[role="checkbox"][data-value="${option}"]`).first();
          if ((await cb.count()) === 0) {
            cb = listitem.locator(`div[role="checkbox"][aria-label="${option}"]`).first();
          }
          if ((await cb.count()) === 0) {
            cb = listitem.locator(`div[role="checkbox"][data-answer-value="${option}"]`).first();
          }
          if ((await cb.count()) > 0) {
            await cb.click();
            selected.push(option);
          }
        }
      }
      return selected.join(", ") || "(none)";
    } else if (type === "dropdown" && ratios) {
      const picked = pickByRatio(ratios);
      const trigger = listitem.locator('div[role="listbox"]').first();
      if ((await trigger.count()) > 0) {
        await trigger.click();
        await page.waitForTimeout(300);
        const option = page.locator(`[role="option"]:has-text("${picked}")`).first();
        if ((await option.count()) > 0) {
          await option.click();
          return picked;
        }
      }
    }
  } catch {
    // If interaction fails (element detached, etc.), skip and continue
  }

  return null;
}

/**
 * Fill all fields belonging to the current page.
 */
async function fillPage(
  page: Page,
  fieldConfigs: FieldConfig[],
  startLocalIdx: number
): Promise<Record<string, string>> {
  const data: Record<string, string> = {};

  for (let i = 0; i < fieldConfigs.length; i++) {
    const cfg = fieldConfigs[i];
    const localIndex = startLocalIdx + i;

    // For radio fields, compute the index among radio fields (not all fields)
    // on this page. This is needed for grid/matrix layouts where multiple
    // radiogroups share one listitem — we find by radiogroup index instead.
    const radioGroupIndex =
      cfg.type === "radio"
        ? fieldConfigs.slice(0, i).filter((f) => f.type === "radio").length
        : undefined;

    const value = await fillSingleField(page, cfg, localIndex, radioGroupIndex);
    if (value !== null) {
      data[cfg.fieldId] = value;
    }

    // 0.3s delay between each field so Google Forms' JS registers the change.
    // Without this, rapid sequential fills on grid/matrix pages may be
    // silently dropped and the form stays incomplete.
    await page.waitForTimeout(300);
  }

  return data;
}

/**
 * Build page groups from config.
 * If config.pages is provided, use it; otherwise treat all fields as a single page.
 */
function buildPageGroups(
  config: FormConfig
): { pageIndex: number; fields: FieldConfig[] }[] {
  if (config.pages && config.pages.length > 0) {
    return config.pages.map((pg) => ({
      pageIndex: pg.pageIndex,
      fields: pg.fieldIds
        .map((fid) => config.fields.find((f) => f.fieldId === fid))
        .filter((f): f is FieldConfig => f !== undefined),
    }));
  }

  // Single-page fallback: all fields on page 0
  return [{ pageIndex: 0, fields: [...config.fields] }];
}

/**
 * Fill and submit one Google Form round.
 * For multi-page forms, iterates through pages: fill → Next → ... → Submit.
 * Handles forms where Submit only appears after filling required fields,
 * and forms with repeating sections beyond the configured page count.
 *
 * Navigation strategy:
 * 1. Fill fields on the current page
 * 2. Check for Submit button — if visible, click and finish
 * 3. If no Submit, find and click Next, repeat from step 1
 * 4. Safety cap at 20 pages maximum
 *
 * Returns the field data, status, and page navigation info.
 */
export async function executeOne(config: FormConfig, signal?: AbortSignal): Promise<RoundResult> {
  const page = await newPage();

  // If the client aborted while we were still creating the page, close it immediately
  if (signal?.aborted) {
    await closePage(page);
    return {
      round: Date.now(),
      timestamp: new Date().toISOString(),
      data: {},
      status: "error",
      error: "Stopped by user",
      pageCount: 0,
      currentPageIndex: 0,
    };
  }

  // Register a one-shot listener: if the signal fires mid-execution,
  // close the Playwright page so Chromium tabs don't linger.
  const abortListener = () => {
    closePage(page).catch(() => {});
  };
  signal?.addEventListener("abort", abortListener, { once: true });
  // Capture browser console messages for debugging
  const browserLogs: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") {
      browserLogs.push(`[browser] ${msg.text()}`);
    }
  });

  const data: Record<string, string> = {};
  let status: RoundResult["status"] = "success";
  let errorMsg: string | undefined;
  let pageCount = 1;
  let currentPageIndex = 0;
  const MAX_EXECUTION_PAGES = 20;

  try {
    await page.goto(config.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('div[role="listitem"]', { timeout: 15000 });

    // Build page groups from config
    const pageGroups = buildPageGroups(config);
    const lastFields =
      pageGroups.length > 0
        ? pageGroups[pageGroups.length - 1].fields
        : config.fields;

    // Dynamic page loop: fill → check Submit → check Next → repeat
    for (let pi = 0; pi < MAX_EXECUTION_PAGES; pi++) {
      // Stop immediately if user clicked Stop
      if (signal?.aborted) {
        status = "error";
        errorMsg = "Stopped by user";
        break;
      }

      currentPageIndex = pi;

      // Resolve field configs for this page.
      // If this page index maps to a known page group, use those fields.
      // Otherwise, reuse the last page group's fields for repeating sections.
      const fieldConfigs =
        pi < pageGroups.length ? pageGroups[pi].fields : lastFields;

      // Fill all fields on this page (reset local index for :visible)
      const pageData = await fillPage(page, fieldConfigs, 0);
      Object.assign(data, pageData);

      // Check captcha before navigation
      const hasCaptcha = await detectCaptcha(page);
      if (hasCaptcha) {
        status = "captcha";
        errorMsg = "reCAPTCHA detected";
        break;
      }

      // Strategy: ALWAYS check for Submit button after filling all fields.
      // Google Forms may delay enabling Submit until all required fields
      // are filled — retry once after a short wait if not immediately found.
      let hasSubmit = await findSubmitButton(page);
      if (!hasSubmit) {
        // Some forms need a moment after fillPage to enable Submit.
        // Wait 500ms and check again.
        await page.waitForTimeout(500);
        hasSubmit = await findSubmitButton(page);
      }

      if (hasSubmit) {
        // Use clickSubmitButton which tries CSS selectors first, then falls
        // back to normalized-text matching (handles Unicode NFC/NFD).
        const clicked = await clickSubmitButton(page);

        // Verify the form was actually submitted by waiting for the
        // Google Forms confirmation message.
        // Common messages:
        //   "Câu trả lời của bạn đã được ghi lại." (Vietnamese)
        //   "Your response has been recorded." (English)
        //   <div class="vHW8K">...</div>
        let confirmed = false;
        if (clicked) {
          try {
            await page.waitForSelector('.vHW8K, [class*="freebirdFormviewerViewResponseConfirmation"]', {
              timeout: 5000,
            });
            confirmed = true;
          } catch {
            // Confirmation not found within timeout — check page state
            const body = await page.locator("body").textContent().catch(() => "");
            if (body) {
              const nfc = body.normalize("NFC").toLowerCase();
              confirmed =
                nfc.includes("đã được ghi lại") ||
                nfc.includes("has been recorded") ||
                nfc.includes("response recorded");
            }
          }
        }

        if (!clicked) {
          status = "error";
          errorMsg = "Submit button found by detection but could not be clicked";
        } else if (!confirmed) {
          // Clicked Submit but didn't see confirmation — log but still count as success
          console.warn("[filler] Submit clicked but confirmation not verified");
        }
        break; // Form submitted — done
      }

      // No Submit found — look for Next button to continue
      const nextText = await findNextButton(page);
      if (!nextText) {
        // Neither Submit nor Next — we're done
        break;
      }

      // Click Next and wait for page transition
      await clickNextButton(page, nextText);
      await waitForPageTransition(page);
    }

    pageCount = currentPageIndex + 1;
  } catch (err) {
    status = "error";
    errorMsg = (err as Error).message;
  } finally {
    // Log browser console messages if any
    if (browserLogs.length > 0) {
      console.error("Browser debug:", browserLogs.join(" | "));
    }
    // Clean up the abort listener so we don't leak
    signal?.removeEventListener("abort", abortListener);
    await closePage(page);
  }

  return {
    round: Date.now(),
    timestamp: new Date().toISOString(),
    data,
    status,
    error: errorMsg,
    pageCount,
    currentPageIndex,
  };
}

/**
 * Rate-limiting delay between form submissions.
 * Random 4-6 forms/min (10-15s spacing).
 */
export { randomDelay as getFillDelay };
