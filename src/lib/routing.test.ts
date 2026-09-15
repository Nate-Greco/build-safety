import assert from "node:assert/strict";
import { test } from "node:test";
import { findRoute, NODES, PLACES, PATH_TRAITS } from "./routing";
import type { ZoneId } from "./engine";

test("incidents produce two distinct detours from the original walk", () => {
  const original = findRoute("south", "library")!;
  const activity = findRoute("south", "library", ["engineering"])!;
  const environment = findRoute("south", "library", ["residence"])!;
  assert.deepEqual(original.nodes, [
    "south",
    "village",
    "green",
    "engineering",
    "library",
  ]);
  assert.deepEqual(activity.nodes, [
    "south",
    "village",
    "west",
    "north",
    "library",
  ]);
  assert.deepEqual(environment.nodes, [
    "south",
    "southEast",
    "east",
    "library",
  ]);
  assert.ok(activity.metres > original.metres);
  assert.ok(environment.metres > original.metres);
});

test("all endpoint combinations are connected and blocked endpoints yield no route", () => {
  for (const origin of PLACES)
    for (const destination of PLACES) {
      const route = findRoute(origin.id, destination.id)!;
      assert.ok(route);
      assert.equal(route.nodes[0], origin.id);
      assert.equal(route.nodes.at(-1), destination.id);
      assert.equal(route.metres === 0, origin.id === destination.id);
      const blocked = NODES[destination.id].zone;
      if (blocked)
        assert.equal(findRoute(origin.id, destination.id, [blocked]), null);
    }
});

test("recommended paths stay outside the displayed incident boundary", () => {
  for (const [zone, node] of [
    ["engineering", "engineering"],
    ["residence", "village"],
  ] as [ZoneId, string][]) {
    const route = findRoute("south", "library", [zone])!;
    const risk = NODES[node];
    for (let index = 1; index < route.nodes.length; index++) {
      const a = NODES[route.nodes[index - 1]],
        b = NODES[route.nodes[index]];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((risk.x - a.x) * dx + (risk.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
      assert.ok(Math.hypot(a.x + t * dx - risk.x, a.y + t * dy - risk.y) > 105);
    }
  }
});

test("accessible routing avoids stairs, prefers easier paths, and requires step-free entrances", () => {
  const direct = findRoute("south", "library")!;
  const accessible = findRoute("south", "library", [], "accessible")!;
  assert.notEqual(accessible.path, direct.path);
  assert.deepEqual(accessible.nodes, ["south", "southEast", "east", "library"]);
  for (let index = 1; index < accessible.nodes.length; index++) {
    const a = accessible.nodes[index - 1],
      b = accessible.nodes[index];
    const trait = PATH_TRAITS[a + ":" + b] ?? PATH_TRAITS[b + ":" + a];
    assert.equal(Boolean(trait?.stairs), false);
    assert.ok((trait?.slope ?? 0) < 5);
  }
  assert.equal(findRoute("south", "village", [], "accessible"), null);
  assert.equal(findRoute("village", "library", [], "accessible"), null);
});

test("multiple flagged zones are excluded together", () => {
  const route = findRoute("south", "library", ["engineering", "residence"])!;
  assert.ok(route);
  assert.equal(route.nodes.includes("engineering"), false);
  assert.equal(route.nodes.includes("village"), false);
});
