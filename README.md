# BlindSpot

A map-first, privacy-first campus routing prototype for Verkada x UW Blueprint **Build for Safety**.

**Sensor metadata -> corroborated zone risk -> recommended reroute.**

## Run

```sh
npm install
npm run dev
npm test
npm run build
```

Open the local URL printed by Vite. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

## Quick Demo

1. Start with **South entrance -> Dana Porter Library**, **Safety-Aware**, and **Normal**.
2. Select **After-hours risk** in **TEST**. Motion, access and audio immediately flag Engineering 7 and reroute the walk. The original remains dashed.
3. Select **Environmental hazard**. Temperature, air quality and occupancy flag Village 1. Compare Fastest, Weather-Aware, Safety-Aware and Accessible routes.
4. Click a building or incident marker for compact sensor and privacy indicators. Both panels minimize; the map supports drag, zoom and reset.
5. Hold the bottom **Alert campus police** button for three seconds, release, then tap that same button three times. It shows **Alert sent** with simulated location sharing. Release early or hold again while armed to cancel. No real dispatch occurs.

## Main Files

- `src/App.tsx`: two collapsible panels, scenario replay, route controls and simulated alert consent.
- `src/CampusMap.tsx`: full-screen interactive campus schematic, zone overlays, markers and route animation.
- `src/map.css`, `src/navigation.css`, `src/blindspot.css`: map components, mobile navigation, navy/cream theme and wider desktop layout.
- `src/EmergencyButton.tsx`: hold-to-arm, triple-tap confirmation, cancellation and mock location sharing.
- `src/lib/engine.ts`: privacy allowlist and existing deterministic sensor-fusion rules.
- `src/lib/routing.ts`: walking graph and Dijkstra shortest-path routing with flagged zones excluded.
- Test files cover privacy/fusion, route changes, blocked endpoints, displayed risk boundaries, panel controls and alert confirmation.

## Prototype Boundaries

The campus schematic, walking paths, distances, times, current position and sensor events are illustrative. This is not a real navigation or emergency-dispatch service. No devices, police backend, GPS, credentials or LLM are connected.

Both fusion rules require three distinct modalities in the same zone within 120 seconds of simulated time. Demo thresholds are not calibrated emergency thresholds. Raw identifiers and media references are dropped by an explicit allowlist; occupancy is grouped into ranges. State lives only in browser memory.

Routing uses `dijkstrajs`. Fastest prioritizes distance and shows detected route risk. Weather-Aware excludes environmental hazards; Safety-Aware excludes all detected risks. Accessible also avoids stairs and prioritizes paved paths, gentle slopes and step-free entrances. These accessibility attributes are simulated. Blocked endpoints produce no route in the applicable modes.

To connect real sensor metadata, replace the simulator with an adapter returning `SensorReading[]`, normalize every reading through `normalizeReading`, and pass only `SafeEvent[]` to the fusion engine. Fonts are bundled locally; the demo needs no external requests after startup.
