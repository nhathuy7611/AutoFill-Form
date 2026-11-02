/**
 * Test script: build a FormConfig from the scan result and execute one round.
 * Run: npx tsx test-grid.ts
 */
import { executeOne } from "./src/lib/filler";
import type { FormConfig, FieldConfig } from "./src/types";

const fields: FieldConfig[] = [
  // Page 0: screening
  { fieldId: "field_0", type: "radio", ratios: { "Có": 100 } },

  // Page 1: referral source
  { fieldId: "field_1", type: "short_text", textValue: "Facebook" },
  { fieldId: "field_2", type: "radio", ratios: { "Mạng xã hội (Facebook, Zalo, LinkedIn,...)": 100 } },

  // Page 2: who referred
  { fieldId: "field_3", type: "short_text", textValue: "Bạn bè giới thiệu" },
  { fieldId: "field_4", type: "radio", ratios: { "Ngô Thiên Ân": 34, "Lâm Tâm Huy": 33, "Trần Tuấn Nghĩa": 33 } },

  // Page 3: demographics
  { fieldId: "field_5", type: "short_text", textValue: "Thông tin chung" },
  { fieldId: "field_6", type: "radio", ratios: { "Nam": 50, "Nữ": 50 } },
  { fieldId: "field_7", type: "radio", ratios: { "Sinh viên": 25, "Nhân viên": 25, "Cán bộ quản lý": 25, "Khác": 25 } },
  { fieldId: "field_8", type: "radio", ratios: { "Từ 18 đến 24 tuổi": 100 } },
  { fieldId: "field_9", type: "radio", ratios: { "Đại học": 50, "Sau Đại học (Thạc sĩ, Tiến sĩ...)": 50 } },
  { fieldId: "field_10", type: "radio", ratios: { "Từ 8 - 15 triệu đồng": 50, "Từ 16 - 29 triệu đồng": 50 } },

  // Page 4: Likert grid — 30 radio fields with equal ratios
  { fieldId: "field_11", type: "short_text", textValue: "Khảo sát Fintech" },
  { fieldId: "field_12", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_13", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_14", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_15", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_16", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_17", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_18", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_19", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_20", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_21", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_22", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_23", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_24", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_25", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_26", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_27", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_28", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_29", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_30", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_31", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_32", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_33", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_34", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_35", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_36", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_37", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_38", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_39", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_40", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },
  { fieldId: "field_41", type: "radio", ratios: { "Đồng ý": 40, "Bình thường": 30, "Rất đồng ý": 30 } },

  // Page 5: thank you
  { fieldId: "field_42", type: "short_text", textValue: "Cảm ơn!" },
];

const config: FormConfig = {
  url: "https://docs.google.com/forms/d/e/1FAIpQLSep5ThRm1TGIKSAa7twWdU01MahIhzAGyjV6ei5hraeRB2g6w/viewform",
  title: "PHIẾU KHẢO SÁT FINTECH",
  fields,
  pages: [
    { pageIndex: 0, fieldIds: ["field_0"] },
    { pageIndex: 1, fieldIds: ["field_1", "field_2"] },
    { pageIndex: 2, fieldIds: ["field_3", "field_4"] },
    { pageIndex: 3, fieldIds: ["field_5", "field_6", "field_7", "field_8", "field_9", "field_10"] },
    { pageIndex: 4, fieldIds: [
      "field_11", "field_12", "field_13", "field_14", "field_15",
      "field_16", "field_17", "field_18", "field_19", "field_20",
      "field_21", "field_22", "field_23", "field_24", "field_25",
      "field_26", "field_27", "field_28", "field_29", "field_30",
      "field_31", "field_32", "field_33", "field_34", "field_35",
      "field_36", "field_37", "field_38", "field_39", "field_40",
      "field_41",
    ] },
    { pageIndex: 5, fieldIds: ["field_42"] },
  ],
  loopCount: 1,
};

async function main() {
  console.log("Starting execution...");
  const result = await executeOne(config);
  console.log("\n=== RESULT ===");
  console.log("Status:", result.status);
  console.log("Error:", result.error);
  console.log("Page count:", result.pageCount);
  console.log("Current page index:", result.currentPageIndex);
  console.log("Fields filled:", Object.keys(result.data).length);
  console.log("Data keys:", Object.keys(result.data).join(", "));
}

main().catch(console.error);
