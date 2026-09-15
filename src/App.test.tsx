import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://localhost/" },
);
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const container = document.getElementById("root")!;
const root = createRoot(container);

// Keep the real replay/timer lifecycle, with shorter delays for integration tests.
const originalTimeout = window.setTimeout.bind(window);
window.setTimeout = ((handler: TimerHandler) =>
  originalTimeout(handler, 5)) as typeof window.setTimeout;

async function click(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) =>
      element.textContent?.includes(text) ||
      element.getAttribute("aria-label") === text,
  );
  assert.ok(button, `Missing button: ${text}`);
  await act(async () => button.click());
}

async function settleReplay() {
  for (let tick = 0; tick < 5; tick++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
}

test("the single-page workflow supports scenarios, zones, evidence and review", async () => {
  await act(async () => root.render(<App />));
  assert.match(container.textContent!, /Unusual after-hours activity/);
  assert.equal(container.querySelectorAll(".event-row").length, 4);
  assert.equal(
    container.querySelector(".privacy-metric > strong")?.textContent,
    "0",
  );

  await click("Normal activity");
  assert.equal(container.querySelectorAll(".event-row").length, 0);
  assert.match(
    container.querySelector(".fusion-inputs")!.textContent!,
    /Occupancy/,
  );
  await settleReplay();
  assert.match(container.textContent!, /Activity within expected patterns/);
  assert.equal(container.querySelectorAll(".event-row").length, 3);

  await click("After-hours anomaly");
  await settleReplay();
  assert.match(container.textContent!, /Unusual after-hours activity/);
  assert.match(container.textContent!, /3 of 3 supporting signals/);
  await click("Review evidence & privacy");
  assert.ok(container.querySelector("#evidence-detail"));
  assert.match(
    container.querySelector("#evidence-detail")!.textContent!,
    /after-hours motion AND unexpected access AND sound anomaly/,
  );
  assert.match(container.textContent!, /Video frames \/ faces/);
  await click("Mark as reviewed");
  assert.match(container.textContent!, /Review recorded for this simulation/);

  await click("Dana Porter Library, Normal");
  assert.match(
    container.querySelector(".insight-section")!.textContent!,
    /Activity within expected patterns/,
  );
  assert.equal(container.querySelector("#evidence-detail"), null);
  assert.match(
    container.querySelector(".feed-location")!.textContent!,
    /Dana Porter Library/,
  );
  assert.match(
    container.querySelector(".overview-status")!.textContent!,
    /1 zone needs attention/,
  );

  await click("Environmental hazard");
  await settleReplay();
  assert.match(
    container.querySelector(".insight-section")!.textContent!,
    /Possible environmental hazard/,
  );
  assert.match(
    container.querySelector(".feed-location")!.textContent!,
    /Village 1/,
  );
  assert.equal(container.querySelectorAll(".event-row").length, 3);
  await click("Review evidence & privacy");
  assert.match(
    container.querySelector("#evidence-detail")!.textContent!,
    /temperature >= 40 C AND PM2.5 >= 55 AND occupancy > 0/,
  );
  assert.match(container.textContent!, /Mark as reviewed/);
});

test("rapid scenario changes cancel obsolete replay timers", async () => {
  await click("After-hours anomaly");
  await click("Environmental hazard");
  await click("Normal activity");
  await settleReplay();
  assert.match(
    container.querySelector(".insight-section")!.textContent!,
    /Activity within expected patterns/,
  );
  assert.equal(container.querySelectorAll(".event-row").length, 3);
  assert.equal(
    container.querySelector(".scenario-active")?.textContent,
    "Normal activity",
  );
  assert.doesNotMatch(
    container.querySelector(".event-list")!.textContent!,
    /Sound anomaly|Temperature above/,
  );
  assert.equal(container.querySelectorAll("video,audio,iframe").length, 0);
});

after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
