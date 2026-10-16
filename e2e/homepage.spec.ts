import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads and shows the primary call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Reusable trackers for money, business, and productivity."
    );
    await expect(page.getByRole("link", { name: "Start Debt Tracker" })).toBeVisible();
  });

  test("shows the tracker gallery with Debt Tracker available", async ({ page }) => {
    await page.goto("/");
    const debtCard = page.locator('a[href="/trackers/debt"]').filter({ hasText: "Available" });
    await expect(debtCard).toBeVisible();
  });

  test("does not require sign-in to view the homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sign in")).toHaveCount(0);
    await expect(page).toHaveURL("/");
  });
});
