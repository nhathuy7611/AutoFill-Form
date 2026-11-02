import { NextResponse } from "next/server";
import { readHistory, readResults } from "@/lib/csv-logger";

/**
 * GET /api/history
 * Returns all history entries (newest first).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      // Return detailed results for a specific session
      const results = readResults(id);
      return NextResponse.json({ ok: true, results });
    }

    const history = readHistory();
    return NextResponse.json({ ok: true, history });
  } catch (err) {
    const message = (err as Error).message;
    console.error("History error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
