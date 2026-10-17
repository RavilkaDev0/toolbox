import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <main className="container-site page flex-1" id="main-content" tabIndex={-1}>
      <header className="max-w-copy">
        <p className="eyebrow mb-3">Policies and support</p>
        <h1 className="text-hero font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{description}</p>
      </header>
      <Alert className="mt-8 max-w-copy">
        <AlertTitle>Release draft — owner details are required</AlertTitle>
        <AlertDescription>
          These pages describe the current application. The publisher identity, jurisdiction,
          monitored contact and hosting log practices still need owner confirmation and legal review
          before public release.
        </AlertDescription>
      </Alert>
      <article className="mt-10 flex max-w-copy flex-col gap-8 text-muted-foreground">
        {children}
      </article>
    </main>
  );
}
