import { db } from "@/db";
import { getSession, toCtx } from "@/lib/session";
import { getPhoto } from "@/server/inventory";
import { getStorage } from "@/server/storage";

// Photos are private: only members of the owning workspace can load them.
export async function GET(_req: Request, { params }: RouteContext<"/api/photos/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const photo = await getPhoto(db, toCtx(session), id);
  if (!photo) return new Response("Not found", { status: 404 });
  const body = await getStorage().get(photo.storageKey);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
