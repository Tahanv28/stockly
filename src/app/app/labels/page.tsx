import type { Metadata } from "next";
import QRCode from "qrcode";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { getItem, listItems } from "@/server/inventory";
import { EmptyState, PageHeader } from "@/components/ui";
import { IconQr } from "@/components/icons";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Labels" };

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export default async function LabelsPage({ searchParams }: PageProps<"/app/labels">) {
  const session = await requireSession();
  const ctx = toCtx(session);
  const sp = await searchParams;

  let items: { id: string; name: string; sku: string | null }[] = [];
  if (typeof sp.folder === "string") {
    items = await listItems(db, ctx, { folderId: sp.folder, limit: 300 });
  } else if (typeof sp.ids === "string") {
    const ids = sp.ids.split(",").filter(Boolean).slice(0, 300);
    const found = await Promise.all(ids.map((id) => getItem(db, ctx, id)));
    items = found.filter((x): x is NonNullable<typeof x> => Boolean(x));
  }

  const labels = await Promise.all(
    items.map(async (item) => ({
      ...item,
      svg: await QRCode.toString(`${appUrl()}/i/${item.id}`, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
      }),
    })),
  );

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Print labels"
          subtitle="Stick these on shelves, bins or tools. Scanning one with Stockly opens the item."
          actions={labels.length > 0 ? <PrintButton /> : undefined}
        />
      </div>
      {labels.length === 0 ? (
        <EmptyState
          icon={<IconQr width={32} height={32} />}
          title="No items selected"
          description='Open a folder and choose "Print labels", or select items and tap "Labels".'
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          {labels.map((l) => (
            <div
              key={l.id}
              className="flex break-inside-avoid items-center gap-3 rounded-lg border border-neutral-300 bg-white p-3 print:rounded-none print:border-dashed"
            >
              <div className="h-20 w-20 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: l.svg }} />
              <div className="min-w-0">
                <div className="line-clamp-3 text-sm font-semibold leading-tight">{l.name}</div>
                {l.sku && <div className="mt-1 font-mono text-xs text-neutral-600">{l.sku}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
