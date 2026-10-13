import { describe, expect, it } from "vitest";
import {
  assertWifiQrOptions,
  buildWifiQrPayload,
  parseWifiQrPayload,
  WifiQrError,
  type WifiQrOptions,
} from "./wifi-qr.js";

const base: WifiQrOptions = {
  ssid: "Toolbox Wi-Fi",
  security: "wpa",
  password: "safe passphrase",
  hidden: false,
};

describe("Wi-Fi QR rules", () => {
  it("escapes field delimiters and round-trips Unicode and secrets without changing values", () => {
    const options = {
      ...base,
      ssid: 'Lab;Guest,Floor:2\\"世界',
      password: 'a\\b;c,d:e"f世界',
      hidden: true,
    };
    const payload = buildWifiQrPayload(options);
    expect(payload).toContain("\\;");
    expect(payload).toContain("\\,");
    expect(payload).toContain("\\:");
    expect(payload).toContain('\\"');
    expect(payload).toContain("世界");
    expect(parseWifiQrPayload(payload)).toEqual(options);
  });

  it.each([
    ["wpa", "WPA"],
    ["wpa3", "SAE"],
    ["wep", "WEP"],
  ] as const)("builds the supported %s authentication token", (security, token) => {
    const password = security === "wep" ? "abcde" : base.password;
    expect(buildWifiQrPayload({ ...base, security, password })).toContain(`T:${token};`);
  });

  it("omits credentials for open networks and preserves hidden=false on parsing", () => {
    const payload = buildWifiQrPayload({ ...base, security: "open", password: "" });
    expect(payload).toBe("WIFI:T:nopass;S:Toolbox Wi-Fi;;");
    expect(parseWifiQrPayload(payload)).toEqual({ ...base, security: "open", password: "" });
  });

  it("enforces UTF-8 SSID bounds, valid Unicode, and credentials for each security type", () => {
    expect(() => assertWifiQrOptions({ ...base, ssid: "😀".repeat(8) })).toThrowError(
      /32 UTF-8 bytes/,
    );
    expect(() => assertWifiQrOptions({ ...base, ssid: "" })).toThrowError(/SSID/);
    expect(() => assertWifiQrOptions({ ...base, ssid: "bad\nssid" })).toThrowError(/control/);
    expect(() => assertWifiQrOptions({ ...base, ssid: "\ud800" })).toThrowError(/Unicode/);
    expect(() => assertWifiQrOptions({ ...base, security: "wpa", password: "short" })).toThrowError(
      /password/i,
    );
    expect(() =>
      assertWifiQrOptions({ ...base, security: "wpa3", password: "a".repeat(64) }),
    ).toThrowError(/password/i);
    expect(() =>
      assertWifiQrOptions({ ...base, security: "open", password: "secret" }),
    ).toThrowError(/Open networks/);
  });

  it("accepts supported WEP keys and rejects unsupported and malformed payloads", () => {
    for (const password of ["abcde", "abcdefghijklm", "0123456789", "0123456789abcdef01234567"])
      expect(() => assertWifiQrOptions({ ...base, security: "wep", password })).not.toThrow();
    expect(() => assertWifiQrOptions({ ...base, security: "wep", password: "bad" })).toThrowError(
      WifiQrError,
    );
    for (const payload of [
      "WIFI:T:WPA;S:Lab;P:short;;",
      "WIFI:T:WPA;S:Lab;S:Again;P:validpass;;",
      "WIFI:T:WPA3;S:Lab;P:validpass;;",
      `WIFI:T:WPA;S:${"x".repeat(2048)};P:validpass;;`,
      "WIFI:T:WPA;S:Lab\\q;P:validpass;;",
    ])
      expect(() => parseWifiQrPayload(payload)).toThrowError(WifiQrError);
  });
});
