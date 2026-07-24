type D1Value = string | number | null;

interface D1ExecMeta {
  last_row_id?: number | string;
  changes?: number;
}

interface D1ExecResult {
  success: boolean;
  meta: D1ExecMeta;
}

interface D1AllResult<T> {
  results: T[];
}

export interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>;
  run<T = Record<string, unknown>>(): Promise<D1ExecResult & { results?: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<D1ExecResult & { results?: T[] }>>;
}

export function parseDbNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function requireD1ReturnedRow<T>(
  result: D1ExecResult & { results?: T[] },
  operation: string,
): T {
  const row = result.results?.[0];
  if (!result.success || !row) {
    throw new Error(`${operation} did not affect the expected database row.`);
  }
  return row;
}

export function requireD1MutationSuccess(result: D1ExecResult, operation: string): void {
  if (!result.success) {
    throw new Error(`${operation} failed.`);
  }
}

export function requireD1ReturnedId(
  result: D1ExecResult & { results?: Array<{ id: number | string }> },
  operation: string,
): number {
  const row = requireD1ReturnedRow(result, operation);
  const id = parseDbNumber(row.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error(`${operation} returned an invalid database row ID.`);
  }
  return id;
}
