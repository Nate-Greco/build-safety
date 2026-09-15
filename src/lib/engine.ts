export const ZONES = [
  {
    id: "engineering",
    name: "Engineering 7",
    short: "E7",
    area: "Research & teaching",
    sensors: 12,
  },
  {
    id: "library",
    name: "Dana Porter Library",
    short: "DP",
    area: "Study & learning",
    sensors: 8,
  },
  {
    id: "residence",
    name: "Village 1",
    short: "V1",
    area: "Student residence",
    sensors: 10,
  },
  {
    id: "parking",
    name: "North parking",
    short: "N",
    area: "Outdoor & access",
    sensors: 6,
  },
] as const;

export type ZoneId = (typeof ZONES)[number]["id"];
export type ScenarioId = "normal" | "after-hours" | "environment";
export type Modality =
  "occupancy" | "motion" | "access" | "audio" | "temperature" | "air";
export type Severity = "normal" | "watch" | "elevated" | "high";

export const SCENARIOS: Record<
  ScenarioId,
  { label: string; time: string; target: ZoneId; description: string }
> = {
  normal: {
    label: "Normal activity",
    time: "2026-09-15T18:32:00Z",
    target: "engineering",
    description: "Expected daytime activity",
  },
  "after-hours": {
    label: "After-hours anomaly",
    time: "2026-09-16T06:14:00Z",
    target: "engineering",
    description: "Motion + access + audio",
  },
  environment: {
    label: "Environmental hazard",
    time: "2026-09-15T19:42:00Z",
    target: "residence",
    description: "Heat + air quality + occupancy",
  },
};

export const SENSOR_LABELS: Record<Modality, string> = {
  occupancy: "Occupancy",
  motion: "Motion",
  access: "Access",
  audio: "Audio",
  temperature: "Temperature",
  air: "Air quality",
};

// The adapter boundary accepts untrusted vendor-shaped input. Only explicitly
// copied and validated fields below can enter application state.
export interface SensorReading {
  zone: string;
  kind: string;
  timestamp: string;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SafeEvent {
  id: string;
  zone: ZoneId;
  kind: Modality;
  timestamp: string;
  value: number | boolean | string;
  label: string;
  display: string;
  unusual: boolean;
  afterHours: boolean;
}

const MODALITIES: Modality[] = [
  "occupancy",
  "motion",
  "access",
  "audio",
  "temperature",
  "air",
];
export const CORRELATION_WINDOW_MS = 120_000;

export function normalizeReading(reading: SensorReading): SafeEvent | null {
  if (
    !ZONES.some((zone) => zone.id === reading.zone) ||
    !MODALITIES.includes(reading.kind as Modality)
  )
    return null;
  if (
    !Number.isFinite(Date.parse(reading.timestamp)) ||
    !reading.payload ||
    typeof reading.payload !== "object"
  )
    return null;
  const kind = reading.kind as Modality;
  const payload = reading.payload;
  const afterHours = payload.afterHours === true;
  let value: SafeEvent["value"];
  let label: string;
  let display: string;
  let unusual = false;

  switch (kind) {
    case "occupancy": {
      if (
        typeof payload.count !== "number" ||
        !Number.isInteger(payload.count) ||
        payload.count < 0 ||
        payload.count > 10000
      )
        return null;
      const lower =
        payload.count === 0 ? 0 : Math.floor((payload.count - 1) / 5) * 5 + 1;
      value = lower;
      display = lower === 0 ? "0 people" : `${lower}-${lower + 4} people`;
      label = "Anonymous occupancy";
      break;
    }
    case "motion":
      if (typeof payload.detected !== "boolean") return null;
      value = payload.detected;
      unusual = value && afterHours;
      label = unusual ? "After-hours motion" : "Expected movement";
      display = value ? "Motion detected" : "No motion";
      break;
    case "access":
      if (typeof payload.unexpected !== "boolean") return null;
      value = payload.unexpected;
      unusual = value;
      label = value ? "Unexpected door opening" : "Expected door activity";
      display = value ? "Outside access schedule" : "Within access schedule";
      break;
    case "audio":
      if (typeof payload.anomaly !== "boolean") return null;
      value = payload.anomaly;
      unusual = value;
      label = value ? "Sound anomaly" : "Usual sound level";
      display = value ? "Elevated sound energy" : "Within baseline";
      break;
    case "temperature":
      if (
        typeof payload.celsius !== "number" ||
        !Number.isFinite(payload.celsius) ||
        payload.celsius < -60 ||
        payload.celsius > 150
      )
        return null;
      value = Math.round(payload.celsius * 10) / 10;
      unusual = value >= 40;
      label = unusual
        ? "Temperature above threshold"
        : "Temperature within range";
      display = `${value.toFixed(1)} C`;
      break;
    case "air":
      if (
        typeof payload.pm25 !== "number" ||
        !Number.isFinite(payload.pm25) ||
        payload.pm25 < 0 ||
        payload.pm25 > 5000
      )
        return null;
      value = Math.round(payload.pm25);
      unusual = value >= 55;
      label = unusual ? "Air-quality anomaly" : "Air quality within range";
      display = `PM2.5: ${value} ug/m3`;
      break;
  }

  return {
    id: `${reading.zone}:${kind}:${new Date(reading.timestamp).toISOString()}`,
    zone: reading.zone as ZoneId,
    kind,
    timestamp: new Date(reading.timestamp).toISOString(),
    value,
    label,
    display,
    unusual,
    afterHours,
  };
}

export interface Insight {
  severity: Severity;
  title: string;
  summary: string;
  reasoning: string;
  action: string;
  evidence: SafeEvent[];
  matched: number;
  required: number;
  rule: string;
}

export function fuseEvents(
  events: SafeEvent[],
  zone: ZoneId,
  now: number,
): Insight {
  const recent = events.filter(
    (event) =>
      event.zone === zone &&
      now - Date.parse(event.timestamp) >= 0 &&
      now - Date.parse(event.timestamp) <= CORRELATION_WINDOW_MS,
  );
  const latest = new Map<Modality, SafeEvent>();
  for (const event of [...recent].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  ))
    latest.set(event.kind, event);
  const motion = latest.get("motion");
  const access = latest.get("access");
  const audio = latest.get("audio");
  const temperature = latest.get("temperature");
  const air = latest.get("air");
  const occupancy = latest.get("occupancy");
  const activityEvidence = [
    motion?.value === true && motion.afterHours ? motion : null,
    access?.value === true ? access : null,
    audio?.value === true ? audio : null,
  ].filter((event): event is SafeEvent => Boolean(event));
  const environmentEvidence = [
    temperature && Number(temperature.value) >= 40 ? temperature : null,
    air && Number(air.value) >= 55 ? air : null,
    occupancy && Number(occupancy.value) > 0 ? occupancy : null,
  ].filter((event): event is SafeEvent => Boolean(event));
  const hasEnvironmentalAnomaly = Boolean(temperature?.unusual || air?.unusual);

  if (environmentEvidence.length === 3) {
    return {
      severity: "high",
      title: "Possible environmental hazard",
      summary:
        "Elevated temperature and airborne particles coincide with people still present.",
      reasoning:
        "Heat alone can be equipment-related. Poor air quality alone can have many causes. Both in an occupied zone within two minutes warrant an urgent human check; they do not establish a fire.",
      action:
        "Contact campus safety and facilities for an urgent check. Assess whether to clear the area under campus procedures.",
      evidence: environmentEvidence,
      matched: 3,
      required: 3,
      rule: "ENV-01",
    };
  }
  if (activityEvidence.length === 3) {
    return {
      severity: "elevated",
      title: "Unusual after-hours activity",
      summary:
        "Unexpected door activity, motion and a sound anomaly overlap in the same zone.",
      reasoning:
        "A late-night motion event alone may be routine. An off-schedule door opening and nearby sound anomaly within two minutes provide corroboration. This suggests unusual activity, not an identified person or confirmed threat.",
      action:
        "Request a discreet check of the zone by campus safety. Confirm scheduled activity before any escalation.",
      evidence: activityEvidence,
      matched: 3,
      required: 3,
      rule: "ACT-01",
    };
  }
  if (activityEvidence.length > 0 || hasEnvironmentalAnomaly) {
    const evidence = hasEnvironmentalAnomaly
      ? environmentEvidence
      : activityEvidence;
    return {
      severity: "watch",
      title: "Awaiting corroboration",
      summary:
        "An unusual signal is present. The combined alert threshold has not been met.",
      reasoning:
        "The demo rule requires three independent supporting modalities in the same zone within two minutes. A single signal does not establish the cause or indicate anyone's intent.",
      action:
        "Monitor incoming evidence. A missing corroborating signal does not establish that an area is safe.",
      evidence,
      matched: evidence.length,
      required: 3,
      rule: hasEnvironmentalAnomaly ? "ENV-01" : "ACT-01",
    };
  }
  return {
    severity: "normal",
    title: recent.length
      ? "Activity within expected patterns"
      : "Waiting for sensor events",
    summary: recent.length
      ? "No combined anomaly is present in the metadata received so far."
      : "No current evidence is available for this zone.",
    reasoning: recent.length
      ? "The received metadata does not meet either fusion rule. Normal status describes available signals; it is not a guarantee of safety."
      : "Only events from the selected zone inside the correlation window can support an insight.",
    action: recent.length
      ? "Continue routine monitoring. No intervention indicated by these signals."
      : "Wait for current sensor metadata before assessing this zone.",
    evidence: [...latest.values()],
    matched: 0,
    required: 3,
    rule: "BASELINE",
  };
}

function readingsForZone(scenario: ScenarioId, zone: ZoneId): SensorReading[] {
  const config = SCENARIOS[scenario];
  const base = Date.parse(config.time);
  const make = (
    kind: Modality,
    payload: SensorReading["payload"],
    seconds: number,
  ): SensorReading => ({
    zone,
    kind,
    timestamp: new Date(base + seconds * 1000).toISOString(),
    payload,
  });
  if (zone === config.target && scenario === "after-hours") {
    return [
      make("occupancy", { count: 3 }, 0),
      make("motion", { detected: true, afterHours: true }, 12),
      make("access", { unexpected: true, afterHours: true }, 26),
      make("audio", { anomaly: true, afterHours: true }, 41),
    ];
  }
  if (zone === config.target && scenario === "environment") {
    return [
      make("temperature", { celsius: 43.2 }, 0),
      make("air", { pm25: 87 }, 19),
      make("occupancy", { count: 14 }, 38),
    ];
  }
  const count =
    scenario === "after-hours"
      ? zone === "library"
        ? 9
        : 0
      : { engineering: 23, library: 38, residence: 17, parking: 4 }[zone];
  return [
    make("occupancy", { count }, 0),
    make("motion", { detected: count > 0 }, 15),
    make("access", { unexpected: false }, 31),
  ];
}

// Replace this simulator with a sensor adapter that returns SensorReading[].
// Raw readings are transient: only the normalized result reaches React state.
export function simulateScenario(scenario: ScenarioId): SafeEvent[] {
  return ZONES.flatMap((zone) => readingsForZone(scenario, zone.id))
    .map(normalizeReading)
    .filter((event): event is SafeEvent => event !== null);
}

export function scenarioTime(scenario: ScenarioId): number {
  return Date.parse(SCENARIOS[scenario].time) + 45_000;
}

export function formatTime(timestamp: string | number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
