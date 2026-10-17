import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveMeleePassive, rederivePassiveAttack, weaponInflictsFlames, causeDuCoupCritique, resolveRanged, finishRanged, resolveStrayRangedHit } from './combat';
import type { RNG } from './dice';
import { critiquesDuCoup } from './critical';
import { setRule, resetRule } from './policy';
import { evaluateTest } from './tests';
import type { Combatant, Weapon } from './types';
import type { TriggeredEffect } from './flowCore';

/**
 * « Retenir vos coups » — LDB 18 l.30 en 'ldb' ; Aux Armes (`Source/WH - V4 - Aux Armes/07 - MISES A JOUR DE L'ETAT HEMORRAGIQUE.md` l.59-61) :
 *  l.59 « … vous devez déclarer que vous Retenez vos coups avant de faire le jet pour toucher … vous
 *        infligez tout de même des Blessures, mais vous n'infligez de Blessure Critique que si votre
 *        adversaire tombe à 0 Blessure. »
 *  l.61 « Vous ne pouvez pas Retenir vos coups avec une arme infligeant des États *En flammes*, avec des
 *        projectiles ou avec des sorts. Quand vous Retenez vos coups, vous perdez les Atouts d'arme
 *        suivants : *Empaleuse, Percutante, Perforante* et *Taille*. »
 */

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x',
    name: 'X',
    kind: 'enemy',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  }) as unknown as Combatant;

const empaleuseSword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'empaleuse' }] };
const percutanteSword: Weapon = { label: 'Masse', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'percutante' }] };
const perforanteSword: Weapon = { label: 'Estoc', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'perforante' }] };
const plainSword: Weapon = { label: 'Glaive', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] };

/** onHitEffect posant l'État En flammes (patron Épée ardente de Rhuin) → arme « infligeant *En flammes* ». */
const flameOnHit: TriggeredEffect = {
  trigger: 'onHit', on: 'victim',
  flow: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'ops', ops: [{ op: 'condition', id: 'en-flammes' }] } }] },
};
const flameSword: Weapon = { label: 'Épée ardente', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], onHitEffects: [flameOnHit] };

const att = () => mk({ label: 'Héros', size: 'moyenne' });
// Jet « double » réussi (33 : dizaines = unités → Critique), PAS multiple de 10 → isole le Critique du double
// de celui d'Empaleuse (l.282), qui ne se déclencherait pas ici de toute façon.
const dbl = evaluateTest(33, 60); // success, isDouble=true, units=3

const enAA = () => { beforeEach(() => setRule('combat-aa-blessures', 'aa')); afterEach(() => resetRule('combat-aa-blessures')); };

describe('Retenir ses coups — Critique supprimé sauf mise à 0 (AA 07 l.59-61)', () => {
  enAA();
  it('double (Critique normalement) sur cible PAS à 0 → critical false, Blessures normales infligées', () => {
    const normal = resolveMeleePassive(att(), mk({ wounds: { current: 12, max: 12 } }), empaleuseSword, dbl, undefined, [], undefined, false);
    const withheld = resolveMeleePassive(att(), mk({ wounds: { current: 12, max: 12 } }), empaleuseSword, dbl, undefined, [], undefined, true);
    expect(normal.critical).toBe(true); // non-régression : le double reste un Critique sans Retenir
    expect(withheld.critical).toBe(false); // Retenir : pas de Critique (cible pas à 0)
    expect(withheld.defenderDefeated).toBe(false);
    expect(withheld.woundsLost).toBe(normal.woundsLost); // les Blessures NORMALES sont infligées comme d'habitude
    expect(withheld.woundsLost).toBeGreaterThan(0);
  });

  it('même coup mais la cible tombe à 0 → le Coup Critique reste ignoré, la Blessure critique de la mise à 0 demeure', () => {
    const lowHP = mk({ wounds: { current: 4, max: 12 }, kind: 'hero' }); // 4 PB ; le coup (≈7) la met à 0 ; AA 07 l.67 : hors Mort subite
    const withheld = resolveMeleePassive(att(), lowHP, empaleuseSword, dbl, undefined, [], undefined, true);
    expect(withheld.defenderDefeated).toBe(true);
    expect(withheld.critical).toBe(false);
    const compte = critiquesDuCoup(lowHP, { coupCritique: causeDuCoupCritique(withheld), prise: true, current: 4, blessures: () => withheld.woundsLost ?? 0 });
    expect(compte.critiques.map((c) => c.origine)).toEqual(['depassement']);
  });
});

describe('Retenir ses coups — Atouts retirés (AA 07 l.61)', () => {
  enAA();
  it('Percutante retirée : les Dégâts ne reçoivent PAS le bonus de l’Atout (même jet)', () => {
    // roll 27 (unités 7) : Percutante = +unités aux Dégâts. Retenir l’annule → −7 Blessures.
    const atk = evaluateTest(27, 60); // success, units=7
    const normal = resolveMeleePassive(att(), mk(), percutanteSword, atk, undefined, [], undefined, false);
    const withheld = resolveMeleePassive(att(), mk(), percutanteSword, atk, undefined, [], undefined, true);
    expect(normal.woundsLost! - withheld.woundsLost!).toBe(7); // exactement le dé des unités (bonus Percutante)
  });

  it('Perforante retirée : l’armure n’est PLUS percée (même jet)', () => {
    const atk = evaluateTest(35, 60); // success
    const armoured = () => mk({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } });
    const normal = resolveMeleePassive(att(), armoured(), perforanteSword, atk, 'corps', [], undefined, false);
    const withheld = resolveMeleePassive(att(), armoured(), perforanteSword, atk, 'corps', [], undefined, true);
    expect(normal.woundsLost! - withheld.woundsLost!).toBe(1); // Perforante perçait 1 PA ; retirée → +1 PA absorbé
  });

  it('Taille retirée : attaquant plus grand → ni ×N ni Atout de Taille', () => {
    const big = mk({ label: 'Ogre', size: 'enorme' });   // gap +2 vs Moyenne → ×2 + Atouts de Taille
    const small = mk({ label: 'Ogre', size: 'moyenne' }); // même Force, sans bonus de Taille
    const atk = evaluateTest(25, 60); // success, units=5
    const normalBig = resolveMeleePassive(big, mk(), plainSword, atk, undefined, [], undefined, false);
    const withheldBig = resolveMeleePassive(big, mk(), plainSword, atk, undefined, [], undefined, true);
    const withheldSmall = resolveMeleePassive(small, mk(), plainSword, atk, undefined, [], undefined, true);
    expect(normalBig.woundsLost!).toBeGreaterThan(withheldBig.woundsLost!); // sans Retenir, la Taille compte
    expect(withheldBig.woundsLost).toBe(withheldSmall.woundsLost); // Retenir efface toute contribution de Taille
  });
});

describe('Retenir ses coups — gardes RAW (mêlée seule, jamais En flammes / projectiles)', () => {
  enAA();
  it('arme infligeant En flammes : Retenir est IGNORÉ (l.61) → Critique normal', () => {
    expect(weaponInflictsFlames(flameSword)).toBe(true);
    expect(weaponInflictsFlames(plainSword)).toBe(false);
    const withheld = resolveMeleePassive(att(), mk(), flameSword, dbl, undefined, [], undefined, true);
    expect(withheld.critical).toBe(true); // garde : l’arme En flammes ne peut pas Retenir → Critique conservé
  });

  it('projectile : Retenir n’a aucun effet (l.61) → Critique du double conservé', () => {
    const ranged = rederivePassiveAttack(att(), mk(), bow, dbl, 'ranged', undefined, true);
    expect(ranged.critical).toBe(true); // AA 07 l.61
  });
});

describe("Retenir ses coups en 'ldb' — tout Coup Critique ignoré, rien d'autre (LDB 18 l.30)", () => {
  it('le double ne fait plus de Coup Critique, les Atouts restent (Percutante)', () => {
    const atk = evaluateTest(33, 60);
    const normal = resolveMeleePassive(att(), mk(), percutanteSword, atk, undefined, [], undefined, false);
    const withheld = resolveMeleePassive(att(), mk(), percutanteSword, atk, undefined, [], undefined, true);
    expect(normal.critical).toBe(true);
    expect(withheld.critical).toBe(false);
    expect(withheld.woundsLost).toBe(normal.woundsLost);
  });

  it('au tir comme avec une arme En flammes, le Coup Critique est ignoré', () => {
    expect(rederivePassiveAttack(att(), mk(), bow, dbl, 'ranged', undefined, true).critical).toBe(false);
    expect(resolveMeleePassive(att(), mk(), flameSword, dbl, undefined, [], undefined, true).critical).toBe(false);
  });
});

describe("Retenir ses coups au tir en 'ldb' : la règle de la mêlée retenue (LDB 18 l.30 ; AA 07 l.59)", () => {
  const rngOf = (roll: number): RNG => ({ int: () => roll });
  const bowCrit = { ...bow, damage: { plusBF: false, flat: 4 } };

  it('tir non défendu (`resolveRanged`) : Coup Critique ignoré, Blessures inchangées, comme en mêlée', () => {
    const normal = resolveRanged(att(), mk(), bowCrit, rngOf(33), 10, undefined, [], undefined, 2, false);
    const withheld = resolveRanged(att(), mk(), bowCrit, rngOf(33), 10, undefined, [], undefined, 2, true);
    const melee = resolveMeleePassive(att(), mk(), plainSword, dbl, undefined, [], undefined, true);
    expect(normal.critical).toBe(true);
    expect(withheld.critical).toBe(melee.critical);
    expect(withheld.critical).toBe(false);
    expect(withheld.woundsLost).toBe(normal.woundsLost);
  });

  it('tir défendu (`finishRanged`) : Coup Critique ignoré', () => {
    const rate = evaluateTest(95, 40);
    const normal = finishRanged(att(), mk(), bowCrit, dbl, rate, 'esquive', 10, undefined, [], undefined, [], 2, undefined, false);
    const withheld = finishRanged(att(), mk(), bowCrit, dbl, rate, 'esquive', 10, undefined, [], undefined, [], 2, undefined, true);
    expect(normal.critical).toBe(true);
    expect(withheld.critical).toBe(false);
    expect(withheld.woundsLost).toBe(normal.woundsLost);
  });

  it('tir dévié (`resolveStrayRangedHit`) : Coup Critique ignoré sur l’allié touché', () => {
    const normal = resolveStrayRangedHit(att(), mk(), bowCrit, 33, 60, undefined, false);
    const withheld = resolveStrayRangedHit(att(), mk(), bowCrit, 33, 60, undefined, true);
    expect(normal.critical).toBe(true);
    expect(withheld.critical).toBe(false);
    expect(withheld.woundsLost).toBe(normal.woundsLost);
  });
});
