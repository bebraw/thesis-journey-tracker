import { expect, test, type Page } from "@playwright/test";

const LOGIN_NAME = "Advisor";
const LOGIN_PASSWORD = "e2e-password";

let createdStudentName = "";
let secondaryStudentName = "";
let updatedStudentName = "";

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  const nameField = page.getByLabel("Name");
  if ((await nameField.count()) > 0) {
    await nameField.fill(LOGIN_NAME);
  }
  await page.getByLabel("Password").fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "MSc Thesis Journey Tracker" })).toBeVisible();
}

async function selectStudentFromTable(page: Page, studentName: string) {
  await page.locator("#studentSearch").fill(studentName);
  const partialResponse = page.waitForResponse((response) => response.url().includes("/partials/student/"));
  await page.locator("[data-student-row]", { hasText: studentName }).first().click();
  await partialResponse;
  await expect(page.locator("#selectedStudentPanel")).toContainText(`Currently viewing: ${studentName}`);
}

async function addStudent(
  page: Page,
  studentName: string,
  email: string,
  degreeType: "BSc" | "MSc" | "DSc" = "MSc",
  thesisTopic = "Test thesis topic",
  options?: { startDate?: string },
) {
  await page.getByRole("link", { name: "Add student" }).click();
  await expect(page).toHaveURL(/\/students\/new$/);

  await page.getByLabel("Name").fill(studentName);
  await page.getByLabel("Email (optional)").fill(email);
  await page.getByLabel("Degree type").selectOption({ label: degreeType });
  await page.getByLabel("Thesis topic (optional)").fill(thesisTopic);
  if (options?.startDate !== undefined) {
    await page.getByLabel("Start date (optional)").fill(options.startDate);
  } else {
    await page.getByLabel("Start date (optional)").fill("2026-03-01");
  }
  await page.getByRole("button", { name: "Add student" }).click();

  await expect(page).toHaveURL(/\/\?selected=/);
  await expect(page.locator("#selectedStudentPanel")).toContainText(`Currently viewing: ${studentName}`);
}

test.describe("dashboard e2e", () => {
  test.describe.configure({ mode: "serial" });

  test("shows seeded test data only in the dedicated e2e environment", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: "Style guide" }).click();
    await expect(page).toHaveURL(/\/style-guide$/);
    await expect(page.getByRole("heading", { name: "Buttons" })).toBeVisible();
    await page.getByRole("link", { name: "Dashboard" }).first().click();
    await expect(page).toHaveURL(/\/$/);

    await expect(page.locator("[data-student-row]", { hasText: "Mia Koskinen" })).toBeVisible();
    await expect(page.locator("[data-lane-student-card]", { hasText: "Noah Virtanen" })).toBeVisible();

    const studentSortHeader = page.getByRole("button", { name: "Student" });
    await studentSortHeader.click();
    await expect(page.locator("[data-student-row]").first()).toContainText("Aino Lehtinen");
    await studentSortHeader.click();
    await expect(page.locator("[data-student-row]").first()).toContainText("Noah Virtanen");
  });

  test("can export and import JSON backups from data tools", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: "Data tools" }).click();
    await expect(page).toHaveURL(/\/data-tools$/);
    await expect(page.getByRole("heading", { name: "Data Tools" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download JSON export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^thesis-journey-tracker-export-\d{4}-\d{2}-\d{2}\.json$/);

    const reportDownloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download email-ready report" }).click();
    const reportDownload = await reportDownloadPromise;
    expect(reportDownload.suggestedFilename()).toMatch(/^thesis-journey-status-report-\d{4}-\d{2}-\d{2}\.md$/);

    const suffix = Date.now().toString();
    const importedStudentName = `Imported Backup ${suffix}`;
    const importJson = JSON.stringify({
      app: "thesis-journey-tracker",
      schemaVersion: 1,
      exportedAt: "2026-03-23T08:00:00.000Z",
      students: [
        {
          name: importedStudentName,
          email: `imported-${suffix}@example.edu`,
          degreeType: "msc",
          thesisTopic: `Imported topic ${suffix}`,
          startDate: "2026-03-10",
          currentPhase: "research_plan",
          nextMeetingAt: null,
          logs: [
            {
              happenedAt: "2026-03-20T10:00:00.000Z",
              discussed: `Imported discussion ${suffix}`,
              agreedPlan: `Imported plan ${suffix}`,
              nextStepDeadline: "2026-03-30",
            },
          ],
        },
      ],
    });

    await page.getByLabel("JSON file").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(importJson, "utf8"),
    });
    await page.getByLabel("Import mode").selectOption("append");
    await page.getByRole("button", { name: "Import JSON file" }).click();

    await expect(page).toHaveURL(/\/data-tools\?notice=/);
    await expect(page.locator("body")).toContainText("Imported 1 students, 1 logs");

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.locator("#studentSearch").fill(importedStudentName);
    await expect(page.locator("[data-student-row]", { hasText: importedStudentName })).toHaveCount(1);
  });

  test("can add a student and select from table and lanes without reload", async ({ page }) => {
    await login(page);

    const suffix = Date.now().toString();
    createdStudentName = `E2E Student ${suffix} A`;
    secondaryStudentName = `E2E Student ${suffix} B`;

    await addStudent(page, createdStudentName, `e2e-a-${suffix}@example.edu`, "BSc", `Topic ${suffix} A`);
    await addStudent(page, secondaryStudentName, `e2e-b-${suffix}@example.edu`, "DSc", `Topic ${suffix} B`);

    await selectStudentFromTable(page, createdStudentName);
    await expect(page.locator("[data-student-row]", { hasText: createdStudentName })).toContainText("BSc");
    await expect(page.locator("[data-student-row]", { hasText: createdStudentName })).toContainText(`Topic ${suffix} A`);
    await page.locator("#studentSearch").fill("");

    await page.locator("#degreeFilter").selectOption({ label: "DSc" });
    await expect(page.locator("[data-student-row]", { hasText: secondaryStudentName })).toHaveCount(1);
    await expect(page.locator("[data-student-row]", { hasText: createdStudentName })).toBeHidden();
    await page.locator("#degreeFilter").selectOption({
      label: "All degree types",
    });

    const lanePartialResponse = page.waitForResponse((response) => response.url().includes("/partials/student/"));
    await page.locator("[data-lane-student-card]", { hasText: secondaryStudentName }).first().click();
    await lanePartialResponse;

    await expect(page.locator("#selectedStudentPanel")).toContainText(`Currently viewing: ${secondaryStudentName}`);
    await expect(page).toHaveURL(/\/\?selected=/);
  });

  test("shows no derived target date when adding a student without a start date", async ({ page }) => {
    await login(page);

    const suffix = Date.now().toString();
    const noStartDateStudentName = `No Start Date ${suffix}`;

    await addStudent(page, noStartDateStudentName, `nostart-${suffix}@example.edu`, "MSc", `Topic ${suffix}`, {
      startDate: "",
    });

    await expect(page.locator("#selectedStudentPanel")).toContainText(`Currently viewing: ${noStartDateStudentName}`);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Start date (optional)")).toHaveValue("");
    await expect(page.locator("[data-student-row]", { hasText: noStartDateStudentName })).toContainText("Not set");
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

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Additional student details" }).click();
    await page.locator("#selectedStudentPanel").getByLabel("Name").fill(updatedStudentName);
    await page.locator("#selectedStudentPanel").getByLabel("Email").fill(updatedEmail);
    await page.locator("#selectedStudentPanel").getByLabel("Degree type").selectOption({ label: "MSc" });
    await page.locator("#selectedStudentPanel").getByLabel("Phase").selectOption({ label: "Editing" });
    await page.locator("#selectedStudentPanel").getByLabel("Thesis topic (optional)").fill(updatedTopic);
    await page.locator("#selectedStudentPanel").getByRole("button", { name: "Save student updates" }).click();

    await expect(page).toHaveURL(/notice=Student\+updated/);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Name")).toHaveValue(updatedStudentName);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Email")).toHaveValue(updatedEmail);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Degree type")).toHaveValue("msc");
    await expect(page.locator("#selectedStudentPanel").getByLabel("Phase")).toHaveValue("editing");
    await expect(page.locator("#selectedStudentPanel").getByLabel("Thesis topic (optional)")).toHaveValue(updatedTopic);

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Add Log Entry" }).click();
    await page.locator("#selectedStudentPanel").getByLabel("What was discussed").fill(discussedText);
    await page.locator("#selectedStudentPanel").getByLabel("Agreed plan / next actions").fill(agreedPlanText);
    await page.locator("#selectedStudentPanel").getByRole("button", { name: "Save log entry" }).click();

    await expect(page).toHaveURL(/notice=Log\+saved/);
    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Meeting Log History" }).click();
    await expect(page.locator("#selectedStudentPanel")).toContainText(discussedText);
    await expect(page.locator("#selectedStudentPanel")).toContainText(agreedPlanText);

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Phase Change Audit" }).click();
    await expect(page.locator("#selectedStudentPanel")).toContainText("Planning research -> Editing");
  });

  test("can delete a student after confirmation", async ({ page }) => {
    await login(page);

    await selectStudentFromTable(page, secondaryStudentName);

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Delete Student" }).click();

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
    await expect(page.locator("[data-student-row]", { hasText: secondaryStudentName })).toHaveCount(0);
    await expect(page.locator("#selectedStudentPanel")).toContainText(
      "Select a student from the table to edit details and view/add supervision logs.",
    );
  });
});
