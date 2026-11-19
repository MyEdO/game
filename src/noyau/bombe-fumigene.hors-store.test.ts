import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as donnees from '../data';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { applyAttackResult, notifySlain } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './monde/scene';
import { smokeOf } from './monde/combatGeometry';
import { losClear } from './monde/lineOfSight';
import { bus, EVT, type ChargeDeZone } from './bus';
import { resolveRanged, type AttackResult } from '../engine/combat';
import { itemFromTrappingById, weaponFromItem, weaponWithAmmo, damageString } from '../engine/items';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { armeDePosteDeTest } from '../engine/objetsDeTest.testkit';
import { deMin } from '../engine/dice.testkit';
import type { Combatant, Weapon } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { draineCascade, type PoseDe } from './cascade.testkit';

/**
 * Bombe fumigène (#4202) : lancée par le chemin d'attaque à distance ordinaire, Dégâts « – » ;
 * le nuage (rayon 2 m, 1d10 Rounds, masque la vue) naît du jet — sur la victime touchée, au point d'arrivée de la
 * Dispersion sur un raté (LDB 14 l.142). La Bombe (LDB 62 l.79) reste inchangée. Dégâts « – » : Lasso (LDB 62 l.76),
 * Mortier (AA 10 l.192) ; Boulet des fanatiques : +10 (ZI 02 l.171).
 */

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); seedBattleRng(20261115); });

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ARMURE = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

const arme = (id: string): Weapon => weaponFromItem(itemFromTrappingById(id, idsDeTest)!);

const lanceur = (w: Weapon): Combatant => (blessuresSurLeProfil({
  id: 'h1', name: 'Lanceur', kind: 'heros', characteristics: CHARS, wounds: blessuresDeBase(15), advantage: 0, conditions: [],
  movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 2, y: 7 }, size: 'moyenne', weapons: [w], items: [], fate: 0, armour: ARMURE,
}) as unknown as Combatant);

const cible = (): Combatant => (blessuresSurLeProfil({
  id: 'e1', name: 'Cible', kind: 'ennemi', characteristics: CHARS, wounds: blessuresDeBase(20), advantage: 0, conditions: [],
  movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 8, y: 7 }, size: 'moyenne', weapons: [], items: [], armour: ARMURE,
}) as unknown as Combatant);

function poserLaBataille(cs: Combatant[]): void {
  const battle = {
    combatants: cs, order: cs.map((c) => c.id), baseOrder: cs.map((c) => c.id), turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: { ...emptyScene('scene-test'), metresPerTile: 1 }, gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null });
}

const bataille = () => banc.getState().battle!;
const acteurs = () => [bataille().combatants[0], bataille().combatants[1]] as const;

/** Le dé de durée de la zone, posé à la porte comme le geste « Dés fixés » d'un joueur (#1508). */
const DUREE_POSEE = 4;
const poseLaDuree: PoseDe = (etape) => (etape.kind === 'operationsDe' ? DUREE_POSEE : undefined);

/** Lance `w` sur la cible : touche par le Test de Projectiles résolu (`resolveRanged`, dé à 01), ou raté ; la séquence
 *  ouverte (dé de durée) se joue jusqu'au bout. */
function lancer(w: Weapon, touche: boolean): { zones: ChargeDeZone[]; avant: number } {
  poserLaBataille([lanceur(w), cible()]);
  const [h, e] = acteurs();
  const avant = e.wounds.current;
  const res: AttackResult = touche
    ? resolveRanged(h, e, w, deMin, 6, undefined, [], undefined, 1)
    : { hit: false, attackerRoll: 88, netSL: -3, critical: false, advantageTo: null, defenderDefeated: false, log: 'manque sa cible.' };
  if (touche) expect(res.hit).toBe(true);
  const zones: ChargeDeZone[] = [];
  const off = bus.on(EVT.ANIM_AOE, (d) => { zones.push(d); });
  try {
    applyAttackResult(banc.getState, banc.setState, h, e, w, res);
    draineCascade(banc.getState, 20, poseLaDuree);
  } finally { off(); }
  return { zones, avant };
}

describe('Bombe fumigène — le nuage naît du jet (#4202)', () => {
  it('touche : nuage de 2 m centré sur la victime, masquant, 1d10 Rounds tirés à la porte, rendu recopié et émis ; aucun PB perdu', () => {
    const w = arme('bombe-fumigene');
    expect(damageString(w.damage)).toBe('–');
    const { zones, avant } = lancer(w, true);
    const [, e] = acteurs();
    expect(e.wounds.current).toBe(avant);
    const zs = bataille().zones ?? [];
    expect(zs).toHaveLength(1);
    const z = zs[0];
    expect(z.blocksLoS).toBe(true);
    expect(z.rendu).toEqual({ id: 'souffle-de-fumee' });
    expect(z.rounds).toBe(DUREE_POSEE);
    expect(z.tiles).toContainEqual({ x: 8, y: 7 });
    expect(z.tiles).toContainEqual({ x: 6, y: 7 });
    expect(z.tiles).not.toContainEqual({ x: 5, y: 7 });
    expect(zones).toEqual([expect.objectContaining({ de: 'h1', centre: { x: 8, y: 7 }, rendu: 'souffle-de-fumee' })]);
    // Un tir qui traverse le nuage n'a plus de Ligne de Vue.
    expect(losClear(banc.getState().scene!, { x: 2, y: 7 }, { x: 12, y: 7 }, smokeOf(bataille()))).toBe(false);
  });

  it('raté : le nuage se pose au point d’arrivée de la Dispersion', () => {
    const { zones } = lancer(arme('bombe-fumigene'), false);
    const zs = bataille().zones ?? [];
    expect(zs).toHaveLength(1);
    expect(zones).toHaveLength(1);
    const centre = zones[0].centre;
    expect(centre).not.toEqual({ x: 8, y: 7 });
    expect(zs[0].tiles).toContainEqual({ x: centre.x, y: centre.y });
    expect(zs[0].rounds).toBe(DUREE_POSEE);
  });
});

describe('Bombe (LDB 62 l.79) — inchangée', () => {
  it('raté : rien ne se pose', () => {
    lancer(arme('bombe'), false);
    expect(bataille().zones ?? []).toHaveLength(0);
  });

  it('touche : Dégâts +12 et Explosion, la victime perd des PB', () => {
    const w = arme('bombe');
    expect(damageString(w.damage)).toBe('+12');
    const { avant } = lancer(w, true);
    expect(acteurs()[1].wounds.current).toBeLessThan(avant);
  });
});

describe('Dégâts « – » (LDB 62 l.76 ; AA 10 l.192) et Boulet (ZI 02 l.171)', () => {
  it('Lasso : touche sans Dégâts, Empêtré posé', () => {
    const w = arme('lasso');
    expect(damageString(w.damage)).toBe('–');
    const { avant } = lancer(w, true);
    const [, e] = acteurs();
    expect(e.wounds.current).toBe(avant);
    expect(e.conditions.map((c) => c.id)).toContain('empetre');
  });

  it('Mortier + bombe de mortier : la munition seule, +12', () => {
    const tir = weaponWithAmmo(armeDePosteDeTest('mortier'), itemFromTrappingById('bombe-de-mortier', idsDeTest)!);
    expect(tir.damage).toEqual({ plusBF: false, flat: 12 });
  });

  it('Boulet : +10', () => {
    expect(arme('boulet').damage).toEqual({ plusBF: false, flat: 10 });
  });
});

describe('zone posée par un effet « à la mort » (onSlain)', () => {
  it('une seule zone, posée par le walker de combat', () => {
    const fumee = { op: 'zone', shape: 'disc', radiusMeters: 2, blocksLoS: true, durationRounds: 3 };
    const trait = { id: 'trait-de-test-fumee', label: 'Fumée à la mort', effects: [{ trigger: 'onSlain', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'caster', ops: [fumee] } } }] };
    const ns = donnees as unknown as Record<string, unknown>;
    const vrai = ns.findTraitById as (id: string) => unknown;
    vi.spyOn(ns, 'findTraitById', 'get').mockReturnValue((id: string) => (id === trait.id ? trait : vrai(id)));
    try {
      poserLaBataille([lanceur(arme('lasso')), { ...cible(), traits: [{ id: trait.id }] } as Combatant]);
      const [, e] = acteurs();
      e.wounds.current = 0;
      e.dead = true;
      notifySlain(banc.getState, banc.setState, e);
      draineCascade(banc.getState, 20);
    } finally { vi.restoreAllMocks(); }
    const zs = bataille().zones ?? [];
    expect(zs).toHaveLength(1);
    expect(zs[0]).toMatchObject({ rounds: 3, blocksLoS: true, casterId: 'e1' });
  });
});
