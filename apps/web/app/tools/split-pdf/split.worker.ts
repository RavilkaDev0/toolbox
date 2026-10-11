/// <reference lib="webworker" />
import {
  extractPdfPages,
  inspectPdf,
  type PdfSplitRequest,
  type PdfSplitResponse,
  splitPdfPages,
} from "@toolbox/browser-engines";
import { PdfProcessingError } from "@toolbox/core";

const scope = self as unknown as DedicatedWorkerGlobalScope;
console.warn = () => {
  throw new PdfProcessingError("INVALID_PDF");
};
scope.onmessage = async (event: MessageEvent<PdfSplitRequest>) => {
  let response: PdfSplitResponse;
  try {
    const request = event.data;
    if (request.action === "inspect") {
      response = { type: "inspected", info: await inspectPdf(request.file) };
    } else if (request.action === "extract") {
      response = {
        type: "result",
        result: await extractPdfPages(request.file, request.pages),
      };
    } else {
      response = {
        type: "result",
        result: await splitPdfPages(request.file, request.pages),
      };
    }
  } catch (error) {
    response = {
      type: "error",
      code: error instanceof PdfProcessingError ? error.code : "SPLIT_FAILED",
    };
  }
  scope.postMessage(response);
};
