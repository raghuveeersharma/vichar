import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createConfiguration, runSmokeCheck } from "./deployment-smoke-check.mjs";

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("deployment smoke check covers a healthy cross-origin deployment", async (t) => {
  const frontend = await startServer((req, res) => {
    if (req.url === "/manifest.webmanifest") {
      res.writeHead(200, { "Content-Type": "application/manifest+json" });
      return res.end(JSON.stringify({ start_url: "/", display: "standalone", icons: [{ src: "/icon.png" }] }));
    }
    if (req.url === "/sw.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      return res.end("self.addEventListener('install', () => {});");
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end('<!doctype html><link rel="manifest" href="/manifest.webmanifest"><div id="root"></div>');
  });
  const api = await startServer((req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": frontend.url,
      "Access-Control-Allow-Credentials": "true",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, { ...cors, "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "content-type" });
      return res.end();
    }
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end('{"status":"ok"}');
    }
    if (req.url === "/ready") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end('{"status":"ready"}');
    }
    if (req.url === "/api/auth/login") {
      res.writeHead(200, { ...cors, "Set-Cookie": "token=session; HttpOnly; Secure; SameSite=None; Path=/" });
      return res.end('{"user":{}}');
    }
    if (req.url === "/api/auth/me") {
      res.writeHead(req.headers.cookie === "token=session" ? 200 : 401, cors);
      return res.end();
    }
    if (req.url === "/api/auth/logout") {
      res.writeHead(200, cors);
      return res.end();
    }
    res.writeHead(404);
    return res.end();
  });
  t.after(async () => Promise.all([frontend.close(), api.close()]));

  const configuration = createConfiguration({
    frontendUrl: frontend.url,
    apiUrl: `${api.url}/api`,
    email: "smoke@example.test",
    password: "not-logged",
    allowHttp: true,
  });
  const output = [];
  const results = await runSmokeCheck(configuration, { log: (line) => output.push(line) });

  assert.equal(results.length, 8);
  assert.ok(results.every((result) => result.ok));
  assert.ok(output.some((line) => line.includes("secure-cookie authentication")));
});
