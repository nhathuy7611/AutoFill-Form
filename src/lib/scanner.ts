import { newPage, closePage } from "./browser";
import type { FormStructure, FormField, FormPage, FieldType } from "@/types";
import type { Page } from "playwright";

/* ==============================
   Multi-page Google Form Scanner
   ============================== */

/**
 * Fill required fields on the current page with arbitrary values.
 * Google Forms with required questions (marked by `*`) block navigation
 * until all required questions are answered. This helper fills them so
 * the scanner can proceed to the next page.
 *
 * Supports radio (including grid/matrix), short_text, long_text,
 * checkbox, and dropdown types.
 *
 * CRITICAL NOTES:
 * - **500ms delay** is applied after EACH field to let Google Forms' Closure/React
 *   event handlers register the change. Without this delay, the form may silently
 *   ignore some fields and the Next button stays disabled.
 * - Radio buttons use Playwright's **native `.click()`** (real mouse events), NOT
 *   `element.click()` via `page.evaluate`. Google Forms does not reliably register
 *   programmatic `.click()` dispatched from `evaluate`.
 * - For grid/matrix layouts, multiple radiogroups share one listitem, so they are
 *   located by their index among all `:visible` radiogroups on the page.
 */
async function fillRequiredFields(page: Page, fields: FormField[]): Promise<void> {
  for (const field of fields) {
    if (!field.required) continue;

    try {
      if (field.type === "radio") {
        // Calculate the index of this radio among all radio fields on the current page.
        // This index maps to the Nth visible radiogroup in the DOM.
        // Using :visible ensures hidden radiogroups from other pages are excluded.
        const radioIdx = fields
          .slice(0, fields.indexOf(field))
          .filter((f) => f.type === "radio").length;

        const rg = page.locator('div[role="radiogroup"]:visible').nth(radioIdx);
        if ((await rg.count()) === 0) continue;

        // Click the first radio option using Playwright native click (real mouse
        // events) so Google Forms' React handlers fire properly.
        const firstRadio = rg.locator('div[role="radio"]').first();
        if ((await firstRadio.count()) > 0) {
          await firstRadio.click();
        }
      } else {
        // Non-radio fields: locate by Nth visible listitem
        const listitem = page.locator('div[role="listitem"]:visible').nth(field.index);
        if ((await listitem.count()) === 0) continue;

        if (field.type === "short_text") {
          const input = listitem.locator('input[type="text"], input:not([type])').first();
          if ((await input.count()) > 0) {
            await input.fill("Auto");
          }
        } else if (field.type === "long_text") {
          const textarea = listitem.locator("textarea").first();
          if ((await textarea.count()) > 0) {
            await textarea.fill("Auto");
          }
        } else if (field.type === "checkbox") {
          const firstCb = listitem.locator('div[role="checkbox"]').first();
          if ((await firstCb.count()) > 0) {
            await firstCb.click();
          }
        } else if (field.type === "dropdown") {
          const trigger = listitem.locator('div[role="listbox"]').first();
          if ((await trigger.count()) > 0) {
            await trigger.click();
            await page.waitForTimeout(200);
            const firstOption = page.locator('[role="option"]').first();
            if ((await firstOption.count()) > 0) {
              await firstOption.click();
            }
          }
        }
      }

      // 500ms delay between each field fill so Google Forms' JS registers the change.
      // Without this, rapid fills may be silently dropped and the Next button won't
      // activate, causing the scanner to stall on the same page.
      await page.waitForTimeout(500);
    } catch {
      // Silently skip if element interaction fails during scan
    }
  }
}

/**
 * Parse visible fields on the current page of a Google Form.
 * Uses ARIA roles for robust detection (stable across Google updates).
 *
 * @param globalStartIdx — Starting index for sequential field IDs across pages.
 * @returns Fields on this page plus the next available global index.
 */
async function scanCurrentPage(
  page: Page,
  pageIndex: number,
  globalStartIdx: number
): Promise<{ fields: FormField[]; nextGlobalIdx: number }> {
  const result = await page.evaluate(
    ({ startIdx }) => {
      const items = document.querySelectorAll<HTMLElement>('div[role="listitem"]');
      const fields: FormField[] = [];

      items.forEach((item, idx) => {
        // Extract question title
        const titleEl =
          item.querySelector<HTMLElement>('[role="heading"]') ||
          item.querySelector<HTMLElement>(
            ".freebirdFormviewerComponentsQuestionBaseTitle"
          ) ||
          item.querySelector<HTMLElement>("div:first-child");

        const title = titleEl?.textContent?.trim() || `Question ${idx + 1}`;

        // Detect required
        const required =
          item.querySelector(
            ".freebirdFormviewerComponentsQuestionBaseRequiredAsterisk"
          ) !== null || title.includes("*");

        // Detect field type
        let type: FieldType = "short_text";
        let options: string[] | undefined;

        const textarea = item.querySelector("textarea");
        const input = item.querySelector<HTMLInputElement>(
          'input[type="text"], input:not([type])'
        );
        const radioGroups = item.querySelectorAll<HTMLElement>('div[role="radiogroup"]');
        // Detect checkboxes in two formats:
        //   1. Old format: wrapped in <div role="group">
        //   2. New format: standalone <div role="checkbox"> elements directly in the listitem
        const checkboxGroup = item.querySelector<HTMLElement>('div[role="group"]');
        const checkboxDirect = item.querySelectorAll<HTMLElement>('div[role="checkbox"]');
        const listbox = item.querySelector<HTMLElement>('div[role="listbox"]');

        if (textarea) {
          type = "long_text";
        } else if (input) {
          type = "short_text";
        } else if (radioGroups.length > 0) {
          // Handle each radiogroup as a separate field.
          // This supports both regular radio questions (1 radiogroup per listitem)
          // and grid/matrix layouts (multiple radiogroups sharing one listitem).
          radioGroups.forEach((rg) => {
            const fieldOptions = Array.from(
              rg.querySelectorAll<HTMLElement>('div[role="radio"]')
            ).map((r) => {
              const label =
                r.getAttribute("data-value") ||
                r.querySelector("span, label, div")?.textContent?.trim() ||
                `Option ${fields.length + 1}`;
              return label;
            });

            // Grid rows use aria-label for the question text
            const rowTitle =
              rg.getAttribute("aria-label") ||
              titleEl?.textContent?.trim() ||
              `Question ${idx + 1}`;

            // For grid rows beyond the first, check aria-required directly
            const fieldRequired =
              rg.hasAttribute("aria-required") &&
              rg.getAttribute("aria-required") === "true";

            fields.push({
              id: `field_${startIdx + fields.length}`,
              index: fields.length,
              type: "radio",
              title: rowTitle.replace(/\s*\*$/, "").trim(),
              required: fieldRequired,
              options: fieldOptions.length > 0 ? fieldOptions : undefined,
            });
          });
          // Skip the single-field push below — radiogroups already handled
          return;
        } else if (checkboxGroup) {
          type = "checkbox";
          options = Array.from(
            checkboxGroup.querySelectorAll<HTMLElement>('div[role="checkbox"]')
          ).map((r) => {
            const label =
              r.getAttribute("data-value") ||
              r.querySelector("span, label, div")?.textContent?.trim() ||
              `Option ${idx + 1}`;
            return label;
          });
        } else if (checkboxDirect.length > 0) {
          // New Google Forms format: checkboxes are standalone <div role="checkbox">
          // elements without a <div role="group"> wrapper.
          // This is the current format as of Google Forms 2025+.
          type = "checkbox";
          options = Array.from(checkboxDirect).map((r) => {
            const label =
              r.getAttribute("data-answer-value") ||
              r.getAttribute("data-value") ||
              r.getAttribute("aria-label") ||
              r.querySelector("span, label, div")?.textContent?.trim() ||
              `Option ${idx + 1}`;
            return label;
          });
        } else if (listbox) {
          type = "dropdown";
          options = Array.from(
            listbox.querySelectorAll<HTMLElement>('[role="option"]')
          ).map((r) => r.textContent?.trim() || `Option ${idx + 1}`);
        }

        const cleanTitle = title.replace(/\s*\*$/, "").trim();

        // Sequential global ID for backward compatibility with flat field list
        const fieldId = `field_${startIdx + fields.length}`;

        fields.push({
          id: fieldId,
          index: idx,
          type,
          title: cleanTitle,
          required,
          options: options && options.length > 0 ? options : undefined,
        });
      });

      return { fields, count: fields.length };
    },
    { startIdx: globalStartIdx }
  );

  return { fields: result.fields, nextGlobalIdx: globalStartIdx + result.count };
}

/**
 * Multi-locale button text patterns for "Next" / "Tiếp theo"
 * and similar navigation labels used by Google Forms.
 */
const NEXT_PATTERNS = [
  "Next",
  "Tiếp",
  "Continue",
  "Weiter",
  "Suivant",
  "Siguiente",
  "Avanti",
  "Próximo",
  "Далее",
  "次へ",
  "下一步",
];

/**
 * Check if a "Next" / "Continue" navigation button exists on the current page.
 * Returns the button text found, or null if only Submit remains.
 */
async function findNextButton(page: Page): Promise<string | null> {
  try {
    // Strategy 1: Look for role="button" elements containing "Next" text
    for (const text of NEXT_PATTERNS) {
      // Try various selectors for the Next button
      const selectors = [
        `div[role="button"]:has-text("${text}")`,
        `button:has-text("${text}")`,
        `span[role="button"]:has-text("${text}")`,
        `[aria-label*="${text}"]`,
      ];

      for (const sel of selectors) {
        const el = page.locator(sel).first();
        if ((await el.count()) > 0 && (await el.isVisible())) {
          // Verify this isn't the Submit button (some forms have "Next" as last step
          // but we should check both exist)
          return text;
        }
      }
    }

    // Strategy 2: Look for any button/div that has role="button" and is at the
    // bottom of the form (navigation area) — Google Forms usually has a footer bar
    // with either "Next" or "Submit". If we see "Submit", there's no Next.
    const submitExists =
      (await page.locator(
        'div[role="button"]:has-text("Submit"), ' +
        'button:has-text("Submit"), ' +
        'div[role="button"]:has-text("Gửi"), ' +
        'button:has-text("Gửi"), ' +
        '[type="submit"], ' +
        '.freebirdFormviewerViewNavigationSubmitButton'
      ).first().count()) > 0;

    if (submitExists) return null;

    // Strategy 3: Generic — find any navigational button that isn't "Submit"
    // in the form footer area. This catches unusual locales.
    const footerButtons = page.locator(
      '.freebirdFormviewerViewNavigationNavControls [role="button"], ' +
      '[data-automation-id="page-navigation"] [role="button"], ' +
      '[data-automation-id="page-navigation"] button'
    );

    const count = await footerButtons.count();
    for (let i = 0; i < count; i++) {
      const text = (await footerButtons.nth(i).textContent())?.trim() || "";
      if (text && !text.toLowerCase().includes("submit") && !text.toLowerCase().includes("gửi")) {
        return text;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Click the "Next" navigation button.
 */
async function clickNextButton(page: Page, buttonText: string): Promise<void> {
  for (const text of NEXT_PATTERNS) {
    if (buttonText !== text && !buttonText.toLowerCase().includes(text.toLowerCase())) continue;

    const selectors = [
      `div[role="button"]:has-text("${buttonText}")`,
      `button:has-text("${buttonText}")`,
      `span[role="button"]:has-text("${buttonText}")`,
      `[aria-label*="${buttonText}"]`,
    ];

    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible())) {
        await el.click();
        return;
      }
    }
  }

  // Fallback: try clicking the first navigational button in the form footer
  const footerBtn = page
    .locator(
      '.freebirdFormviewerViewNavigationNavControls [role="button"], ' +
      '[data-automation-id="page-navigation"] [role="button"]'
    )
    .first();
  if ((await footerBtn.count()) > 0) {
    await footerBtn.click();
  }
}

/**
 * Check if the current page has a visible Submit button.
 */
/* ===== Submit button selectors ===== */
/** All selectors that can detect a Google Forms Submit button.

 * NOTE on Vietnamese text matching:
 * The text "Gửi" on the form may use decomposed Unicode (ư + combining ̉)
   while our literal "Gửi" uses precomposed Unicode (ử). CSS `:has-text()` and
   `[aria-label*=]` do NOT normalize, so they fail to match.
   To work around this we include jsname-based selectors (Google's internal JS
   identifier, language-agnostic) and a JS-based normalized-text fallback. */
const SUBMIT_SELECTORS = [
  // --- English text ---
  'div[role="button"]:has-text("Submit")',
  'button:has-text("Submit")',
  'span[role="button"]:has-text("Submit")',
  // --- Vietnamese text (precomposed — may fail due to Unicode NFD/NFC mismatch) ---
  'div[role="button"]:has-text("Gửi")',
  'button:has-text("Gửi")',
  'div[role="button"]:has-text("Nộp")',
  'button:has-text("Nộp")',
  'span[role="button"]:has-text("Nộp")',
  // --- Language-agnostic (type / class) ---
  '[type="submit"]',
  '.freebirdFormviewerViewNavigationSubmitButton',
  // --- Google Forms JS-internal name (stable, language-agnostic) ---
  // In the current markup the Submit button has jsname="M2UYVd" while
  // the Back button has jsname="GeGHKb". Using jsname avoids text matching
  // entirely, so Unicode normalization is never an issue.
  'div[jsname="M2UYVd"]',
  // --- Navigation-area scoped (catches any submit-like text there) ---
  '.freebirdFormviewerViewNavigationNavControls :has-text("Submit")',
  '.freebirdFormviewerViewNavigationNavControls :has-text("Nộp")',
  // --- aria-label ---
  '[aria-label*="Submit"]',
  '[aria-label*="Nộp"]',
];

/** Fallback: find Submit by normalized text content in the nav controls.
 *  This handles Unicode NFC/NFD mismatches that break CSS `:has-text()`. */
async function findSubmitNormalized(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const nav = document.querySelector(".freebirdFormviewerViewNavigationNavControls");
      if (!nav) return false;
      // Normalize all text nodes inside the nav and search for submit-like tokens
      const text = nav.textContent || "";
      const nfc = text.normalize("NFC").toLowerCase();
      return nfc.includes("gửi") || nfc.includes("nộp") || nfc.includes("submit");
    });
  } catch {
    return false;
  }
}

async function findSubmitButton(page: Page): Promise<boolean> {
  try {
    for (const sel of SUBMIT_SELECTORS) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible())) {
        return true;
      }
    }
    // CSS selectors can fail due to Unicode NFC/NFD mismatch on Vietnamese
    // characters. Try normalized text matching as a fallback.
    return await findSubmitNormalized(page);
  } catch {
    return false;
  }
}

/**
 * Wait for the next page to fully load after clicking a navigation button.
 * Re-checks for new question elements.
 */
async function waitForPageTransition(page: Page): Promise<void> {
  try {
    // Wait for the old questions to potentially disappear and new ones to appear
    await page.waitForTimeout(500);
    await page.waitForSelector('div[role="listitem"]', { timeout: 10000 });
    // Extra stability delay for Google Forms' JS transitions
    await page.waitForTimeout(300);
  } catch {
    // If waitForSelector times out, just wait and continue
    await page.waitForTimeout(1000);
  }
}

/**
 * Extract the form title from the Google Form page.
 * Uses multiple fallback strategies in order of reliability.
 */
async function extractFormTitle(page: Page): Promise<string> {
  try {
    const title = await page.evaluate(() => {
      // Strategy 1: h1 heading
      const h1 = document.querySelector<HTMLElement>("h1");
      if (h1?.textContent?.trim()) return h1.textContent.trim();

      // Strategy 2: Freebird header class
      const freebird = document.querySelector<HTMLElement>(".freebirdFormviewerViewHeaderTitle");
      if (freebird?.textContent?.trim()) return freebird.textContent.trim();

      // Strategy 3: role="heading" with long text (form titles are typically long)
      const headings = document.querySelectorAll<HTMLElement>('[role="heading"]');
      for (const h of headings) {
        const text = h.textContent?.trim();
        if (text && text.length > 15) return text;
      }

      // Strategy 4: HTML document title
      if (document.title && document.title !== "Google Forms") return document.title;

      return "Untitled Form";
    });
    return title.replace(/Google (Docs|Forms)/i, "").trim();
  } catch {
    return "Untitled Form";
  }
}

/**
 * Extract the total number of pages from the Google Forms progress bar.
 * Google Forms shows a progress indicator with text like:
 *   - "Page 1 of 6" (English)
 *   - "Trang 1 trong tổng số 6" (Vietnamese)
 *   - "Seite 1 von 6" (German)
 *
 * Returns null if the progress bar isn't found or can't be parsed.
 */
async function extractTotalPages(page: Page): Promise<number | null> {
  try {
    // Try multiple selectors for the page info element
    const selectors = [
      ".HZh16d", // Current Google Forms CSS class
      ".freebirdFormviewerViewHeaderPageInfo", // Legacy class
      '[id][class]:has-text("trong tổng số")', // Vietnamese fallback
    ];

    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0) {
        const text = await el.textContent();
        if (text) {
          // Extract all numbers; for "Page X of Y" the last number is the total
          const numbers = text.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            return parseInt(numbers[numbers.length - 1], 10);
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Scan a Google Form with multi-page/section support.
 *
 * Algorithm:
 * 1. Navigate to the form URL
 * 2. Read total page count from the progress bar (if visible)
 * 3. Scan visible fields on the current page
 * 4. Look for a "Next" / "Continue" navigation button
 * 5. If found, click it, wait for transition, and repeat from step 2
 * 6. When no "Next" button is found (Submit remains), stop
 * 7. For single-page forms, this works seamlessly (one iteration only)
 */

/** Compare two arrays of fields by title, type, and options to detect duplicates. */
function fieldsEqual(a: FormField[], b: FormField[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((f, i) => {
    const g = b[i];
    return (
      f.title === g.title &&
      f.type === g.type &&
      JSON.stringify(f.options) === JSON.stringify(g.options)
    );
  });
}

export async function scanForm(url: string): Promise<FormStructure> {
  const page = await newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for the form container to render
    await page.waitForSelector('div[role="listitem"]', { timeout: 15000 });

    // Extract form title
    const formTitle = await extractFormTitle(page);

    // Read total page count from the progress bar.
    // Google Forms shows "Page 1 of 6" / "Trang 1 trong tổng số 6" at the top.
    // This gives us an exact upper bound so we don't over-scan due to
    // false Next-button detection on the last page.
    const totalPages = await extractTotalPages(page);
    if (totalPages !== null) {
      console.log(`[scan] Progress bar indicates ${totalPages} total pages`);
    }

    // Multi-page scan loop
    const pages: FormPage[] = [];
    let pageIndex = 0;
    let globalIdx = 0;
    // Safety limit: use progress bar count if available, else fall back to 20
    let maxPages = totalPages ?? 20;
    let stalePageCount = 0; // Count of consecutive identical pages
    let isRepeating = false; // Set after detecting repeated content pattern

    while (maxPages > 0) {
      maxPages--;

      // Scan visible fields on current page, using sequential global IDs
      const { fields, nextGlobalIdx } = await scanCurrentPage(page, pageIndex, globalIdx);
      pages.push({ pageIndex, fields });
      globalIdx = nextGlobalIdx;

      // Content-change detection: compute a hash of field signatures
      // (title + type) to detect when pages repeat identically.
      // When content is stale we DON'T stop (to capture all pages for
      // the filler), but we flag the pattern so wait times can be reduced.
      if (pages.length >= 2) {
        const prev = pages[pages.length - 2].fields;
        const curr = pages[pages.length - 1].fields;

        const sameContent =
          prev.length === curr.length &&
          prev.every((f, i) => f.title === curr[i].title && f.type === curr[i].type);

        if (sameContent) {
          stalePageCount++;
          if (stalePageCount >= 3) {
            isRepeating = true;
          }
        } else {
          stalePageCount = 0;
        }
      }

      // Auto-fill required fields so the Next button is enabled.
      // Google Forms blocks navigation until all required questions
      // on the current page are answered.
      const hasRequired = fields.some((f) => f.required);
      if (hasRequired) {
        await fillRequiredFields(page, fields);
        await page.waitForTimeout(300); // Let form JS validate
      }

      // Check if there's a "Next" button (vs Submit on last page)
      const nextText = await findNextButton(page);

      // If no Next button found, we're on the last page
      if (!nextText) break;

      // Early exit: if we know the total page count and we've scanned
      // that many pages, stop (prevents duplicate scans from false matches).
      if (totalPages !== null && pages.length >= totalPages) break;

      // Click Next and wait for the next page to load
      await clickNextButton(page, nextText);

      // Wait for page transition.
      // If in a repeating section (content unchanged for 3+ pages),
      // use a shorter wait since the DOM pattern is already known.
      if (isRepeating) {
        await page.waitForTimeout(500);
        // Quick check: if new listitems appeared, we're good
        const itemCount = await page.locator('div[role="listitem"]').count();
        if (itemCount === 0) await page.waitForTimeout(500);
      } else {
        try {
          await page.waitForSelector('div[role="listitem"]', { timeout: 10000 });
          await page.waitForTimeout(300);
        } catch {
          await page.waitForTimeout(500);
          const stillHasItems = await page.locator('div[role="listitem"]').count();
          if (stillHasItems === 0) break;
        }
      }

      pageIndex++;
    }

    // Deduplicate consecutive pages with identical content.
    // This handles cases where a required-page fill failed silently, causing
    // the scanner to re-scan the same page without advancing.
    const dedupedPages: FormPage[] = [];
    for (const pg of pages) {
      const last = dedupedPages[dedupedPages.length - 1];
      if (last && fieldsEqual(last.fields, pg.fields)) {
        continue;
      }
      dedupedPages.push(pg);
    }
    if (dedupedPages.length !== pages.length) {
      console.log(`[scan] Dedup: ${pages.length} → ${dedupedPages.length} pages`);
    }

    // Build flat fields list for backward compatibility
    const allFields = dedupedPages.flatMap((p) => p.fields);

    return {
      url,
      title: formTitle,
      pages: dedupedPages,
      fields: allFields,
    };

    return {
      url,
      title: formTitle,
      pages,
      fields: allFields,
    };
  } finally {
    await closePage(page);
  }
}

/**
 * Re-scan only the visible fields on the current page during execution.
 * Used by the filler after page transitions to refresh field references.
 */
export async function scanVisibleFields(page: Page, pageIndex: number): Promise<FormPage> {
  const { fields } = await scanCurrentPage(page, pageIndex, 0);
  return { pageIndex, fields };
}

// Export helpers for use by filler and tests
/**
 * Click the Submit button on the current page.
 * Tries CSS selectors first; if they fail (Unicode mismatch), falls back to
 * finding the button by normalized text content in the nav controls.
 * Returns true if a button was found and clicked.
 */
async function clickSubmitButton(page: Page): Promise<boolean> {
  // Strategy 1 — try each CSS selector from SUBMIT_SELECTORS
  for (const sel of SUBMIT_SELECTORS) {
    const btn = page.locator(sel).first();
    if ((await btn.count()) > 0 && (await btn.isVisible())) {
      await btn.click();
      return true;
    }
  }

  // Strategy 2 — fallback: find the Submit button by normalized text
  // inside the navigation controls. This handles Unicode NFC/NFD where
  // "Gửi" (decomposed) does not match :has-text("Gửi") (precomposed).
  try {
    const clicked = await page.evaluate(() => {
      const nav = document.querySelector(".freebirdFormviewerViewNavigationNavControls");
      if (!nav) return false;
      const buttons = nav.querySelectorAll<HTMLElement>('div[role="button"]');
      for (const btn of buttons) {
        const text = (btn.textContent || "").normalize("NFC").toLowerCase();
        const label = (btn.getAttribute("aria-label") || "").normalize("NFC").toLowerCase();
        const match = text.includes("gửi") || text.includes("nộp") || text.includes("submit")
                   || label.includes("gửi") || label.includes("nộp") || label.includes("submit");
        if (match) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    return clicked;
  } catch {
    return false;
  }
}

export { clickSubmitButton, findNextButton, clickNextButton, findSubmitButton, SUBMIT_SELECTORS, waitForPageTransition };
