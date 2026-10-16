import { test, expect } from "@playwright/test";

test.describe("Account page (Phase 1C)", () => {
  test("reports cloud accounts as unconfigured in an environment with no Supabase project linked, without crashing", async ({
    page,
  }) => {
    // This environment intentionally has no NEXT_PUBLIC_SUPABASE_URL/ANON_KEY
    // set — this is the real, honest state a fresh clone is in before
    // someone fills in .env.local, not a mocked scenario.
    await page.goto("/account");
    await expect(page.getByText("Cloud accounts aren't set up for this deployment")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  test("the account page never blocks or redirects an anonymous visitor", async ({ page }) => {
    const response = await page.goto("/account");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/account$/);
  });
});
