"use client";

import { useState, useMemo, useCallback } from "react";
import { useFormStore, validateConfig } from "@/stores/form-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FieldValidationError } from "@/types";
import {
  Sliders,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";

/* ===== Component ===== */

export function FormConfig() {
  const { structure, configs, updateConfig, validationErrors, runValidation, clearValidationErrors } =
    useFormStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activePage, setActivePage] = useState(0);
  const [showValidation, setShowValidation] = useState(false);

  if (!structure) return null;

  // Compute fieldId → error map for quick lookup
  const errorMap = useMemo(() => {
    const map = new Map<string, FieldValidationError>();
    for (const err of validationErrors) {
      map.set(err.fieldId, err);
    }
    return map;
  }, [validationErrors]);

  // Get current page's fields
  const currentPage = structure.pages[activePage] || structure.pages[0];
  const isMultiPage = structure.pages.length > 1;

  const toggle = (fieldId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  // Normalize ratios to sum to 100
  const normalizeRatios = useCallback(
    (fieldIdx: number) => {
      const cfg = configs[fieldIdx];
      if (!cfg?.ratios) return;
      // Don't normalize checkboxes — each option has independent probability
      if (cfg.type === "checkbox") return;
      const entries = Object.entries(cfg.ratios);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      if (total === 0) return;
      const factor = 100 / total;
      const normalized = Object.fromEntries(
        entries.map(([k, v]) => [k, Math.round(v * factor * 10) / 10])
      );
      updateConfig(fieldIdx, { ratios: normalized });
    },
    [configs, updateConfig]
  );

  const handleRatioChange = (fieldIdx: number, option: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const cfg = configs[fieldIdx];
    const ratios = { ...cfg?.ratios, [option]: num };
    updateConfig(fieldIdx, { ratios });
  };

  const handleTextChange = (fieldIdx: number, value: string) => {
    updateConfig(fieldIdx, { textValue: value });
  };

  const handleValidate = () => {
    setShowValidation(true);
    runValidation();
  };

  // Auto-validate when user switches pages or edits
  const handlePageChange = (pageIdx: number) => {
    setActivePage(pageIdx);
    // Re-validate if user had already triggered validation
    if (showValidation && validationErrors.length > 0) {
      runValidation();
    }
  };

  // Find the config index for a given fieldId in the flat configs array
  const getConfigIdx = (fieldId: string): number => {
    return configs.findIndex((c) => c.fieldId === fieldId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          Configuration
        </CardTitle>
        <CardDescription>
          Set answer ratios for choice fields and text for input fields
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Page tabs (multi-page only) */}
        {isMultiPage && (
          <div className="flex flex-wrap gap-1 border-b border-border pb-2">
            {structure.pages.map((page) => {
              const pageErrors = validationErrors.filter(
                (e) => e.pageIndex === page.pageIndex
              );
              const isActive = activePage === page.pageIndex;

              return (
                <button
                  key={page.pageIndex}
                  onClick={() => handlePageChange(page.pageIndex)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Page {page.pageIndex + 1}
                  <Badge variant="outline" className="text-[10px] px-1">
                    {page.fields.length}
                  </Badge>
                  {pageErrors.length > 0 && (
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Validation summary */}
        {showValidation && validationErrors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              {validationErrors.length} validation error{validationErrors.length > 1 ? "s" : ""}
            </div>
            <ul className="text-xs text-destructive/80 list-disc pl-5 space-y-0.5">
              {validationErrors.map((err, i) => {
                const field = structure.fields.find((f) => f.id === err.fieldId);
                const fieldLabel = field?.title || err.fieldId;
                return (
                  <li key={`${err.fieldId}-${i}`}>
                    <span className="font-medium">Page {err.pageIndex + 1}:</span> {fieldLabel} — {err.reason}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Success validation message */}
        {showValidation && validationErrors.length === 0 && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>All fields are configured correctly!</span>
          </div>
        )}

        {/* Current page fields */}
        <div className="space-y-3">
          {currentPage.fields.map((field) => {
            const cfgIdx = getConfigIdx(field.id);
            const cfg = configs[cfgIdx];
            if (!cfg) return null;

            const isExpanded = expanded.has(field.id);
            const isChoice =
              field.type === "radio" ||
              field.type === "checkbox" ||
              field.type === "dropdown";
            const isText =
              field.type === "short_text" || field.type === "long_text";
            const fieldError = errorMap.get(field.id);

            return (
              <div
                key={field.id}
                className={`rounded-md border overflow-hidden transition-colors ${
                  fieldError
                    ? "border-destructive/50 bg-destructive/[0.02]"
                    : "border-border"
                }`}
              >
                {/* Field header */}
                <button
                  onClick={() => toggle(field.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium">{field.title}</span>
                  {field.required && (
                    <span className="text-muted-foreground text-xs">(required)</span>
                  )}
                  <span className="text-xs text-muted-foreground capitalize ml-auto">
                    {field.type.replace("_", " ")}
                  </span>
                  {field.required && (
                    <span className="text-destructive text-xs">*</span>
                  )}
                  {/* Red asterisk for validation errors */}
                  {fieldError && (
                    <span
                      className="text-destructive text-sm font-bold animate-pulse"
                      title={fieldError.reason}
                    >
                      *!
                    </span>
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    {isText && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">
                          Text:
                        </span>
                        <Input
                          placeholder={
                            field.required
                              ? "Required — enter a value..."
                              : "Auto-filled text..."
                          }
                          value={cfg.textValue || ""}
                          onChange={(e) => handleTextChange(cfgIdx, e.target.value)}
                          className={`h-8 text-sm ${
                            fieldError ? "border-destructive" : ""
                          }`}
                        />
                      </div>
                    )}

                    {isChoice &&
                      field.options?.map((opt) => (
                        <div key={opt} className="flex items-center gap-2">
                          <span
                            className="text-xs text-muted-foreground w-1/2 truncate"
                            title={opt}
                          >
                            {opt}
                          </span>
                          {/* "Always" toggle for checkbox options */}
                          {field.type === "checkbox" && (
                            <button
                              type="button"
                              onClick={() => {
                                const current = cfg.ratios?.[opt] ?? 0;
                                const newVal = current >= 100 ? 0 : 100;
                                const ratios = { ...cfg.ratios, [opt]: newVal };
                                updateConfig(cfgIdx, { ratios });
                              }}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors shrink-0 ${
                                (cfg.ratios?.[opt] ?? 0) >= 100
                                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                                  : "text-muted-foreground border-border hover:border-primary/50"
                              }`}
                              title="Always choose this option"
                            >
                              Always
                            </button>
                          )}
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={cfg.ratios?.[opt] ?? 0}
                              onChange={(e) =>
                                handleRatioChange(cfgIdx, opt, e.target.value)
                              }
                              className="flex-1 h-1.5 accent-primary"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={cfg.ratios?.[opt] ?? 0}
                              onChange={(e) =>
                                handleRatioChange(cfgIdx, opt, e.target.value)
                              }
                              onBlur={() => normalizeRatios(cfgIdx)}
                              className="w-14 h-7 rounded border border-border text-xs text-center"
                            />
                            <span className="text-xs text-muted-foreground w-4">
                              %
                            </span>
                          </div>
                        </div>
                      ))}

                    {/* Error message */}
                    {fieldError && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {fieldError.reason}
                      </div>
                    )}

                    {/* Total indicator for radio/dropdown choice fields (not checkbox — each option is independent) */}
                    {isChoice && field.type !== "checkbox" && cfg.ratios && (
                      <div className="flex justify-end text-xs">
                        <span
                          className={
                            Math.abs(
                              Object.values(cfg.ratios).reduce((s, v) => s + v, 0) -
                                100
                            ) < 0.1
                              ? "text-emerald-500"
                              : "text-amber-500"
                          }
                        >
                          Total:{" "}
                          {Object.values(cfg.ratios)
                            .reduce((s, v) => s + v, 0)
                            .toFixed(1)}
                          %
                          {Math.abs(
                            Object.values(cfg.ratios).reduce((s, v) => s + v, 0) -
                              100
                          ) >= 0.1 && " (should be 100%)"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Validation button */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {validationErrors.length > 0
              ? `${validationErrors.length} issue${validationErrors.length > 1 ? "s" : ""} found`
              : showValidation
              ? "All valid"
              : `${structure.fields.length} field${structure.fields.length > 1 ? "s" : ""} across ${structure.pages.length} page${structure.pages.length > 1 ? "s" : ""}`}
          </span>
          <Button
            variant={validationErrors.length > 0 ? "destructive" : "outline"}
            size="sm"
            onClick={handleValidate}
          >
            {validationErrors.length > 0 ? (
              <>
                <AlertCircle className="mr-1 h-4 w-4" />
                Re-validate
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Validate
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
