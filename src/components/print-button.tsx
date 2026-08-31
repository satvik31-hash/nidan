"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** The browser's own print dialog produces the PDF. No renderer dependency,
 *  it honours the print stylesheet, and "Save as PDF" is one click away in
 *  every browser a judge will be holding. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
      <Printer size={15} /> {label}
    </Button>
  );
}
