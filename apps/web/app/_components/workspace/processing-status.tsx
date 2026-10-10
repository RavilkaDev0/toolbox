export type WorkspaceState =
  | "idle"
  | "validating"
  | "ready"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

const labels: Record<WorkspaceState, string> = {
  idle: "Select files to get started.",
  validating: "Checking files…",
  ready: "Files are ready. Review your settings.",
  processing: "Processing… You can cancel this operation.",
  succeeded: "Your result is ready.",
  failed: "Processing could not finish. Review the error and try again.",
  cancelled: "Operation cancelled. Select files again when you are ready.",
};

export function ProcessingStatus({ state }: { state: WorkspaceState }) {
  return (
    <p role="status" aria-live="polite" className="rounded-md bg-muted p-4 text-sm">
      {labels[state]}
    </p>
  );
}
