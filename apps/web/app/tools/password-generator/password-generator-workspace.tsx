"use client";

import {
  assertPasswordGeneratorOptions,
  generatePassword,
  getPasswordGeneratorMetrics,
  type PasswordGeneratorOptions,
  passwordGeneratorLimits,
} from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button } from "@toolbox/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@toolbox/ui/components/field";
import { useRef, useState } from "react";
import {
  OptionsPanel,
  PreviewPane,
  ToolWorkspace,
} from "../../_components/workspace/tool-workspace";

const defaultOptions: PasswordGeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
};

const classOptions = [
  { key: "uppercase", label: "Uppercase letters (A–Z)" },
  { key: "lowercase", label: "Lowercase letters (a–z)" },
  { key: "digits", label: "Digits (0–9)" },
  { key: "symbols", label: "Symbols" },
] as const;

function hasValidSettings(options: PasswordGeneratorOptions): boolean {
  try {
    assertPasswordGeneratorOptions(options);
    return true;
  } catch {
    return false;
  }
}

export default function PasswordGeneratorWorkspace() {
  const [options, setOptions] = useState(defaultOptions);
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Choose options and generate a password in this tab.");
  const operation = useRef(0);
  const valid = hasValidSettings(options);
  const metrics = valid ? getPasswordGeneratorMetrics(options) : null;

  function changeOptions(update: Partial<PasswordGeneratorOptions>) {
    operation.current++;
    setOptions((current) => ({ ...current, ...update }));
    setPassword("");
    setIsVisible(false);
    setError("");
    setStatus("Settings changed. Generate a password when ready.");
  }

  function generate() {
    operation.current++;
    try {
      const nextPassword = generatePassword(options);
      setPassword(nextPassword);
      setIsVisible(false);
      setError("");
      setStatus("Password generated with the browser’s secure random source.");
    } catch {
      setPassword("");
      setIsVisible(false);
      setError(
        "Secure password generation failed. This browser did not provide a usable random source.",
      );
      setStatus("No password was generated.");
    }
  }

  async function copyPassword() {
    if (!password) return;
    const operationId = ++operation.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(password);
      if (operationId !== operation.current) return;
      setError("");
      setStatus("Password copied to this device’s clipboard.");
    } catch {
      if (operationId !== operation.current) return;
      setError(
        "The browser could not copy to the clipboard. Check clipboard permission and try again.",
      );
      setStatus("The password remains available in this tab.");
    }
  }

  function reset() {
    operation.current++;
    setOptions({ ...defaultOptions });
    setPassword("");
    setIsVisible(false);
    setError("");
    setStatus("Reset complete. The password was cleared from this tab.");
  }

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <OptionsPanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password-length">Password length</FieldLabel>
              <input
                id="password-length"
                className="input min-h-11 max-w-40"
                type="number"
                inputMode="numeric"
                min={passwordGeneratorLimits.minimumLength}
                max={passwordGeneratorLimits.maximumLength}
                step={1}
                value={options.length}
                onChange={(event) => changeOptions({ length: Number(event.currentTarget.value) })}
                aria-describedby="password-length-help"
              />
              <p id="password-length-help" className="text-xs text-muted-foreground">
                {passwordGeneratorLimits.minimumLength}–{passwordGeneratorLimits.maximumLength}{" "}
                characters.
              </p>
            </Field>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 font-medium">Character types</legend>
              {classOptions.map(({ key, label }) => (
                <label key={key} className="flex min-h-11 items-center gap-3 rounded-md border p-3">
                  <input
                    className="size-4 accent-primary"
                    type="checkbox"
                    checked={options[key]}
                    onChange={(event) => changeOptions({ [key]: event.currentTarget.checked })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <label className="flex min-h-11 items-center gap-3 rounded-md border p-3">
              <input
                className="size-4 accent-primary"
                type="checkbox"
                checked={options.avoidAmbiguous}
                onChange={(event) => changeOptions({ avoidAmbiguous: event.currentTarget.checked })}
              />
              <span>Avoid ambiguous characters (O, 0, I, l, 1)</span>
            </label>
            {!valid ? (
              <p className="text-sm text-destructive" role="alert">
                Choose a whole-number length from {passwordGeneratorLimits.minimumLength} to{" "}
                {passwordGeneratorLimits.maximumLength} and at least one character type.
              </p>
            ) : null}
            {metrics ? (
              <p className="text-sm text-muted-foreground">
                Character pool: {metrics.characterPoolSize} · approximate configured search space:{" "}
                {metrics.searchSpaceBits.toFixed(1)} bits
              </p>
            ) : null}
          </FieldGroup>
        </OptionsPanel>
        {error ? (
          <Alert className="border border-destructive/40">
            <AlertTitle>Password action needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p role="status" aria-live="polite" className="rounded-md bg-muted p-4 text-sm">
          {status}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={generate} disabled={!valid}>
            {password ? "Regenerate" : "Generate password"}
          </Button>
          <Button type="button" variant="outline" onClick={copyPassword} disabled={!password}>
            Copy password
          </Button>
          <Button type="button" variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <PreviewPane>
          {password ? (
            <div className="flex flex-col gap-4">
              <section
                aria-label={isVisible ? "Generated password" : "Generated password hidden"}
                className="block min-h-16 break-all rounded-md border bg-background p-4 font-mono text-lg"
              >
                {isVisible ? password : "•".repeat(password.length)}
              </section>
              <Button
                type="button"
                variant="outline"
                aria-pressed={isVisible}
                onClick={() => setIsVisible((visible) => !visible)}
              >
                {isVisible ? "Hide password" : "Show password"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your generated password appears here and stays in this browser tab until settings
              change or you reset.
            </p>
          )}
        </PreviewPane>
      </div>
    </ToolWorkspace>
  );
}
