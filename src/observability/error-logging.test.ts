import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "./error-logging";

describe("structured error logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits searchable plain-object fields with safe request context", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("Database write failed");

    logError("request.unhandled", error, {
      method: "POST",
      path: "/logout",
      ray_id: "ray-123",
    });

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toMatchObject({
      type: "application_error",
      event: "request.unhandled",
      error_name: "Error",
      error_message: "Database write failed",
      method: "POST",
      path: "/logout",
      ray_id: "ray-123",
    });
    expect(consoleError.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ error_stack: expect.stringContaining("Database write failed") }));
  });

  it("redacts URL credentials, query strings, and credential-shaped fields", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error(
      'Request to https://user:password@example.com/calendar?token=secret failed: refresh_token="refresh-secret" Authorization=Bearer abc.def',
    );

    logError("calendar.sync_failed", error);

    const event = consoleError.mock.calls[0]?.[0] as Record<string, string>;
    expect(event.error_message).not.toContain("password");
    expect(event.error_message).not.toContain("token=secret");
    expect(event.error_message).not.toContain("refresh-secret");
    expect(event.error_message).not.toContain("abc.def");
    expect(event.error_message).toContain("https://example.com/calendar");
  });

  it("normalizes non-Error values without serializing arbitrary object fields", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("request.unhandled", { message: "Safe failure", secret: "do-not-log" });

    expect(consoleError.mock.calls[0]?.[0]).toMatchObject({
      error_name: "Error",
      error_message: "Safe failure",
    });
    expect(JSON.stringify(consoleError.mock.calls[0]?.[0])).not.toContain("do-not-log");
  });
});
