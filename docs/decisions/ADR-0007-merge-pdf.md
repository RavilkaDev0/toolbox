# ADR-0007 — Static browser Merge PDF

Status: TBX-005 implementation. Uses installed MIT pdf-lib 1.17.1 and Apache-2.0 pdfjs-dist 6.3.289; no dependency or backend additions.

## Ownership and fidelity

Core owns byte/file/page/time/object/pixel ceilings and generic immutable ordering. Image ordering keeps its compatible export but shares the pure operation. Contracts validates metadata. Browser engines load/inspect/copy/save/reparse PDFs. Web owns one conversion worker, generation guards, timeout, selection and download resources. The existing PDF.js viewer is moved into shared workspace presentation; it renders inspected static inputs or generated results with annotations/XFA disabled, no action/attachment/link layer. Imports remain lazy. No universal PDF engine/controller framework is introduced.

copyPages copies original page content/resources; it does not rasterize or recompress. After saving, reparse and compare every page's Media/Crop/Bleed/Trim/Art boxes, rotation, UserUnit, ordered raw content-stream length/FNV fingerprints, and recursive resource fingerprints including fonts, original images and alpha masks. Per-document memoization avoids repeated resource hashing. Fingerprints catch accidental copy/order changes, not cryptographic authenticity. Independent fixture parsing/rendering checks text, vectors and original image streams. Bookmarks, document metadata and accessibility structure are not copied/promised.

## Threat model and input policy

Attackers can supply malformed references/page trees, encrypted PDFs, scripts/actions/links, forms/signatures, attachments, external streams, deep dictionaries, compressed object bombs, oversized page/image declarations, or repeated jobs. Filenames/metadata are hostile text and never logged/uploaded. All processing stays in the tab; no server endpoint or content analytics is involved.

Validate MIME (empty or application/pdf), exact PDF header/version and final EOF, then strictly parse with throwOnInvalidObject and capped numbers. Reject encryption without ignoreEncryption/password bypass. Scan all parsed indirect objects and nested dictionaries/arrays, including unused objects, with cycle detection and node/depth budgets. Decode PDF names before checking blocked keys/name values. Reject AcroForm/XFA, nonempty annotations, OpenAction/AA/actions/JavaScript, signatures, embedded files/associated files, portfolios/rich media and external stream dictionaries. Empty annotation arrays are harmless and accepted, including Toolbox-generated PDFs. Conservative refusal may reject some harmless custom structures; it is not sanitization and gives no safety guarantee for an external reader.

Resource bounds: 1–10 files during selection, at least 2 for merge; 8 MiB each, 24 MiB total, 100 pages/document, 200 pages/selection, 48 MiB result; 20,000 indirect objects/document, 100,000 traversal visits, depth 32, 14,400 pt page sides; image resources 12 MP each/24 MP per document. Preview uses shared 64 MiB/200-page/12 MP ceilings and at most 640 × 800 canvas, one page at a time. Inspection is sequential and conversion retains copied resources, not every source document. First-page input preview is explicitly requested and only one input preview is mounted.

A 12 MP decoded image alone is about 48 MB RGBA. 24 MiB input can create multiple input/output/parser copies; compressed bytes do not bound expanded object/font streams. Object budgets are checked after library parsing, so adversarial decompression can allocate before inspection. Browser workers offer cancellation/isolation but no enforceable heap quota. The 45-second wall-clock watchdog terminates stuck jobs; user Cancel/reset/unmount terminates earlier. Mobile ceilings are conservative best effort, not proof against every malicious memory bomb or low-memory tab kill. Physical device validation and deeper parser fuzzing remain risks, not implicit backend authorization.

## Recovery and privacy

Atomic reinspection before adding files preserves a prior valid selection on failure. Cancel leaves the selection for retry; reset clears it. Conversion completion/error/timeout/reset/unmount terminate the active worker, release buffers with its realm and invalidate stale callbacks. Result Blob URLs revoke on changes/reset/unmount. Preview destroys its PDF document/worker after each page; large-file cleanup and active-worker counts are tested. Errors expose fixed categories/messages only. pdf-lib's ES5 error subclass prototype is inconsistent; encrypted errors also match its fixed library message, verified by an actual encrypted fixture.

The dedicated conversion worker rejects pdf-lib parser warnings as invalid input rather than logging numbers from hostile documents. The PDF.js viewer uses verbosity zero; parsing/render failures still become explicit UI errors. This affects only these worker realms. The large-number fixture verifies refusal without console output.

## Verification and publication

Keep merge-pdf draft until binary/browser checks and gates pass, then publish only it and rerun complete regression gates. Chromium/WebKit cover both controls and actual output, private development fixtures are removed before public wiring, and production standalone is tested separately. Evidence, dependency/heap measurement caveats, timings and accepted limits live in [TBX-005 report](../development/TBX-005-REPORT.md). The suite's single Draft PR checklist advances only after CI on the implementation commit; later tools await an owner assignment.
