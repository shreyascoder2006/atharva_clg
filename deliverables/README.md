# Logithon 2026 submission: One Shipment, One Digital Platform

**Team:** Team Outliers

**Problem statement:** Digital Logistics Connectivity & Collaboration

| File | What it is |
| --- | --- |
| `Logithon2026_TeamOutliers_OneShipment.pptx` | The 12-slide deck. Each slide carries a timed presenter script in its speaker notes. |
| `Logithon2026_TeamOutliers_OneShipment.pdf` | The same deck as a PDF. |
| `OneShipment_Explainer.mp4` | An 89-second motion explainer of the deck and prototype, at 1920×1080 and 60 fps with music. |
| `explainer/demo.html` | The source of that explainer. Open it in a browser to play it or scrub through it. |
| `explainer/` (other files) | The page template, build and render scripts used to regenerate the MP4. |

## What Logithon asks for, and what is still yours to do

The first round needs:
- a PPT of 8 to 12 slides;
- a **2 to 3 minute video** that is a screen recording of the PPT, with team members presenting and explaining the methodology, concepts and tech stack;
- the video uploaded to YouTube or Google Drive, with a shareable link.

Send everything to logithon@softlinkglobal.com.

The motion explainer is not that recording. You can use it as an opener or a demo cut inside your recording, or share it alongside. The recording with your voices still has to be made by the team:

1. Open the PPTX in Presenter View, so the speaker notes show only to you.
2. Start a screen recording (for example, the OBS, Windows Game Bar or macOS Screenshot toolbar recorder). Include the microphone.
3. Read the notes for each slide. They add up to about 2 min 40 s.
4. Optionally, play `OneShipment_Explainer.mp4` (or part of it) at the start or end.
5. Upload the recording to YouTube (unlisted) or Google Drive (anyone with the link can view) and paste the link into the submission email.

## Presenter script (also in the speaker notes)

| Slide | Time | Say |
| --- | --- | --- |
| 1 · Title | ~15 s | We're Team Outliers. Our problem statement is Digital Logistics Connectivity and Collaboration. Our answer is One Shipment, One Digital Platform: a live, shared command centre where the exporter, freight forwarder, customs broker and transporter run one export shipment together. |
| 2 · Problem | ~15 s | India's logistics cost is about 8% of GDP, and only 1.2% of bills of lading are electronic. ULIP already connects 43 government systems through 129 APIs, yet the shipment still runs on email, WhatsApp and Excel. In our seeded case, one 450 kg typo rolls a container by 96 hours and costs $4,228. |
| 3 · Root causes | ~12 s | No single record, re-keyed documents, unproven handoffs, money waiting on paper, late visibility, and integrations outside the workflow. The rails exist; the missing piece is one shared, role-aware record. |
| 4 · Solution | ~15 s | One shipment record at the centre. Four roles write to it, and six capabilities read from it: AI document X-Ray, proof-based escrow, ULIP events, recovery co-pilot, partner marketplace, carbon accounting. |
| 5 · Workspaces | ~12 s | Seven workspaces on one store, so an action in one shows up in all the others instantly. |
| 6 · Methodology | ~15 s | We mapped one real export lane, modelled it as a pure, unit-tested schedule engine, visualised it in 3D, connected seven workspaces, automated the decisions, and verified everything with 41 unit tests and browser smoke runs. |
| 7 · Architecture | ~15 s | Parties and ULIP rails feed an integration layer, and a pure core engine derives milestones, baton and escrow. Intelligence and experiences read from it, and trust wraps it all. React 19, TypeScript, three.js and React Three Fiber, Zustand, Vitest, Playwright. |
| 8 · Baton relay | ~12 s | Sixteen milestones, five of which need proof. Four payouts each release on their own proof, and the e-BL carries a SHA-256 hash chain. |
| 9 · AI logic | ~15 s | X-Ray sides with physical evidence at 97% confidence. The co-pilot prices each reroute through the same engine as the map. Partner scores are transparent weighted sums, and the what-if prices a delay before it happens. |
| 10 · Carbon + ULIP | ~12 s | Carbon is tracked per leg with GLEC-style factors (1.59 t), and greener modes cut it by 21.3%. ULIP connectors arrive as milestone events. |
| 11 · Impact | ~12 s | Software only. We pilot one lane with one exporter and three partners, partners join free, and the network grows like a flywheel, aligned with the National Logistics Policy. |
| 12 · Team | ~8 s | That's One Shipment, One Digital Platform. Thank you from Team Outliers. |

## Notes on the numbers

The figures for India and the industry are cited on slide 2 and listed on slide 12:
- DPIIT–NCAER 2025
- World Bank LPI 2023
- DCSA 2023
- McKinsey
- Ministry of Commerce, March 2025

The shipment figures come from the prototype's seeded demo data:
- the 12,400 vs 12,850 kg mismatch;
- the escrow amounts;
- the Red Sea options;
- partner scores;
- CO₂e per leg;
- ULIP latencies.

Demurrage tariffs, partner quotes and the ULIP connectors are illustrative.

## Regenerating the explainer

```bash
cd deliverables/explainer
```

```bash
npm i @fontsource/inter @fontsource/fraunces @fontsource/jetbrains-mono react react-dom react-icons playwright
```

```bash
node build.cjs
```

```bash
node render.cjs demo.html OneShipment_Explainer.mp4 60 4 4
```

`build.cjs` inlines the fonts, icons and demo hash from `template.html` into `demo.html`. The render needs `ffmpeg` on the PATH.
