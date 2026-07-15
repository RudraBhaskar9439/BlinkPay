import { expect, test } from "@playwright/test";

test("landing page exposes the self-custodial payment flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Pay from what you own/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a signed invoice" })).toHaveAttribute(
    "href",
    "/merchant",
  );
  await expect(page.getByText("No custody. No server-side invoice database.")).toBeVisible();
});

test("merchant form fails safely when no injected wallet exists", async ({ page }) => {
  await page.goto("/merchant");

  await expect(page.getByRole("heading", { name: "Request an exact USDC payment." }))
    .toBeVisible();
  await page.getByRole("button", { name: "Connect merchant wallet" }).click();
  await expect(page.getByRole("status")).toContainText("No injected wallet found");
  await expect(page.getByText("Your signed invoice will appear here.")).toBeVisible();
});

test("malformed payment links never render executable controls", async ({ page }) => {
  await page.goto("/pay?invoice=not-a-signed-invoice");

  await expect(page.getByRole("heading", { name: "This payment link is invalid." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create a new invoice" })).toBeVisible();
});

test("release pages do not overflow a mobile viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile project only");
  await page.goto("/merchant");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
