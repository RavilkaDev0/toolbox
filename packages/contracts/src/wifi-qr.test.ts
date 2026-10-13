import { describe, expect, it } from "vitest";
import { wifiQrOptionsSchema } from "./wifi-qr.js";

describe("Wi-Fi QR contract", () => {
  it("accepts strict bounded network options for open, WPA and WEP", () => {
    expect(
      wifiQrOptionsSchema.safeParse({
        ssid: "Open guest",
        security: "open",
        password: "",
        hidden: false,
      }).success,
    ).toBe(true);
    expect(
      wifiQrOptionsSchema.safeParse({
        ssid: "Office",
        security: "wpa",
        password: "valid password",
        hidden: true,
      }).success,
    ).toBe(true);
    expect(
      wifiQrOptionsSchema.safeParse({
        ssid: "Legacy",
        security: "wep",
        password: "abcde",
        hidden: false,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid passwords, unsupported auth values, and extra keys", () => {
    expect(
      wifiQrOptionsSchema.safeParse({
        ssid: "Office",
        security: "wpa3",
        password: "short",
        hidden: false,
      }).success,
    ).toBe(false);
    expect(
      wifiQrOptionsSchema.safeParse({
        ssid: "Office",
        security: "enterprise",
        password: "",
        hidden: false,
      }).success,
    ).toBe(false);
    expect(
      wifiQrOptionsSchema.safeParse({
        ssid: "Office",
        security: "open",
        password: "",
        hidden: false,
        log: true,
      }).success,
    ).toBe(false);
  });
});
