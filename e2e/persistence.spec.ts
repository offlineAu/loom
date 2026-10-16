import { test, expect } from "@playwright/test";

test.describe("Local persistence (Phase 1B)", () => {
  test("creates a tracker anonymously and it survives a full page reload", async ({ page }) => {
    await page.goto("/trackers/debt");
    await expect(page.getByText("No Debt Tracker yet on this device")).toBeVisible();

    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Name").fill("My Credit Card Debt");
    await page.getByRole("button", { name: "Create" }).click();

    const item = page.getByRole("link", { name: /My Credit Card Debt/ });
    await expect(item).toBeVisible();

    // The real acceptance test: reload the page (a fresh navigation, not an
    // SPA transition) and confirm the tracker is still there — proving it
    // was actually persisted to IndexedDB, not just held in React state.
    await page.reload();
    await expect(page.getByRole("link", { name: /My Credit Card Debt/ })).toBeVisible();
    await expect(page.getByText("No Debt Tracker yet on this device")).toHaveCount(0);
  });

  test("supports multiple independent local trackers", async ({ page }) => {
    await page.goto("/trackers/debt");

    for (const name of ["Tracker A", "Tracker B", "Tracker C"]) {
      await page.getByRole("button", { name: "New" }).click();
      await page.getByLabel("Name").fill(name);
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }

    await page.reload();
    for (const name of ["Tracker A", "Tracker B", "Tracker C"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }
  });

  test("navigates into a created tracker's detail page and shows the honest platform-preview state", async ({
    page,
  }) => {
    await page.goto("/trackers/debt");
    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Name").fill("Detail Test Tracker");
    await page.getByRole("button", { name: "Create" }).click();

    await page.getByRole("link", { name: /Detail Test Tracker/ }).click();
    await expect(page).toHaveURL(/\/trackers\/debt\/[0-9A-Za-z]+$/);
    await expect(page.getByRole("heading", { name: "Detail Test Tracker" })).toBeVisible();
    await expect(page.getByText("Balances and payments arrive in Phase 2")).toBeVisible();
    await expect(page.getByText("Owned on this device")).toBeVisible();
  });

  test("archives and restores a tracker, and only offers permanent delete once archived", async ({ page }) => {
    await page.goto("/trackers/debt");
    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Name").fill("Archive Test Tracker");
    await page.getByRole("button", { name: "Create" }).click();

    await page.getByRole("link", { name: /Archive Test Tracker/ }).click();
    await expect(page.getByRole("button", { name: "Delete permanently" })).toHaveCount(0);

    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete permanently" })).toBeVisible();

    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("button", { name: "Delete permanently" })).toHaveCount(0);
  });

  test("permanently deletes an archived tracker and it no longer appears after reload", async ({ page }) => {
    await page.goto("/trackers/debt");
    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Name").fill("Delete Test Tracker");
    await page.getByRole("button", { name: "Create" }).click();

    await page.getByRole("link", { name: /Delete Test Tracker/ }).click();
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete permanently" }).click();

    await expect(page).toHaveURL(/\/trackers\/debt$/);
    await page.reload();
    await expect(page.getByText("Delete Test Tracker")).toHaveCount(0);
  });

  test("shows a not-found state for a tracker id that does not exist", async ({ page }) => {
    await page.goto("/trackers/debt/01ARZ3NDEKTSV4RRFFQ69G5FAV");
    await expect(page.getByText("Tracker not found")).toBeVisible();
  });
});
