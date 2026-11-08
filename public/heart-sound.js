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
export function readySound() {
  const unlock = () => audio();
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
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

// One heartbeat: a thump, then a softer one just after.
export function playBeat() {
  const a = audio();
  if (a?.state !== 'running') return;
  const now = a.currentTime + 0.01;
  thump(a, now, 0.35);
  thump(a, now + 0.16, 0.2);
}
