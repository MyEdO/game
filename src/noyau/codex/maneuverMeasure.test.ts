import { describe, it, expect } from 'vitest';
import { formatManeuverMeasure } from './maneuverMeasure';

describe('formatManeuverMeasure', () => {
  it('bonus de carac seul → « (Bonus de X) m »', () => {
    expect(formatManeuverMeasure({ bonusOf: 'endurance' })).toBe('(Bonus de Endurance) m');
  });
  it('bonus + constante → « (Bonus de X) + N m »', () => {
    expect(formatManeuverMeasure({ bonusOf: 'endurance', plus: 20 })).toBe('(Bonus de Endurance) + 20 m');
  });
  it('constante seule → « N m »', () => {
    expect(formatManeuverMeasure({ plus: 20 })).toBe('20 m');
  });
  it('mesure vide → « 0 m »', () => {
    expect(formatManeuverMeasure({})).toBe('0 m');
  });
});
