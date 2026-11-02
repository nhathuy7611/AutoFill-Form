import { NextResponse } from "next/server";
import { scanForm } from "@/lib/scanner";

/**
 * POST /api/scan
 * Body: { url: string }
 * Parse a Google Form URL and return its field structure.
 */
export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!url.includes("forms.google.com") && !url.includes("docs.google.com/forms")) {
      return NextResponse.json({ error: "Not a valid Google Form URL" }, { status: 400 });
    }

    const structure = await scanForm(url);

    return NextResponse.json({ ok: true, structure });
  } catch (err) {
    const message = (err as Error).message;
    console.error("Scan error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
