"use client";

import { useState } from "react";
import { FormScanner } from "@/components/form-scanner";
import { FormConfig } from "@/components/form-config";
import { ExecutionPanel } from "@/components/execution-panel";
import { ExecutionLog } from "@/components/execution-log";
import { CaptchaPopup } from "@/components/captcha-popup";
import { useFormStore } from "@/stores/form-store";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  const { structure } = useFormStore();
  const [captchaOpen, setCaptchaOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Form Auto-Filler</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scan a Google Form, configure answer ratios, and execute automated submissions
        </p>
      </div>

      {/* Step 1: Scanner */}
      <FormScanner />

      {/* Step 2: Configuration (shown after scan) */}
      {structure && (
        <>
          <div id="form-config">
            <FormConfig />
          </div>
          <Separator />
          {/* Step 3: Execution + Log */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ExecutionPanel onCaptcha={() => setCaptchaOpen(true)} />
            <ExecutionLog />
          </div>
        </>
      )}

      {/* Captcha popup */}
      <CaptchaPopup open={captchaOpen} onClose={() => setCaptchaOpen(false)} />
    </div>
  );
}
