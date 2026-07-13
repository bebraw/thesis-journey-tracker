import { describe, expect, it } from "vitest";
import { requireAppEncryptionSecret, validateRuntimeSecrets } from "./secrets";

const SESSION_SECRET = "session-secret-with-at-least-32-bytes";
const APP_ENCRYPTION_SECRET = "app-encryption-secret-with-32-bytes";

describe("runtime secret validation", () => {
  it("accepts strong independent secrets", () => {
    expect(validateRuntimeSecrets({ SESSION_SECRET, APP_ENCRYPTION_SECRET })).toBeNull();
    expect(requireAppEncryptionSecret({ SESSION_SECRET, APP_ENCRYPTION_SECRET })).toBe(APP_ENCRYPTION_SECRET);
  });

  it("rejects missing, short, placeholder, and shared secrets", () => {
    expect(validateRuntimeSecrets({ APP_ENCRYPTION_SECRET })).toContain("SESSION_SECRET must be configured");
    expect(validateRuntimeSecrets({ SESSION_SECRET: "short", APP_ENCRYPTION_SECRET })).toContain("at least 32 bytes");
    expect(
      validateRuntimeSecrets({
        SESSION_SECRET: "change-this-to-a-long-random-secret",
        APP_ENCRYPTION_SECRET,
      }),
    ).toContain("placeholder");
    expect(validateRuntimeSecrets({ SESSION_SECRET, APP_ENCRYPTION_SECRET: "short" })).toContain("at least 32 bytes");
    expect(validateRuntimeSecrets({ SESSION_SECRET, APP_ENCRYPTION_SECRET: SESSION_SECRET })).toContain("must be different");
  });
});
