// The heartbeat behind the breath ring: a soft heart that fades in and out,
// a little quick at first and slower as the litany goes on, so watching it
// (or listening) helps you settle too. It is a calming cue, not a real pulse.

export const BPM_START = 80;
export const BPM_ONCE = 54; // after one time through
export const BPM_FLOOR = 42; // the slowest it ever gets, after many times through

// How quickly it slows: chosen so one time through lands on BPM_ONCE.
const RATE = Math.log((BPM_START - BPM_FLOOR) / (BPM_ONCE - BPM_FLOOR));

// Beats per minute after `done` times through the litany (0.5 is half way
// through the first reading, 2 is two whole readings). It slows most at first,
// then keeps easing down with each repeat toward BPM_FLOOR.
export function bpmAt(done) {
  return BPM_FLOOR + (BPM_START - BPM_FLOOR) * Math.exp(-RATE * Math.max(0, done));
}

// How many times through the litany a reader has got, never going back:
// `before` is the furthest reached so far. Going back a line or switching form
// keeps it where it was, so the heart never speeds up again.
export const furthest = (before, step, count) => (count > 0 ? Math.max(before, step / count) : before);

// Moves the shown rate toward `target`, so it glides instead of jumping at each
// line: about two thirds of the way there every 3 seconds.
export const glide = (bpm, target, ms) => bpm + (target - bpm) * (1 - Math.exp(-ms / 3000));

// True when the beat moved past point `at` going from `before` to `after`
// (all 0 to 1, wrapping round at 1). Used to sound each beat once.
export const passed = (before, after, at) =>
  before <= after ? before < at && at <= after : at > before || at <= after;

// How visible the heart is (0 unseen, 1 at its fullest) at `b`, the point in
// one beat (0 to 1): a smooth fade in and out, with no sudden change.
export const beatPulse = (b) => 0.5 - 0.5 * Math.cos(2 * Math.PI * b);
