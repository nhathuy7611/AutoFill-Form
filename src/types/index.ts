/* ===== Form Field Types ===== */

export type FieldType = "short_text" | "long_text" | "radio" | "checkbox" | "dropdown";

export interface FormField {
  id: string;
  index: number;
  type: FieldType;
  title: string;
  required: boolean;
  /** Options for radio/checkbox/dropdown */
  options?: string[];
}

/** A single page/section in a multi-page Google Form */
export interface FormPage {
  pageIndex: number;
  fields: FormField[];
}

export interface FormStructure {
  url: string;
  title: string;
  /** Page-grouped fields (multi-page support) */
  pages: FormPage[];
  /** Flat list of all fields across pages (backward-compatible) */
  fields: FormField[];
}

/* ===== Configuration Types ===== */

export interface FieldConfig {
  fieldId: string;
  type: FieldType;
  /** optionKey → percentage (sum = 100). For choice fields */
  ratios?: Record<string, number>;
  /** Fixed text value. For text fields */
  textValue?: string;
}

export interface FormConfig {
  url: string;
  title: string;
  fields: FieldConfig[];
  /** Page grouping: which fieldIds belong to which page */
  pages?: { pageIndex: number; fieldIds: string[] }[];
  loopCount: number;
}

/* ===== Validation Types ===== */

export interface FieldValidationError {
  fieldId: string;
  pageIndex: number;
  reason: string;
}

/* ===== Execution Types ===== */

export type ExecutionStatus =
  | "idle"
  | "running"
  | "completed"
  | "stopped"
  | "captcha_blocked"
  | "error";

export interface RoundResult {
  round: number;
  timestamp: string;
  data: Record<string, string>;
  status: "success" | "error" | "captcha";
  error?: string;
  /** Pages navigated during this round (multi-page) */
  pageCount?: number;
  /** Which page we were on when stopped (multi-page) */
  currentPageIndex?: number;
}

export interface ExecutionState {
  status: ExecutionStatus;
  currentRound: number;
  totalRounds: number;
  results: RoundResult[];
  captchaDetected: boolean;
  error?: string;
  startTime?: string;
  endTime?: string;
}

/* ===== History Types ===== */

export interface HistoryEntry {
  id: string;
  timestamp: string;
  url: string;
  formTitle: string;
  totalRounds: number;
  successCount: number;
  errorCount: number;
  captchaBlocked: boolean;
  duration: number;
  /** Number of pages in the form (multi-page support) */
  pageCount?: number;
}

export interface ScanRequest {
  url: string;
}

export interface ExecuteRequest {
  config: FormConfig;
}

export interface ExecuteSSE {
  type: "result" | "progress" | "captcha" | "complete" | "error";
  data: RoundResult | { current: number; total: number } | { message: string };
}
