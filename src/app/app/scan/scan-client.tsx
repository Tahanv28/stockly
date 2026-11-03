"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Scanner, itemIdFromScan } from "@/components/scanner";
import { Button, Card, Input, LinkButton } from "@/components/ui";
import { IconScan } from "@/components/icons";
import { formatQty } from "@/lib/numbers";
import { lookupCodeAction } from "./actions";

type Match = { id: string; name: string; quantity: string; unit: string | null };

export function ScanClient() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [pending, startTransition] = useTransition();

  function handle(value: string) {
    setScanning(false);
    const itemId = itemIdFromScan(value);
    if (itemId) {
      router.push(`/app/items/${itemId}`);
      return;
    }
    setCode(value);
    startTransition(async () => {
      const found = await lookupCodeAction(value);
      if (found.length === 1) router.push(`/app/items/${found[0].id}`);
      else setMatches(found);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-center p-6 text-center">
        <span className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <IconScan width={32} height={32} />
        </span>
        <p className="max-w-xs text-sm text-neutral-600">
          Point your camera at a barcode or a Stockly QR label to open the item, or create a new one.
        </p>
        <Button size="lg" className="mt-4 w-full max-w-xs" onClick={() => setScanning(true)}>
          Open camera
        </Button>
      </Card>

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) handle(typed.trim());
          }}
          className="flex gap-2"
        >
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Or type / use a Bluetooth scanner"
            aria-label="Code"
          />
          <Button type="submit" variant="secondary">
            Find
          </Button>
        </form>
      </Card>

      {pending && <p className="text-center text-sm text-neutral-500">Looking up {code}…</p>}

      {!pending && code && matches && (
        <Card className="p-4">
          <p className="text-sm text-neutral-500">
            Code <span className="font-mono text-ink">{code}</span>
          </p>
          {matches.length === 0 ? (
            <div className="mt-3">
              <p className="font-medium">No item has this code yet.</p>
              <LinkButton href={`/app/items/new?barcode=${encodeURIComponent(code)}`} className="mt-3 w-full">
                Create item with this barcode
              </LinkButton>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/app/items/${m.id}`} className="flex justify-between py-2 hover:text-brand-700">
                    <span>{m.name}</span>
                    <span className="tabular-nums">
                      {formatQty(m.quantity)} {m.unit}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {scanning && <Scanner onDetect={handle} onClose={() => setScanning(false)} />}
    </div>
  );
}
