# Assemble the 3-minute cut:
#   0.0 - 79.1   explainer (problem, hub, X-Ray, escrow, Co-Pilot, workspaces, ULIP, stack)
#  79.1 - 168.7  walkthrough (deck + prototype)
# 168.7 - 180.0  explainer closer + end card (held 1.8 s, then a 0.5 s fade)
import json, subprocess, sys
SP = sys.argv[1]
A_VID, B_VID, B_AUD = f'{SP}/video/final_silent.mp4', f'{SP}/wt/wt_silent.mp4', f'{SP}/wt/wt.mp4'
CUT_A, B_LEN, C_FROM, C_TO, HOLD = 79.1, 89.6, 79.0, 88.5, 1.8
B_AT = CUT_A
C_SHIFT = CUT_A + B_LEN - C_FROM            # explainer time -> final time for part C
TOTAL = CUT_A + B_LEN + (C_TO - C_FROM) + HOLD
run = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)

# --- voice: every line on one timeline ---
A = json.load(open('lines.json'))
B = json.load(open('segments.json'))
placed = []
for l in A:
    t = l['start'] if l['start'] < CUT_A else l['start'] + C_SHIFT
    placed.append((f'line{l["i"]:02d}.wav', t, l['text']))
for s in B:
    placed.append((f'b{s["i"]:02d}.wav', B_AT + s['voice'], s['text']))
placed.sort(key=lambda p: p[1])
inputs, parts = [], []
for i, (f, t, _) in enumerate(placed):
    inputs += ['-i', f]; ms = int(round(t * 1000))
    parts.append(f'[{i}:a]aresample=48000,adelay={ms}|{ms},apad[v{i}]')
n = len(placed)
fc = ';'.join(parts) + ';' + ''.join(f'[v{i}]' for i in range(n)) + \
    f'amix=inputs={n}:normalize=0:duration=longest,atrim=0:{TOTAL},highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=5:release=120,volume=1.6,pan=stereo|c0=c0|c1=c0[voice]'
run(*inputs, '-filter_complex', fc, '-map', '[voice]', '-ar', '48000', 'voice3.wav')

# --- music: explainer bed, walkthrough bed, explainer closer; short fades at the joins ---
run('-i', 'music.wav', '-i', B_AUD, '-filter_complex',
    f'[0:a]atrim=0:{CUT_A},asetpts=PTS-STARTPTS,afade=t=out:st={CUT_A - 0.8}:d=0.8[m1];'
    f'[1:a]aresample=48000,atrim=0:{B_LEN},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st={B_LEN - 0.8}:d=0.8[m2];'
    f'[0:a]atrim={C_FROM}:{C_TO},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,apad=pad_dur={HOLD}[m3];'
    '[m1][m2][m3]concat=n=3:v=0:a=1[m]', '-map', '[m]', '-ar', '48000', '-ac', '2', 'music3.wav')

# --- duck and mix ---
run('-i', 'music3.wav', '-i', 'voice3.wav', '-filter_complex',
    f'[0:a]apad=whole_dur={TOTAL},volume=0.8[m];[1:a]asplit=2[v][key];'
    '[m][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=380:makeup=1[md];'
    f'[md][v]amix=inputs=2:normalize=0:duration=longest,atrim=0:{TOTAL},loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st={TOTAL - 0.5}:d=0.5[mix]',
    '-map', '[mix]', '-ar', '48000', 'mix3.wav')

# --- video: frame-exact concat, then mux ---
run('-i', A_VID, '-i', B_VID, '-i', 'mix3.wav', '-filter_complex',
    f'[0:v]trim=0:{CUT_A},setpts=PTS-STARTPTS[a];[1:v]trim=0:{B_LEN},setpts=PTS-STARTPTS[b];'
    f'[0:v]trim={C_FROM}:{C_TO},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={HOLD}[c];'
    f'[a][b][c]concat=n=3:v=1:a=0,fps=60,fade=t=out:st={TOTAL - 0.5}:d=0.5:color=0xF3EDE3[v]',
    '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-t', f'{TOTAL}', '-movflags', '+faststart', 'OneShipment_Video_3min.mp4')

with open('narration_3min.txt', 'w') as f:
    f.write('Voiceover for OneShipment_Video_3min.mp4 (Piper TTS, voice en_US-lessac-high).\n')
    f.write('0:00-1:19 explainer · 1:19-2:49 deck and prototype walkthrough · 2:49-3:00 closer.\n\n')
    for _, t, text in placed:
        f.write(f'{int(t // 60)}:{t % 60:05.2f}  {text}\n')
print('total', TOTAL)
