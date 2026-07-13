import { describe, expect, it } from "vitest";
import { hashPassword, PasswordHashUpgradeRequiredError, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the original password and rejects a different one", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("rejects malformed password hashes", async () => {
    await expect(verifyPassword("anything", "not-a-valid-hash")).resolves.toBe(false);
  });

  it("requires legacy work factors and malformed salt lengths to be reset", async () => {
    const weakHash = `pbkdf2_sha256$1000$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(32).toString("base64")}`;
    const shortSaltHash = `pbkdf2_sha256$100000$${Buffer.alloc(8).toString("base64")}$${Buffer.alloc(32).toString("base64")}`;

    await expect(verifyPassword("anything", weakHash)).rejects.toBeInstanceOf(PasswordHashUpgradeRequiredError);
    await expect(verifyPassword("anything", shortSaltHash)).resolves.toBe(false);
  });
});
