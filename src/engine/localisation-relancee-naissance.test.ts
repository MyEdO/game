import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveMelee, hitLocationByShape } from './combat';
import { setRule, resetRule } from './policy';
import { makeRNG, type RNG } from './dice';
import type { Combatant, Weapon } from './types';

/** La Localisation relancée naît avec la touche (`applyHit`). LDB 18 l.53, l.55 ; AA 07 l.25, l.32 ; #1595 c.6226467544. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

const combattant = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [], traits: [], weapons: [], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, skills: [], talents: [], movement: 4,
    bodyShape: 'humanoide', size: 'moyenne', pos: { x: 0, y: 0 }, ...over,
  }) as unknown as Combatant;

/** Les d100 donnés dans l'ordre, puis le compte des dés tirés. */
function desScriptes(...d100: number[]): RNG & { tires: () => number } {
  let i = 0;
  return {
    int: (min, max) => {
      if (min !== 1 || max !== 100 || i >= d100.length) throw new Error(`dé inattendu ${min}-${max} au tirage ${i + 1}`);
      return d100[i++];
    },
    tires: () => i,
  };
}

const frappe = (rng: RNG, cible: Partial<Combatant> = {}) =>
  resolveMelee(combattant('a'), combattant('d', cible), epee, rng, { defense: 'none' });

describe('T2 — en `aa`, la Localisation relancée est posée dès la sortie de `resolveMelee`', () => {
  beforeEach(() => setRule('combat-aa-blessures', 'aa'));
  afterEach(() => resetRule('combat-aa-blessures'));

  it('Coup Critique sur un double : `critLocation` est le d100 tiré après le jet', () => {
    const des = desScriptes(22, 5);
    const res = frappe(des);
    expect(res.critical, 'le double réussi fait le Coup Critique').toBe(true);
    expect(res.critLocation).toBe(hitLocationByShape(5, 'humanoide'));
    expect(res.location, 'la Localisation de touche reste l’inversion').toBe(hitLocationByShape(22, 'humanoide'));
    expect(des.tires()).toBe(2);
  });

  it('cible au-dessus de 0 sans double : aucune relance, aucun dé de plus', () => {
    const des = desScriptes(23);
    const res = frappe(des);
    expect(res.hit).toBe(true);
    expect(res.critLocation).toBeUndefined();
    expect(des.tires()).toBe(1);
  });

  it('Coup Critique sans prise (Éthéré) : aucune relance, aucun dé de plus', () => {
    const des = desScriptes(22);
    const res = frappe(des, { traits: [{ id: 'ethere' }] } as never);
    expect(res.sansPrise).toBe('ethere');
    expect(res.critLocation).toBeUndefined();
    expect(des.tires()).toBe(1);
  });
});

describe('T7 — le d100 de la Localisation est consommé au JET', () => {
  it('même graine : le jet, puis la Localisation, et rien d’autre', () => {
    let graine = 1;
    for (; graine < 500; graine++) {
      const r = makeRNG(graine);
      const att = r.int(1, 100);
      if (att <= 50 && att % 11 === 0) break;
    }
    const rng = makeRNG(graine);
    const res = resolveMelee(combattant('a'), combattant('d'), epee, rng, { defense: 'none' });
    const temoin = makeRNG(graine);
    temoin.int(1, 100);
    const lieu = hitLocationByShape(temoin.int(1, 100), 'humanoide');
    expect(res.critical, `graine ${graine} : un double réussi`).toBe(true);
    expect(res.critLocation, 'le second dé du jet').toBe(lieu);
    expect(rng.int(1, 1_000_000), 'même graine, deux dés consommés').toBe(temoin.int(1, 1_000_000));
  });
});
