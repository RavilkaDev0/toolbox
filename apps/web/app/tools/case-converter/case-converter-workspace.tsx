"use client";

import {
  CaseConverterError,
  type CaseConverterLocale,
  type CaseConverterMode,
  caseConverterLimits,
  caseConverterLocales,
  caseConverterModes,
  convertTextCase,
} from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button } from "@toolbox/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@toolbox/ui/components/field";
import { useMemo, useRef, useState } from "react";
import {
  OptionsPanel,
  PreviewPane,
  ToolWorkspace,
} from "../../_components/workspace/tool-workspace";

const modeOptions: ReadonlyArray<{ value: CaseConverterMode; label: string }> = [
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
  { value: "title", label: "Title Case" },
  { value: "sentence", label: "Sentence case" },
  { value: "toggle", label: "tOGGLE cASE" },
];

const localeOptions: ReadonlyArray<{ value: CaseConverterLocale; label: string }> = [
  { value: "default", label: "Browser default" },
  { value: "en-US", label: "English" },
  { value: "tr", label: "Turkish" },
  { value: "de", label: "German" },
  { value: "ru", label: "Russian" },
  { value: "ja", label: "Japanese" },
];

const modeValues = new Set<string>(caseConverterModes);
const localeValues = new Set<string>(caseConverterLocales);

export default function CaseConverterWorkspace() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<CaseConverterMode>("uppercase");
  const [locale, setLocale] = useState<CaseConverterLocale>("default");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Enter text to see a local preview.");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const operation = useRef(0);

  const conversion = useMemo(() => {
    try {
      return { value: convertTextCase(text, mode, locale), error: "" };
    } catch (cause) {
      return {
        value: "",
        error:
          cause instanceof CaseConverterError
            ? cause.message
            : "This text could not be converted safely. Shorten it and try again.",
      };
    }
  }, [text, mode, locale]);

  function changeText(nextText: string) {
    operation.current++;
    if (nextText.length > caseConverterLimits.maximumInputCodeUnits) {
      setError("Text exceeds the 100,000 UTF-16 code-unit limit. Shorten it and try again.");
      setStatus("The previous text and preview are unchanged.");
      return;
    }
    setText(nextText);
    setError("");
    setStatus(nextText ? "Preview updated locally." : "Text cleared.");
  }

  function changeMode(nextMode: string) {
    operation.current++;
    if (!modeValues.has(nextMode)) return;
    setMode(nextMode as CaseConverterMode);
    setError("");
    setStatus(text ? "Preview updated locally." : "Choose a mode and enter text.");
  }

  function changeLocale(nextLocale: string) {
    operation.current++;
    if (!localeValues.has(nextLocale)) return;
    setLocale(nextLocale as CaseConverterLocale);
    setError("");
    setStatus(text ? "Preview updated locally." : "Choose a language rule and enter text.");
  }

  async function copyResult() {
    if (!conversion.value) return;
    const operationId = ++operation.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(conversion.value);
      if (operationId !== operation.current) return;
      setError("");
      setStatus("Converted text copied to this device’s clipboard.");
    } catch {
      if (operationId !== operation.current) return;
      setError("The browser could not copy to the clipboard. Check permission and try again.");
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
    operation.current++;
    setText("");
    setMode("uppercase");
    setLocale("default");
    setError("");
    setStatus("Reset complete. Text and settings returned to their defaults.");
    inputRef.current?.focus();
  }

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <OptionsPanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="case-converter-mode">Conversion mode</FieldLabel>
              <select
                id="case-converter-mode"
                className="input min-h-11"
                value={mode}
                onChange={(event) => changeMode(event.currentTarget.value)}
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="case-converter-locale">Language rules</FieldLabel>
              <select
                id="case-converter-locale"
                className="input min-h-11"
                value={locale}
                onChange={(event) => changeLocale(event.currentTarget.value)}
              >
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Upper/lower casing follows the selected locale. Browser default uses this device’s
                locale.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="case-converter-input">Text to convert</FieldLabel>
              <textarea
                ref={inputRef}
                id="case-converter-input"
                className="input min-h-64 resize-y font-mono text-sm"
                value={text}
                onChange={(event) => changeText(event.currentTarget.value)}
                aria-describedby="case-converter-input-help"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
              <p id="case-converter-input-help" className="text-xs text-muted-foreground">
                Up to {caseConverterLimits.maximumInputCodeUnits.toLocaleString("en-US")} UTF-16
                code units · local only · line breaks and spacing are preserved.
              </p>
            </Field>
          </FieldGroup>
        </OptionsPanel>
        {error || conversion.error ? (
          <Alert className="border border-destructive/40" role="alert">
            <AlertTitle>Text could not be converted</AlertTitle>
            <AlertDescription>{error || conversion.error}</AlertDescription>
          </Alert>
        ) : null}
        <p role="status" aria-live="polite" className="rounded-md bg-muted p-4 text-sm">
          {status}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={copyResult}
            disabled={!conversion.value || Boolean(conversion.error)}
          >
            Copy result
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
          <Field>
            <FieldLabel htmlFor="case-converter-output">Converted text</FieldLabel>
            <textarea
              id="case-converter-output"
              className="input min-h-64 resize-y font-mono text-sm"
              value={conversion.value}
              readOnly
              placeholder="The converted result appears here."
              aria-label="Converted text"
              spellCheck={false}
            />
          </Field>
        </PreviewPane>
      </div>
    </ToolWorkspace>
  );
}
