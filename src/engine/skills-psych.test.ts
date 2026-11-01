import { describe, it, expect } from 'vitest';
import { socialPsychMod, socialPsychLabel, isSocialTest, partyBest } from './skills';
import type { Combatant } from './types';
import { ciblePsy } from './psych/ciblage';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

function mk(opts: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({ id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [], characteristics: { sociabilite: 40 } as never, psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: blessuresDeBase(10), ...opts }) as Combatant;
}

describe('socialPsychMod — pénalités de Sociabilité psy (LDB 21, P3)', () => {
  it('Animosité POSSÉDÉE (trait), non testée → −20 « contenu » (hors combat : pas d’affliction, l.22)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] });
    expect(socialPsychMod(tester, ['elfe', 'soldat'])).toBe(-20);
    expect(socialPsychMod(tester, ['humain'])).toBe(0); // hors groupe
  });
  it('Animosité ACTIVE (Test de Psy ÉCHOUÉ) → 0 : compulsion d’attaque, PAS le malus social contenu (LDB 21 l.21)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }], psychState: [{ type: 'animosite', cible: ciblePsy.groupe('elfe'), active: true }] });
    expect(socialPsychMod(tester, ['elfe'])).toBe(0);
  });
  it('Animosité RÉSISTÉE (Test de Psy RÉUSSI, active:false) → −20 : c’est précisément l’effet du succès (LDB 21 l.19)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }], psychState: [{ type: 'animosite', cible: ciblePsy.groupe('elfe'), active: false }] });
    expect(socialPsychMod(tester, ['elfe'])).toBe(-20);
  });
  it('Préjugé (trait possédé) vs le groupe → −10 (l.43-52)', () => {
    const tester = mk({ psychTraits: [{ type: 'prejuge', cible: ciblePsy.groupe('nain') }] });
    expect(socialPsychMod(tester, ['nain'])).toBe(-10);
    expect(socialPsychMod(tester, ['elfe'])).toBe(0);
  });
  it('Animosité + Préjugé cumulent (−30)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('peau-verte') }, { type: 'prejuge', cible: ciblePsy.groupe('peau-verte') }] });
    expect(socialPsychMod(tester, ['peau-verte'])).toBe(-30);
  });
  it('ignoreAnimosity (« meilleur ami ») : le malus contenu d’Animosité/Préjugé DISPARAÎT tant que l’effet dure', () => {
    const tester = mk({
      psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('peau-verte') }, { type: 'prejuge', cible: ciblePsy.groupe('peau-verte') }],
      activeEffects: [{ label: 'Ivresse', bonus: 0, duration: { scale: 'permanent' }, ignoreAnimosity: true }],
    });
    expect(socialPsychMod(tester, ['peau-verte'])).toBe(0);
  });
  it('effet EXPIRÉ (activeEffects vide) → le malus contenu revient', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('peau-verte') }], activeEffects: [] });
    expect(socialPsychMod(tester, ['peau-verte'])).toBe(-20);
  });
  it('socialPsychLabel : libellé lisible du malus (ou undefined)', () => {
    expect(socialPsychLabel(mk({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] }), ['elfe'])).toBe('Animosité −20');
    expect(socialPsychLabel(mk({ psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('peau-verte') }, { type: 'prejuge', cible: ciblePsy.groupe('peau-verte') }] }), ['peau-verte'])).toBe('Animosité −20 · Préjugé −10');
    expect(socialPsychLabel(mk({}), ['elfe'])).toBeUndefined();
  });
});

describe('isSocialTest — un Test est-il de Sociabilité ? (LDB 21)', () => {
  it('Caractéristique Soc → vrai', () => {
    expect(isSocialTest(undefined, 'sociabilite')).toBe(true);
    expect(isSocialTest(undefined, 'force')).toBe(false);
  });
  it('Compétence basée sur Soc (Charme, Marchandage) → vrai ; autre → faux', () => {
    expect(isSocialTest('charme')).toBe(true);
    expect(isSocialTest('marchandage')).toBe(true);
    expect(isSocialTest('escalade')).toBe(false);
  });
});

describe('partyBest — modificateur par acteur (sélection avec malus psy intégré)', () => {
  it('choisit le membre dont la valeur EFFECTIVE (avec malus) est la meilleure', () => {
    const a = mk({ id: 'a', label: 'A', characteristics: { sociabilite: 50 } as never, psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] }); // 50 − 20 = 30
    const b = mk({ id: 'b', label: 'B', characteristics: { sociabilite: 40 } as never }); // 40, pas de malus
    const mod = (c: Combatant) => socialPsychMod(c, ['elfe']);
    const best = partyBest([a, b], undefined, 'sociabilite', mod);
    expect(best?.actor.id).toBe('b'); // B (40) > A (30 après malus) malgré la Soc brute plus basse
    expect(best?.value).toBe(40);
  });
});
