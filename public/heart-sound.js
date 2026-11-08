// A soft heartbeat sound, "lub-dub", made by the browser (no audio file).
// Browsers only allow sound after a tap or key press, so the audio is started
// on the first one. On iPhone and iPad the silent switch mutes it.

const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
let ctx = null;

function audio() {
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Starts the audio on a tap or key press, which is when browsers allow it.
// Chrome on Android only counts a finished tap (the finger lifting, or a click),
// not the finger touching down, so listen for all of them.
export function readySound() {
  const unlock = () => audio();
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, unlock, { passive: true });
  }
}

// One soft thump at `at` seconds on the audio clock. The pitch falls from about
// 110Hz to 45Hz: deep enough to feel like a heartbeat, high enough at the start
// that small phone speakers still play it.
function thump(a, at, loudness) {
  const osc = a.createOscillator();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  filter.type = 'lowpass';
  filter.frequency.value = 350;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(loudness, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  osc.connect(filter).connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + 0.2);
}

// One heartbeat: a thump, then a softer one just after. `gain` scales both:
// 1 is the original quiet level, about 2.6 the loudest that doesn't distort.
export function playBeat(gain = 1) {
  const a = audio();
  if (a?.state !== 'running' || gain <= 0) return;
  const now = a.currentTime + 0.01;
  thump(a, now, 0.35 * gain);
  thump(a, now + 0.16, 0.2 * gain);
}
