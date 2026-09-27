import { describe, it, expect } from 'vitest';
import { fireTriggers } from '../state/triggeredEffects';
import { useGame } from '../state/store';
import { seedBattleRng, battleRng } from '../state/battleRng';
import { emptyScene } from '../state/scene';
import { resolveRecoverTest } from '../state/combat/recover';
import { weaponFromTrait } from '../engine/creatureEquip';
import { findTrappingById, findQualityById } from './index';
import type { Combatant, Weapon } from '../engine/types';

/**
 * Filets (Le Zoo Impérial p.29, issue #84) : « Si un gobelin réussit une attaque avec son filet, sa
 * cible gagne un État Empêtré. Pour s'en débarrasser, elle doit effectuer un Test de Force Intermédiaire
 * (+0) et obtenir un nombre de DR égal à l'Indice du filet » — Test NON opposé à SEUIL (`escapeThreshold`),
 * ≠ l'Immobilisante générique (LDB 62 l.258, Test OPPOSÉ contre la Force de l'attaquant). Filet lesté (Aux
 * Armes p.95) : même Atout Immobilisante, mais « le filet a une Force de 55 » FIGÉE (≠ Force du porteur).
 */

const foe = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x: 0, y: 0 }, wounds: { current: 10, max: 10 }, advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: {} as never, conditions: [], traits: [], talents: [], skills: [], weapons: [] as Weapon[], ...over }) as unknown as Combatant;

function mountBattle(combatants: Combatant[]) {
  seedBattleRng(1);
  useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never,
    scene: { ...emptyScene(10, 10), id: 's', label: 's' },
    party: [], facing: {}, pendingShipBattery: null });
  return () => useGame.getState();
}

const empetreOf = (c: Combatant) => c.conditions.find((x) => x.id === 'empetre');

describe('Filet (Zoo Impérial p.29) — Empêtrement à la touche + libération à SEUIL', () => {
  it('l’arme JOUABLE du gobelin de la nuit (trait facultatif "a-distance" arg:filet) porte la qualité "filet", +0 (6)', () => {
    const w = weaponFromTrait({ id: 'a-distance', value: 0, arg: 'filet', range: 6 });
    expect(w).not.toBeNull();
    expect(w!.type).toBe('ranged');
    expect(w!.range).toBe(6);
    expect(w!.damage).toEqual({ plusBF: false, flat: 0 });
    expect(w!.qualities.map((q) => q.id)).toEqual(['filet']);
  });

  it('à la touche : la cible gagne Empêtré avec escapeThreshold = 3 (Indice du filet), PAS escapeStrength', () => {
    const atk = foe('gobelin');
    const tgt = foe('cible');
    const get = mountBattle([atk, tgt]);
    const w = weaponFromTrait({ id: 'a-distance', value: 0, arg: 'filet', range: 6 })!;
    fireTriggers(get, atk, 'onHit', { victim: tgt, weapon: w, woundsDealt: 0, margin: 2, rng: battleRng() } as never);
    const cond = empetreOf(tgt);
    expect(cond?.escapeThreshold).toBe(3);
    expect(cond?.escapeStrength).toBeUndefined();
  });

  it('résolution : Test NON opposé, DR ≥ 3 exigé (≠ opposé contre une Force)', () => {
    const c = foe('cible', { conditions: [{ id: 'empetre', value: 1, escapeThreshold: 3, sourceId: 'gobelin' }] });
    const r = resolveRecoverTest(c, 'empetre')!;
    expect(r.opposition).toBeUndefined();
    expect(r.requireSl).toBe(3);
  });

  it('unlessCondition : un 2ᵉ coup de filet sur une cible DÉJÀ Empêtrée ne pose pas de 2ᵉ escapeThreshold (RAW : DR non cumulatifs, la libération par Action gère l’aggravation)', () => {
    const atk = foe('gobelin');
    const tgt = foe('cible', { conditions: [{ id: 'empetre', value: 1, escapeThreshold: 3 }] });
    const get = mountBattle([atk, tgt]);
    const w = weaponFromTrait({ id: 'a-distance', value: 0, arg: 'filet', range: 6 })!;
    fireTriggers(get, atk, 'onHit', { victim: tgt, weapon: w, woundsDealt: 0, margin: 1, rng: battleRng() } as never);
    expect(empetreOf(tgt)?.value).toBe(1); // inchangé (unlessCondition)
  });

  it('« si la cible ne parvient pas à se dépêtrer, elle gagne un État Empêtré supplémentaire » (ZI 2 l.176) : la qualité pose entangleOnFail', () => {
    const atk = foe('gobelin');
    const tgt = foe('cible');
    const get = mountBattle([atk, tgt]);
    const w = weaponFromTrait({ id: 'a-distance', value: 0, arg: 'filet', range: 6 })!;
    fireTriggers(get, atk, 'onHit', { victim: tgt, weapon: w, woundsDealt: 0, margin: 1, rng: battleRng() } as never);
    expect(empetreOf(tgt)?.entangleOnFail).toBe(true);
  });
});

describe('Filets BARBELÉS (Zoo Impérial p.29) — Dégâts ignorant l’armure à chaque tentative', () => {
  it('la qualité "filet-barbele" existe, hérite escapeThreshold+entangleOnFail du filet ET porte struggleDamage', () => {
    const q = findQualityById('filet-barbele');
    expect(q).toBeTruthy();
    const op = (q!.effects![0].flow as { steps: { effect: { ops: Record<string, unknown>[] } }[] }).steps[0].effect.ops[0];
    expect(op).toMatchObject({ op: 'condition', id: 'empetre', escapeThreshold: 3, entangleOnFail: true, struggleDamage: 1 });
  });

  it('à la touche : la cible gagne Empêtré avec struggleDamage FIGÉ (aucune valeur en dur au moteur — DONNÉE)', () => {
    const atk = foe('gobelin-barbele');
    const tgt = foe('cible');
    const get = mountBattle([atk, tgt]);
    const w: Weapon = { label: 'Filet barbelé', type: 'ranged', damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'filet-barbele' }] };
    fireTriggers(get, atk, 'onHit', { victim: tgt, weapon: w, woundsDealt: 0, margin: 1, rng: battleRng() } as never);
    expect(empetreOf(tgt)?.struggleDamage).toBe(1);
  });
});

describe('Filet lesté (Aux Armes p.95) — Immobilisante à Force FIGÉE (55), ≠ Force du porteur', () => {
  it('la donnée porte "immobilisante-fixe" (pas la "immobilisante" générique) — évite le double-calcul', () => {
    const t = findTrappingById('filet-leste')!;
    expect(t.qualities.map((q) => q.id)).toContain('immobilisante-fixe');
    expect(t.qualities.map((q) => q.id)).not.toContain('immobilisante');
  });

  it('à la touche : escapeStrength = 55 FIGÉ, indépendant de la Force de l’attaquant (ici F=90)', () => {
    const atk = foe('duelliste', { characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 90, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } });
    const tgt = foe('cible');
    const get = mountBattle([atk, tgt]);
    const w: Weapon = { label: 'Filet lesté', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [{ id: 'immobilisante-fixe' }] };
    fireTriggers(get, atk, 'onHit', { victim: tgt, weapon: w, woundsDealt: 0, margin: 1, rng: battleRng() } as never);
    const cond = empetreOf(tgt);
    expect(cond?.escapeStrength).toBe(55); // PAS 90 (Force de l’attaquant)
    expect(cond?.escapeThreshold).toBeUndefined();
  });
});

describe('Déroutante (ADE II 4, atout d\'arme magique) — État Surpris à la touche', () => {
  it('à la touche : la cible gagne l\'État Surpris', () => {
    const atk = foe('porteur');
    const tgt = foe('cible');
    const get = mountBattle([atk, tgt]);
    const w: Weapon = { label: 'Lame déroutante', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [{ id: 'deroutante' }] };
    fireTriggers(get, atk, 'onHit', { victim: tgt, weapon: w, woundsDealt: 0, margin: 1, rng: battleRng() } as never);
    const live = get().battle!.combatants.find((c) => c.id === tgt.id)!;
    expect(live.conditions.some((x) => x.id === 'surpris')).toBe(true);
  });
});

describe('Non-régression — Immobilisante GÉNÉRIQUE (LDB 62 l.258, fouet/lasso) et Constricteur (trait)', () => {
  it('Immobilisante générique : escapeStrength = Force DU PORTEUR (charOf F), pas figée', () => {
    const atk = foe('archer', { characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 47, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } });
    const tgt = foe('cible');
    const get = mountBattle([atk, tgt]);
    const fouet = findTrappingById('fouet')!;
    expect(fouet.qualities.map((q) => q.id)).toEqual(['immobilisante']);
    const w: Weapon = { label: 'Fouet', type: 'ranged', damage: { plusBF: true, flat: 2 }, qualities: [{ id: 'immobilisante' }] };
    fireTriggers(get, atk, 'onHit', { victim: tgt, weapon: w, woundsDealt: 0, margin: 1, rng: battleRng() } as never);
    expect(empetreOf(tgt)?.escapeStrength).toBe(47);
    expect(empetreOf(tgt)?.escapeThreshold).toBeUndefined();
    expect(empetreOf(tgt)?.entangleOnFail).toBeUndefined(); // la LDB générique n'aggrave pas sur échec
    expect(empetreOf(tgt)?.struggleDamage).toBeUndefined();
  });

  it('Test opposé de Force (recover) reste inchangé pour l’Immobilisante générique', () => {
    const c = foe('cible', { conditions: [{ id: 'empetre', value: 1, escapeStrength: 47 }] });
    const r = resolveRecoverTest(c, 'empetre')!;
    expect(r.opposition).toBeDefined();
    expect(r.opposition?.value).toBe(47);
    expect(r.requireSl).toBeUndefined();
    expect(r.entangleOnFail).toBeUndefined();
    expect(r.struggleDamage).toBeUndefined();
  });
});
