import { useMemo, useState } from "react";
import {
  Accessibility,
  ArrowDownUp,
  AudioLines,
  Check,
  ChevronDown,
  ChevronUp,
  CloudSun,
  DoorOpen,
  EyeOff,
  FlaskConical,
  Footprints,
  LockKeyhole,
  Navigation,
  ShieldCheck,
  Siren,
  Thermometer,
  Timer,
  Users,
  Wind,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CampusMap from "./CampusMap";
import EmergencyButton from "./EmergencyButton";
import {
  SCENARIOS,
  SENSOR_LABELS,
  ZONES,
  fuseEvents,
  scenarioTime,
  simulateScenario,
} from "./lib/engine";
import type { Modality, ScenarioId, Severity, ZoneId } from "./lib/engine";
import { findRoute, NODES, PLACES } from "./lib/routing";
import type { PlaceId, RouteMode } from "./lib/routing";

const SENSOR_ICONS: Record<Modality, LucideIcon> = {
  occupancy: Users,
  motion: Footprints,
  access: DoorOpen,
  audio: AudioLines,
  temperature: Thermometer,
  air: Wind,
};
const RISK_LABELS: Record<Severity, string> = {
  normal: "Low",
  watch: "Moderate",
  elevated: "Elevated",
  high: "High",
};
const LEVELS: Severity[] = ["normal", "watch", "elevated", "high"];
const MODES: {
  id: RouteMode;
  label: string;
  icon: LucideIcon;
  hint: string;
}[] = [
  {
    id: "fastest",
    label: "Fastest",
    icon: Zap,
    hint: "Shortest path; detected risks remain visible",
  },
  {
    id: "weather",
    label: "Weather-Aware",
    icon: CloudSun,
    hint: "Avoid environmental risk zones",
  },
  {
    id: "safety",
    label: "Safety-Aware",
    icon: ShieldCheck,
    hint: "Avoid security risks and environmental hazards",
  },
  {
    id: "accessible",
    label: "Accessible",
    icon: Accessibility,
    hint: "Step-free entrances, gentle slopes and paved paths (demo data)",
  },
];

export default function App() {
  const [scenario, setScenario] = useState<ScenarioId>("normal");
  const [mode, setMode] = useState<RouteMode>("safety");
  const [selectedZone, setSelectedZone] = useState<ZoneId>("engineering");
  const [origin, setOrigin] = useState<PlaceId>("south");
  const [destination, setDestination] = useState<PlaceId>("library");
  const [controlsOpen, setControlsOpen] = useState(true);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const received = useMemo(() => simulateScenario(scenario), [scenario]);
  const insights = Object.fromEntries(
    ZONES.map((zone) => [
      zone.id,
      fuseEvents(received, zone.id, scenarioTime(scenario)),
    ]),
  ) as Record<ZoneId, ReturnType<typeof fuseEvents>>;
  const statuses = Object.fromEntries(
    ZONES.map((zone) => [zone.id, insights[zone.id].severity]),
  ) as Record<ZoneId, Severity>;
  const flagged = ZONES.filter((zone) =>
    ["high", "elevated"].includes(statuses[zone.id]),
  );
  const modeRoutes = Object.fromEntries(
    MODES.map((option) => {
      const excluded =
        option.id === "fastest"
          ? []
          : flagged
              .filter(
                (zone) =>
                  option.id !== "weather" ||
                  insights[zone.id].rule === "ENV-01",
              )
              .map((zone) => zone.id);
      return [option.id, findRoute(origin, destination, excluded, option.id)];
    }),
  ) as Record<RouteMode, ReturnType<typeof findRoute>>;
  const original = findRoute(origin, destination)!;
  const route = modeRoutes[mode];
  const rerouted = Boolean(route && route.path !== original.path);
  const routeRisk = (route?.nodes ?? original.nodes).reduce<Severity>(
    (risk, id) => {
      const zone = NODES[id].zone;
      const level = zone ? statuses[zone] : "normal";
      return LEVELS.indexOf(level) > LEVELS.indexOf(risk) ? level : risk;
    },
    "normal",
  );
  const insight = insights[selectedZone];
  const zone = ZONES.find((zone) => zone.id === selectedZone)!;
  const sensorKinds: Modality[] =
    scenario === "environment" && selectedZone === "residence"
      ? ["temperature", "air", "occupancy"]
      : scenario === "after-hours" && selectedZone === "engineering"
        ? ["motion", "access", "audio"]
        : ["occupancy", "motion", "access"];
  const originName = PLACES.find((place) => place.id === origin)!.name;
  const destinationName = PLACES.find(
    (place) => place.id === destination,
  )!.name;

  function runScenario(next: ScenarioId) {
    setScenario(next);
    setSelectedZone(SCENARIOS[next].target);
  }
  function selectZone(id: ZoneId) {
    setSelectedZone(id);
    setIncidentOpen(true);
  }

  return (
    <main className={"map-app mode-" + mode}>
      <CampusMap
        origin={origin}
        destination={destination}
        route={route}
        original={original}
        selected={selectedZone}
        statuses={statuses}
        onSelect={selectZone}
      />
      <section
        className={
          "floating-panel controls-panel " + (controlsOpen ? "" : "minimized")
        }
        aria-label="Route and scenario controls"
      >
        <div className="panel-topline">
          <span className="brand-symbol">
            <EyeOff size={19} />
          </span>
          <div className="brand-name">BlindSpot</div>
          <span className="nav-demo">DEMO</span>
          <button
            className="icon-button"
            aria-label={controlsOpen ? "Minimize controls" : "Expand controls"}
            title={controlsOpen ? "Minimize controls" : "Expand controls"}
            aria-expanded={controlsOpen}
            onClick={() => setControlsOpen((value) => !value)}
          >
            {controlsOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        </div>
        <label className="test-menu">
          <span>
            <FlaskConical size={13} />
            TEST
          </span>
          <select
            aria-label="Test scenario"
            value={scenario}
            onChange={(event) => runScenario(event.target.value as ScenarioId)}
          >
            <option value="normal">Normal</option>
            <option value="after-hours">After-hours risk</option>
            <option value="environment">Environmental hazard</option>
          </select>
        </label>
        {controlsOpen && (
          <div className="controls-content">
            <div className="route-selectors">
              <div className="place-fields">
                <label>
                  <span>FROM</span>
                  <select
                    aria-label="Origin"
                    value={origin}
                    onChange={(event) =>
                      setOrigin(event.target.value as PlaceId)
                    }
                  >
                    {PLACES.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>TO</span>
                  <select
                    aria-label="Destination"
                    value={destination}
                    onChange={(event) =>
                      setDestination(event.target.value as PlaceId)
                    }
                  >
                    {PLACES.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="icon-button swap-button"
                aria-label="Swap origin and destination"
                title="Swap origin and destination"
                onClick={() => {
                  setOrigin(destination);
                  setDestination(origin);
                }}
              >
                <ArrowDownUp size={15} />
              </button>
            </div>
            <div className="route-modes" aria-label="Routing modes">
              {MODES.map(({ id, label, icon: Icon, hint }) => (
                <button
                  key={id}
                  className={
                    "mode-option option-" +
                    id +
                    (mode === id ? " mode-selected" : "")
                  }
                  aria-label={label}
                  aria-pressed={mode === id}
                  title={hint}
                  onClick={() => setMode(id)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  <small>
                    {modeRoutes[id]
                      ? modeRoutes[id]!.minutes + " min"
                      : "Unavailable"}
                  </small>
                  <span className="mode-check">
                    {mode === id && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
            <div
              className={
                "route-summary " +
                (rerouted ? "route-updated " : "") +
                (!route ? "route-unavailable" : "")
              }
              role="status"
            >
              <Navigation size={17} />
              <strong>
                {!route
                  ? "No route available"
                  : origin === destination
                    ? "Arrived"
                    : rerouted
                      ? "Route updated"
                      : "Recommended"}
              </strong>
              {route && (
                <span>
                  <Timer size={12} />
                  {route.minutes} min
                </span>
              )}
              <span className={"risk-badge risk-" + routeRisk}>
                Risk Level <b>{RISK_LABELS[routeRisk]}</b>
              </span>
            </div>
          </div>
        )}
      </section>
      <section
        className={
          "floating-panel incident-panel incident-" +
          insight.severity +
          (incidentOpen ? "" : " minimized")
        }
        aria-label="Zone risk and sensors"
      >
        <div className="incident-topline">
          <span className="incident-status-icon">
            {insight.severity === "normal" ? (
              <ShieldCheck size={15} />
            ) : (
              <Siren size={15} />
            )}
          </span>
          <span>{zone.name}</span>
          <span className={"risk-badge risk-" + insight.severity}>
            Risk Level <b>{RISK_LABELS[insight.severity]}</b>
          </span>
          <button
            className="icon-button"
            onClick={() => setIncidentOpen((value) => !value)}
            aria-label={
              incidentOpen ? "Minimize incident panel" : "Expand incident panel"
            }
            title={
              incidentOpen ? "Minimize incident panel" : "Expand incident panel"
            }
            aria-expanded={incidentOpen}
          >
            {incidentOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
        {incidentOpen && (
          <div className="incident-content">
            <div className="sensor-chips">
              {sensorKinds.map((kind) => {
                const Icon = SENSOR_ICONS[kind];
                const event = received.find(
                  (event) => event.zone === selectedZone && event.kind === kind,
                );
                return (
                  <span
                    className={
                      "sensor-chip " +
                      (insight.evidence.some((item) => item.kind === kind)
                        ? "sensor-active"
                        : "")
                    }
                    key={kind}
                    title={
                      event
                        ? event.label + ": " + event.display
                        : SENSOR_LABELS[kind]
                    }
                  >
                    <Icon size={14} />
                    {SENSOR_LABELS[kind]}
                  </span>
                );
              })}
            </div>
            <div className="privacy-chips">
              <span>
                <Users size={12} />
                No ID
              </span>
              <span>
                <EyeOff size={12} />
                No raw media
              </span>
              <span>
                <LockKeyhole size={12} />
                Metadata only
              </span>
            </div>
          </div>
        )}
      </section>
      <EmergencyButton
        key={[origin, destination, scenario, selectedZone].join(":")}
        location={originName}
        incident={
          scenario === "normal"
            ? "User-requested assistance"
            : SCENARIOS[scenario].label
        }
        risk={RISK_LABELS[statuses[SCENARIOS[scenario].target]]}
      />
      <span className="route-accessible-summary" role="status">
        {originName +
          " to " +
          destinationName +
          ". " +
          (route
            ? (rerouted ? "Route updated. " : "") +
              "Risk Level " +
              RISK_LABELS[routeRisk]
            : "No route available.")}
      </span>
    </main>
  );
}
