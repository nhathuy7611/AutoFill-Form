"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink, Clock, RotateCcw, CheckCircle2, XCircle, ShieldAlert, History as HistoryIcon, FileText } from "lucide-react";
import type { HistoryEntry, RoundResult } from "@/types";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<RoundResult[] | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const json = await res.json();
      if (json.ok) setHistory(json.history);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: string) => {
    setSelectedId(id);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/history?id=${id}`);
      const json = await res.json();
      if (json.ok) setDetails(json.results);
    } catch {
      setDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    return `${min}m ${sec % 60}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Execution History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View past auto-fill sessions and their results
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
          <RotateCcw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Loading history...
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground gap-2">
          <HistoryIcon className="h-10 w-10 opacity-30" />
          <p>No execution history yet</p>
          <p className="text-xs">Run an auto-fill session to see results here</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          {/* History list (chat-style) */}
          <div className="space-y-3">
            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => fetchDetails(entry.id)}
                className={`w-full text-left rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                  selectedId === entry.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{entry.formTitle}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.url}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(entry.duration)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {entry.totalRounds} rounds
                    </span>
                    {entry.pageCount && entry.pageCount > 1 && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        {entry.pageCount} pages
                      </span>
                    )}
                    <div className="flex gap-1">
                      <Badge variant="success" className="text-xs">
                        {entry.successCount}
                      </Badge>
                      {entry.errorCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {entry.errorCount}
                        </Badge>
                      )}
                      {entry.captchaBlocked && (
                        <Badge variant="warning" className="text-xs">
                          CAPTCHA
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Session Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedId ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  Select a session to view details
                </div>
              ) : loadingDetails ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  Loading...
                </div>
              ) : details && details.length > 0 ? (
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {details.map((r, i) => (
                      <div
                        key={i}
                        className="rounded border border-border p-2 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Round {i + 1}</span>
                          <div className="flex items-center gap-2">
                            {r.pageCount && r.pageCount > 1 && (
                              <span className="text-[10px] text-muted-foreground">
                                {r.pageCount}pg
                              </span>
                            )}
                            <StatusIcon status={r.status} />
                          </div>
                        </div>
                        <div className="font-mono text-muted-foreground">
                          {Object.entries(r.data).slice(0, 2).map(([k, v]) => (
                            <div key={k} className="truncate">
                              {k.substring(0, 12)}: {v}
                            </div>
                          ))}
                          {Object.keys(r.data).length > 2 && (
                            <div className="text-muted-foreground/60">
                              +{Object.keys(r.data).length - 2} more fields
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  No detailed results available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "error") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />;
}
