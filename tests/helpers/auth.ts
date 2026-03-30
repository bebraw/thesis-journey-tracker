import type { AccessRole } from "../../src/auth";
import { hashPassword } from "../../src/auth";
import { MockD1Database } from "./mock-d1";

const TEST_PASSWORD_HASH_ITERATIONS = 1_000;

export async function seedTestUsers(
  db: MockD1Database,
  users: Array<{ name: string; password: string; role: AccessRole }>,
): Promise<void> {
  for (const user of users) {
    db.seedAuthUser({
      name: user.name,
      password_hash: await hashPassword(user.password, { iterations: TEST_PASSWORD_HASH_ITERATIONS }),
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
    new Request("http://localhost/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...requestHeaders },
      body: new URLSearchParams({ name, password }),
    }),
    env,
  );

  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  return cookie;
}
