const NON_MUTATING_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function sameOriginRequest(input: string | URL, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();

  if (!NON_MUTATING_METHODS.has(method)) {
    const url = input instanceof URL ? input : new URL(input);
    headers.set("origin", url.origin);
  }

  return new Request(input, {
    ...init,
    headers,
  });
}
