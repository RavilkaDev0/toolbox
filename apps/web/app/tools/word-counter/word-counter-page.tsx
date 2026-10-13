import type { ToolDefinition } from "@toolbox/core";
import Link from "next/link";
import WordCounterWorkspace from "./word-counter-workspace";

export function WordCounterPage({ tool }: { tool: ToolDefinition }) {
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
          Count words, sentences, lines and characters while you type or paste. Your text stays in
          this tab and is not uploaded.
        </p>
      </header>
      <section className="section" aria-label="Word counter workspace">
        <WordCounterWorkspace />
      </section>
      <section className="section flex flex-col gap-4" aria-labelledby="word-counter-definitions">
        <h2 id="word-counter-definitions" className="text-2xl font-semibold">
          How counts are defined
        </h2>
        <ul className="list-inside list-disc space-y-2 text-muted-foreground">
          <li>
            Words are locale-aware word-like segments from the browser’s `Intl.Segmenter`. If that
            API is unavailable, fallback counts runs of Unicode letters/numbers with combining marks
            and internal apostrophes; this fallback is approximate for languages such as Chinese and
            Japanese.
          </li>
          <li>
            Characters with spaces count grapheme clusters (user-perceived characters), including
            all whitespace. Without spaces excludes grapheme clusters made only of Unicode
            whitespace. Browsers without `Intl.Segmenter` count Unicode code points for both.
          </li>
          <li>
            UTF-16 code units and Unicode code points are also shown because they differ from
            grapheme clusters for emoji and combining marks.
          </li>
          <li>
            Lines are logical lines separated by LF, CRLF or CR; empty input has zero lines and a
            trailing line break adds an empty final line. Paragraphs are runs of non-empty lines
            separated by one or more blank/whitespace-only lines. Sentences count non-whitespace
            segments from `Intl.Segmenter`; fallback groups sentence-ending punctuation and counts
            any remaining text as one sentence.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Input is limited to 100,000 UTF-16 code units to keep analysis bounded on mobile devices.
          Counts are descriptive and locale/API behavior can vary by browser.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Related tools">
          <Link className="text-link" href="/tools/password-generator">
            Generate a password
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
