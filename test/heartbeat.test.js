import { describe, expect, it } from 'vitest';
import { BPM_END, BPM_START, beatPulse, bpmAt, furthest, glide } from '../public/lib/heartbeat.js';

describe('bpmAt', () => {
  it('starts quicker and ends slower', () => {
    expect(bpmAt(0)).toBe(BPM_START);
    expect(bpmAt(1)).toBe(BPM_END);
    expect(BPM_START).toBeGreaterThan(BPM_END);
  });
  it('only ever slows as the litany goes on', () => {
    let last = Infinity;
    for (let d = 0; d <= 1; d += 0.05) {
      expect(bpmAt(d)).toBeLessThanOrEqual(last);
      last = bpmAt(d);
    }
  });
  it('slows most at first', () => {
    expect(BPM_START - bpmAt(0.5)).toBeGreaterThan(bpmAt(0.5) - BPM_END);
  });
  it('stays between the two rates outside 0 to 1', () => {
    expect(bpmAt(-1)).toBe(BPM_START);
    expect(bpmAt(3)).toBe(BPM_END);
  });
});

describe('furthest', () => {
  it('follows the reader forward', () => {
    expect(furthest(0, 0, 10)).toBe(0);
    expect(furthest(0, 5, 10)).toBe(0.5);
  });
  it('stays at the end when the litany repeats', () => {
    expect(furthest(0.9, 10, 10)).toBe(1);
    expect(furthest(1, 23, 10)).toBe(1);
  });
  it('never goes back, so the heart never speeds up again', () => {
    expect(furthest(0.6, 2, 10)).toBe(0.6); // went back a line
    expect(furthest(1, 0, 4)).toBe(1); // switched to the short form
  });
  it('copes with an empty litany', () => {
    expect(furthest(0.3, 0, 0)).toBe(0.3);
  });
});

describe('glide', () => {
  it('moves toward the target without overshooting', () => {
    const b = glide(80, 60, 1000);
    expect(b).toBeLessThan(80);
    expect(b).toBeGreaterThan(60);
  });
  it('stays put when no time passes', () => {
    expect(glide(80, 60, 0)).toBe(80);
  });
  it('gets close after a while', () => {
    expect(glide(80, 60, 30000)).toBeCloseTo(60, 2);
  });
});

describe('beatPulse', () => {
  it('is unseen at the start of a beat and fullest half way', () => {
    expect(beatPulse(0)).toBeCloseTo(0, 5);
    expect(beatPulse(0.5)).toBeCloseTo(1, 5);
  });
  it('fades smoothly, with no sudden jump anywhere in the beat', () => {
    for (let b = 0; b < 1; b += 0.01) {
      expect(beatPulse(b)).toBeGreaterThanOrEqual(0);
      expect(beatPulse(b)).toBeLessThanOrEqual(1);
      expect(Math.abs(beatPulse(b + 0.01) - beatPulse(b))).toBeLessThan(0.04);
    }
    // The end of one beat runs straight into the start of the next.
    expect(beatPulse(0.999)).toBeCloseTo(beatPulse(0), 3);
  });
});
