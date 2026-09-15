# Campus Signal

A privacy-first campus safety prototype for the Verkada x UW Blueprint **Build for Safety** hackathon.

**Sensor readings -> allowlisted anonymous metadata -> multi-modal fusion -> explainable human review.**

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

```sh
npm test       # Fusion/privacy checks and the interactive React workflow
npm run build # TypeScript check and production bundle in dist/
```

## 60-Second Demo

1. Select **Normal activity**. Events arrive, the campus remains normal, and no intervention is indicated.
2. Select **After-hours anomaly**. Engineering 7 receives anonymous occupancy, motion, an unexpected door opening, and a sound anomaly. Watch the status move through **Observing** to **Elevated** as evidence accumulates.
3. Open **Review evidence & privacy**. Point out the three contributing modalities, shared zone, 120-second window, rule, recommended human check, and discarded personal fields. **Mark as reviewed** records a demo acknowledgement without dispatching anything.
4. Select **Dana Porter Library**. Its local evidence is normal while the campus-level alert remains visible.
5. Select **Environmental hazard**. Village 1 combines temperature, air quality, and remaining occupancy into a possible hazard.

## Main Files

- `src/lib/engine.ts`: simulated readings, privacy transformation, and deterministic fusion rules.
- `src/App.tsx`: the single-page command center, zone schematic, replay lifecycle, evidence audit, and review interaction.
- `src/styles.css` and `src/layout.css`: visual components and responsive working layout.
- `src/lib/engine.test.ts` and `src/App.test.tsx`: 12 tests covering the rules, privacy boundary, and complete UI workflow.

## Prototype Boundaries

- All sensor readings are simulated. The building schematic and sensor inventory are illustrative. No Verkada API, devices, raw recordings, or personal identities are connected.
- To connect real inputs, replace the simulator with an adapter returning `SensorReading[]`, pass every reading through `normalizeReading`, and feed only the resulting `SafeEvent[]` into state and `fuseEvents`.
- The normalizer validates and copies an explicit field allowlist. Occupancy is grouped in five-person ranges; extra fields, credentials, media references, and identifiers are dropped. No facial recognition or audio transcription runs.
- Both alert rules require three distinct modalities in the same zone within 120 seconds. Repeated, future, stale, and cross-zone events cannot supply missing corroboration. A newer observation replaces an older observation of the same modality.
- Environmental thresholds are illustrative demo values, not calibrated emergency thresholds. Evidence counts are not probabilities, and alerts do not confirm threats or identify people.
- Events exist in browser memory only. Scenario changes replace them; reload recreates the default synthetic scenario. Simulated time is fixed per scenario for repeatable demos; the two-minute rule is an evidence window, not a wall-clock deletion timer.
- No backend, database, credentials, analytics, storage, or LLM is required. Fonts and application assets are bundled locally. No external requests are needed during the demo after startup.
