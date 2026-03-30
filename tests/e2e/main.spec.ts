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
  await expect(page.getByRole("heading", { name: "Thesis Journey Tracker" })).toBeVisible();
}

async function selectStudentFromTable(page: Page, studentName: string) {
  await page.locator("#studentSearch").fill(studentName);
  const partialResponse = page.waitForResponse((response) => response.url().includes("/partials/student/"));
  await page.locator("[data-student-row]", { hasText: studentName }).first().click();
  await partialResponse;
  await expect.poll(() => new URL(page.url()).searchParams.get("selected")).not.toBeNull();
}

async function showStudentPanel(page: Page) {
  const panelShell = page.locator("#selectedStudentPanelShell");
  if (await panelShell.isVisible()) {
    return;
  }

  await page.getByRole("button", { name: /Show (details|editing|student workspace)/ }).click();
  await expect(panelShell).toBeVisible();
}

async function addStudent(
  page: Page,
  studentName: string,
  email: string,
  degreeType: "BSc" | "MSc" | "DSc" = "MSc",
  thesisTopic = "Test thesis topic",
  options?: { startDate?: string; studentNotes?: string },
) {
  await page.locator("#dashboardWorkspace").getByRole("link", { name: "Add student" }).click();
  await expect(page).toHaveURL(/\/students\/new$/);

  await page.getByLabel("Name").fill(studentName);
  await page.getByLabel("Email (optional)").fill(email);
  await page.getByLabel("Degree type").selectOption({ label: degreeType });
  await page.getByLabel("Thesis topic (optional)").fill(thesisTopic);
  if (options?.studentNotes !== undefined) {
    await page.getByLabel("Student notes (optional)").fill(options.studentNotes);
  }
  if (options?.startDate !== undefined) {
    await page.getByLabel("Start date (optional)").fill(options.startDate);
  } else {
    await page.getByLabel("Start date (optional)").fill("2026-03-01");
  }
  await page.getByRole("button", { name: "Add student" }).click();

  await expect(page).toHaveURL(/\/\?selected=/);
}

async function openMoreMenu(page: Page) {
  await page.locator("summary", { hasText: "More" }).click();
}

test.describe("dashboard e2e", () => {
  test.describe.configure({ mode: "serial" });

  test("shows seeded test data only in the dedicated e2e environment", async ({ page }) => {
    await login(page);

    await openMoreMenu(page);
    await page.getByRole("link", { name: "Style guide" }).click();
    await expect(page).toHaveURL(/\/style-guide$/);
    await expect(page.getByRole("heading", { name: "Buttons" })).toBeVisible();
    await page.getByRole("link", { name: "Dashboard" }).first().click();
    await expect(page).toHaveURL(/\/$/);

    await expect(page.locator("#selectedStudentPanelShell")).toBeHidden();
    await expect(page.locator("[data-student-row]", { hasText: "Mia Koskinen" })).toBeVisible();
    await page.getByRole("button", { name: "Phases" }).click();
    await expect(page.locator("[data-lane-student-card]", { hasText: "Noah Virtanen" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("phases");
    await page.getByRole("button", { name: "List" }).click();

    const studentSortHeader = page.getByRole("button", { name: "Student" });
    await studentSortHeader.click();
    await expect(page.locator("[data-student-row]").first()).toContainText("Aino Lehtinen");
    await studentSortHeader.click();
    await expect(page.locator("[data-student-row]").first()).toContainText("Noah Virtanen");
  });

  test("can export and import JSON backups from data tools", async ({ page }) => {
    await login(page);

    await openMoreMenu(page);
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

    await page.getByRole("button", { name: "Phases" }).click();
    const lanePartialResponse = page.waitForResponse((response) => response.url().includes("/partials/student/"));
    await page.locator("[data-lane-student-card]", { hasText: secondaryStudentName }).first().click();
    await lanePartialResponse;

    await expect(page.locator("#selectedStudentPanelShell")).toBeVisible();
    await expect(page.locator("#selectedStudentPanel")).toContainText(`Currently viewing: ${secondaryStudentName}`);
    await expect.poll(() => new URL(page.url()).searchParams.get("selected")).not.toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("phases");

    const laneLogSuffix = Date.now().toString();
    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Add Log Entry" }).click();
    await page.locator("#selectedStudentPanel").getByLabel("What was discussed").fill(`Lane discussion ${laneLogSuffix}`);
    await page.locator("#selectedStudentPanel").getByLabel("Agreed plan / next actions").fill(`Lane plan ${laneLogSuffix}`);
    await page.evaluate(() => {
      (window as Window & { __laneLogNoReloadMarker?: number }).__laneLogNoReloadMarker = 1;
    });
    await page.locator("#selectedStudentPanel").getByRole("button", { name: "Save log entry" }).click();

    await expect(page.locator("[data-dashboard-toast='1']")).toContainText("Log saved");
    await expect.poll(() => new URL(page.url()).searchParams.get("notice")).toBeNull();
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __laneLogNoReloadMarker?: number }).__laneLogNoReloadMarker ?? 0))
      .toBe(1);
  });

  test("persists dashboard filters in the URL across reloads and selection", async ({ page }) => {
    await login(page);

    await page.locator("#studentSearch").fill(secondaryStudentName);
    await page.locator("#degreeFilter").selectOption("dsc");

    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe(secondaryStudentName);
    await expect.poll(() => new URL(page.url()).searchParams.get("degree")).toBe("dsc");
    await expect(page.locator("[data-student-row]", { hasText: secondaryStudentName })).toBeVisible();
    await expect(page.locator("[data-student-row]", { hasText: createdStudentName })).toBeHidden();

    await page.reload();

    await expect(page.locator("#studentSearch")).toHaveValue(secondaryStudentName);
    await expect(page.locator("#degreeFilter")).toHaveValue("dsc");
    await expect(page.locator("[data-student-row]", { hasText: secondaryStudentName })).toBeVisible();
    await expect(page.locator("[data-student-row]", { hasText: createdStudentName })).toBeHidden();

    const partialResponse = page.waitForResponse((response) => response.url().includes("/partials/student/"));
    await page.locator("[data-student-row]", { hasText: secondaryStudentName }).first().click();
    await partialResponse;

    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe(secondaryStudentName);
    await expect.poll(() => new URL(page.url()).searchParams.get("degree")).toBe("dsc");
    await expect.poll(() => new URL(page.url()).searchParams.get("selected")).not.toBeNull();
  });

  test("can clear the current student selection", async ({ page }) => {
    await login(page);

    await selectStudentFromTable(page, "Mia Koskinen");
    await expect(page.locator("#selectedStudentPanelShell")).toBeVisible();
    await expect(page.locator("#dashboardWorkspace").getByRole("button", { name: "Clear selection" })).toBeVisible();

    await page.locator("#dashboardWorkspace").getByRole("button", { name: "Clear selection" }).click();

    await expect.poll(() => new URL(page.url()).searchParams.get("selected")).toBeNull();
    await expect(page.locator("#selectedStudentPanelShell")).toBeHidden();
    await expect(page.locator("#dashboardWorkspace").getByRole("button", { name: "Clear selection" })).toBeHidden();
  });

  test("can close the student workspace without clearing selection", async ({ page }) => {
    await login(page);

    await selectStudentFromTable(page, "Mia Koskinen");
    await expect(page.locator("#selectedStudentPanelShell")).toBeVisible();

    const selectedId = new URL(page.url()).searchParams.get("selected");
    await page.locator("#selectedStudentPanel").getByRole("button", { name: "Close" }).click();

    await expect(page.locator("#selectedStudentPanelShell")).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.get("selected")).toBe(selectedId);
    await expect(page.locator("[data-student-row][aria-selected='true']")).toContainText("Mia Koskinen");
  });

  test("updates filter query params from click-driven filter interactions", async ({ page }) => {
    await login(page);

    const degreeFilter = page.locator("#degreeFilter");
    await degreeFilter.click();
    await degreeFilter.selectOption("bsc");
    await expect.poll(() => new URL(page.url()).searchParams.get("degree")).toBe("bsc");

    const phaseFilter = page.locator("#phaseFilter");
    await phaseFilter.click();
    await phaseFilter.selectOption("research_plan");
    await expect.poll(() => new URL(page.url()).searchParams.get("phase")).toBe("research_plan");

    const statusFilter = page.locator("#statusFilter");
    await statusFilter.click();
    await statusFilter.selectOption("not_booked");
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("not_booked");

    const searchInput = page.locator("#studentSearch");
    await searchInput.click();
    await searchInput.fill(secondaryStudentName);
    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe(secondaryStudentName);
    await expect(page.locator("#activeDashboardFilters")).toContainText(`Search: "${secondaryStudentName}"`);
    await expect(page.locator("#activeDashboardFilters")).toContainText("Degree: BSc");
    await expect(page.locator("#activeDashboardFilters")).toContainText("Phase: Planning research");
    await expect(page.locator("#activeDashboardFilters")).toContainText("Status: Not booked");

    await page.getByRole("button", { name: "Clear filters" }).click();

    await expect.poll(() => new URL(page.url()).searchParams.get("degree")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("phase")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBeNull();
    await expect(page.locator("#activeDashboardFilters")).toBeHidden();
  });

  test("auto-updates the schedule when choosing a student", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: "Schedule", exact: true }).click();
    await expect(page).toHaveURL(/\/schedule$/);

    await page.getByLabel("Student").selectOption({ index: 1 });

    await expect.poll(() => new URL(page.url()).searchParams.get("student")).not.toBeNull();
  });

  test("persists table sorting in the URL across reloads and selection", async ({ page }) => {
    await login(page);

    const studentSortHeader = page.getByRole("button", { name: "Student" });
    await studentSortHeader.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("student");
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("asc");

    await studentSortHeader.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("student");
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("desc");

    const firstRowBeforeReload = (await page.locator("[data-student-row]").first().textContent()) || "";

    await page.reload();

    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("student");
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("desc");
    await expect(page.locator("[data-student-row]").first()).toContainText(firstRowBeforeReload.trim());

    const partialResponse = page.waitForResponse((response) => response.url().includes("/partials/student/"));
    await page.locator("[data-student-row]").first().click();
    await partialResponse;

    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("student");
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("desc");
    await expect.poll(() => new URL(page.url()).searchParams.get("selected")).not.toBeNull();
  });

  test("shows no derived target date when adding a student without a start date", async ({ page }) => {
    await login(page);

    const suffix = Date.now().toString();
    const noStartDateStudentName = `No Start Date ${suffix}`;

    await addStudent(page, noStartDateStudentName, `nostart-${suffix}@example.edu`, "MSc", `Topic ${suffix}`, {
      startDate: "",
    });

    await showStudentPanel(page);
    await expect(page.locator("#selectedStudentPanel")).toContainText(`Currently viewing: ${noStartDateStudentName}`);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Start date (optional)")).toHaveValue("");
    await expect(page.locator("[data-student-row]", { hasText: noStartDateStudentName })).toContainText("Not set");
  });

  test("can update a student and add a meeting log", async ({ page }) => {
    await login(page);

    const studentSortHeader = page.getByRole("button", { name: "Student" });
    await studentSortHeader.click();
    await studentSortHeader.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("student");
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("desc");

    await selectStudentFromTable(page, createdStudentName);
    await showStudentPanel(page);
    await page.locator("#statusFilter").selectOption("not_booked");
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("not_booked");

    const suffix = Date.now().toString();
    updatedStudentName = `${createdStudentName} Updated`;
    const updatedEmail = `updated-${suffix}@example.edu`;
    const updatedTopic = `Updated thesis topic ${suffix}`;
    const updatedNotes = `Updated student note ${suffix}`;
    const finalPhaseTransitionText = "Editing -> Submitted";
    const discussedText = `Discussed milestone ${suffix}`;
    const agreedPlanText = `Agreed action plan ${suffix}`;

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Edit Student" }).click();
    await page.locator("#selectedStudentPanel").getByLabel("Name").fill(updatedStudentName);
    await page.locator("#selectedStudentPanel").getByLabel("Email").fill(updatedEmail);
    await page.locator("#selectedStudentPanel").getByLabel("Degree type").selectOption({ label: "MSc" });
    await page.locator("#selectedStudentPanel").getByLabel("Phase").selectOption({ label: "Editing" });
    await page.locator("#selectedStudentPanel").getByLabel("Thesis topic (optional)").fill(updatedTopic);
    await page.locator("#selectedStudentPanel").getByLabel("Student notes (optional)").fill(updatedNotes);
    await page.evaluate(() => {
      (window as Window & { __studentEditNoReloadMarker?: number }).__studentEditNoReloadMarker = 1;
    });
    await page.locator("#selectedStudentPanel").getByRole("button", { name: "Save student updates" }).click();

    await expect(page.locator("[data-dashboard-toast='1']")).toContainText("Student updated");
    await expect.poll(() => new URL(page.url()).searchParams.get("notice")).toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __studentEditNoReloadMarker?: number }).__studentEditNoReloadMarker ?? 0),
      )
      .toBe(1);
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("not_booked");
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("student");
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("desc");
    await showStudentPanel(page);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Name")).toHaveValue(updatedStudentName);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Email")).toHaveValue(updatedEmail);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Degree type")).toHaveValue("msc");
    await expect(page.locator("#selectedStudentPanel").getByLabel("Phase")).toHaveValue("editing");
    await expect(page.locator("#selectedStudentPanel").getByLabel("Thesis topic (optional)")).toHaveValue(updatedTopic);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Student notes (optional)")).toHaveValue(updatedNotes);
    await expect(page.locator("[data-student-row]", { hasText: updatedStudentName })).toContainText(updatedNotes);

    await page.locator("#studentSearch").fill(updatedNotes);
    await expect(page.locator("[data-student-row]", { hasText: updatedStudentName })).toHaveCount(1);
    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe(updatedNotes);
    await page.locator("#studentSearch").fill("");

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Add Log Entry" }).click();
    await page.locator("#selectedStudentPanel").getByLabel("What was discussed").fill(discussedText);
    await page.locator("#selectedStudentPanel").getByLabel("Agreed plan / next actions").fill(agreedPlanText);
    await page.evaluate(() => {
      (window as Window & { __studentLogNoReloadMarker?: number }).__studentLogNoReloadMarker = 1;
    });
    await page.locator("#selectedStudentPanel").getByRole("button", { name: "Save log entry" }).click();

    await expect(page.locator("[data-dashboard-toast='1']")).toContainText("Log saved");
    await expect.poll(() => new URL(page.url()).searchParams.get("notice")).toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __studentLogNoReloadMarker?: number }).__studentLogNoReloadMarker ?? 0),
      )
      .toBe(1);
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("not_booked");
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("student");
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("desc");
    await showStudentPanel(page);
    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Meeting Log History" }).click();
    await expect(page.locator("#selectedStudentPanel")).toContainText(discussedText);
    await expect(page.locator("#selectedStudentPanel")).toContainText(agreedPlanText);

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Phase Change Audit" }).click();
    await expect(page.locator("#selectedStudentPanel")).toContainText("Planning research -> Editing");

    const phaseField = page.locator("#selectedStudentPanel").getByLabel("Phase");
    if (!(await phaseField.isVisible())) {
      await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Edit Student" }).click();
    }
    await phaseField.selectOption({ label: "Submitted" });
    await page.evaluate(() => {
      (window as Window & { __studentEditNoReloadMarker?: number }).__studentEditNoReloadMarker = 2;
    });
    await page.locator("#selectedStudentPanel").getByRole("button", { name: "Save student updates" }).click();

    await expect(page.locator("[data-dashboard-toast='1']")).toContainText("Student updated");
    await expect.poll(() => new URL(page.url()).searchParams.get("notice")).toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __studentEditNoReloadMarker?: number }).__studentEditNoReloadMarker ?? 0),
      )
      .toBe(2);
    await showStudentPanel(page);
    await expect(page.locator("#selectedStudentPanel").getByLabel("Phase")).toHaveValue("submitted");
    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Phase Change Audit" }).click();
    await expect(page.locator("#selectedStudentPanel")).toContainText(finalPhaseTransitionText);
    await expect(page.locator("#selectedStudentPanel")).toContainText("Planning research -> Editing");
    const phaseAuditText = (await page.locator("#selectedStudentPanel").textContent()) || "";
    expect(phaseAuditText.indexOf(finalPhaseTransitionText)).toBeGreaterThan(-1);
    expect(phaseAuditText.indexOf("Planning research -> Editing")).toBeGreaterThan(-1);
    expect(phaseAuditText.indexOf(finalPhaseTransitionText)).toBeLessThan(phaseAuditText.indexOf("Planning research -> Editing"));
  });

  test("can archive a student after confirmation", async ({ page }) => {
    await login(page);

    await selectStudentFromTable(page, secondaryStudentName);
    await showStudentPanel(page);

    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Archive Student" }).click();

    const dialogPromise = page.waitForEvent("dialog");
    await page
      .locator("#selectedStudentPanel")
      .locator("form[action^='/actions/archive-student/']")
      .evaluate((form: HTMLFormElement) => {
        window.setTimeout(() => {
          form.requestSubmit();
        }, 0);
      });

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain(`Archive ${secondaryStudentName}?`);
    await dialog.accept();

    await expect(page.locator("[data-dashboard-toast='1']")).toContainText("Student archived");
    await expect.poll(() => new URL(page.url()).searchParams.get("notice")).toBeNull();
    await page.locator("#studentSearch").fill(secondaryStudentName);
    await expect(page.locator("[data-student-row]", { hasText: secondaryStudentName })).toHaveCount(0);
    await expect(page.locator("#selectedStudentPanel")).toContainText(
      "Select a student from the table to edit details and view/add supervision logs.",
    );
  });

  test("keeps add log entry date fields inside the editing panel on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);

    await selectStudentFromTable(page, updatedStudentName);
    await showStudentPanel(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Add Log Entry" }).click();

    const panel = page.locator("#selectedStudentPanel");
    const fieldLabels = ["Meeting date/time"];

    for (const label of fieldLabels) {
      const field = panel.getByLabel(label);
      await expect(field).toBeVisible();
      expect(await field.evaluate((input) => input.scrollWidth <= input.clientWidth + 1)).toBe(true);

      const [panelBox, fieldBox] = await Promise.all([panel.boundingBox(), field.boundingBox()]);
      expect(panelBox).not.toBeNull();
      expect(fieldBox).not.toBeNull();
      expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });
});
