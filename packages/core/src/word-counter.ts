export const wordCounterLimits = {
  maximumUtf16CodeUnits: 100_000,
} as const;

export type WordCounterErrorCode = "INVALID_TEXT" | "TEXT_TOO_LONG";

const errorMessages: Record<WordCounterErrorCode, string> = {
  INVALID_TEXT: "Enter text to analyze.",
  TEXT_TOO_LONG: "Text is limited to 100,000 UTF-16 code units.",
};

export class WordCounterError extends Error {
  constructor(readonly code: WordCounterErrorCode) {
    super(errorMessages[code]);
    this.name = "WordCounterError";
  }
}

export type WordCounterAnalysis = {
  readonly wordCount: number;
  readonly charactersWithWhitespace: number;
  readonly charactersWithoutWhitespace: number;
  readonly paragraphCount: number;
  readonly lineCount: number;
  readonly sentenceCount: number;
  readonly utf16CodeUnits: number;
  readonly unicodeCodePoints: number;
  readonly characterCountUnit: "grapheme clusters" | "Unicode code points";
  readonly usesIntlSegmenter: boolean;
};

const whitespaceCharacter = /\s/u;
const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu;
const sentenceEndPattern = /[.!?。！？]+(?:["'”’»)\]]*)(?=\s|$)/gu;

function countFallbackWords(text: string): number {
  let count = 0;
  for (const _match of text.matchAll(wordPattern)) count++;
  return count;
}

function countFallbackSentences(text: string, lastContentEnd: number): number {
  let count = 0;
  let lastSentenceEnd = 0;
  for (const match of text.matchAll(sentenceEndPattern)) {
    count++;
    lastSentenceEnd = (match.index ?? 0) + match[0].length;
  }
  if (lastContentEnd > lastSentenceEnd) count++;
  return count;
}

function countLinesAndParagraphs(text: string) {
  if (!text.length) return { lineCount: 0, paragraphCount: 0, lastContentEnd: 0 };

  let lineCount = 1;
  let paragraphCount = 0;
  let lineHasContent = false;
  let insideParagraph = false;
  let lastContentEnd = 0;
  const finishLine = () => {
    if (lineHasContent) {
      if (!insideParagraph) paragraphCount++;
      insideParagraph = true;
    } else {
      insideParagraph = false;
    }
    lineHasContent = false;
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index] ?? "";
    if (character === "\r") {
      lineCount++;
      finishLine();
      if (text[index + 1] === "\n") index++;
    } else if (character === "\n") {
      lineCount++;
      finishLine();
    } else if (!whitespaceCharacter.test(character)) {
      lineHasContent = true;
      lastContentEnd = index + 1;
    }
  }
  finishLine();
  return { lineCount, paragraphCount, lastContentEnd };
}

export function assertWordCounterText(text: string): void {
  if (typeof text !== "string") throw new WordCounterError("INVALID_TEXT");
  if (text.length > wordCounterLimits.maximumUtf16CodeUnits)
    throw new WordCounterError("TEXT_TOO_LONG");
}

export function analyzeText(text: string, locale?: string): WordCounterAnalysis {
  assertWordCounterText(text);
  const Segmenter = typeof Intl.Segmenter === "function" ? Intl.Segmenter : undefined;
  if (!text.length)
    return {
      wordCount: 0,
      charactersWithWhitespace: 0,
      charactersWithoutWhitespace: 0,
      paragraphCount: 0,
      lineCount: 0,
      sentenceCount: 0,
      utf16CodeUnits: 0,
      unicodeCodePoints: 0,
      characterCountUnit: Segmenter ? "grapheme clusters" : "Unicode code points",
      usesIntlSegmenter: Boolean(Segmenter),
    };

  let unicodeCodePoints = 0;
  for (const _character of text) unicodeCodePoints++;
  const lineMetrics = countLinesAndParagraphs(text);
  let wordCount = 0;
  let sentenceCount = 0;
  let charactersWithWhitespace = 0;
  let charactersWithoutWhitespace = 0;

  if (Segmenter) {
    const words = new Segmenter(locale, { granularity: "word" });
    const sentences = new Segmenter(locale, { granularity: "sentence" });
    const graphemes = new Segmenter(locale, { granularity: "grapheme" });
    for (const segment of words.segment(text)) {
      if (segment.isWordLike) wordCount++;
    }
    for (const segment of sentences.segment(text)) {
      if (!whitespaceCharacter.test(segment.segment)) sentenceCount++;
    }
    for (const segment of graphemes.segment(text)) {
      charactersWithWhitespace++;
      if (!whitespaceCharacter.test(segment.segment)) charactersWithoutWhitespace++;
    }
  } else {
    wordCount = countFallbackWords(text);
    sentenceCount = countFallbackSentences(text, lineMetrics.lastContentEnd);
    charactersWithWhitespace = unicodeCodePoints;
    for (const character of text) {
      if (!whitespaceCharacter.test(character)) charactersWithoutWhitespace++;
    }
  }

  return {
    wordCount,
    charactersWithWhitespace,
    charactersWithoutWhitespace,
    paragraphCount: lineMetrics.paragraphCount,
    lineCount: lineMetrics.lineCount,
    sentenceCount,
    utf16CodeUnits: text.length,
    unicodeCodePoints,
    characterCountUnit: Segmenter ? "grapheme clusters" : "Unicode code points",
    usesIntlSegmenter: Boolean(Segmenter),
  };
}
