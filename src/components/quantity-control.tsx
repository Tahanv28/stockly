"use client";

import { useActionState, useState } from "react";
import { adjustQuantityAction, type ActionState } from "@/app/app/actions";
import { Button, FormError, Input, cx } from "./ui";
import { IconMinus, IconPlus } from "./icons";
import { formatQty } from "@/lib/numbers";

export function QuantityControl({
  itemId,
  quantity,
  unit,
  low,
}: {
  itemId: string;
  quantity: string;
  unit: string | null;
  low: boolean;
}) {
  const [mode, setMode] = useState<"add" | "remove" | "set">("remove");
  const [amount, setAmount] = useState("1");
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await adjustQuantityAction(prev, fd);
    if (res?.ok) setAmount(mode === "set" ? amount : "1");
    return res;
  }, null);

  const quick = (m: "add" | "remove") => {
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("mode", m);
    fd.set("amount", "1");
    return fd;
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">In stock</div>
          <div className={cx("text-4xl font-semibold tabular-nums", low && "text-amber-700")}>
            {formatQty(quantity)}
            {unit && <span className="ml-1.5 text-base font-normal text-neutral-500">{unit}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <form action={() => action(quick("remove"))}>
            <Button type="submit" variant="secondary" size="icon" aria-label="Remove one" disabled={pending}>
              <IconMinus width={24} height={24} strokeWidth={2.4} />
            </Button>
          </form>
          <form action={() => action(quick("add"))}>
            <Button type="submit" size="icon" aria-label="Add one" disabled={pending}>
              <IconPlus width={24} height={24} strokeWidth={2.4} />
            </Button>
          </form>
        </div>
      </div>

      <form action={action} className="mt-4 space-y-2 rounded-lg bg-neutral-50 p-3">
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="mode" value={mode} />
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-200/60 p-1 text-sm font-medium">
          {(["remove", "add", "set"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cx("rounded-md py-1.5", mode === m ? "bg-white shadow-sm" : "text-neutral-600")}
            >
              {m === "remove" ? "Take out" : m === "add" ? "Put in" : "Set count"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
            className="w-20 shrink-0 text-center"
          />
          <Input name="note" placeholder="Reason (optional), e.g. Job #214" className="min-w-0 flex-1" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : mode === "remove" ? "Take out" : mode === "add" ? "Put in" : "Set count"}
        </Button>
        <FormError message={state?.error} />
        {state?.ok && state.message && <p className="text-sm text-brand-700">{state.message}</p>}
      </form>
    </div>
  );
}
