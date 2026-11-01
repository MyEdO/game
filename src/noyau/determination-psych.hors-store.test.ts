import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { isPsychImmune, clearPsychOf } from '../engine/psychology';
import { psychDRAdjust } from '../engine/combat';
import { traumaCharPenalties, traumaMovementHalved, traumaDodgePenalty, passiveTestMod } from '../engine/trauma';
import type { Combatant } from '../engine/types';
import { ciblePsy } from '../engine/psych/ciblage';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const C = (o: Partial<Combatant>): Combatant => combattantDeTest(o);

describe('isPsychImmune — prédicat central (trait / Frénésie / Détermination temp)', () => {
  it('trait Immunité ou Frénésie → immunisé', () => {
    expect(isPsychImmune(C({ psychImmune: true }))).toBe(true);
    expect(isPsychImmune(C({ psychState: [{ type: 'frenesie' }] }))).toBe(true);
    expect(isPsychImmune(C({}))).toBe(false);
  });
  it('Détermination temporaire : immunisé tant qu\'un ActiveEffect `psychImmune` est porté (LDB 17 l.59)', () => {
    const det = (left: number) => C({ activeEffects: [{ label: 'D', bonus: 0, duration: { scale: 'rounds', left }, psychImmune: true } as never] });
    expect(isPsychImmune(det(2))).toBe(true);
    expect(isPsychImmune(det(1))).toBe(true);
    expect(isPsychImmune(C({ activeEffects: [] }))).toBe(false);
  });
});

describe('clearPsychOf — les effets psy d\'une créature finissent à sa mort', () => {
  it('retire de TOUS les combattants les afflictions sourcées par la créature morte', () => {
    const h1 = C({ psychState: [{ type: 'peur', sourceId: 'mort', indice: 2, calmeDR: 0 } as never, { type: 'peur', sourceId: 'vivant', indice: 1, calmeDR: 0 } as never] });
    const h2 = C({ psychState: [{ type: 'animosite', sourceId: 'mort', cible: ciblePsy.groupe('elfe'), active: true }] });
    clearPsychOf([h1, h2], 'mort');
    expect(h1.psychState!.map((p) => p.sourceId)).toEqual(['vivant']); // l'autre source reste
    expect(h2.psychState).toEqual([]);
  });
});

describe('Immunité psy → AUCUN modificateur de combat psy (psychDRAdjust, LDB 17 l.59)', () => {
  it('une Peur active donne −1 DR (psychDRAdjust), mais sous immunité Détermination ce malus disparaît', () => {
    const target = C({ id: 't', groups: [], conditions: [], size: 'moyenne' });
    const afraid = C({ advantage: 0, conditions: [], psychState: [{ type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 } as never] });
    expect(psychDRAdjust(afraid, target)).toBe(-1); // RAW : −1 DR au jet, pas un −10 sur la cible
    afraid.activeEffects = [{ label: 'D', bonus: 0, duration: { scale: 'rounds', left: 2 }, psychImmune: true } as never]; // Détermination active
    expect(psychDRAdjust(afraid, target)).toBe(0); // immunisé (LDB 17 l.59) → plus de malus
  });
});

describe('Détermination « ignorer modifs de critique » (LDB 17 l.60) annule les pénalités de trauma', () => {
  const trauma = () => C({ traumas: [{ ops: [{ op: 'charMod', char: 'force', mod: -30 }, { op: 'skillMod', skill: { id: 'esquive' }, mod: -20 }, { op: 'moveScale', num: 1, den: 2 }] } as never] });
  it('actif : pénalités normales', () => {
    const c = trauma();
    expect(traumaCharPenalties(c, 'force')).toEqual([-30]);
    expect(traumaDodgePenalty(c)).toBe(-20);
    expect(traumaMovementHalved(c)).toBe(true);
  });
  it('ignoreCritMods : toutes les pénalités de trauma sont annulées', () => {
    const c = trauma();
    c.activeEffects = [{ label: 'D', bonus: 0, duration: { scale: 'rounds', left: 1 }, ignoreCritMods: true } as never];
    expect(traumaCharPenalties(c, 'force')).toEqual([]);
    expect(traumaDodgePenalty(c)).toBe(0);
    expect(traumaMovementHalved(c)).toBe(false);
  });
});

/**
 * LDB 17 l.59-61, verbatim — les TROIS emplois d'un Point de Détermination :
 * « - Demeurer immunisé à *Psychologie* jusqu'à la fin du prochain Round. […]
 *   - Ignorer tous les modificateurs dus à une Blessure critique jusqu'au début du prochain Round.
 *   - Retirez un État : si vous retirez l'État à Terre, regagnez 1 Point de Blessure lorsque vous vous
 *     mettez debout. »
 * Aucun ne touche une MALADIE : le canal `maladie` n'est dans AUCUN annulateur. Ce qu'une dépense peut
 * faire pour un malade, c'est suspendre le SYMPTÔME qui porte un État (LDB 20 l.170), jamais lever ses
 * pénalités continues.
 */
describe('la Détermination ne lève AUCUNE pénalité de MALADIE (LDB 17 l.59-61)', () => {
  // Fièvre (LDB 20 l.170) = −10 aux Tests Physiques/Sociaux ; `characteristics` requis (le collecteur itère ses clés).
  const sick = () => C({ characteristics: { force: 30, sociabilite: 30 } as never, diseases: [{ phase: 'active', symptoms: [{ symptomId: 'fievre' }] } as never] });
  it('actif : fièvre = −10 aux Tests de Force, la Force elle-même intacte', () => {
    expect(passiveTestMod(sick(), 'force')).toBe(-10);
    expect(traumaCharPenalties(sick(), 'force')).toEqual([]);
  });
  it('ignoreCritMods (l.60) : la fièvre garde ses −10 — seul le CRITIQUE est ignoré', () => {
    const c = sick();
    c.activeEffects = [{ label: 'D', bonus: 0, duration: { scale: 'rounds', left: 1 }, ignoreCritMods: true } as never];
    expect(passiveTestMod(c, 'force')).toBe(-10);
  });
});

describe('Actions Détermination — immunité psy & ignore-crit (store)', () => {
  function withHero() {
    const hero = C({ id: 'h', kind: 'hero', label: 'H', resolve: 2, conditions: [], wounds: blessuresDeBase(10) });
    banc.setState({ battle: { combatants: [hero], order: ['h'], turn: 0, round: 2, over: false, log: [], acted: false } as never });
    return hero;
  }

  it('battleResolvePsychImmune : immunisé jusqu\'au Round courant+1, −1 Détermination, ne consomme pas l\'Action', () => {
    withHero();
    banc.getState().battleResolvePsychImmune();
    const h = banc.getState().battle!.combatants[0];
    const psy = h.activeEffects?.find((e) => e.psychImmune); // ce Round + le prochain
    expect(psy?.duration).toEqual({ scale: 'rounds', left: 2 });
    expect(h.resolve).toBe(1);
    expect(banc.getState().battle!.acted).toBe(false); // gratuit
  });

  it('battleResolveIgnoreCrit : pose ignoreCritMods, −1 Détermination', () => {
    withHero();
    banc.getState().battleResolveIgnoreCrit();
    const h = banc.getState().battle!.combatants[0];
    expect(h.activeEffects?.some((e) => e.ignoreCritMods)).toBe(true);
    expect(h.resolve).toBe(1);
  });

  it('sans Détermination (0) : no-op', () => {
    const hero = C({ id: 'h', kind: 'hero', label: 'H', resolve: 0, conditions: [], wounds: blessuresDeBase(10) });
    banc.setState({ battle: { combatants: [hero], order: ['h'], turn: 0, round: 1, over: false, log: [], acted: false } as never });
    banc.getState().battleResolvePsychImmune();
    expect(banc.getState().battle!.combatants[0].activeEffects?.some((e) => e.psychImmune)).toBeFalsy();
  });
});
