export const caseConverterLimits = {
  maximumInputCodeUnits: 100_000,
  maximumOutputCodeUnits: 400_000,
} as const;

export const caseConverterModes = [
  "uppercase",
  "lowercase",
  "title",
  "sentence",
  "toggle",
] as const;
export type CaseConverterMode = (typeof caseConverterModes)[number];

export const caseConverterLocales = ["default", "en-US", "tr", "de", "ru", "ja"] as const;
export type CaseConverterLocale = (typeof caseConverterLocales)[number];

export type CaseConverterErrorCode =
  | "INVALID_TEXT"
  | "TEXT_TOO_LONG"
  | "INVALID_MODE"
  | "INVALID_LOCALE"
  | "OUTPUT_TOO_LONG";

const errorMessages: Record<CaseConverterErrorCode, string> = {
  INVALID_TEXT: "Enter text to convert.",
  TEXT_TOO_LONG: "Text is limited to 100,000 UTF-16 code units.",
  INVALID_MODE: "Choose a supported case conversion.",
  INVALID_LOCALE: "Choose a supported language rule.",
  OUTPUT_TOO_LONG: "The converted text exceeds the safe output limit.",
};

export class CaseConverterError extends Error {
  constructor(readonly code: CaseConverterErrorCode) {
    super(errorMessages[code]);
    this.name = "CaseConverterError";
  }
}

const wordPattern = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;
const sentenceEndPattern = /[.!?。！？]+(?:["'”’»)\]]*)?(?=\s|$)/gu;

function resolveLocale(locale: CaseConverterLocale): string | undefined {
  return locale === "default" ? undefined : locale;
}

function assertOptions(text: string, mode: CaseConverterMode, locale: CaseConverterLocale): void {
  if (typeof text !== "string") throw new CaseConverterError("INVALID_TEXT");
  if (text.length > caseConverterLimits.maximumInputCodeUnits)
    throw new CaseConverterError("TEXT_TOO_LONG");
  if (!(caseConverterModes as readonly string[]).includes(mode))
    throw new CaseConverterError("INVALID_MODE");
  if (!(caseConverterLocales as readonly string[]).includes(locale))
    throw new CaseConverterError("INVALID_LOCALE");
}

function appendTransformed(parts: Iterable<string>, transform: (part: string) => string): string {
  const blocks: string[] = [];
  let blockParts: string[] = [];
  let outputLength = 0;

  for (const part of parts) {
    const converted = transform(part);
    outputLength += converted.length;
    if (outputLength > caseConverterLimits.maximumOutputCodeUnits)
      throw new CaseConverterError("OUTPUT_TOO_LONG");
    blockParts.push(converted);
    if (blockParts.length === 1024) {
      blocks.push(blockParts.join(""));
      blockParts = [];
    }
  }

  if (blockParts.length) blocks.push(blockParts.join(""));
  return blocks.join("");
}

function* splitAroundPattern(text: string, pattern: RegExp): Iterable<string> {
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? cursor;
    if (start > cursor) yield text.slice(cursor, start);
    yield match[0];
    cursor = start + match[0].length;
  }
  if (cursor < text.length) yield text.slice(cursor);
}

function* fallbackTitleParts(
  text: string,
  locale: string | undefined,
  graphemes: Intl.Segmenter | undefined,
): Iterable<string> {
  let cursor = 0;
  for (const match of text.matchAll(wordPattern)) {
    const start = match.index ?? cursor;
    if (start > cursor) yield text.slice(cursor, start);
    yield titleWord(match[0], locale, graphemes);
    cursor = start + match[0].length;
  }
  if (cursor < text.length) yield text.slice(cursor);
}

function capitalizeFirstCased(
  text: string,
  locale: string | undefined,
  graphemes: Intl.Segmenter | undefined,
): string {
  if (graphemes) {
    for (const { segment, index } of graphemes.segment(text)) {
      if (segment.toLocaleUpperCase(locale) !== segment.toLocaleLowerCase(locale)) {
        return (
          text.slice(0, index) +
          segment.toLocaleUpperCase(locale) +
          text.slice(index + segment.length)
        );
      }
    }
    return text;
  }

  let index = 0;
  for (const character of text) {
    if (character.toLocaleUpperCase(locale) !== character.toLocaleLowerCase(locale)) {
      return (
        text.slice(0, index) +
        character.toLocaleUpperCase(locale) +
        text.slice(index + character.length)
      );
    }
    index += character.length;
  }
  return text;
}

function titleWord(
  text: string,
  locale: string | undefined,
  graphemes: Intl.Segmenter | undefined,
): string {
  return capitalizeFirstCased(text.toLocaleLowerCase(locale), locale, graphemes);
}

function sentence(
  text: string,
  locale: string | undefined,
  graphemes: Intl.Segmenter | undefined,
): string {
  return capitalizeFirstCased(text.toLocaleLowerCase(locale), locale, graphemes);
}

function transformTitle(text: string, locale: string | undefined): string {
  const graphemes =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(locale, { granularity: "grapheme" })
      : undefined;
  if (typeof Intl.Segmenter === "function") {
    const words = new Intl.Segmenter(locale, { granularity: "word" }).segment(text);
    return appendTransformed(
      (function* () {
        for (const item of words)
          yield item.isWordLike ? titleWord(item.segment, locale, graphemes) : item.segment;
      })(),
      (part) => part,
    );
  }
  return appendTransformed(fallbackTitleParts(text, locale, graphemes), (part) => part);
}

function transformSentenceCase(text: string, locale: string | undefined): string {
  const graphemes =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(locale, { granularity: "grapheme" })
      : undefined;
  if (typeof Intl.Segmenter === "function") {
    const segments = new Intl.Segmenter(locale, { granularity: "sentence" }).segment(text);
    return appendTransformed(
      (function* () {
        for (const item of segments) yield item.segment;
      })(),
      (part) => sentence(part, locale, graphemes),
    );
  }
  return appendTransformed(splitAroundPattern(text, sentenceEndPattern), (part) =>
    sentence(part, locale, graphemes),
  );
}

function toggleCase(text: string, locale: string | undefined): string {
  const parts =
    typeof Intl.Segmenter === "function"
      ? (function* () {
          for (const item of new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text))
            yield item.segment;
        })()
      : text;

  return appendTransformed(parts, (part) => {
    const upper = part.toLocaleUpperCase(locale);
    const lower = part.toLocaleLowerCase(locale);
    if (upper === lower) return part;
    return part === upper ? lower : upper;
  });
}

export function convertTextCase(
  text: string,
  mode: CaseConverterMode,
  locale: CaseConverterLocale = "default",
): string {
  assertOptions(text, mode, locale);
  const resolvedLocale = resolveLocale(locale);

  let result: string;
  switch (mode) {
    case "uppercase":
      result = text.toLocaleUpperCase(resolvedLocale);
      break;
    case "lowercase":
      result = text.toLocaleLowerCase(resolvedLocale);
      break;
    case "title":
      result = transformTitle(text, resolvedLocale);
      break;
    case "sentence":
      result = transformSentenceCase(text, resolvedLocale);
      break;
    case "toggle":
      result = toggleCase(text, resolvedLocale);
      break;
    default:
      throw new CaseConverterError("INVALID_MODE");
  }

  if (result.length > caseConverterLimits.maximumOutputCodeUnits)
    throw new CaseConverterError("OUTPUT_TOO_LONG");
  return result;
}
