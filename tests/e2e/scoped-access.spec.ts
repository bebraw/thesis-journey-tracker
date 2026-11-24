import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, name: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function createAdvisor(page: Page, advisorName: string, password: string, role: "editor" | "readonly" = "editor") {
  await page.goto("/access");
  await page.getByText("Create an account", { exact: true }).click();
  const createAccount = page.getByRole("form", { name: "Create account" });
  await createAccount.getByLabel("Account name").fill(advisorName);
  await createAccount.getByLabel("Password", { exact: true }).fill(password);
  await createAccount.getByLabel("Thesis access").selectOption(role);
  await createAccount.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created.", { exact: true })).toBeVisible();
}

async function createThesis(page: Page, studentName: string): Promise<string> {
  await page.goto("/students/new");
  await page.getByLabel("Name", { exact: true }).fill(studentName);
  await page.getByRole("button", { name: "Add student" }).click();
  await expect(page).toHaveURL(/\?selected=\d+/);
  return new URL(page.url()).searchParams.get("selected")!;
}

async function addAdvisor(page: Page, studentId: string, advisorName: string) {
  await page.goto(`/access?studentId=${studentId}`);
  await page.getByLabel("Advisor to add").selectOption({ label: advisorName });
  await page.getByRole("button", { name: "Add advisor", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove ${advisorName}`, exact: true })).toBeVisible();
}

test("a read-only advisor changes their username and signs back in with the same thesis access", async ({ page, browser, baseURL }) => {
  const suffix = randomUUID().slice(0, 8);
  const oldName = `Reader ${suffix}`;
  const newName = `Renamed reader ${suffix}`;
  const student = `Assigned thesis ${suffix}`;
  const password = `reader-login-test-${suffix}`;
  await signIn(page, "Advisor", "e2e-password-long");
  await createAdvisor(page, oldName, password, "readonly");
  const studentId = await createThesis(page, student);
  await addAdvisor(page, studentId, oldName);

  const reader = await browser.newPage({ baseURL });
  try {
    await signIn(reader, oldName, password);
    await reader.locator("summary", { hasText: "More" }).click();
    await reader.getByRole("link", { name: "My account" }).click();
    await expect(reader.getByLabel("Username")).toHaveValue(oldName);
    await reader.getByLabel("Username").fill(newName);
    await reader.getByRole("button", { name: "Save username" }).click();
    await expect(reader.getByRole("status")).toHaveText("Username updated.");
    await expect(reader.getByLabel("Username")).toHaveValue(newName);
    await page.reload();
    await expect(page.getByRole("button", { name: `Remove ${newName}`, exact: true })).toBeVisible();

    await reader.getByRole("button", { name: "Log out" }).click();
    await reader.getByLabel("Name", { exact: true }).fill(oldName);
    await reader.getByLabel("Password", { exact: true }).fill(password);
    await reader.getByRole("button", { name: "Sign in" }).click();
    await expect(reader.getByRole("alert")).toHaveText("Invalid name or password. Please try again.");
    await signIn(reader, newName, password);
    await expect(reader.locator("[data-student-row]")).toHaveCount(1);
    await reader.locator("[data-student-row]", { hasText: student }).click();
    await expect(reader.locator("#selectedStudentPanel")).toContainText("Read-only");
  } finally {
    await reader.close();
  }
});

test("a supervisor grants and withdraws thesis access from a signed-in advisor", async ({ page, browser, baseURL }) => {
  const suffix = randomUUID().slice(0, 8);
  const advisorName = `Team advisor ${suffix}`;
  const studentName = `Team student ${suffix}`;
  const password = `team-access-test-${suffix}`;
  await signIn(page, "Advisor", "e2e-password-long");
  await createAdvisor(page, advisorName, password);

  const advisor = await browser.newPage({ baseURL });
  try {
    await signIn(advisor, advisorName, password);
    await expect(advisor.locator("[data-student-row]")).toHaveCount(0);
    expect((await advisor.request.get("/actions/export-json")).status()).toBe(403);

    const studentId = await createThesis(page, studentName);
    const panelPath = `/partials/student/${studentId}`;
    expect((await advisor.request.get(panelPath)).status()).toBe(404);

    await addAdvisor(page, studentId, advisorName);
    const removeAdvisor = page.getByRole("button", { name: `Remove ${advisorName}`, exact: true });
    await advisor.reload();
    await expect(advisor.locator("[data-student-row]")).toHaveCount(1);
    await advisor.locator("[data-student-row]", { hasText: studentName }).click();
    const panel = advisor.locator("#selectedStudentPanel");
    await panel.locator("summary", { hasText: "Edit details" }).click();
    const newTopic = `Advisor topic ${suffix}`;
    await panel.getByLabel("Thesis topic (optional)").fill(newTopic);
    await panel.getByRole("button", { name: "Save student updates" }).click();
    await expect(advisor.locator("[data-dashboard-toast]")).toContainText("Student updated");
    expect(await (await page.request.get(panelPath)).text()).toContain(newTopic);

    await removeAdvisor.click();
    await expect(removeAdvisor).toHaveCount(0);
    expect((await advisor.request.get(panelPath)).status()).toBe(404);
    await advisor.reload();
    await expect(advisor.locator("[data-student-row]")).toHaveCount(0);
    await expect(advisor.locator("#dashboardWorkspace")).not.toContainText(studentName);
  } finally {
    await advisor.close();
  }
});

test("an administrator can delete a disabled advisor and replace their login without transferring access", async ({
  page,
  browser,
  baseURL,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const name = `Departing advisor ${suffix}`;
  const student = `Retained thesis ${suffix}`;
  const password = `previous-account-${suffix}`;
  const replacementPassword = `replacement-account-${suffix}`;
  await signIn(page, "Advisor", "e2e-password-long");
  await createAdvisor(page, name, password);
  const studentId = await createThesis(page, student);
  await addAdvisor(page, studentId, name);
  const advisor = await browser.newPage({ baseURL });
  try {
    await signIn(advisor, name, password);
    await expect(advisor.locator("[data-student-row]", { hasText: student })).toBeVisible();

    const activeAccount = page.locator("details", { has: page.getByText(`${name} · Advisor`, { exact: true }) });
    await activeAccount.locator(":scope > summary").click();
    await activeAccount.locator("summary", { hasText: /^Disable account$/ }).click();
    await activeAccount.getByRole("button", { name: "Disable account" }).click();
    const disabledAccount = page.locator("details", { has: page.getByText(`${name} · Disabled`, { exact: true }) });
    await disabledAccount.locator(":scope > summary").click();
    await disabledAccount.locator("summary", { hasText: /^Delete account$/ }).click();
    await disabledAccount.getByRole("button", { name: "Permanently delete account" }).click();
    await expect(page.getByText("Account permanently deleted.", { exact: true })).toBeVisible();
    await expect(disabledAccount).toHaveCount(0);

    await createAdvisor(page, name, replacementPassword);
    await advisor.reload();
    await expect(advisor).toHaveURL(/\/login$/);
    await advisor.getByLabel("Name", { exact: true }).fill(name);
    await advisor.getByLabel("Password", { exact: true }).fill(password);
    await advisor.getByRole("button", { name: "Sign in" }).click();
    await expect(advisor.getByText("Invalid name or password. Please try again.")).toBeVisible();

    await signIn(advisor, name, replacementPassword);
    await expect(advisor.locator("[data-student-row]")).toHaveCount(0);
    expect((await advisor.request.get(`/partials/student/${studentId}`)).status()).toBe(404);
    await addAdvisor(page, studentId, name);
    await advisor.reload();
    await expect(advisor.locator("[data-student-row]", { hasText: student })).toBeVisible();
  } finally {
    await advisor.close();
  }
});
