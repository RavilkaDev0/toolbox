"use client";

import { analyzeText, wordCounterLimits } from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button } from "@toolbox/ui/components/button";
import { Field, FieldLabel } from "@toolbox/ui/components/field";
import { useMemo, useRef, useState } from "react";
import {
  OptionsPanel,
  PreviewPane,
  ToolWorkspace,
} from "../../_components/workspace/tool-workspace";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export default function WordCounterWorkspace() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Type or paste text to see local counts.");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const operation = useRef(0);
  const analysis = useMemo(() => analyzeText(text), [text]);

  function changeText(nextText: string) {
    operation.current++;
    if (nextText.length > wordCounterLimits.maximumUtf16CodeUnits) {
      setError("Text exceeds the 100,000 UTF-16 code-unit limit. Shorten it and try again.");
      setStatus("The previous text and counts are unchanged.");
      return;
    }
    setText(nextText);
    setError("");
    setStatus(nextText ? "Counts updated locally." : "Text cleared.");
  }

  async function copyText() {
    if (!text) return;
    const operationId = ++operation.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      if (operationId !== operation.current) return;
      setError("");
      setStatus("Text copied to this device’s clipboard.");
    } catch {
      if (operationId !== operation.current) return;
      setError(
        "The browser could not copy to the clipboard. Check clipboard permission and try again.",
      );
      setStatus("Your text remains in this tab.");
    }
  }

  function clearText() {
    operation.current++;
    setText("");
    setError("");
    setStatus("Text cleared. You can enter a new passage.");
  }

  function reset() {
    clearText();
    setStatus("Reset complete. The text and counts were cleared.");
    inputRef.current?.focus();
  }

  const metrics = [
    { label: "Words", value: analysis.wordCount },
    { label: "Characters with whitespace", value: analysis.charactersWithWhitespace },
    { label: "Characters without whitespace", value: analysis.charactersWithoutWhitespace },
    { label: "Sentences", value: analysis.sentenceCount },
    { label: "Paragraphs", value: analysis.paragraphCount },
    { label: "Lines", value: analysis.lineCount },
    { label: "UTF-16 code units", value: analysis.utf16CodeUnits },
    { label: "Unicode code points", value: analysis.unicodeCodePoints },
  ];

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <OptionsPanel>
          <Field>
            <FieldLabel htmlFor="word-counter-text">Text to analyze</FieldLabel>
            <textarea
              ref={inputRef}
              id="word-counter-text"
              className="input min-h-72 resize-y font-mono text-sm"
              value={text}
              onChange={(event) => changeText(event.currentTarget.value)}
              aria-describedby="word-counter-help"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <p id="word-counter-help" className="text-xs text-muted-foreground">
              Up to {formatCount(wordCounterLimits.maximumUtf16CodeUnits)} UTF-16 code units · local
              analysis only.
            </p>
          </Field>
        </OptionsPanel>
        {error ? (
          <Alert className="border border-destructive/40">
            <AlertTitle>Text could not be processed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p role="status" aria-live="polite" className="rounded-md bg-muted p-4 text-sm">
          {status}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copyText} disabled={!text}>
            Copy text
          </Button>
          <Button type="button" variant="outline" onClick={clearText} disabled={!text && !error}>
            Clear
          </Button>
          <Button type="button" variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <PreviewPane>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {metrics.map(({ label, value }) => (
              <div key={label} className="rounded-md border p-3">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  <span data-testid={`word-counter-${label.toLowerCase().replaceAll(" ", "-")}`}>
                    {formatCount(value)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          {text && !analysis.usesIntlSegmenter ? (
            <p className="mt-4 text-sm text-muted-foreground">
              This browser lacks Intl.Segmenter. Character counts use Unicode code points and word
              and sentence counts use the documented approximate fallback.
            </p>
          ) : null}
        </PreviewPane>
      </div>
    </ToolWorkspace>
  );
}
