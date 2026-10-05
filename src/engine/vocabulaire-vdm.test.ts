/**
 * Tests de CÂBLAGE des familles d'effet ouvertes pour VDM (#843) — chacun part de la DONNÉE RÉELLE
 * (`spells.json`, lue via `spellEffectOps`), jamais d'ops forgées à la main : si le sort cesse de
 * porter son op, ou si le moteur cesse de l'appliquer, le test rougit.
 *
 * Familles couvertes :
 *  1. `ap` à montant NÉGATIF (retrait de Points d'Armure) + `atHitLocation`.
 *  2. `augmentWeapon` DÉGRADANT (retrait d'Atouts par TYPE + passif d'arme conféré).
 *  3. `corruptionExposure` `easeSteps` (atténuation d'une Influence corruptrice, en crans).
 *  4. `Formula` `times` à FACTEUR formulable (produit de deux formules).
 */
import { describe, it, expect } from 'vitest';
import { applyOps, resolveFormula, type GameOp } from './ops';
import { spellEffectOps } from './flowCore';
import { effectiveArmourAt } from './characteristics';
import { attackDRAdjust, hasQuality, resolveQualities } from './qualities/dispatch';
import { recomputeLoadout, parseDamage } from './items';
import { easeExposure, corruptionEaseSteps, type ExposureLevel } from './corruption';
import { findSpellById } from '../data';
import { makeRNG } from './dice';
import type { Combatant, ItemInstance } from './types';
import { objetDeTest } from './objetDeTest.testkit';

const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

/** Ops du sort d'`id` — DONNÉE réelle (`spells.json` → Flow → feuilles EffectOp). */
const opsOf = (id: string): GameOp[] => {
  const s = findSpellById(id);
  expect(s, `sort introuvable : ${id}`).toBeTruthy();
  return spellEffectOps(s!.effects);
};

describe('1 — op `ap` à montant NÉGATIF : Armure de fer blanc (VDM 05)', () => {
  it('la donnée porte bien un retrait de 2 PA', () => {
    const ap = opsOf('armure-de-fer-blanc').find((o) => o.op === 'ap');
    expect(ap).toEqual({ op: 'ap', amount: -2 });
  });

  it('−2 PA à CHAQUE Localisation, lus par effectiveArmourAt (le clamp à la pose rendrait l’op inerte)', () => {
    const c = dummy({ armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } });
    applyOps(c, opsOf('armure-de-fer-blanc'), { label: 'Armure de fer blanc', defaultDurationRounds: 3 });
    expect(effectiveArmourAt(c, 'corps')).toBe(1);
    expect(effectiveArmourAt(c, 'tete')).toBe(1);
  });

  it('le PLANCHER est celui du TOTAL : une armure de 1 PA tombe à 0, jamais sous', () => {
    const c = dummy({ armour: { tete: 1, brasG: 1, brasD: 1, corps: 1, jambeG: 1, jambeD: 1 } });
    applyOps(c, opsOf('armure-de-fer-blanc'), { label: 'Armure de fer blanc', defaultDurationRounds: 3 });
    expect(effectiveArmourAt(c, 'corps')).toBe(0);
  });
});

describe('1 bis — `ap` `atHitLocation` : Inscription, volet acide (VDM 05)', () => {
  it('le PA est détruit à la Localisation TOUCHÉE, et nulle part ailleurs', () => {
    const c = dummy({ armour: { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 } });
    applyOps(c, opsOf('inscription'), { label: 'Inscription', location: 'tete' });
    expect(effectiveArmourAt(c, 'tete')).toBe(1);
    expect(effectiveArmourAt(c, 'corps')).toBe(2);
  });

  it('hors contexte de touche, RIEN n’est posé (jamais un repli sur « toutes les Localisations »)', () => {
    const c = dummy({ armour: { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 } });
    applyOps(c, opsOf('inscription'), { label: 'Inscription' });
    expect(effectiveArmourAt(c, 'tete')).toBe(2);
    expect(effectiveArmourAt(c, 'corps')).toBe(2);
  });
});

describe('2 — `augmentWeapon` DÉGRADANT : Défaut (VDM 05)', () => {
  /** Combattant tenant une épée PRÉCISE (Atout `precise` : +10 en attaque, `weaponRollMod`). */
  const wielder = (): Combatant => {
    const item: ItemInstance = objetDeTest({ uid: 'w', trappingId: 'arme-simple', kind: 'melee', damage: parseDamage('+BF+4'), reach: 'Moyenne', range: null, qualities: [{ id: 'precise' }], enc: 1, equipped: true });
    const c = dummy({ items: [item], loadouts: [{ id: 'lo', main: 'w' }], activeLoadoutId: 'lo' });
    recomputeLoadout(c);
    return c;
  };

  it('la donnée porte le retrait des Atouts par TYPE et le passif d’attaque −1 DR', () => {
    const aug = opsOf('defaut-metal').find((o) => o.op === 'augmentWeapon');
    expect(aug).toEqual({ op: 'augmentWeapon', removeType: 'atout', passive: [{ op: 'weaponRollMod', phase: 'attack', drMod: -1 }] });
  });

  it('« Tous les Atouts de l’arme disparaissent » — le TYPE est lu au registre, pas listé en dur', () => {
    const c = wielder();
    expect(hasQuality(c.weapons[0], 'precise')).toBe(true);
    applyOps(c, opsOf('defaut-metal'), { label: 'Défaut', defaultDurationRounds: 3 });
    expect(hasQuality(c.weapons[0], 'precise')).toBe(false);
    // Aucun Atout ne subsiste (les Défauts, eux, ne sont pas visés).
    expect(resolveQualities(c.weapons[0]).filter((r) => r.data?.polarite === 'atout')).toEqual([]);
  });

  it('« −1 DR à tous les Tests pour attaquer avec elle » — passif d’arme conféré, lu par attackDRAdjust', () => {
    const c = wielder();
    const before = attackDRAdjust(c.weapons[0], true);
    applyOps(c, opsOf('defaut-metal'), { label: 'Défaut', defaultDurationRounds: 3 });
    expect(attackDRAdjust(c.weapons[0], true)).toBe(before - 1);
  });
});

describe('3 — `corruptionExposure` `easeSteps` : Bouclier en acier doré (VDM 05)', () => {
  it('la donnée porte l’abri de 2 crans', () => {
    const e = opsOf('bouclier-en-acier-dore').find((o) => o.op === 'corruptionExposure');
    expect(e).toEqual({ op: 'corruptionExposure', easeSteps: 2 });
  });

  it('« une Exposition Majeure en devient une Mineure » — l’abri atténue le niveau POSÉ', () => {
    const c = dummy();
    applyOps(c, opsOf('bouclier-en-acier-dore'), { label: 'Bouclier en acier doré', defaultDurationRounds: 10 });
    expect(corruptionEaseSteps(c)).toBe(2);
    const seen: ExposureLevel[] = [];
    applyOps(c, [{ op: 'corruptionExposure', level: 'majeure' }], { onCorruptionExposure: (l) => { seen.push(l); return []; } });
    expect(seen).toEqual(['mineure']);
  });

  it('sous le premier cran, aucune exposition n’est posée', () => {
    const c = dummy();
    applyOps(c, opsOf('bouclier-en-acier-dore'), { label: 'Bouclier en acier doré', defaultDurationRounds: 10 });
    const seen: ExposureLevel[] = [];
    applyOps(c, [{ op: 'corruptionExposure', level: 'moderee' }], { onCorruptionExposure: (l) => { seen.push(l); return []; } });
    expect(seen).toEqual([]);
  });

  it('sans abri, le niveau posé est intact (l’atténuation ne s’invente pas)', () => {
    const seen: ExposureLevel[] = [];
    applyOps(dummy(), [{ op: 'corruptionExposure', level: 'majeure' }], { onCorruptionExposure: (l) => { seen.push(l); return []; } });
    expect(seen).toEqual(['majeure']);
    expect(easeExposure('majeure', 0)).toBe('majeure');
  });
});

describe('4 — `Formula` `times` à FACTEUR formulable : Contact doré (VDM 05)', () => {
  it('la Durée est « (Force Mentale) × 1d10 minutes », plus un `special` de repli', () => {
    const d = findSpellById('contact-dore')!.duration;
    expect(d).toEqual({ kind: 'clock', value: { times: { of: { charOf: 'force-mentale' }, factor: { dice: { n: 1, sides: 10 } } } }, unit: 'minutes' });
  });

  it('le produit se résout : FM 38 × 1d10 ∈ [38, 380], et pas 38 × 1', () => {
    const c = dummy(); // FM 38
    const f = { times: { of: { charOf: 'force-mentale' as const }, factor: { dice: { n: 1, sides: 10 } } } };
    const vals = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) vals.add(resolveFormula(f, c, makeRNG(seed)));
    for (const v of vals) {
      expect(v % 38).toBe(0);
      expect(v).toBeGreaterThanOrEqual(38);
      expect(v).toBeLessThanOrEqual(380);
    }
    expect(vals.size).toBeGreaterThan(1); // le facteur est TIRÉ, pas figé
  });
});
