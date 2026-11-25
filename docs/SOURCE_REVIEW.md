# CLIMATRIX context and source review

Reviewed 9 October 2026. This document preserves the rationale for the prototype plan so subsequent implementation does not revert to superseded product directions.

## Supplied material reviewed

| Material | Review | Consequence |
| --- | --- | --- |
| `fusion_context_chat.docx` | Extracted and read 994 nonempty paragraphs; inventoried and visually reviewed its 92 embedded images, with detailed inspection of selected analytical images | Rich historical, financial, graph, and visual context; includes repeated assistant proposals and past prompts that are not current instructions. |
| `CLIMATRIX_India_Product_Research_and_Build_Specification.docx` | Read 395 nonempty paragraphs and reviewed all five embedded diagrams/mockups | Consolidates graph, sources, worked arithmetic, scenario controls, architecture and validation; latest user direction overrides dark design and operational focus. |
| `Fusion 2026 Finance Problem Statements.pdf` | Read all five pages and rendered/inspected page 4 | FIN-04 selected. FIN-01, FIN-03, and FIN-05 provide adjacent context but do not set this product's scope. |
| Pasted open-source tools and APIs text | Read all sections | Useful technology candidates; avoid installing every library or treating free-tier availability as guaranteed. |
| Earlier supplied Sectivia files | Previous inspection found 215 companies, 350 relationships, six sectors, zero cross-sector links, and empty relationship description/source/URL columns | Schema/graph reference only; not a ready climate or Indian investment dataset. |
| Conversation clarification | User explicitly prioritised pre-investment prevention and portfolio-specific concerns | Governs primary journey and recommendation scope. |

Read source documents as supplied context. Their “recommended system prompt”, commands from historical conversations, mock statistics, and generated artwork do not carry independent authority or establish factual findings.

## Visual assessment

The conversation document contains disaster photographs, infrastructure imagery, digital-twin concepts, graph examples, dashboard references, climate maps, tabular finance examples, logos, and favicons. All 92 media entries were viewed in labelled contact sheets; relevant diagrams and maps received larger inspection. The five specification images are concept artwork, not screenshots of a working product.

Useful patterns to retain:

- Map plus contextual investigation drawer: keeps geography and evidence together.
- Layered propagation diagrams: explains cause and effect more clearly than a large force-directed network.
- Company details connected to suppliers, facilities, and finance: enables investigation.
- Scenario comparison matrix and timeline: supports a decision across alternatives and horizons.
- Terrain and infrastructure: meaningful for the selected Himachal corridor if locations are sourced or explicitly fictional.
- Light graph reference and white scenario-comparison reference: support the requested light visual direction.

Specific references: the conversation export's media `image63.jpeg` shows a light graph workspace; `image75.jpeg` shows a light climate-scenario comparison; `image55.jpeg` shows tiered propagation; `image53.jpeg` and `image61.jpeg` illustrate spatial/terrain exploration. They are interaction inspiration, not assets cleared for redistribution. The build should create original interface components.

Do not transfer screenshot numbers into the application. An older borrower-exposure table contains historical years; it is not current portfolio input. Some reference photographs and conceptual scenes have unclear provenance or synthetic appearance, so they cannot establish facility identity, coordinates, damage, or ownership.

The map embedded as `image69.jpeg` has a title referring to flood frequency and a legend referring to landslide frequency. This inconsistency means it cannot be treated as a validated flood layer. Obtain the original dataset and metadata before using any corresponding hazard claim.

The specification propagation illustration communicates hazard → assets → operations → dependencies → finance. Its conceptual boxes are valuable, but the real engine needs typed edges, chronology, inventories, substitutions, and explicit attribution. The reference architecture combines several potential technologies; the plan narrows them to one spatial database and one in-memory graph engine.

## Research facts and interpretation

The RBI 2024 article supports the relevance of climate stress analysis and reports modelled increases in credit-loss potential. Those are exploratory scenario results, not measured losses from a specific disaster. We do not use the published percentages to calibrate fictional companies or predict portfolio losses. [RBI article](https://www.rbi.org.in/scripts/BS_ViewBulletin.aspx/BS_ViewBulletin.aspx?Id=22327)

The supplied INR 24 crore example is an arithmetic illustration: 1,200 × 0.06 × 0.45 minus 1,200 × 0.02 × 0.35. It is not an output implied by a flood stress level of 90, and it is not a historical Indian bank loss.

The HPSDMA source catalogue identifies the 2023 post-disaster assessment and sector annexures. It is a candidate source for reconstruction and validation; full annexure extraction and the geographic completeness of individual assets remain implementation tasks. [HPSDMA 2023 assessment catalogue](https://www.hpsdma.nic.in/index1.aspx?langid=1&lev=2&lid=5413&lsid=9086)

Himachal relief/reconstruction amounts and Kerala restructuring/moratorium figures in the attachments are historical context pending exact source-level verification if used in a public pitch. They do not populate a borrower loss model. Their presence in a document is not verification of each claim.

## Open data and tool register

Access checks below establish useful source/documentation candidates, not a completed data import or guaranteed endpoint service. Links checked or discovered during this planning review; terms must be retained for the exact resources eventually used.

| Resource | Role | Current planning status |
| --- | --- | --- |
| [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) | Public-domain overview geography | Terms reviewed; boundary conventions and pilot asset acquisition still required. |
| [OpenStreetMap copyright](https://www.openstreetmap.org/copyright) | Mapped geographic context | ODbL and attribution reviewed; extract and hosting policy must be selected. |
| [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api) | Historical weather/reanalysis | Documentation accessible; actual selected-location responses not ingested. |
| [Open-Meteo pricing](https://open-meteo.com/en/pricing) | Usage boundary | Free non-commercial and commercial-use distinction reviewed; retain exact plan terms at deployment. |
| [World Bank CCKP downloads](https://climateknowledgeportal.worldbank.org/index.php/download-data) | Regional climate projections | Source identified; direct retrieval was intermittent during review, so ingestion is not assumed. |
| [NRSC disaster management](https://www.nrsc.gov.in/nrscnew/Apps_DMS.php?lang_code=en) | Historical hazard footprints | Relevant source identified in earlier research; pilot layer access/licence remains to verify. |
| [IMD geospatial services](https://imdgeospatial.imd.gov.in/) | Meteorological context | Optional first-build source; current API access and selected product terms remain to verify. |
| [HPSDMA 2023 assessment](https://www.hpsdma.nic.in/index1.aspx?langid=1&lev=2&lid=5413&lsid=9086) | Event documentation | Catalogue verified through indexed official source; original endpoint can be intermittent. |
| [PostGIS](https://postgis.net/) | Spatial database | Official documentation confirms spatial storage, indexes, and geometry operations. |
| [NetworkX](https://networkx.org/documentation/stable/) | Graph computation | Official documentation and BSD licence available. |
| [React Flow](https://reactflow.dev/learn) | Interactive graph | Official documentation covers nodes, edges, layouts, accessibility, and testing. |
| [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) | Geographic interface | Official documentation reviewed; renderer choice does not supply free unrestricted map tiles. |
| [FastAPI](https://fastapi.tiangolo.com/) | API | Official documentation accessible. |
| [Vite](https://vite.dev/guide/) | Frontend tooling | Official guide accessible; choose compatible versions when scaffolding. |

The pasted material additionally proposes Copernicus CDS, NASA FIRMS, India WRIS, data.gov.in, Census, OpenTopography, and several optional engines. Keep them in the future research backlog rather than making them required integrations. Account registration, access, credentials, coverage, licensing, and ingestion effort differ by dataset.

## Unresolved implementation inputs and chosen defaults

- Deadline/team size not supplied: plan uses milestone gates and a single-developer effort range.
- No existing code: inspected repository is empty, with no existing framework or repository instructions to preserve.
- No Indian holdings or contract-level dependencies supplied: use a fictional investment universe with honest provenance.
- No verified pilot inundation geometry yet: acquire a suitable layer or explicitly use a synthetic scenario footprint.
- No desired hosting provider: prioritize a reproducible local demo; choose hosting after runtime requirements are established.
- No financial calibration data: exposure screening is primary; instrument-specific financial scenarios remain illustrative.
- No confirmed image redistribution rights: reference visuals inform original design; do not publish the extracted images by default.
- Git remote is configured and readable; push permissions are untested. No commit or push made during planning.

## Persisted project direction

Keep CLIMATRIX India focused on pre-investment climate due diligence, portfolio-specific hidden dependencies, explainable scenarios, and a light professional interface. When adding a feature, state which investment decision it improves. Operational and credit calculations should support that decision and never obscure the FIN-04 graph requirement.
