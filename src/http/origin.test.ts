import { describe, expect, it } from "vitest";
import { rejectInvalidMutationOrigin } from "./origin";

const REQUEST_URL = "https://tracker.example.edu/actions/update";
const REQUEST_ORIGIN = "https://tracker.example.edu";

function request(method: string, origin?: string): Request {
  const headers = new Headers();
  if (origin !== undefined) {
    headers.set("Origin", origin);
  }
  return new Request(REQUEST_URL, { method, headers });
}

describe("mutation origin enforcement", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("allows safe %s requests without an Origin header", (method) => {
    expect(rejectInvalidMutationOrigin(request(method))).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "PROPFIND"])(
    "allows %s only when Origin exactly matches the request origin",
    (method) => {
      expect(rejectInvalidMutationOrigin(request(method, REQUEST_ORIGIN))).toBeNull();
    },
  );

  it.each([
    ["missing", undefined],
    ["opaque", "null"],
    ["cross-origin", "https://attacker.example"],
    ["sibling subdomain", "https://evil.tracker.example.edu"],
    ["scheme mismatch", "http://tracker.example.edu"],
    ["port mismatch", "https://tracker.example.edu:8443"],
    ["non-origin URL", "https://tracker.example.edu/path"],
    ["trailing slash", "https://tracker.example.edu/"],
    ["multiple values", "https://tracker.example.edu, https://attacker.example"],
    ["malformed", "not an origin"],
  ])("rejects a %s Origin on an unsafe request", async (_label, origin) => {
    const response = rejectInvalidMutationOrigin(request("POST", origin));

    expect(response?.status).toBe(403);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    await expect(response?.text()).resolves.toBe("Forbidden");
  });
});
