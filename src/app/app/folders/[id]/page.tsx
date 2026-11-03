import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { getFolder } from "@/server/inventory";
import { FolderView } from "@/components/folder-view";

export async function generateMetadata({ params }: PageProps<"/app/folders/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const folder = await getFolder(db, toCtx(session), (await params).id);
  return { title: folder?.name ?? "Folder" };
}

export default async function FolderPage({ params, searchParams }: PageProps<"/app/folders/[id]">) {
  const session = await requireSession();
  const ctx = toCtx(session);
  const { id } = await params;
  const sp = await searchParams;
  const folder = await getFolder(db, ctx, id);
  if (!folder) notFound();
  return (
    <>
      {sp.deleted && (
        <p className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          Item moved to the trash. <Link href="/app/trash" className="font-medium underline">Undo in Trash</Link>
        </p>
      )}
      <FolderView ctx={ctx} folderId={id} />
    </>
  );
}
