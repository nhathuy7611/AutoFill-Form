import * as fs from "fs";
import * as path from "path";
import type { HistoryEntry, RoundResult } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.csv");

/** Ensure data directory and CSV header exist */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    const header = "id,timestamp,url,formTitle,totalRounds,successCount,errorCount,captchaBlocked,duration,pageCount\n";
    fs.writeFileSync(HISTORY_FILE, header, "utf-8");
  }
}

/** Create a human-readable session ID from a timestamp string.
 *  Format: exec_YYYYMMDD_HHmmss_rrr (rrr = random suffix for uniqueness).
 *  Files are saved as data/results/{sessionId}.json */
function makeSessionId(timestamp: string): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const suffix = Math.random().toString(36).slice(2, 5);
  return `exec_${y}${mo}${dd}_${hh}${mm}${ss}_${suffix}`;
}

/** Append one history row to CSV */
export function logHistory(entry: HistoryEntry): void {
  ensureDataDir();
  // Escape CSV fields (wrap in quotes if contains comma)
  const esc = (v: string | number | boolean): string => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = [
    esc(entry.id),
    esc(entry.timestamp),
    esc(entry.url),
    esc(entry.formTitle),
    esc(entry.totalRounds),
    esc(entry.successCount),
    esc(entry.errorCount),
    esc(entry.captchaBlocked),
    esc(entry.duration),
    esc(entry.pageCount ?? 1), // default to 1 for backward compat
  ].join(",");
  fs.appendFileSync(HISTORY_FILE, row + "\n", "utf-8");
}

/** Save detailed round results for a session */
export function saveResults(sessionId: string, results: RoundResult[]): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, "results", `${sessionId}.json`);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), "utf-8");
}

/** Read all history rows from CSV */
export function readHistory(): HistoryEntry[] {
  ensureDataDir();
  const content = fs.readFileSync(HISTORY_FILE, "utf-8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  const [, ...dataLines] = lines; // skip header
  return dataLines
    .filter(Boolean)
    .map((line) => {
      // Basic CSV parse (handles simple cases)
      const parts = line.split(",");
      const [id, timestamp, url, formTitle, totalRounds, successCount, errorCount, captchaBlocked, duration, pageCount] =
        parts;
      return {
        id,
        timestamp,
        url,
        formTitle,
        totalRounds: Number(totalRounds),
        successCount: Number(successCount),
        errorCount: Number(errorCount),
        captchaBlocked: captchaBlocked === "true",
        duration: Number(duration),
        pageCount: pageCount ? Number(pageCount) : undefined,
      };
    })
    .reverse(); // newest first
}

/** Load detailed results for a session */
export function readResults(sessionId: string): RoundResult[] {
  const filePath = path.join(DATA_DIR, "results", `${sessionId}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/** Create a history entry from execution data */
export function createHistoryEntry(
  url: string,
  formTitle: string,
  totalRounds: number,
  results: RoundResult[],
  startTime: string,
  endTime: string,
  pageCount?: number,
): HistoryEntry {
  const id = makeSessionId(startTime);
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const captchaBlocked = results.some((r) => r.status === "captcha");
  const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

  const entry: HistoryEntry = {
    id,
    timestamp: startTime,
    url,
    formTitle,
    totalRounds,
    successCount,
    errorCount,
    captchaBlocked,
    duration,
    pageCount,
  };

  logHistory(entry);
  saveResults(id, results);

  return entry;
}
