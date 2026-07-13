import type { AccessRole } from "../../src/auth";
import { hashPassword } from "../../src/auth";
import { MockD1Database } from "./mock-d1";
import { sameOriginRequest } from "./request";

export async function seedTestUsers(
  db: MockD1Database,
  users: Array<{ name: string; password: string; role: AccessRole }>,
): Promise<void> {
  for (const user of users) {
    db.seedAuthUser({
      name: user.name,
      password_hash: await hashPassword(user.password),
      role: user.role,
    });
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
