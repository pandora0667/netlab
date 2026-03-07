import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface RequestContext {
  requestId: string;
  clientIp?: string;
  path?: string;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function resolveRequestId(requestIdHeader: string | undefined): string {
  if (!requestIdHeader) {
    return randomUUID();
  }

  const normalizedRequestId = requestIdHeader.trim();
  if (!REQUEST_ID_PATTERN.test(normalizedRequestId)) {
    return randomUUID();
  }

  return normalizedRequestId;
}
