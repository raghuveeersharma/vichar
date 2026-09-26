import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// These routes do not need a live API to render their meaningful UI. Keeping
// the test public makes it deterministic in CI while still checking landmarks,
// labels, keyboard semantics, and contrast on the account journeys everybody
// must use before they can access notes.
for (const [path, heading] of [
  ["/login", "Welcome back"],
  ["/signup", "Create your account"],
  ["/forgot-password", "Reset your password"],
  ["/reset-password", "This link is invalid"],
  ["/verify-email", "This link is invalid"],
]) {
  test(`${path} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
