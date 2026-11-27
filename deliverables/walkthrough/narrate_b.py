# Walkthrough narration (deck + prototype). Synthesizes one line per segment and writes
# the segment timeline (start/end inside the 89.6 s walkthrough) to segments.json.
import json, wave
from piper import PiperVoice
try:
    from piper import SynthesisConfig
except ImportError:
    from piper.config import SynthesisConfig

TOTAL = 89.6
SEGS = [
    ('card', 'deck', "Now, let's walk through the deck."),
    ('slide', 2, "Logistics costs India about eight percent of G D P, and only one point two percent of bills of lading are electronic."),
    ('slide', 3, "Our fishbone traces the delays to six root causes, while the rails, like ULIP and e-way bills, already exist."),
    ('slide', 4, "So the solution puts one record at the centre, with four roles and six capabilities around it."),
    ('slide', 6, "We built it in six phases, from discovery to verification, with the same tested loop for every feature."),
    ('slide', 7, "Seven layers sit around a pure schedule engine, built with React, TypeScript, three J S and Zustand."),
    ('slide', 9, "And every AI decision shows its evidence, its formula, and its confidence."),
    ('slide', 11, "It's software only, with a twelve-week pilot on one lane, and a network flywheel to scale."),
    ('card', 'proto', "Now, the working prototype."),
    ('proto', 'tower', "The control tower tracks the live corridor on a 3D globe, with each role's next action on the right."),
    ('proto', 'shipments', "Shipments lists every box with its milestones, status and baton holder."),
    ('proto', 'documents', "The document vault links fields across all three documents, with a SHA-256 chain of custody."),
    ('proto', 'partners', "The marketplace re-ranks forwarder bids live as priorities change."),
    ('proto', 'financials', "Financials shows demurrage exposure, and the escrow pipeline where each payout waits for its proof."),
    ('proto', 'integrations', "And sustainability tracks carbon per leg, with greener modes and a CBAM statement."),
]
LEAD = 0.45   # voice starts this long after the segment begins (after the cross-fade)
voice = PiperVoice.load('en_US-lessac-high.onnx')
durs = []
for i, (_, _, text) in enumerate(SEGS):
    with wave.open(f'b{i:02d}.wav', 'wb') as w:
        voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=0.98, noise_scale=0.6, noise_w_scale=0.75))
    with wave.open(f'b{i:02d}.wav', 'rb') as r:
        durs.append(r.getnframes() / r.getframerate())
need = [LEAD + d for d in durs]
spare = TOTAL - sum(need)
print('speech total %.1f s, spare %.1f s' % (sum(durs), spare))
assert spare > len(SEGS) * 0.5, 'not enough room: trim lines'
# share the spare time: cards get a little, content segments the rest (more for longer lines)
w = [0.6 if k == 'card' else 1.0 + d / 10 for (k, _, _), d in zip(SEGS, durs)]
extra = [spare * x / sum(w) for x in w]
t, out = 0.0, []
for i, ((kind, ref, text), d) in enumerate(zip(SEGS, durs)):
    length = need[i] + extra[i]
    out.append({'i': i, 'kind': kind, 'ref': ref, 'text': text, 'start': round(t, 3), 'end': round(t + length, 3), 'voice': round(t + LEAD, 3), 'dur': round(d, 2)})
    print(f"{i:2d} {kind:5s} {str(ref):12s} {t:6.2f} - {t + length:6.2f}  speech {d:5.2f}")
    t += length
json.dump(out, open('segments.json', 'w'), indent=1)
