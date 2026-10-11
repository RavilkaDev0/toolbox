/// <reference lib="webworker" />
import {
  inspectRotatePdf,
  type PdfRotateRequest,
  type PdfRotateResponse,
  rotatePdfPages,
} from "@toolbox/browser-engines";
import { PdfProcessingError } from "@toolbox/core";

const scope = self as unknown as DedicatedWorkerGlobalScope;
console.warn = () => {
  throw new PdfProcessingError("INVALID_PDF");
};
scope.onmessage = async (event: MessageEvent<PdfRotateRequest>) => {
  let response: PdfRotateResponse;
  try {
    const request = event.data;
    if (request.action === "inspect") {
      response = { type: "inspected", info: await inspectRotatePdf(request.file) };
    } else {
      response = {
        type: "result",
        result: await rotatePdfPages(request.file, request.pages, request.delta),
      };
    }
  } catch (error) {
    response = {
      type: "error",
      code: error instanceof PdfProcessingError ? error.code : "ROTATE_FAILED",
    };
  }
  scope.postMessage(response);
};
