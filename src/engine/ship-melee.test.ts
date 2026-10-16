import { describe, it, expect } from 'vitest';
import { meleeVsHullBE, isArtilleryWeapon, hullHitAdjust } from './shipMelee';
import { hullShipSize } from './shipBuild';
import { rederivePassiveAttack, woundsFromHit } from './combat';
import type { Combatant, Weapon } from './types';
import type { SizeCategory } from './size';

/**
 * #25 — COQUE EN COMBAT PERSONNEL (MDG 13 « Infliger des Dégâts aux navires ») :
 *  - Taille du navire dérivée de la longueur (MDG 12 l.123-129) ;
 *  - corps à corps : TABLEAU DE COMPARAISON DES TAILLES (ch.13 l.618-637) — BE ajusté, « – » = aucun Dégât ;
 *  - « les tirs de petites armes […] n'infligent pas assez de Dégâts pour avoir un effet sur un vaisseau » (l.605).
 */
describe('hullShipSize — la Taille de la coque, DÉRIVÉE du véhicule ciblé', () => {
  it('la Taille vient de la longueur du véhicule, par la table en donnée (MDG 12 l.123-129)', () => {
    expect(hullShipSize(hull('coracle'))).toBe('minuscule'); // 3 m
    expect(hullShipSize(hull('cogue'))).toBe('moyenne'); // 25 m
    expect(hullShipSize(hull('galion-bretonnien'))).toBe('enorme'); // 60 m
  });
  it('cible qui n’est pas une coque → undefined (chemin normal intact)', () => {
    expect(hullShipSize(bruiser())).toBeUndefined();
  });
});

describe('meleeVsHullBE — Tableau de comparaison des Tailles (MDG 13 l.618-637)', () => {
  it('exemple VERBATIM (l.614) : halfling (Petite) vs chaloupe (Minuscule) → « le bateau triple son BE »', () => {
    expect(meleeVsHullBE('minuscule', 'petite')).toEqual({ mult: 3 });
  });
  it('exemple VERBATIM (l.614) : le même halfling vs un Grand bateau → « aucun Dégât »', () => {
    expect(meleeVsHullBE('grande', 'petite')).toBeNull();
  });
  it('cases de la table : Moyenne vs Minuscule → 2×BE ; Grande vs Minuscule → BE ; Monstrueuse vs Minuscule → BE−2', () => {
    expect(meleeVsHullBE('minuscule', 'moyenne')).toEqual({ mult: 2 });
    expect(meleeVsHullBE('minuscule', 'grande')).toEqual({ flat: 0 });
    expect(meleeVsHullBE('minuscule', 'enorme')).toEqual({ flat: -1 });
    expect(meleeVsHullBE('minuscule', 'monstrueuse')).toEqual({ flat: -2 });
    expect(meleeVsHullBE('enorme', 'monstrueuse')).toEqual({ mult: 4 });
    expect(meleeVsHullBE('monstrueuse', 'monstrueuse')).toBeNull(); // ligne Monstrueuse : que des « – »
  });
  it('Taille du personnage ≤ Taille du navire → « – » (aucun Dégât)', () => {
    for (const s of ['minuscule', 'tresPetite', 'petite', 'moyenne'] as SizeCategory[]) expect(meleeVsHullBE('moyenne', s)).toBeNull();
  });
});

const hull = (creatureId: string, E = 40): Combatant =>
  ({ id: 'hull', name: 'Coque', kind: 'enemy', bodyShape: 'vehicule', creatureId, pos: { x: 6, y: 5 },
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: E, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: { current: 60, max: 60 }, advantage: 0, conditions: [], weapons: [], skills: [], talents: [],
    armour: { corps: 0 } }) as unknown as Combatant;
const bruiser = (size?: SizeCategory): Combatant =>
  ({ id: 'atk', name: 'Cogneur', kind: 'hero', size,
    characteristics: { 'capacite-de-combat': 60, 'capacite-de-tir': 60, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [], skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
const hache: Weapon = { name: 'Hache', type: 'melee', damage: { flat: 7, plusBF: true }, qualities: [] } as unknown as Weapon;
const arc: Weapon = { name: 'Arc', type: 'ranged', subType: 'arc', damage: { flat: 7, plusBF: false }, range: 50, qualities: [] } as unknown as Weapon;
const canon: Weapon = { name: 'Canon (moyen)', type: 'ranged', subType: 'armes-de-siege', weaponGroup: 'poudre-noire', damage: { flat: 14, plusBF: false }, range: 75, qualities: [] } as unknown as Weapon;

describe('hullHitAdjust — consommé par applyHit (petites armes / table des Tailles)', () => {
  it('cible non-coque → null (chemin normal intact)', () => {
    expect(hullHitAdjust('moyenne', hache, bruiser())).toBeNull();
  });
  it('tir de PETITE ARME sur une coque → bloqué (l.605) ; ARTILLERIE → passe (plancher 0)', () => {
    expect(hullHitAdjust('moyenne', arc, hull('cogue'))).toEqual({ blocked: 'petites-armes' });
    expect(hullHitAdjust('moyenne', canon, hull('cogue'))).toEqual({ extraTB: 0 });
    expect(isArtilleryWeapon(canon)).toBe(true);
    expect(isArtilleryWeapon(arc)).toBe(false);
  });
  it('mêlée : coracle (3 m → Minuscule) frappé par un humain (Moyenne) → 2×BE (extraTB = +BE)', () => {
    expect(hullHitAdjust('moyenne', hache, hull('coracle', 40))).toEqual({ extraTB: 4 }); // BE 4 → 2×BE ⇔ +4
  });
  it('mêlée : cogue (25 m → Moyenne) — humain Moyenne : « – » ; ogre Grande : 4×BE ; Énorme : 3×BE', () => {
    expect(hullHitAdjust('moyenne', hache, hull('cogue', 40))).toEqual({ blocked: 'taille' }); // écart 0 → « – »
    expect(hullHitAdjust('grande', hache, hull('cogue', 40))).toEqual({ extraTB: 12 }); // 4×BE ⇔ +3×BE4
    expect(hullHitAdjust('enorme', hache, hull('cogue', 40))).toEqual({ extraTB: 8 }); // 3×BE
  });
  it('mêlée : coque plus grande que l’attaquant → « – » (aucun Dégât)', () => {
    expect(hullHitAdjust('moyenne', hache, hull('galion-bretonnien'))).toEqual({ blocked: 'taille' }); // 60 m → Énorme
  });
});

describe('applyHit contre une coque (résolution complète)', () => {
  it('tir de petite arme RÉUSSI sur la coque → 0 Blessure, pas de Critique, log explicite (l.605)', () => {
    const h = hull('cogue');
    const res = rederivePassiveAttack(bruiser(), h, arc, { roll: 11, target: 60, success: true, sl: 4, isDouble: true }, 'ranged');
    expect(res.hit).toBe(true);
    expect(res.woundsLost).toBe(0);
    expect(res.critical).toBe(false); // même un double : les petites armes n'ont pas d'effet sur le vaisseau
    expect(res.log).toContain('petites armes');
  });
  it('mêlée d’un humain sur une coque Énorme → touche sans AUCUN Dégât (case « – »)', () => {
    const res = rederivePassiveAttack(bruiser(), hull('galion-bretonnien'), hache, { roll: 21, target: 60, success: true, sl: 3, isDouble: false }, 'melee');
    expect(res.hit).toBe(true);
    expect(res.woundsLost).toBe(0);
    expect(res.log).toContain('trop petit');
  });
  it('mêlée sur un coracle (Minuscule) : BE doublé, plancher 0 (le coup peut ricocher)', () => {
    const h = hull('coracle', 40); // BE 4 → mitigation 8
    const res = rederivePassiveAttack(bruiser(), h, hache, { roll: 21, target: 60, success: true, sl: 3, isDouble: false }, 'melee');
    // Dégâts = 7 + BF4 + DR3 = 14 ; soak = 2×BE(8) + PA 0 → 6 Blessures.
    expect(res.woundsLost).toBe(6);
    const weak = rederivePassiveAttack(bruiser(), h, { ...hache, damage: { flat: 0, plusBF: false } } as Weapon, { roll: 21, target: 60, success: true, sl: 0, isDouble: false }, 'melee');
    expect(weak.woundsLost).toBe(0); // plancher 0 : pas de « min 1 » contre une coque
  });
});

describe('woundsFromHit — plancher 0 navire piloté par l’appelant (paramètre minWounds)', () => {
  it('minWounds 0 → un coup trop faible ricoche ; défaut 1 → plancher personnage (Robuste)', () => {
    const h = hull('cogue', 50);
    expect(woundsFromHit(hache, h, undefined, 2, 0, 0, undefined)).toBe(0);
    expect(woundsFromHit(hache, bruiser(), 'corps', 1, 0, 1, undefined)).toBe(1);
  });
});
