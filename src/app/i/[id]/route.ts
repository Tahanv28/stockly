import { redirect } from "next/navigation";

// Target of printed QR labels: /i/<item id>. Short so the QR code stays small and easy to scan.
// Opens the item (the app asks the person to log in first if needed).
export async function GET(_req: Request, { params }: RouteContext<"/i/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  redirect(`/app/items/${id}`);
}
