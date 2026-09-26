"""Original score for the Serious Play motion pitch.

Synthesised from scratch (no samples), so it is free to use anywhere.
100 BPM, 72 s, A minor. Structure follows the film's scenes (bars of 2.4 s):

  0.0  – 4.8   cold open      clock ticks on 16ths, low drone
  4.8  – 14.4  tension        half-time kick, pad enters
  14.4 – 26.4  references     four-on-the-floor, hats, bass
  26.4 – 36.0  system         filtered break, riser into the drop
  36.0 – 50.4  the ring       drop: full groove, arpeggio
  50.4 – 62.4  the site       groove continues, extra percussion
  62.4 – 72.0  end card       impact, pad and arpeggio fade out

Run:  python3 film/music.py film/assets/score.wav   (then encode to score.m4a with ffmpeg)
"""
import sys
import wave
import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = BEAT * 4
DUR = 72.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

out_l = np.zeros(N)
out_r = np.zeros(N)


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    out_l[i:i + len(sig)] += sig * gain * (1 - max(pan, 0))
    out_r[i:i + len(sig)] += sig * gain * (1 + min(pan, 0))


def env(n, a, d):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
    return e


def lp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), "high")
    return lfilter(b, a, x)


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------- instruments ----------
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = rng.standard_normal(n) * np.exp(-t * 400) * 0.25
    return (np.sin(ph) * np.exp(-t * 7) + click) * 0.95


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    x = hp(rng.standard_normal(n), 7000)
    return x * env(n, 0.001, 0.08 if open_ else 0.015) * 0.35


def tick():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 180) * 0.18


def clap():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    x = hp(lp(rng.standard_normal(n), 3500), 900)
    e = np.exp(-t * 18) * (1 + 0.6 * (np.sin(2 * np.pi * 80 * t) > 0))
    return x * e * 0.4


def bass(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = note(m)
    saw = 2 * ((t * f) % 1) - 1
    sub = np.sin(2 * np.pi * f / 2 * t)
    x = lp(saw * 0.5 + sub * 0.8, 380)
    return x * env(n, 0.005, dur * 0.9) * 0.55


def pad(ms, dur, bright=1200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in ms:
        for det in (-0.12, 0.0, 0.11):
            f = note(m + det)
            x += 2 * ((t * f + rng.random()) % 1) - 1
    x = lp(x / (len(ms) * 3), bright, 2)
    a = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.8).clip(0, 1)
    return x * a * 0.5


def pluck(m, dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = note(m)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return x * np.exp(-t * 9) * 0.22


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n)
    chunks = 40
    for k in range(chunks):
        s, e = k * n // chunks, (k + 1) * n // chunks
        fc = 300 + 9000 * (k / chunks) ** 2
        out[s:e] = lp(x[s:e], fc)
    return out * (t / dur) ** 2 * 0.35


def impact():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 10)) * t) * np.exp(-t * 1.6)
    noise = lp(rng.standard_normal(n), 2000) * np.exp(-t * 3) * 0.3
    return (boom + noise) * 0.9


# ---------- arrangement ----------
prog = [(57, [57, 60, 64]), (53, [53, 57, 60, 64]), (48, [48, 52, 55, 59]), (55, [55, 59, 62])]  # Am F Cmaj7 G

K, H, HO, CL = kick(), hat(), hat(True), clap()

def bar_at(t):
    return int(t // BAR)

# drone under the cold open
add(pad([45, 52], 5.2, 500), 0, 0.8)
for i in range(int(4.8 / (BEAT / 4))):
    add(tick(), i * BEAT / 4, 1.0 if i % 4 == 0 else 0.5, pan=0.3 if i % 2 else -0.3)

b = 0
t = 0.0
while t < DUR - 0.01:
    t = b * BAR
    if t >= DUR:
        break
    root, chord = prog[b % 4]
    sec = t
    # pads from the tension scene until the end
    if sec >= 4.8:
        bright = 900 if sec < 36 else 1800
        gain = 0.55 if sec < 62.4 else 0.45
        add(pad(chord + [chord[0] + 12], BAR + 0.3, bright), sec, gain)
    # kicks
    for k in range(4):
        bt = sec + k * BEAT
        if 4.8 <= bt < 14.4 and k in (0, 2):
            add(K, bt, 0.8)
        elif 14.4 <= bt < 26.4 or 36.0 <= bt < 62.4:
            add(K, bt, 0.9)
        elif 26.4 <= bt < 33.6 and k == 0:
            add(K, bt, 0.6)
    # hats and claps
    for k in range(8):
        bt = sec + k * BEAT / 2
        if (14.4 <= bt < 33.6 or 36.0 <= bt < 62.4) and k % 2 == 1:
            add(HO if (k == 7 and bt >= 36) else H, bt, 0.8, pan=0.2)
        if 50.4 <= bt < 62.4:
            add(H, bt + BEAT / 4, 0.35, pan=-0.3)
    for k in (1, 3):
        bt = sec + k * BEAT
        if 36.0 <= bt < 62.4:
            add(CL, bt, 0.7)
    # bass
    if 14.4 <= sec < 62.4 and not (26.4 <= sec < 36):
        for k in range(8):
            if k in (0, 3, 4, 6):
                add(bass(root - 12, BEAT / 2 * 0.95), sec + k * BEAT / 2, 1.0)
    # arpeggio in the ring, site and end
    if sec >= 36.0:
        seq = chord + [chord[1] + 12]
        for k in range(16):
            bt = sec + k * BEAT / 4
            if bt < DUR - 1:
                g = 1.0 if sec < 62.4 else max(0, 1 - (bt - 62.4) / 9)
                add(pluck(seq[k % len(seq)] + 12), bt, g, pan=0.4 if k % 2 else -0.4)
    b += 1

add(riser(33.6 - 26.4 + 2.4), 26.4, 1.0)
add(impact(), 36.0, 0.9)
add(impact(), 62.4, 0.8)
add(impact(), 14.4, 0.4)

# ---------- master ----------
mix = np.stack([out_l, out_r])
mix = np.tanh(mix * 1.2)
fade_in = np.minimum(1, np.arange(N) / (0.05 * SR))
fade_out = np.clip((DUR - np.arange(N) / SR) / 3.0, 0, 1)
mix *= fade_in * fade_out
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
pcm = (mix.T * 32767).astype(np.int16)

path = sys.argv[1] if len(sys.argv) > 1 else "score.wav"
with wave.open(path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", path, f"{DUR}s")
