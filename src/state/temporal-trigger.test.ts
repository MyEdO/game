import { describe, it, expect } from 'vitest';
import { evalCondition } from '../engine/flowCore';
import type { TemporalCondition } from '../engine/flowCore';

/** gameTime au jour 0 (minute-de-jour = gameTime % 1440). */
const at = (h: number, m = 0) => h * 60 + m;
/** Condition `time` évaluée par la source unique `evalCondition`. */
const within = (window: TemporalCondition, gameTime: number) => evalCondition({ kind: 'time', window }, { flags: {}, gameTime });

describe('evalCondition time — fenêtre horaire d’un trigger (proximité + temps)', () => {
  it('afterHour seul : faux avant, vrai à partir de l’heure', () => {
    expect(within({ afterHour: 20 }, at(19, 59))).toBe(false);
    expect(within({ afterHour: 20 }, at(20, 0))).toBe(true);
    expect(within({ afterHour: 20 }, at(23, 0))).toBe(true);
  });

  it('fenêtre [after, before) : vrai dedans, before EXCLUSIF', () => {
    const c = { afterHour: 20, beforeHour: 22 };
    expect(within(c, at(19, 59))).toBe(false);
    expect(within(c, at(21, 0))).toBe(true);
    expect(within(c, at(22, 0))).toBe(false);
  });

  it('minutes prises en compte (20:02, comme à l’Opéra)', () => {
    expect(within({ afterHour: 20, afterMinute: 2 }, at(20, 1))).toBe(false);
    expect(within({ afterHour: 20, afterMinute: 2 }, at(20, 2))).toBe(true);
  });

  it('beforeHour seul : vrai avant l’heure', () => {
    expect(within({ beforeHour: 12 }, at(11, 30))).toBe(true);
    expect(within({ beforeHour: 12 }, at(12, 0))).toBe(false);
  });

  it('condition vide = toujours vraie', () => {
    expect(within({}, at(3, 0))).toBe(true);
  });
});
