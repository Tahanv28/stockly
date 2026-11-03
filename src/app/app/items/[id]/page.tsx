import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { getFolderPath, getItem, listActivity } from "@/server/inventory";
import { formatMoney, formatQty, isLowStock } from "@/lib/numbers";
import { describeActivity, timeAgo } from "@/lib/activity";
import { Badge, Card, buttonClass } from "@/components/ui";
import { IconChevronRight, IconEdit, IconPrinter, IconTrash, IconX } from "@/components/icons";
import { QuantityControl } from "@/components/quantity-control";
import { PhotoUploader } from "@/components/photo-uploader";
import { ConfirmSubmit } from "@/components/folder-forms";
import { deleteItemAction, deletePhotoAction } from "../../actions";

export async function generateMetadata({ params }: PageProps<"/app/items/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const item = await getItem(db, toCtx(session), (await params).id);
  return { title: item?.name ?? "Item" };
}

export default async function ItemPage({ params, searchParams }: PageProps<"/app/items/[id]">) {
  const session = await requireSession();
  const ctx = toCtx(session);
  const { id } = await params;
  const sp = await searchParams;
  const item = await getItem(db, ctx, id);
  if (!item) notFound();
  const [path, history] = await Promise.all([
    getFolderPath(db, ctx, item.folderId),
    listActivity(db, ctx, { itemId: item.id, limit: 50 }),
  ]);
  const low = isLowStock(item.quantity, item.minQuantity);
  const value = item.price !== null ? Number(item.price) * Number(item.quantity) : null;
  const customEntries = Object.entries(item.customFields);

  return (
    <div>
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-neutral-500" aria-label="Breadcrumb">
        <Link href="/app" className="hover:text-brand-700">
          All items
        </Link>
        {path.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <IconChevronRight width={14} height={14} />
            <Link href={`/app/folders/${p.id}`} className="hover:text-brand-700">
              {p.name}
            </Link>
          </span>
        ))}
      </nav>

      {sp.created && (
        <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Item added.{" "}
          <Link href={item.folderId ? `/app/items/new?folder=${item.folderId}` : "/app/items/new"} className="font-medium underline">
            Add another
          </Link>
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{item.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {low && <Badge tone="warning">Low stock</Badge>}
            {item.tags.map((t) => (
              <Badge key={t}>#{t}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/items/${item.id}/edit`} className={buttonClass("secondary")}>
            <IconEdit width={16} height={16} /> Edit
          </Link>
          <Link href={`/app/labels?ids=${item.id}`} className={buttonClass("secondary")}>
            <IconPrinter width={16} height={16} /> Label
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <Card className="p-4 md:p-5">
            <QuantityControl itemId={item.id} quantity={item.quantity} unit={item.unit} low={low} />
          </Card>

          <Card className="p-4 md:p-5">
            <h2 className="mb-3 text-sm font-medium text-neutral-500">Photos</h2>
            {item.photos.length === 0 ? (
              <PhotoUploader itemId={item.id} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {item.photos.map((p) => (
                  <div key={p.id} className="group relative">
                    <a href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/photos/${p.id}`} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    </a>
                    <form action={deletePhotoAction} className="absolute -right-1.5 -top-1.5">
                      <input type="hidden" name="photoId" value={p.id} />
                      <ConfirmSubmit
                        message="Delete this photo?"
                        className="grid h-6 w-6 place-items-center rounded-full bg-white text-neutral-600 shadow ring-1 ring-neutral-200"
                      >
                        <IconX width={12} height={12} />
                      </ConfirmSubmit>
                    </form>
                  </div>
                ))}
                {item.photos.length < 8 && <PhotoUploader itemId={item.id} compact />}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 text-sm font-medium text-neutral-500">Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Low-stock alert at" value={item.minQuantity !== null ? formatQty(item.minQuantity) : "—"} />
              <Detail label="Price" value={item.price !== null ? formatMoney(item.price) : "—"} />
              <Detail label="Total value" value={value !== null ? formatMoney(value) : "—"} />
              <Detail label="Unit" value={item.unit ?? "—"} />
              <Detail label="Barcode" value={item.barcode ?? "—"} mono />
              <Detail label="SKU" value={item.sku ?? "—"} mono />
              {customEntries.map(([k, v]) => (
                <Detail key={k} label={k} value={v} />
              ))}
            </dl>
            {item.notes && (
              <div className="mt-4 border-t border-neutral-100 pt-3 text-sm">
                <div className="text-xs text-neutral-500">Notes</div>
                <p className="mt-1 whitespace-pre-wrap">{item.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-4 md:p-5">
            <h2 className="mb-3 text-sm font-medium text-neutral-500">History</h2>
            <ol className="space-y-3">
              {history.map((h) => {
                const d = describeActivity(h, false);
                return (
                  <li key={h.id} className="flex gap-3 text-sm">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        d.delta === undefined ? "bg-neutral-300" : d.delta >= 0 ? "bg-brand-500" : "bg-amber-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <div>{d.text}</div>
                      <div className="text-xs text-neutral-500">
                        {h.userName ?? "Someone"} · {timeAgo(h.createdAt)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <form action={deleteItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <ConfirmSubmit
              message={`Move "${item.name}" to the trash? You can restore it later.`}
              className={buttonClass("danger") + " w-full"}
            >
              <IconTrash width={16} height={16} /> Move to trash
            </ConfirmSubmit>
          </form>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`truncate ${mono ? "font-mono text-[13px]" : ""}`}>{value}</dd>
    </div>
  );
}
