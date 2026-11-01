import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * ROUTAGE du dé choisi dans un flux MULTI d'incantation — Contre-sort et Opposition, DEUX participants.
 *
 * Deux propriétés qu'une fixture MONO (`fixed-die-inventaire.test.ts`) ne peut pas voir, faute de second
 * slot à croiser :
 *  1. le dé saisi va au participant `pid` VISÉ, et le témoin ne bouge pas (aucun croisement de pid) ;
 *  2. le plancher de DR d'un Test OPPOSÉ (LDB 17 l.68 : « S'il s'agit d'un Test opposé, vous l'emportez
 *     avec au moins DR +1 ») se mesure contre l'incantation FIGÉE — `castT.sl + 1`.
 */
const mk = (id: string, kind: Combatant['kind'] = 'hero'): Combatant => (blessuresSurLeProfil({
  id, name: id, label: id, kind,
  characteristics: { force: 40, dexterite: 40, agilite: 40, endurance: 40, 'force-mentale': 40, 'capacite-de-combat': 45, 'capacite-de-tir': 45, initiative: 40, intelligence: 40, sociabilite: 40 },
  wounds: blessuresDeBase(10), advantage: 0, conditions: [], traumas: [],
  resilience: 3, fortune: 2, weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
}) as unknown as Combatant);

const T = 45;
const rateTR = { roll: 88, target: T, sl: -4, success: false, isDouble: true };
/** Incantation ENNEMIE figée = l'« attaquant » des deux Tests opposés. */
const ENEMY_CAST = { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' };
const CHOISI = 11; // ≤ cible (45) : le dé de l'exemple Salundra (LDB 17 l.70)

const st = () => useGame.getState() as unknown as Record<string, (...a: unknown[]) => void>;
const P = <T2,>(k: string): T2 => (useGame.getState() as unknown as Record<string, T2>)[k];
const heroResilience = (id: string) => useGame.getState().party.find((h) => h.id === id)!.resilience;

beforeEach(() => {
  const A = mk('A'), B = mk('B'), E = mk('E', 'enemy');
  useGame.setState({
    party: [A, B],
    battle: { combatants: [A, B, E], log: [], order: ['A', 'B', 'E'], turn: 0, round: 1 } as never,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCounterspell: null,
    pendingCastOpposition: null,
  } as never);
});

describe('dé choisi d’un flux MULTI d’incantation — routage par pid + plancher DR +1', () => {
  it('contre-sort : le dé va au participant visé, le témoin est intact, le DR bat l’incantation figée', () => {
    useGame.setState({
      pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST },
      pendingCounterspell: { participants: [
        { id: 'A', interactive: true, declared: 'solo', result: { dispelled: false, counter: { ...rateTR }, casterNetSL: 7, log: '' } },
        { id: 'B', interactive: true, declared: 'solo', result: { dispelled: false, counter: { ...rateTR }, casterNetSL: 7, log: '' } },
      ] },
    } as never);
    st().counterspellForceSuccess('B');
    const apres = heroResilience('B');
    expect(apres, 'la Résilience de B n’a pas été dépensée').toBe(2);
    st().counterspellSetForcedRoll('B', CHOISI);

    const parts = P<{ participants: { result: { dispelled: boolean; counter: { roll: number; sl: number; success: boolean } } }[] }>('pendingCounterspell').participants;
    const [cA, cB] = [parts[0].result, parts[1].result];
    expect(cA.counter.roll, 'le témoin A a reçu le dé de B (croisement de pid)').toBe(88);
    expect(cA.dispelled, 'le témoin A a été résolu à la place de B').toBe(false);
    expect(cB.counter.roll, 'B n’a pas reçu le dé saisi').toBe(CHOISI);
    expect(cB.counter.sl, 'plancher LDB 17 l.68 : l’emporter d’au moins DR +1 sur l’incantation figée').toBeGreaterThanOrEqual(ENEMY_CAST.sl + 1);
    expect(cB.dispelled, 'la réussite payée par le point de Résilience a été perdue').toBe(true);
    expect(heroResilience('B'), 'le choix du dé a re-dépensé une ressource').toBe(apres);
  });

  it('opposition : idem sur l’autre participant (le dé ne fuit pas vers le témoin)', () => {
    useGame.setState({
      pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: ENEMY_CAST },
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', participants: [
        { id: 'A', interactive: true, result: { oppose: { ...rateTR }, resisted: false, margin: 7 } },
        { id: 'B', interactive: true, result: { oppose: { ...rateTR }, resisted: false, margin: 7 } },
      ] },
    } as never);
    st().oppositionForceSuccess('A');
    const apres = heroResilience('A');
    expect(apres, 'la Résilience de A n’a pas été dépensée').toBe(2);
    st().oppositionSetForcedRoll('A', CHOISI);

    const parts = P<{ participants: { result: { resisted: boolean; margin: number; oppose: { roll: number; sl: number } } }[] }>('pendingCastOpposition').participants;
    const [oA, oB] = [parts[0].result, parts[1].result];
    expect(oB.oppose.roll, 'le témoin B a reçu le dé de A (croisement de pid)').toBe(88);
    expect(oB.resisted, 'le témoin B a été résolu à la place de A').toBe(false);
    expect(oA.oppose.roll, 'A n’a pas reçu le dé saisi').toBe(CHOISI);
    expect(oA.oppose.sl, 'plancher LDB 17 l.68 : DR +1 sur l’incantation figée').toBeGreaterThanOrEqual(ENEMY_CAST.sl + 1);
    expect(oA.resisted, 'la cible qui force sa réussite RÉSISTE au sort').toBe(true);
    expect(heroResilience('A'), 'le choix du dé a re-dépensé une ressource').toBe(apres);
  });
});
