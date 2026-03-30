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
