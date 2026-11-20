import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { applyAttackResult, firedAttackBlock } from './combatFlow';
import { spawnEnemy } from './monde/spawn';
import { bus, EVT } from './bus';
import { draineCascade } from './cascade.testkit';
import { resolveRanged, type AttackResult } from '../engine/combat';
import { deMin } from '../engine/dice.testkit';
import { findCreatureById } from '../data';
import { t as tr } from '../i18n';
import { seedBattleRng } from './battleRng';
import { dansLaZoneJouable, emptyScene, isWalkable, type Scene } from './monde/scene';
import { itemFromTrappingById, loadoutSetActive, recomputeLoadout } from '../engine/items';
import { garanti } from '../lib/garanti';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); seedBattleRng(20261116); });

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ARMURE = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

const heros = (trappingId: string): Combatant => {
  const h = blessuresSurLeProfil({
    id: 'h1', name: 'Lanceur', kind: 'heros', characteristics: CHARS, wounds: blessuresDeBase(15), advantage: 0, conditions: [],
    movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 2, y: 7 }, size: 'moyenne', weapons: [], items: [itemFromTrappingById(trappingId, idsDeTest)!], fate: 0, armour: ARMURE,
  }) as unknown as Combatant;
  recomputeLoadout(h);
  return h;
};

const cible = (): Combatant => (blessuresSurLeProfil({
  id: 'e1', name: 'Cible', kind: 'ennemi', characteristics: CHARS, wounds: blessuresDeBase(20), advantage: 0, conditions: [],
  movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 8, y: 7 }, size: 'moyenne', weapons: [], items: [], armour: ARMURE,
}) as unknown as Combatant);

function poserLaBataille(cs: Combatant[], zoneJouable?: Scene['zoneJouable']): void {
  const battle = {
    combatants: cs, order: cs.map((c) => c.id), baseOrder: cs.map((c) => c.id), turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: { ...emptyScene('scene-test'), metresPerTile: 1, ...(zoneJouable ? { zoneJouable } : {}) }, gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null });
}

describe('arme lancée (LDB 14 l.142 ; #4330)', () => {
  it('un héros qui tient un javelot peut le lancer : aucune munition requise', () => {
    const h = heros('javelot');
    expect(h.weapons.map((w) => w.trappingId)).toContain('javelot');
    poserLaBataille([h, cible()]);
    const [a, e] = banc.getState().battle!.combatants;
    expect(firedAttackBlock(banc.getState, a, e)).toBeNull();
  });
});

const RATE: AttackResult = { hit: false, attackerRoll: 88, netSL: -3, critical: false, advantageTo: null, defenderDefeated: false, log: 'manque sa cible.' };

/** Les objets au sol : la case de leur décor et leur lot (`deposerAuSol`). */
const auSol = (): { pos: { x: number; y: number }; lot: ItemInstance[] }[] => {
  const s = banc.getState();
  return Object.entries(s.objetsAuSol).map(([id, lot]) => ({ pos: { ...s.scene!.entities.find((e) => e.id === id)!.pos! }, lot }));
};

/** `a` lance `arme` sur `e` : touche au dé 01 (`resolveRanged`), ou raté ; rend le point d'arrivée de la Dispersion. */
function lancer(a: Combatant, e: Combatant, arme: Weapon, touche: boolean): { x: number; y: number } | undefined {
  let arrivee: { x: number; y: number } | undefined;
  const off = bus.on(EVT.ANIM_FLOAT, (d) => { if (d.text === tr('cf.dispersionFlottante')) arrivee = d.pos; });
  try {
    const res = touche ? resolveRanged(a, e, arme, deMin, 6, undefined, [], undefined, 1) : RATE;
    if (touche) expect(res.hit).toBe(true);
    applyAttackResult(banc.getState, banc.setState, a, e, arme, res);
    draineCascade(banc.getState, 20, () => 4);
  } finally { off(); }
  return arrivee;
}

const tenue = (c: Combatant, trappingId: string): Weapon => c.weapons.find((w) => w.trappingId === trappingId)!;

describe("l'arme lancée quitte la main et tombe au sol (#4330)", () => {
  it('javelot qui touche : main vide, le même javelot au sol sur la case de la cible', () => {
    poserLaBataille([heros('javelot'), cible()]);
    const [a, e] = banc.getState().battle!.combatants;
    const uid = a.items![0].uid;
    lancer(a, e, tenue(a, 'javelot'), true);
    expect(a.items ?? []).toEqual([]);
    expect(a.weapons.some((w) => w.trappingId === 'javelot')).toBe(false);
    expect(auSol()).toEqual([{ pos: { x: 8, y: 7 }, lot: [expect.objectContaining({ uid, trappingId: 'javelot', equipped: false })] }]);
  });

  it('javelot raté : il tombe au point d’arrivée de la Dispersion', () => {
    poserLaBataille([heros('javelot'), cible()]);
    const [a, e] = banc.getState().battle!.combatants;
    const arrivee = lancer(a, e, tenue(a, 'javelot'), false);
    expect(arrivee).toBeDefined();
    expect(auSol()).toEqual([{ pos: { x: arrivee!.x, y: arrivee!.y }, lot: [expect.objectContaining({ trappingId: 'javelot' })] }]);
  });

  it('javelot raté qui retombe hors de la zone jouable : il y tombe, sur une case où nul ne va le ramasser (#4392)', () => {
    const rangee = { x: 2, y: 7, w: 7, h: 1 };
    const dehors = [1, 2, 3, 4, 5, 6, 7, 8].map((graine) => {
      seedBattleRng(graine);
      poserLaBataille([heros('javelot'), cible()], rangee);
      banc.setState({ objetsAuSol: {} });
      const [a, e] = banc.getState().battle!.combatants;
      const arrivee = lancer(a, e, tenue(a, 'javelot'), false)!;
      return { arrivee, sol: auSol()[0].pos };
    }).filter(({ arrivee }) => !dansLaZoneJouable(banc.getState().scene!, arrivee.x, arrivee.y));
    expect(dehors.length, 'au moins une Dispersion retombe hors de la zone').toBeGreaterThan(0);
    expect(dehors.every(({ arrivee, sol }) => sol.x === arrivee.x && sol.y === arrivee.y && !isWalkable(banc.getState().scene!, sol.x, sol.y))).toBe(true);
  });

  it.each(['bombe', 'bombe-fumigene'])('%s : quitte la main, détruite, rien au sol', (id) => {
    poserLaBataille([heros(id), cible()]);
    const [a, e] = banc.getState().battle!.combatants;
    lancer(a, e, tenue(a, id), false);
    expect(a.items ?? []).toEqual([]);
    expect(auSol()).toEqual([]);
  });

  it('le couteau porté du tueur à gages garde son identité au sol et disparaît de sa panoplie', () => {
    const tueur = spawnEnemy({ ref: 'tueur-a-gages' }, 'tg', { x: 2, y: 7 });
    const id = 'couteau-de-lancer';
    const objet = garanti(tueur.items?.find((i) => i.trappingId === id), id, 'objet de fiche');
    const panoplie = garanti(tueur.loadouts?.find((set) => set.main === objet.uid), objet.uid, 'panoplie de lancer');
    loadoutSetActive(tueur, panoplie.id);
    recomputeLoadout(tueur);

    poserLaBataille([tueur, cible()]);
    const [a, e] = banc.getState().battle!.combatants;
    const couteau = tenue(a, id);
    expect(couteau.uid).toBe(objet.uid);
    lancer(a, e, couteau, true);
    expect(auSol()).toEqual([{
      pos: { x: 8, y: 7 },
      lot: [expect.objectContaining({ uid: objet.uid, trappingId: id, equipped: false })],
    }]);
    expect(a.items?.some((i) => i.uid === objet.uid)).toBe(false);
    recomputeLoadout(a);
    expect(a.weapons.some((w) => w.trappingId === id)).toBe(false);
  });

  it("un Trait de couteau sans objet de fiche se matérialise au sol et ne revient pas en main", () => {
    const base = findCreatureById('tueur-a-gages')!;
    const presetCreature = { ...base, trappings: base.trappings.filter((r) => !('id' in r && r.id === 'couteau-de-lancer')) };
    const tueur = spawnEnemy({ presetCreature, presetId: 'tueur-a-gages' }, 'tg', { x: 2, y: 7 });
    poserLaBataille([tueur, cible()]);
    const [a, e] = banc.getState().battle!.combatants;
    const couteau = tenue(a, 'couteau-de-lancer');
    expect(couteau.uid).toMatch(/^trait-/);
    lancer(a, e, couteau, true);
    const [depot] = auSol();
    expect(depot.pos).toEqual({ x: 8, y: 7 });
    expect(depot.lot).toEqual([expect.objectContaining({ trappingId: 'couteau-de-lancer', kind: 'distance' })]);
    expect(depot.lot[0].uid).not.toMatch(/^trait-/);
    recomputeLoadout(a);
    expect(a.weapons.some((w) => w.trappingId === 'couteau-de-lancer')).toBe(false);
  });

  it('le Lasso (Entraves, LDB 14 l.142 « Lancer ») ne se disperse pas et reste en main', () => {
    poserLaBataille([heros('lasso'), cible()]);
    const [a, e] = banc.getState().battle!.combatants;
    const arrivee = lancer(a, e, tenue(a, 'lasso'), false);
    expect(arrivee).toBeUndefined();
    expect(a.weapons.some((w) => w.trappingId === 'lasso')).toBe(true);
    expect(auSol()).toEqual([]);
  });
});
