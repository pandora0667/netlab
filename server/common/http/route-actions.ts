import type {
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { z } from "zod";
import { ConcurrencyLimitError } from "../../src/lib/concurrency-gate.js";
import {
  sendError,
  sendSuccess,
  type ApiErrorDetails,
} from "./api-response.js";

export interface RouteErrorResult {
  statusCode: number;
  error: ApiErrorDetails;
}

interface RouteActionOptions<TParsed, TResult> {
  middlewares?: RequestHandler[];
  parse?: (req: Request) => TParsed;
  acquire?: (req: Request) => () => void;
  execute: (parsed: TParsed, req: Request, res: Response) => Promise<TResult> | TResult;
  onError: (error: unknown, req: Request, res: Response) => RouteErrorResult;
  onSuccess?: (result: TResult, req: Request, res: Response) => unknown;
}

function registerRouteAction<TParsed, TResult>(
  router: Router,
  method: "get" | "post",
  path: string,
  options: RouteActionOptions<TParsed, TResult>,
) {
  const handler: RequestHandler = (req, res) => {
    void (async () => {
      let release = () => {};

      try {
        const parsed = options.parse
          ? options.parse(req)
          : (undefined as TParsed);

        if (options.acquire) {
          release = options.acquire(req);
        }

        const result = await options.execute(parsed, req, res);

        if (options.onSuccess) {
          options.onSuccess(result, req, res);
          return;
        }

        sendSuccess(res, result);
      } catch (error) {
        const routeError = options.onError(error, req, res);
        sendError(res, routeError.statusCode, routeError.error);
      } finally {
        release();
      }
    })();
  };

  const middlewares = options.middlewares ?? [];
  router[method](path, ...middlewares, handler);
}

export function registerGetAction<TResult>(
  router: Router,
  path: string,
  options: Omit<RouteActionOptions<void, TResult>, "parse">,
) {
  registerRouteAction<void, TResult>(router, "get", path, options);
}

export function registerPostAction<TParsed, TResult>(
  router: Router,
  path: string,
  options: RouteActionOptions<TParsed, TResult>,
) {
  registerRouteAction(router, "post", path, options);
}

export function resolveRequesterIp(req: Request) {
  return req.ip || "unknown";
}

export function zodRouteError(
  error: unknown,
  code: string,
  message: string,
): RouteErrorResult | null {
  if (!(error instanceof z.ZodError)) {
    return null;
  }

  return {
    statusCode: 400,
    error: {
      code,
      message,
      details: error.errors,
    },
  };
}

export function concurrencyRouteError(
  error: unknown,
  code: string,
): RouteErrorResult | null {
  if (!(error instanceof ConcurrencyLimitError)) {
    return null;
  }

  return {
    statusCode: error.statusCode,
    error: {
      code,
      message: error.message,
    },
  };
}

export function fallbackRouteError(
  error: unknown,
  code: string,
  message: string,
  statusCode = 500,
): RouteErrorResult {
  return {
    statusCode,
    error: {
      code,
      message: error instanceof Error ? error.message : message,
    },
  };
}

export function firstRouteError(
  ...matches: Array<RouteErrorResult | null>
) {
  return matches.find((match) => match !== null) ?? null;
}
