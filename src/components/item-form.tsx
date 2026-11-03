"use client";

import { useActionState, useState } from "react";
import { saveItemAction, type ActionState } from "@/app/app/actions";
import { Button, Card, Field, FormError, Input, Select, Textarea } from "./ui";
import { IconPlus, IconScan, IconX } from "./icons";
import { Scanner } from "./scanner";

export type ItemFormValues = {
  id?: string;
  name: string;
  folderId: string | null;
  quantity: string;
  unit: string;
  minQuantity: string;
  price: string;
  sku: string;
  barcode: string;
  notes: string;
  tags: string;
  customFields: { key: string; value: string }[];
};

export function ItemForm({
  initial,
  folders,
  cancelHref,
}: {
  initial: ItemFormValues;
  folders: { id: string; path: string }[];
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveItemAction, null);
  const [barcode, setBarcode] = useState(initial.barcode);
  const [scanning, setScanning] = useState(false);
  const [custom, setCustom] = useState(initial.customFields.length ? initial.customFields : []);
  const isEdit = Boolean(initial.id);

  return (
    <form action={action} className="space-y-4">
      {initial.id && <input type="hidden" name="itemId" value={initial.id} />}
      <FormError message={state?.error} />

      <Card className="space-y-4 p-4 md:p-5">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required maxLength={200} defaultValue={initial.name} autoFocus={!isEdit} placeholder="e.g. Cordless drill 18V" />
        </Field>
        <Field label="Folder" htmlFor="folderId">
          <Select id="folderId" name="folderId" defaultValue={initial.folderId ?? ""}>
            <option value="">Top level (no folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.path}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="quantity" hint={isEdit ? "Use the +/− buttons on the item page to log a reason." : undefined}>
            <Input id="quantity" name="quantity" inputMode="decimal" defaultValue={initial.quantity} placeholder="0" />
          </Field>
          <Field label="Unit" htmlFor="unit">
            <Input id="unit" name="unit" defaultValue={initial.unit} placeholder="pcs, m, box…" maxLength={20} />
          </Field>
          <Field label="Low-stock alert at" htmlFor="minQuantity" hint="Get flagged when quantity drops to this.">
            <Input id="minQuantity" name="minQuantity" inputMode="decimal" defaultValue={initial.minQuantity} placeholder="Optional" />
          </Field>
          <Field label="Price per unit (€)" htmlFor="price">
            <Input id="price" name="price" inputMode="decimal" defaultValue={initial.price} placeholder="Optional" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Barcode" htmlFor="barcode">
            <div className="flex gap-2">
              <Input
                id="barcode"
                name="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type"
              />
              <Button type="button" variant="secondary" onClick={() => setScanning(true)} aria-label="Scan barcode">
                <IconScan width={18} height={18} />
              </Button>
            </div>
          </Field>
          <Field label="SKU / part number" htmlFor="sku">
            <Input id="sku" name="sku" defaultValue={initial.sku} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Tags" htmlFor="tags" hint="Separate with commas, e.g. electrical, consumables">
          <Input id="tags" name="tags" defaultValue={initial.tags} />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} defaultValue={initial.notes} />
        </Field>
      </Card>

      <Card className="space-y-3 p-4 md:p-5">
        <div>
          <h3 className="text-sm font-medium">Custom fields</h3>
          <p className="text-xs text-neutral-500">Serial number, supplier, expiry date, warranty — anything you need. No plan limits.</p>
        </div>
        {custom.map((cf, i) => (
          <div key={i} className="flex gap-2">
            <Input name="cfKey" defaultValue={cf.key} placeholder="Field (e.g. Supplier)" className="flex-1" aria-label="Field name" />
            <Input name="cfValue" defaultValue={cf.value} placeholder="Value" className="flex-1" aria-label="Field value" />
            <Button type="button" variant="ghost" aria-label="Remove field" onClick={() => setCustom((c) => c.filter((_, j) => j !== i))}>
              <IconX width={16} height={16} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => setCustom((c) => [...c, { key: "", value: "" }])}>
          <IconPlus width={16} height={16} /> Add field
        </Button>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1 md:flex-none">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add item"}
        </Button>
        <a href={cancelHref} className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          Cancel
        </a>
      </div>

      {scanning && (
        <Scanner
          onDetect={(code) => {
            setBarcode(code);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </form>
  );
}
