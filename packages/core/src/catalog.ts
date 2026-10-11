import { imagePdfLimits } from "./images-to-pdf.js";
import { pdfMergeLimits } from "./merge-pdf.js";
import { pdfSplitLimits } from "./split-pdf.js";

export const categories = [
  {
    id: "pdf",
    title: "PDF",
    description: "Tools for combining, splitting and adjusting PDF documents.",
  },
  {
    id: "pdf-render",
    title: "PDF images",
    description: "Tools for turning PDF pages into images.",
  },
  {
    id: "image",
    title: "Images",
    description: "Tools for converting and resizing images.",
  },
  {
    id: "qr",
    title: "QR codes",
    description: "Tools for creating QR codes from text and contact details.",
  },
  {
    id: "utility",
    title: "Text and utilities",
    description: "Small browser-based helpers for text and everyday tasks.",
  },
] as const;

export type ToolCategory = (typeof categories)[number];
export type ToolCategoryId = ToolCategory["id"];

export type EngineKind = "pdf" | "pdf-render" | "image" | "qr" | "utility";
export type ToolExecution = "browser" | "server";
export type ToolStatus = "draft" | "published";

export type ToolDefinition = {
  readonly id: string;
  readonly slug: string;
  readonly category: ToolCategoryId;
  readonly title: string;
  readonly description: string;
  readonly engine: EngineKind;
  readonly execution: ToolExecution;
  readonly acceptedMimeTypes: readonly string[];
  readonly maxInputBytes?: number;
  readonly maxInputFiles?: number;
  readonly status: ToolStatus;
  readonly relatedSlugs: readonly string[];
};

export const toolCatalog: readonly ToolDefinition[] = [
  {
    id: "images-to-pdf",
    slug: "images-to-pdf",
    category: "pdf",
    title: "Images to PDF",
    description:
      "Convert JPEG, PNG and WebP images to PDF locally. Arrange pages, choose A4, Letter or Auto, then preview and download.",
    engine: "pdf",
    execution: "browser",
    acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxInputBytes: imagePdfLimits.fileBytes,
    maxInputFiles: imagePdfLimits.files,
    status: "published",
    relatedSlugs: ["merge-pdf", "split-pdf"],
  },
  {
    id: "merge-pdf",
    slug: "merge-pdf",
    category: "pdf",
    title: "Merge PDF",
    description:
      "Merge static PDF documents locally. Arrange files, preserve original pages, preview and download the combined PDF.",
    engine: "pdf",
    execution: "browser",
    acceptedMimeTypes: ["application/pdf"],
    maxInputBytes: pdfMergeLimits.fileBytes,
    maxInputFiles: pdfMergeLimits.files,
    status: "published",
    relatedSlugs: ["split-pdf", "images-to-pdf"],
  },
  {
    id: "split-pdf",
    slug: "split-pdf",
    category: "pdf",
    title: "Split PDF",
    description:
      "Extract selected pages into one PDF or split pages into individual PDFs in a ZIP. Preserves page content and geometry locally, within clear file and page limits.",
    engine: "pdf",
    execution: "browser",
    acceptedMimeTypes: ["application/pdf"],
    maxInputBytes: pdfSplitLimits.fileBytes,
    maxInputFiles: 1,
    status: "published",
    relatedSlugs: ["merge-pdf", "images-to-pdf"],
  },
  {
    id: "rotate-pdf",
    slug: "rotate-pdf",
    category: "pdf",
    title: "Rotate PDF",
    description: "Rotate selected PDF pages in 90-degree increments.",
    engine: "pdf",
    execution: "browser",
    acceptedMimeTypes: ["application/pdf"],
    status: "draft",
    relatedSlugs: ["split-pdf", "merge-pdf"],
  },
  {
    id: "pdf-to-png",
    slug: "pdf-to-png",
    category: "pdf-render",
    title: "PDF to PNG",
    description: "Render PDF pages as PNG images.",
    engine: "pdf-render",
    execution: "browser",
    acceptedMimeTypes: ["application/pdf"],
    status: "draft",
    relatedSlugs: ["images-to-pdf", "image-compressor"],
  },
  {
    id: "image-compressor",
    slug: "image-compressor",
    category: "image",
    title: "Image compressor",
    description: "Reduce the file size of a supported image.",
    engine: "image",
    execution: "browser",
    acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    status: "draft",
    relatedSlugs: ["image-resizer", "webp-converter"],
  },
  {
    id: "image-resizer",
    slug: "image-resizer",
    category: "image",
    title: "Image resizer",
    description: "Resize an image while keeping its proportions.",
    engine: "image",
    execution: "browser",
    acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    status: "draft",
    relatedSlugs: ["image-compressor", "images-to-pdf"],
  },
  {
    id: "png-jpg-converter",
    slug: "png-jpg-converter",
    category: "image",
    title: "PNG and JPG converter",
    description: "Convert PNG images to JPG or JPG images to PNG.",
    engine: "image",
    execution: "browser",
    acceptedMimeTypes: ["image/jpeg", "image/png"],
    status: "draft",
    relatedSlugs: ["webp-converter", "image-compressor"],
  },
  {
    id: "webp-converter",
    slug: "webp-converter",
    category: "image",
    title: "WebP converter",
    description: "Convert supported images to WebP.",
    engine: "image",
    execution: "browser",
    acceptedMimeTypes: ["image/jpeg", "image/png"],
    status: "draft",
    relatedSlugs: ["png-jpg-converter", "image-compressor"],
  },
  {
    id: "qr-designer",
    slug: "qr-designer",
    category: "qr",
    title: "QR designer",
    description: "Create a QR code from text or a URL.",
    engine: "qr",
    execution: "browser",
    acceptedMimeTypes: [],
    status: "draft",
    relatedSlugs: ["wifi-qr", "contact-qr"],
  },
  {
    id: "wifi-qr",
    slug: "wifi-qr",
    category: "qr",
    title: "Wi-Fi QR code",
    description: "Prepare a QR code with Wi-Fi network details.",
    engine: "qr",
    execution: "browser",
    acceptedMimeTypes: [],
    status: "draft",
    relatedSlugs: ["qr-designer", "contact-qr"],
  },
  {
    id: "contact-qr",
    slug: "contact-qr",
    category: "qr",
    title: "Contact QR code",
    description: "Prepare a QR code with contact details.",
    engine: "qr",
    execution: "browser",
    acceptedMimeTypes: [],
    status: "draft",
    relatedSlugs: ["qr-designer", "wifi-qr"],
  },
  {
    id: "password-generator",
    slug: "password-generator",
    category: "utility",
    title: "Password generator",
    description: "Choose options for a randomly generated password.",
    engine: "utility",
    execution: "browser",
    acceptedMimeTypes: [],
    status: "draft",
    relatedSlugs: ["word-counter", "case-converter"],
  },
  {
    id: "word-counter",
    slug: "word-counter",
    category: "utility",
    title: "Word counter",
    description: "Count words and characters in text.",
    engine: "utility",
    execution: "browser",
    acceptedMimeTypes: [],
    status: "draft",
    relatedSlugs: ["case-converter", "password-generator"],
  },
  {
    id: "case-converter",
    slug: "case-converter",
    category: "utility",
    title: "Case converter",
    description: "Change text between common letter cases.",
    engine: "utility",
    execution: "browser",
    acceptedMimeTypes: [],
    status: "draft",
    relatedSlugs: ["word-counter", "password-generator"],
  },
];

export function validateToolCatalog(
  definitions: readonly ToolDefinition[],
  knownCategories: readonly string[] = categories.map((category) => category.id),
): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const categoryIds = new Set(knownCategories);

  for (const definition of definitions) {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate tool id: ${definition.id}`);
    }
    ids.add(definition.id);

    if (slugs.has(definition.slug)) {
      throw new Error(`Duplicate tool slug: ${definition.slug}`);
    }
    slugs.add(definition.slug);

    if (!categoryIds.has(definition.category)) {
      throw new Error(`Unknown category for tool ${definition.slug}: ${definition.category}`);
    }
  }

  for (const definition of definitions) {
    for (const relatedSlug of definition.relatedSlugs) {
      if (!slugs.has(relatedSlug)) {
        throw new Error(`Unknown related tool for ${definition.slug}: ${relatedSlug}`);
      }
    }
  }
}

validateToolCatalog(toolCatalog);

export function getPublishedTools(): readonly ToolDefinition[] {
  return toolCatalog.filter((tool) => tool.status === "published");
}

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return getPublishedTools().find((tool) => tool.slug === slug);
}

export function getToolsForCategory(categoryId: ToolCategoryId): readonly ToolDefinition[] {
  return getPublishedTools().filter((tool) => tool.category === categoryId);
}
