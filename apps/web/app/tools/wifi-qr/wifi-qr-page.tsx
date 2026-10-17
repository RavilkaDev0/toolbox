import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import WifiQrWorkspace from "./wifi-qr-workspace";

export function WifiQrPage({ tool }: { tool: ToolDefinition }) {
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
          Create a Wi-Fi QR code for a secured, hidden or open network. The browser checks the
          generated PNG and vector SVG before offering either download.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Network details stay in this tab and are not saved or uploaded. QR connection support
          varies by phone, camera, scanner app and Wi-Fi security mode.
        </p>
      </header>
      <section className="section" aria-label="Wi-Fi QR workspace">
        <WifiQrWorkspace />
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="wifi-how">
        <h2 id="wifi-how" className="text-2xl font-semibold">
          Share a Wi-Fi QR code
        </h2>
        <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
          <li>Enter the network name exactly as it appears in Wi-Fi settings.</li>
          <li>Choose the network's actual security type and enter its password if required.</li>
          <li>Mark the network hidden only when its SSID is not broadcast.</li>
          <li>
            Generate, check and download the code. Test it with the intended device before sharing.
          </li>
        </ol>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Wi-Fi QR text follows a widely used device configuration format, not a universal promise
          of one-tap connection. WPA uses the QR type WPA for WPA/WPA2 and transition networks.
          WPA3-Personal uses the SAE extension, which some newer Android readers support and some
          other scanners may not. WEP is a legacy option. Anyone who scans the generated QR can read
          its network details, so share it only with people you trust.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Related tools">
          <Link className="text-link" href="/tools/qr-designer">
            Design a QR code from text or a URL
          </Link>
          <Link className="text-link" href="/tools/contact-qr">
            Create a contact QR code
          </Link>
          <Link className="text-link" href="/categories/qr">
            Explore QR tools
          </Link>
        </nav>
      </section>
    </main>
  );
}
