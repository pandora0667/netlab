import logger, { abuseLogger } from "../../lib/logger.js";
import { ConcurrencyLimitError } from "../../src/lib/concurrency-gate.js";
import { parseDnsPropagationRequest } from "./dns-propagation.contract.js";
import { dnsPropagationGate } from "./dns-propagation.gate.js";
import { dnsPropagationService } from "./dns-propagation.registry.js";

export class DnsPropagationStartError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = "DnsPropagationStartError";
  }
}

export async function startDnsPropagationRequest(
  body: unknown,
  requesterIp: string,
  requestId: string | undefined,
  feature: string,
): Promise<{
  requestId: string;
  domain: string;
  region: string;
}> {
  let releaseRequest = () => {};

  try {
    const request = parseDnsPropagationRequest(body);
    releaseRequest = dnsPropagationGate.acquire(requesterIp);

    void dnsPropagationService.checkPropagation(
      request.domain,
      request.region,
      request.requestId,
    )
      .catch((error) => {
        logger.error("DNS propagation check failed", {
          feature,
          domain: request.domain,
          region: request.region,
          requestId: request.requestId,
          error: error instanceof Error ? error.message : error,
        });
      })
      .finally(() => {
        releaseRequest();
      });

    releaseRequest = () => {};

    return {
      requestId: request.requestId,
      domain: request.domain,
      region: request.region,
    };
  } catch (error) {
    releaseRequest();

    if (error instanceof ConcurrencyLimitError) {
      abuseLogger.warn("Blocked or constrained DNS propagation request", {
        feature,
        ip: requesterIp,
        requestId,
        domain: typeof (body as { domain?: unknown })?.domain === "string"
          ? (body as { domain: string }).domain
          : undefined,
        reason: error.message,
      });

      throw new DnsPropagationStartError(error.message, error.statusCode);
    }

    if (error instanceof Error) {
      throw new DnsPropagationStartError(error.message, 400, error);
    }

    throw new DnsPropagationStartError("Invalid DNS propagation request", 400);
  }
}
