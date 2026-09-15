import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CORRELATION_WINDOW_MS,
  ZONES,
  fuseEvents,
  normalizeReading,
  scenarioTime,
  simulateScenario,
} from "./engine";
import type { SafeEvent, ScenarioId } from "./engine";

test("normal activity produces no fused alert in any zone", () => {
  const events = simulateScenario("normal");
  for (const zone of ZONES)
    assert.equal(
      fuseEvents(events, zone.id, scenarioTime("normal")).severity,
      "normal",
    );
});

test("each scenario only raises a combined alert in its intended zone", () => {
  for (const [scenario, target, severity] of [
    ["after-hours", "engineering", "elevated"],
    ["environment", "residence", "high"],
  ] as const) {
    const events = simulateScenario(scenario);
    for (const zone of ZONES) {
      const insight = fuseEvents(events, zone.id, scenarioTime(scenario));
      assert.equal(insight.severity, zone.id === target ? severity : "normal");
      if (zone.id === target) {
        assert.equal(insight.evidence.length, 3);
        assert.equal(
          new Set(insight.evidence.map((event) => event.kind)).size,
          3,
        );
      }
    }
  }
});

test("removing any corroborating modality prevents a combined alert", () => {
  for (const [scenario, zone, modalities] of [
    ["after-hours", "engineering", ["motion", "access", "audio"]],
    ["environment", "residence", ["temperature", "air", "occupancy"]],
  ] as const) {
    const events = simulateScenario(scenario);
    for (const kind of modalities) {
      const insight = fuseEvents(
        events.filter((event) => event.kind !== kind),
        zone,
        scenarioTime(scenario),
      );
      assert.notEqual(insight.severity, "high");
      assert.notEqual(insight.severity, "elevated");
    }
  }
});

test("privacy transformation discards nested and top-level personal fields", () => {
  const safe = normalizeReading({
    zone: "engineering",
    kind: "occupancy",
    timestamp: "2026-09-16T06:14:00Z",
    personName: "PRIVATE_PERSON",
    faceEmbedding: [0.42],
    videoUrl: "PRIVATE_VIDEO",
    payload: {
      count: 3,
      badgeId: "PRIVATE_BADGE",
      transcript: "PRIVATE_SPEECH",
      nested: { identity: "PRIVATE_ID" },
    },
  });
  assert.ok(safe);
  assert.equal(safe.display, "1-5 people");
  assert.equal(safe.value, 1);
  assert.equal(JSON.stringify(safe).includes("PRIVATE"), false);
  assert.deepEqual(Object.keys(safe).sort(), [
    "afterHours",
    "display",
    "id",
    "kind",
    "label",
    "timestamp",
    "unusual",
    "value",
    "zone",
  ]);
});

test("invalid readings are rejected and occupancy groups respect boundaries", () => {
  const reading = {
    zone: "engineering",
    kind: "occupancy",
    timestamp: "2026-09-16T06:14:00Z",
    payload: { count: 5 },
  };
  assert.equal(normalizeReading(reading)?.display, "1-5 people");
  assert.equal(
    normalizeReading({ ...reading, payload: { count: 6 } })?.display,
    "6-10 people",
  );
  assert.equal(
    normalizeReading({ ...reading, payload: { count: 0 } })?.display,
    "0 people",
  );
  assert.equal(normalizeReading({ ...reading, zone: "unknown" }), null);
  assert.equal(normalizeReading({ ...reading, kind: "face" }), null);
  assert.equal(normalizeReading({ ...reading, timestamp: "invalid" }), null);
  for (const count of [-1, 1.2, NaN, Infinity, "3"])
    assert.equal(normalizeReading({ ...reading, payload: { count } }), null);
  assert.equal(
    normalizeReading({
      ...reading,
      kind: "motion",
      payload: { detected: "yes" },
    }),
    null,
  );
});

test("events from another zone cannot corroborate an alert", () => {
  const events = simulateScenario("after-hours").map((event) =>
    event.kind === "audio" ? { ...event, zone: "library" as const } : event,
  );
  assert.equal(
    fuseEvents(events, "engineering", scenarioTime("after-hours")).severity,
    "watch",
  );
  assert.equal(
    fuseEvents(events, "library", scenarioTime("after-hours")).severity,
    "watch",
  );
});

test("stale and future evidence cannot corroborate an alert", () => {
  const now = scenarioTime("after-hours");
  for (const timestamp of [now - CORRELATION_WINDOW_MS - 1, now + 1]) {
    const events = simulateScenario("after-hours").map((event) =>
      event.kind === "audio"
        ? { ...event, timestamp: new Date(timestamp).toISOString() }
        : event,
    );
    assert.equal(fuseEvents(events, "engineering", now).severity, "watch");
  }
});

test("repeated events from one sensor never count as independent evidence", () => {
  const motion = simulateScenario("after-hours").find(
    (event) => event.kind === "motion",
  )!;
  const events = Array.from({ length: 3 }, (_, index) => ({
    ...motion,
    id: `duplicate-${index}`,
  }));
  const insight = fuseEvents(
    events,
    "engineering",
    scenarioTime("after-hours"),
  );
  assert.equal(insight.severity, "watch");
  assert.equal(insight.matched, 1);
});

test("a newer cleared observation supersedes an older anomaly", () => {
  const events = simulateScenario("after-hours");
  const audio = events.find((event) => event.kind === "audio")!;
  const cleared: SafeEvent = {
    ...audio,
    id: "cleared-audio",
    timestamp: new Date(scenarioTime("after-hours")).toISOString(),
    value: false,
    unusual: false,
  };
  assert.equal(
    fuseEvents([cleared, ...events], "engineering", scenarioTime("after-hours"))
      .severity,
    "watch",
  );
});

test("sensor order does not change a complete fused conclusion", () => {
  for (const scenario of [
    "normal",
    "after-hours",
    "environment",
  ] as ScenarioId[]) {
    const events = simulateScenario(scenario);
    for (const zone of ZONES) {
      assert.equal(
        fuseEvents(events, zone.id, scenarioTime(scenario)).title,
        fuseEvents([...events].reverse(), zone.id, scenarioTime(scenario))
          .title,
      );
    }
  }
});
