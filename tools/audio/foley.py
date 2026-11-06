"""
BOARDVERSE foley synthesizer: physically-inspired modal synthesis of tabletop sounds
(dice, cards, chips, wooden pieces, coins, dominoes) plus room ambiences.
Each impact = contact transient + damped resonant modes of the object + table body response,
then a short synthetic room reverb. Output: WAV files for encode step.
"""
import sys
import wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def modes(freqs, decays, amps, dur, jitter=0.03):
    t = t_(dur)
    out = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        f = f * (1 + rng.uniform(-jitter, jitter))
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
    return out


def bandnoise(dur, lo, hi, decay=None, attack=0.001):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n)
    t = t_(dur)
    env = np.minimum(1, t / attack) if attack else np.ones_like(t)
    if decay: env = env * np.exp(-t / decay)
    return y / (np.abs(y).max() + 1e-9) * env


def place(buf, snd, at, gain=1.0):
    i = int(at * SR)
    end = min(len(buf), i + len(snd))
    buf[i:end] += snd[: end - i] * gain


def reverb(x, wet=0.14, length=0.45, tone=5000):
    ir = bandnoise(length, 120, tone, decay=length / 5)
    ir[: int(0.012 * SR)] *= 0.2  # pre-delay feel
    N = len(x) + len(ir)
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)
    y = y / (np.abs(y).max() + 1e-9) * np.abs(x).max()
    out = np.concatenate([x, np.zeros(len(ir))]) * (1 - wet) + y * wet
    return out


def table_body(dur=0.12, amp=0.35):
    return modes([170, 260, 410], [0.05, 0.035, 0.02], [amp, amp * 0.6, amp * 0.3], dur)


# ---------- objects ----------
def die_hit(strength=1.0, surface='wood'):
    dur = 0.12
    x = modes([2150, 3380, 4720, 6150, 8100], [0.022, 0.016, 0.012, 0.008, 0.005], [1, 0.8, 0.55, 0.35, 0.2], dur, 0.08)
    x += bandnoise(dur, 2000, 12000, decay=0.002) * 0.9
    if surface == 'wood': x += table_body(dur, 0.45)
    else: x = x * 0.5 + bandnoise(dur, 200, 2000, decay=0.01) * 0.3  # felt
    return x * strength


def dice_roll():
    buf = np.zeros(int(1.6 * SR))
    # rattle in hand
    for i in range(10):
        place(buf, die_hit(0.25 + rng.uniform(0, 0.15)) * 0.6, 0.015 + i * 0.03 + rng.uniform(0, 0.01))
    # throw: two dice bouncing with decreasing energy
    for d in range(2):
        t, e, gap = 0.42 + d * 0.035, 1.0, 0.16
        while e > 0.06:
            place(buf, die_hit(e), t)
            t += gap * rng.uniform(0.8, 1.1); e *= 0.62; gap *= 0.72
        for k in range(6):  # tumbling
            place(buf, die_hit(0.05 + rng.uniform(0, 0.04)), t + k * 0.025)
    return reverb(buf, 0.12)


def dice_land():
    buf = np.zeros(int(0.5 * SR))
    for t, e in [(0, 0.8), (0.07, 0.4), (0.12, 0.18), (0.15, 0.08)]:
        place(buf, die_hit(e), t)
    return reverb(buf, 0.12)


def card_flick(strength=1.0):
    dur = 0.18
    x = bandnoise(dur, 1800, 9000, decay=0.03, attack=0.002) * 0.8
    x += bandnoise(dur, 400, 3000, decay=0.06, attack=0.01) * 0.35  # air/slide
    return x * strength


def card_slap():
    x = card_flick(1.0)
    x[: int(0.12 * SR)] += bandnoise(0.12, 80, 900, decay=0.02, attack=0.0008)[: int(0.12 * SR)] * 0.9
    return reverb(x, 0.1)


def card_slide():
    dur = 0.35
    t = t_(dur)
    env = np.sin(np.pi * np.minimum(1, t / dur)) ** 1.5
    x = bandnoise(dur, 600, 6000) * env * 0.6
    place(x, card_flick(0.5), 0)
    return reverb(x, 0.08)


def shuffle():
    buf = np.zeros(int(1.1 * SR))
    tt = 0.02
    for i in range(48):
        place(buf, card_flick(0.18 + rng.uniform(0, 0.12))[: int(0.05 * SR)], tt)
        tt += 0.019 * (1 - i / 80)
    place(buf, bandnoise(0.35, 300, 4000, decay=0.12, attack=0.05) * 0.5, tt + 0.02)  # bridge
    return reverb(buf, 0.1)


def deal():
    buf = np.zeros(int(0.5 * SR))
    for i in range(3): place(buf, card_flick(0.7 - i * 0.1), i * 0.09)
    return reverb(buf, 0.1)


def chip_hit(strength=1.0):
    dur = 0.1
    x = modes([3150, 4980, 7300, 9100], [0.02, 0.014, 0.009, 0.006], [1, 0.7, 0.4, 0.2], dur, 0.05)
    x += bandnoise(dur, 3000, 14000, decay=0.0015) * 0.7
    return x * strength


def chips():
    buf = np.zeros(int(0.6 * SR))
    for i in range(5): place(buf, chip_hit(0.9 - i * 0.12), i * 0.045 + rng.uniform(0, 0.01))
    return reverb(buf, 0.12)


def chip():
    buf = np.zeros(int(0.3 * SR))
    place(buf, chip_hit(1), 0); place(buf, chip_hit(0.4), 0.05)
    return reverb(buf, 0.1)


def coin_ring(strength=1.0):
    dur = 0.6
    x = modes([4200, 5650, 7900, 10300, 12400], [0.25, 0.18, 0.12, 0.08, 0.05], [1, 0.7, 0.5, 0.3, 0.2], dur, 0.02)
    x += bandnoise(dur, 4000, 15000, decay=0.002) * 0.6
    return x * strength


def coins():
    buf = np.zeros(int(1.0 * SR))
    for i in range(9): place(buf, coin_ring(0.25 + rng.uniform(0, 0.35)), 0.02 + i * 0.05 + rng.uniform(0, 0.03))
    return reverb(buf, 0.16)


def coin():
    buf = np.zeros(int(0.8 * SR)); place(buf, coin_ring(0.9), 0); place(buf, coin_ring(0.3), 0.08)
    return reverb(buf, 0.15)


def wood_knock(strength=1.0, pitch=1.0):
    dur = 0.18
    x = modes([620 * pitch, 1310 * pitch, 2240 * pitch, 3400 * pitch], [0.04, 0.025, 0.015, 0.008], [1, 0.6, 0.35, 0.15], dur, 0.04)
    x += bandnoise(dur, 800, 6000, decay=0.0025) * 0.5 + table_body(dur, 0.6)
    return x * strength


def piece():
    buf = np.zeros(int(0.4 * SR)); place(buf, wood_knock(1.0, 1.15), 0); place(buf, wood_knock(0.15, 1.15), 0.035)
    return reverb(buf, 0.12)


def step():
    return reverb(wood_knock(0.5, 1.4)[: int(0.15 * SR)], 0.08)


def capture():
    buf = np.zeros(int(0.6 * SR))
    place(buf, wood_knock(1.0, 1.0), 0); place(buf, wood_knock(0.7, 1.25), 0.08); place(buf, card_slide()[: int(0.2 * SR)] * 0.4, 0.12)
    return reverb(buf, 0.14)


def build():
    buf = np.zeros(int(0.8 * SR))
    for i in range(3): place(buf, wood_knock(0.9, 0.9 + i * 0.05), i * 0.17)
    return reverb(buf, 0.12)


def domino():
    buf = np.zeros(int(0.35 * SR))
    x = modes([2350, 3650, 5200], [0.03, 0.02, 0.012], [1, 0.6, 0.3], 0.15, 0.04) + bandnoise(0.15, 2000, 12000, decay=0.002) * 0.6 + table_body(0.15, 0.5)
    place(buf, x, 0); place(buf, x * 0.25, 0.04)
    return reverb(buf, 0.12)


def drop():
    buf = np.zeros(int(0.6 * SR))
    x = modes([1650, 2900, 4300], [0.04, 0.025, 0.015], [1, 0.6, 0.3], 0.2, 0.05)
    for t, e in [(0, 1), (0.09, 0.35), (0.14, 0.15)]: place(buf, x * e, t)
    return reverb(buf, 0.14)


def whoosh():
    dur = 0.6
    t = t_(dur)
    x = rng.standard_normal(len(t))
    # sweeping band via short-time filtering
    out = np.zeros_like(x)
    win = 1024
    for i in range(0, len(x) - win, win // 2):
        seg = x[i:i + win] * np.hanning(win)
        S = np.fft.rfft(seg); f = np.fft.rfftfreq(win, 1 / SR)
        c = 400 + 2600 * (i / len(x))
        S *= np.exp(-((f - c) / (c * 0.6)) ** 2)
        out[i:i + win] += np.fft.irfft(S, win)
    env = np.sin(np.pi * t / dur) ** 2
    return out / np.abs(out).max() * env * 0.7


def amb_room(dur=24):
    x = bandnoise(dur, 30, 500) * 0.25 + bandnoise(dur, 40, 90) * 0.15
    return x


def amb_fire(dur=24):
    x = bandnoise(dur, 40, 300) * 0.25
    n = int(dur * 9)
    for _ in range(n):
        at = rng.uniform(0, dur - 0.1)
        place(x, bandnoise(0.03, 1500, 7000, decay=0.004) * rng.uniform(0.1, 0.6), at)
    return x


def amb_city(dur=24):
    x = bandnoise(dur, 30, 250) * 0.35
    t = t_(dur)
    x *= 0.8 + 0.2 * np.sin(2 * np.pi * t / 7)
    return x


def amb_future(dur=24):
    t = t_(dur)
    x = 0.12 * np.sin(2 * np.pi * 55 * t) * (0.7 + 0.3 * np.sin(2 * np.pi * t / 6)) + 0.06 * np.sin(2 * np.pi * 82.5 * t) + bandnoise(dur, 40, 400) * 0.12
    return x


def loopable(x, fade=1.5):
    n = int(fade * SR)
    head, tail = x[:n], x[-n:]
    w = np.linspace(0, 1, n)
    x = x[:-n].copy()
    x[:n] = tail * (1 - w) + head * w
    return x


def write(path, x, peak=0.89):
    x = x / (np.abs(x).max() + 1e-9) * peak
    # tiny fade-out to avoid clicks
    f = min(len(x), int(0.01 * SR)); x[-f:] *= np.linspace(1, 0, f)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


SOUNDS = {
    'dice': (dice_roll, 0.9), 'diceLand': (dice_land, 0.8), 'card': (card_slide, 0.6), 'cardSlap': (card_slap, 0.85), 'deal': (deal, 0.7),
    'shuffle': (shuffle, 0.75), 'chip': (chip, 0.7), 'chips': (chips, 0.8), 'coin': (coin, 0.6), 'coins': (coins, 0.7), 'piece': (piece, 0.85),
    'step': (step, 0.55), 'capture': (capture, 0.9), 'build': (build, 0.8), 'domino': (domino, 0.85), 'drop': (drop, 0.8), 'whoosh': (whoosh, 0.6),
}
AMB = {'amb_room': amb_room, 'amb_fire': amb_fire, 'amb_city': amb_city, 'amb_future': amb_future}

if __name__ == '__main__':
    out = sys.argv[1]
    for name, (fn, peak) in SOUNDS.items():
        write(f'{out}/{name}.wav', fn(), peak)
    for name, fn in AMB.items():
        write(f'{out}/{name}.wav', loopable(fn()), 0.5)
    print('ok', len(SOUNDS) + len(AMB))
