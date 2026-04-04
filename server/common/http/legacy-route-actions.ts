import type {
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";

interface LegacyRouteActionOptions<TParsed, TResult> {
  middlewares?: RequestHandler[];
  parse?: (req: Request) => TParsed;
  acquire?: (req: Request) => () => void;
  execute: (parsed: TParsed, req: Request, res: Response) => Promise<TResult> | TResult;
  onError: (error: unknown, req: Request, res: Response) => unknown;
  onSuccess?: (result: TResult, req: Request, res: Response) => unknown;
}

function registerLegacyRouteAction<TParsed, TResult>(
  router: Router,
  method: "get" | "post",
  path: string,
  options: LegacyRouteActionOptions<TParsed, TResult>,
) {
  const handler: RequestHandler = async (req, res) => {
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
        return options.onSuccess(result, req, res);
      }

      return res.json(result);
    } catch (error) {
      return options.onError(error, req, res);
    } finally {
      release();
    }
  };

  const middlewares = options.middlewares ?? [];
  router[method](path, ...middlewares, handler);
}

export function registerLegacyGetAction<TResult>(
  router: Router,
  path: string,
  options: Omit<LegacyRouteActionOptions<void, TResult>, "parse">,
) {
  registerLegacyRouteAction<void, TResult>(router, "get", path, options);
}

export function registerLegacyPostAction<TParsed, TResult>(
  router: Router,
  path: string,
  options: LegacyRouteActionOptions<TParsed, TResult>,
) {
  registerLegacyRouteAction(router, "post", path, options);
}

