import { describe, expect, it } from 'vitest';
import {
  beatPulse,
  bpmAt,
  clampRate,
  clampVolume,
  DEFAULT_RATES,
  DEFAULT_VOLUME,
  furthest,
  glide,
  passed,
  volumeGain,
} from '../public/lib/heartbeat.js';

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
  const { start, end } = DEFAULT_RATES;
  it('starts at 80 and is about 54 after one time through, by default', () => {
    expect(bpmAt(0)).toBe(start);
    expect(bpmAt(1)).toBeCloseTo(54, 5);
  });
  it('keeps slowing with each repeat, never below the slowest rate', () => {
    let last = Infinity;
    for (let d = 0; d <= 10; d += 0.1) {
      expect(bpmAt(d)).toBeLessThan(last);
      expect(bpmAt(d)).toBeGreaterThan(end);
      last = bpmAt(d);
    }
    expect(bpmAt(20)).toBeCloseTo(end, 1);
  });
  it('slows most at first', () => {
    expect(start - bpmAt(1)).toBeGreaterThan(bpmAt(1) - bpmAt(2));
  });
  it('starts at the start rate before the first line', () => {
    expect(bpmAt(-1)).toBe(start);
  });
  it('follows rates set in the settings', () => {
    const rates = { start: 70, end: 40 };
    expect(bpmAt(0, rates)).toBe(70);
    expect(bpmAt(30, rates)).toBeCloseTo(40, 3);
  });
  it('never speeds up, even when the slowest rate is set above the start', () => {
    expect(bpmAt(0, { start: 60, end: 90 })).toBe(60);
    expect(bpmAt(5, { start: 60, end: 90 })).toBe(60);
  });
});

describe('volumeGain', () => {
  it('is silent at 0 and loudest at 100, without distorting', () => {
    expect(volumeGain(0)).toBe(0);
    // The loud thump peaks at 0.35 times the gain; keep it under full scale.
    expect(0.35 * volumeGain(100)).toBeLessThan(1);
  });
  it('plays the default louder than the original quiet level, for phone speakers', () => {
    expect(volumeGain(DEFAULT_VOLUME)).toBeGreaterThan(1.5);
  });
  it('keeps a typed or saved volume between 0 and 100', () => {
    expect(clampVolume(-5)).toBe(0);
    expect(clampVolume(140)).toBe(100);
    expect(volumeGain(140)).toBe(volumeGain(100));
  });
});

describe('clampRate', () => {
  it('keeps a typed rate between 10 and 150, in whole beats', () => {
    expect(clampRate(5)).toBe(10);
    expect(clampRate(500)).toBe(150);
    expect(clampRate(62.4)).toBe(62);
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
