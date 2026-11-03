import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { listActivity } from "@/server/inventory";
import { describeActivity, timeAgo } from "@/lib/activity";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { IconClock } from "@/components/icons";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const session = await requireSession();
  const rows = await listActivity(db, toCtx(session), { limit: 200 });

  return (
    <div>
      <PageHeader title="Activity" subtitle="Every change, who made it and when." />
      {rows.length === 0 ? (
        <EmptyState icon={<IconClock width={32} height={32} />} title="No activity yet" />
      ) : (
        <Card className="divide-y divide-neutral-100">
          {rows.map((r) => {
            const d = describeActivity(r);
            const content = (
              <div className="flex gap-3 px-4 py-3 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    d.delta === undefined ? "bg-neutral-300" : d.delta >= 0 ? "bg-brand-500" : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="break-words">{d.text}</div>
                  <div className="text-xs text-neutral-500">
                    {r.userName ?? "Someone"} · {timeAgo(r.createdAt)}
                  </div>
                </div>
              </div>
            );
            return r.itemId && r.type !== "item.deleted" ? (
              <Link key={r.id} href={`/app/items/${r.itemId}`} className="block hover:bg-neutral-50">
                {content}
              </Link>
            ) : (
              <div key={r.id}>{content}</div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
