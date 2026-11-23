import type { AccessRole } from "../../src/auth";
import { hashPassword } from "../../src/auth";
import { MockD1Database } from "./mock-d1";
import { sameOriginRequest } from "./request";

export async function seedTestUsers(
  db: MockD1Database,
  users: Array<{
    name: string;
    password: string;
    role: AccessRole;
    isAdmin?: boolean;
    canSupervise?: boolean;
    assignment?: "supervisor" | "advisor";
  }>,
): Promise<void> {
  for (const user of users) {
    const id = db.seedRow("app_users", {
      name: user.name,
      password_hash: await hashPassword(user.password),
      role: user.role,
      is_admin: user.isAdmin ? 1 : 0,
      can_supervise: user.canSupervise ? 1 : 0,
    });
    if (user.assignment) db.seedRow("thesis_assignments", { student_id: 1, user_id: id, assignment_role: user.assignment });
  }
}

export async function loginWithPassword<Env>(
  fetchHandler: (request: Request, env: Env) => Promise<Response>,
  env: Env,
  name: string,
  password: string,
  requestHeaders: HeadersInit = {},
): Promise<string> {
  const response = await fetchHandler(
    sameOriginRequest("http://localhost/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...requestHeaders },
      body: new URLSearchParams({ name, password }),
    }),
    env,
  );

  const setCookie = response.headers.getSetCookie().find((value) => value.startsWith("thesis_session=")) || "";
  const cookie = setCookie.split(";")[0];
  return cookie;
}
