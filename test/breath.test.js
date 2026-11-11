import { describe, expect, it } from 'vitest';
import {
  clampTiming,
  cueWord,
  DEFAULT_TIMINGS,
  ease,
  fillAt,
  kindOf,
  moveStep,
  nextPhase,
  orbRadius,
  pastKind,
  phaseMs,
  revealNow,
} from '../public/lib/breath.js';

describe('kindOf', () => {
  it('alternates in and out by line when reading silently, starting with in', () => {
    expect(kindOf({ aloud: false, half: 0, idx: 0 })).toBe('in');
    expect(kindOf({ aloud: false, half: 0, idx: 1 })).toBe('out');
    expect(kindOf({ aloud: false, half: 1, idx: 2 })).toBe('in');
  });

  it('breathes out on the closing rest', () => {
    expect(kindOf({ aloud: false, half: 0, idx: 2, rest: true })).toBe('out');
  });

  it('follows the half of the line when reading aloud', () => {
    expect(kindOf({ aloud: true, half: 0, idx: 1 })).toBe('in');
    expect(kindOf({ aloud: true, half: 1, idx: 0 })).toBe('out');
  });
});

describe('phaseMs', () => {
  it('uses the breath timings, then hold1 after in and hold2 after out', () => {
    expect(phaseMs(DEFAULT_TIMINGS, 'breath', 'in')).toBe(4000);
    expect(phaseMs(DEFAULT_TIMINGS, 'breath', 'out')).toBe(6000);
    expect(phaseMs(DEFAULT_TIMINGS, 'hold', 'in')).toBe(4000);
    expect(phaseMs(DEFAULT_TIMINGS, 'hold', 'out')).toBe(2000);
  });
});

describe('clampTiming', () => {
  it('keeps breaths at least half a second, holds at least zero, both at most 30', () => {
    expect(clampTiming('in', 0)).toBe(0.5);
    expect(clampTiming('out', 99)).toBe(30);
    expect(clampTiming('hold1', -1)).toBe(0);
    expect(clampTiming('hold2', 3)).toBe(3);
  });
});

describe('ease, orbRadius and fillAt', () => {
  it('eases from 0 to 1 through a half at the middle', () => {
    expect(ease(0)).toBeCloseTo(0);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(1)).toBeCloseTo(1);
  });

  it('grows the orb on the in-breath, shrinks it on the out, holds it still', () => {
    expect(orbRadius('breath', 'in', 0)).toBe(10);
    expect(orbRadius('breath', 'in', 1)).toBe(34);
    expect(orbRadius('breath', 'out', 0)).toBe(34);
    expect(orbRadius('hold', 'in', 0.3)).toBe(34);
    expect(orbRadius('hold', 'out', 0.3)).toBe(10);
  });

  it('lights characters behind the front fully, ahead of it not at all, with a soft edge', () => {
    expect(fillAt(10, 2, 3)).toBe(1);
    expect(fillAt(10, 12, 3)).toBe(0);
    expect(fillAt(10, 8.5, 3)).toBeCloseTo(0.5);
  });
});

describe('cueWord, revealNow and pastKind', () => {
  it('says what to do', () => {
    expect(cueWord('hold', 'in', false)).toBe('hold');
    expect(cueWord('breath', 'in', true)).toBe('breathe in');
    expect(cueWord('breath', 'out', false)).toBe('breathe out');
    expect(cueWord('breath', 'out', true)).toBe('speak');
  });

  it('reveals hidden words in the hold, and only after speaking when reading aloud', () => {
    expect(revealNow('breath', false, 0)).toBe(false);
    expect(revealNow('hold', false, 0)).toBe(true);
    expect(revealNow('hold', true, 0)).toBe(false);
    expect(revealNow('hold', true, 1)).toBe(true);
    expect(revealNow('breath', false, 0, true)).toBe(true); // closing out-breath
  });

  it('gives each line already read the breath it was on', () => {
    expect([0, 1, 2].map((k) => pastKind(k, false))).toEqual(['in', 'out', 'in']);
    expect(pastKind(0, true)).toBe('out');
  });
});

describe('moveStep', () => {
  it('moves the step count with the line, never below zero', () => {
    expect(moveStep(5, 2, 4)).toBe(7);
    expect(moveStep(5, 4, 2)).toBe(3);
    expect(moveStep(1, 4, 0)).toBe(0);
  });
});

describe('nextPhase', () => {
  const at = (s) => ({ phase: 'hold', half: 0, idx: 0, step: 0, ...s });
  const silent = { aloud: false, count: 3, looping: false };

  it('goes from the breath to the hold', () => {
    expect(nextPhase(at({ phase: 'breath' }), silent)).toMatchObject({ phase: 'hold', event: 'hold' });
  });

  it('goes from the hold to the next line', () => {
    expect(nextPhase(at({ idx: 1, step: 1 }), silent)).toEqual({
      phase: 'breath',
      half: 0,
      rest: false,
      idx: 2,
      step: 2,
      event: 'line',
    });
  });

  it('adds a closing out-breath when the last line was an in-breath', () => {
    expect(nextPhase(at({ idx: 2, step: 2 }), silent)).toMatchObject({
      idx: 2,
      rest: true,
      phase: 'breath',
      event: 'rest',
    });
    expect(nextPhase(at({ idx: 2, rest: true, phase: 'breath' }), silent)).toMatchObject({ phase: 'hold', rest: true });
  });

  it('ends after the closing out-breath, or loops back to the first line on an in-breath', () => {
    expect(nextPhase(at({ idx: 2, step: 2, rest: true }), silent)).toMatchObject({ idx: 2, event: 'end' });
    expect(nextPhase(at({ idx: 2, step: 2, rest: true }), { ...silent, looping: true })).toMatchObject({
      idx: 0,
      step: 3,
      rest: false,
      event: 'loop',
    });
  });

  it('needs no closing out-breath when the last line was one', () => {
    const even = { ...silent, count: 4 };
    expect(nextPhase(at({ idx: 3, step: 3 }), even)).toMatchObject({ event: 'end' });
    expect(nextPhase(at({ idx: 3, step: 3 }), { ...even, looping: true })).toMatchObject({ idx: 0, event: 'loop' });
  });

  it('reads a line aloud on the out-breath after the in-breath hold', () => {
    const aloud = { ...silent, aloud: true };
    expect(nextPhase(at({ half: 0 }), aloud)).toMatchObject({ phase: 'breath', half: 1, idx: 0, event: 'speak' });
    expect(nextPhase(at({ half: 1 }), aloud)).toMatchObject({ phase: 'breath', half: 0, idx: 1, event: 'line' });
  });
});
