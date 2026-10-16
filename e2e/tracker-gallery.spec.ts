import { test, expect } from "@playwright/test";

test.describe("Tracker gallery navigation", () => {
  test("navigates from the gallery into the Debt Tracker entry point", async ({ page }) => {
    await page.goto("/trackers");
    await expect(page.getByRole("heading", { name: "Trackers" })).toBeVisible();

    await page.getByRole("link", { name: /Debt Tracker/ }).click();
    await expect(page).toHaveURL(/\/trackers\/debt$/);
    await expect(page.getByRole("heading", { name: "Debt Tracker", exact: true })).toBeVisible();
    await expect(page.getByText("No Debt Tracker yet on this device")).toBeVisible();
  });

  test("filters the gallery by category", async ({ page }) => {
    await page.goto("/trackers");
    await page.getByRole("tab", { name: "Business" }).click();
    await expect(page.getByRole("heading", { name: "Business", level: 2 })).toBeVisible();
    // The page's own subtitle mentions "Debt Tracker" in prose, and the header's
    // CTA always links to it too, so scope to the gallery grid within main and
    // assert on the card link itself rather than on that substring.
    await expect(page.getByRole("main").locator('a[href="/trackers/debt"]')).toHaveCount(0);
  });

  test("coming-soon trackers are not clickable links", async ({ page }) => {
    await page.goto("/trackers");
    await expect(page.getByRole("link", { name: /Savings Tracker/ })).toHaveCount(0);
  });
});

test.describe("Mobile layout", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows the bottom navigation on a narrow viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" }).last()).toBeVisible();
  });
});
