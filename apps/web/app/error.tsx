"use client";

import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button, buttonVariants } from "@toolbox/ui/components/button";
import Link from "next/link";

export default function PageError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="container-site page flex-1" id="main-content" tabIndex={-1}>
      <h1 className="mb-8 text-3xl font-semibold">This page could not load</h1>
      <Alert>
        <AlertTitle>Please try again</AlertTitle>
        <AlertDescription>
          If the problem continues, return to the homepage. No files are processed by this page.
        </AlertDescription>
      </Alert>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={retry}>Try again</Button>
        <Link className={buttonVariants("outline")} href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
