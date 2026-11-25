# One Shipment · One Digital Platform

A light-themed 3D command centre for **Digital Logistics Connectivity & Collaboration**. The Exporter, Freight Forwarder, Customs Broker (CHA) and Transporter all work around one live export shipment: **Chakan (Pune) → JNPT → Red Sea / Suez → Rotterdam → Duisburg**.

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
| `npm run gen:land` | Regenerates `src/data/land-paths.json` from Natural Earth (dev dependency) |
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

Shortcuts: `1`–`4` switch roles and `Esc` closes overlays. In the timeline, `←`/`→` (with `Shift` for 6h steps), `Home`/`End`, and `L` returns to live.

## Architecture

```
src/
  data/shipment.ts          Seeded universe: parties, places, routes, milestones, documents,
                            escrow, disruptions + recovery options, ports, ULIP connectors
  lib/schedule.ts           Pure time model: legs, cargo position at any hour, milestone
                            status, baton holder, escrow; unit-tested
  lib/route.ts              Dense route polylines with elevated hops between chokepoints
  store/shipment.ts         Single Zustand store + actions; useSchedule / usePlan hooks
  components/globe/         R3F scene: restyled globe core, camera rig, corridor arcs,
                            sonar, pillars, ULIP pulse, cargo marker, anchor projector
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
- **Light studio.** Tone mapping is off, so material colours hit the same hex values as the CSS tokens. Postprocessing and the starfield were removed, and native MSAA is back.

## Notes

- The data is fictional: companies, people, vessel and document numbers. Coordinates, UN/LOCODEs and ULIP connector names are real. The container number passes ISO 6346 check-digit validation.
- Demurrage accrues on a demo clock (1 s = 1 h) so the counter visibly moves. Everything else runs on real time from page load.
- The original CLIMATRIX climate modules are preserved verbatim in the first commit of this branch.
