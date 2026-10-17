import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import CaseConverterWorkspace from "./case-converter-workspace";

export function CaseConverterPage({ tool }: { tool: ToolDefinition }) {
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
        <p className="text-sm font-medium text-muted-foreground">Text tools · Browser-local</p>
        <h1 className="text-4xl font-semibold tracking-tight">{tool.title}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          Convert text to uppercase, lowercase, title case, sentence case or toggle case. Preview
          changes as you type, then copy the result.
        </p>
      </header>
      <section className="section" aria-label="Case converter workspace">
        <CaseConverterWorkspace />
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="case-converter-rules">
        <h2 id="case-converter-rules" className="text-2xl font-semibold">
          How case conversion works
        </h2>
        <ul className="list-inside list-disc space-y-2 text-muted-foreground">
          <li>
            Uppercase and lowercase use the selected locale’s Unicode mappings. Some mappings change
            string length: for example, German ß can become SS, and Turkish I follows Turkish
            dotted/dotless rules.
          </li>
          <li>
            Title Case lowercases each word-like segment, then capitalizes its first cased grapheme.
            Sentence case lowercases each sentence segment and capitalizes its first cased grapheme.
            These simple rules do not apply language-specific title conventions, recognize every
            abbreviation, or guarantee editorially correct capitalization.
          </li>
          <li>
            When available, the browser’s Intl.Segmenter keeps graphemes, words and sentence
            boundaries together. The fallback uses Unicode letter/number runs for words and common
            sentence-ending punctuation; it can differ for complex scripts and abbreviations.
          </li>
          <li>
            Toggle case swaps each cased grapheme. Unicode casing can expand letters, so toggling
            twice is not guaranteed to recreate the original spelling (for example, ß may become
            SS).
          </li>
          <li>Spacing, punctuation, line endings, emoji and uncased symbols are preserved.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Input is limited to 100,000 UTF-16 code units. Text stays in this tab and is not uploaded
          or saved. Copy writes the result only after you request it.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Related tools">
          <Link className="text-link" href="/tools/word-counter">
            Count words and characters
          </Link>
          <Link className="text-link" href="/tools/password-generator">
            Generate a password
          </Link>
          <Link className="text-link" href="/categories/utility">
            Explore utility tools
          </Link>
        </nav>
      </section>
    </main>
  );
}
