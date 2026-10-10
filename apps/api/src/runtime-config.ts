import { z } from "zod";

const apiEnvironmentSchema = z.object({
  HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
});

export type ApiConfig = {
  readonly host: "127.0.0.1" | "0.0.0.0";
  readonly port: number;
};

export function parseApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const result = apiEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidFields = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"} (${issue.code})`)
      .join(", ");
    throw new Error(`Invalid API environment: ${invalidFields}`);
  }

  return {
    host: result.data.HOST,
    port: result.data.PORT,
  };
}
