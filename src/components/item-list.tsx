"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ItemListRow } from "@/server/inventory";
import { formatQty, isLowStock } from "@/lib/numbers";
import { Badge, Button, Card, FormError, Select, cx } from "./ui";
import { IconBox, IconMove, IconPrinter, IconX } from "./icons";
import { moveItemsAction, type ActionState } from "@/app/app/actions";

export function ItemThumb({ photoId, size = 44 }: { photoId: string | null; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-400"
      style={{ width: size, height: size }}
    >
      {photoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/photos/${photoId}`} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <IconBox />
      )}
    </div>
  );
}

export function ItemRow({ item, folderLabel }: { item: ItemListRow; folderLabel?: string }) {
  const low = isLowStock(item.quantity, item.minQuantity);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ItemThumb photoId={item.photoId} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
          {folderLabel && <span className="truncate">{folderLabel}</span>}
          {item.sku && <span>SKU {item.sku}</span>}
          {item.tags.slice(0, 3).map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>
      <div className="text-right">
        <div className={cx("font-semibold tabular-nums", low && "text-amber-700")}>
          {formatQty(item.quantity)}
          {item.unit && <span className="ml-1 text-xs font-normal text-neutral-500">{item.unit}</span>}
        </div>
        {low && <Badge tone="warning">Low</Badge>}
      </div>
    </div>
  );
}

export function ItemList({
  items,
  folders,
  folderNames,
  selectable = true,
}: {
  items: ItemListRow[];
  folders?: { id: string; path: string }[];
  folderNames?: Record<string, string>;
  selectable?: boolean;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await moveItemsAction(prev, fd);
    if (res?.ok) {
      setSelected(new Set());
      setSelecting(false);
    }
    return res;
  }, null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div>
      {selectable && items.length > 0 && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-neutral-500">
            {selecting ? `${selected.size} selected` : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </span>
          <div className="flex gap-2">
            {selecting && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
              >
                {allSelected ? "Clear" : "Select all"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelecting((s) => !s);
                setSelected(new Set());
              }}
            >
              {selecting ? <IconX width={16} height={16} /> : null}
              {selecting ? "Done" : "Select"}
            </Button>
          </div>
        </div>
      )}
      {state?.message && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.message}</p>}
      <Card className="divide-y divide-neutral-100 overflow-hidden">
        {items.map((item) =>
          selecting ? (
            <label key={item.id} className="flex cursor-pointer items-center gap-1 pl-4 hover:bg-neutral-50">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-600"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <div className="min-w-0 flex-1">
                <ItemRow item={item} folderLabel={item.folderId ? folderNames?.[item.folderId] : undefined} />
              </div>
            </label>
          ) : (
            <Link key={item.id} href={`/app/items/${item.id}`} className="block hover:bg-neutral-50">
              <ItemRow item={item} folderLabel={item.folderId ? folderNames?.[item.folderId] : undefined} />
            </Link>
          ),
        )}
      </Card>

      {selecting && selected.size > 0 && (
        <div className="no-print fixed inset-x-0 bottom-16 z-40 px-4 md:bottom-6 md:left-60">
          <Card className="mx-auto flex max-w-3xl flex-col gap-3 p-3 shadow-lg sm:flex-row sm:items-center">
            <form action={action} className="flex flex-1 items-center gap-2">
              {[...selected].map((id) => (
                <input key={id} type="hidden" name="itemIds" value={id} />
              ))}
              <Select name="targetFolderId" aria-label="Move to folder" className="flex-1" defaultValue="">
                <option value="">Top level (no folder)</option>
                {folders?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path}
                  </option>
                ))}
              </Select>
              <Button type="submit" disabled={pending}>
                <IconMove width={16} height={16} /> Move
              </Button>
            </form>
            <Link
              href={`/app/labels?ids=${[...selected].join(",")}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-50"
            >
              <IconPrinter width={16} height={16} /> Labels
            </Link>
          </Card>
          <FormError message={state?.error} />
        </div>
      )}
    </div>
  );
}
