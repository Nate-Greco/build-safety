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
// jsdom does not implement the native dialog top layer.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const root = createRoot(container);

function button(label: string) {
  const element = Array.from(
    container.querySelectorAll('button,[role="button"]'),
  ).find(
    (item) =>
      item.getAttribute("aria-label") === label || item.textContent === label,
  );
  assert.ok(element, "Missing control: " + label);
  return element;
}
async function click(label: string) {
  await act(async () => {
    button(label).dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true }),
    );
  });
}
async function select(label: string, value: string) {
  const element = container.querySelector(
    'select[aria-label="' + label + '"]',
  ) as HTMLSelectElement;
  assert.ok(element);
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
}
async function pointer(type: string) {
  await act(async () => {
    button("Alert campus police").dispatchEvent(
      new dom.window.MouseEvent(type, { bubbles: true, button: 0 }),
    );
  });
}
async function tapAlert() {
  await pointer("pointerdown");
  await pointer("pointerup");
  await click("Alert campus police");
}
function phase() {
  return container
    .querySelector(".emergency-button")!
    .getAttribute("data-phase");
}
function path() {
  return container.querySelector(".route-line")?.getAttribute("d");
}

test("four modes update routes and risk levels while TEST scenarios stay immediate", async () => {
  await act(async () => root.render(<App />));
  assert.equal(
    container.querySelector(".brand-name")?.textContent,
    "BlindSpot",
  );
  assert.equal(container.querySelectorAll(".mode-option").length, 4);
  assert.ok(container.querySelector(".emergency-dock"));
  const baseline = path();
  await select("Test scenario", "after-hours");
  assert.notEqual(path(), baseline);
  assert.equal(
    container.querySelector(".original-route")!.getAttribute("d"),
    baseline,
  );
  assert.ok(container.querySelector(".zone-elevated .risk-overlay"));
  await click("Fastest");
  assert.equal(path(), baseline);
  assert.match(
    container.querySelector(".route-summary")!.textContent!,
    /Risk Level Elevated/,
  );
  await click("Weather-Aware");
  assert.equal(path(), baseline);
  await select("Test scenario", "environment");
  assert.notEqual(path(), baseline);
  assert.match(
    container.querySelector(".route-summary")!.textContent!,
    /Risk Level Low/,
  );
  await click("Fastest");
  assert.equal(path(), baseline);
  assert.match(
    container.querySelector(".route-summary")!.textContent!,
    /Risk Level High/,
  );
  await select("Test scenario", "normal");
  await click("Accessible");
  assert.notEqual(path(), baseline);
  assert.ok(container.querySelector(".mode-accessible"));
  await select("Destination", "village");
  assert.equal(path(), undefined);
  assert.match(
    container.querySelector(".route-summary")!.textContent!,
    /No route available/,
  );
  await select("Destination", "library");
  await click("Safety-Aware");
  assert.equal(path(), baseline);
});

test("controls minimize without hiding TEST; zone sensors and blocked endpoints still work", async () => {
  await click("Minimize controls");
  assert.equal(container.querySelector('select[aria-label="Origin"]'), null);
  assert.ok(container.querySelector('select[aria-label="Test scenario"]'));
  await click("Expand controls");
  await click("Select Dana Porter Library");
  assert.ok(container.querySelector(".incident-content"));
  assert.match(
    container.querySelector(".incident-panel")!.textContent!,
    /Risk Level Low/,
  );
  await click("Minimize incident panel");
  await select("Destination", "engineering");
  await select("Test scenario", "after-hours");
  assert.equal(path(), undefined);
  await select("Destination", "library");
  assert.ok(path());
  await select("Test scenario", "normal");
});

test("alert requires a full three-second hold followed by three separate taps", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await click("Alert campus police");
  assert.equal(phase(), "idle");
  await pointer("pointerdown");
  await act(async () => {
    t.mock.timers.tick(2999);
  });
  assert.equal(phase(), "holding");
  await pointer("pointerup");
  await click("Alert campus police");
  assert.equal(phase(), "idle");

  await pointer("pointerdown");
  await act(async () => {
    t.mock.timers.tick(3000);
  });
  assert.equal(phase(), "armed");
  await pointer("pointerup");
  await click("Alert campus police");
  assert.match(button("Alert campus police").textContent!, /0\/3/);
  await tapAlert();
  assert.equal(phase(), "armed");
  assert.match(button("Alert campus police").textContent!, /1\/3/);
  await tapAlert();
  assert.equal(phase(), "armed");
  assert.match(button("Alert campus police").textContent!, /2\/3/);
  assert.equal(container.querySelector("dialog"), null);
  await tapAlert();
  assert.equal(phase(), "sent");
  const popup = container.querySelector("dialog[open]")!;
  assert.ok(popup);
  assert.match(popup.textContent!, /Police alerted/);
  assert.match(popup.textContent!, /Your location shared/);
  assert.match(popup.textContent!, /User-requested assistance/);
  assert.match(popup.textContent!, /Low risk/);
  assert.match(popup.textContent!, /ETA: 4 min/);
  assert.match(popup.textContent!, /No real dispatch/);
  await act(async () => {
    t.mock.timers.tick(1000);
  });
  assert.match(popup.textContent!, /ETA: 3:59/);
  assert.equal(popup.querySelector("progress")?.value, 1);
  assert.match(button("Alert campus police").textContent!, /Alert sent/);
  assert.match(
    button("Alert campus police").textContent!,
    /Location shared \(demo\)/,
  );
  assert.match(
    container.querySelector(".emergency-note")!.textContent!,
    /No real dispatch/,
  );
  await click("Return to Map");
  assert.equal(container.querySelector("dialog"), null);
  assert.equal(phase(), "sent");
  assert.ok(path());
  await tapAlert();
  assert.equal(phase(), "idle");
});

test("armed alerts cancel by holding again, Escape, or changing incident context", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  async function arm() {
    await pointer("pointerdown");
    await act(async () => {
      t.mock.timers.tick(3000);
    });
    await pointer("pointerup");
    await click("Alert campus police");
    assert.equal(phase(), "armed");
  }
  await arm();
  await tapAlert();
  await pointer("pointerdown");
  await act(async () => {
    t.mock.timers.tick(1200);
  });
  await pointer("pointerup");
  await click("Alert campus police");
  assert.equal(phase(), "idle");
  await arm();
  await act(async () => {
    window.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "Escape" }),
    );
  });
  assert.equal(phase(), "idle");
  await arm();
  await select("Test scenario", "environment");
  assert.equal(phase(), "idle");
  await pointer("pointerdown");
  await pointer("pointercancel");
  await act(async () => {
    t.mock.timers.tick(4000);
  });
  assert.equal(phase(), "idle");
});

test("keyboard hold and three confirmation presses use the same emergency control", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  async function key(type: string) {
    await act(async () => {
      button("Alert campus police").dispatchEvent(
        new dom.window.KeyboardEvent(type, { key: " ", bubbles: true }),
      );
    });
  }
  await key("keydown");
  await act(async () => {
    t.mock.timers.tick(3000);
  });
  await key("keyup");
  assert.equal(phase(), "armed");
  for (let index = 0; index < 3; index++) {
    await key("keydown");
    await key("keyup");
  }
  assert.equal(phase(), "sent");
  assert.match(
    container.querySelector("dialog")!.textContent!,
    /Environmental hazard/,
  );
  assert.match(container.querySelector("dialog")!.textContent!, /High risk/);
  await act(async () => {
    container
      .querySelector("dialog")!
      .dispatchEvent(new dom.window.Event("cancel", { cancelable: true }));
  });
  assert.equal(container.querySelector("dialog"), null);
  await click("Alert campus police");
  assert.equal(phase(), "idle");
});

after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
