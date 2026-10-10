import { Controller, Get } from "@nestjs/common";
import type { LiveHealthResponse, ReadyHealthResponse } from "@toolbox/contracts";

@Controller("health")
export class HealthController {
  @Get("live")
  getLiveness(): LiveHealthResponse {
    return { status: "ok" };
  }

  @Get("ready")
  getReadiness(): ReadyHealthResponse {
    return { status: "ready" };
  }
}
