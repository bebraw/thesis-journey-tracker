import { describe, expect, it } from "vitest";
import { createSessionToken, getSessionIdentity } from "./session";

describe("session tokens", () => {
  it("round-trips a signed session payload", async () => {
    const token = await createSessionToken("test-secret", 60, {
      userId: 42,
      sessionVersion: 3,
    });

    const identity = await getSessionIdentity(
      new Request("http://localhost/", {
        headers: {
          cookie: `thesis_session=${token}`,
        },
      }),
      "test-secret",
      "thesis_session",
    );

    expect(identity).toEqual({
      userId: 42,
      sessionVersion: 3,
    });
  });

  it("rejects a tampered session token", async () => {
    const token = await createSessionToken("test-secret", 60, {
      userId: 42,
      sessionVersion: 3,
    });
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    const identity = await getSessionIdentity(
      new Request("http://localhost/", {
        headers: {
          cookie: `thesis_session=${tamperedToken}`,
        },
      }),
      "test-secret",
      "thesis_session",
    );

    expect(identity).toBeNull();
  });

  it("rejects legacy payloads even when they have a valid signature", async () => {
    const legacyPayload = `${Date.now() + 60_000}:editor:QWR2aXNvcg`;
    const signature = await signPayload(legacyPayload, "test-secret");
    const identity = await getSessionIdentity(
      new Request("http://localhost/", {
        headers: { cookie: `thesis_session=${legacyPayload}.${signature}` },
      }),
      "test-secret",
      "thesis_session",
    );

    expect(identity).toBeNull();
  });
});

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  let binary = "";
  for (const byte of signature) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
