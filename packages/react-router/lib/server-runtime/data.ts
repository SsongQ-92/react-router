import { isDataWithResponseInit } from "../router/router";
import { isRedirectStatusCode } from "./responses";
import type {
  ActionFunction,
  ActionFunctionArgs,
  LoaderFunction,
  LoaderFunctionArgs,
} from "./routeModules";

/**
 * An object of unknown type for route loaders and actions provided by the
 * server's `getLoadContext()` function.  This is defined as an empty interface
 * specifically so apps can leverage declaration merging to augment this type
 * globally: https://www.typescriptlang.org/docs/handbook/declaration-merging.html
 */
export interface AppLoadContext {
  [key: string]: unknown;
}

/**
 * Data for a route that was returned from a `loader()`.
 */
export type AppData = unknown;

function checkRedirect(result: ReturnType<LoaderFunction | ActionFunction>) {
  if (
    isDataWithResponseInit(result) &&
    result.init &&
    isRedirectStatusCode(result.init.status || 200)
  ) {
    throw new Response(
      new Headers(result.init.headers).get("Location")!,
      result.init
    );
  }
}

export async function callRouteHandler({
  loadContext,
  handler,
  params,
  request,
}: {
  request: Request;
  handler: LoaderFunction | ActionFunction;
  params: LoaderFunctionArgs["params"] | ActionFunctionArgs["params"];
  loadContext: AppLoadContext;
}) {
  let result = await handler({
    request: stripRoutesParam(stripIndexParam(request)),
    context: loadContext,
    params,
  });

  checkRedirect(result);

  return result;
}

// TODO: Document these search params better
// and stop stripping these in V2. These break
// support for running in a SW and also expose
// valuable info to data funcs that is being asked
// for such as "is this a data request?".
function stripIndexParam(request: Request) {
  let url = new URL(request.url);
  let indexValues = url.searchParams.getAll("index");
  url.searchParams.delete("index");
  let indexValuesToKeep = [];
  for (let indexValue of indexValues) {
    if (indexValue) {
      indexValuesToKeep.push(indexValue);
    }
  }
  for (let toKeep of indexValuesToKeep) {
    url.searchParams.append("index", toKeep);
  }

  let init: RequestInit = {
    method: request.method,
    body: request.body,
    headers: request.headers,
    signal: request.signal,
  };

  if (init.body) {
    (init as { duplex: "half" }).duplex = "half";
  }

  return new Request(url.href, init);
}

function stripRoutesParam(request: Request) {
  let url = new URL(request.url);
  url.searchParams.delete("_routes");
  let init: RequestInit = {
    method: request.method,
    body: request.body,
    headers: request.headers,
    signal: request.signal,
  };

  if (init.body) {
    (init as { duplex: "half" }).duplex = "half";
  }

  return new Request(url.href, init);
}
