# Logithon 2026 submission: One Shipment, One Digital Platform

**Team:** Team Outliers

**Problem statement:** Digital Logistics Connectivity & Collaboration

| File | What it is |
| --- | --- |
| `Logithon2026_TeamOutliers_OneShipment.pptx` | The 12-slide deck. Each slide carries a timed presenter script in its speaker notes. |
| `Logithon2026_TeamOutliers_OneShipment.pdf` | The same deck as a PDF. |
| `OneShipment_Video_3min.mp4` | **The 3-minute narrated video** at 1920×1080 and 60 fps, in three parts: <br>• 0:00–1:19, the motion explainer; <br>• 1:19–2:49, a walkthrough of the real deck and prototype, where the camera zooms into each key diagram and screen with a spotlight and a key-point caption while the voiceover explains it; <br>• 2:49–3:00, the closer and end card. |
| `narration_3min.txt` | The full voiceover script for the 3-minute video, with timestamps. |
| `walkthrough/` | The sources for part 2: the page template and build script, the timing files, the narration and assembly scripts, and the prototype capture script. |
| `OneShipment_Explainer.mp4` | The 90-second **narrated** motion explainer on its own, at 1920×1080 and 60 fps. A voiceover explains each scene over music. |
| `OneShipment_Explainer_MusicOnly.mp4` | The same video with music only and no voice. Use it under your own narration. |
| `explainer/demo.html` | The source of that explainer. Open it in a browser to play it or scrub through it. |
| `explainer/narration.txt` | The voiceover script with each line's start time. |
| `explainer/` (other files) | The page template, the build and render scripts, and `narrate.py` (the voiceover generator). |

The voiceover is synthetic. It uses Piper, an open-source neural text-to-speech engine, with the `en_US-lessac-high` voice. Each line is timed to its scene, and the music ducks under the voice. The mix is normalised to −16 LUFS.

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

## Regenerating the 3-minute video

1. Render the explainer, as described in the next section.

2. Render the slides at high resolution:

   ```bash
   pdftoppm -jpeg -scale-to-x 3200 -scale-to-y 1800 Logithon2026_TeamOutliers_OneShipment.pdf walkthrough/img/slide
   ```

3. Capture the prototype screens with `walkthrough/capture-prototype.cjs`, with the dev server running. Save them as JPEGs in `walkthrough/img/`.

4. Synthesize the walkthrough narration. This sets the segment timings in `segments.json`:

   ```bash
   python narrate_b.py
   ```

5. Build the walkthrough page:

   ```bash
   node build.cjs segments.json
   ```

6. Render it:

   ```bash
   node ../explainer/render.cjs walkthrough.html wt.mp4 60 4 4
   ```

7. Join the explainer, walkthrough and closer, mix the narration over ducked music, and normalise to −16 LUFS:

   ```bash
   python assemble.py <work dir>
   ```

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

To regenerate the voiceover:

1. Install Piper:

   ```bash
   pip install piper-tts
   ```

2. Download `en_US-lessac-high.onnx` and its `.json` file from `huggingface.co/rhasspy/piper-voices`.

3. Run the generator. It writes one WAV per line and `lines.json` with the start times:

   ```bash
   python narrate.py en_US-lessac-high.onnx
   ```

4. Delay each line to its start time, duck the music under the voice with ffmpeg's `sidechaincompress`, and normalise the mix with `loudnorm`.
