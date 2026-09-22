#!/usr/bin/env node
import { chromium } from "@playwright/test";

const frontendUrl = process.argv[2];
if (!frontendUrl) {
  console.error("Usage: node front/scripts/verify-pwa-registration.mjs https://app.example.com/");
  process.exit(2);
}

let url;
try {
  url = new URL(frontendUrl);
} catch {
  console.error("Frontend URL must be an absolute URL");
  process.exit(2);
}
if (url.protocol !== "https:") {
  console.error("PWA registration requires an HTTPS deployment");
  process.exit(2);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });

  // The registration is initiated by the built frontend. `ready` resolves once
  // it has an active worker; a reload then proves that worker controls pages.
  const scope = await page.waitForFunction(
    async () => {
      if (!("serviceWorker" in navigator)) return null;
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return null;
      await navigator.serviceWorker.ready;
      return registration.scope;
    },
    undefined,
    { timeout: 20_000 }
  );
  const expectedScope = new URL("/", url.origin).toString();
  if ((await scope.jsonValue()) !== expectedScope) {
    throw new Error(`Worker scope did not equal ${expectedScope}`);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, {
    timeout: 20_000,
  });
  console.log("Browser registered and activated the PWA service worker.");
} finally {
  await browser.close();
}
