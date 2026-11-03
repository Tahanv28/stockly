"use client";

import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { buildRows, guessMapping, MAX_IMPORT_ROWS, TARGETS, type Target } from "@/lib/csv-import";
import { Button, Card, FormError, LinkButton, Select } from "@/components/ui";
import { IconUpload } from "@/components/icons";
import { formatQty } from "@/lib/numbers";
import { importAction } from "./actions";

type Parsed = { fileName: string; headers: string[]; data: string[][] };

export function ImportClient() {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Target[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ items: number; folders: number; errors: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (res) => {
        const rows = res.data.map((r) => r.map((c) => String(c ?? "")));
        if (rows.length < 2) {
          setError("That file has no rows to import.");
          return;
        }
        const headers = rows[0].map((h) => h.replace(/^﻿/, ""));
        setParsed({ fileName: file.name, headers, data: rows.slice(1, MAX_IMPORT_ROWS + 1) });
        setMapping(guessMapping(headers));
      },
      error: () => setError("Couldn't read that file. Export it as CSV and try again."),
    });
  }

  const preview = useMemo(
    () => (parsed ? buildRows(parsed.headers, parsed.data, mapping) : null),
    [parsed, mapping],
  );

  function runImport() {
    if (!parsed) return;
    setError(null);
    startTransition(async () => {
      const res = await importAction({ headers: parsed.headers, data: parsed.data, mapping });
      if ("error" in res && res.error) setError(res.error);
      else if ("ok" in res) {
        setResult({ items: res.items, folders: res.folders, errors: res.errors });
        setParsed(null);
      }
    });
  }

  if (result) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-lg font-semibold">Import complete</h2>
        <p className="mt-1 text-neutral-600">
          Added {result.items} item{result.items === 1 ? "" : "s"}
          {result.folders > 0 && ` in ${result.folders} folder${result.folders === 1 ? "" : "s"}`}.
          {result.errors > 0 && ` ${result.errors} row${result.errors === 1 ? " was" : "s were"} skipped.`}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <LinkButton href="/app">View items</LinkButton>
          <Button variant="secondary" onClick={() => setResult(null)}>
            Import another file
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      {!parsed ? (
        <Card className="p-6">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 px-6 py-10 text-center hover:bg-neutral-50">
            <IconUpload width={32} height={32} className="text-neutral-400" />
            <span className="font-medium">Choose a CSV file</span>
            <span className="max-w-sm text-sm text-neutral-500">
              Export your items from Sortly (or any spreadsheet) as a CSV file and upload it here. Folders, quantities, barcodes,
              prices, tags, notes and custom fields come across automatically.
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </Card>
      ) : (
        <>
          <Card className="p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Match your columns</h2>
                <p className="text-sm text-neutral-500">
                  {parsed.fileName} · {parsed.data.length} rows. We guessed the columns — fix any that look wrong.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
                Choose another file
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {parsed.headers.map((h, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 sm:flex-1">
                    <div className="truncate text-sm font-medium">{h || `Column ${i + 1}`}</div>
                    <div className="truncate text-xs text-neutral-500">e.g. {parsed.data.find((r) => r[i])?.[i] ?? "—"}</div>
                  </div>
                  <Select
                    aria-label={`Import ${h} as`}
                    value={mapping[i]}
                    onChange={(e) => setMapping((m) => m.map((t, j) => (j === i ? (e.target.value as Target) : t)))}
                    className="w-full sm:w-44 sm:shrink-0"
                  >
                    {Object.entries(TARGETS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          {preview && (
            <Card className="overflow-hidden">
              <div className="border-b border-neutral-100 px-4 py-3 text-sm">
                <span className="font-semibold">{preview.rows.length} items ready</span>
                {preview.errors.length > 0 && (
                  <span className="text-amber-700">
                    {" "}· {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} will be skipped
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs text-neutral-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Folder</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 font-medium">Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {preview.rows.slice(0, 8).map((r) => (
                      <tr key={r.line}>
                        <td className="px-4 py-2">{r.name}</td>
                        <td className="px-4 py-2 text-neutral-500">{r.folderPath.join(" / ") || "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatQty(r.quantity ?? "0")}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.barcode ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.errors.length > 0 && (
                <ul className="max-h-32 overflow-y-auto border-t border-neutral-100 px-4 py-2 text-xs text-amber-800">
                  {preview.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={pending || !preview?.rows.length || !mapping.includes("name")}
            onClick={runImport}
          >
            {pending ? "Importing…" : `Import ${preview?.rows.length ?? 0} items`}
          </Button>
          {!mapping.includes("name") && (
            <p className="text-center text-sm text-amber-700">Pick which column is the item Name.</p>
          )}
        </>
      )}
    </div>
  );
}
