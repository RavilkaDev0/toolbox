"use client";

import type { QrDesignerResult, SanitizedQrLogo } from "@toolbox/browser-engines/qr-designer";
import {
  assertQrDesignerSettings,
  assertQrPayload,
  assertQrUrl,
  QrDesignerError,
  type QrDesignerMode,
  type QrDesignerPreset,
  type QrDesignerSettings,
  qrDesignerLimits,
  qrDesignerPresets,
} from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button, buttonVariants } from "@toolbox/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@toolbox/ui/components/field";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileDropzone } from "../../_components/workspace/file-dropzone";
import {
  OptionsPanel,
  PreviewPane,
  ResultRegion,
  ToolWorkspace,
} from "../../_components/workspace/tool-workspace";

type Engine = typeof import("@toolbox/browser-engines/qr-designer");
type QrOutput = QrDesignerResult & { readonly pngUrl: string; readonly svgUrl: string };

const labels: Record<QrDesignerPreset, string> = {
  classic: "Classic",
  garden: "Garden",
  studio: "Studio",
};

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1048576).toFixed(2)} MiB`
    : `${(bytes / 1024).toFixed(1)} KiB`;
}

export default function QrDesignerWorkspace() {
  const [mode, setMode] = useState<QrDesignerMode>("url");
  const [payload, setPayload] = useState("https://example.com");
  const [settings, setSettings] = useState<QrDesignerSettings>({ ...qrDesignerPresets.classic });
  const [preset, setPreset] = useState<QrDesignerPreset | "custom">("classic");
  const [logo, setLogo] = useState<SanitizedQrLogo | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [output, setOutput] = useState<QrOutput | null>(null);
  const [status, setStatus] = useState("Loading the local QR encoder and scanner…");
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [version, setVersion] = useState(0);
  const activeRun = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const logoGeneration = useRef(0);
  const urls = useRef(new Set<string>());
  const enginePromise = useRef<Promise<Engine> | null>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const restoreGenerateFocus = useRef(false);

  const loadEngine = useCallback(() => {
    enginePromise.current ??= import("@toolbox/browser-engines/qr-designer").catch(
      (error: unknown) => {
        enginePromise.current = null;
        throw error;
      },
    );
    return enginePromise.current;
  }, []);

  const revokeUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }, []);

  const clearOutput = useCallback(() => {
    setOutput((previous) => {
      if (previous) {
        revokeUrl(previous.pngUrl);
        revokeUrl(previous.svgUrl);
      }
      return null;
    });
  }, [revokeUrl]);

  const invalidate = useCallback(() => {
    generation.current++;
    activeRun.current?.abort();
    activeRun.current = null;
    clearOutput();
    setError("");
    setPaused(false);
  }, [clearOutput]);

  useEffect(() => {
    let mounted = true;
    void loadEngine()
      .then((loaded) => {
        if (!mounted) return;
        setEngine(loaded);
        setStatus("Ready to create a QR code.");
      })
      .catch(() => {
        if (!mounted) return;
        setError("The QR encoder could not be loaded. Use Retry loading QR tools to try again.");
        setStatus("QR tools could not be loaded.");
      });
    return () => {
      mounted = false;
      generation.current++;
      logoGeneration.current++;
      activeRun.current?.abort();
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, [loadEngine]);

  useEffect(() => {
    if (!paused || !restoreGenerateFocus.current) return;
    restoreGenerateFocus.current = false;
    generateButtonRef.current?.focus();
  }, [paused]);

  useEffect(() => {
    if (!engine || paused) return;
    if (!payload) {
      setStatus("Enter text or a URL to create a QR code.");
      return;
    }
    const runId = ++generation.current;
    const controller = new AbortController();
    activeRun.current?.abort();
    activeRun.current = controller;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          assertQrPayload(payload);
          if (mode === "url") assertQrUrl(payload);
          assertQrDesignerSettings(settings);
          setStatus("Generating and checking this design in your browser…");
          const result = await engine.createQrDesignerResult(
            mode,
            payload,
            settings,
            logo ?? undefined,
            controller.signal,
          );
          if (runId !== generation.current || controller.signal.aborted) return;
          const pngUrl = URL.createObjectURL(result.png);
          const svgUrl = URL.createObjectURL(result.svg);
          urls.current.add(pngUrl);
          urls.current.add(svgUrl);
          setOutput({ ...result, pngUrl, svgUrl });
          setStatus(
            `Verified QR design · version ${result.version} · ${result.modules} × ${result.modules} modules.`,
          );
          setError("");
        } catch (caught) {
          if (runId !== generation.current || controller.signal.aborted) return;
          setOutput(null);
          setError(
            caught instanceof QrDesignerError
              ? caught.message
              : "The browser could not finish this QR design. Try simpler styling or a smaller payload.",
          );
          setStatus("QR design could not be verified.");
        }
      })();
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (activeRun.current === controller) activeRun.current = null;
    };
  }, [engine, mode, payload, settings, logo, paused, version]);

  function updatePayload(value: string) {
    invalidate();
    setPayload(value);
    setStatus("Updated. Generating a new preview…");
  }

  function updateMode(value: QrDesignerMode) {
    invalidate();
    setMode(value);
    setStatus("Updated. Generating a new preview…");
  }

  function updateSettings(update: Partial<QrDesignerSettings>) {
    invalidate();
    setPreset("custom");
    setSettings((current) => ({ ...current, ...update }));
    setStatus("Updated. Generating a new preview…");
  }

  async function chooseLogo(files: File[]) {
    invalidate();
    const logoId = ++logoGeneration.current;
    const file = files[0];
    if (!file) {
      setLogo(null);
      return;
    }
    setStatus("Checking and normalizing the logo locally…");
    try {
      const loaded = engine ?? (await loadEngine());
      if (!engine) setEngine(loaded);
      const cleanLogo = await loaded.sanitizeQrDesignerLogo(file);
      if (logoId !== logoGeneration.current) return;
      setLogo(cleanLogo);
      setStatus("Logo checked. Generating a new preview…");
    } catch (caught) {
      if (logoId !== logoGeneration.current) return;
      setLogo(null);
      setError(
        caught instanceof QrDesignerError
          ? caught.message
          : "This logo could not be decoded. Choose a valid PNG or JPEG under the stated limits.",
      );
      setStatus("Logo could not be used.");
    }
  }

  function cancel() {
    generation.current++;
    activeRun.current?.abort();
    activeRun.current = null;
    restoreGenerateFocus.current = true;
    setPaused(true);
    setStatus("Generation cancelled. Change a setting or choose Generate QR to try again.");
  }

  function reset() {
    invalidate();
    logoGeneration.current++;
    setMode("url");
    setPayload("");
    setSettings({ ...qrDesignerPresets.classic });
    setPreset("classic");
    setLogo(null);
    setStatus("Reset complete. Enter text or a URL to get started.");
  }

  function generateNow() {
    invalidate();
    setVersion((current) => current + 1);
    setStatus("Starting a fresh QR design check…");
  }

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <FileDropzone
          onFiles={(files) => void chooseLogo(files)}
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          inputLabel="Choose a PNG or JPEG logo"
          description="Optional logo · PNG or JPEG · 1 MiB · 512 px per side · processed locally."
          disabled={!engine}
          multiple={false}
        />
        <p className="text-sm text-muted-foreground">
          Text is limited to {qrDesignerLimits.payloadBytes} UTF-8 bytes. Exports are limited to 5
          MiB PNG and 4 MiB SVG. The selected content and logo are not uploaded.
        </p>
        {error ? (
          <Alert>
            <AlertTitle>Could not generate this QR design</AlertTitle>
            <AlertDescription>
              {error} The current text and settings remain available to edit.
            </AlertDescription>
          </Alert>
        ) : null}
        <p role="status" aria-live="polite" className="rounded-md bg-muted p-4 text-sm">
          {status}
        </p>
        {logo ? (
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <img
              className="size-14 rounded object-contain"
              src={logo.dataUrl}
              alt="Checked logo preview"
            />
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              Logo · {logo.width} × {logo.height} px
            </p>
            <Button type="button" variant="outline" onClick={() => chooseLogo([])}>
              Remove logo
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {status.startsWith("Generating") || status.startsWith("Starting") ? (
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button
              ref={generateButtonRef}
              type="button"
              onClick={generateNow}
              disabled={!engine || !payload}
            >
              Generate QR
            </Button>
          )}
          <Button type="button" variant="outline" onClick={reset}>
            Reset
          </Button>
          {!engine ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatus("Loading the local QR encoder and scanner…");
                setError("");
                void loadEngine()
                  .then(setEngine)
                  .catch(() =>
                    setError("The QR tools could not be loaded. Reload the page and try again."),
                  );
              }}
            >
              Retry loading QR tools
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <OptionsPanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="qr-mode">Content type</FieldLabel>
              <select
                id="qr-mode"
                className="input min-h-11"
                value={mode}
                onChange={(event) => updateMode(event.currentTarget.value as QrDesignerMode)}
              >
                <option value="url">URL</option>
                <option value="text">Plain text</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="qr-payload">{mode === "url" ? "URL" : "Text"}</FieldLabel>
              <textarea
                id="qr-payload"
                className="input min-h-28 resize-y"
                maxLength={qrDesignerLimits.payloadBytes}
                value={payload}
                onChange={(event) => updatePayload(event.currentTarget.value)}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="qr-payload-help"
              />
              <p id="qr-payload-help" className="text-xs text-muted-foreground">
                URLs must start with http:// or https://. No request is made to the URL.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="qr-preset">Design preset</FieldLabel>
              <select
                id="qr-preset"
                className="input min-h-11"
                value={preset}
                onChange={(event) => {
                  if (event.currentTarget.value !== "custom") {
                    invalidate();
                    const selected = event.currentTarget.value as QrDesignerPreset;
                    setPreset(selected);
                    setSettings({ ...qrDesignerPresets[selected] });
                  }
                }}
              >
                <option value="custom">Current design</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="qr-output-size">Output size · {settings.size} px</FieldLabel>
              <input
                id="qr-output-size"
                className="w-full accent-primary"
                type="range"
                min={qrDesignerLimits.sizeMin}
                max={qrDesignerLimits.sizeMax}
                step={64}
                value={settings.size}
                onChange={(event) => updateSettings({ size: Number(event.currentTarget.value) })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="qr-quiet-zone">
                Quiet zone · {settings.quietZone} modules
              </FieldLabel>
              <input
                id="qr-quiet-zone"
                className="w-full accent-primary"
                type="range"
                min={qrDesignerLimits.quietZoneMin}
                max={qrDesignerLimits.quietZoneMax}
                step={1}
                value={settings.quietZone}
                onChange={(event) =>
                  updateSettings({ quietZone: Number(event.currentTarget.value) })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="qr-error-correction">Error correction</FieldLabel>
              <select
                id="qr-error-correction"
                className="input min-h-11"
                value={settings.errorCorrection}
                onChange={(event) =>
                  updateSettings({
                    errorCorrection: event.currentTarget
                      .value as QrDesignerSettings["errorCorrection"],
                  })
                }
              >
                <option value="L">L · Low</option>
                <option value="M">M · Medium</option>
                <option value="Q">Q · Quartile</option>
                <option value="H">H · High</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="qr-dot-style">Module style</FieldLabel>
              <select
                id="qr-dot-style"
                className="input min-h-11"
                value={settings.dotStyle}
                onChange={(event) =>
                  updateSettings({
                    dotStyle: event.currentTarget.value as QrDesignerSettings["dotStyle"],
                  })
                }
              >
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="dots">Dots</option>
                <option value="diamond">Diamond</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="qr-eye-style">Finder marker style</FieldLabel>
              <select
                id="qr-eye-style"
                className="input min-h-11"
                value={settings.eyeStyle}
                onChange={(event) =>
                  updateSettings({
                    eyeStyle: event.currentTarget.value as QrDesignerSettings["eyeStyle"],
                  })
                }
              >
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="circle">Circle</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="qr-foreground">Foreground</FieldLabel>
                <input
                  id="qr-foreground"
                  className="input h-11 p-1"
                  type="color"
                  value={settings.foreground}
                  onChange={(event) => updateSettings({ foreground: event.currentTarget.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="qr-background">Background</FieldLabel>
                <input
                  id="qr-background"
                  className="input h-11 p-1"
                  type="color"
                  value={settings.background}
                  onChange={(event) => updateSettings({ background: event.currentTarget.value })}
                />
              </Field>
            </div>
            <Field>
              <label
                className="flex min-h-11 items-center gap-3 text-sm font-medium"
                htmlFor="qr-gradient"
              >
                <input
                  id="qr-gradient"
                  className="size-4 accent-primary"
                  type="checkbox"
                  checked={settings.gradient}
                  onChange={(event) => updateSettings({ gradient: event.currentTarget.checked })}
                />
                Use a two-color gradient
              </label>
              {settings.gradient ? (
                <>
                  <FieldLabel htmlFor="qr-gradient-end">Gradient end color</FieldLabel>
                  <input
                    id="qr-gradient-end"
                    className="input h-11 p-1"
                    type="color"
                    value={settings.gradientEnd}
                    onChange={(event) => updateSettings({ gradientEnd: event.currentTarget.value })}
                  />
                </>
              ) : null}
            </Field>
            {logo ? (
              <>
                <Field>
                  <FieldLabel htmlFor="qr-logo-size">
                    Logo size · {settings.logoPercent}% of QR width
                  </FieldLabel>
                  <input
                    id="qr-logo-size"
                    className="w-full accent-primary"
                    type="range"
                    min={qrDesignerLimits.logoPercentMin}
                    max={qrDesignerLimits.logoPercentMax}
                    step={1}
                    value={settings.logoPercent}
                    onChange={(event) =>
                      updateSettings({ logoPercent: Number(event.currentTarget.value) })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="qr-logo-position">Logo position</FieldLabel>
                  <select
                    id="qr-logo-position"
                    className="input min-h-11"
                    value={settings.logoPosition}
                    onChange={(event) =>
                      updateSettings({
                        logoPosition: event.currentTarget
                          .value as QrDesignerSettings["logoPosition"],
                      })
                    }
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="right">Right</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="top-left">Top left</option>
                    <option value="top-right">Top right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-right">Bottom right</option>
                  </select>
                </Field>
              </>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Both foreground colors need 4.5:1 contrast. A design must scan back to the exact input
              before downloads appear. Real camera performance can vary.
            </p>
          </FieldGroup>
        </OptionsPanel>
        <PreviewPane>
          {output ? (
            <div className="rounded-lg bg-muted p-4">
              <img
                src={output.pngUrl}
                alt="QR code preview, independently scanned and verified against the entered content"
                className="mx-auto h-auto w-full max-w-96 bg-white"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A verified QR preview appears after the browser checks that it decodes to the exact
              content.
            </p>
          )}
        </PreviewPane>
        <ResultRegion>
          {output ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                PNG · {formatBytes(output.png.size)} · SVG · {formatBytes(output.svg.size)}
              </p>
              <a className={buttonVariants()} href={output.pngUrl} download="toolbox-qr-code.png">
                Download PNG
              </a>
              <a
                className={buttonVariants("outline")}
                href={output.svgUrl}
                download="toolbox-qr-code.svg"
              >
                Download vector SVG
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Downloads appear only when PNG and SVG output pass scan verification.
            </p>
          )}
        </ResultRegion>
      </div>
    </ToolWorkspace>
  );
}
