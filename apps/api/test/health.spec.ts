import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { liveHealthResponseSchema, readyHealthResponseSchema } from "@toolbox/contracts";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { parseApiConfig } from "../src/runtime-config.js";

describe("API foundation", () => {
  let app: NestFastifyApplication;
  let fastify: FastifyInstance;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    app.setGlobalPrefix("api/v1");
    await app.init();
    fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves typed liveness and readiness responses without external services", async () => {
    const live = await fastify.inject({ method: "GET", url: "/api/v1/health/live" });
    const ready = await fastify.inject({ method: "GET", url: "/api/v1/health/ready" });

    expect(live.statusCode).toBe(200);
    expect(liveHealthResponseSchema.parse(live.json())).toEqual({ status: "ok" });
    expect(ready.statusCode).toBe(200);
    expect(readyHealthResponseSchema.parse(ready.json())).toEqual({ status: "ready" });
  });

  it("defaults to loopback and rejects invalid environment values without echoing them", () => {
    expect(parseApiConfig({})).toEqual({ host: "127.0.0.1", port: 4000 });

    try {
      parseApiConfig({ HOST: "secret-host-value", PORT: "not-a-port" });
      throw new Error("Expected invalid configuration to be rejected");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).toContain("HOST");
        expect(error.message).toContain("PORT");
        expect(error.message).not.toContain("secret-host-value");
        expect(error.message).not.toContain("not-a-port");
      }
    }
  });
});
