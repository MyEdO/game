import { describe, it, expect } from 'vitest';
import { crewedPenalty, crewedFireWeapon, crewedReloadStep } from './crewedWeapon';
import { attackModifiers } from './combat';
import type { Weapon, Combatant } from './types';

/**
 * ARME D'ÉQUIPE — sous-effectif (MDG 12 l.448-460), GÉNÉRAL (sièges au sol comme naval). Pénalités
 * CUMULATIVES selon le déficit (Indice requis − servants présents) : 1 manquant → temps de recharge DOUBLÉ ;
 * 2 → + Défaut *Imprécise* ; 3 → + Défaut *Dangereuse*. Le doublement de recharge ne se cumule pas (×2, pas ×4).
 */
describe('crewedPenalty — table de sous-effectif d’une Arme d’équipe (MDG 12 l.448-460)', () => {
  it('équipage complet (présents ≥ Indice) → aucune pénalité', () => {
    expect(crewedPenalty(4, 4)).toEqual({ reloadFactor: 1, addFlaws: [] });
    expect(crewedPenalty(5, 3)).toEqual({ reloadFactor: 1, addFlaws: [] });
  });

  it('Arme d’équipe 4 : 3 → recharge ×2 ; 2 → +Imprécise ; 1 → +Dangereuse (cumulatif)', () => {
    expect(crewedPenalty(3, 4)).toEqual({ reloadFactor: 2, addFlaws: [] });
    expect(crewedPenalty(2, 4)).toEqual({ reloadFactor: 2, addFlaws: ['imprecise'] });
    expect(crewedPenalty(1, 4)).toEqual({ reloadFactor: 2, addFlaws: ['imprecise', 'dangereuse'] });
  });

  it('Arme d’équipe 3 : 2 → recharge ×2 ; 1 → +Imprécise', () => {
    expect(crewedPenalty(2, 3)).toEqual({ reloadFactor: 2, addFlaws: [] });
    expect(crewedPenalty(1, 3)).toEqual({ reloadFactor: 2, addFlaws: ['imprecise'] });
  });

  it('Arme d’équipe 2 : 1 servant → recharge ×2 seulement', () => {
    expect(crewedPenalty(1, 2)).toEqual({ reloadFactor: 2, addFlaws: [] });
  });
});

const cannon = (over: Partial<Weapon> = {}): Weapon =>
  ({ label: 'Canon', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 100,
    qualities: [{ id: 'arme-d-equipe', value: 3 }], subType: 'poudre-noire', reload: 3, ...over }) as Weapon;
const hasQ = (w: Weapon, id: string) => w.qualities.some((q) => q.id === id);

describe('crewedFireWeapon — Défauts de sous-effectif BAKÉS sur l’arme tirée (MDG 12 l.448-460)', () => {
  it('équipage complet (présents ≥ Indice) → arme NETTE : Arme d’équipe retirée, aucun Défaut, recharge normale', () => {
    const w = crewedFireWeapon(cannon(), 3); // Indice 3, 3 servants
    expect(hasQ(w, 'arme-d-equipe')).toBe(false); // retirée → dispatch ne re-pénalise pas en « solo »
    expect(hasQ(w, 'imprecise')).toBe(false);
    expect(hasQ(w, 'dangereuse')).toBe(false);
    expect(w.reload).toBe(3);
  });

  it('1 servant manquant → recharge ×2, aucun Défaut', () => {
    const w = crewedFireWeapon(cannon(), 2); // déficit 1
    expect(w.reload).toBe(6);
    expect(hasQ(w, 'imprecise')).toBe(false);
  });

  it('2 manquants → recharge ×2 + Imprécise', () => {
    const w = crewedFireWeapon(cannon(), 1); // déficit 2
    expect(w.reload).toBe(6);
    expect(hasQ(w, 'imprecise')).toBe(true);
    expect(hasQ(w, 'dangereuse')).toBe(false);
  });

  it('Indice 4 manié seul → recharge ×2 + Imprécise + Dangereuse', () => {
    const w = crewedFireWeapon(cannon({ qualities: [{ id: 'arme-d-equipe', value: 4 }] }), 1); // déficit 3
    expect(hasQ(w, 'imprecise')).toBe(true);
    expect(hasQ(w, 'dangereuse')).toBe(true);
  });

  it('un Défaut DÉJÀ porté n’est pas redoublé → −10 plat au tir au lieu de doubler (MDG 12 l.460)', () => {
    const w = crewedFireWeapon(cannon({ qualities: [{ id: 'arme-d-equipe', value: 3 }, { id: 'imprecise' }] }), 1); // déficit 2 → « ajoute » Imprécise, déjà là
    expect(w.qualities.filter((q) => q.id === 'imprecise').length).toBe(1); // pas de doublon (−1 DR ne double pas)
    expect(w.crewedTohitPenalty).toBe(-10); // … mais −10 au Test de tir
  });

  it('deux Défauts déjà portés et redoublés → −20 cumulatif', () => {
    const w = crewedFireWeapon(cannon({ qualities: [{ id: 'arme-d-equipe', value: 4 }, { id: 'imprecise' }, { id: 'dangereuse' }] }), 1); // déficit 3
    expect(w.crewedTohitPenalty).toBe(-20);
  });

  it('Défaut ajouté NON déjà porté → aucune pénalité −10', () => {
    expect(crewedFireWeapon(cannon(), 1).crewedTohitPenalty).toBeUndefined(); // Imprécise ajoutée pour de bon
  });

  it('arme NON Arme d’équipe → inchangée', () => {
    const arc = cannon({ qualities: [], reload: 0 });
    expect(crewedFireWeapon(arc, 1)).toEqual(arc);
  });
});

describe('crewedReloadStep — Test étendu de recharge, cumul de DR vers Recharge N (LDB 62 l.333)', () => {
  // En usage réel, l'arme passée est celle EFFECTIVEMENT servie (post-`crewedFireWeapon` : qualité
  // `arme-d-equipe` retirée, recharge ×2 bakée si sous-effectif) — comme pour le tir.
  it('cumule le DR du Test vers la cible Recharge N (canon Recharge 6, équipage complet)', () => {
    const w = crewedFireWeapon(cannon({ reload: 6, qualities: [{ id: 'arme-d-equipe', value: 3 }] }), 3); // complet → reload 6
    expect(crewedReloadStep(w, 0, 2)).toEqual({ progress: 2, target: 6, done: false });
    expect(crewedReloadStep(w, 4, 2)).toEqual({ progress: 6, target: 6, done: true }); // 4 + 2 = 6 → rechargée
  });

  it('sous-effectif → cible DOUBLÉE (Recharge ×2), donc plus longue à recharger', () => {
    const w = crewedFireWeapon(cannon({ reload: 3, qualities: [{ id: 'arme-d-equipe', value: 3 }] }), 2); // déficit 1 → reload 6
    expect(crewedReloadStep(w, 0, 3).target).toBe(6); // recharge ×2 bakée
  });

  it('plancher 0 : un Test raté (DR négatif) ne fait pas reculer le progrès', () => {
    const w = cannon({ reload: 4, qualities: [{ id: 'arme-d-equipe', value: 2 }] });
    expect(crewedReloadStep(w, 1, -3).progress).toBe(0);
  });

  it('arme sans Recharge → cible 0, rechargée d’emblée', () => {
    expect(crewedReloadStep(cannon({ reload: 0, qualities: [] }), 0, 0)).toEqual({ progress: 0, target: 0, done: true });
  });
});

describe('attackModifiers — le −10 du Défaut redoublé apparaît sur le Test de tir (MDG 12 l.460)', () => {
  const shooter = (): Combatant =>
    ({ id: 's', name: 'S', kind: 'hero', advantage: 0, conditions: [], skills: [], size: 3, weapons: [] }) as unknown as Combatant;
  const mark = (): Combatant => ({ id: 't', name: 'T', kind: 'enemy', advantage: 0, conditions: [], size: 3 }) as unknown as Combatant;

  it('un canon Imprécise manié seul → ligne « Sous-effectif » à −10 dans les modificateurs de touche', () => {
    const w = crewedFireWeapon(cannon({ qualities: [{ id: 'arme-d-equipe', value: 3 }, { id: 'imprecise' }] }), 1);
    const line = attackModifiers(shooter(), mark(), w, { kind: 'ranged' }).find((m) => m.label.includes('Sous-effectif'));
    expect(line?.value).toBe(-10);
  });

  it('équipage complet → aucune ligne « Sous-effectif »', () => {
    const w = crewedFireWeapon(cannon({ qualities: [{ id: 'arme-d-equipe', value: 3 }, { id: 'imprecise' }] }), 3);
    expect(attackModifiers(shooter(), mark(), w, { kind: 'ranged' }).some((m) => m.label.includes('Sous-effectif'))).toBe(false);
  });
});
