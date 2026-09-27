import { describe, it, expect } from 'vitest';
import type { SpellDuration } from './spellDuration';
import { formatSpellDuration } from './spellRangeFormat';

describe('spellRangeFormat — affichage DÉRIVÉ de la Durée', () => {
  const ds: [SpellDuration, string][] = [
    [{ kind: 'instant' }, 'Instantané'],
    [{ kind: 'rounds', value: { bonusOf: 'force-mentale' } }, '(Bonus de Force Mentale) Rounds'],
    [{ kind: 'clock', value: 1, unit: 'hours' }, '1 heure'],
    [{ kind: 'clock', value: { charOf: 'force-mentale' }, unit: 'minutes' }, '(Force Mentale) minutes'],
    [{ kind: 'untilDawn' }, "Jusqu'au lever du soleil"],
  ];
  for (const [d, prose] of ds) it(JSON.stringify(d), () => expect(formatSpellDuration(d)).toBe(prose));

  it('le marqueur « + » de fin de Durée (LDB 47 l.311, #543) s’affiche', () => {
    expect(formatSpellDuration({ kind: 'rounds', value: { bonusOf: 'force-mentale' }, plus: true })).toBe('(Bonus de Force Mentale) Rounds +');
    expect(formatSpellDuration({ kind: 'special', text: '8 Tours', plus: true })).toBe('8 Tours +');
  });
});
