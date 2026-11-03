"use client";

import { Button } from "@/components/ui";
import { IconPrinter } from "@/components/icons";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <IconPrinter width={16} height={16} /> Print
    </Button>
  );
}
