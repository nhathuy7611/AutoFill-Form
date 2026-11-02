/**
 * Diagnostic test: open the form, fill each page, and check if Submit appears
 * after the grid page is filled. Logs what happens at each step.
 */
import { newPage, closePage } from "./src/lib/browser";
import type { Page } from "playwright";

const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSep5ThRm1TGIKSAa7twWdU01MahIhzAGyjV6ei5hraeRB2g6w/viewform";

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function hasSubmit(page: Page): Promise<boolean> {
  const selectors = [
    'div[role="button"]:has-text("Submit")',
    'button:has-text("Submit")',
    '[type="submit"]',
    'div[role="button"]:has-text("Gửi")',
    'button:has-text("Gửi")',
    '.freebirdFormviewerViewNavigationSubmitButton',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      const visible = await el.isVisible();
      console.log(`  Submit selector "${sel}": count=${await el.count()}, visible=${visible}`);
      if (visible) return true;
    }
  }
  return false;
}

async function hasNext(page: Page): Promise<boolean> {
  const patterns = ["Next", "Tiếp", "Continue", "Weiter", "Suivant", "Siguiente", "Avanti", "Próximo", "Далее", "次へ", "下一步"];
  for (const text of patterns) {
    const el = page.locator(`div[role="button"]:has-text("${text}")`).first();
    if ((await el.count()) > 0 && (await el.isVisible())) {
      console.log(`  Next button "${text}" FOUND`);
      return true;
    }
  }
  return false;
}

async function clickNext(page: Page): Promise<boolean> {
  const patterns = ["Next", "Tiếp"];
  for (const text of patterns) {
    const el = page.locator(`div[role="button"]:has-text("${text}")`).first();
    if ((await el.count()) > 0 && (await el.isVisible())) {
      console.log(`  → Clicking "${text}"`);
      await el.click();
      return true;
    }
  }
  // Try any navigation button in footer
  const footer = page.locator('.freebirdFormviewerViewNavigationNavControls [role="button"]').first();
  if ((await footer.count()) > 0) {
    const t = await footer.textContent();
    console.log(`  → Clicking footer button "${t?.trim()}"`);
    await footer.click();
    return true;
  }
  return false;
}

async function getPageInfo(page: Page) {
  const title = await page.locator('[role="heading"]').first().textContent().catch(() => "");
  const items = await page.locator('div[role="listitem"]:visible').count();
  const radG = await page.locator('div[role="radiogroup"]:visible').count();
  const navBtnCount = await page.locator('.freebirdFormviewerViewNavigationNavControls [role="button"]').count();
  let navBtnText = "";
  if (navBtnCount > 0) {
    navBtnText = (await page.locator('.freebirdFormviewerViewNavigationNavControls [role="button"]').first().textContent())?.trim() || "";
  }
  return { title: ((await title) || "").slice(0, 50), items, radG, navBtnCount, navBtnText };
}

async function main() {
  const page = await newPage();
  try {
    await page.goto(FORM_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('div[role="listitem"]', { timeout: 15000 });
    await sleep(500);

    // Navigate through pages manually
    for (let pageNum = 0; pageNum < 10; pageNum++) {
      console.log(`\n===== PAGE ${pageNum} =====`);
      const info = await getPageInfo(page);
      console.log(`  Items: ${info.items}, Radiogroups: ${info.radG}, Nav: "${info.navBtnText}"`);

      const submit = await hasSubmit(page);
      console.log(`  Submit: ${submit}`);
      const next = await hasNext(page);
      console.log(`  Next: ${next}`);

      if (submit) {
        console.log("  *** SUBMIT FOUND! ***");
        // Count filled radiogroups
        const filled = await page.evaluate(() => {
          const radios = document.querySelectorAll('div[role="radio"]');
          let checked = 0;
          radios.forEach(r => {
            if (r.getAttribute("aria-checked") === "true" || r.classList.contains("isChecked")) checked++;
          });
          return checked;
        });
        console.log(`  Filled radios: ${filled}`);
        break;
      }

      if (!next && !submit) {
        console.log("  No navigation — end of form");
        break;
      }

      // Fill required fields on this page
      if (pageNum === 0) {
        // Page 0: screening — select "Có"
        console.log("  → Selecting screening option 'Có'");
        const items = page.locator('div[role="listitem"]:visible');
        const radio0 = items.nth(0).locator('div[role="radio"][data-value="Có"]');
        await radio0.click();
        await sleep(300);
      } else if (pageNum === 1) {
        // Page 1: fill referral source
        console.log("  → Filling referral");
        const items = page.locator('div[role="listitem"]:visible');
        const radio1 = items.nth(1).locator('div[role="radio"][data-value="Mạng xã hội (Facebook, Zalo, LinkedIn,...)"]');
        await radio1.click();
        await sleep(300);
      } else if (pageNum === 2) {
        // Page 2: who referred
        console.log("  → Filling who referred");
        // Not required — skip
      } else if (pageNum === 3) {
        // Page 3: demographics
        console.log("  → Filling demographics");
        const items = page.locator('div[role="listitem"]:visible');
        const groups = page.locator('div[role="radiogroup"]:visible');
        // Each radio is in its own listitem with a radiogroup
        const g0 = groups.nth(0).locator('div[role="radio"]').first();
        await g0.click();
        await sleep(100);
        const g1 = groups.nth(1).locator('div[role="radio"]').first();
        await g1.click();
        await sleep(100);
        const g2 = groups.nth(2).locator('div[role="radio"]').first();
        await g2.click();
        await sleep(100);
        const g3 = groups.nth(3).locator('div[role="radio"]').first();
        await g3.click();
        await sleep(100);
        const g4 = groups.nth(4).locator('div[role="radio"]').first();
        await g4.click();
        await sleep(300);
      } else if (pageNum === 4) {
        // Page 4: Likert grid — fill all 30 rows
        console.log("  → Filling Likert grid");
        const options = ["Rất không đồng ý", "Không đồng ý", "Bình thường", "Đồng ý", "Rất đồng ý"];
        const groups = page.locator('div[role="radiogroup"]:visible');
        const count = await groups.count();
        console.log(`  Found ${count} visible radiogroups`);

        for (let i = 0; i < count; i++) {
          const pick = options[Math.floor(Math.random() * options.length)];
          const radio = groups.nth(i).locator(`div[role="radio"][data-value="${pick}"]`).first();
          const cnt = await radio.count();
          if (cnt > 0) {
            await radio.click();
            await sleep(50);
          } else {
            console.log(`  Row ${i}: data-value "${pick}" not found, trying text...`);
            const byLabel = groups.nth(i).locator(`div[role="radio"][aria-label*="${pick}"]`).first();
            if ((await byLabel.count()) > 0) {
              await byLabel.click();
              await sleep(50);
            } else {
              console.log(`  Row ${i}: CANNOT FIND RADIO for "${pick}"`);
            }
          }
        }
        console.log(`  Clicked ${count} rows`);
        await sleep(500);

        const submit = await hasSubmit(page);
        console.log(`  After fill — Submit: ${submit}`);
        if (!submit) {
          // Check what the navigation area shows
          const navText = await page.locator('.freebirdFormviewerViewNavigationNavControls').textContent().catch(() => "");
          console.log(`  Nav area text: "${navText}"`);
        }
      }

      // Wait and then try clicking Next
      await sleep(500);
      if (!next) {
        // Try clicking any navigation button
        const clicked = await clickNext(page);
        if (clicked) {
          await sleep(1000);
        } else {
          console.log("  No more pages");
          break;
        }
      } else {
        await clickNext(page);
        await sleep(1000);
      }
    }

    console.log("\n===== FINAL CHECK =====");
    const submit = await hasSubmit(page);
    const next = await hasNext(page);
    console.log(`Submit: ${submit}`);
    console.log(`Next: ${next}`);
    const info2 = await getPageInfo(page);
    console.log(`Title: ${info2.title}, Items: ${info2.items}, Radiogroups: ${info2.radG}`);

  } finally {
    await sleep(5000); // Keep browser open so user can see
    await closePage(page);
  }
}

main().catch(console.error);
