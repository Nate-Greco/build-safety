import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  AudioLines,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Clock3,
  DoorOpen,
  EyeOff,
  Footprints,
  GitMerge,
  Leaf,
  LockKeyhole,
  MapPin,
  Moon,
  Radio,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Siren,
  Sun,
  Thermometer,
  Users,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CORRELATION_WINDOW_MS,
  SCENARIOS,
  SENSOR_LABELS,
  ZONES,
  formatTime,
  fuseEvents,
  scenarioTime,
  simulateScenario,
} from "./lib/engine";
import type {
  Modality,
  SafeEvent,
  ScenarioId,
  Severity,
  ZoneId,
} from "./lib/engine";

const SENSOR_ICONS: Record<Modality, LucideIcon> = {
  occupancy: Users,
  motion: Footprints,
  access: DoorOpen,
  audio: AudioLines,
  temperature: Thermometer,
  air: Wind,
};
const SEVERITY_LABELS: Record<Severity, string> = {
  normal: "Normal",
  watch: "Observing",
  elevated: "Elevated",
  high: "High priority",
};
const SCENARIO_ICONS: Record<ScenarioId, LucideIcon> = {
  normal: Sun,
  "after-hours": Moon,
  environment: Thermometer,
};

function Status({ severity }: { severity: Severity }) {
  return (
    <span className={`status status-${severity}`}>
      <span />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function SensorIcon({ kind, size = 18 }: { kind: Modality; size?: number }) {
  const Icon = SENSOR_ICONS[kind];
  return <Icon size={size} strokeWidth={1.7} />;
}

function CampusMap({
  selected,
  onSelect,
  statuses,
}: {
  selected: ZoneId;
  onSelect: (id: ZoneId) => void;
  statuses: Record<ZoneId, Severity>;
}) {
  return (
    <div className="campus-map">
      <div className="map-grid" />
      <svg className="campus-plan" viewBox="0 0 760 340" aria-hidden="true">
        <defs>
          <pattern
            id="lawn-lines"
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
          >
            <path d="M0 8L8 0" stroke="#c1d3b9" strokeWidth=".7" />
          </pattern>
        </defs>
        <path
          d="M-20 256H260Q299 256 299 216V-20M299 145H550Q600 145 600 95V-20M299 256H800M600 145V380"
          fill="none"
          stroke="#d8e0da"
          strokeWidth="29"
        />
        <path
          d="M-20 256H260Q299 256 299 216V-20M299 145H550Q600 145 600 95V-20M299 256H800M600 145V380"
          fill="none"
          stroke="#fff"
          strokeWidth="22"
        />
        <path
          d="M-20 256H260Q299 256 299 216V-20M299 145H550Q600 145 600 95V-20M299 256H800M600 145V380"
          fill="none"
          stroke="#c5cec7"
          strokeWidth="1"
          strokeDasharray="5 7"
        />
        <path
          d="M342 184h190v44H342zM629 173h103v45H629zM52 46h38v104H52zM349 31h116v37H349z"
          fill="url(#lawn-lines)"
          stroke="#c3d2bd"
        />
        <g fill="#e0e6df" stroke="#cbd4c9">
          <rect x="40" y="182" width="90" height="31" rx="3" />
          <rect x="202" y="43" width="51" height="58" rx="3" />
          <rect x="202" y="112" width="51" height="57" rx="3" />
          <rect x="640" y="40" width="74" height="60" rx="3" />
          <rect x="446" y="283" width="101" height="42" rx="3" />
        </g>
        <g fill="#c1d5b8" stroke="#aec6a3">
          {[
            [49, 300],
            [76, 300],
            [103, 300],
            [132, 300],
            [186, 212],
            [219, 212],
            [364, 100],
            [388, 100],
            [412, 100],
            [656, 294],
            [686, 294],
            [716, 294],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />
          ))}
        </g>
        <g fill="#738576" fontSize="10" fontFamily="Arial, sans-serif">
          <text x="365" y="209">
            CAMPUS GREEN
          </text>
          <text x="321" y="278">
            RING ROAD
          </text>
          <text x="616" y="242">
            NORTH WALK
          </text>
        </g>
      </svg>
      {ZONES.map((zone) => (
        <button
          key={zone.id}
          className={`zone zone-${zone.id} ${selected === zone.id ? "zone-selected" : ""} zone-status-${statuses[zone.id]}`}
          onClick={() => onSelect(zone.id)}
          aria-pressed={selected === zone.id}
          aria-label={`${zone.name}, ${SEVERITY_LABELS[statuses[zone.id]]}`}
        >
          <span className="zone-roof">
            <Building2 size={24} strokeWidth={1.3} />
            <span className="zone-code">{zone.short}</span>
            <span className="zone-beacon" />
          </span>
          <span className="zone-caption">
            {zone.name}
            <span>
              {zone.sensors} sensors <span className="map-status-dot" />{" "}
              {SEVERITY_LABELS[statuses[zone.id]]}
            </span>
          </span>
        </button>
      ))}
      <div className="map-north">
        <ArrowRight size={14} />
        <span>N</span>
      </div>
      <div className="map-scale">
        <span />
        Schematic / not to scale
      </div>
    </div>
  );
}

function EventFeed({
  events,
  evidenceIds,
  running,
}: {
  events: SafeEvent[];
  evidenceIds: Set<string>;
  running: boolean;
}) {
  return (
    <div
      className="event-list"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {events.length === 0 && (
        <div className="event-empty">
          <Radio size={25} />
          <p>Waiting for derived events</p>
        </div>
      )}
      {[...events].reverse().map((event) => (
        <div
          className={`event-row ${event.unusual ? "event-unusual" : ""}`}
          key={event.id}
        >
          <span className={`sensor-icon sensor-${event.kind}`}>
            <SensorIcon kind={event.kind} />
          </span>
          <div className="event-copy">
            <div className="event-topline">
              <span>{SENSOR_LABELS[event.kind]}</span>
              <time>{formatTime(event.timestamp)}</time>
            </div>
            <strong>{event.label}</strong>
            <div className="event-value">
              {event.display}
              {evidenceIds.has(event.id) && event.unusual && (
                <span className="evidence-tag">Evidence</span>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="feed-end">
        <span className={running ? "live-dot pulse" : "live-dot"} />
        {running
          ? "Receiving simulated events"
          : "All scenario events received"}
        <LockKeyhole size={12} />
      </div>
    </div>
  );
}

export default function App() {
  const [scenario, setScenario] = useState<ScenarioId>("after-hours");
  const [selectedZone, setSelectedZone] = useState<ZoneId>("engineering");
  const [allEvents, setAllEvents] = useState(() =>
    simulateScenario("after-hours"),
  );
  const [visibleCount, setVisibleCount] = useState(4);
  const [runId, setRunId] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const targetEvents = useMemo(
    () =>
      allEvents.filter((event) => event.zone === SCENARIOS[scenario].target),
    [allEvents, scenario],
  );
  const running = visibleCount < targetEvents.length;
  const now = scenarioTime(scenario);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setVisibleCount((count) => count + 1),
      850,
    );
    return () => window.clearTimeout(timer);
  }, [visibleCount, running, runId]);

  const receivedEvents = useMemo(
    () =>
      allEvents
        .filter((event) => event.zone !== SCENARIOS[scenario].target)
        .concat(targetEvents.slice(0, visibleCount)),
    [allEvents, scenario, targetEvents, visibleCount],
  );
  const insights = useMemo(
    () =>
      Object.fromEntries(
        ZONES.map((zone) => [
          zone.id,
          fuseEvents(receivedEvents, zone.id, now),
        ]),
      ) as Record<ZoneId, ReturnType<typeof fuseEvents>>,
    [receivedEvents, now],
  );
  const insight = insights[selectedZone];
  const events = receivedEvents.filter((event) => event.zone === selectedZone);
  const zone = ZONES.find((item) => item.id === selectedZone)!;
  const alerts = ZONES.filter((item) =>
    ["high", "elevated"].includes(insights[item.id].severity),
  );
  const evidenceIds = new Set(insight.evidence.map((event) => event.id));
  const zoneRunning = running && selectedZone === SCENARIOS[scenario].target;
  const statuses = Object.fromEntries(
    ZONES.map((item) => [item.id, insights[item.id].severity]),
  ) as Record<ZoneId, Severity>;
  const isAlert =
    insight.severity === "high" || insight.severity === "elevated";
  const fusionSensors =
    scenario === "environment" && selectedZone === SCENARIOS.environment.target
      ? (["temperature", "air", "occupancy"] as Modality[])
      : scenario === "after-hours" &&
          selectedZone === SCENARIOS["after-hours"].target
        ? (["motion", "access", "audio"] as Modality[])
        : (["occupancy", "motion", "access"] as Modality[]);

  function runScenario(next: ScenarioId) {
    setScenario(next);
    setSelectedZone(SCENARIOS[next].target);
    setAllEvents(simulateScenario(next));
    setVisibleCount(0);
    setRunId((id) => id + 1);
    setReviewed(false);
  }

  function selectZone(id: ZoneId) {
    setSelectedZone(id);
    setExpanded(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Campus Signal">
          <span className="brand-mark">
            <Activity size={26} />
          </span>
          <span>
            campus<span className="brand-light">signal</span>
            <small>SAFETY INTELLIGENCE</small>
          </span>
        </a>
        <div className="campus-label">
          <span className="uw-mark">W</span>
          <span>
            University of Waterloo<small>Campus operations</small>
          </span>
        </div>
        <div className="topbar-right">
          <span className="privacy-chip">
            <ShieldCheck size={16} />
            Privacy protected
          </span>
          <span className="simulation-chip">
            <span />
            Simulation
          </span>
        </div>
      </header>

      <main id="main">
        <section className="overview-heading">
          <div>
            <div className="eyebrow">
              CAMPUS OVERVIEW <span>/</span> LIVE SCENARIO
            </div>
            <h1>Campus safety overview</h1>
          </div>
          <div className="overview-status">
            <span
              className={`overview-status-icon ${alerts.length ? "attention" : ""}`}
            >
              {alerts.length ? (
                <Activity size={20} />
              ) : (
                <ShieldCheck size={20} />
              )}
            </span>
            <span>
              <strong>
                {alerts.length
                  ? `${alerts.length} zone needs attention`
                  : running
                    ? "Correlating incoming signals"
                    : "Campus activity normal"}
              </strong>
              <small>
                {ZONES.length} zones monitored <span>/</span> {formatTime(now)}{" "}
                EDT
              </small>
            </span>
          </div>
        </section>

        <section className="scenario-bar" aria-label="Scenario simulator">
          <div className="scenario-label">
            <ScanLine size={18} />
            <span>
              Scenario simulator<small>Simulated sensor data</small>
            </span>
          </div>
          <div className="scenario-options">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
              const Icon = SCENARIO_ICONS[id];
              return (
                <button
                  key={id}
                  className={`scenario-option ${scenario === id ? "scenario-active" : ""}`}
                  onClick={() => runScenario(id)}
                  aria-pressed={scenario === id}
                >
                  <Icon size={17} />
                  <span>{SCENARIOS[id].label}</span>
                  {scenario === id && (
                    <Check size={15} className="scenario-check" />
                  )}
                </button>
              );
            })}
          </div>
          <button
            className="icon-button replay-button"
            onClick={() => runScenario(scenario)}
            aria-label="Replay current scenario"
            title="Replay current scenario"
          >
            <RotateCcw size={17} />
          </button>
        </section>

        <div className="workspace">
          <section className="campus-section" aria-labelledby="campus-heading">
            <div className="section-heading">
              <div>
                <MapPin size={17} />
                <h2 id="campus-heading">Campus zones</h2>
              </div>
              <span className="subtle">4 connected zones</span>
            </div>
            <CampusMap
              selected={selectedZone}
              onSelect={selectZone}
              statuses={statuses}
            />
            <div className="map-footer">
              <div className="map-legend">
                <span>
                  <i className="legend-normal" />
                  Normal
                </span>
                <span>
                  <i className="legend-elevated" />
                  Elevated
                </span>
                <span>
                  <i className="legend-high" />
                  High priority
                </span>
              </div>
              <span>
                <span className="selected-key" />
                Selected zone
              </span>
            </div>
          </section>
          <section
            className="signals-section"
            aria-labelledby="signals-heading"
          >
            <div className="section-heading">
              <div>
                <Radio size={17} />
                <h2 id="signals-heading">Derived sensor events</h2>
              </div>
              <span className="count-badge">{events.length}</span>
            </div>
            <div className="feed-location">
              <MapPin size={13} />
              {zone.name}
              <span>Metadata only</span>
            </div>
            <EventFeed
              events={events}
              evidenceIds={evidenceIds}
              running={zoneRunning}
            />
          </section>
        </div>

        <section
          className="fusion-strip"
          aria-label="Privacy-preserving sensor fusion"
        >
          <div className="fusion-stage source-stage">
            <span className="step-label">01 / SENSOR INPUT</span>
            <div className="source-modalities">
              <ScanLine size={17} />
              <span>
                {scenario === "environment" && selectedZone === "residence"
                  ? "Thermal, air & camera"
                  : scenario === "after-hours" && selectedZone === "engineering"
                    ? "Motion, access & audio"
                    : "Camera, motion & access"}
              </span>
            </div>
            <small>Simulated device readings</small>
          </div>
          <ArrowRight className="stage-arrow" size={20} />
          <div className="fusion-stage privacy-stage">
            <span className="step-label">02 / PRIVACY FILTER</span>
            <div>
              <ShieldCheck size={19} />
              <strong>Only anonymous metadata</strong>
            </div>
            <small>Media & identity fields discarded</small>
          </div>
          <ArrowRight className="stage-arrow" size={20} />
          <div className="fusion-stage engine-stage">
            <span className="step-label">03 / SENSOR FUSION</span>
            <div className="fusion-inputs">
              {fusionSensors.map((kind, index) => {
                const active =
                  events.some((event) => event.kind === kind) &&
                  (evidenceIds.has(
                    events.find((event) => event.kind === kind)?.id ?? "",
                  ) ||
                    insight.severity === "normal");
                return (
                  <span className="fusion-input-wrap" key={kind}>
                    {index > 0 && <span className="plus">+</span>}
                    <span
                      className={`fusion-input ${active ? "fusion-input-active" : ""}`}
                    >
                      <SensorIcon kind={kind} size={14} />
                      {SENSOR_LABELS[kind]}
                    </span>
                  </span>
                );
              })}
            </div>
            <small>
              Same zone <span>/</span> 2-minute correlation window
            </small>
          </div>
          <ArrowRight className="stage-arrow" size={20} />
          <div className="fusion-stage output-stage">
            <span className="step-label">04 / SAFETY INSIGHT</span>
            <div>
              <GitMerge size={18} />
              <strong>
                {zoneRunning
                  ? "Correlating evidence"
                  : isAlert
                    ? "Human review required"
                    : insight.severity === "watch"
                      ? "More evidence needed"
                      : "No combined anomaly"}
              </strong>
            </div>
            <small>Explainable, rule-based conclusion</small>
          </div>
        </section>

        <div className="insight-workspace">
          <section
            className={`insight-section insight-${insight.severity}`}
            aria-labelledby="insight-heading"
          >
            <div className="section-heading">
              <div>
                <GitMerge size={17} />
                <h2 id="insight-heading">Fused safety insight</h2>
              </div>
              <span className="insight-id">
                {insight.rule} <span>/</span> {zone.short}
              </span>
            </div>
            <div className="insight-body">
              <div className="insight-title-row">
                <div
                  className={`insight-symbol ${isAlert ? "insight-symbol-alert" : ""}`}
                >
                  {isAlert ? (
                    <Siren size={23} />
                  ) : insight.severity === "watch" ? (
                    <Activity size={23} />
                  ) : (
                    <CircleCheck size={23} />
                  )}
                </div>
                <div>
                  <div className="insight-location">
                    {zone.name} <span>/</span> {zone.area}
                  </div>
                  <h3>{insight.title}</h3>
                </div>
                <Status severity={insight.severity} />
              </div>
              <p className="insight-summary">{insight.summary}</p>
              <div className="evidence-summary">
                <span>
                  <span className="evidence-dots">
                    {[0, 1, 2].map((index) => (
                      <i
                        key={index}
                        className={index < insight.matched ? "filled" : ""}
                      />
                    ))}
                  </span>
                  {isAlert || insight.severity === "watch"
                    ? `${insight.matched} of ${insight.required} supporting signals`
                    : `${events.length} current signals`}
                </span>
                <span>
                  <Clock3 size={13} />
                  {CORRELATION_WINDOW_MS / 1000}s correlation window
                </span>
              </div>
              <div className="action-row">
                <span className="action-icon">
                  <ArrowRight size={17} />
                </span>
                <div>
                  <span className="action-label">RECOMMENDED ACTION</span>
                  <p>{insight.action}</p>
                </div>
              </div>
              <div className="insight-bottom">
                <button
                  className="explain-button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={expanded}
                  aria-controls="evidence-detail"
                >
                  {expanded
                    ? "Close evidence & privacy"
                    : "Review evidence & privacy"}
                  {expanded ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
                <span className="human-review">
                  <Users size={14} />
                  {reviewed && isAlert
                    ? "Reviewed by operator (demo)"
                    : "Human judgment before escalation"}
                </span>
              </div>
            </div>
          </section>
          <aside className="privacy-section" aria-labelledby="privacy-heading">
            <div className="section-heading">
              <div>
                <ShieldCheck size={17} />
                <h2 id="privacy-heading">Privacy by design</h2>
              </div>
              <LockKeyhole size={14} />
            </div>
            <div className="privacy-metric">
              <strong>0</strong>
              <span>
                identities stored<small>Across every zone and scenario</small>
              </span>
              <EyeOff size={27} strokeWidth={1.3} />
            </div>
            <div className="privacy-checks">
              <span>
                <Check size={14} />
                No facial recognition
              </span>
              <span>
                <Check size={14} />
                No raw video or audio retained
              </span>
              <span>
                <Check size={14} />
                Occupancy grouped in ranges
              </span>
              <span>
                <Check size={14} />
                Derived events in memory only
              </span>
            </div>
            <div className="privacy-footer">
              <Leaf size={16} />
              <span>Minimum data. Meaningful awareness.</span>
            </div>
          </aside>
        </div>

        {expanded && (
          <section className="detail-section" id="evidence-detail">
            <div className="detail-heading">
              <div>
                <span className="eyebrow">EVIDENCE & PRIVACY AUDIT</span>
                <h2>Why these signals matter together</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setExpanded(false)}
                aria-label="Close evidence details"
                title="Close evidence details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="detail-grid">
              <div className="reasoning-column">
                <h3>
                  <GitMerge size={16} />
                  Fusion rationale
                </h3>
                <p>{insight.reasoning}</p>
                <div className="rule-box">
                  <span>{insight.rule}</span>
                  <code>
                    {insight.rule === "ENV-01"
                      ? "temperature >= 40 C AND PM2.5 >= 55 AND occupancy > 0"
                      : insight.rule === "ACT-01"
                        ? "after-hours motion AND unexpected access AND sound anomaly"
                        : "No combined anomaly rule matched"}
                  </code>
                  <small>
                    Same zone; all contributing events within 120 seconds. Demo
                    thresholds, not calibrated probabilities.
                  </small>
                </div>
                <div className="evidence-details">
                  {insight.evidence.map((event) => (
                    <div key={event.id}>
                      <SensorIcon kind={event.kind} size={15} />
                      <strong>{event.label}</strong>
                      <span>{event.display}</span>
                      <time>{formatTime(event.timestamp)}</time>
                    </div>
                  ))}
                </div>
                {isAlert && (
                  <button
                    className={`review-button ${reviewed ? "reviewed" : ""}`}
                    onClick={() => setReviewed(true)}
                    disabled={reviewed}
                  >
                    {reviewed ? <CheckCheck size={17} /> : <Check size={17} />}
                    {reviewed
                      ? "Review recorded for this simulation"
                      : "Mark as reviewed"}
                    <span>No dispatch sent</span>
                  </button>
                )}
              </div>
              <div className="audit-column">
                <h3>
                  <ShieldCheck size={16} />
                  Data minimization
                </h3>
                <div className="audit-head">
                  <span>NOT RETAINED</span>
                  <span>RETAINED FOR FUSION</span>
                </div>
                {[
                  ["Video frames / faces", "Anonymous occupancy range"],
                  ["Access credentials / identity", "Door event + zone"],
                  ["Audio recordings / speech", "Sound anomaly flag"],
                  [
                    "Device identifiers / raw payload",
                    "Sensor type + timestamp",
                  ],
                ].map(([discarded, retained]) => (
                  <div className="audit-row" key={discarded}>
                    <span>
                      <X size={13} />
                      {discarded}
                    </span>
                    <ArrowRight size={13} />
                    <span>
                      <Check size={13} />
                      {retained}
                    </span>
                  </div>
                ))}
                <div className="retention-note">
                  <Clock3 size={17} />
                  <p>
                    <strong>Ephemeral scenario state</strong>Events live only in
                    browser memory, are replaced on scenario change, and clear
                    on reload. Fusion excludes evidence older than two minutes
                    of simulated time.
                  </p>
                </div>
                <div className="adapter-note">
                  <Radio size={15} />
                  <span>
                    Simulated inputs model Verkada-style sensor metadata. No
                    live devices connected.
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
        <footer className="app-footer">
          <span>
            <ShieldCheck size={13} />
            Built for safety. Designed for privacy.
          </span>
          <span>
            UW Blueprint <span className="footer-times">x</span> Verkada{" "}
            <span className="footer-divider">/</span> Build for Safety prototype
          </span>
        </footer>
      </main>
    </div>
  );
}
