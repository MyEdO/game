import { describe, it, expect } from 'vitest';
import {
  resolveQualities, attackDRAdjust, vsDefenseDRAdjust, rapideParryMod, strikesLast, canStrikeFirst,
  dangerousNine, magazineSize, protectriceAP, rangedOpposeWeapon, canPushback,
  hasBladeTrap, qualityDamageStep,
} from './dispatch';
import { woundsFromHit, finishMelee, rollMeleeDefender } from '../combat';
import { makeRNG } from '../dice';
import { rollTest } from '../tests';
import type { Combatant, Weapon } from '../types';
import { parseQualityInstance } from './normalize';

/**
 * Lot A — les 10 derniers Atouts/Défauts d'armes (LDB 62 l.229-302 / LDB 62 l.313-331) :
 * À Répétition, Immobilisante, Perturbante, Piège-lame, Protectrice, Rapide,
 * Dangereuse, Épuisante, Imprécise, Lente. Tests PURS (moteur).
 */
const w = (qualities: string[], over: Partial<Weapon> = {}): Weapon =>
  ({ label: 'Arme', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: qualities.map((s) => parseQualityInstance(s)!), ...over });

function fighter(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'x', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 30, initiative: 40, agilite: 30, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [],
    ...over,
  } as Combatant;
}

describe('préséance `beats` (LDB 62 l.302/323)', () => {
  it('Imprécise prend le dessus sur Précise (les deux présentes → Précise inerte)', () => {
    const keys = resolveQualities(w(['Imprécise', 'Précise'])).map((r) => r.def.key);
    expect(keys).toContain('Imprécise');
    expect(keys).not.toContain('Précise');
  });
  it('Lente prend le dessus sur Rapide', () => {
    const both = w(['Rapide', 'Lente']);
    expect(strikesLast([both])).toBe(true);
    expect(canStrikeFirst([both])).toBe(false);
  });
});

describe('Imprécise — −1 DR à l’attaque (LDB 62 l.323)', () => {
  it('attackDRAdjust = −1, Test réussi comme raté', () => {
    expect(attackDRAdjust(w(['Imprécise']), true)).toBe(-1);
    expect(attackDRAdjust(w(['Imprécise']), false)).toBe(-1);
    expect(attackDRAdjust(w([]), true)).toBe(0);
  });
});

describe('Lente — +1 DR à TOUTE défense adverse + frappe en dernier (LDB 62 l.329-331)', () => {
  it('vsDefenseDRAdjust = +1 (Parade ET Esquive : appliqué hors du bloc parade de finishMelee)', () => {
    expect(vsDefenseDRAdjust(w(['Lente']))).toBe(1);
  });
  it('strikesLast sur l’arme active', () => {
    expect(strikesLast([w(['Lente'])])).toBe(true);
    expect(strikesLast([w([])])).toBe(false);
  });
  it('finishMelee : le +1 DR fait basculer une ESQUIVE perdante en défense gagnante', () => {
    const a = fighter({ id: 'a' });
    const d = fighter({ id: 'd' });
    // Jets figés : attaque DR 3 (cible 40), esquive DR 2 (cible 50).
    const atk = { roll: 10, target: 40, success: true, sl: 3, isDouble: false };
    const def = { roll: 30, target: 50, success: true, sl: 2, isDouble: false };
    const sans = finishMelee(a, d, w([]), atk, def, 'esquive');
    expect(sans.hit).toBe(true); // DR 3 vs 2 → l'attaquant gagne
    const avec = finishMelee(a, d, w(['Lente']), atk, def, 'esquive');
    expect(avec.hit).toBe(false); // +1 DR au défenseur → 3 vs 3, départage par valeur cible : 50 > 40 → défenseur
  });
});

describe('Rapide — −10 à la parade adverse non-Rapide + pré-emption (LDB 62 l.298-302)', () => {
  it('rapideParryMod : −10 contre parade non-Rapide, 0 si l’arme de parade est Rapide', () => {
    expect(rapideParryMod(w(['Rapide']), w([]))).toBe(-10);
    expect(rapideParryMod(w(['Rapide']), w(['Rapide']))).toBe(0);
    expect(rapideParryMod(w([]), w([]))).toBe(0);
  });
  it('rollMeleeDefender : la pénalité s’applique en parade, pas en esquive', () => {
    const d = fighter();
    const rng = makeRNG(7);
    const parade = rollMeleeDefender(d, 'parade', rng, [], w([]), w(['Rapide']));
    expect(parade.target).toBe(30); // CC 40 − 10 (Rapide)
    const esq = rollMeleeDefender(d, 'esquive', makeRNG(7), [], w([]), w(['Rapide']));
    expect(esq.target).toBe(30); // Agilité 30, aucune pénalité Rapide
  });
  it('canStrikeFirst avec une arme Rapide', () => {
    expect(canStrikeFirst([w(['Rapide'])])).toBe(true);
    expect(canStrikeFirst([w([])])).toBe(false);
  });
});

describe('Dangereuse — Maladresse sur tout Test raté incluant un 9 (LDB 62 l.315)', () => {
  const arme = w(['Dangereuse']);
  it('9 aux unités ou aux dizaines, Test RATÉ → Maladresse', () => {
    expect(dangerousNine(arme, 49, false)).toBe(true); // unités
    expect(dangerousNine(arme, 95, false)).toBe(true); // dizaines
    expect(dangerousNine(arme, 99, false)).toBe(true);
  });
  it('Test réussi ou pas de 9 ou arme sans le Défaut → rien', () => {
    expect(dangerousNine(arme, 49, true)).toBe(false);
    expect(dangerousNine(arme, 45, false)).toBe(false);
    expect(dangerousNine(w([]), 49, false)).toBe(false);
  });
});

describe('Épuisante — Percutante/Dévastatrice seulement en Charge (LDB 62 l.319)', () => {
  it('hors Charge : les Atouts de Dégâts de l’arme sont inertes', () => {
    const arme = w(['Épuisante', 'Percutante', 'Dévastatrice']);
    const step = qualityDamageStep(arme, { effDR: 1, units: 6, charged: false });
    expect(step).toEqual({ dmgDR: 1, bonus: 0 });
  });
  it('en Charge : ils s’appliquent (Dévastatrice max + Percutante +unités)', () => {
    const arme = w(['Épuisante', 'Percutante', 'Dévastatrice']);
    const step = qualityDamageStep(arme, { effDR: 1, units: 6, charged: true });
    expect(step).toEqual({ dmgDR: 6, bonus: 6 });
  });
});

describe('À répétition — chargeur (LDB 62 l.229/231)', () => {
  it('magazineSize lit l’Indice', () => {
    expect(magazineSize(w(['À Répétition 4', 'Recharge 5'], { type: 'ranged' }))).toBe(4);
    expect(magazineSize(w(['Recharge 2'], { type: 'ranged' }))).toBeUndefined();
  });
});

describe('Protectrice — Indice PA partout en opposant (LDB 62 l.294-296)', () => {
  it('protectriceAP lit l’Indice du bouclier de parade', () => {
    expect(protectriceAP(w(['Protectrice 2', 'Défensive']))).toBe(2);
    expect(protectriceAP(w(['Défensive'])))?.valueOf();
    expect(protectriceAP(w([])))?.valueOf();
  });
  it('woundsFromHit : les PA conférés réduisent les Blessures', () => {
    const cible = fighter();
    const sans = woundsFromHit(w([]), cible, 'corps', 10, 0, 1, undefined);
    const avec = woundsFromHit(w([]), cible, 'corps', 10, 2, 1, undefined);
    expect(sans - avec).toBe(2);
  });
  it('Indice ≥ 2 → peut opposer les projectiles (rangedOpposeWeapon)', () => {
    expect(rangedOpposeWeapon([w(['Protectrice 2'])])?.qualities.some((q) => q.id === 'protectrice' && q.value === 2)).toBe(true);
    expect(rangedOpposeWeapon([w(['Protectrice 1'])])).toBeUndefined();
  });
});

describe('Perturbante / Piège-lame — prédicats', () => {
  it('canPushback / hasBladeTrap', () => {
    expect(canPushback(w(['Perturbante']))).toBe(true);
    expect(hasBladeTrap(w(['Piège-lame']))).toBe(true);
    expect(canPushback(w([]))).toBe(false);
    expect(hasBladeTrap(w([]))).toBe(false);
  });
});

describe('finishMelee — parryWeapon exposé pour les Critiques opposés (LDB 14 l.3)', () => {
  it('le résultat porte l’arme de parade en mode parade', () => {
    const a = fighter({ id: 'a' });
    const d = fighter({ id: 'd' });
    const parry = w(['Piège-lame']);
    const atk = rollTest(40, 'intermediaire', makeRNG(1));
    const def = rollTest(40, 'intermediaire', makeRNG(2));
    const res = finishMelee(a, d, w([]), atk, def, 'parade', undefined, [], [], undefined, parry);
    expect(res.parryWeapon).toBe(parry);
    const resEsq = finishMelee(a, d, w([]), atk, def, 'esquive', undefined, [], [], undefined, parry);
    expect(resEsq.parryWeapon).toBeUndefined();
  });
});
