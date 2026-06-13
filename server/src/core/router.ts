import { IncomingMessage, ServerResponse } from "node:http";

export type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, url: URL) => Promise<void>;

export interface Route {
  method: string;
  pattern: string;
  handler: Handler;
}

interface CompiledRoute {
  method: string;
  pattern: string;
  regex: RegExp;
  paramNames: string[];
  handler: Handler;
}

function compileRoute(route: Route): CompiledRoute {
  const paramNames: string[] = [];
  const regexStr = route.pattern.replace(/:([a-zA-Z]+)/g, (_match, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return {
    method: route.method,
    pattern: route.pattern,
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
    handler: route.handler,
  };
}

export function matchRoute(
  routes: Route[],
  method: string,
  pathname: string,
): { handler: Handler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== "*" && route.method !== method) continue;
    const compiled = compileRoute(route);
    const match = pathname.match(compiled.regex);
    if (!match) continue;
    const params: Record<string, string> = {};
    for (let i = 0; i < compiled.paramNames.length; i++) {
      params[compiled.paramNames[i]] = decodeURIComponent(match[i + 1]);
    }
    return { handler: compiled.handler, params };
  }
  return null;
}
