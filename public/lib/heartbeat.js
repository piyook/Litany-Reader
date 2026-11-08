// The heartbeat behind the text: a faint heart that fades in and out, a little
// quick at first and slower as the litany goes on, so watching it settle helps
// you settle too.

export const BPM_START = 80;
export const BPM_END = 54;

// Beats per minute when `done` (0 to 1) of the litany has been read.
// Slows most at first, then settles.
export function bpmAt(done) {
  const d = Math.max(0, Math.min(1, done));
  const settled = 1 - (1 - d) ** 2;
  return BPM_START + (BPM_END - BPM_START) * settled;
}

// How far through the litany a reader is, never going back: `before` is the
// furthest reached so far. Repeating, going back a line or switching form keeps
// it where it was, so the heart never speeds up again.
export const furthest = (before, step, count) => (count > 0 ? Math.max(before, Math.min(1, step / count)) : before);

// Moves the shown rate toward `target`, so it glides instead of jumping at each
// line: about two thirds of the way there every 3 seconds.
export const glide = (bpm, target, ms) => bpm + (target - bpm) * (1 - Math.exp(-ms / 3000));

// How visible the heart is (0 unseen, 1 at its fullest) at `b`, the point in
// one beat (0 to 1): a smooth fade in and out, with no sudden change.
export const beatPulse = (b) => 0.5 - 0.5 * Math.cos(2 * Math.PI * b);
