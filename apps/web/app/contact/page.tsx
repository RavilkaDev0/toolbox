import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import { createPageMetadata } from "../_lib/site-url";

export const metadata: Metadata = {
  ...createPageMetadata(
    "Contact and support",
    "Support and privacy contact information for Toolbox.",
    "/contact",
  ),
  robots: { index: false, follow: true },
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact and support"
      description="Support contact details have not yet been supplied for this release candidate."
    >
      <section aria-labelledby="contact-required">
        <h2 className="text-xl font-semibold text-foreground" id="contact-required">
          Before release
        </h2>
        <p className="mt-3">
          The owner must provide a monitored support address and a privacy contact here before the
          service is offered publicly. No email address, legal entity or postal address has been
          provided, so this page does not invent one.
        </p>
        <p className="mt-3">
          Do not send private documents or passwords through a support channel. Toolbox support does
          not need the files or text you process with a browser tool.
        </p>
      </section>
    </LegalPage>
  );
}
