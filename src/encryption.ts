const DERIVE_KEY_ITERATIONS = 150_000;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

interface EncryptedPayload {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptText(plainText: string, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveEncryptionKey(secret, toArrayBuffer(salt));
  const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText));

  const payload: EncryptedPayload = {
    version: 1,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(encryptedBuffer)),
  };

  return JSON.stringify(payload);
}

export async function decryptText(encryptedText: string, secret: string): Promise<string> {
  const payload = parseEncryptedPayload(encryptedText);
  const key = await deriveEncryptionKey(secret, decodeBase64(payload.salt));
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(payload.iv) },
    key,
    decodeBase64(payload.ciphertext),
  );

  return new TextDecoder().decode(decryptedBuffer);
}

async function deriveEncryptionKey(secret: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: DERIVE_KEY_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

function parseEncryptedPayload(encryptedText: string): EncryptedPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(encryptedText);
  } catch {
    throw new Error("Encrypted settings payload is not valid JSON.");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as Partial<EncryptedPayload>).version !== 1 ||
    typeof (payload as Partial<EncryptedPayload>).salt !== "string" ||
    typeof (payload as Partial<EncryptedPayload>).iv !== "string" ||
    typeof (payload as Partial<EncryptedPayload>).ciphertext !== "string"
  ) {
    throw new Error("Encrypted settings payload is malformed.");
  }

  return payload as EncryptedPayload;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
