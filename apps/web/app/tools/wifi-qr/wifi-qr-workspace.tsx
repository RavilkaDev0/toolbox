"use client";

import type { QrDesignerResult } from "@toolbox/browser-engines/qr-designer";
import {
  buildWifiQrPayload,
  parseWifiQrPayload,
  qrDesignerPresets,
  WifiQrError,
  type WifiQrOptions,
} from "@toolbox/core";
import { Alert, AlertDescription, AlertTitle } from "@toolbox/ui/components/alert";
import { Button, buttonVariants } from "@toolbox/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@toolbox/ui/components/field";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  OptionsPanel,
  PreviewPane,
  ResultRegion,
  ToolWorkspace,
} from "../../_components/workspace/tool-workspace";

type Engine = typeof import("@toolbox/browser-engines/qr-designer");
type Output = QrDesignerResult & { readonly pngUrl: string; readonly svgUrl: string };

const initialOptions: WifiQrOptions = {
  ssid: "",
  security: "wpa",
  password: "",
  hidden: false,
};

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${bytes} bytes`;
}

export default function WifiQrWorkspace() {
  const [options, setOptions] = useState<WifiQrOptions>(initialOptions);
  const [showPassword, setShowPassword] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [status, setStatus] = useState("Enter the Wi-Fi network details, then generate a QR code.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const outputRef = useRef<Output | null>(null);
  const activeRun = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const urls = useRef(new Set<string>());
  const enginePromise = useRef<Promise<Engine> | null>(null);

  const loadEngine = useCallback(() => {
    enginePromise.current ??= import("@toolbox/browser-engines/qr-designer").catch(
      (caught: unknown) => {
        enginePromise.current = null;
        throw caught;
      },
    );
    return enginePromise.current;
  }, []);

  const revokeUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }, []);

  const clearOutput = useCallback(() => {
    const previous = outputRef.current;
    outputRef.current = null;
    if (previous) {
      revokeUrl(previous.pngUrl);
      revokeUrl(previous.svgUrl);
    }
    setOutput(null);
  }, [revokeUrl]);

  const invalidate = useCallback(() => {
    generation.current++;
    activeRun.current?.abort();
    activeRun.current = null;
    setBusy(false);
    clearOutput();
    setError("");
  }, [clearOutput]);

  useEffect(
    () => () => {
      generation.current++;
      activeRun.current?.abort();
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    [],
  );

  function updateOptions(update: Partial<WifiQrOptions>) {
    invalidate();
    setOptions((current) => {
      const next = { ...current, ...update };
      if (next.security === "open") next.password = "";
      return next;
    });
    setStatus("Settings changed. Generate a new QR code to verify the result.");
  }

  async function generate() {
    invalidate();
    const runId = ++generation.current;
    const controller = new AbortController();
    activeRun.current = controller;
    const current = { ...options };
    setBusy(true);
    setStatus("Generating and independently checking the Wi-Fi QR in this browser…");
    try {
      const payload = buildWifiQrPayload(current);
      const parsed = parseWifiQrPayload(payload);
      if (
        parsed.ssid !== current.ssid ||
        parsed.security !== current.security ||
        parsed.password !== current.password ||
        parsed.hidden !== current.hidden
      )
        throw new WifiQrError("INVALID_PAYLOAD");

      const loaded = engine ?? (await loadEngine());
      if (runId !== generation.current || controller.signal.aborted) return;
      if (!engine) setEngine(loaded);
      const result = await loaded.createQrDesignerResult(
        "text",
        payload,
        { ...qrDesignerPresets.classic, errorCorrection: "L" },
        undefined,
        controller.signal,
      );
      if (runId !== generation.current || controller.signal.aborted) return;
      const pngUrl = URL.createObjectURL(result.png);
      urls.current.add(pngUrl);
      let svgUrl: string;
      try {
        svgUrl = URL.createObjectURL(result.svg);
      } catch (caught) {
        revokeUrl(pngUrl);
        throw caught;
      }
      urls.current.add(svgUrl);
      const nextOutput = { ...result, pngUrl, svgUrl };
      outputRef.current = nextOutput;
      setOutput(nextOutput);
      setStatus("Wi-Fi QR generated. The PNG and SVG both decoded to the exact network settings.");
      setError("");
    } catch (caught) {
      if (runId !== generation.current || controller.signal.aborted) return;
      outputRef.current = null;
      setOutput(null);
      setError(
        caught instanceof WifiQrError
          ? caught.message
          : caught instanceof Error && caught.name === "AbortError"
            ? "Generation cancelled. You can try again."
            : "The QR could not be generated or verified. Try shorter network details or retry.",
      );
      setStatus("Wi-Fi QR generation did not complete.");
    } finally {
      if (runId === generation.current) {
        activeRun.current = null;
        setBusy(false);
      }
    }
  }

  function cancel() {
    generation.current++;
    activeRun.current?.abort();
    activeRun.current = null;
    setBusy(false);
    clearOutput();
    setError("");
    setStatus("Generation cancelled. Your network details are still in the form.");
  }

  function reset() {
    invalidate();
    setOptions({ ...initialOptions });
    setShowPassword(false);
    setStatus("Reset complete. Network details and the generated QR were cleared.");
  }

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <Alert>
          <AlertTitle>Sharing this QR shares the Wi-Fi credentials</AlertTitle>
          <AlertDescription>
            Anyone who can scan or copy this code can read the network name and password. The
            details are processed only in this tab and are not saved or uploaded.
          </AlertDescription>
        </Alert>
        <OptionsPanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wifi-ssid">Network name · SSID</FieldLabel>
              <input
                id="wifi-ssid"
                className="input min-h-11"
                type="text"
                value={options.ssid}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => updateOptions({ ssid: event.currentTarget.value })}
                aria-describedby="wifi-ssid-help"
              />
              <p id="wifi-ssid-help" className="text-xs text-muted-foreground">
                Up to 32 UTF-8 bytes. Unicode names are supported.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="wifi-security">Security</FieldLabel>
              <select
                id="wifi-security"
                className="input min-h-11"
                value={options.security}
                onChange={(event) =>
                  updateOptions({
                    security: event.currentTarget.value as WifiQrOptions["security"],
                  })
                }
              >
                <option value="wpa">WPA / WPA2 / transition · QR type WPA</option>
                <option value="wpa3">WPA3-Personal · QR type SAE</option>
                <option value="wep">WEP</option>
                <option value="open">Open network</option>
              </select>
              {options.security === "wpa3" ? (
                <p className="text-xs text-muted-foreground">
                  SAE is supported by some current Android readers. Older phones and other scanners
                  may not recognize it.
                </p>
              ) : options.security === "wpa" ? (
                <p className="text-xs text-muted-foreground">
                  WPA covers WPA/WPA2 and WPA2/WPA3 transition networks. Devices negotiate the
                  connection security they support.
                </p>
              ) : null}
            </Field>
            {options.security !== "open" ? (
              <Field>
                <FieldLabel htmlFor="wifi-password">Network password</FieldLabel>
                <div className="flex gap-2">
                  <input
                    id="wifi-password"
                    className="input min-h-11 min-w-0 flex-1"
                    type={showPassword ? "text" : "password"}
                    value={options.password}
                    maxLength={64}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => updateOptions({ password: event.currentTarget.value })}
                    aria-describedby="wifi-password-help"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? "Hide" : "Show"} password
                  </Button>
                </div>
                <p id="wifi-password-help" className="text-xs text-muted-foreground">
                  {options.security === "wep"
                    ? "WEP: 5 or 13 printable characters, or 10 or 26 hexadecimal digits."
                    : options.security === "wpa3"
                      ? "WPA3-Personal password: 8–63 UTF-8 bytes."
                      : "WPA: 8–63 UTF-8 bytes or a 64-digit hexadecimal pre-shared key."}
                </p>
              </Field>
            ) : null}
            <label
              className="flex min-h-11 items-center gap-3 text-sm font-medium"
              htmlFor="wifi-hidden"
            >
              <input
                id="wifi-hidden"
                className="size-4 accent-primary"
                type="checkbox"
                checked={options.hidden}
                onChange={(event) => updateOptions({ hidden: event.currentTarget.checked })}
              />
              Hidden network
            </label>
            <p className="text-xs text-muted-foreground">
              Some scanners may not support hidden networks, WPA3 SAE or legacy WEP. Check that the
              connecting device supports the network's security type.
            </p>
          </FieldGroup>
        </OptionsPanel>
        {error ? (
          <Alert className="border border-destructive/40">
            <AlertTitle>Could not generate this Wi-Fi QR</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p role="status" aria-live="polite" className="rounded-md bg-muted p-4 text-sm">
          {status}
        </p>
        <div className="flex flex-wrap gap-2">
          {busy ? (
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button type="button" onClick={() => void generate()}>
              Generate Wi-Fi QR
            </Button>
          )}
          <Button type="button" variant="outline" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <PreviewPane>
          {output ? (
            <div className="rounded-lg bg-muted p-4">
              <img
                src={output.pngUrl}
                alt="Independently verified Wi-Fi QR code"
                className="mx-auto h-auto w-full max-w-96 bg-white"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview appears only after both exported formats pass a local scan check.
            </p>
          )}
        </PreviewPane>
        <ResultRegion>
          {output ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                PNG · {formatBytes(output.png.size)} · SVG · {formatBytes(output.svg.size)}
              </p>
              <a className={buttonVariants()} href={output.pngUrl} download="toolbox-wifi-qr.png">
                Download PNG
              </a>
              <a
                className={buttonVariants("outline")}
                href={output.svgUrl}
                download="toolbox-wifi-qr.svg"
              >
                Download vector SVG
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Downloads appear after scan verification.
            </p>
          )}
        </ResultRegion>
      </div>
    </ToolWorkspace>
  );
}
