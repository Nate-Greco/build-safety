import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Navigation,
  ZoomIn,
  ZoomOut,
  LocateFixed,
} from "lucide-react";
import { ZONES } from "./lib/engine";
import type { Severity, ZoneId } from "./lib/engine";
import { EDGES, NODES, pathFor, PLACES } from "./lib/routing";
import type { PlaceId, WalkingRoute } from "./lib/routing";

const BUILDINGS = [
  {
    x: 855,
    y: 470,
    w: 128,
    h: 91,
    label: "Engineering 7",
    zone: "engineering",
  },
  {
    x: 1050,
    y: 125,
    w: 151,
    h: 91,
    label: "Dana Porter Library",
    zone: "library",
  },
  { x: 252, y: 486, w: 126, h: 118, label: "Village 1", zone: "residence" },
  { x: 536, y: 63, w: 85, h: 120, label: "North parking", zone: "parking" },
] as const;
const CONTEXT_BUILDINGS = [
  [128, 130, 145, 79],
  [307, 109, 83, 112],
  [145, 275, 86, 123],
  [277, 283, 94, 82],
  [490, 330, 122, 111],
  [664, 312, 98, 118],
  [783, 76, 165, 69],
  [817, 290, 103, 64],
  [996, 460, 58, 120],
  [1177, 342, 100, 162],
  [1193, 580, 109, 105],
  [921, 671, 105, 67],
  [555, 646, 92, 51],
  [158, 684, 135, 77],
  [819, 795, 122, 73],
  [1029, 797, 130, 68],
  [302, 804, 180, 70],
];
const TREES = [
  [337, 410],
  [365, 420],
  [315, 440],
  [528, 491],
  [555, 501],
  [584, 484],
  [515, 525],
  [549, 542],
  [594, 533],
  [647, 489],
  [717, 489],
  [779, 476],
  [780, 504],
  [762, 536],
  [850, 620],
  [828, 651],
  [831, 690],
  [868, 719],
  [1172, 261],
  [1214, 269],
  [1249, 262],
  [1170, 745],
  [1205, 736],
  [349, 655],
  [326, 665],
  [293, 647],
  [212, 570],
  [204, 538],
  [496, 200],
  [538, 224],
  [564, 237],
  [824, 180],
  [861, 184],
  [899, 185],
  [767, 814],
  [746, 853],
  [708, 844],
  [647, 804],
  [602, 808],
];
interface Props {
  origin: PlaceId;
  destination: PlaceId;
  route: WalkingRoute | null;
  original: WalkingRoute;
  selected: ZoneId;
  statuses: Record<ZoneId, Severity>;
  onSelect: (zone: ZoneId) => void;
}

export default function CampusMap({
  origin,
  destination,
  route,
  original,
  selected,
  statuses,
  onSelect,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [compact, setCompact] = useState(() => window.innerWidth <= 700);
  useEffect(() => {
    const resize = () =>
      setCompact((mapRef.current?.clientWidth || window.innerWidth) <= 700);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const rerouted = route?.path !== original.path;
  const start = NODES[origin];
  const end = NODES[destination];
  const scale = 1 / zoom;
  const width = compact ? 1040 : 1440;
  const center = compact ? 750 : 720;
  const viewBox = `${center - (width / 2) * scale + pan.x} ${450 - 450 * scale + pan.y} ${width * scale} ${900 * scale}`;
  return (
    <div className="map-canvas">
      <svg
        ref={mapRef}
        className="walking-map"
        viewBox={viewBox}
        role="group"
        aria-label="Campus walking map"
        onPointerDown={(event) => {
          if ((event.target as Element).closest('[role="button"]')) return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const unit = mapRef.current?.getScreenCTM()?.a || 1;
          setPan({
            x: drag.current.panX - (event.clientX - drag.current.x) / unit,
            y: drag.current.panY - (event.clientY - drag.current.y) / unit,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id="park-lines"
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 9L9 0" stroke="#2a4650" strokeWidth=".7" />
          </pattern>
          <pattern
            id="risk-lines"
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <path
              d="M0 0V12"
              stroke="currentColor"
              strokeWidth="3"
              opacity=".11"
            />
          </pattern>
        </defs>
        <rect x="-4000" y="-4000" width="9000" height="9000" fill="#17253c" />
        <g className="landscape">
          <path
            d="M44 410C93 456 77 575 125 631L189 592C154 503 176 446 134 404Z"
            fill="#23444f"
            stroke="#375965"
            strokeWidth="2"
          />
          <path
            d="M455 459H755L741 547H461ZM758 611H900V720H780ZM50 48H240V90H50ZM1186 36H1410V215H1239Z"
            fill="#1d343e"
          />
          <path
            d="M455 459H755L741 547H461ZM758 611H900V720H780Z"
            fill="url(#park-lines)"
          />
          <path
            d="M-50 230H330Q380 230 380 280V730Q380 784 437 784H1180Q1320 784 1320 665V222Q1320 188 1280 188H980V-50M380 385H1420M40 639H373"
            fill="none"
            stroke="#2b3d57"
            strokeWidth="37"
          />
          <path
            d="M-50 230H330Q380 230 380 280V730Q380 784 437 784H1180Q1320 784 1320 665V222Q1320 188 1280 188H980V-50M380 385H1420M40 639H373"
            fill="none"
            stroke="#1d2e47"
            strokeWidth="30"
          />
          <path
            d="M-50 230H330Q380 230 380 280V730Q380 784 437 784H1180Q1320 784 1320 665V222Q1320 188 1280 188H980V-50M380 385H1420"
            fill="none"
            stroke="#44576f"
            strokeWidth="1.5"
            strokeDasharray="9 10"
          />
          <g className="walkways">
            {EDGES.map(([from, to]) => (
              <path
                key={`${from}-${to}`}
                d={pathFor([from, to])}
                fill="none"
                stroke="#405670"
                strokeWidth="17"
                strokeLinecap="round"
              />
            ))}
          </g>
          <g className="context-buildings">
            {CONTEXT_BUILDINGS.map(([x, y, w, h], index) => (
              <g key={index}>
                <rect
                  x={x + 4}
                  y={y + 5}
                  width={w}
                  height={h}
                  rx="3"
                  fill="#111d31"
                />
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="3"
                  fill="#283b57"
                  stroke="#405370"
                />
                <rect
                  x={x + 8}
                  y={y + 8}
                  width={w - 16}
                  height={h - 16}
                  rx="1"
                  fill="none"
                  stroke="#344b65"
                />
              </g>
            ))}
          </g>
          <g>
            {TREES.map(([x, y], index) => (
              <g key={index}>
                <circle cx={x + 2} cy={y + 3} r="10" fill="#1b3438" />
                <circle
                  cx={x}
                  cy={y}
                  r="9"
                  fill={index % 3 ? "#25463f" : "#2d4b47"}
                  stroke="#385650"
                />
              </g>
            ))}
          </g>
          <g className="map-road-label">
            <text x="446" y="398">
              RING ROAD
            </text>
            <text x="990" y="776">
              SOUTH WALK
            </text>
            <text x="515" y="512">
              CAMPUS GREEN
            </text>
            <text x="702" y="71">
              UNIVERSITY OF WATERLOO
            </text>
          </g>
        </g>
        {BUILDINGS.map((building) => {
          const severity = statuses[building.zone];
          const risky = severity === "elevated" || severity === "high";
          const node =
            NODES[building.zone === "residence" ? "village" : building.zone];
          return (
            <g
              key={building.zone}
              className={`map-zone zone-${severity} ${selected === building.zone ? "selected-zone" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Select ${building.label}`}
              onClick={() => onSelect(building.zone)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(building.zone);
                }
              }}
            >
              <title>
                {building.label}:{" "}
                {severity === "normal"
                  ? "No combined anomaly"
                  : severity === "watch"
                    ? "Correlating sensors"
                    : "Flagged zone"}
              </title>
              {(risky || severity === "watch") && (
                <g
                  className="risk-overlay"
                  data-testid={`risk-${building.zone}`}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="105"
                    className="risk-fill"
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="105"
                    fill="url(#risk-lines)"
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="105"
                    className="risk-boundary"
                  />
                </g>
              )}
              <rect
                x={building.x + 5}
                y={building.y + 6}
                width={building.w}
                height={building.h}
                rx="4"
                className="building-shadow"
              />
              <rect
                x={building.x}
                y={building.y}
                width={building.w}
                height={building.h}
                rx="4"
                className="building-roof"
              />
              <rect
                x={building.x + 10}
                y={building.y + 10}
                width={building.w - 20}
                height={building.h - 20}
                rx="2"
                className="roof-detail"
              />
              <text
                x={building.x + building.w / 2}
                y={building.y + building.h / 2 + 5}
                className="building-code"
              >
                {ZONES.find((zone) => zone.id === building.zone)?.short}
              </text>
              <text
                x={building.x + building.w / 2}
                y={building.y + building.h + 26}
                className="building-label"
              >
                {building.label}
              </text>
            </g>
          );
        })}
        {rerouted && (
          <path
            className="original-route"
            d={original.path}
            data-testid="original-route"
          />
        )}
        {route && route.nodes.length > 1 && (
          <g
            key={route.path}
            className="recommended-route"
            data-testid="recommended-route"
          >
            <path className="route-halo" d={route.path} />
            <path className="route-line" d={route.path} pathLength="1" />
            <circle
              r="6"
              fill="#f2ecdf"
              stroke="#8297c2"
              strokeWidth="3"
              className="route-traveller"
            >
              <animateMotion
                dur="9s"
                repeatCount="indefinite"
                path={route.path}
              />
            </circle>
          </g>
        )}
        {BUILDINGS.filter((building) =>
          ["high", "elevated", "watch"].includes(statuses[building.zone]),
        ).map((building) => {
          const node =
            NODES[building.zone === "residence" ? "village" : building.zone];
          return (
            <g
              key={building.zone}
              className={`incident-marker zone-${statuses[building.zone]}`}
              transform={`translate(${node.x + 17} ${node.y - 46})`}
              role="button"
              tabIndex={0}
              aria-label={`Open ${building.label} incident`}
              onClick={() => onSelect(building.zone)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(building.zone);
                }
              }}
            >
              <circle r="20" fill="#f2ecdf" />
              <circle r="16" className="incident-marker-fill" />
              <text
                y="6"
                textAnchor="middle"
                fill="#f2ecdf"
                fontSize="22"
                fontWeight="700"
              >
                !
              </text>
            </g>
          );
        })}
        <g
          className="location-marker"
          transform={`translate(${start.x} ${start.y})`}
        >
          <circle r="21" fill="#8297c2" opacity=".12" />
          <circle r="12" fill="#8297c2" stroke="#f2ecdf" strokeWidth="4" />
          <rect
            x="-32"
            y="26"
            width="64"
            height="27"
            rx="5"
            fill="#f2ecdf"
            stroke="#d9d5c9"
          />
          <text y="44" textAnchor="middle">
            You
          </text>
          <title>
            {PLACES.find((place) => place.id === origin)?.name}, simulated
            current location
          </title>
        </g>
        {origin !== destination && (
          <g
            className="destination-marker"
            transform={`translate(${end.x} ${end.y})`}
          >
            <path
              d="M0 0C-3-6-17-16-17-29a17 17 0 1 1 34 0C17-16 3-6 0 0Z"
              fill="#253954"
              stroke="#f2ecdf"
              strokeWidth="3"
            />
            <circle cy="-29" r="5" fill="#f2ecdf" />
            <title>
              {PLACES.find((place) => place.id === destination)?.name}
            </title>
          </g>
        )}
      </svg>
      <div className="map-tools" aria-label="Map controls">
        <button
          onClick={() => setZoom((value) => Math.min(2.8, value + 0.25))}
          aria-label="Zoom in"
          title="Zoom in"
          disabled={zoom >= 2.8}
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setZoom((value) => Math.max(0.7, value - 0.25))}
          aria-label="Zoom out"
          title="Zoom out"
          disabled={zoom <= 0.7}
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          aria-label="Fit campus"
          title="Fit campus"
        >
          <LocateFixed size={18} />
        </button>
      </div>
      <div className="map-compass">
        <ArrowUp size={20} />
        <span>N</span>
      </div>
      <div className="map-legend">
        <span>
          <i className="recommended-key" />
          Recommended
        </span>
        {rerouted && (
          <span>
            <i className="original-key" />
            Original
          </span>
        )}
        <span>
          <i className="risk-key" />
          Flagged area
        </span>
      </div>
      <span className="map-attribution">
        <Navigation size={11} />
        Campus schematic / Simulated routes
      </span>
    </div>
  );
}
