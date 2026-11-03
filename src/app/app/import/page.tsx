import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ImportClient } from "./import-client";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Import items"
        subtitle="Move from Sortly or any spreadsheet in a couple of minutes. Imports add new items; nothing existing is changed."
      />
      <ImportClient />
    </div>
  );
}
