"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useFormStore } from "@/stores/form-store";
import { useExecutionStore } from "@/stores/execution-store";
import {
  Play,
  Square,
  Loader2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

export function ExecutionPanel({ onCaptcha }: { onCaptcha: () => void }) {
  const { structure, configs, validationErrors, runValidation } = useFormStore();
  const { status, currentRound, totalRounds, results, start, pageCount } =
    useExecutionStore();
  const [loopCount, setLoopCount] = useState(10);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleStart = async () => {
    if (!structure) return;

    // Validate before execution
    const errors = runValidation();

    if (errors.length > 0) {
      // Scroll to config section so user sees the errors
      const configSection = document.getElementById("form-config");
      if (configSection) {
        configSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return; // Don't start — validation failed
    }

    // Build config with page structure
    const config = {
      url: structure.url,
      title: structure.title,
      fields: configs,
      pages: structure.pages.map((p) => ({
        pageIndex: p.pageIndex,
        fieldIds: p.fields.map((f) => f.id),
      })),
      loopCount,
    };

    start(loopCount, structure.pages.length);
    setRunning(true);

    // Create AbortController so Stop can cancel the HTTP request immediately
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
        signal: abortController.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "result") {
                useExecutionStore.getState().addResult(data.data);
              } else if (data.type === "captcha") {
                useExecutionStore.getState().setCaptcha();
                onCaptcha();
              } else if (data.type === "complete") {
                useExecutionStore.getState().complete();
              } else if (data.type === "progress") {
                useExecutionStore.getState().setCurrentRound(data.data.current);
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (err) {
      // If we aborted intentionally, mark as stopped (not error)
      if ((err as Error).name === "AbortError") {
        useExecutionStore.getState().stop();
      } else {
        useExecutionStore.getState().setError((err as Error).message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    // Stop the loop immediately by aborting the HTTP request.
    // This triggers AbortError on the client, and req.signal.aborted
    // on the server so the SSE stream stops processing.
    const ctrl = abortRef.current;
    if (ctrl) {
      ctrl.abort();
      abortRef.current = null;
    }
    useExecutionStore.getState().stop();
    setRunning(false);
  };

  const progress =
    totalRounds > 0 ? Math.round((currentRound / totalRounds) * 100) : 0;
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          Execution
        </CardTitle>
        <CardDescription>Configure loop count and start auto-filling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Validation warning */}
        {validationErrors.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-destructive">
                Fix {validationErrors.length} validation error
                {validationErrors.length > 1 ? "s" : ""} before starting
              </span>
              <ul className="text-xs text-destructive/80 list-disc pl-4 mt-1 space-y-0.5">
                {validationErrors.slice(0, 3).map((err, i) => (
                  <li key={`${err.fieldId}-${i}`}>
                    Page {err.pageIndex + 1}: {err.reason}
                  </li>
                ))}
                {validationErrors.length > 3 && (
                  <li className="text-muted-foreground">
                    ...and {validationErrors.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Loop:</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={loopCount}
              onChange={(e) =>
                setLoopCount(Math.min(100, Math.max(1, Number(e.target.value))))
              }
              disabled={status === "running" || running}
              className="w-20 h-8 text-sm text-center"
            />
          </div>

          <Badge variant="secondary" className="text-xs">
            1–100
          </Badge>

          {/* Page count indicator */}
          {structure && structure.pages.length > 1 && (
            <Badge variant="outline" className="text-xs">
              {structure.pages.length} pages
            </Badge>
          )}

          <div className="ml-auto flex gap-2">
            {status === "running" || running ? (
              <Button variant="destructive" size="sm" onClick={handleStop}>
                <Square className="mr-1 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleStart}
              >
                {validationErrors.length > 0 ? (
                  <>
                    <AlertTriangle className="mr-1 h-4 w-4" />
                    Fix Errors First
                  </>
                ) : status === "completed" || status === "stopped" ? (
                  "Re-run"
                ) : (
                  <>
                    <Play className="mr-1 h-4 w-4" />
                    Start
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(status === "running" ||
          status === "completed" ||
          status === "stopped" ||
          status === "captcha_blocked") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {status === "running" && (
                  <>
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Running...
                    {pageCount > 1 && (
                      <span className="ml-1 text-xs">
                        ({pageCount} pages per form)
                      </span>
                    )}
                  </>
                )}
                {status === "completed" && "Completed"}
                {status === "stopped" && "Stopped"}
                {status === "captcha_blocked" && (
                  <span className="text-amber-500">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    Captcha blocked
                  </span>
                )}
              </span>
              <span className="font-medium">
                {currentRound} / {totalRounds}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-500">
                ✓ {successCount} success
              </span>
              {errorCount > 0 && (
                <span className="text-destructive">✗ {errorCount} error</span>
              )}
            </div>
          </div>
        )}

        {/* Rate limit info */}
        <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          Rate limit: 4–6 forms/min (random 10–15s delay). Max 9/min safety cap.
        </div>
      </CardContent>
    </Card>
  );
}
