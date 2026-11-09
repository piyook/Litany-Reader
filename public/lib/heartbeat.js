// The heartbeat behind the breath ring: a soft heart that fades in and out,
// a little quick at first and slower as the litany goes on, so watching it
// (or listening) helps you settle too. It is a calming cue, not a real pulse.

// Beats per minute at the start, and the slowest it gets after many times through.
// Both can be changed in the settings.
export const DEFAULT_RATES = { start: 60, end: 20 };

// A rate typed into the settings, kept between 10 and 150 beats a minute.
export const clampRate = (v) => Math.max(10, Math.min(150, Math.round(v)));

// How quickly it slows: one time through covers about 43% of the way from the
// start rate to the slowest (60 to 43 with the defaults), two about 68%, three 82%.
const SLOWING = Math.log(60 / 34);

// Beats per minute after `done` times through the litany (0.5 is half way
// through the first reading, 2 is two whole readings). It slows most at first,
// then keeps easing down with each repeat toward the slowest rate. A slowest
// rate set above the start rate is treated as the start rate, so it never speeds up.
export function bpmAt(done, rates = DEFAULT_RATES) {
  const end = Math.min(rates.end, rates.start);
  return end + (rates.start - end) * Math.exp(-SLOWING * Math.max(0, done));
}

// How many times through the litany a reader has got, never going back:
// `before` is the furthest reached so far. Going back a line or switching form
// keeps it where it was, so the heart never speeds up again.
export const furthest = (before, step, count) => (count > 0 ? Math.max(before, step / count) : before);

// Moves the shown rate toward `target`, so it glides instead of jumping at each
// line: about two thirds of the way there every 3 seconds.
export const glide = (bpm, target, ms) => bpm + (target - bpm) * (1 - Math.exp(-ms / 3000));

// Heartbeat sound volume, 0 to 100, set with the slider in the settings. The
// default plays about 1.8 times the original quiet level, loud enough for a
// phone speaker; 100 is the loudest the sound goes without distorting.
export const DEFAULT_VOLUME = 70;
const MAX_GAIN = 2.6;
export const clampVolume = (v) => Math.max(0, Math.min(100, Math.round(v)));
export const volumeGain = (v) => (clampVolume(v) / 100) * MAX_GAIN;

// True when the beat moved past point `at` going from `before` to `after`
// (all 0 to 1, wrapping round at 1). Used to sound each beat once.
export const passed = (before, after, at) =>
  before <= after ? before < at && at <= after : at > before || at <= after;

// The point in a beat (0 to 1) at which to start the sound so it lands with the
// heart at its fullest (half way, 0.5). The sound has a fixed start-up delay
// (about 30ms), so the lead is a time, not a share of the beat: a share that suits
// 60 beats a minute starts it far too early at 20.
const SOUND_LEAD_MS = 30;
export const soundPoint = (bpm) => Math.max(0, 0.5 - (SOUND_LEAD_MS * bpm) / 60000);

// How visible the heart is (0 unseen, 1 at its fullest) at `b`, the point in
// one beat (0 to 1): a smooth fade in and out, with no sudden change.
export const beatPulse = (b) => 0.5 - 0.5 * Math.cos(2 * Math.PI * b);
