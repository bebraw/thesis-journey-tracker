import type { Env } from "../app-env";

export const MINIMUM_SECRET_BYTES = 32;

const KNOWN_PLACEHOLDER_PREFIXES = ["change-this-", "replace-with-"];

type SecretEnvironment = Pick<Env, "APP_ENCRYPTION_SECRET" | "SESSION_SECRET">;

export function validateRuntimeSecrets(env: SecretEnvironment): string | null {
  const sessionSecretError = validateSecret("SESSION_SECRET", env.SESSION_SECRET);
  if (sessionSecretError) {
    return sessionSecretError;
  }

  const appEncryptionSecretError = validateSecret("APP_ENCRYPTION_SECRET", env.APP_ENCRYPTION_SECRET);
  if (appEncryptionSecretError) {
    return appEncryptionSecretError;
  }

  if (env.SESSION_SECRET === env.APP_ENCRYPTION_SECRET) {
    return "APP_ENCRYPTION_SECRET must be different from SESSION_SECRET.";
  }

  return null;
}

export function requireAppEncryptionSecret(env: SecretEnvironment): string {
  const validationError = validateSecret("APP_ENCRYPTION_SECRET", env.APP_ENCRYPTION_SECRET);
  if (validationError) {
    throw new Error(validationError);
  }
  if (env.SESSION_SECRET && env.APP_ENCRYPTION_SECRET === env.SESSION_SECRET) {
    throw new Error("APP_ENCRYPTION_SECRET must be different from SESSION_SECRET.");
  }
  return env.APP_ENCRYPTION_SECRET as string;
}

function validateSecret(name: string, value: string | undefined): string | null {
  if (!value) {
    return `${name} must be configured.`;
  }
  if (value !== value.trim()) {
    return `${name} must not start or end with whitespace.`;
  }
  if (KNOWN_PLACEHOLDER_PREFIXES.some((prefix) => value.toLocaleLowerCase().startsWith(prefix))) {
    return `${name} must not use a documented placeholder value.`;
  }
  if (new TextEncoder().encode(value).byteLength < MINIMUM_SECRET_BYTES) {
    return `${name} must contain at least ${MINIMUM_SECRET_BYTES} bytes.`;
  }
  return null;
}
