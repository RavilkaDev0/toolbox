import type { ReactNode } from "react";

export function ToolWorkspace({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="Tool workspace"
      className="mx-auto grid max-w-workspace gap-6 lg:grid-cols-3"
    >
      <h2 className="sr-only">Tool workspace</h2>
      {children}
    </section>
  );
}

export function OptionsPanel({ children }: { children: ReactNode }) {
  return (
    <fieldset className="card">
      <legend className="px-2 font-semibold">Settings</legend>
      {children}
    </fieldset>
  );
}

export function PreviewPane({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="preview-title" className="card">
      <h2 className="text-lg font-semibold" id="preview-title">
        Preview
      </h2>
      {children}
    </section>
  );
}

export function ResultRegion({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="result-title" className="card">
      <h2 className="text-lg font-semibold" id="result-title">
        Result
      </h2>
      {children}
    </section>
  );
}
