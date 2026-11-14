/**
 * Curation élargie (Lot 8 bis) : Magie mineure + Arcanes communs + Miracles
 * Sigmar/Shallya curés, ops missile (Drain soigne le lanceur, Grands feux posent
 * leurs États), PA temporisés (Armure Aethyrique), désambiguïsation des labels
 * en double, inventaire d'implémentation.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyCast } from './combatFlow';
import { herosDeScenario, groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { findSpellById } from '../data';
import { spellSupportOf } from '../engine/spellspec';
import { woundsFromHit } from '../engine/combat';
import { effectiveArmourAt } from '../engine/characteristics';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant, Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const ok = (sl: number): CastResult => ({ cast: true, roll: 21, target: 70, sl, isCritical: false, isFumble: false, log: 'lancé' });

beforeEach(() => {
  banc.getState().ensemencerLeTirage(51);
});

describe('désambiguïsation et classification', () => {
  it('label en double : « Enchevêtrement » est DEUX ids (Arcane vs miracle de Taal)', () => {
    const arcane = findSpellById('enchevetrement')!;
    const taal = findSpellById('enchevetrement-2')!;
    expect(arcane.label).toBe(taal.label);
    expect(arcane.ecole).toBe('Magie des Arcanes');
    expect(taal.ecole).toBe('Invocation');
  });

  it('spellSupportOf : classification mécanique / partiel / narratif', () => {
    const choc = findSpellById('choc')!; // Magie mineure
    expect(spellSupportOf(choc)).toBe('mecanique');
    const lumiere = findSpellById('lumiere')!;
    // Lumière émet une VRAIE lumière (op `light` → brouillard de guerre) : volet mécanique +
    // la narration de modulation bougie↔lanterne (Test de Focalisation, non modélisé, arbitrage MJ) → partiel.
    expect(spellSupportOf(lumiere)).toBe('partiel');
    // Cautériser : mécanique (heal/removeCondition/preventInfection/Inconscient sur −6 DR) + un volet
    // « arbitrage MJ » (le hurlement de douleur). Le Test interne est un nœud Flow `test` :
    // sa narration vit dans la branche `fail`, visible par `spellEffectOps` → la classification reflète
    // ce volet → « partiel ».
    const cauteriser = findSpellById('cauteriser')!;
    expect(spellSupportOf(cauteriser)).toBe('partiel');
    const couronne = findSpellById('couronne-de-flammes')!;
    expect(spellSupportOf(couronne)).toBe('partiel');
  });
});

describe('Armure Aethyrique — PA temporisés', () => {
  it('pose un effet apAll, lu par effectiveArmourAt et la mitigation woundsFromHit', () => {
    const w = herosDeScenario(idsDeTest, 'sorcier');
    banc.setState({ party: [w] as Combatant[] });
    const before = effectiveArmourAt(w, 'corps');
    applyCast(banc.getState, banc.setState, w, w, findSpellById('armure-aethyrique')!, ok(3), false, false);
    expect(effectiveArmourAt(w, 'corps')).toBe(before + 1);
    const arme: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], subType: 'Base' } as never;
    const sans = { ...w, activeEffects: [] } as Combatant;
    expect(woundsFromHit(arme, w, 'corps', 10, 0, 1, undefined)).toBe(woundsFromHit(arme, sans, 'corps', 10, 0, 1, undefined) - 1);
  });
});

describe('ops de spec sur la branche Projectile (curées seulement)', () => {
  it('Drain : le LANCEUR regagne 1 PB après la touche', () => {
    const [w, cible] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
    w.wounds.current = w.wounds.max - 3;
    banc.setState({ party: [w, cible] as Combatant[] });
    const drain = findSpellById('drain')!; // Magie mineure
    const res: CastResult & Partial<MissileResult> = { ...ok(2), hit: true, location: 'corps', damage: 5, woundsLost: 2, defenderDefeated: false };
    const before = w.wounds.current;
    applyCast(banc.getState, banc.setState, w, cible, drain, res, true, false);
    expect(banc.getState().party.find((h) => h.id === w.id)!.wounds.current).toBe(before + 1);
  });

  it('Éblouissant : Aveuglé immédiat + récurrent porté par un effet actif', () => {
    const [w, cible] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
    banc.setState({ party: [w, cible] as Combatant[] });
    applyCast(banc.getState, banc.setState, w, cible, findSpellById('eblouissant')!, ok(2), false, false);
    const after = banc.getState().party.find((h) => h.id === cible.id)!;
    expect(after.conditions.find((x) => x.id === 'aveugle')?.value).toBe(1);
    expect(after.activeEffects?.some((e) => e.opsPerRound?.some((o) => o.op === 'condition' && o.id.id === 'aveugle'))).toBe(true);
  });

  it('Innocence immaculée : retire 1 Point de Corruption (jamais sous 0)', () => {
    const [p, w] = groupeDeScenario(idsDeTest, 'pretre', 'sorcier');
    w.corruption = 2;
    banc.setState({ party: [p, w] as Combatant[] });
    applyCast(banc.getState, banc.setState, p, w, findSpellById('innocence-immaculee')!, ok(1), false, false);
    expect(banc.getState().party.find((h) => h.id === w.id)!.corruption).toBe(1);
  });
});
