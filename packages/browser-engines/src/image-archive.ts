import { ImageInputError } from "@toolbox/core";

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ImageInputError("CANCELLED");
}

export type ImageZipWriter = {
  add(name: string, blob: Blob, signal?: AbortSignal): Promise<void>;
  finish(signal?: AbortSignal): Blob;
  dispose(): void;
};

export async function createImageZipWriter(maxBytes: number): Promise<ImageZipWriter> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new ImageInputError("CONVERSION_FAILED");
  const { Zip, ZipPassThrough } = await import("fflate");
  const parts: Uint8Array[] = [];
  let archiveBytes = 0;
  let failure: "LIMIT_EXCEEDED" | "CONVERSION_FAILED" | undefined;
  let finished = false;
  const zip = new Zip((error, chunk) => {
    if (error) {
      failure = "CONVERSION_FAILED";
      return;
    }
    if (!chunk || failure) return;
    archiveBytes += chunk.byteLength;
    if (archiveBytes > maxBytes) {
      failure = "LIMIT_EXCEEDED";
      return;
    }
    parts.push(chunk);
  });

  return {
    async add(name, blob, signal) {
      checkCancelled(signal);
      if (finished || failure || name.length < 1 || name.length > 120 || /[\\/]/.test(name))
        throw new ImageInputError("CONVERSION_FAILED");
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await blob.arrayBuffer());
      } catch {
        throw new ImageInputError("CONVERSION_FAILED");
      }
      let retainedByArchive = false;
      try {
        checkCancelled(signal);
        const entry = new ZipPassThrough(name);
        entry.mtime = new Date("2000-01-01T00:00:00.000Z");
        zip.add(entry);
        entry.push(bytes, true);
        retainedByArchive = parts.some((part) => part.buffer === bytes.buffer);
        if (failure) throw new ImageInputError(failure);
        checkCancelled(signal);
      } finally {
        if (!retainedByArchive) bytes.fill(0);
      }
    },
    finish(signal) {
      checkCancelled(signal);
      if (finished || failure) throw new ImageInputError(failure ?? "CONVERSION_FAILED");
      finished = true;
      zip.end();
      if (failure || parts.length === 0) {
        const code = failure ?? "CONVERSION_FAILED";
        for (const part of parts) part.fill(0);
        parts.length = 0;
        throw new ImageInputError(code);
      }
      const blobParts: BlobPart[] = parts.map((part) => {
        const copy = new Uint8Array(part.byteLength);
        copy.set(part);
        return copy;
      });
      const blob = new Blob(blobParts, { type: "application/zip" });
      for (const part of parts) part.fill(0);
      parts.length = 0;
      blobParts.length = 0;
      if (blob.size !== archiveBytes || blob.size > maxBytes)
        throw new ImageInputError(blob.size > maxBytes ? "LIMIT_EXCEEDED" : "CONVERSION_FAILED");
      return blob;
    },
    dispose() {
      finished = true;
      for (const part of parts) part.fill(0);
      parts.length = 0;
    },
  };
}
