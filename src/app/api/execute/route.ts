import { executeOne, getFillDelay } from "@/lib/filler";
import { createHistoryEntry } from "@/lib/csv-logger";
import type { FormConfig, RoundResult } from "@/types";

/**
 * POST /api/execute
 * Body: { config: FormConfig }
 * Stream execution results via Server-Sent Events.
 * Each event is a JSON line under "data:" prefix.
 *
 * All data is wrapped in { type, data } format so the client's
 * parser can identify event types via data.type.
 *
 * If config.pages is provided, the filler iterates through pages
 * automatically (multi-page support). Otherwise, treats all fields
 * as belonging to a single page (backward-compatible).
 */
export async function POST(req: Request) {
  const body = await req.json();
  const config: FormConfig = body.config ?? body;

  if (!config.url || !config.fields || !config.loopCount) {
    return new Response(JSON.stringify({ error: "Invalid config" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const loopCount = Math.min(Math.max(1, config.loopCount), 100);
  const startTime = new Date().toISOString();
  const results: RoundResult[] = [];
  const pageCount = config.pages?.length ?? 1;
  let aborted = false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (aborted || req.signal.aborted) {
          aborted = true;
          return;
        }
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          aborted = true;
        }
      };

      for (let i = 0; i < loopCount; i++) {
        if (aborted || req.signal.aborted) {
          aborted = true;
          break;
        }

        // Progress event — wrapper { type, data } for client parser
        send("progress", { type: "progress", data: { current: i + 1, total: loopCount } });

        // Execute one fill (handles multi-page internally)
        const result: RoundResult = await executeOne(config, req.signal);
        results.push(result);

        // Result event — wrapper { type, data } for client parser
        send("result", { type: "result", data: result });

        // Stop on captcha detection
        if (result.status === "captcha") {
          send("captcha", { type: "captcha", data: { message: "reCAPTCHA detected - execution stopped" } });
          break;
        }

        // Rate limiting delay
        if (i < loopCount - 1 && !aborted) {
          await Promise.race([
            new Promise((resolve) => setTimeout(resolve, getFillDelay())),
            new Promise<void>((resolve) => {
              if (req.signal.aborted) {
                aborted = true;
                resolve();
              } else {
                req.signal.addEventListener(
                  "abort",
                  () => {
                    aborted = true;
                    resolve();
                  },
                  { once: true }
                );
              }
            }),
          ]);
        }
      }

      // Persist to CSV
      const endTime = new Date().toISOString();
      try {
        createHistoryEntry(
          config.url,
          config.title,
          loopCount,
          results,
          startTime,
          endTime,
          pageCount,
        );
      } catch (err) {
        console.error("Failed to save history:", err);
      }

      // Complete event — wrapper { type, data }
      send("complete", {
        type: "complete",
        data: {
          totalRounds: results.length,
          successCount: results.filter((r) => r.status === "success").length,
          errorCount: results.filter((r) => r.status === "error").length,
          captchaDetected: results.some((r) => r.status === "captcha"),
          sessionId: Date.now().toString(36),
        },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
