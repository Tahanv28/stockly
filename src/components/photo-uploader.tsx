"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPhotoAction } from "@/app/app/actions";
import { IconCamera } from "./icons";

/** Resizes a photo in the browser (max 1600px, JPEG) so uploads are fast on mobile data. */
async function resizeImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

export function PhotoUploader({ itemId, compact = false }: { itemId: string; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    startTransition(async () => {
      for (const file of Array.from(files)) {
        const blob = await resizeImage(file);
        const fd = new FormData();
        fd.set("itemId", itemId);
        fd.set("photo", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
        const res = await uploadPhotoAction(null, fd);
        if (res?.error) {
          setError(res.error);
          break;
        }
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className={
          compact
            ? "grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-dashed border-neutral-300 text-neutral-500 hover:bg-neutral-50"
            : "flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500 hover:bg-neutral-100"
        }
      >
        <IconCamera width={compact ? 22 : 28} height={compact ? 22 : 28} />
        {!compact && <span>{pending ? "Uploading…" : "Add photo"}</span>}
        {compact && pending && <span className="text-[10px]">…</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
