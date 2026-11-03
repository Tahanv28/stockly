import type { Metadata } from "next";
import { db } from "@/db";
import { requireSession, toCtx } from "@/lib/session";
import { canManageTeam, listMembers, listUserOrgs } from "@/server/auth";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/folder-forms";
import { InviteForm, RenameOrgForm } from "./settings-forms";
import { removeMemberAction } from "./actions";
import { switchOrgAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const ctx = toCtx(session);
  const [members, orgs] = await Promise.all([listMembers(db, ctx.orgId), listUserOrgs(db, ctx.userId)]);
  const manage = canManageTeam(ctx.role);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Settings" />

      <Card className="space-y-3 p-4 md:p-5">
        <h2 className="font-semibold">Workspace</h2>
        <RenameOrgForm name={session.org.name} canEdit={manage} />
      </Card>

      <Card className="space-y-4 p-4 md:p-5">
        <div>
          <h2 className="font-semibold">Team</h2>
          <p className="text-sm text-neutral-500">Everyone in the workspace can view and update inventory. Admins can also manage the team.</p>
        </div>
        <ul className="divide-y divide-neutral-100">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {m.name} {m.userId === ctx.userId && <span className="text-neutral-400">(you)</span>}
                </div>
                <div className="truncate text-sm text-neutral-500">{m.email}</div>
              </div>
              <Badge tone={m.role === "owner" ? "success" : "neutral"}>{m.role}</Badge>
              {manage && m.role !== "owner" && m.userId !== ctx.userId && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="userId" value={m.userId} />
                  <ConfirmSubmit message={`Remove ${m.name} from this workspace?`} className="text-sm text-red-700 hover:underline">
                    Remove
                  </ConfirmSubmit>
                </form>
              )}
            </li>
          ))}
        </ul>
        {manage && <InviteForm />}
      </Card>

      {orgs.length > 1 && (
        <Card className="space-y-3 p-4 md:p-5">
          <h2 className="font-semibold">Switch workspace</h2>
          <ul className="space-y-2">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {o.name} <span className="text-sm text-neutral-500">· {o.role}</span>
                </span>
                {o.id === ctx.orgId ? (
                  <Badge tone="success">Current</Badge>
                ) : (
                  <form action={switchOrgAction}>
                    <input type="hidden" name="orgId" value={o.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Switch
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-1 p-4 md:p-5">
        <h2 className="font-semibold">Your account</h2>
        <p className="text-sm text-neutral-600">
          {session.user.name} · {session.user.email}
        </p>
      </Card>
    </div>
  );
}
