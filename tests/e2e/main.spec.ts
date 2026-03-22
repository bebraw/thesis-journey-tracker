import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = resolvePassword();

let createdStudentName = "";
let secondaryStudentName = "";
let updatedStudentName = "";

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "MSc Thesis Journey Tracker" }),
  ).toBeVisible();
}

function resolvePassword() {
  return (
    readEnvValue(
      resolve(process.cwd(), "tests/e2e/.env.e2e"),
      "APP_PASSWORD",
    ) ??
    readEnvValue(resolve(process.cwd(), ".dev.vars"), "APP_PASSWORD") ??
    "e2e-password"
  );
}

function readEnvValue(filePath: string, key: string) {
  try {
    const content = readFileSync(filePath, "utf8");
    const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

async function selectStudentFromTable(page: Page, studentName: string) {
  await page.locator("#studentSearch").fill(studentName);
  const partialResponse = page.waitForResponse((response) =>
    response.url().includes("/partials/student/"),
  );
  await page
    .locator("[data-student-row]", { hasText: studentName })
    .first()
    .click();
  await partialResponse;
  await expect(page.locator("#selectedStudentPanel")).toContainText(
    `Currently viewing: ${studentName}`,
  );
}

async function addStudent(
  page: Page,
  studentName: string,
  email: string,
  degreeType: "BSc" | "MSc" | "DSc" = "MSc",
  thesisTopic = "Test thesis topic",
) {
  await page.getByRole("link", { name: "Add student" }).click();
  await expect(page).toHaveURL(/\/students\/new$/);

  await page.getByLabel("Name").fill(studentName);
  await page.getByLabel("Email (optional)").fill(email);
  await page.getByLabel("Degree type").selectOption({ label: degreeType });
  await page.getByLabel("Thesis topic (optional)").fill(thesisTopic);
  await page.getByLabel("Start date").fill("2026-03-01");
  await page.getByRole("button", { name: "Add student" }).click();

  await expect(page).toHaveURL(/\/\?selected=/);
  await expect(page.locator("#selectedStudentPanel")).toContainText(
    `Currently viewing: ${studentName}`,
  );
}

test.describe("dashboard e2e", () => {
  test.describe.configure({ mode: "serial" });

  test("shows seeded test data only in the dedicated e2e environment", async ({
    page,
  }) => {
    await login(page);

    await page.getByRole("link", { name: "Style guide" }).click();
    await expect(page).toHaveURL(/\/style-guide$/);
    await expect(page.getByRole("heading", { name: "Buttons" })).toBeVisible();
    await page.getByRole("link", { name: "Dashboard" }).first().click();
    await expect(page).toHaveURL(/\/$/);

    await expect(
      page.locator("[data-student-row]", { hasText: "Mia Koskinen" }),
    ).toBeVisible();
    await expect(
      page.locator("[data-lane-student-card]", { hasText: "Noah Virtanen" }),
    ).toBeVisible();
  });

  test("can add a student and select from table and lanes without reload", async ({
    page,
  }) => {
    await login(page);

    const suffix = Date.now().toString();
    createdStudentName = `E2E Student ${suffix} A`;
    secondaryStudentName = `E2E Student ${suffix} B`;

    await addStudent(
      page,
      createdStudentName,
      `e2e-a-${suffix}@example.edu`,
      "BSc",
      `Topic ${suffix} A`,
    );
    await addStudent(
      page,
      secondaryStudentName,
      `e2e-b-${suffix}@example.edu`,
      "DSc",
      `Topic ${suffix} B`,
    );

    await selectStudentFromTable(page, createdStudentName);
    await expect(
      page.locator("[data-student-row]", { hasText: createdStudentName }),
    ).toContainText("BSc");
    await expect(
      page.locator("[data-student-row]", { hasText: createdStudentName }),
    ).toContainText(`Topic ${suffix} A`);
    await page.locator("#studentSearch").fill("");

    await page.locator("#degreeFilter").selectOption({ label: "DSc" });
    await expect(
      page.locator("[data-student-row]", { hasText: secondaryStudentName }),
    ).toHaveCount(1);
    await expect(
      page.locator("[data-student-row]", { hasText: createdStudentName }),
    ).toBeHidden();
    await page.locator("#degreeFilter").selectOption({
      label: "All degree types",
    });

    const lanePartialResponse = page.waitForResponse((response) =>
      response.url().includes("/partials/student/"),
    );
    await page
      .locator("[data-lane-student-card]", { hasText: secondaryStudentName })
      .first()
      .click();
    await lanePartialResponse;

    await expect(page.locator("#selectedStudentPanel")).toContainText(
      `Currently viewing: ${secondaryStudentName}`,
    );
    await expect(page).toHaveURL(/\/\?selected=/);
  });

  test("can update a student and add a meeting log", async ({ page }) => {
    await login(page);

    await selectStudentFromTable(page, createdStudentName);

    const suffix = Date.now().toString();
    updatedStudentName = `${createdStudentName} Updated`;
    const updatedEmail = `updated-${suffix}@example.edu`;
    const updatedTopic = `Updated thesis topic ${suffix}`;
    const discussedText = `Discussed milestone ${suffix}`;
    const agreedPlanText = `Agreed action plan ${suffix}`;

    await page
      .locator("#selectedStudentPanel")
      .locator("summary", { hasText: "Additional student details" })
      .click();
    await page
      .locator("#selectedStudentPanel")
      .getByLabel("Name")
      .fill(updatedStudentName);
    await page
      .locator("#selectedStudentPanel")
      .getByLabel("Email")
      .fill(updatedEmail);
    await page
      .locator("#selectedStudentPanel")
      .getByLabel("Degree type")
      .selectOption({ label: "MSc" });
    await page
      .locator("#selectedStudentPanel")
      .getByLabel("Thesis topic (optional)")
      .fill(updatedTopic);
    await page
      .locator("#selectedStudentPanel")
      .getByRole("button", { name: "Save student updates" })
      .click();

    await expect(page).toHaveURL(/notice=Student\+updated/);
    await expect(
      page.locator("#selectedStudentPanel").getByLabel("Name"),
    ).toHaveValue(updatedStudentName);
    await expect(
      page.locator("#selectedStudentPanel").getByLabel("Email"),
    ).toHaveValue(updatedEmail);
    await expect(
      page.locator("#selectedStudentPanel").getByLabel("Degree type"),
    ).toHaveValue("msc");
    await expect(
      page
        .locator("#selectedStudentPanel")
        .getByLabel("Thesis topic (optional)"),
    ).toHaveValue(updatedTopic);

    await page
      .locator("#selectedStudentPanel")
      .locator("summary", { hasText: "Add Log Entry" })
      .click();
    await page
      .locator("#selectedStudentPanel")
      .getByLabel("What was discussed")
      .fill(discussedText);
    await page
      .locator("#selectedStudentPanel")
      .getByLabel("Agreed plan / next actions")
      .fill(agreedPlanText);
    await page
      .locator("#selectedStudentPanel")
      .getByRole("button", { name: "Save log entry" })
      .click();

    await expect(page).toHaveURL(/notice=Log\+saved/);
    await page
      .locator("#selectedStudentPanel")
      .locator("summary", { hasText: "Meeting Log History" })
      .click();
    await expect(page.locator("#selectedStudentPanel")).toContainText(
      discussedText,
    );
    await expect(page.locator("#selectedStudentPanel")).toContainText(
      agreedPlanText,
    );
  });

  test("can delete a student after confirmation", async ({ page }) => {
    await login(page);

    await selectStudentFromTable(page, secondaryStudentName);

    await page
      .locator("#selectedStudentPanel")
      .locator("summary", { hasText: "Delete Student" })
      .click();

    const dialogPromise = page.waitForEvent("dialog");
    await page
      .locator("#selectedStudentPanel")
      .locator("form[action^='/actions/delete-student/']")
      .evaluate((form: HTMLFormElement) => {
        window.setTimeout(() => {
          form.requestSubmit();
        }, 0);
      });

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain(`Delete ${secondaryStudentName}?`);
    await dialog.accept();

    await expect(page).toHaveURL(/\/$/);
    await page.locator("#studentSearch").fill(secondaryStudentName);
    await expect(
      page.locator("[data-student-row]", { hasText: secondaryStudentName }),
    ).toHaveCount(0);
    await expect(page.locator("#selectedStudentPanel")).toContainText(
      "Select a student from the table to edit details and view/add supervision logs.",
    );
  });
});
