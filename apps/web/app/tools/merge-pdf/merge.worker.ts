/// <reference lib="webworker" />
import {
  inspectPdfs,
  mergePdfs,
  type PdfMergeRequest,
  type PdfMergeResponse,
} from "@toolbox/browser-engines";
import { PdfMergeError } from "@toolbox/core";

const scope = self as unknown as DedicatedWorkerGlobalScope;
// This dedicated worker rejects parser warnings instead of logging raw PDF numeric data.
console.warn = () => {
  throw new PdfMergeError("INVALID_PDF");
};
scope.onmessage = async (event: MessageEvent<PdfMergeRequest>) => {
  let response: PdfMergeResponse;
  try {
    response =
      event.data.action === "inspect"
        ? { type: "inspected", documents: await inspectPdfs(event.data.files) }
        : { type: "result", result: await mergePdfs(event.data.files) };
  } catch (error) {
    response = {
      type: "error",
      code: error instanceof PdfMergeError ? error.code : "MERGE_FAILED",
    };
  }
  scope.postMessage(response);
};
