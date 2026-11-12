import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import { previewAttack, resolveGrappleWin } from './combatFlow';
import { maneuverDefensePending } from './combatManeuvers';
import { tavernParams } from './tavernFlow';
import { sequenceDrBonus } from './sequenceCore';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import type { Scene } from './monde/scene';
import { itemFromTrappingById, porteeDeTir, recomputeLoadout } from '../engine/items';
import { freeAttackWeapon, resolveMelee } from '../engine/combat';
import { creatureAttacks } from '../engine/creatureAttacks';
import { weaponsFromTraits } from '../engine/creatureEquip';
import { effectiveMaxWounds, forceDuPorteur } from '../engine/characteristics';
import { formulaExpectation } from '../engine/ops';
import { indiceSurLeProfil, valeurSansTirage } from '../engine/formule';
import { findTavernGameById } from '../engine/tavernGame';
import { findSpellById } from '../data';
import { weaponStatParts } from '../engine/weaponStats';
import { deFixe } from '../engine/dice.testkit';
import { blessuresDeBase, combattantDeTest } from '../engine/combattantDeTest.testkit';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { garanti } from '../lib/garanti';

// LDB 21 l.33
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 10, h: 10 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(100).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const armeDe = (c: Combatant, id: string): Weapon => {
  const it: ItemInstance = { ...garanti(itemFromTrappingById(id, idsDeTest), id, 'trapping'), uid: id, equipped: true };
  c.items = [it];
  recomputeLoadout(c);
  return garanti(c.weapons.find((w) => w.uid === id), id, 'arme dérivée');
};

const heros = (frenetique: boolean, armeId: string): { c: Combatant; w: Weapon } => {
  const c = combattantDeTest({ id: 'h', pos: { x: 0, y: 0 }, characteristics: { force: 40 }, ...(frenetique ? { psychState: [{ type: 'frenesie' }] } : {}) });
  return { c, w: armeDe(c, armeId) };
};

describe('Bonus de Force en Frénésie (LDB 21 l.33)', () => {
  it('aperçu d’attaque : Arme simple (+BF+4), Force 40 → 9 en Frénésie, 8 sinon', () => {
    const cible = combattantDeTest({ id: 't', pos: { x: 1, y: 0 } });
    const dmg = (fr: boolean): number => {
      const { c, w } = heros(fr, 'arme-simple');
      const get = (() => ({ scene: scene(), battle: { combatants: [c, cible], movementUsed: 0 }, facing: {}, gameTime: 0, ecrireAuJournal: () => {} })) as unknown as () => Jeu;
      return previewAttack(get, c, cible, 'corps', { weapon: w }).dmg;
    };
    expect(dmg(true)).toBe(9);
    expect(dmg(false)).toBe(8);
  });

  it('dégâts appliqués : +1 Blessure en Frénésie au même jet', () => {
    const coup = (fr: boolean) => {
      const { c, w } = heros(fr, 'arme-simple');
      return resolveMelee(c, combattantDeTest({ id: 't', pos: { x: 1, y: 0 } }), w, deFixe(12), { defense: 'aucune' });
    };
    const fr = coup(true), no = coup(false);
    expect(fr.hit && no.hit).toBe(true);
    expect((fr.damage ?? 0) - (no.damage ?? 0)).toBe(1);
  });

  it('portée d’une arme de jet BF×2 (Couteau de lancer), Force 40 → 10 m en Frénésie, 8 m sinon', () => {
    const r = (fr: boolean): number | null => { const { c, w } = heros(fr, 'couteau-de-lancer'); return porteeDeTir(c, w); };
    expect(r(true)).toBe(10);
    expect(r(false)).toBe(8);
  });
});

const frenesie = (fr: boolean) => (fr ? { psychState: [{ type: 'frenesie' as const }] } : {});
const combattant = (fr: boolean, over: Parameters<typeof combattantDeTest>[0] = {}): Combatant =>
  combattantDeTest({ id: 'f', pos: { x: 0, y: 0 }, characteristics: { force: 40 }, ...frenesie(fr), ...over });

describe('Tout lecteur du Bonus de Force passe par bonusDe (LDB 21 l.33)', () => {
  it('lutte gagnée, option Dégâts : +1 Blessure en Frénésie', () => {
    const perte = (fr: boolean): number => {
      const foe = combattantDeTest({ id: 't', pos: { x: 1, y: 0 }, characteristics: { endurance: 10 } });
      foe.wounds = blessuresDeBase(30, 30, foe);
      resolveGrappleWin(combattant(fr), foe, 'degats', 0, 50, idsDeTest);
      return 30 - foe.wounds.current;
    };
    expect(perte(true) - perte(false)).toBe(1);
  });

  it('Parole de Tzeentch : portée (Bonus de Force) m, Force 40 → 5 m en Frénésie, 4 m sinon', () => {
    const range = garanti(findSpellById('parole-de-tzeentch'), 'parole-de-tzeentch', 'sort').range;
    if (range?.kind !== 'distance') throw new Error('portée chiffrée attendue');
    expect(valeurSansTirage(range.value, combattant(true))).toBe(5);
    expect(valeurSansTirage(range.value, combattant(false))).toBe(4);
  });

  it('espérance IA : {bonusOf: force} → 5 en Frénésie, 4 sinon', () => {
    expect(formulaExpectation({ bonusOf: 'force' }, combattant(true))).toBe(5);
    expect(formulaExpectation({ bonusOf: 'force' }, combattant(false))).toBe(4);
  });

  it('bras de fer : Bonus de Force au DR, 5 en Frénésie, 4 sinon', () => {
    const params = tavernParams(garanti(findTavernGameById('bras-de-fer'), 'bras-de-fer', 'jeu de taverne'));
    expect(sequenceDrBonus(params, combattant(true))).toBe(5);
    expect(sequenceDrBonus(params, combattant(false))).toBe(4);
  });

  it('Blessures max d’un combattant : +1 en Frénésie (BF + 2×BE + BFM)', () => {
    const profil = { force: 40, endurance: 30, 'force-mentale': 30 };
    expect(effectiveMaxWounds(combattant(true, { characteristics: profil }))).toBe(14);
    expect(effectiveMaxWounds(combattant(false, { characteristics: profil }))).toBe(13);
  });

  it('profil nu et Indice figé : bonus sans la part passive', () => {
    expect(valeurSansTirage({ bonusOf: 'force' }, () => 40)).toBe(4);
    expect(indiceSurLeProfil(combattant(true))({ bonusOf: 'force' })).toBe(4);
  });

  it('Souffle : rayon (Bonus de Force de la cible au centre) — 5 m (3 cases) en Frénésie, 4 m (2 cases) sinon', () => {
    const surface = (fr: boolean): boolean => {
      const souffle = [{ id: 'souffle', value: 14, arg: 'feu' }];
      const E = combattantDeTest({ id: 'e', kind: 'ennemi', pos: { x: 0, y: 0 }, traits: souffle, characteristics: { endurance: 40 } });
      const centre = combattantDeTest({ id: 'c', kind: 'heros', pos: { x: 6, y: 0 }, characteristics: { force: 40 }, conditions: [{ id: 'surpris', value: 1 }], ...frenesie(fr) });
      const loin = combattantDeTest({ id: 'l', kind: 'heros', pos: { x: 9, y: 0 } });
      const attaque = garanti(creatureAttacks(souffle).find((a) => a.kind === 'souffle'), 'souffle', 'attaque');
      banc.setState({ battle: { ...garanti(banc.getState().battle ?? { combatants: [] }, 'battle', 'banc'), combatants: [E, centre, loin] } as never,
        pendingManeuver: { attackerId: E.id, attaque: attaque.cle, targetId: centre.id, result: { success: true, sl: 2, roll: 10 } } as never });
      return maneuverDefensePending(banc.getState());
    };
    expect(surface(true)).toBe(true);
    expect(surface(false)).toBe(false);
  });
});

describe('Arme naturelle dont l’Indice inclut le BF : la part passive s’y ajoute (LDB 85 l.35, l.237 ; LDB 21 l.33)', () => {
  const traits = [{ id: 'arme', value: 8 }, { id: 'morsure', value: 7 }, { id: 'langue-prehensile', value: 6, range: 10 }];
  const creature = (fr: boolean): { c: Combatant; arme: Weapon } => {
    const c = combattant(fr, { kind: 'ennemi', traits });
    c.weapons = weaponsFromTraits(traits);
    return { c, arme: garanti(c.weapons.find((w) => w.label === 'Arme'), 'Arme', 'arme du trait') };
  };
  const gratuite = (kind: string): Weapon => freeAttackWeapon(garanti(creatureAttacks(traits).find((a) => a.kind === kind), kind, 'attaque'));
  const cible = (): Combatant => combattantDeTest({ id: 't', pos: { x: 1, y: 0 } });

  it('Arme +8 : aperçu 9 en Frénésie, 8 sinon ; fiche idem', () => {
    const apercu = (fr: boolean): number => {
      const { c, arme } = creature(fr);
      const t = cible();
      const get = (() => ({ scene: scene(), battle: { combatants: [c, t], movementUsed: 0 }, facing: {}, gameTime: 0, ecrireAuJournal: () => {} })) as unknown as () => Jeu;
      return previewAttack(get, c, t, 'corps', { weapon: arme }).dmg;
    };
    expect(apercu(true)).toBe(9);
    expect(apercu(false)).toBe(8);
    const fiche = (fr: boolean): string => { const { c, arme } = creature(fr); return weaponStatParts(arme, forceDuPorteur(c))[0]; };
    expect(fiche(true)).toBe('Dégâts +8 (9)');
    expect(fiche(false)).toBe('Dégâts +8 (8)');
  });

  it('Arme +8 et Morsure +7 : +1 Blessure appliquée en Frénésie au même jet', () => {
    for (const arme of [(fr: boolean) => creature(fr).arme, () => gratuite('morsure')]) {
      const coup = (fr: boolean) => resolveMelee(creature(fr).c, cible(), arme(fr), deFixe(12), { defense: 'aucune' });
      const fr = coup(true), no = coup(false);
      expect(fr.hit && no.hit).toBe(true);
      expect((fr.damage ?? 0) - (no.damage ?? 0)).toBe(1);
    }
  });

  it('Langue préhensile +6 : l’Indice n’inclut pas le BF, aucun +1 (LDB 85 l.213)', () => {
    const langue = gratuite('langue');
    expect(weaponStatParts(langue, forceDuPorteur(creature(true).c))[0]).toBe('Dégâts +6 (6)');
  });
});
