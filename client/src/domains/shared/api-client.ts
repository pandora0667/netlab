export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<TData> {
  success: boolean;
  data: TData | null;
  error: ApiErrorPayload | null;
  requestId: string;
}

interface ApiClientErrorOptions {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(message: string, options: ApiClientErrorOptions) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

function isApiEnvelope<TData>(payload: unknown): payload is ApiEnvelope<TData> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return (
    "success" in payload &&
    "data" in payload &&
    "error" in payload &&
    "requestId" in payload
  );
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

function resolveErrorMessage(payload: unknown, fallback: string): string {
  if (isApiEnvelope(payload) && payload.error?.message) {
    return payload.error.message;
  }

  if (payload && typeof payload === "object") {
    const errorValue = (payload as Record<string, unknown>).error;
    const messageValue = (payload as Record<string, unknown>).message;

    if (errorValue && typeof errorValue === "object" && "message" in errorValue) {
      const nestedMessage = (errorValue as Record<string, unknown>).message;
      if (typeof nestedMessage === "string") {
        return nestedMessage;
      }
    }

    if (typeof errorValue === "string") {
      return errorValue;
    }

    if (typeof messageValue === "string") {
      return messageValue;
    }
  }

  return fallback;
}

function resolveErrorCode(payload: unknown): string | undefined {
  if (isApiEnvelope(payload)) {
    return payload.error?.code;
  }

  if (payload && typeof payload === "object") {
    const codeValue = (payload as Record<string, unknown>).code;
    if (typeof codeValue === "string") {
      return codeValue;
    }
  }

  return undefined;
}

function resolveErrorDetails(payload: unknown): unknown {
  if (isApiEnvelope(payload)) {
    return payload.error?.details;
  }

  if (payload && typeof payload === "object") {
    return (payload as Record<string, unknown>).details;
  }

  return undefined;
}

function resolveRequestId(payload: unknown): string | undefined {
  if (isApiEnvelope(payload) && typeof payload.requestId === "string") {
    return payload.requestId;
  }

  return undefined;
}

export function getErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export async function requestApiV1<TData>(
  path: string,
  init: RequestInit = {},
): Promise<TData> {
  const headers = new Headers(init.headers);
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new ApiClientError(
      resolveErrorMessage(payload, `Request failed with status ${response.status}`),
      {
        status: response.status,
        code: resolveErrorCode(payload),
        details: resolveErrorDetails(payload),
        requestId: resolveRequestId(payload),
      },
    );
  }

  if (isApiEnvelope<TData>(payload)) {
    if (!payload.success || payload.data === null) {
      throw new ApiClientError(
        payload.error?.message || "Request failed",
        {
          status: response.status,
          code: payload.error?.code,
          details: payload.error?.details,
          requestId: payload.requestId,
        },
      );
    }

    return payload.data;
  }

  return payload as TData;
}

export async function postApiV1<TRequest, TResponse>(
  path: string,
  body: TRequest,
  init: Omit<RequestInit, "body" | "method"> = {},
): Promise<TResponse> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  return requestApiV1<TResponse>(path, {
    ...init,
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
