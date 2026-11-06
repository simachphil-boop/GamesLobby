"""
BOARDVERSE music composer: writes original multi-instrument MIDI arrangements that are rendered
with FluidSynth + the MIT-licensed FluidR3_GM SoundFont (see render_music.sh).

Each track: chord progression, comping voicings, walking/pattern bass, swung or straight drums,
and a motif-based melody with call/response phrasing and humanized timing/velocity.
"""
import random
import sys
import mido

PPQ = 480
NOTE = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
QUAL = {  # intervals: 3rd, 5th, 7th, 9th, 13th
    'maj7': [4, 7, 11, 14, 21], 'm7': [3, 7, 10, 14, 17], '7': [4, 7, 10, 14, 21], 'm7b5': [3, 6, 10, 13, 17],
    'maj9': [4, 7, 11, 14, 21], 'm9': [3, 7, 10, 14, 17], '6': [4, 7, 9, 14, 21], 'sus': [5, 7, 10, 14, 21], 'm': [3, 7, 10, 14, 17],
}


def chord(sym):
    for q in sorted(QUAL, key=len, reverse=True):
        if sym.endswith(q):
            root = sym[: len(sym) - len(q)]
            if root in NOTE:
                return NOTE[root], QUAL[q]
    return NOTE[sym], QUAL['maj7']


class Track:
    def __init__(self, ch, program, name):
        self.ch, self.program, self.name = ch, program, name
        self.events = []  # (tick, type, note, vel)

    def note(self, t, n, dur, vel):
        vel = max(1, min(127, int(vel)))
        t = max(0, int(t))
        self.events.append((t, 1, n, vel))
        self.events.append((t + max(10, int(dur)), 0, n, 0))


def humanize(t, amt=12):
    return t + random.randint(-amt, amt)


def build(spec, seed):
    random.seed(seed)
    bpm, bars_per_chord = spec['bpm'], spec.get('bpc', 1)
    prog = spec['prog']
    swing = spec.get('swing', 0.0)
    beat = PPQ
    bar = beat * 4
    sw = lambda t8: int(t8 * beat / 2 + (swing * beat / 6 if t8 % 2 == 1 else 0))  # eighth-note grid with swing
    form = spec['form']  # list of section names, each = whole progression
    tracks = {k: Track(*v) for k, v in spec['inst'].items()}
    drums = Track(9, spec.get('kit', 0), 'drums')
    total_bars = 0
    motif = [random.choice([0, 1, 2, 3]) for _ in range(4)]
    rhythm = sorted(random.sample(range(1, 8), 4))
    for si, sec in enumerate(form):
        intensity = {'intro': 0.5, 'A': 0.8, 'B': 1.0, 'A2': 0.9, 'outro': 0.45}[sec]
        for ci, sym in enumerate(prog):
            for b in range(bars_per_chord):
                t0 = total_bars * bar
                root, ints = chord(sym)
                nxt_root = chord(prog[(ci + 1) % len(prog)])[0]
                # ---- comping (piano / ep / guitar / pad)
                if 'keys' in tracks:
                    voicing = sorted(((root + i) % 12) + 52 for i in ints[:4])
                    voicing = [n if n >= 52 else n + 12 for n in voicing]
                    style = spec.get('comp', 'jazz')
                    if style == 'jazz':
                        hits = random.choice([[0, 3], [1, 5], [0, 5], [3, 6], [0, 2, 5]])
                        for h in hits:
                            for n in voicing:
                                tracks['keys'].note(humanize(t0 + sw(h), 8), n, beat * random.choice([0.9, 1.4, 0.6]), 52 * intensity + random.randint(-6, 8))
                    elif style == 'pad':
                        for n in voicing + [voicing[0] + 12]:
                            tracks['keys'].note(t0, n, bar * 0.98, 46 * intensity)
                    elif style == 'arp':
                        notes = voicing + [voicing[1] + 12, voicing[2] + 12]
                        for k in range(8):
                            tracks['keys'].note(t0 + k * beat // 2, notes[(k * 3) % len(notes)], beat * 0.45, 48 * intensity + (10 if k % 2 == 0 else 0))
                    elif style == 'folk':
                        pattern = [0, 2, 3, 4, 6, 7]
                        for k, h in enumerate(pattern):
                            n = voicing[k % len(voicing)] - (12 if k == 0 else 0)
                            tracks['keys'].note(humanize(t0 + h * beat // 2, 6), n, beat * 1.2, 50 * intensity + random.randint(-5, 5))
                    elif style == 'funk':
                        for h in [0, 3, 6, 7, 10, 13]:
                            for n in voicing[1:]:
                                tracks['keys'].note(t0 + h * beat // 4, n + 12, beat * 0.18, 64 * intensity)
                if 'pad' in tracks and intensity > 0.6:
                    for n in sorted(((root + i) % 12) + 60 for i in ints[:3]):
                        tracks['pad'].note(t0, n, bar * 0.99, 34 * intensity)
                # ---- bass
                if 'bass' in tracks:
                    bstyle = spec.get('bass', 'walk')
                    r = root + 36
                    if bstyle == 'walk':
                        line = [r, r + random.choice([ints[0], ints[1], 2]), r + ints[1], nxt_root + 36 + random.choice([-1, 1])]
                        for k, n in enumerate(line):
                            while n < 33: n += 12
                            while n > 52: n -= 12
                            tracks['bass'].note(humanize(t0 + k * beat, 6), n, beat * 0.92, 78 + (8 if k == 0 else 0))
                    elif bstyle == 'root':
                        for k, (off, iv) in enumerate([(0, 0), (1.5, 0), (2, ints[1]), (3.5, 12)]):
                            tracks['bass'].note(t0 + int(off * beat), r + iv, beat * 0.8, 74)
                    elif bstyle == 'synth':
                        for k in range(8):
                            tracks['bass'].note(t0 + k * beat // 2, r + (12 if k % 4 == 3 else 0), beat * 0.4, 80 if k % 2 == 0 else 62)
                    elif bstyle == 'funk':
                        for off, iv, v in [(0, 0, 96), (0.75, 12, 70), (1.5, 0, 80), (2.25, ints[1], 74), (3, 10, 70), (3.5, 12, 84)]:
                            tracks['bass'].note(t0 + int(off * beat), r + iv, beat * 0.22, v)
                # ---- melody (motif development)
                if 'lead' in tracks and sec in ('A', 'B', 'A2'):
                    scale = sorted(set(((root + i) % 12) for i in [0] + ints))
                    base = spec.get('lead_oct', 72)
                    play = (total_bars % 4) in ((0, 1) if sec != 'B' else (0, 1, 2))
                    if play:
                        shift = (ci + si) % 3
                        for k, step in enumerate(rhythm):
                            deg = (motif[k % 4] + shift + (1 if sec == 'B' else 0)) % len(scale)
                            n = scale[deg] + base
                            if n > base + 14: n -= 12
                            dur = beat * (1.6 if k == len(rhythm) - 1 else 0.85)
                            tracks['lead'].note(humanize(t0 + sw(step), 10), n, dur, 70 + random.randint(-8, 10))
                # ---- drums
                kit = spec.get('drums', 'brush')
                if kit == 'brush' and sec != 'intro' or (kit == 'brush' and b % 2):
                    for e in [0, 2, 3, 4, 6, 7]:  # ride swing pattern
                        drums.note(humanize(t0 + sw(e), 6), 51, beat // 2, (44 if e in (2, 6) else 34) * intensity + 8)
                    for e in [2, 6]: drums.note(t0 + sw(e), 44, beat // 2, 50)
                    if random.random() < 0.6: drums.note(t0 + sw(random.choice([3, 5, 7])), 38, beat // 2, 30 * intensity)
                    drums.note(t0, 36, beat // 2, 44 * intensity)
                elif kit == 'pop' and sec != 'intro':
                    for e in range(8): drums.note(t0 + e * beat // 2, 42, beat // 4, 54 if e % 2 == 0 else 38)
                    for e in [0, 5]: drums.note(t0 + e * beat // 2, 36, beat // 2, 84 * intensity)
                    for e in [2, 6]: drums.note(t0 + e * beat // 2, 38 if spec.get('snare', True) else 39, beat // 2, 70 * intensity)
                elif kit == 'funk' and sec != 'intro':
                    for e in range(16): drums.note(t0 + e * beat // 4, 42, beat // 8, 60 if e % 4 == 0 else 40 + (12 if e % 2 else 0))
                    for e in [0, 3, 10]: drums.note(t0 + e * beat // 4, 36, beat // 4, 92)
                    for e in [4, 12]: drums.note(t0 + e * beat // 4, 38, beat // 4, 90)
                    drums.note(t0 + 15 * beat // 4, 38, beat // 8, 40)
                elif kit == 'soft':
                    if sec != 'intro':
                        drums.note(t0, 36, beat, 50 * intensity)
                        drums.note(t0 + 2 * beat, 37, beat, 40 * intensity)
                    for e in range(4): drums.note(t0 + e * beat + beat // 2, 70, beat // 4, 34)  # shaker (maracas)
                total_bars += 1
    # final chord ring-out
    t_end = total_bars * bar
    root, ints = chord(prog[0])
    for k, n in enumerate([root + 36] + [((root + i) % 12) + 55 for i in ints[:4]]):
        trk = tracks.get('keys') or tracks.get('pad')
        trk.note(t_end + k * 30, n, bar * 2, 60)
    if 'bass' in tracks: tracks['bass'].note(t_end, root + 36, bar * 2, 80)
    drums.note(t_end, 49 if spec.get('drums') != 'brush' else 51, bar, 50)

    mid = mido.MidiFile(ticks_per_beat=PPQ)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=0))
    mid.tracks.append(meta)
    for trk in list(tracks.values()) + [drums]:
        mt = mido.MidiTrack()
        mt.append(mido.Message('program_change', channel=trk.ch, program=trk.program, time=0))
        mt.append(mido.Message('control_change', channel=trk.ch, control=91, value=spec.get('reverb', 70), time=0))
        mt.append(mido.Message('control_change', channel=trk.ch, control=7, value=spec.get('vol', {}).get(trk.name, 100), time=0))
        if trk.ch != 9: mt.append(mido.Message('control_change', channel=trk.ch, control=10, value=spec.get('pan', {}).get(trk.name, 64), time=0))
        last = 0
        for t, on, n, v in sorted(trk.events, key=lambda e: (e[0], e[1])):
            mt.append(mido.Message('note_on' if on else 'note_off', channel=trk.ch, note=n, velocity=v, time=t - last))
            last = t
        mid.tracks.append(mt)
    return mid


SPECS = {
    'menu': dict(bpm=88, swing=0.55, prog=['Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Gm7', 'C7', 'Fm9', 'Bbsus'], form=['intro', 'A', 'B', 'A2', 'outro'],
                 inst={'keys': (0, 4, 'keys'), 'bass': (1, 32, 'bass'), 'lead': (2, 11, 'lead')}, comp='jazz', bass='walk', drums='brush', kit=40,
                 lead_oct=72, vol={'lead': 82, 'keys': 96}, pan={'keys': 50, 'lead': 84}),
    'modern': dict(bpm=84, prog=['Dmaj9', 'Bm9', 'Gmaj7', 'A6'], bpc=2, form=['intro', 'A', 'B', 'A2', 'outro'],
                   inst={'keys': (0, 4, 'keys'), 'bass': (1, 33, 'bass'), 'pad': (3, 89, 'pad'), 'lead': (2, 12, 'lead')}, comp='jazz', bass='root', drums='pop', snare=False,
                   lead_oct=74, vol={'pad': 70, 'lead': 76}),
    'cozy': dict(bpm=76, prog=['Gmaj7', 'Em7', 'Cmaj7', 'D6', 'Am7', 'D7', 'Gmaj7', 'Csus'], form=['intro', 'A', 'B', 'A2', 'outro'],
                 inst={'keys': (0, 24, 'keys'), 'bass': (1, 32, 'bass'), 'lead': (2, 0, 'lead'), 'pad': (3, 48, 'pad')}, comp='folk', bass='root', drums='soft',
                 lead_oct=72, vol={'pad': 60, 'lead': 78}, reverb=80),
    'luxury': dict(bpm=104, swing=0.6, prog=['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Am7', 'D7', 'Gm7', 'C7'], form=['intro', 'A', 'B', 'A2', 'outro'],
                   inst={'keys': (0, 0, 'keys'), 'bass': (1, 32, 'bass'), 'lead': (2, 11, 'lead')}, comp='jazz', bass='walk', drums='brush', kit=40,
                   lead_oct=76, vol={'lead': 86}),
    'retro': dict(bpm=104, prog=['Em7', 'A7', 'Em7', 'A7', 'Cmaj7', 'B7', 'Em7', 'A7'], form=['intro', 'A', 'B', 'A2', 'outro'],
                  inst={'keys': (0, 7, 'keys'), 'bass': (1, 36, 'bass'), 'lead': (2, 61, 'lead')}, comp='funk', bass='funk', drums='funk',
                  lead_oct=72, vol={'keys': 80, 'lead': 74}),
    'future': dict(bpm=96, prog=['Am', 'F', 'C', 'G'], bpc=2, form=['intro', 'A', 'B', 'A2', 'outro'],
                   inst={'keys': (0, 81, 'keys'), 'bass': (1, 38, 'bass'), 'pad': (3, 89, 'pad'), 'lead': (2, 80, 'lead')}, comp='arp', bass='synth', drums='pop',
                   lead_oct=72, vol={'keys': 64, 'lead': 66, 'pad': 80}, reverb=95),
}
# map simple triads for 'future'
for k in ('Am', 'F', 'C', 'G'):
    pass

if __name__ == '__main__':
    out = sys.argv[1]
    for i, (name, spec) in enumerate(SPECS.items()):
        spec['prog'] = [p if any(p.endswith(q) for q in QUAL) else (p + ('m' if False else 'maj7')) for p in spec['prog']]
        build(spec, 1000 + i * 17).save(f'{out}/{name}.mid')
        print('wrote', name)
