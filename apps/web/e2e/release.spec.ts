import { expect, test } from "@playwright/test";

test("landing page exposes the self-custodial payment flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Pay from what you own/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a signed invoice" })).toHaveAttribute(
    "href",
    "/merchant",
  );
  await expect(page.getByText(/No custody/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Helpful intelligence. Zero signing authority." }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await expect(page.getByText("Built on Monad")).toHaveCount(1);
});

test("payer portal opens signed payment links without wallet access", async ({ page }) => {
  await page.goto("/pay");

  await expect(page.getByRole("heading", { name: "Open a payment request." })).toBeVisible();
  await expect(page.getByLabel("Payment link")).toBeVisible();
  await expect(page.getByText("No wallet access yet")).toBeVisible();
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

test("release pages remain usable without overflow on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile project only");
  for (const path of ["/", "/merchant", "/pay?invoice=not-a-signed-invoice"]) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${path} should not scroll horizontally`)
      .toBeLessThanOrEqual(dimensions.clientWidth);
  }

  await page.goto("/merchant");
  const touchTargets = await page.locator(".formCard button, .payNavLink, .headerWallet").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent?.trim(), width: rect.width, height: rect.height };
    }).filter((target) => target.width > 0 && target.height > 0),
  );
  for (const target of touchTargets) {
    expect(target.height, `${target.label} should be touch friendly`).toBeGreaterThanOrEqual(40);
    expect(target.width, `${target.label} should be touch friendly`).toBeGreaterThanOrEqual(40);
  }
});
