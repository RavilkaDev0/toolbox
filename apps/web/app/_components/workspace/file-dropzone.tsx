"use client";

import { Button } from "@toolbox/ui/components/button";
import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

export function FileDropzone({
  onFiles,
  accept,
  description,
  inputLabel = "Choose files",
  disabled = false,
  multiple = true,
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  description: string;
  inputLabel?: string;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [dragging, setDragging] = useState(false);
  return (
    <section
      className="dropzone"
      aria-label="File selection"
      data-dragging={dragging}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Upload aria-hidden="true" className="size-6 text-primary" />
      <h3 className="font-semibold">Drop files here</h3>
      <p className="text-sm text-muted-foreground" id={descriptionId}>
        {description}
      </p>
      <Button
        type="button"
        disabled={disabled}
        aria-describedby={descriptionId}
        onClick={() => input.current?.click()}
      >
        Choose files
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={disabled}
        aria-label={inputLabel}
        onChange={(event) => {
          onFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
