import { describe, it, expect } from 'vitest';
import { attackEnv } from '../noyau/combatFlow';
import type { Get } from '../noyau/flowTypes';
import type { Combatant, Weapon, ShipPoste } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { classeDeCouvertSchema } from '../data/schemas/grammaire/valeurs';

/**
 * #248 — COUVERT DE PONT au calcul de touche. Un défenseur SERVANT un poste couvert (MSRC f.66 l.111,
 * Plat-bord = « couverture moyenne » → tir Difficile −20 ; Sabord/Murs blindés = totale −30) reçoit sa
 * classe par le MÊME chemin que le couvert de terrain (`couvertLePlusProtecteur` sur la ligne
 * `classeDeCouvertSchema`). Le barème est le canon `coverModifier` (`engine/cover.ts`) — aucun modificateur
 * parallèle. Mêlée non affectée.
 */
const bow = { name: 'Arc', type: 'ranged' } as unknown as Weapon;
const sword = { name: 'Épée', type: 'melee' } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', x: number): Combatant =>
  ({ id, name: id, kind, size: 'moyenne', pos: { x, y: 5 }, conditions: [], talents: [], liveTraits: [], skills: [], weapons: [], movement: 4, loaded: true, advantage: 0,
     characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
     wounds: { current: 12, max: 12 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;
const clearScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', weather: 'clair', metresPerTile: 2,
     layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

/** Coque-témoin portant un poste dont `tgt` fait partie de l'équipage (source `crewPosteOf`). Hors LdV
 *  (sans `pos`) → jamais compté comme occupant/bloqueur. `cover` absent = servant à découvert. */
const hullServing = (cover?: 'moyenne' | 'totale'): Combatant =>
  ({ id: 'hull', name: 'coque', kind: 'enemy', conditions: [], wounds: { current: 30, max: 30 },
     postes: [{ crewIds: ['tgt'], cover } as unknown as ShipPoste] }) as unknown as Combatant;

function envFor(weapon: Weapon, hull?: Combatant) {
  const attacker = mk('att', 'enemy', 5); // enemy : pas de « Tir en bougeant » par défaut (bruit héros)
  const target = mk('tgt', 'enemy', 8);
  const combatants = hull ? [attacker, target, hull] : [attacker, target];
  const get = (() => ({ scene: clearScene(), battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 12 * 60 })) as unknown as Get;
  return attackEnv(get, attacker, target, weapon).env;
}
const cover = (env: { label: string; value: number }[]) => env.find((e) => e.value < 0);

describe('#248 — couvert de pont raccordé au calcul de touche', () => {
  it('tir contre servant à poste `totale` → −30 (Sabord/Murs blindés)', () => {
    expect(cover(envFor(bow, hullServing('totale')))!.value).toBe(-30);
  });
  it('tir contre servant à poste `moyenne` → −20 (Plat-bord, « couverture moyenne » = Difficile)', () => {
    expect(cover(envFor(bow, hullServing('moyenne')))!.value).toBe(-20);
  });
  it('tir contre cible SANS couvert (aucun poste) → aucune ligne de couvert', () => {
    expect(envFor(bow)).toEqual([]);
    expect(envFor(bow, hullServing(undefined))).toEqual([]); // servant à découvert (poste sans cover)
  });
  it('MÊLÉE contre servant à poste `totale` → NON affectée (aucune ligne de couvert)', () => {
    expect(cover(envFor(sword, hullServing('totale')))).toBeUndefined();
  });
});

/**
 * #1680 ligne 15 — le couvert d'une STRUCTURE D'ARÊTE arrive au JET par le même chemin (`classeDeCouvertSchema`,
 * barème `coverModifier`). `AA 10 l.23` : la Pénalité de Couvert d'une Structure EST la Difficulté par
 * défaut d'un assaillant qui tire sur qui s'y abrite. Les deux structures ci-dessous sont celles que la
 * Diligence porte réellement : `mur-a-ossature-en-bois` (Complexe −10, 516 arêtes) et
 * `cloture-en-clayonnage` (Intermédiaire +0, 19 arêtes — le canon ne lui accorde aucune protection).
 */
describe('#1680 — le couvert d’une Structure d’arête arrive au calcul de touche', () => {
  /** Tireur en (5,5), cible en (8,8) : approche DIAGONALE dont un seul contournement est muré — le tir
   *  passe par l'extrémité, et l'arête N de la cible l'abrite. */
  const envAvecArete = (structure?: string, window?: boolean) => {
    const attacker = mk('att', 'enemy', 5);
    const target = { ...mk('tgt', 'enemy', 8), pos: { x: 8, y: 8 } } as Combatant;
    const scene = { ...clearScene(), walls: structure ? [{ x: 8, y: 8, side: 'N', structure, ...(window ? { window } : {}) }] : [] } as unknown as Scene;
    const get = (() => ({ scene, battle: { combatants: [attacker, target], movementUsed: 0 }, facing: {}, gameTime: 12 * 60 })) as unknown as Get;
    return attackEnv(get, attacker, target, bow).env;
  };

  it('mur à ossature en bois (Complexe) → ligne « Couverture imparfaite » à −10 au jet', () => {
    const ligne = cover(envAvecArete('mur-a-ossature-en-bois'))!;
    expect(ligne.value).toBe(-10);
    expect(ligne.label).toBe(libelleDeValeur(classeDeCouvertSchema, 'imparfaite'));
  });

  it('clôture en clayonnage (Intermédiaire) → AUCUNE ligne : le canon lui donne +0', () => {
    expect(cover(envAvecArete('cloture-en-clayonnage'))).toBeUndefined();
  });

  it('la même arête FENÊTRÉE perd son cran (AA 10 l.122) → plus aucune ligne de couvert', () => {
    expect(cover(envAvecArete('mur-a-ossature-en-bois', true))).toBeUndefined();
  });

  it('témoin sans arête → aucune ligne de couvert', () => {
    expect(cover(envAvecArete())).toBeUndefined();
  });
});
