# Synthesize the explainer voiceover, one line per scene, and fit each line to its slot.
import json, sys, wave
from piper import PiperVoice
try:
    from piper import SynthesisConfig
except ImportError:
    from piper.config import SynthesisConfig

VOICE = sys.argv[1] if len(sys.argv) > 1 else 'en_US-lessac-high.onnx'
# (start s, latest end s, text). Ends leave a short breath before the next scene's line.
LINES = [
    (0.5, 4.9, "Introducing One Shipment, One Digital Platform, from Team Outliers."),
    (5.3, 14.3, "One shipment. Four parties. No shared record. The invoice and packing list don't match, and nobody notices until the container misses its vessel."),
    (14.7, 23.9, "So we put one live record at the centre. Every role writes to it, and every capability reads from it: document checks, payments, government data, and carbon."),
    (24.2, 35.9, "First, the AI document X-ray compares the invoice, packing list and bill of lading, flags the weight mismatch with ninety-seven percent confidence, and fixes it before customs."),
    (36.2, 46.9, "Next, payment follows proof. When the driver confirms arrival at the port gate from a phone link, eighteen thousand five hundred rupees is released from escrow, and the baton passes to the customs broker."),
    (47.2, 58.4, "When the Red Sea is disrupted, the recovery co-pilot prices every option through the same schedule engine, recommends the Cape route, and one click redraws the corridor for everyone."),
    (58.7, 67.9, "Seven workspaces share one store, so each role sees the same truth, and its own next action, from the control tower to finance and sustainability."),
    (67.9, 72.9, "It plugs into ULIP: forty-three systems, and a hundred and twenty-nine APIs."),
    (73.1, 78.9, "Built with React, TypeScript, three J S and Zustand, and forty-one unit tests."),
    (79.2, 84.9, "Documents, payments, disruptions, and carbon. All on one shipment record."),
    (85.3, 90.4, "One Shipment, One Digital Platform. Thank you, from Team Outliers."),
]

voice = PiperVoice.load(VOICE)
out = []
for i, (start, end, text) in enumerate(LINES):
    slot = end - start
    scale = 1.0
    for attempt in range(6):
        path = f'line{i:02d}.wav'
        with wave.open(path, 'wb') as w:
            voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=scale, noise_scale=0.6, noise_w_scale=0.75))
        with wave.open(path, 'rb') as r:
            dur = r.getnframes() / r.getframerate()
        if dur <= slot or scale <= 0.9:
            break
        scale = max(0.9, scale * slot / dur * 0.99)
    out.append({'i': i, 'start': start, 'end': end, 'dur': round(dur, 2), 'scale': round(scale, 3), 'fits': dur <= slot, 'text': text})
    print(f'{i:2d} start {start:5.1f} dur {dur:5.2f} slot {slot:5.2f} scale {scale:.2f} {"OK" if dur <= slot else "OVER"}')
json.dump(out, open('lines.json', 'w'), indent=1)
