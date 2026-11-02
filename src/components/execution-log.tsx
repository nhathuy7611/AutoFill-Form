"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useExecutionStore } from "@/stores/execution-store";
import { ClipboardList, CheckCircle2, XCircle, ShieldAlert, FileText } from "lucide-react";

export function ExecutionLog() {
  const { results, status, pageCount } = useExecutionStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Execution Log
        </CardTitle>
        <CardDescription>
          {results.length === 0
            ? "Results will appear here during execution"
            : `${results.length} submissions recorded`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-3" ref={scrollRef}>
          {results.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No results yet
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border p-3 text-sm space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Round {i + 1} — {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Page count badge */}
                      {r.pageCount && r.pageCount > 1 && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {r.pageCount}pg
                        </span>
                      )}
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  {r.status === "captcha" && (
                    <div className="flex items-center gap-1 text-amber-500 text-xs">
                      <ShieldAlert className="h-3 w-3" />
                      {r.error || "reCAPTCHA detected"}
                      {r.currentPageIndex !== undefined && r.pageCount && (
                        <span className="text-muted-foreground ml-1">
                          (page {r.currentPageIndex + 1}/{r.pageCount})
                        </span>
                      )}
                    </div>
                  )}
                  {r.status === "error" && (
                    <div className="text-destructive text-xs">{r.error}</div>
                  )}
                  {Object.keys(r.data).length > 0 && (
                    <div className="rounded bg-muted/30 p-1.5 text-xs font-mono space-y-0.5">
                      {Object.entries(r.data).map(([key, val]) => (
                        <div key={key} className="truncate text-muted-foreground">
                          <span className="text-foreground">{key}:</span> {val}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success")
    return (
      <Badge variant="success" className="text-xs">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Success
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive" className="text-xs">
        <XCircle className="mr-1 h-3 w-3" />
        Error
      </Badge>
    );
  return (
    <Badge variant="warning" className="text-xs">
      <ShieldAlert className="mr-1 h-3 w-3" />
      Captcha
    </Badge>
  );
}
