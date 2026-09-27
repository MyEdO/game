import { describe, it, expect } from 'vitest';
import type { SpellRange, SpellTarget } from './spellRange';
import { formatSpellRange, formatSpellTarget } from './spellRangeFormat';

describe('spellRangeFormat — affichage DÉRIVÉ de la Portée et de la Cible', () => {
  const ranges: [SpellRange, string][] = [
    [{ kind: 'self' }, 'Vous'],
    [{ kind: 'touch' }, 'Contact'],
    [{ kind: 'distance', value: 6, unit: 'm' }, '6 mètres'],
    [{ kind: 'distance', value: { charOf: 'force-mentale' }, unit: 'm' }, '(Force Mentale) mètres'],
    [{ kind: 'distance', value: { bonusOf: 'initiative' }, unit: 'km' }, '(Bonus de Initiative) kilomètres'],
    [{ kind: 'special', text: 'Voir texte' }, 'Voir texte'],
  ];
  for (const [r, prose] of ranges) it(`portée ${JSON.stringify(r)}`, () => expect(formatSpellRange(r)).toBe(prose));

  const targets: [SpellTarget, string][] = [
    [{ kind: 'self' }, 'Vous'],
    [{ kind: 'count', n: 1 }, '1 cible'],
    [{ kind: 'count', n: 3 }, '3 cibles'],
    [{ kind: 'area', span: 'diameter', meters: 8 }, 'ZdE diamètre 8 mètres'],
    [{ kind: 'area', span: 'radius', meters: { bonusOf: 'sociabilite' } }, 'ZdE rayon (Bonus de Sociabilité) mètres'],
    [{ kind: 'cone', lengthMeters: 8, widthMeters: 2 }, 'Cône Longueur (8 mètres) x Largeur (2 mètres)'],
    [{ kind: 'special', text: 'Spécial' }, 'Spécial'],
  ];
  for (const [t, prose] of targets) it(`cible ${JSON.stringify(t)}`, () => expect(formatSpellTarget(t)).toBe(prose));
});
