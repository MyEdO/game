import { describe, it, expect } from 'vitest';
import { attackEnv } from '../noyau/combatFlow';
import type { Get } from '../noyau/flowTypes';
import { attackModifiers, combineMods } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';
import { ligneDe } from '../engine/modLine.testkit';
import { refDeRegle } from '../engine/reglesChiffrees';
import { RULE_REF } from '../engine/ruleRefs';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * Cible dissimulée par le brouillard / la brume / l'obscurité : la rangée vit dans le bloc −20 de la
 * table des Difficultés de Combat — `LDB 14 l.75`, marqueur de bloc `l.73`, libellé « Difficile » `l.76`
 * (échelle des noms : `LDB 12 l.149-151`). La prose `LDB 14 l.95` le chiffre : brouillard + Localisation
 * précise vaudraient « une pénalité de -40 » avant plafond, soit −20 chacun.
 */
const bow = { name: 'Arc', type: 'ranged' } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', x: number): Combatant =>
  (blessuresSurLeProfil({ id, name: id, kind, size: 'moyenne', pos: { x, y: 5 }, conditions: [], talents: [], liveTraits: [], skills: [], weapons: [], movement: 4, loaded: true, advantage: 0,
     characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
     wounds: blessuresDeBase(12), armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } })) as unknown as Combatant;
const fogScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', weather: 'brouillard', metresPerTile: 2,
     layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

describe('attackEnv (tir) — cible dissimulée par le brouillard = −20 (Difficile, LDB 14 l.75)', () => {
  it('brouillard, tireur sans vision nocturne → −20', () => {
    const attacker = mk('att', 'hero', 5);
    const target = mk('tgt', 'enemy', 8);
    const get = (() => ({ scene: fogScene(), battle: { combatants: [attacker, target], movementUsed: 0 }, facing: {}, gameTime: 12 * 60 })) as unknown as Get;
    const env = attackEnv(get, attacker, target, bow).env;
    const conceal = ligneDe(env, RULE_REF['cible-dissimulee']);
    expect(conceal).toBeTruthy();
    expect(conceal!.value).toBe(-20);
  });
});

describe('Exemple RAW LDB 14 l.95 — « le Test devient simplement Très Difficile (-30) au lieu de recevoir une pénalité de -40 »', () => {
  it('brouillard PRODUIT par la scène + Localisation visée : somme brute −40, plafonnée à −30', () => {
    const attacker = mk('att', 'hero', 5);
    const target = mk('tgt', 'enemy', 8);
    const get = (() => ({ scene: fogScene(), battle: { combatants: [attacker, target], movementUsed: 0 }, facing: {}, gameTime: 12 * 60 })) as unknown as Get;
    // `heldGround` : le tireur déclare tirer IMMOBILE — isole les deux facteurs de l'exemple du livre
    // (sans quoi la production ajoute aussi « Tir en bougeant » −10, LDB 14 l.70).
    const env = attackEnv(get, attacker, target, bow, { heldGround: true }).env; // production RÉELLE, aucune valeur en dur
    const mods = attackModifiers(attacker, target, bow, { kind: 'ranged', location: 'tete', env });
    expect(ligneDe(env, RULE_REF['cible-dissimulee'])?.value).toBe(-20);
    expect(ligneDe(mods, refDeRegle('viser-une-localisation'))?.value).toBe(-20);
    expect(mods.filter((m) => m.value < 0).reduce((s, m) => s + m.value, 0)).toBe(-40); // somme BRUTE
    expect(combineMods(mods)).toBe(-30); // le plafond mord réellement
  });
});

describe('Obscurité (LDB 14 l.75) et météo (l.76, l.82) : sommées sous le plafond Très Difficile −30 (LDB 14 l.95)', () => {
  const nightScene = (weather: 'tempete' | 'neige'): Scene => ({ ...fogScene(), ambiance: 'exterieur', weather }) as unknown as Scene;
  const lignes = (weather: 'tempete' | 'neige') => {
    const attacker = mk('att', 'hero', 5);
    const target = mk('tgt', 'enemy', 8);
    const get = (() => ({ scene: nightScene(weather), battle: { combatants: [attacker, target], movementUsed: 0 }, facing: {}, gameTime: 23 * 60 })) as unknown as Get;
    const env = attackEnv(get, attacker, target, bow, { heldGround: true }).env;
    return { env, total: combineMods(attackModifiers(attacker, target, bow, { kind: 'ranged', env })) };
  };
  it('nuit + tempête : deux lignes (−20, −20), plafonnées à −30', () => {
    const { env, total } = lignes('tempete');
    expect(env.filter((m) => m.value < 0).map((m) => [m.ref, m.value])).toEqual([[RULE_REF['cible-dissimulee'], -20], [refDeRegle('climat-extreme'), -20]]);
    expect(total).toBe(-30);
  });
  it('nuit + neige : deux lignes (−20, −30), plafonnées à −30', () => {
    const { env, total } = lignes('neige');
    expect(env.filter((m) => m.value < 0).map((m) => [m.ref, m.value])).toEqual([[RULE_REF['cible-dissimulee'], -20], [refDeRegle('neige-eau-terrain-difficile'), -30]]);
    expect(total).toBe(-30);
  });
});
