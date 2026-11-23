import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, name: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("a supervisor grants and withdraws thesis access from a signed-in advisor", async ({ page, browser, baseURL }) => {
  const suffix = randomUUID().slice(0, 8);
  const advisorName = `Team advisor ${suffix}`;
  const studentName = `Team student ${suffix}`;
  const password = `team-access-test-${suffix}`;
  await signIn(page, "Advisor", "e2e-password-long");
  await page.goto("/access");
  await page.getByText("Create an account", { exact: true }).click();
  const createAccount = page.getByRole("form", { name: "Create account" });
  await createAccount.getByLabel("Account name").fill(advisorName);
  await createAccount.getByLabel("Password", { exact: true }).fill(password);
  await createAccount.getByLabel("Thesis access").selectOption("editor");
  await createAccount.getByRole("button", { name: "Create account" }).click();

  const advisor = await browser.newPage({ baseURL });
  try {
    await signIn(advisor, advisorName, password);
    await expect(advisor.locator("[data-student-row]")).toHaveCount(0);
    expect((await advisor.request.get("/actions/export-json")).status()).toBe(403);

    await page.goto("/students/new");
    await page.getByLabel("Name", { exact: true }).fill(studentName);
    await page.getByRole("button", { name: "Add student" }).click();
    await expect(page).toHaveURL(/\?selected=\d+/);
    const studentId = new URL(page.url()).searchParams.get("selected");
    const teamPath = `/access?studentId=${studentId}`;
    const panelPath = `/partials/student/${studentId}`;
    expect((await advisor.request.get(panelPath)).status()).toBe(404);

    await page.goto(teamPath);
    await page.getByLabel("Advisor to add").selectOption({ label: advisorName });
    await page.getByRole("button", { name: "Add advisor", exact: true }).click();
    const removeAdvisor = page.getByRole("button", { name: `Remove ${advisorName}`, exact: true });
    await expect(removeAdvisor).toBeVisible();
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
