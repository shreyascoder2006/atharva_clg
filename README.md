# One Shipment · One Digital Platform

A light-themed 3D command centre for **Digital Logistics Connectivity & Collaboration**. The Exporter, Freight Forwarder, Customs Broker (CHA) and Transporter all work around one live export shipment: **Chakan (Pune) → JNPT → Red Sea / Suez → Rotterdam → Duisburg**.

Two more live shipments share the globe with it: **SHP-2611-0519**, a cold-chain air shipment from Bengaluru to Frankfurt, and **SHP-2611-0494**, a sea shipment from Surat via Mundra to Jebel Ali that is under a customs hold. Four ambient trade corridors also run in the background.

It is built on the `fusion_earth` globe. The original Fibonacci land-dot sphere, atmosphere and camera controls are kept and restyled for an architectural light studio, then extended with a logistics spatial layer. There is no backend: every interaction runs on a pre-seeded client-side store.

## Run it

Requires Node 22.5+.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck (`tsc -b`) + production build |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint (typescript-eslint + react-hooks + react-refresh) |
| `npm test` | Vitest unit tests for the schedule engine, ISO 6346 and SHA-256 |
| `npm run gen:land` | Regenerates `src/data/land-paths.json` and `src/data/vectors.json` from Natural Earth (dev dependency) |
| `npm run gen:dots` | Regenerates the original globe dot matrix |

## A two-minute demo

1. **Exporter** (opening view). Look at the global corridor. The compact pin rides the truck near Chakan, and the escrow bar shows the CHA payout *Blocked* by a document mismatch.
2. **X-Ray** (toolbar). The Commercial Invoice says `12,400 kg` and the Packing List says `12,850 kg`, linked by a crimson connector. Click **Resolve with AI & Re-Sync**: the invoice is amended, every connector turns emerald, and the e-BL is stamped with a real SHA-256 of its reconciled content.
3. **Transporter** (press `4`). The camera flies down to the Pune → JNPT road. Open the **driver phone** (bottom-left) and tap **Upload Gate-In Photo & Confirm Arrival**. The truck drives to the gate, an emerald sonar fires at JNPT, ₹18,500 is released from escrow and the baton passes to the CHA.
4. **Customs Broker** (press `3`). This is a close-up of the JNPT gate. **File for clearance · LEO** releases the CHA escrow and hands the baton to the forwarder.
5. **Simulate → Red Sea Security Advisory**. Bab-el-Mandeb turns crimson and the demurrage counter starts ticking at $2,300/day. The AI Co-Pilot compares *Cape of Good Hope* (+11d, $1,850) with *Sea-air via Jebel Ali* (−13d, $6,400, ×25 CO₂e). The engine calculates both options. **Execute** redraws the corridor and broadcasts the new ETA to all four roles.
6. **Lens dock**: switch between *Risk* (congestion pillars, cutoff), *Carbon* (emerald-to-amber heatmap with a per-shipment badge) and *ULIP* (FASTag, ICEGATE, VAHAN and Port Gate beams feeding the platform hub).
7. **Timeline**: drag into the forecast, or press **Play forecast**. The ship sails, milestones turn pale emerald and escrow shows *Releases on forecast*.
8. **Twin**: click the cargo marker. The camera dives from orbit into a wireframe 40′HC cutaway, with pallets coloured by inspection state and live temperature, humidity, shock and tilt telemetry.

### The network and zoom detail

9. **Shipments tab** (left sidebar). Pick any of the three shipments, or click its route on the globe. The selected corridor turns luminous, with tracer pulses, waypoint rings and its vehicle. The others thin out to 35 % opacity. The camera flies to the selected shipment, and the right panel, top bar, timeline and pin all switch to its parties, documents, KPIs and escrow.
10. **SHP-2611-0494 · Customs hold.** Mundra glows crimson. As the CHA (or the exporter), click **Answer RMS query** or **AI brief**. A sonar fires at Mundra, LEO is granted and the box makes the 112E cutoff instead of rolling 48 hours.
11. **Zoom in.** Scroll down towards a port. As you descend:
    - the ocean picks up a glossy sheen and micro-wave shimmer;
    - land gets matte relief;
    - shelf water tints paler and coastlines and borders sharpen;
    - the dot marker becomes an oriented low-poly ship, aircraft or truck, with a wake or contrail.
12. **Port dioramas.** As the camera comes within about 480 km of a port, the following fade in as terminal models (fully visible by about 200 km):
    - JNPT;
    - Mundra;
    - Rotterdam;
    - Jebel Ali;
    - the Suez Canal, with a moving convoy.

    Each has piers, colour-coded container stacks, gantry cranes with moving trolleys, water ripples and micro-labels (`Berth 4 · JNPT`, `Gate-In Lane`, `Customs Yard`).

Shortcuts: `1`–`4` switch roles and `Esc` closes overlays. In the timeline, `←`/`→` (with `Shift` for 6h steps), `Home`/`End`, and `L` returns to live.

## Architecture

```
src/
  data/shipment.ts          Seeded universe: parties, places, routes, milestones, documents,
                            escrow, disruptions + recovery options, ports, ULIP connectors
  data/fleet.ts             The three live shipments (parties, camera zones, docs, escrow)
                            and the four ambient corridors
  data/vectors.json         Coastline / border polylines (lazy-loaded chunk)
  lib/fleet.ts              Schedules for the air shipment and the Mundra customs hold
  lib/schedule.ts           Pure time model: legs, cargo position at any hour, milestone
                            status, baton holder, escrow; unit-tested
  lib/route.ts              Dense route polylines with elevated hops between chokepoints
  store/shipment.ts         Single Zustand store + actions; useSchedule / usePlan hooks
  components/globe/         R3F scene: restyled globe core with LOD surface shader, camera
                            rig, corridor arcs, vehicles, route picking, vector lines,
                            port dioramas, sonar, pillars, ULIP pulse, anchor projector
  components/overlay/       DOM labels and the telemetry pin, pinned to 3D anchors
  components/hud/           Top bar, role switcher, workspace panel, lens dock/cards,
                            timeline + escrow, Co-Pilot, toasts
  components/xray/          Document X-Ray modal
  components/twin/          Orbital-to-container cargo twin (lazy-loaded)
  components/phone/         Driver magic-link simulator
```

Design decisions that matter:

- **One schedule, many views.** The globe, pin, timeline, escrow, baton, KPIs and Co-Pilot all derive from `buildSchedule()`, so a disruption or recovery can never leave two views disagreeing. The Co-Pilot runs each recovery option through the same function, which means the trade-offs on the card are exactly what the arc shows after execution.
- **The camera moves; the planet stays put.** Geography is fixed in world space, flights travel along great circles with an altitude bump, and a screen-space `setViewOffset` keeps the globe centred in the space the HUD leaves free.
- **Screen-space tubes.** The arcs are re-inflated in the vertex shader to a pixel width, and the shadow pass uses the same inflation. Routes stay crisp from orbit down to the JNPT gate, and their shadows match.
- **No `<Html>` roots.** drei's `<Html>` creates a React root per label, which React 19 reports as an error when it unmounts. Overlays live in the normal DOM tree and a single in-Canvas projector writes their transforms.
- **Level of detail from altitude.** `frame.ts` computes the camera altitude once per frame, and every LOD blend reads from it: vehicles, coastlines, borders, detail coastlines, waves, fine relief, arc thinning and the height of ground legs. Each effect cross-fades rather than popping in. The globe material is a `MeshStandardMaterial` patched with `onBeforeCompile`. A land/coast/shelf mask (a global texture plus six high-resolution port patches) drives roughness, shelf tint and a procedural bump, and its normal is perturbed with screen-space derivatives. A patch is sampled only when the camera is low enough to need its resolution and the patch faces the camera. The switch is a uniform branch, so mip selection stays valid and orbit views skip six anisotropic fetches per pixel.
- **Picking in screen space.** The arcs are inflated in the vertex shader, so raycasting their thin geometry would miss. Instead, route samples are projected and the pointer is tested against each segment in pixels, skipping anything behind the globe.
- **Light studio.** Tone mapping is off, so material colours hit the same hex values as the CSS tokens. Postprocessing and the starfield were removed, and native MSAA is back.

## Notes

- The data is fictional: companies, people, vessel and document numbers. Coordinates, UN/LOCODEs and ULIP connector names are real. The container number passes ISO 6346 check-digit validation.
- Demurrage accrues on a demo clock (1 s = 1 h) so the counter visibly moves. Everything else runs on real time from page load.
- The land relief is procedural noise shaped by the land mask, not a real elevation model. Container yards and cranes are stylised, not surveyed layouts.
- Zoom uses the existing `camera-controls` rig, damped through `smoothTime`, rather than OrbitControls. Orbit and dolly speeds scale with altitude, and the minimum distance stops 16–20 km above the surface.
- The original CLIMATRIX climate modules are preserved verbatim in the first commit of this branch.
