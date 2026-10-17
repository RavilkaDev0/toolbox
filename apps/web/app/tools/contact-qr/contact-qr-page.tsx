import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import ContactQrWorkspace from "./contact-qr-workspace";

export function ContactQrPage({ tool }: { tool: ToolDefinition }) {
  return (
    <main className="container-site page max-w-workspace flex-1" id="main-content" tabIndex={-1}>
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link className="text-link" href="/tools">
          Tools
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="text-link" href="/categories/qr">
          QR codes
        </Link>
        <span aria-hidden="true">/</span>
        <span>{tool.title}</span>
      </nav>
      <header className="section flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">QR tools · Browser-local</p>
        <h1 className="text-4xl font-semibold tracking-tight">{tool.title}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          Make a contact QR with a scan-checked vCard preview. Add only the name and contact details
          you want other people to save.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Contact values stay in this browser tab and are not uploaded or saved by this tool. Anyone
          who scans the code or opens the vCard can read the details included.
        </p>
      </header>
      <section className="section" aria-label="Contact QR workspace">
        <ContactQrWorkspace />
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="contact-how">
        <h2 id="contact-how" className="text-2xl font-semibold">
          Create a contact QR code
        </h2>
        <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
          <li>
            Enter a full name. Organization, title, phone, email, website and address are optional.
          </li>
          <li>
            Review the live QR preview after each change; the browser verifies its decoded contact
            card.
          </li>
          <li>Download the QR image or a vCard file that can be imported into a contacts app.</li>
          <li>
            Test the code with the device or app where the contact will be added before sharing.
          </li>
        </ol>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The export uses vCard 3.0 with escaped text fields and folded long lines. QR capacity and
          scanner support vary; no preview can guarantee import behavior in every camera or contact
          app. The vCard and QR contain the same personal information, so share either only with
          people you trust.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Related tools">
          <Link className="text-link" href="/tools/qr-designer">
            Design a QR code from text or a URL
          </Link>
          <Link className="text-link" href="/tools/wifi-qr">
            Create a Wi-Fi QR code
          </Link>
          <Link className="text-link" href="/categories/qr">
            Explore QR tools
          </Link>
        </nav>
      </section>
    </main>
  );
}
