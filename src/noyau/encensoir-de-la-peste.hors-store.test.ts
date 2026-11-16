/**
 * Encensoir de la peste (The Horned Rat Companion 03 l.23-31, #4202) : couronnes d'exposition à la
 * Corruption au début du Round, porteur compris, tant que l'objet est porté ou tenu (`isHeld`). Câblage par
 * le hook RÉEL de frontière de Round (`runCombatHooks('onRoundEnd')`, `fire-round-start-triggers`), puis
 * le socle `targetsFor` par sa couture publique (`applyTriggeredEffects`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runCombatHooks } from './combatHooks';
import { applyTriggeredEffects } from './triggeredEffects';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { TriggeredEffect } from '../engine/flowCore';
import type { PendingCorruption } from './pendings';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const heros = (id: string, x: number): Combatant => ({
  ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: id, id, seed: 7, talentsRolled: false }),
  pos: { x, y: 5 },
});

/** Porteur en (5,5) ; adjacent 1 case (2 m), 2 cases (4 m), 3 cases (6 m), 5 cases (10 m) — 2 m/case. */
function frontiereDeRound(equipe: boolean): Map<string, PendingCorruption['level'][]> {
  const porteur = heros('porteur', 5);
  const encensoir = itemFromTrappingById('encensoir-de-la-peste', idsDeTest)!;
  porteur.items = [...(porteur.items ?? []), { ...encensoir, equipped: equipe }];
  const autres = [heros('adjacent', 6), heros('a4m', 7), heros('a6m', 8), heros('a10m', 10)];
  const combatants = [porteur, ...autres];
  banc.setState({ party: combatants, battle: { combatants, zones: [], round: 1 } as never, pendingCorruption: null, corruptionQueue: [] });
  const battle = banc.getState().battle!;
  runCombatHooks('onRoundEnd', { get: banc.getState, set: banc.setState, battle, sink: () => {} });
  const s = banc.getState();
  const expositions = new Map<string, PendingCorruption['level'][]>();
  for (const p of [s.pendingCorruption, ...s.corruptionQueue]) {
    if (p?.menace !== 'corruption' || !p.level) continue;
    expositions.set(p.heroId, [...(expositions.get(p.heroId) ?? []), p.level]);
  }
  return expositions;
}

describe('Encensoir de la peste — exposition au début du Round (#4202)', () => {
  it('équipé : porteur et adjacent Majeure, 4 m Modérée, 6 m Mineure, 10 m rien — une exposition chacun', () => {
    expect(Object.fromEntries(frontiereDeRound(true))).toEqual({
      porteur: ['majeure'], adjacent: ['majeure'], a4m: ['moderee'], a6m: ['mineure'],
    });
  });

  it('dans le sac (non équipé) : personne n’est exposé', () => {
    expect(frontiereDeRound(false).size).toBe(0);
  });
});

const mk = (id: string, x: number): Combatant => (blessuresSurLeProfil({
  id, label: id, kind: 'ennemi', pos: { x, y: 0 },
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: blessuresDeBase(20), advantage: 0, conditions: [], skills: [], talents: [], weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
}) as unknown as Combatant);

const blesse = (on: TriggeredEffect['on']): TriggeredEffect => ({
  trigger: 'onRoundStart', on,
  flow: { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }] } },
});

/** Ids des combattants touchés par `on` autour du porteur en x=0 (cibles en x = 1..5), à `mpt` m/case. */
function touches(on: TriggeredEffect['on'], mpt = 2): string[] {
  const porteur = mk('porteur', 0);
  const cibles = [1, 2, 3, 4, 5].map((x) => mk(`x${x}`, x));
  const combatants = [porteur, ...cibles];
  const get = () => ({ battle: { combatants }, scene: { metresPerTile: mpt } }) as never;
  applyTriggeredEffects(get, porteur, [blesse(on)], 'onRoundStart', { rng: makeRNG(1) });
  return combatants.filter((c) => c.wounds.current < 20).map((c) => `${c.id}×${20 - c.wounds.current}`);
}

describe('targetsFor — couronne et centre compris (#4202)', () => {
  it('sans champ neuf : rayon plein, centre et porteur exclus', () => {
    expect(touches({ near: 'soi', radiusMeters: 4 })).toEqual(['x1×1', 'x2×1']);
  });

  it('`radiusInnerMeters` : exclut la distance ≤ rayon intérieur', () => {
    expect(touches({ near: 'soi', radiusMeters: 8, radiusInnerMeters: 4 })).toEqual(['x3×1', 'x4×1']);
  });

  it('`centreCompris` : le centre (ici le porteur) est inclus', () => {
    expect(touches({ near: 'soi', radiusMeters: 2, centreCompris: true })).toEqual(['porteur×1', 'x1×1']);
  });

  it('à 4 m/case, la couronne ]2,4] m est vide : aucune double exposition avec la couronne ≤ 2 m', () => {
    expect(touches({ near: 'soi', radiusMeters: 2, centreCompris: true }, 4)).toEqual(['porteur×1', 'x1×1']);
    expect(touches({ near: 'soi', radiusMeters: 4, radiusInnerMeters: 2 }, 4)).toEqual([]);
    expect(touches({ near: 'soi', radiusMeters: 8, radiusInnerMeters: 4 }, 4)).toEqual(['x2×1']);
  });
});
