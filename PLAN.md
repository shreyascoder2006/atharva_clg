# One Shipment, One Digital Platform: Implementation Plan

A light-themed command centre that connects the Exporter, Freight Forwarder, Customs Broker (CHA) and Transporter around a single live export shipment: **Chakan (Pune) → JNPT → Red Sea / Suez → Rotterdam → Duisburg**.

## Phase 0: What already exists

| Area | Finding |
| --- | --- |
| Build | Vite 7, React 19.2, TypeScript 5 (strict, `noUnused*`), Tailwind v4 via `@tailwindcss/vite`, alias `@/* → src/*` |
| 3D engine | three 0.186 + @react-three/fiber 9 + drei 10 (`CameraControls`, `Html`, `Stars`) + @react-three/postprocessing (Bloom, Vignette) |
| State | Zustand 5 (`store/ui.ts` for UI state and the playhead, `store/sim.ts` for the climate engine) |
| Globe core | `GlobeScene.tsx` holds the Canvas and a globe group with `GlobeCore` (opaque sphere), `Graticule` (wireframe sphere) and `LandDots` (9,796 Fibonacci land dots from `data/globe-dots.json`, custom point shader), plus `Atmosphere` (BackSide Fresnel rim shader). `lib/geo.ts` has `latLonToVector3`. The arcs use TubeGeometry with a shader-driven reveal and comet. |
| Domain layers | `CompanyMarkers`, `HazardFootprint`, `PropagationArcs` and `HoverLabel` all depend on the CLIMATRIX climate engine (`src/engine`). |
| Unreachable code | `pages/`, `layout/`, `workspace/`, `components/graph/`, `ScenarioConsole`, `PresentationOverlay`, `store/useScenarioStore` and most of `lib/` are never imported from `main.tsx`. |
| Baseline health | `npm run build` **fails**: TS6133 unused imports in the orphaned `workspace/` module. There is no lint script and no test script. |

## Decisions

1. **Keep the globe core and restyle it** for the light studio look:
   - `GlobeCore` becomes a lit, matte ice-blue sphere carrying an off-white land texture. The texture is generated at runtime from precomputed Natural Earth paths, plus a high-resolution detail texture for the Western India region where the Customs Broker and Transporter camera zones sit.
   - `Graticule` becomes clean latitude/longitude line loops instead of a triangulated wireframe.
   - `LandDots` keeps its geometry and shader structure but uses normal blending, a slate tint and LOD fading.
   - `Atmosphere` uses normal blending and a soft cobalt-white rim.
   - Stars, Bloom and Vignette are removed. They read as "dark space" and wash out a light background. Native MSAA comes back now that the composer is gone.
2. **Replace the climate domain** (engine, climate layers, pages and data) with the logistics domain. The verbatim original stays in the first commit (`d23708b`), so nothing is lost.
3. **Camera choreography**: the globe group stops spinning. Geography is fixed in world space and the camera moves instead, which keeps `geo → world` deterministic for flights, pins and labels. `CameraControls` stays as the input layer. A custom tween flies the camera between role zones along great circles with an altitude bump. A screen-space `setViewOffset` keeps the globe centred in the area the HUD leaves free.
4. **One Zustand store** (`store/shipment.ts`) holds the role, lens, clock, scrub time, actual milestone completions, document state, disruption and recovery state, escrow, the sonar queue, toasts and the activity feed. **Pure functions** in `lib/schedule.ts` derive the leg schedule, the cargo position at any hour, milestone states, the baton holder and escrow states. They are unit-tested with Vitest.
5. **No backend.** All data is pre-seeded in `data/shipment.ts`: fictional parties, real UN/LOCODEs and coordinates, an ISO 6346-valid container number and GLEC-style emission factors.

## Phased file-level plan

### Phase 1: Foundation and cleanup
- Delete the climate-only modules: `src/engine`, `src/pages`, `src/workspace`, `src/layout`, `src/components/graph`, `ScenarioConsole`, `PresentationOverlay`, `PageHeader`, the old climate stores and libs, the climate JSON, `public/geo`, `data/` and the climate `docs/`.
- `package.json`: drop unused dependencies (maplibre, react-map-gl, xyflow, dagre, echarts, recharts, router, postprocessing, fontsource, duplicate framer-motion). Add the `typecheck`, `lint` and `test` scripts and the ESLint flat config.
- `src/index.css`: light design tokens (`#F4F7FB → #E6EEF8` studio gradient, ink and slate text, cobalt, emerald, amber and crimson) and `.glass` liquid-glass surfaces.
- `index.html`: title and metadata.

### Phase 2: Data, schedule and store
- `src/data/shipment.ts`: parties, nodes, leg geometry (route variants: expressway / NH-48 / rail; Suez / Cape / sea-air), milestones, documents (with the seeded **12,400 kg vs 12,850 kg** gross-weight discrepancy), escrow, port congestion, ULIP connectors, disruption scenarios and AI recovery options.
- `src/lib/geo.ts` (extended): slerp, great-circle densify, haversine distance.
- `src/lib/route.ts`: dense route polylines with an altitude profile (elevated hops between chokepoints, and road and rail hugging the ground).
- `src/lib/schedule.ts`: pure schedule and position logic. `src/lib/schedule.test.ts` covers it.
- `src/store/shipment.ts`: the store and all actions (role, lens, scrub, resolve documents, gate-in, clearance, disruption, recovery, reset).

### Phase 3: Globe spatial layer
- `components/globe/GlobeScene.tsx`: Canvas, studio lights with camera-following key-light shadows, and layer composition.
- `globe/landTexture.ts` and `scripts/gen-land-paths.mjs` → `data/land-paths.json`: the land and coastline textures.
- `globe/CameraRig.tsx`: role-zone flights, constraints, view offset, idle sway and the dive.
- `globe/CorridorArcs.tsx`: luminous multi-modal arcs (core plus halo tubes), tracer comets, completed and forecast colouring, crimson alert ranges, the carbon heatmap and a draw-on reroute.
- `globe/SonarField.tsx`: expanding concentric surface ripples.
- `globe/CongestionPillars.tsx`: translucent light columns whose height follows dwell time and whose colour follows congestion.
- `globe/CargoMarker.tsx`: the cargo marker and the 3D-anchored frosted telemetry pin.
- `globe/UlipPulse.tsx`: API connector nodes and data beams feeding a platform hub.
- `globe/PlaceLabels.tsx`: hub labels with horizon occlusion.

### Phase 4: HUD
- `hud/TopBar.tsx` (shipment card, toolbar), `hud/RoleSwitcher.tsx` (frosted pill with a sliding indicator).
- `hud/WorkspacePanel.tsx`: the role-morphing, RBAC-filtered actions, documents and KPIs, and the live feed.
- `hud/LensDock.tsx` and `hud/LensCard.tsx`: Operations, Risk / Demurrage, Carbon (Scope 3) and ULIP / API Pulse.
- `hud/TimelineScrubber.tsx` (−48h → LIVE → +96h) and `hud/EscrowBar.tsx`.
- `hud/DisruptionMenu.tsx`, `hud/DemurrageCounter.tsx`, `hud/CoPilotCard.tsx`, `hud/Toasts.tsx`.

### Phase 5: Modals and simulators
- `xray/DocXrayModal.tsx`: three paper cards, measured SVG Bézier connectors, the discrepancy pulse, and "Resolve with AI & Re-Sync" with a real SHA-256 (WebCrypto) e-BL stamp.
- `twin/CargoTwinModal.tsx` and `twin/ContainerScene.tsx`: the orbital-to-container dive, a 40′HC wireframe cutaway on a studio grid, pallets by inspection status, and live IoT sparklines.
- `phone/DriverPhone.tsx`: the magic-link driver chat. Gate-in sends an emerald sonar at JNPT, passes the baton to the CHA and releases the escrow.

### Phase 6: Verification
- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.
- Start the dev server and run a Playwright smoke script that walks through each role, the X-Ray fix, a disruption and its recovery, the driver gate-in and the twin. It fails on any console error and takes screenshots for visual tuning.
