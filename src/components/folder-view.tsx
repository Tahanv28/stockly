import Link from "next/link";
import { db } from "@/db";
import type { Ctx } from "@/server/auth";
import { getFolderPath, listAllFolderPaths, listFolders, listItems } from "@/server/inventory";
import { formatQty } from "@/lib/numbers";
import { Card, EmptyState, LinkButton, buttonClass } from "./ui";
import { IconBox, IconChevronRight, IconFolder, IconPlus, IconPrinter, IconSearch, IconTrash } from "./icons";
import { ItemList } from "./item-list";
import { ConfirmSubmit, NewFolderButton, RenameFolderButton } from "./folder-forms";
import { deleteFolderAction } from "@/app/app/actions";

export function SearchBox({ defaultValue = "", autoFocus = false }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <form action="/app/search" className="relative">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Search name, SKU, barcode or tag"
        className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-3 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
    </form>
  );
}

export async function FolderView({ ctx, folderId }: { ctx: Ctx; folderId: string | null }) {
  const [path, subfolders, items, allFolders] = await Promise.all([
    getFolderPath(db, ctx, folderId),
    listFolders(db, ctx, folderId),
    listItems(db, ctx, { folderId }),
    listAllFolderPaths(db, ctx),
  ]);
  const current = path[path.length - 1];
  const isEmpty = subfolders.length === 0 && items.length === 0;

  return (
    <div>
      {folderId && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-neutral-500" aria-label="Breadcrumb">
          <Link href="/app" className="hover:text-brand-700">
            All items
          </Link>
          {path.slice(0, -1).map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <IconChevronRight width={14} height={14} />
              <Link href={`/app/folders/${p.id}`} className="hover:text-brand-700">
                {p.name}
              </Link>
            </span>
          ))}
        </nav>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight md:text-2xl">
          {current ? current.name : "All items"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <NewFolderButton parentId={folderId} />
          <LinkButton href={folderId ? `/app/items/new?folder=${folderId}` : "/app/items/new"}>
            <IconPlus width={16} height={16} /> Add item
          </LinkButton>
        </div>
      </div>

      {folderId && current && (
        <div className="mb-4 flex flex-wrap items-center gap-1">
          <RenameFolderButton folderId={folderId} name={current.name} />
          {items.length > 0 && (
            <Link href={`/app/labels?folder=${folderId}`} className={buttonClass("ghost", "sm")}>
              <IconPrinter width={16} height={16} /> Print labels
            </Link>
          )}
          <form action={deleteFolderAction}>
            <input type="hidden" name="folderId" value={folderId} />
            <ConfirmSubmit
              message={`Delete the folder "${current.name}"? Its items and subfolders will move up one level. Nothing is deleted.`}
              className={buttonClass("dangerGhost", "sm")}
            >
              <IconTrash width={16} height={16} /> Delete folder
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {!folderId && (
        <div className="mb-5">
          <SearchBox />
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<IconBox width={36} height={36} />}
          title={folderId ? "This folder is empty" : "Add your first item"}
          description={
            folderId
              ? "Add items here, or create subfolders like shelves or bins."
              : "Create folders for locations (warehouse, van, shelf) and add items with quantities, photos and barcodes. Moving from Sortly? Import your export file in one go."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href={folderId ? `/app/items/new?folder=${folderId}` : "/app/items/new"}>
                <IconPlus width={16} height={16} /> Add item
              </LinkButton>
              {!folderId && (
                <LinkButton href="/app/import" variant="secondary">
                  Import from Sortly / CSV
                </LinkButton>
              )}
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          {subfolders.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-neutral-500">Folders</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {subfolders.map((f) => (
                  <Link key={f.id} href={`/app/folders/${f.id}`}>
                    <Card className="flex items-center gap-3 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <IconFolder />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{f.name}</div>
                        <div className="text-xs text-neutral-500">
                          {f.itemCount} item{f.itemCount === 1 ? "" : "s"}
                          {f.folderCount > 0 && ` · ${f.folderCount} folder${f.folderCount === 1 ? "" : "s"}`}
                          {f.itemCount > 0 && ` · ${formatQty(f.totalQuantity)} units`}
                        </div>
                      </div>
                      <IconChevronRight className="text-neutral-400" />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {items.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-neutral-500">Items</h2>
              <ItemList items={items} folders={allFolders} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
