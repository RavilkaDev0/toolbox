import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { parseApiConfig } from "./runtime-config.js";

async function bootstrap(): Promise<void> {
  const config = parseApiConfig(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });

  app.setGlobalPrefix("api/v1");
  await app.listen(config.port, config.host);
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected startup error";
  console.error(`API startup failed: ${message}`);
  process.exitCode = 1;
});
