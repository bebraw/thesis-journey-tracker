export type AccessRole = "editor" | "readonly";

export interface AuthUser {
  name: string;
  password: string;
  role: AccessRole;
}

export interface SessionUser {
  name: string;
  role: AccessRole;
}

export function isAccessRole(value: unknown): value is AccessRole {
  return value === "editor" || value === "readonly";
}
