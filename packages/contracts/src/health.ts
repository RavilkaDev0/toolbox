import { z } from "zod";

export const liveHealthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const readyHealthResponseSchema = z.object({
  status: z.literal("ready"),
});

export type LiveHealthResponse = z.infer<typeof liveHealthResponseSchema>;
export type ReadyHealthResponse = z.infer<typeof readyHealthResponseSchema>;
