"use client";

import { useActionState, useState } from "react";
import { Button, FormError, Input, Select } from "@/components/ui";
import { createInviteAction, renameOrgAction, type SettingsState } from "./actions";

export function RenameOrgForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(renameOrgAction, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="name" defaultValue={name} disabled={!canEdit} aria-label="Workspace name" />
        {canEdit && (
          <Button type="submit" variant="secondary" disabled={pending}>
            Save
          </Button>
        )}
      </div>
      <FormError message={state?.error} />
      {state?.ok && <p className="text-sm text-brand-700">Saved.</p>}
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(createInviteAction, null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <Select name="role" defaultValue="member" aria-label="Role" className="w-40">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
        <Button type="submit" disabled={pending}>
          Create invite link
        </Button>
      </form>
      <FormError message={state?.error} />
      {state?.inviteUrl && (
        <div className="space-y-2 rounded-lg bg-brand-50 p-3">
          <p className="text-sm text-brand-900">Send this link to your teammate. It works once and expires in 7 days.</p>
          <div className="flex gap-2">
            <Input readOnly value={state.inviteUrl} onFocus={(e) => e.target.select()} aria-label="Invite link" />
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(state.inviteUrl!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
