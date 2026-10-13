export const passwordGeneratorLimits = {
  minimumLength: 8,
  maximumLength: 128,
  maximumUniformDraws: 32,
  maximumGenerationAttempts: 256,
} as const;

export type PasswordGeneratorOptions = {
  readonly length: number;
  readonly uppercase: boolean;
  readonly lowercase: boolean;
  readonly digits: boolean;
  readonly symbols: boolean;
  readonly avoidAmbiguous: boolean;
};

export type PasswordGeneratorMetrics = {
  readonly characterPoolSize: number;
  readonly searchSpaceBits: number;
};

const ambiguousCharacters = /[O0Il1]/g;
const characterClasses = [
  { option: "uppercase", characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { option: "lowercase", characters: "abcdefghijklmnopqrstuvwxyz" },
  { option: "digits", characters: "0123456789" },
  { option: "symbols", characters: "!@#$%^&*()-_=+[]{};:,.?/" },
] as const;
const randomWordRange = 0x1_0000_0000;

const messages = {
  INVALID_LENGTH: `Choose a password length from ${passwordGeneratorLimits.minimumLength} to ${passwordGeneratorLimits.maximumLength}.`,
  INVALID_OPTIONS: "Choose at least one character type.",
  CRYPTO_UNAVAILABLE: "Secure random generation is unavailable in this browser.",
  RANDOM_SOURCE_FAILED: "Secure random generation did not return a usable value. Try again.",
  GENERATION_FAILED: "A valid password could not be generated. Try again.",
} as const;

export type PasswordGeneratorErrorCode = keyof typeof messages;

export class PasswordGeneratorError extends Error {
  constructor(readonly code: PasswordGeneratorErrorCode) {
    super(messages[code]);
    this.name = "PasswordGeneratorError";
  }
}

type CharacterClass = {
  readonly option: (typeof characterClasses)[number]["option"];
  readonly characters: string;
};

export function assertPasswordGeneratorOptions(options: PasswordGeneratorOptions): void {
  if (
    !options ||
    typeof options !== "object" ||
    !Number.isInteger(options.length) ||
    options.length < passwordGeneratorLimits.minimumLength ||
    options.length > passwordGeneratorLimits.maximumLength
  )
    throw new PasswordGeneratorError("INVALID_LENGTH");
  if (
    typeof options.uppercase !== "boolean" ||
    typeof options.lowercase !== "boolean" ||
    typeof options.digits !== "boolean" ||
    typeof options.symbols !== "boolean" ||
    typeof options.avoidAmbiguous !== "boolean"
  )
    throw new PasswordGeneratorError("INVALID_OPTIONS");
  if (!options.uppercase && !options.lowercase && !options.digits && !options.symbols)
    throw new PasswordGeneratorError("INVALID_OPTIONS");
}

function getSelectedClasses(options: PasswordGeneratorOptions): CharacterClass[] {
  assertPasswordGeneratorOptions(options);
  return characterClasses.flatMap(({ option, characters }) => {
    if (!options[option]) return [];
    return [
      {
        option,
        characters: options.avoidAmbiguous
          ? characters.replace(ambiguousCharacters, "")
          : characters,
      },
    ];
  });
}

function countValidPasswords(options: PasswordGeneratorOptions): bigint {
  const groups = getSelectedClasses(options);
  const alphabetSize = groups.reduce((count, group) => count + group.characters.length, 0);
  const length = BigInt(options.length);
  let count = 0n;
  const subsets = 1 << groups.length;
  for (let mask = 0; mask < subsets; mask++) {
    let excludedCharacters = 0;
    let excludedGroups = 0;
    for (let index = 0; index < groups.length; index++) {
      if ((mask & (1 << index)) !== 0) {
        excludedCharacters += groups[index]?.characters.length ?? 0;
        excludedGroups++;
      }
    }
    const remaining = BigInt(alphabetSize - excludedCharacters) ** length;
    count += excludedGroups % 2 === 0 ? remaining : -remaining;
  }
  return count;
}

function log2BigInt(value: bigint): number {
  const binary = value.toString(2);
  const retainedBits = 53;
  const shift = Math.max(0, binary.length - retainedBits);
  const leading = Number(value >> BigInt(shift));
  return Math.log2(leading) + shift;
}

export function getPasswordGeneratorMetrics(
  options: PasswordGeneratorOptions,
): PasswordGeneratorMetrics {
  const groups = getSelectedClasses(options);
  return {
    characterPoolSize: groups.reduce((count, group) => count + group.characters.length, 0),
    searchSpaceBits: log2BigInt(countValidPasswords(options)),
  };
}

function uniformIndex(maximumExclusive: number): number {
  const cryptoSource = globalThis.crypto;
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== "function")
    throw new PasswordGeneratorError("CRYPTO_UNAVAILABLE");

  const cutoff = randomWordRange - (randomWordRange % maximumExclusive);
  const word = new Uint32Array(1);
  for (let draw = 0; draw < passwordGeneratorLimits.maximumUniformDraws; draw++) {
    cryptoSource.getRandomValues(word);
    const value = word[0] ?? randomWordRange;
    if (value < cutoff) return value % maximumExclusive;
  }
  throw new PasswordGeneratorError("RANDOM_SOURCE_FAILED");
}

export function generatePassword(options: PasswordGeneratorOptions): string {
  const groups = getSelectedClasses(options);
  const characters = groups.map((group) => group.characters).join("");
  const classSets = groups.map((group) => new Set(group.characters));

  for (let attempt = 0; attempt < passwordGeneratorLimits.maximumGenerationAttempts; attempt++) {
    const candidate = Array.from({ length: options.length }, () =>
      characters.charAt(uniformIndex(characters.length)),
    );
    if (
      classSets.every((characterSet) => candidate.some((character) => characterSet.has(character)))
    )
      return candidate.join("");
  }
  throw new PasswordGeneratorError("GENERATION_FAILED");
}
