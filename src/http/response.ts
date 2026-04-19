export function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function htmlFragmentResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function cssResponse(css: string): Response {
  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

export function javascriptResponse(script: string): Response {
  return new Response(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

export function iconResponse(icon: ArrayBuffer): Response {
  return new Response(icon, {
    headers: {
      "content-type": "image/x-icon",
      "cache-control": "public, max-age=604800",
    },
  });
}

export function redirect(pathname: string, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Location", pathname);
  return new Response(null, { status: 302, headers });
}
