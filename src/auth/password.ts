const HASH_SCHEME = "pbkdf2_sha256";
export const PASSWORD_HASH_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const DERIVED_KEY_LENGTH = 32;

const textEncoder = new TextEncoder();

export interface HashPasswordOptions {
  salt?: Uint8Array;
}

export class PasswordHashUpgradeRequiredError extends Error {
  constructor(readonly storedIterations: number) {
    super(
      `Stored password hash uses ${storedIterations} PBKDF2 iterations; reset the account with the current account:create command.`,
    );
    this.name = "PasswordHashUpgradeRequiredError";
  }
}

interface ParsedPasswordHash {
  iterations: number;
  salt: Uint8Array;
  derivedKey: Uint8Array;
}

export type PasswordHashInspection =
  | { status: "current"; iterations: number }
  | { status: "upgrade_required"; iterations: number }
  | { status: "invalid"; iterations: null };

export async function hashPassword(password: string, options: HashPasswordOptions = {}): Promise<string> {
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  if (salt.byteLength !== SALT_LENGTH) {
    throw new Error(`Password salts must contain exactly ${SALT_LENGTH} bytes.`);
  }
  const derivedKey = await derivePasswordKey(password, salt, PASSWORD_HASH_ITERATIONS);
  return `${HASH_SCHEME}$${PASSWORD_HASH_ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(derivedKey)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsedHash = parsePasswordHash(storedHash);
  if (!parsedHash) {
    return false;
  }

  if (parsedHash.iterations !== PASSWORD_HASH_ITERATIONS) {
    throw new PasswordHashUpgradeRequiredError(parsedHash.iterations);
  }

  const actualDerivedKey = await derivePasswordKey(password, parsedHash.salt, parsedHash.iterations);
  return timingSafeEqualBytes(actualDerivedKey, parsedHash.derivedKey);
}

export function inspectPasswordHash(storedHash: string): PasswordHashInspection {
  const parsedHash = parsePasswordHash(storedHash);
  if (!parsedHash) {
    return { status: "invalid", iterations: null };
  }
  if (parsedHash.iterations !== PASSWORD_HASH_ITERATIONS) {
    return { status: "upgrade_required", iterations: parsedHash.iterations };
  }
  return { status: "current", iterations: parsedHash.iterations };
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    DERIVED_KEY_LENGTH * 8,
  );
  return new Uint8Array(derivedBits);
}

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const parts = value.split("$");
  if (parts.length !== 4) {
    return null;
  }
  const [scheme, iterationText, saltText, derivedKeyText] = parts;
  if (scheme !== HASH_SCHEME || !iterationText || !saltText || !derivedKeyText || !/^[1-9]\d*$/.test(iterationText)) {
    return null;
  }

  const iterations = Number(iterationText);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return null;
  }

  try {
    const salt = decodeBase64(saltText);
    const derivedKey = decodeBase64(derivedKeyText);
    if (salt.length !== SALT_LENGTH || derivedKey.length !== DERIVED_KEY_LENGTH) {
      return null;
    }
    return {
      iterations,
      salt,
      derivedKey,
    };
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
