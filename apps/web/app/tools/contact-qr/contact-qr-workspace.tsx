"use client";

import type { QrDesignerResult } from "@toolbox/browser-engines/qr-designer";
import {
  buildContactVCard,
  ContactQrError,
  type ContactQrOptions,
  contactQrLimits,
  normalizeContactQrOptions,
  parseContactVCard,
  qrDesignerPresets,
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
type Output = {
  readonly pngUrl: string;
  readonly svgUrl: string;
  readonly vcfUrl: string;
  readonly pngBytes: number;
  readonly svgBytes: number;
  readonly vcfBytes: number;
  readonly version: number;
  readonly modules: number;
};

const initialContact: ContactQrOptions = {
  fullName: "",
  organization: "",
  jobTitle: "",
  phone: "",
  email: "",
  website: "",
  address: "",
};

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${bytes} bytes`;
}

function sameContact(left: ContactQrOptions, right: ContactQrOptions): boolean {
  return (
    left.fullName === right.fullName &&
    left.organization === right.organization &&
    left.jobTitle === right.jobTitle &&
    left.phone === right.phone &&
    left.email === right.email &&
    left.website === right.website &&
    left.address === right.address
  );
}

export default function ContactQrWorkspace() {
  const [contact, setContact] = useState<ContactQrOptions>(initialContact);
  const [hasEdited, setHasEdited] = useState(false);
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [output, setOutput] = useState<Output | null>(null);
  const [status, setStatus] = useState("Enter a full name to create a contact QR code.");
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
      revokeUrl(previous.vcfUrl);
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

  useEffect(() => {
    if (!hasEdited || paused) return;
    const current = normalizeContactQrOptions(contact);
    let vcard: string;
    try {
      vcard = buildContactVCard(current);
      const parsed = parseContactVCard(vcard);
      if (!sameContact(parsed, current)) throw new ContactQrError("INVALID_VCARD");
    } catch (caught) {
      setBusy(false);
      setError(
        caught instanceof ContactQrError
          ? caught.message
          : "One or more contact fields could not be validated.",
      );
      setStatus("Contact details need attention before a QR can be generated.");
      return;
    }

    const runId = ++generation.current;
    const controller = new AbortController();
    activeRun.current = controller;
    setBusy(true);
    setError("");
    setStatus("Updating and scan-checking the contact QR locally…");
    const timer = window.setTimeout(() => {
      void (async () => {
        let createdUrls: string[] = [];
        try {
          const engine = await loadEngine();
          if (runId !== generation.current || controller.signal.aborted) return;
          const result: QrDesignerResult = await engine.createQrDesignerResult(
            "text",
            vcard,
            { ...qrDesignerPresets.classic, errorCorrection: "L" },
            undefined,
            controller.signal,
          );
          if (runId !== generation.current || controller.signal.aborted) return;
          const vcfBlob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
          const createUrl = (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            urls.current.add(url);
            createdUrls.push(url);
            return url;
          };
          let nextOutput: Output;
          try {
            nextOutput = {
              pngUrl: createUrl(result.png),
              svgUrl: createUrl(result.svg),
              vcfUrl: createUrl(vcfBlob),
              pngBytes: result.png.size,
              svgBytes: result.svg.size,
              vcfBytes: vcfBlob.size,
              version: result.version,
              modules: result.modules,
            };
          } catch (caught) {
            for (const url of createdUrls) revokeUrl(url);
            createdUrls = [];
            throw caught;
          }
          if (runId !== generation.current || controller.signal.aborted) {
            for (const url of createdUrls) revokeUrl(url);
            createdUrls = [];
            return;
          }
          outputRef.current = nextOutput;
          setOutput(nextOutput);
          setStatus(
            `Contact QR verified · version ${result.version} · ${result.modules} × ${result.modules} modules.`,
          );
        } catch (caught) {
          if (runId !== generation.current || controller.signal.aborted) return;
          setError(
            caught instanceof Error && caught.name === "AbortError"
              ? "QR update cancelled. Change a field or choose Generate now to retry."
              : "The contact QR could not be rendered and verified. Try shorter contact details or retry.",
          );
          setStatus("Contact QR is waiting for a successful local scan check.");
        } finally {
          if (runId === generation.current) {
            activeRun.current = null;
            setBusy(false);
          }
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [contact, hasEdited, loadEngine, paused, revision, revokeUrl]);

  function updateContact(update: Partial<ContactQrOptions>) {
    invalidate();
    setContact((current) => ({ ...current, ...update }));
    setHasEdited(true);
    setPaused(false);
    setStatus("Updating the preview after the contact details change…");
  }

  function cancel() {
    generation.current++;
    activeRun.current?.abort();
    activeRun.current = null;
    setBusy(false);
    setPaused(true);
    clearOutput();
    setError("");
    setStatus("Preview update cancelled. Your contact details remain in the form.");
  }

  function reset() {
    invalidate();
    setContact({ ...initialContact });
    setHasEdited(false);
    setPaused(false);
    setRevision(0);
    setStatus("Reset complete. Contact details and downloads were cleared.");
  }

  function generateNow() {
    setPaused(false);
    setRevision((current) => current + 1);
  }

  return (
    <ToolWorkspace>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <Alert>
          <AlertTitle>Review before sharing personal details</AlertTitle>
          <AlertDescription>
            The contact information is processed only in this tab. Anyone who scans the QR or opens
            the vCard can read and save the details you include.
          </AlertDescription>
        </Alert>
        <OptionsPanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="contact-full-name">Full name</FieldLabel>
              <input
                id="contact-full-name"
                className="input min-h-11"
                type="text"
                value={contact.fullName}
                maxLength={contactQrLimits.fullNameBytes}
                autoComplete="name"
                onChange={(event) => updateContact({ fullName: event.currentTarget.value })}
                aria-describedby="contact-name-help"
              />
              <p id="contact-name-help" className="text-xs text-muted-foreground">
                Required · up to {contactQrLimits.fullNameBytes} UTF-8 bytes.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-organization">Organization</FieldLabel>
              <textarea
                id="contact-organization"
                className="input min-h-20 resize-y"
                value={contact.organization}
                maxLength={contactQrLimits.organizationBytes}
                autoComplete="organization"
                onChange={(event) => updateContact({ organization: event.currentTarget.value })}
              />
              <p className="text-xs text-muted-foreground">
                Up to {contactQrLimits.organizationBytes} UTF-8 bytes.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-title">Job title</FieldLabel>
              <textarea
                id="contact-title"
                className="input min-h-20 resize-y"
                value={contact.jobTitle}
                maxLength={contactQrLimits.jobTitleBytes}
                autoComplete="organization-title"
                onChange={(event) => updateContact({ jobTitle: event.currentTarget.value })}
              />
              <p className="text-xs text-muted-foreground">
                Up to {contactQrLimits.jobTitleBytes} UTF-8 bytes.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
              <input
                id="contact-phone"
                className="input min-h-11"
                type="tel"
                value={contact.phone}
                maxLength={contactQrLimits.phoneBytes}
                autoComplete="tel"
                onChange={(event) => updateContact({ phone: event.currentTarget.value })}
                aria-describedby="contact-phone-help"
              />
              <p id="contact-phone-help" className="text-xs text-muted-foreground">
                3–15 digits · up to {contactQrLimits.phoneBytes} bytes · include country code.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-email">Email</FieldLabel>
              <input
                id="contact-email"
                className="input min-h-11"
                type="email"
                value={contact.email}
                maxLength={contactQrLimits.emailBytes}
                autoComplete="email"
                onChange={(event) => updateContact({ email: event.currentTarget.value })}
              />
              <p className="text-xs text-muted-foreground">
                Common email format · up to {contactQrLimits.emailBytes} UTF-8 bytes.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-website">Website</FieldLabel>
              <input
                id="contact-website"
                className="input min-h-11"
                type="url"
                value={contact.website}
                maxLength={contactQrLimits.websiteBytes}
                autoComplete="url"
                placeholder="https://example.com"
                onChange={(event) => updateContact({ website: event.currentTarget.value })}
                aria-describedby="contact-website-help"
              />
              <p id="contact-website-help" className="text-xs text-muted-foreground">
                HTTP or HTTPS only · up to {contactQrLimits.websiteBytes} UTF-8 bytes · no embedded
                credentials.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-address">Address · optional</FieldLabel>
              <textarea
                id="contact-address"
                className="input min-h-24 resize-y"
                value={contact.address}
                maxLength={contactQrLimits.addressBytes}
                autoComplete="street-address"
                onChange={(event) => updateContact({ address: event.currentTarget.value })}
                aria-describedby="contact-address-help"
              />
              <p id="contact-address-help" className="text-xs text-muted-foreground">
                Up to {contactQrLimits.addressBytes} UTF-8 bytes. Line breaks are retained.
              </p>
            </Field>
          </FieldGroup>
        </OptionsPanel>
        {error ? (
          <Alert className="border border-destructive/40">
            <AlertTitle>Contact details need attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p role="status" aria-live="polite" className="rounded-md bg-muted p-4 text-sm">
          {status}
        </p>
        <div className="flex flex-wrap gap-2">
          {busy ? (
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel preview update
            </Button>
          ) : hasEdited ? (
            <Button type="button" onClick={generateNow}>
              Generate now
            </Button>
          ) : null}
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
                alt="Contact QR code, independently decoded and verified against the contact card"
                className="mx-auto h-auto w-full max-w-96 bg-white"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A scan-checked QR preview appears as you complete a valid contact card.
            </p>
          )}
        </PreviewPane>
        <ResultRegion>
          {output ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                PNG · {formatBytes(output.pngBytes)} · SVG · {formatBytes(output.svgBytes)} · vCard
                · {formatBytes(output.vcfBytes)}
              </p>
              <a
                className={buttonVariants()}
                href={output.pngUrl}
                download="toolbox-contact-qr.png"
              >
                Download PNG
              </a>
              <a
                className={buttonVariants("outline")}
                href={output.svgUrl}
                download="toolbox-contact-qr.svg"
              >
                Download vector SVG
              </a>
              <a
                className={buttonVariants("outline")}
                href={output.vcfUrl}
                download="toolbox-contact.vcf"
              >
                Download vCard (.vcf)
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Verified QR and vCard downloads appear when the contact card passes validation.
            </p>
          )}
        </ResultRegion>
      </div>
    </ToolWorkspace>
  );
}
