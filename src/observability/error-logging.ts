const MAX_LOG_TEXT_LENGTH = 8_000;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SENSITIVE_FIELD_PATTERN =
  /\b(access_token|refresh_token|client_secret|authorization|cookie)(["']?\s*[:=]\s*["']?)([^"'\s,}]+)/gi;

type ErrorLogValue = string | number | boolean | null;

export type ErrorLogContext = Record<string, ErrorLogValue | undefined>;

export interface StructuredErrorLog {
  type: "application_error";
  event: string;
  error_name: string;
  error_message: string;
  error_stack?: string;
  [key: string]: ErrorLogValue | undefined;
}

export function logError(event: string, error: unknown, context: ErrorLogContext = {}): void {
  const normalizedError = normalizeError(error);
  console.error({
    ...withoutUndefinedValues(context),
    type: "application_error",
    event,
    error_name: normalizedError.name,
    error_message: normalizedError.message,
    error_stack: normalizedError.stack,
  } satisfies StructuredErrorLog);
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: sanitizeLogText(error.message || "Unknown error"),
      stack: error.stack ? sanitizeLogText(error.stack) : undefined,
    };
  }

  if (hasStringProperty(error, "message")) {
    return {
      name: hasStringProperty(error, "name") ? error.name : "Error",
      message: sanitizeLogText(error.message),
    };
  }

  return {
    name: "UnknownError",
    message: sanitizeLogText(String(error)),
  };
}

function sanitizeLogText(value: string): string {
  const redacted = value
    .replace(URL_PATTERN, redactUrl)
    .replace(BEARER_TOKEN_PATTERN, "Bearer [redacted]")
    .replace(SENSITIVE_FIELD_PATTERN, (_match, field: string, separator: string) => `${field}${separator}[redacted]`);
  return redacted.length > MAX_LOG_TEXT_LENGTH ? `${redacted.slice(0, MAX_LOG_TEXT_LENGTH)}…` : redacted;
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "[redacted-url]";
  }
}

function hasStringProperty<Key extends string>(value: unknown, key: Key): value is Record<Key, string> {
  return Boolean(value && typeof value === "object" && key in value && typeof (value as Record<Key, unknown>)[key] === "string");
}

function withoutUndefinedValues(context: ErrorLogContext): Record<string, ErrorLogValue> {
  return Object.fromEntries(Object.entries(context).filter((entry): entry is [string, ErrorLogValue] => entry[1] !== undefined));
}
