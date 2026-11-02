"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFormStore } from "@/stores/form-store";
import { Scan, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FileText } from "lucide-react";

export function FormScanner() {
  const { structure, scanning, scanError, setStructure, setScanning, setScanError } = useFormStore();
  const [url, setUrl] = useState("");
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set([0]));

  const handleScan = async () => {
    if (!url.trim()) return;
    setScanning(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        setScanError(json.error || "Scan failed");
      } else {
        setStructure(json.structure);
      }
    } catch (err) {
      setScanError((err as Error).message);
    }
  };

  const typeLabel: Record<string, string> = {
    short_text: "Short Text",
    long_text: "Long Text",
    radio: "Radio",
    checkbox: "Checkbox",
    dropdown: "Dropdown",
  };

  const togglePage = (pageIdx: number) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIdx)) next.delete(pageIdx);
      else next.add(pageIdx);
      return next;
    });
  };

  const isMultiPage = structure && structure.pages.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5 text-primary" />
          Form Scanner
        </CardTitle>
        <CardDescription>Enter a public Google Form URL to scan its structure</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Input */}
        <div className="flex gap-2">
          <Input
            placeholder="https://docs.google.com/forms/d/e/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            disabled={scanning}
          />
          <Button onClick={handleScan} disabled={scanning || !url.trim()}>
            {scanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning
              </>
            ) : (
              "Scan"
            )}
          </Button>
        </div>

        {/* Error */}
        {scanError && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}

        {/* Form Structure Preview */}
        {structure && (
          <div className="rounded-md border border-border">
            {/* Form title */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">{structure.title}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {structure.fields.length} fields
              </Badge>
              {isMultiPage && (
                <Badge variant="outline" className="text-xs">
                  {structure.pages.length} pages
                </Badge>
              )}
            </div>

            {/* Page-grouped fields */}
            <div className="divide-y divide-border">
              {structure.pages.map((page) => (
                <div key={page.pageIndex}>
                  {/* Page header (clickable accordion) */}
                  <button
                    onClick={() => togglePage(page.pageIndex)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/30 transition-colors"
                  >
                    {isMultiPage ? (
                      <>
                        {expandedPages.has(page.pageIndex) ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">Page {page.pageIndex + 1}</span>
                        <Badge variant="outline" className="text-xs ml-1">
                          {page.fields.length} fields
                        </Badge>
                      </>
                    ) : (
                      /* Single page — no accordion needed */
                      <span className="text-xs text-muted-foreground">Fields</span>
                    )}
                  </button>

                  {/* Page fields */}
                  {(expandedPages.has(page.pageIndex) || !isMultiPage) && (
                    <div className="border-t border-border divide-y divide-border">
                      {page.fields.map((f) => (
                        <div key={f.id} className="flex items-center gap-3 px-4 py-2 pl-8 text-sm">
                          <span className="text-muted-foreground shrink-0">
                            {page.pageIndex * 100 + f.index + 1}.
                          </span>
                          <span className="flex-1 truncate">{f.title}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {typeLabel[f.type] || f.type}
                          </Badge>
                          {f.required && <span className="text-destructive text-xs shrink-0">*</span>}
                          {f.options && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {f.options.length} options
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
