import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const USER = {
  _id: "u1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  encryptedNotesEnabled: true,
};
const NOTE = {
  _id: "n1",
  title: "Groceries",
  content: "<p>Milk and <strong>eggs</strong></p>",
  isEncrypted: false,
  folder: null,
  owner: "u1",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem("vichar:session", JSON.stringify(user));
  }, USER);
  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const json = (body) => route.fulfill({ json: body });
    if (pathname.endsWith("/auth/me")) return json({ user: USER });
    if (pathname.endsWith("/folders")) return json({ folders: [], unfiledCount: 1 });
    if (pathname.endsWith("/notes/n1")) return json(NOTE);
    if (pathname.endsWith("/notes")) return json([NOTE]);
    return route.fulfill({ status: 404, json: { message: "Not mocked" } });
  });
});

const html = (page) => page.locator("html");
const scan = (page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

test("defaults to forest when the OS prefers dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(html(page)).toHaveAttribute("data-theme", "forest");
});

test("system preference follows the OS, live", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveAttribute("data-theme", "forest");
});

test("navbar toggle switches theme and the choice survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "light");
});

test("settings picker sets and reflects the preference", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  const picker = page.getByRole("radiogroup", { name: "Theme" });
  await expect(picker.getByRole("radio", { name: "System" })).toBeChecked();
  await picker.getByRole("radio", { name: "Light" }).click();
  await expect(picker.getByRole("radio", { name: "Light" })).toBeChecked();
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  // An explicit choice stops following the OS.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveAttribute("data-theme", "light");
});

for (const [path, ready] of [
  ["/", (page) => page.getByRole("heading", { name: "Groceries" })],
  ["/settings", (page) => page.getByRole("radiogroup", { name: "Theme" })],
  ["/note/n1", (page) => page.locator(".tiptap")],
  ["/create", (page) => page.locator(".tiptap")],
]) {
  test(`${path} has no accessibility violations in the light theme`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vichar:theme", "light"));
    await page.goto(path);
    await expect(ready(page)).toBeVisible();
    await expect(html(page)).toHaveAttribute("data-theme", "light");
    expect((await scan(page)).violations).toEqual([]);
  });
}

test("login page has no accessibility violations in the light theme", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("vichar:session");
    localStorage.setItem("vichar:theme", "light");
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { message: "no" } })
  );
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});
