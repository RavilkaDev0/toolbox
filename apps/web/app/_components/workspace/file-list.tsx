"use client";

import { Button } from "@toolbox/ui/components/button";

export function FileList({
  files,
  onRemove,
  disabled = false,
}: {
  files: readonly File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <section aria-labelledby="selected-files-title">
      <h3 className="mb-4 font-semibold" id="selected-files-title">
        Selected files
      </h3>
      {files.length ? (
        <ul className="flex flex-col gap-3">
          {files.map((file, index) => (
            <li
              key={`${index}-${file.name}-${file.size}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-medium">{file.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {file.size.toLocaleString("en-US")} bytes
                </p>
              </div>
              <Button
                variant="outline"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemove(index)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No files selected.</p>
      )}
    </section>
  );
}
