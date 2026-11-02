"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface CaptchaPopupProps {
  open: boolean;
  onClose: () => void;
}

export function CaptchaPopup({ open, onClose }: CaptchaPopupProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="h-5 w-5" />
            reCAPTCHA Detected
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              Google has detected automated access and shown a CAPTCHA challenge.
              The execution has been stopped to avoid detection or IP blocking.
            </p>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Recommendations:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Wait a few minutes before retrying</li>
                <li>Reduce the fill rate (currently 4–6/min)</li>
                <li>Try using a different IP / proxy</li>
                <li>Check if the form has restrictions on public access</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={onClose}>OK, Understood</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
