import { assertWifiQrOptions, type WifiQrSecurity, wifiQrLimits } from "@toolbox/core";
import { z } from "zod";

export const wifiQrOptionsSchema = z
  .object({
    ssid: z.string().min(1).max(wifiQrLimits.ssidBytes),
    security: z.enum(["wpa", "wpa3", "wep", "open"]),
    password: z.string().max(wifiQrLimits.wpaRawKeyHexLength),
    hidden: z.boolean(),
  })
  .strict()
  .superRefine((options, context) => {
    try {
      assertWifiQrOptions(options);
    } catch {
      context.addIssue({ code: "custom", message: "Invalid Wi-Fi network settings." });
    }
  });

export type WifiQrOptionsInput = {
  readonly ssid: string;
  readonly security: WifiQrSecurity;
  readonly password: string;
  readonly hidden: boolean;
};
