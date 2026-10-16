import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
  test("cycles system -> light -> dark and applies data-theme", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /^Theme:/ });
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await toggle.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  });
});
