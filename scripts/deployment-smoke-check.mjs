#!/usr/bin/env node
/**
 * Verify the externally observable contracts that make a Vichar deployment
 * usable. This intentionally uses only Node's built-in fetch so it can run in
 * a deploy hook, a scheduled GitHub Actions workflow, or an operator shell.
 *
 * Credentials are optional for an operator's quick probe, but production CI
 * should supply both so secure-cookie authentication is exercised too.
 */

import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 15_000;

function usage() {
  console.log(`Usage: node scripts/deployment-smoke-check.mjs [options]

Options:
  --frontend-url URL  Public frontend URL (or VICHAR_FRONTEND_URL)
  --api-url URL       Public API origin, with or without /api (or VICHAR_API_URL)
  --email EMAIL       Dedicated smoke-test account (or VICHAR_SMOKE_EMAIL)
  --password VALUE    Smoke-test account password (or VICHAR_SMOKE_PASSWORD)
  --allow-http        Permit http:// URLs; only for local development
  --help              Show this help

The production check requires HTTPS URLs. It validates the PWA assets, SPA
deep-link fallback, API health/readiness, credentialed CORS, and, when email
and password are supplied, secure-cookie login, session rehydration, and
logout. Credentials are never printed.`);
}

function readOptions(argv, environment = process.env) {
  const options = {
    frontendUrl: environment.VICHAR_FRONTEND_URL,
    apiUrl: environment.VICHAR_API_URL,
    email: environment.VICHAR_SMOKE_EMAIL,
    password: environment.VICHAR_SMOKE_PASSWORD,
    allowHttp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--allow-http") {
      options.allowHttp = true;
      continue;
    }

    const key = {
      "--frontend-url": "frontendUrl",
      "--api-url": "apiUrl",
      "--email": "email",
      "--password": "password",
    }[argument];
    if (!key || index + 1 >= argv.length) {
      throw new Error(`Unknown option or missing value: ${argument}`);
    }
    options[key] = argv[index + 1];
    index += 1;
  }

  if (!options.frontendUrl || !options.apiUrl) {
    throw new Error("--frontend-url and --api-url are required");
  }
  if (Boolean(options.email) !== Boolean(options.password)) {
    throw new Error("Provide both --email and --password, or neither");
  }
  return options;
}

function deploymentUrl(value, label, { allowHttp }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (!allowHttp && url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS (use --allow-http only locally)`);
  }
  if (allowHttp && !["https:", "http:"].includes(url.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must not include credentials, a query, or a fragment`);
  }
  return url;
}

function createConfiguration(options) {
  const frontend = deploymentUrl(options.frontendUrl, "Frontend URL", options);
  const api = deploymentUrl(options.apiUrl, "API URL", options);
  const apiPath = api.pathname.replace(/\/+$/, "");
  if (apiPath && apiPath !== "/api") {
    throw new Error("API URL may be an origin or end in /api");
  }

  return {
    frontendOrigin: frontend.origin,
    frontendBase: new URL(`${frontend.pathname.replace(/\/$/, "") || ""}/`, frontend.origin),
    apiOrigin: api.origin,
    apiBase: new URL("/api/", api.origin),
    email: options.email,
    password: options.password,
  };
}

function endpoint(base, path) {
  return new URL(path.replace(/^\//, ""), base).toString();
}

function exactHeader(response, name, expected) {
  const actual = response.headers.get(name);
  if (actual !== expected) {
    throw new Error(`${name} was ${actual ?? "missing"}, expected ${expected}`);
  }
}

function includesToken(response, name, expected) {
  const actual = response.headers.get(name) ?? "";
  const tokens = actual.split(",").map((value) => value.trim().toLowerCase());
  if (!tokens.includes(expected.toLowerCase())) {
    throw new Error(`${name} did not include ${expected}`);
  }
}

function cookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const header = response.headers.get("set-cookie");
  return header ? [header] : [];
}

function sessionCookie(response) {
  const cookies = cookieHeaders(response);
  const cookie = cookies.find((value) => /^token=[^;]+/i.test(value));
  if (!cookie) throw new Error("Login response did not set the token cookie");
  for (const attribute of ["HttpOnly", "Secure", "SameSite=None"]) {
    if (!new RegExp(`(?:^|;)\\s*${attribute.replace("=", "\\s*=\\s*")}(?:;|$)`, "i").test(cookie)) {
      throw new Error(`Authentication cookie is missing ${attribute}`);
    }
  }
  return cookie.slice(0, cookie.indexOf(";"));
}

async function request(fetchImpl, url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { redirect: "manual", ...init, signal: controller.signal });
  } catch (error) {
    const message = error?.name === "AbortError" ? "timed out" : error.message;
    throw new Error(`${new URL(url).origin} request ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function expectJson(response, status, expected, label) {
  if (response.status !== status) throw new Error(`${label} returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${label} did not return JSON`);
  }
  const body = await response.json();
  for (const [key, value] of Object.entries(expected)) {
    if (body[key] !== value) throw new Error(`${label} returned an unexpected ${key}`);
  }
}

async function runCheck(name, action, results, log) {
  try {
    await action();
    results.push({ name, ok: true });
    log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    log(`FAIL  ${name}: ${error.message}`);
  }
}

function verifyPwaRegistration(frontendUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["front/scripts/verify-pwa-registration.mjs", frontendUrl], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`browser probe exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
    });
  });
}

export async function runSmokeCheck(
  configuration,
  { fetchImpl = fetch, log = console.log, verifyPwaInBrowser = false } = {}
) {
  const results = [];
  const frontend = endpoint(configuration.frontendBase, "/");
  const manifest = endpoint(configuration.frontendBase, "/manifest.webmanifest");
  const serviceWorker = endpoint(configuration.frontendBase, "/sw.js");

  await runCheck("frontend shell", async () => {
    const response = await request(fetchImpl, frontend);
    if (response.status !== 200) throw new Error(`returned HTTP ${response.status}`);
    const html = await response.text();
    if (!/id=["']root["']/.test(html)) throw new Error("does not contain the React root");
    if (!/rel=["']manifest["']/.test(html)) throw new Error("does not link a web manifest");
  }, results, log);

  await runCheck("frontend deep-link fallback", async () => {
    const response = await request(fetchImpl, endpoint(configuration.frontendBase, "/login"));
    if (response.status !== 200) throw new Error(`returned HTTP ${response.status}`);
    const html = await response.text();
    if (!/id=["']root["']/.test(html)) throw new Error("did not return the SPA shell");
  }, results, log);

  await runCheck("PWA manifest", async () => {
    const response = await request(fetchImpl, manifest);
    if (response.status !== 200) throw new Error(`returned HTTP ${response.status}`);
    const document = await response.json();
    if (document.display !== "standalone" || document.start_url !== "/" || !Array.isArray(document.icons) || !document.icons.length) {
      throw new Error("is missing required install metadata");
    }
  }, results, log);

  await runCheck("PWA service worker", async () => {
    const response = await request(fetchImpl, serviceWorker);
    if (response.status !== 200) throw new Error(`returned HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/(javascript|ecmascript)/i.test(contentType)) throw new Error("did not return JavaScript");
    if (!(await response.text()).trim()) throw new Error("script was empty");
  }, results, log);

  if (verifyPwaInBrowser) {
    await runCheck("PWA browser registration", () => verifyPwaRegistration(frontend), results, log);
  }

  await runCheck("API liveness", async () => {
    const response = await request(fetchImpl, endpoint(new URL("/", configuration.apiOrigin), "/health"));
    await expectJson(response, 200, { status: "ok" }, "health endpoint");
  }, results, log);

  await runCheck("API readiness", async () => {
    const response = await request(fetchImpl, endpoint(new URL("/", configuration.apiOrigin), "/ready"));
    await expectJson(response, 200, { status: "ready" }, "readiness endpoint");
  }, results, log);

  await runCheck("credentialed CORS preflight", async () => {
    const response = await request(fetchImpl, endpoint(configuration.apiBase, "/auth/login"), {
      method: "OPTIONS",
      headers: {
        Origin: configuration.frontendOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    if (![200, 204].includes(response.status)) throw new Error(`returned HTTP ${response.status}`);
    exactHeader(response, "access-control-allow-origin", configuration.frontendOrigin);
    exactHeader(response, "access-control-allow-credentials", "true");
    includesToken(response, "access-control-allow-methods", "POST");
    includesToken(response, "access-control-allow-headers", "content-type");
  }, results, log);

  if (configuration.email) {
    let cookie;
    await runCheck("secure-cookie authentication", async () => {
      const login = await request(fetchImpl, endpoint(configuration.apiBase, "/auth/login"), {
        method: "POST",
        headers: { Origin: configuration.frontendOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({ email: configuration.email, password: configuration.password }),
      });
      if (login.status !== 200) throw new Error(`login returned HTTP ${login.status}`);
      exactHeader(login, "access-control-allow-origin", configuration.frontendOrigin);
      exactHeader(login, "access-control-allow-credentials", "true");
      cookie = sessionCookie(login);

      const me = await request(fetchImpl, endpoint(configuration.apiBase, "/auth/me"), {
        headers: { Origin: configuration.frontendOrigin, Cookie: cookie },
      });
      if (me.status !== 200) throw new Error(`session rehydration returned HTTP ${me.status}`);
      exactHeader(me, "access-control-allow-origin", configuration.frontendOrigin);

      const logout = await request(fetchImpl, endpoint(configuration.apiBase, "/auth/logout"), {
        method: "POST",
        headers: { Origin: configuration.frontendOrigin, Cookie: cookie },
      });
      if (logout.status !== 200) throw new Error(`logout returned HTTP ${logout.status}`);
    }, results, log);
  } else {
    log("SKIP  secure-cookie authentication: no smoke-test credentials supplied");
  }

  const failures = results.filter((result) => !result.ok);
  if (failures.length) {
    throw new Error(`${failures.length} deployment smoke check${failures.length === 1 ? "" : "s"} failed`);
  }
  return results;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const options = readOptions(process.argv.slice(2));
    if (options.help) {
      usage();
    } else {
      const results = await runSmokeCheck(createConfiguration(options), {
        verifyPwaInBrowser: true,
      });
      console.log(`Deployment smoke check passed (${results.length} checks).`);
    }
  } catch (error) {
    console.error(`Deployment smoke check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

export { createConfiguration, readOptions };
