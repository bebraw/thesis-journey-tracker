const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function rejectInvalidMutationOrigin(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const expectedOrigin = new URL(request.url).origin;
  if (request.headers.get("Origin") === expectedOrigin) {
    return null;
  }

  return new Response("Forbidden", {
    status: 403,
    headers: { "cache-control": "no-store" },
  });
}
