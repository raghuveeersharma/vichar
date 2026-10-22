import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Forest (dark) is pinned here; theme.spec.js covers the light theme.
test.use({ colorScheme: "dark" });

// Signed-in routes. The API is mocked at the network layer so the suite stays
// deterministic and needs no database; the session is seeded through the same
// localStorage mirror AuthProvider reads on boot.
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
  folder: "f1",
  folderName: "Home",
  owner: "u1",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};
const FOLDER = { _id: "f1", name: "Home", owner: "u1", noteCount: 1 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem("vichar:session", JSON.stringify(user));
  }, USER);

  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const json = (body) => route.fulfill({ json: body });
    if (pathname.endsWith("/auth/me")) return json({ user: USER });
    if (pathname.endsWith("/folders")) {
      return json({ folders: [FOLDER], unfiledCount: 0 });
    }
    if (pathname.endsWith("/notes/n1")) return json(NOTE);
    if (pathname.endsWith("/notes")) return json([NOTE]);
    return route.fulfill({ status: 404, json: { message: "Not mocked" } });
  });
});

const scan = (page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

test("home has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Groceries" })).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test("create page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/create");
  await expect(page.locator(".tiptap")).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test("note detail (editor) has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/note/n1");
  await expect(page.locator(".tiptap")).toContainText("Milk and eggs");
  expect((await scan(page)).violations).toEqual([]);
});

test("folder page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/folder/f1");
  await expect(page.getByRole("heading", { name: "Groceries" })).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test("settings has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading").first()).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test("open delete-confirmation dialog has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Delete note").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test("open new-folder dialog has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new folder/i }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});
