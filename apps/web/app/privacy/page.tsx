import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import { createPageMetadata } from "../_lib/site-url";

export const metadata: Metadata = {
  ...createPageMetadata(
    "Privacy policy",
    "How Toolbox tools process data locally and what the website still needs to disclose.",
    "/privacy",
  ),
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      description="A plain-language draft describing the current browser-based tools and the details still awaiting owner review."
    >
      <section aria-labelledby="privacy-processing">
        <h2 className="text-xl font-semibold text-foreground" id="privacy-processing">
          Tool inputs
        </h2>
        <p className="mt-3">
          The tools included in this application process selected files and entered text in your
          browser. Their processing code does not send those inputs to a Toolbox conversion API.
          Your browser still requests the website pages and static assets needed to run the tools.
        </p>
      </section>
      <section aria-labelledby="privacy-hosting">
        <h2 className="text-xl font-semibold text-foreground" id="privacy-hosting">
          Website and hosting data
        </h2>
        <p className="mt-3">
          Local tool processing does not describe data handled by the browser, device, network,
          hosting provider or any security service. This repository does not select a production
          host or define its request logs, fields, access or retention period. The owner must verify
          those practices and update this policy before release.
        </p>
      </section>
      <section aria-labelledby="privacy-analytics">
        <h2 className="text-xl font-semibold text-foreground" id="privacy-analytics">
          Analytics and third-party services
        </h2>
        <p className="mt-3">
          The current web application has no analytics or advertising SDK configured. Any analytics,
          embedded service or hosting change added later must be reviewed and disclosed here before
          it is enabled.
        </p>
      </section>
      <section aria-labelledby="privacy-owner">
        <h2 className="text-xl font-semibold text-foreground" id="privacy-owner">
          Publisher and privacy requests
        </h2>
        <p className="mt-3">
          The owner must add the publisher’s legal name, the applicable jurisdiction, an effective
          date and a monitored privacy contact. No contact address or legal entity has been provided
          for this release candidate.
        </p>
      </section>
    </LegalPage>
  );
}
