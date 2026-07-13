export type AccessRole = "editor" | "readonly";

export interface AuthUser {
  name: string;
  password: string;
  role: AccessRole;
}

export interface SessionUser {
  id: number;
  name: string;
  role: AccessRole;
  sessionVersion: number;
}

export interface SessionIdentity {
  userId: number;
  sessionVersion: number;
}

export function isAccessRole(value: unknown): value is AccessRole {
  return value === "editor" || value === "readonly";
}
