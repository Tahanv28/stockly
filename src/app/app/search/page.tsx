import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { findItemsByCode, listAllFolderPaths, listItems } from "@/server/inventory";
import { SearchBox } from "@/components/folder-view";
import { ItemList } from "@/components/item-list";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { IconSearch } from "@/components/icons";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/app/search">) {
  const session = await requireSession();
  const ctx = toCtx(session);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  if (q) {
    // A USB/Bluetooth barcode scanner types the code + Enter: jump straight to an exact match.
    const exact = await findItemsByCode(db, ctx, q);
    if (exact.length === 1) redirect(`/app/items/${exact[0].id}`);
  }

  const [results, folders] = q
    ? await Promise.all([listItems(db, ctx, { search: q, limit: 200 }), listAllFolderPaths(db, ctx)])
    : [[], []];
  const folderNames = Object.fromEntries(folders.map((f) => [f.id, f.path]));

  return (
    <div>
      <PageHeader title="Search" />
      <div className="mb-5">
        <SearchBox defaultValue={q} autoFocus={!q} />
      </div>
      {q &&
        (results.length ? (
          <>
            <ItemList items={results} folders={folders} folderNames={folderNames} />
            {results.length >= 200 && (
              <p className="mt-3 text-center text-sm text-neutral-500">Showing the first 200 matches. Try a more specific search.</p>
            )}
          </>
        ) : (
          <EmptyState
            icon={<IconSearch width={32} height={32} />}
            title={`No items match "${q}"`}
            action={<LinkButton href={`/app/items/new?barcode=${encodeURIComponent(q)}`}>Create an item with this code</LinkButton>}
          />
        ))}
    </div>
  );
}
