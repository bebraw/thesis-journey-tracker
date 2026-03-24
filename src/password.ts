const HASH_SCHEME = "pbkdf2_sha256";
const DEFAULT_ITERATIONS = 210_000;
const SALT_LENGTH = 16;
const DERIVED_KEY_LENGTH = 32;

const textEncoder = new TextEncoder();

export interface HashPasswordOptions {
  iterations?: number;
  salt?: Uint8Array;
}

interface ParsedPasswordHash {
  iterations: number;
  salt: Uint8Array;
  derivedKey: Uint8Array;
}

export async function hashPassword(password: string, options: HashPasswordOptions = {}): Promise<string> {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const derivedKey = await derivePasswordKey(password, salt, iterations);
  return `${HASH_SCHEME}$${iterations}$${encodeBase64(salt)}$${encodeBase64(derivedKey)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsedHash = parsePasswordHash(storedHash);
  if (!parsedHash) {
    return false;
  }

  const actualDerivedKey = await derivePasswordKey(password, parsedHash.salt, parsedHash.iterations);
  return timingSafeEqualBytes(actualDerivedKey, parsedHash.derivedKey);
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
  const [scheme, iterationText, saltText, derivedKeyText] = value.split("$");
  if (scheme !== HASH_SCHEME || !iterationText || !saltText || !derivedKeyText) {
    return null;
  }

  const iterations = Number.parseInt(iterationText, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return null;
  }

  try {
    const salt = decodeBase64(saltText);
    const derivedKey = decodeBase64(derivedKeyText);
    if (salt.length === 0 || derivedKey.length !== DERIVED_KEY_LENGTH) {
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
