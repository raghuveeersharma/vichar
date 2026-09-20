import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

// Set configuration before the app is imported. The production entry point
// validates these values; tests exercise the same routes with test-only values.
const ORIGIN = "http://frontend.test";
process.env.JWT_SECRET = "test-jwt-secret-that-is-long-enough";
process.env.CORS_ORIGIN = ORIGIN;
process.env.NODE_ENV = "test";

const [
  { default: app },
  { default: Note },
  { sanitizeRichText },
  { createHealthRouter },
] =
  await Promise.all([
    import("../src/app.js"),
    import("../src/modals/note.modal.js"),
    import("../src/libs/richText.js"),
    import("../src/routes/healthRoutes.js"),
  ]);

const NOTE_CONTENT_LIMIT = 128 * 1024;

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function signupAgent({
  name = "Test User",
  email,
  password = "correct horse battery staple",
} = {}) {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .send({ name, email, password });
  assert.equal(response.status, 201, response.body.message);
  return agent;
}

function notePayload(overrides = {}) {
  return {
    title: "A note",
    content: "<p>Hello</p>",
    ...overrides,
  };
}

test("unsafe requests require the configured Origin", async () => {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({
      name: "No Origin",
      email: "no-origin@example.test",
      password: "correct horse battery staple",
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.message, "Invalid request origin");
});

test("signup establishes a cookie-authenticated session", async () => {
  const agent = await signupAgent({ email: "session@example.test" });
  const response = await agent.get("/api/auth/me");

  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, "session@example.test");
  assert.equal(response.body.user.password, undefined);
});

test("login attempts are capped per account even across source IPs", async () => {
  const email = "login-account-limit@example.test";
  await signupAgent({ email });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", ORIGIN)
      .set("X-Forwarded-For", `198.51.100.${attempt}`)
      .send({ email, password: "wrong password" });
    assert.equal(response.status, 401);
  }

  const blocked = await request(app)
    .post("/api/auth/login")
    .set("Origin", ORIGIN)
    .set("X-Forwarded-For", "198.51.100.99")
    .send({ email, password: "wrong password" });

  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.message, "Too many login attempts, please try again later.");
});

test("login attempts are capped per source IP", async () => {
  const ip = "203.0.113.10";
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", ORIGIN)
      .set("X-Forwarded-For", ip)
      .send({
        email: `different-account-${attempt}@example.test`,
        password: "wrong password",
      });
    assert.equal(response.status, 401);
  }

  const blocked = await request(app)
    .post("/api/auth/login")
    .set("Origin", ORIGIN)
    .set("X-Forwarded-For", ip)
    .send({ email: "one-more@example.test", password: "wrong password" });

  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.message, "Too many login attempts, please try again later.");
});

test("note bodies are sanitised before storage and on update", async () => {
  const agent = await signupAgent({ email: "sanitize@example.test" });
  const malicious =
    '<p>Hello</p><img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">bad link</a><a href="https://example.test" target="_blank">safe link</a>';

  const created = await agent
    .post("/api/notes")
    .set("Origin", ORIGIN)
    .send(notePayload({ content: malicious }));

  assert.equal(created.status, 201, created.body.message);
  assert.match(created.body.note.content, /<p>Hello<\/p>/);
  assert.match(created.body.note.content, /<a>bad link<\/a>/);
  assert.match(created.body.note.content, /<a href="https:\/\/example\.test">safe link<\/a>/);
  assert.doesNotMatch(created.body.note.content, /script|img|onerror|onclick|javascript:|target=/i);

  const stored = await Note.findById(created.body.note._id).lean();
  assert.equal(stored.content, created.body.note.content);

  const updated = await agent
    .put(`/api/notes/${created.body.note._id}`)
    .set("Origin", ORIGIN)
    .send(notePayload({ content: '<h2 onclick="alert(1)">Updated</h2><iframe src="https://evil.test"></iframe>' }));

  assert.equal(updated.status, 200, updated.body.message);
  assert.equal(updated.body.note.content, "<h2>Updated</h2>");
});

test("HTML reduced to nothing by the policy cannot be saved", async () => {
  const agent = await signupAgent({ email: "empty-html@example.test" });
  const response = await agent
    .post("/api/notes")
    .set("Origin", ORIGIN)
    .send(notePayload({ content: "<script>alert(1)</script>" }));

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Note content is not allowed");
});

test("request validation rejects invalid types, oversized fields, and coercion", async () => {
  const oversizedName = await request(app)
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .send({
      name: "n".repeat(101),
      email: "long-name@example.test",
      password: "correct horse battery staple",
    });
  assert.equal(oversizedName.status, 400);
  assert.equal(oversizedName.body.message, "Name must be at most 100 characters");

  const invalidEmail = await request(app)
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .send({
      name: "Invalid email",
      email: ["not-an-email"],
      password: "correct horse battery staple",
    });
  assert.equal(invalidEmail.status, 400);
  assert.equal(invalidEmail.body.message, "Email must be text");

  const oversizedPassword = await request(app)
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .send({
      name: "Long password",
      email: "long-password@example.test",
      password: "p".repeat(73),
    });
  assert.equal(oversizedPassword.status, 400);
  assert.equal(oversizedPassword.body.message, "Password must be at most 72 bytes");

  const agent = await signupAgent({ email: "validation@example.test" });
  const oversizedTitle = await agent
    .post("/api/notes")
    .set("Origin", ORIGIN)
    .send(notePayload({ title: "t".repeat(201) }));
  assert.equal(oversizedTitle.status, 400);
  assert.equal(
    oversizedTitle.body.message,
    "Note title must be at most 200 characters"
  );

  const oversizedContent = await agent
    .post("/api/notes")
    .set("Origin", ORIGIN)
    .send(notePayload({ content: "x".repeat(NOTE_CONTENT_LIMIT + 1) }));
  assert.equal(oversizedContent.status, 413);
  assert.equal(oversizedContent.body.message, "Note content must be at most 128 KB");

  const invalidEncryptionFlag = await agent
    .post("/api/notes")
    .set("Origin", ORIGIN)
    .send(notePayload({ encrypted: "false" }));
  assert.equal(invalidEncryptionFlag.status, 400);
  assert.equal(invalidEncryptionFlag.body.message, "encrypted must be true or false");

  const oversizedFolder = await agent
    .post("/api/folders")
    .set("Origin", ORIGIN)
    .send({ name: "f".repeat(61) });
  assert.equal(oversizedFolder.status, 400);
  assert.equal(
    oversizedFolder.body.message,
    "Folder name must be at most 60 characters"
  );
});

test("malformed note ids and JSON request bodies return API errors", async () => {
  const agent = await signupAgent({ email: "bad-request@example.test" });
  const invalidId = await agent.get("/api/notes/not-a-mongo-id");
  assert.equal(invalidId.status, 404);
  assert.equal(invalidId.body.message, "Note not found");

  const malformedJson = await request(app)
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .set("Content-Type", "application/json")
    .send('{"name":');
  assert.equal(malformedJson.status, 400);
  assert.equal(malformedJson.body.message, "Request body must be valid JSON");

  const oversizedBody = await request(app)
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .send({ name: "x".repeat(256 * 1024) });
  assert.equal(oversizedBody.status, 413);
  assert.equal(oversizedBody.body.message, "Request body is too large");
});

test("the policy also removes unsafe HTML from AI responses", () => {
  const output = sanitizeRichText(
    '<p>Safe</p><svg onload="alert(1)"></svg><a href="data:text/html,boom">bad</a>'
  );

  assert.equal(output, "<p>Safe</p><a>bad</a>");
});

test("a user cannot read, update, or delete another user's note", async () => {
  const owner = await signupAgent({ email: "owner@example.test" });
  const other = await signupAgent({ email: "other@example.test" });
  const created = await owner
    .post("/api/notes")
    .set("Origin", ORIGIN)
    .send(notePayload());
  assert.equal(created.status, 201, created.body.message);

  const id = created.body.note._id;
  const read = await other.get(`/api/notes/${id}`);
  const update = await other
    .put(`/api/notes/${id}`)
    .set("Origin", ORIGIN)
    .send(notePayload({ title: "Attempted takeover" }));
  const remove = await other.delete(`/api/notes/${id}`).set("Origin", ORIGIN);

  assert.equal(read.status, 404);
  assert.equal(update.status, 404);
  assert.equal(remove.status, 404);

  const ownerRead = await owner.get(`/api/notes/${id}`);
  assert.equal(ownerRead.status, 200);
  assert.equal(ownerRead.body.title, "A note");
});

test("health and readiness probes distinguish a live process from a ready API", async () => {
  const health = await request(app).get("/health");
  const ready = await request(app).get("/ready");

  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: "ok" });
  assert.match(health.headers["x-request-id"], /^[0-9a-f-]{36}$/i);
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: "ready" });

  // Simulate a database outage without disturbing the shared test database.
  const unavailableApp = express();
  unavailableApp.use(
    createHealthRouter({
      databaseConnection: { readyState: mongoose.STATES.disconnected },
    })
  );

  const unavailable = await request(unavailableApp).get("/ready");
  const stillLive = await request(unavailableApp).get("/health");

  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, { status: "not_ready" });
  assert.equal(stillLive.status, 200);
  assert.deepEqual(stillLive.body, { status: "ok" });
});
