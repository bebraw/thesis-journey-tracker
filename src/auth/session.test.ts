import { describe, expect, it } from "vitest";
import { createSessionToken, getSessionUser } from "./session";

describe("session tokens", () => {
  it("round-trips a signed session payload", async () => {
    const token = await createSessionToken("test-secret", 60, {
      name: "Advisor",
      role: "editor",
    });

    const user = await getSessionUser(
      new Request("http://localhost/", {
        headers: {
          cookie: `thesis_session=${token}`,
        },
      }),
      "test-secret",
      "thesis_session",
    );

    expect(user).toEqual({
      name: "Advisor",
      role: "editor",
    });
  });

  it("rejects a tampered session token", async () => {
    const token = await createSessionToken("test-secret", 60, {
      name: "Advisor",
      role: "editor",
    });
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    const user = await getSessionUser(
      new Request("http://localhost/", {
        headers: {
          cookie: `thesis_session=${tamperedToken}`,
        },
      }),
      "test-secret",
      "thesis_session",
    );

    expect(user).toBeNull();
  });
});
