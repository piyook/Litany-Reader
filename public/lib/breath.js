// The breathing rhythm: which breath a line is on, how long each phase lasts,
// and what comes after it. Each line has a breath phase then a hold phase.
// In read-aloud mode a line takes a whole breath: `half` 0 is the in-breath
// (read it silently) and `half` 1 the out-breath (speak it).

export const DEFAULT_TIMINGS = { in: 4, hold1: 4, out: 6, hold2: 2 };

// A timing typed into the settings, kept between its least and 30 seconds.
export const clampTiming = (key, v) => Math.max(key.startsWith('hold') ? 0 : 0.5, Math.min(30, v));

// Reading silently, lines alternate from an in-breath on the first line, so
// every time through starts breathing in. `rest` is the extra out-breath after
// the last line of an odd-length litany, so every time through ends breathing out.
export const kindOf = ({ aloud, half, idx, rest }) => {
  if (aloud) return half ? 'out' : 'in';
  return rest || idx % 2 === 1 ? 'out' : 'in';
};

// Milliseconds the phase lasts. The hold after an in-breath is hold1, after an out-breath hold2.
export function phaseMs(timings, phase, kind) {
  if (phase === 'breath') return (kind === 'in' ? timings.in : timings.out) * 1000;
  return (kind === 'in' ? timings.hold1 : timings.hold2) * 1000;
}

// p (0 to 1) smoothed to start and end slowly.
export const ease = (p) => 0.5 - 0.5 * Math.cos(Math.PI * p);

export function cueWord(phase, kind, aloud) {
  if (phase === 'hold') return 'hold';
  if (kind === 'in') return 'breathe in';
  return aloud ? 'speak' : 'breathe out';
}

// The orb grows on the in-breath, shrinks on the out-breath, and stays still while holding.
export function orbRadius(phase, kind, eased) {
  const inBreath = kind === 'in';
  let size;
  if (phase === 'hold') size = inBreath ? 1 : 0;
  else size = inBreath ? eased : 1 - eased;
  return 10 + 24 * size;
}

// How far character i is lit (0 to 1) when the fill's front is at `front`,
// with a soft edge `edge` characters wide.
export const fillAt = (front, i, edge) => Math.max(0, Math.min(1, (front - i) / edge));

// The breath a part already read was on, so it keeps a softer version of that colour.
// In read-aloud mode every line is spoken on the out-breath.
export const pastKind = (k, aloud) => kindOf({ aloud, half: 1, idx: k, rest: false });

// Hidden words come back in the hold after the line is breathed (read aloud:
// after it is spoken), and stay through the closing out-breath.
export const revealNow = (phase, aloud, half, rest = false) => rest || (phase === 'hold' && (!aloud || half === 1));

// `step` after moving from line `from` to line `to`.
export const moveStep = (step, from, to) => Math.max(0, step + (to - from));

// What follows the current phase. `count` is how many steps the litany has.
// `event` says what changed: 'hold', 'speak' (read aloud, same line),
// 'rest' (closing out-breath, same line), 'line' (next line), 'loop' (back to
// the first line) or 'end'.
export function nextPhase(s, { aloud, count, looping }) {
  if (s.phase === 'breath') return { ...s, phase: 'hold', event: 'hold' };
  if (aloud && s.half === 0) return { ...s, half: 1, phase: 'breath', event: 'speak' };
  const last = s.idx === count - 1;
  if (last && !s.rest && kindOf({ aloud, ...s }) === 'in') return { ...s, rest: true, phase: 'breath', event: 'rest' };
  if (!last || looping) {
    const idx = (s.idx + 1) % count;
    return { idx, step: s.step + 1, half: 0, rest: false, phase: 'breath', event: idx === 0 ? 'loop' : 'line' };
  }
  return { ...s, event: 'end' };
}
