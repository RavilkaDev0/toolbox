import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import { createPageMetadata } from "../_lib/site-url";

export const metadata: Metadata = {
  ...createPageMetadata(
    "Terms of use",
    "Draft terms for using Toolbox browser-based PDF, image, QR and text tools.",
    "/terms",
  ),
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      description="A release draft for the current browser-based tools. The owner must complete and review the governing details before publication."
    >
      <section aria-labelledby="terms-tools">
        <h2 className="text-xl font-semibold text-foreground" id="terms-tools">
          Using the tools
        </h2>
        <p className="mt-3">
          Use each tool within the formats, settings and limits shown on its page. You are
          responsible for having the right to process the files or text you choose and for checking
          the result before relying on it.
        </p>
      </section>
      <section aria-labelledby="terms-limits">
        <h2 className="text-xl font-semibold text-foreground" id="terms-limits">
          Output and browser limits
        </h2>
        <p className="mt-3">
          Results depend on the selected tool, input file and browser capabilities. Tool pages
          describe known limitations. Keep your source files and review generated downloads; this
          website is not a backup service, and no tool should be assumed to preserve every feature
          of every input format.
        </p>
      </section>
      <section aria-labelledby="terms-owner">
        <h2 className="text-xl font-semibold text-foreground" id="terms-owner">
          Terms that need owner review
        </h2>
        <p className="mt-3">
          Before release, the owner must provide the publisher’s legal identity, applicable law,
          effective date and a monitored contact, then review these terms for the intended audience
          and jurisdictions. This draft does not make those choices on the owner’s behalf.
        </p>
      </section>
    </LegalPage>
  );
}
