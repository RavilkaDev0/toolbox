"use client";

import { fileMetadataSchema, fileSelectionLimitsSchema } from "@toolbox/contracts";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button, buttonVariants } from "@toolbox/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@toolbox/ui/components/field";
import { Skeleton } from "@toolbox/ui/components/skeleton";
import { useRef, useState } from "react";
import { FileDropzone } from "../_components/workspace/file-dropzone";
import { FileList } from "../_components/workspace/file-list";
import { ProcessingStatus, type WorkspaceState } from "../_components/workspace/processing-status";
import {
  OptionsPanel,
  PreviewPane,
  ResultRegion,
  ToolWorkspace,
} from "../_components/workspace/tool-workspace";

const limits = fileSelectionLimitsSchema.parse({ maxFiles: 10, maxBytes: 1024 * 1024 });
const states: readonly WorkspaceState[] = [
  "idle",
  "validating",
  "ready",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
];

export function WorkspaceFixture() {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<WorkspaceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const busy = state === "processing" || state === "validating";
  function selectFiles(incoming: File[]) {
    const selection = [...files, ...incoming];
    if (!incoming.length) return;
    if (selection.length > limits.maxFiles) {
      setError("Choose at most 10 files. Remove a file before adding more.");
      return;
    }
    if (
      selection.some(
        (file) =>
          !fileMetadataSchema.safeParse(file).success ||
          file.size > limits.maxBytes ||
          !file.name.toLowerCase().endsWith(".txt"),
      )
    ) {
      setError(
        "Choose non-empty TXT files up to 1 MiB, with filenames of at most 255 characters. File contents are not validated by this fixture.",
      );
      return;
    }
    setFiles(selection);
    setError(null);
    setState("ready");
  }
  function reset() {
    setFiles([]);
    setError(null);
    setState("idle");
    resetButton.current?.focus();
  }
  return (
    <div className="flex flex-col gap-8">
      <FieldGroup className="max-w-copy">
        <Field>
          <FieldLabel htmlFor="fixture-state">Preview workspace state (UI only)</FieldLabel>
          <select
            className="input"
            id="fixture-state"
            value={state}
            onChange={(event) => {
              const next = states.find((item) => item === event.target.value);
              if (next) {
                setState(next);
                setError(null);
              }
            }}
          >
            {states.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>
      <ToolWorkspace>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <FileDropzone
            onFiles={selectFiles}
            accept=".txt,text/plain"
            description="UI fixture: TXT, up to 1 MiB each, 10 files total. Metadata checks only; contents are never read."
            disabled={busy}
          />
          <FileList
            files={files}
            disabled={busy}
            onRemove={(index) => {
              const remaining = files.filter((_, i) => i !== index);
              setFiles(remaining);
              setState(remaining.length ? "ready" : "idle");
              setError(null);
              resetButton.current?.focus();
            }}
          />
          <ProcessingStatus state={state} />
          {error || state === "failed" ? (
            <Alert>
              <AlertTitle>Review your files</AlertTitle>
              <AlertDescription>
                {error ??
                  "Example error: the file could not be processed. Try another file or reset the workspace. This is a UI scenario, not an engine result."}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {busy ? (
              <Button
                onClick={() => {
                  setState("cancelled");
                  setFiles([]);
                  resetButton.current?.focus();
                }}
              >
                Cancel
              </Button>
            ) : null}
            <Button ref={resetButton} variant="outline" onClick={reset}>
              Reset workspace
            </Button>
          </div>
        </div>
        <OptionsPanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fixture-setting">Example output format</FieldLabel>
              <select className="input" id="fixture-setting" disabled={busy} defaultValue="txt">
                <option value="txt">TXT (fixture only)</option>
              </select>
            </Field>
          </FieldGroup>
          <p className="text-sm text-muted-foreground">
            No engine is connected. Choosing a state only changes this example.
          </p>
        </OptionsPanel>
        <div className="lg:col-span-2">
          <PreviewPane>
            {state === "validating" ? <Skeleton className="h-20" /> : null}
            <p className="text-sm text-muted-foreground">
              {state === "succeeded"
                ? "Toolbox UI fixture — an example preview, not converted file contents."
                : "A preview will appear here when a real engine provides one."}
            </p>
          </PreviewPane>
        </div>
        <ResultRegion>
          {state === "succeeded" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Static UI fixture result. No selected file has been read or converted.
              </p>
              <a
                className={buttonVariants()}
                href="data:text/plain;charset=utf-8,Toolbox%20UI%20fixture%20%E2%80%94%20not%20a%20conversion%20result."
                download="toolbox-ui-fixture.txt"
              >
                Download fixture
              </a>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Results will appear after processing.</p>
          )}
        </ResultRegion>
      </ToolWorkspace>
    </div>
  );
}
