import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import PasswordGeneratorWorkspace from "./password-generator-workspace";

export function PasswordGeneratorPage({ tool }: { tool: ToolDefinition }) {
  return (
    <main className="container-site page max-w-workspace flex-1" id="main-content" tabIndex={-1}>
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link className="text-link" href="/tools">
          Tools
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="text-link" href="/categories/utility">
          Utilities
        </Link>
        <span aria-hidden="true">/</span>
        <span>{tool.title}</span>
      </nav>
      <header className="section flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">Utility tools · Browser-local</p>
        <h1 className="text-4xl font-semibold tracking-tight">{tool.title}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          Generate a random password using your browser’s cryptographic random source. Choose the
          length and character types to match the service that will use it.
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Passwords stay in this tab until you change settings, reset or leave. Copying places the
          password on your device clipboard. This tool does not save, upload or audit passwords.
        </p>
      </header>
      <noscript>
        <p className="mt-6">Enable JavaScript to generate a password locally in your browser.</p>
      </noscript>
      <section className="section" aria-label="Password generator workspace">
        <PasswordGeneratorWorkspace />
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="password-how">
        <h2 id="password-how" className="text-2xl font-semibold">
          Create a password
        </h2>
        <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
          <li>Choose a length from 8 to 128 characters.</li>
          <li>
            Select the character types the destination accepts; each selected type is included.
          </li>
          <li>Generate or regenerate, then copy the result when you are ready to use it.</li>
          <li>Reset the tool to clear its in-tab result and restore the defaults.</li>
        </ol>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The displayed search-space estimate follows the selected alphabet, length and required
          character types. It is not a password audit and does not account for how a service stores
          passwords, reuse, phishing or device access. A copied password may remain in the operating
          system clipboard after resetting this page.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Related tools">
          <Link className="text-link" href="/tools/word-counter">
            Count and analyze text
          </Link>
          <Link className="text-link" href="/tools/case-converter">
            Convert text case
          </Link>
          <Link className="text-link" href="/categories/utility">
            Explore utility tools
          </Link>
        </nav>
      </section>
    </main>
  );
}
