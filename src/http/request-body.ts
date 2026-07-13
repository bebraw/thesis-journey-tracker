export const DEFAULT_FORM_BODY_LIMIT_BYTES = 64 * 1024;
export const LOGIN_FORM_BODY_LIMIT_BYTES = 16 * 1024;
export const IMPORT_FILE_LIMIT_BYTES = 4 * 1024 * 1024;
export const IMPORT_FORM_BODY_LIMIT_BYTES = IMPORT_FILE_LIMIT_BYTES + 64 * 1024;

interface CachedFormDataRead {
  maxBytes: number;
  value: Promise<FormData>;
}

const cachedFormDataReads = new WeakMap<Request, CachedFormDataRead>();

export class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body exceeds the ${maxBytes}-byte limit.`);
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readFormData(request: Request, options: { maxBytes?: number } = {}): Promise<FormData> {
  const maxBytes = options.maxBytes || DEFAULT_FORM_BODY_LIMIT_BYTES;
  const cached = cachedFormDataReads.get(request);
  if (cached) {
    if (cached.maxBytes > maxBytes) {
      throw new Error("The request body was already read with a less restrictive size limit.");
    }
    return await cached.value;
  }

  const value = parseBoundedFormData(request, maxBytes);
  cachedFormDataReads.set(request, { maxBytes, value });
  return await value;
}

async function parseBoundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  rejectOversizedContentLength(request.headers.get("content-length"), maxBytes);
  const body = await readBoundedBody(request.body, maxBytes);
  const contentType = request.headers.get("content-type");
  const headers = contentType ? { "content-type": contentType } : undefined;
  return await new Response(body.buffer as ArrayBuffer, { headers }).formData();
}

function rejectOversizedContentLength(rawContentLength: string | null, maxBytes: number): void {
  if (!rawContentLength || !/^\d+$/.test(rawContentLength.trim())) {
    return;
  }

  const contentLength = Number(rawContentLength);
  if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }
}

async function readBoundedBody(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
  if (!body) {
    return new Uint8Array();
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
