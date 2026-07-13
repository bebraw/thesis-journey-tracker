import { describe, expect, it } from "vitest";
import { hashPassword, inspectPasswordHash, PasswordHashUpgradeRequiredError, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the original password and rejects a different one", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("rejects malformed password hashes", async () => {
    await expect(verifyPassword("anything", "not-a-valid-hash")).resolves.toBe(false);
    const validShape = `pbkdf2_sha256$100000$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(32).toString("base64")}`;
    await expect(verifyPassword("anything", validShape.replace("100000", "100000suffix"))).resolves.toBe(false);
    await expect(verifyPassword("anything", `${validShape}$extra`)).resolves.toBe(false);
  });

  it("requires legacy work factors and malformed salt lengths to be reset", async () => {
    const weakHash = `pbkdf2_sha256$1000$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(32).toString("base64")}`;
    const shortSaltHash = `pbkdf2_sha256$100000$${Buffer.alloc(8).toString("base64")}$${Buffer.alloc(32).toString("base64")}`;

    await expect(verifyPassword("anything", weakHash)).rejects.toBeInstanceOf(PasswordHashUpgradeRequiredError);
    await expect(verifyPassword("anything", shortSaltHash)).resolves.toBe(false);
    expect(inspectPasswordHash(weakHash)).toEqual({ status: "upgrade_required", iterations: 1000 });
    expect(inspectPasswordHash(shortSaltHash)).toEqual({ status: "invalid", iterations: null });
  });

  it("identifies hashes using the current verifier", async () => {
    const hash = await hashPassword("current password");

    expect(inspectPasswordHash(hash)).toEqual({ status: "current", iterations: 100_000 });
  });
});
