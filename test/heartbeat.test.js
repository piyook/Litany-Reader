import { describe, expect, it } from 'vitest';
import { BPM_FLOOR, BPM_ONCE, BPM_START, beatPulse, bpmAt, furthest, glide, passed } from '../public/lib/heartbeat.js';

describe('passed', () => {
  it('is true only on the frame that moves past the point', () => {
    expect(passed(0.4, 0.46, 0.45)).toBe(true);
    expect(passed(0.46, 0.5, 0.45)).toBe(false);
    expect(passed(0.3, 0.4, 0.45)).toBe(false);
  });
  it('handles the beat wrapping round past 1', () => {
    expect(passed(0.98, 0.02, 0)).toBe(true);
    expect(passed(0.98, 0.02, 0.99)).toBe(true);
    expect(passed(0.98, 0.02, 0.5)).toBe(false);
  });
  it('stays false when the beat has not moved', () => {
    expect(passed(0.45, 0.45, 0.45)).toBe(false);
  });
});

describe('bpmAt', () => {
  it('starts quicker and is slower after one time through', () => {
    expect(bpmAt(0)).toBe(BPM_START);
    expect(bpmAt(1)).toBeCloseTo(BPM_ONCE, 5);
  });
  it('keeps slowing with each repeat, never below the floor', () => {
    let last = Infinity;
    for (let d = 0; d <= 10; d += 0.1) {
      expect(bpmAt(d)).toBeLessThan(last);
      expect(bpmAt(d)).toBeGreaterThan(BPM_FLOOR);
      last = bpmAt(d);
    }
    expect(bpmAt(2)).toBeLessThan(BPM_ONCE - 5);
    expect(bpmAt(20)).toBeCloseTo(BPM_FLOOR, 1);
  });
  it('slows most at first', () => {
    expect(BPM_START - bpmAt(0.5)).toBeGreaterThan(bpmAt(0.5) - BPM_ONCE);
  });
  it('starts at the start rate before the first line', () => {
    expect(bpmAt(-1)).toBe(BPM_START);
  });
});

describe('furthest', () => {
  it('follows the reader forward', () => {
    expect(furthest(0, 0, 10)).toBe(0);
    expect(furthest(0, 5, 10)).toBe(0.5);
  });
  it('keeps counting when the litany repeats', () => {
    expect(furthest(0.9, 10, 10)).toBe(1);
    expect(furthest(1, 23, 10)).toBe(2.3);
  });
  it('never goes back, so the heart never speeds up again', () => {
    expect(furthest(0.6, 2, 10)).toBe(0.6); // went back a line
    expect(furthest(1.5, 0, 4)).toBe(1.5); // switched to the short form
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
