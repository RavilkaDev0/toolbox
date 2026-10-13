import { assertContactQrOptions, type ContactQrOptions, contactQrLimits } from "@toolbox/core";
import { z } from "zod";

export const contactQrOptionsSchema = z
  .object({
    fullName: z.string().min(1).max(contactQrLimits.fullNameBytes),
    organization: z.string().max(contactQrLimits.organizationBytes),
    jobTitle: z.string().max(contactQrLimits.jobTitleBytes),
    phone: z.string().max(contactQrLimits.phoneBytes),
    email: z.string().max(contactQrLimits.emailBytes),
    website: z.string().max(contactQrLimits.websiteBytes),
    address: z.string().max(contactQrLimits.addressBytes),
  })
  .strict()
  .superRefine((contact, context) => {
    try {
      assertContactQrOptions(contact);
    } catch {
      context.addIssue({ code: "custom", message: "Invalid contact card fields." });
    }
  });

export type ContactQrOptionsInput = ContactQrOptions;
