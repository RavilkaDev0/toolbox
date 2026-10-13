import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPasswordGeneratorOptions,
  generatePassword,
  getPasswordGeneratorMetrics,
  PasswordGeneratorError,
  type PasswordGeneratorOptions,
  passwordGeneratorLimits,
} from "./password-generator.js";

const defaults: PasswordGeneratorOptions = {
  length: 24,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
};

afterEach(() => vi.restoreAllMocks());

describe("password generator core", () => {
  it("uses Web Crypto and creates a bounded password containing every enabled class", () => {
    const cryptoSpy = vi.spyOn(globalThis.crypto, "getRandomValues");
    const mathRandomSpy = vi.spyOn(Math, "random");

    const password = generatePassword(defaults);

    expect(password.length === defaults.length).toBe(true);
    const allowedCharacters =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{};:,.?/";
    expect([...password].every((character) => allowedCharacters.includes(character))).toBe(true);
    expect([...password].some((character) => /[A-HJ-NP-Z]/.test(character))).toBe(true);
    expect([...password].some((character) => /[a-km-z]/.test(character))).toBe(true);
    expect([...password].some((character) => /[2-9]/.test(character))).toBe(true);
    expect([...password].some((character) => "!@#$%^&*()-_=+[]{};:,.?/".includes(character))).toBe(
      true,
    );
    expect([...password].every((character) => !"O0Il1".includes(character))).toBe(true);
    expect(cryptoSpy.mock.calls.length > 0).toBe(true);
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it("supports the minimum and maximum configured lengths", () => {
    expect(
      generatePassword({ ...defaults, length: passwordGeneratorLimits.minimumLength }).length ===
        passwordGeneratorLimits.minimumLength,
    ).toBe(true);
    expect(
      generatePassword({ ...defaults, length: passwordGeneratorLimits.maximumLength }).length ===
        passwordGeneratorLimits.maximumLength,
    ).toBe(true);
  });

  it("honors selected classes and ambiguous-character settings", () => {
    const lowercaseOnly = generatePassword({
      ...defaults,
      length: 16,
      uppercase: false,
      digits: false,
      symbols: false,
      avoidAmbiguous: false,
    });
    expect(/^[a-z]{16}$/.test(lowercaseOnly)).toBe(true);
    expect(
      getPasswordGeneratorMetrics({
        ...defaults,
        lowercase: true,
        uppercase: false,
        digits: false,
        symbols: false,
      }).characterPoolSize,
    ).toBe(25);
    expect(
      getPasswordGeneratorMetrics({
        ...defaults,
        lowercase: true,
        uppercase: false,
        digits: false,
        symbols: false,
        avoidAmbiguous: false,
      }).characterPoolSize,
    ).toBe(26);
  });

  it("rejects impossible, non-integer and out-of-range settings", () => {
    expect(() => assertPasswordGeneratorOptions({ ...defaults, length: 7 })).toThrowError(
      PasswordGeneratorError,
    );
    expect(() => assertPasswordGeneratorOptions({ ...defaults, length: 12.5 })).toThrowError(
      /length/i,
    );
    expect(() => assertPasswordGeneratorOptions({ ...defaults, length: 129 })).toThrowError(
      /length/i,
    );
    expect(() =>
      assertPasswordGeneratorOptions({
        ...defaults,
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: false,
      }),
    ).toThrowError(/character type/i);
  });

  it("reports the exact configured password search-space entropy", () => {
    const metrics = getPasswordGeneratorMetrics({
      ...defaults,
      length: 8,
      lowercase: false,
      digits: false,
      symbols: false,
      avoidAmbiguous: false,
    });
    expect(metrics.characterPoolSize).toBe(26);
    expect(metrics.searchSpaceBits).toBeCloseTo(8 * Math.log2(26), 10);
    const requiredClasses = getPasswordGeneratorMetrics(defaults);
    expect(requiredClasses.searchSpaceBits > 0).toBe(true);
    expect(
      requiredClasses.searchSpaceBits <
        defaults.length * Math.log2(requiredClasses.characterPoolSize),
    ).toBe(true);
  });
});
