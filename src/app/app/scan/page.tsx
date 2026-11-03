import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ScanClient } from "./scan-client";

export const metadata: Metadata = { title: "Scan" };

export default async function ScanPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Scan" />
      <ScanClient />
    </div>
  );
}
