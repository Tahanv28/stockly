"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, FormError, Input } from "./ui";
import { IconFolder, IconEdit } from "./icons";
import { createFolderAction, renameFolderAction, type ActionState } from "@/app/app/actions";

export function NewFolderButton({ parentId }: { parentId: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(createFolderAction, null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <IconFolder width={16} height={16} /> New folder
      </Button>
    );
  }
  return (
    <form action={action} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <Input ref={ref} name="name" placeholder="Folder name, e.g. Van 2" required className="flex-1 sm:w-56" />
      <Button type="submit" disabled={pending}>
        Create
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <div className="w-full">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

export function RenameFolderButton({ folderId, name }: { folderId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await renameFolderAction(prev, fd);
    if (res?.ok) setOpen(false);
    return res;
  }, null);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <IconEdit width={16} height={16} /> Rename
      </Button>
    );
  }
  return (
    <form action={action} className="flex w-full flex-wrap items-center gap-2">
      <input type="hidden" name="folderId" value={folderId} />
      <Input name="name" defaultValue={name} required className="flex-1 sm:w-56" autoFocus />
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <div className="w-full">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

export function ConfirmSubmit({
  children,
  message,
  className,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
