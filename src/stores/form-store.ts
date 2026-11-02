import { create } from "zustand";
import type { FormStructure, FormField, FieldConfig, FieldValidationError } from "@/types";

/* ===== Validation Helper ===== */

/**
 * Validate all field configs against the form structure.
 * Returns a list of errors. An empty list means all configs are valid.
 *
 * Checks:
 * - Required text/textarea fields must have a non-empty textValue
 * - Required radio/dropdown fields must have ratios configured
 * - Choice field ratio totals must be close to 100%
 * - All fields must have a config entry
 */
export function validateConfig(
  structure: FormStructure,
  configs: FieldConfig[]
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  for (const page of structure.pages) {
    for (const field of page.fields) {
      const cfg = configs.find((c) => c.fieldId === field.id);
      if (!cfg) {
        errors.push({
          fieldId: field.id,
          pageIndex: page.pageIndex,
          reason: "Missing configuration",
        });
        continue;
      }

      // Check required fields
      if (field.required) {
        if (
          (field.type === "short_text" || field.type === "long_text") &&
          (!cfg.textValue || cfg.textValue.trim() === "")
        ) {
          errors.push({
            fieldId: field.id,
            pageIndex: page.pageIndex,
            reason: "Required text field has no value",
          });
        }

        if (
          (field.type === "radio" || field.type === "dropdown") &&
          (!cfg.ratios || Object.keys(cfg.ratios).length === 0)
        ) {
          errors.push({
            fieldId: field.id,
            pageIndex: page.pageIndex,
            reason: "Required choice field has no ratio configuration",
          });
        }
      }

      // Check ratio sum for radio/dropdown (not checkbox — each option is independent)
      if (cfg.ratios && Object.keys(cfg.ratios).length > 0 && field.type !== "checkbox") {
        const total = Object.values(cfg.ratios).reduce((s, v) => s + v, 0);
        if (Math.abs(total - 100) > 2) {
          errors.push({
            fieldId: field.id,
            pageIndex: page.pageIndex,
            reason: `Ratio total is ${total.toFixed(1)}%, should be ≈100% (currently off by ${Math.abs(total - 100).toFixed(1)}%)`,
          });
        }
      }
    }
  }

  return errors;
}

/* ===== Store ===== */

interface FormStore {
  /** Raw structure from scan */
  structure: FormStructure | null;
  /** User configurations per field */
  configs: FieldConfig[];
  /** Loading / error */
  scanning: boolean;
  scanError: string | null;
  /** Validation errors */
  validationErrors: FieldValidationError[];

  // Actions
  setStructure: (s: FormStructure) => void;
  updateConfig: (idx: number, config: Partial<FieldConfig>) => void;
  resetConfig: () => void;
  setScanning: (v: boolean) => void;
  setScanError: (e: string | null) => void;
  setValidationErrors: (errors: FieldValidationError[]) => void;
  clearValidationErrors: () => void;
  /** Run validation against current structure + configs and store the errors */
  runValidation: () => FieldValidationError[];
  resetAll: () => void;
}

export const useFormStore = create<FormStore>((set, get) => ({
  structure: null,
  configs: [],
  scanning: false,
  scanError: null,
  validationErrors: [],

  setStructure: (structure) => {
    // Auto-initialize configs from structure (flat fields list)
    const configs: FieldConfig[] = structure.fields.map((f) => {
      const base: FieldConfig = { fieldId: f.id, type: f.type };
      if (f.type === "short_text" || f.type === "long_text") {
        base.textValue = "";
      } else if (f.options) {
        const equal = 100 / f.options.length;
        base.ratios = Object.fromEntries(f.options.map((o) => [o, equal]));
      }
      return base;
    });
    set({ structure, configs, scanError: null, validationErrors: [] });
  },

  updateConfig: (idx, partial) => {
    const configs = [...get().configs];
    if (configs[idx]) configs[idx] = { ...configs[idx], ...partial };
    set({ configs });

    // Auto-clear validation errors when user edits
    const { validationErrors } = get();
    if (validationErrors.length > 0) {
      const updatedCfg = configs[idx];
      if (updatedCfg) {
        const remaining = validationErrors.filter(
          (e) => e.fieldId !== updatedCfg.fieldId
        );
        if (remaining.length !== validationErrors.length) {
          set({ validationErrors: remaining });
        }
      }
    }
  },

  resetConfig: () =>
    set((s) => (s.structure ? { configs: [], validationErrors: [] } : {})),

  setScanning: (scanning) => set({ scanning, scanError: null }),

  setScanError: (scanError) => set({ scanError, scanning: false }),

  setValidationErrors: (validationErrors) => set({ validationErrors }),

  clearValidationErrors: () => set({ validationErrors: [] }),

  runValidation: () => {
    const { structure, configs } = get();
    if (!structure) return [];
    const errors = validateConfig(structure, configs);
    set({ validationErrors: errors });
    return errors;
  },

  resetAll: () =>
    set({
      structure: null,
      configs: [],
      scanning: false,
      scanError: null,
      validationErrors: [],
    }),
}));
