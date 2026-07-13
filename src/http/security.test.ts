import { describe, expect, it } from "vitest";
import { applyBrowserSecurityHeaders, CONTENT_SECURITY_POLICY } from "./security";

describe("browser security headers", () => {
  it("sets a strict policy while preserving the response", async () => {
    const response = applyBrowserSecurityHeaders(
      new Response("payload", {
        status: 201,
        headers: {
          "cache-control": "no-store",
          "set-cookie": "session=value; HttpOnly",
        },
      }),
      "https://tracker.example.edu/path",
    );

    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe("payload");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBe("session=value; HttpOnly");
    expect(response.headers.get("content-security-policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("script-src-attr 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src-elem 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src-attr 'unsafe-inline'");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-permitted-cross-domain-policies")).toBe("none");
    expect(response.headers.get("x-xss-protection")).toBe("0");
  });

  it("does not send HSTS over plain HTTP", () => {
    const response = applyBrowserSecurityHeaders(
      new Response(null, { headers: { "strict-transport-security": "max-age=1" } }),
      "http://localhost/",
    );

    expect(response.headers.has("strict-transport-security")).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
