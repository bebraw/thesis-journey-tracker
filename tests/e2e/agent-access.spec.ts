import { expect, test } from "@playwright/test";

test("creates an MCP connection from the UI and revokes it", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Name").fill("Advisor");
  await page.getByLabel("Password").fill("e2e-password-long");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator("summary", { hasText: "More" }).click();
  await page.getByRole("link", { name: "Agent access" }).click();
  await page.getByLabel("Token name").fill("Browser test Codex");
  await page.getByRole("button", { name: "Create token and show setup" }).click();
  const config = await page.getByLabel("Codex configuration — select and copy").inputValue();
  expect(config).toContain("mcp_servers.thesis_tracker");
  const secret = config.match(/Bearer (tjt_[a-f0-9]{64})/)![1]!;
  const rpc = () =>
    page.request.post("/mcp", {
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json, text/event-stream" },
      data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
  expect((await (await rpc()).json()).result.tools.map((tool: { name: string }) => tool.name)).toContain("set_meeting_schedule");
  await page.getByRole("link", { name: "Done — hide token" }).click();
  await expect(page.getByLabel("Codex configuration — select and copy")).toHaveCount(0);
  const row = page.locator("li", { hasText: "Browser test Codex" });
  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(row).toContainText("Revoked");
  expect((await rpc()).status()).toBe(401);
});
