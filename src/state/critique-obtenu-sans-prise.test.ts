/**
 * Le Critique OBTENU au jet reste un fait du jet ; l'effet nul passe par `sansPrise` (#1595 c.6229550544).
 * LDB 13 l.183 ; LDB 62 l.248 ; LDB 85 l.98 ; LDB 85 l.134 ; LDB 14 l.159.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult } from '../noyau/combatFlow';
import { draineCascade } from './cascade.testkit';
import { seedBattleRng } from '../noyau/battleRng';
import { bus, EVT } from '../noyau/bus';
import { emptyScene } from '../noyau/monde/scene';
import { rederivePassiveAttack, type AttackResult } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';
import { makeRNG } from '../engine/dice';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne', important: true,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

/** Double réussi (LDB 13 l.183), par la couture du jeu (`rederivePassiveAttack` → `applyHit`). */
const doubleReussi = (h: Combatant, cible: Combatant): AttackResult =>
  rederivePassiveAttack(h, cible, epee, { roll: 44, target: 90, success: true, sl: 4, isDouble: true } as never, 'melee', { rng: makeRNG(1595) }, 'corps');

/** La touche FINALE telle que le jeu l'émet, et les étapes jouées. */
function frappe(h: Combatant, cible: Combatant, res: AttackResult, grapple = false): { finale: AttackResult; etapes: string[] } {
  let finale: AttackResult | undefined;
  const lache = bus.on(EVT.ANIM_ATTACK, (p: { to: string; result: AttackResult }) => { if (p.to === cible.id) finale = p.result; });
  applyAttackResult(useGame.getState, useGame.setState, h, cible, epee, res, grapple ? { suite: { grapple: true } } : {});
  const etapes = draineCascade(useGame.getState, 200, (st) => (st.kind === 'sauvegarde' ? 9 : undefined));
  lache();
  expect(finale, 'la touche finale est émise').toBeDefined();
  return { finale: finale!, etapes };
}

const vivant = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null });
});
afterEach(() => { useGame.setState({ battle: null, pendingCascade: null }); });

describe('Critique obtenu, touche sans prise', () => {
  it('Éthéré, arme non magique, double : Critique obtenu, sansPrise « ethere », aucun Critique compté', () => {
    const h = mk('hero', 'h');
    const spectre = mk('enemy', 'spectre', { pos: { x: 1, y: 0 }, traits: [{ id: 'ethere' }] as never });
    setBattle([h, spectre]);
    const res = doubleReussi(h, spectre);
    expect(res).toMatchObject({ hit: true, critical: true, sansPrise: 'ethere', woundsLost: 0 });
    const { finale, etapes } = frappe(h, spectre, res);
    expect(finale).toMatchObject({ critical: true, sansPrise: 'ethere' });
    expect(finale.critiques ?? 0).toBe(0);
    expect(etapes.filter((k) => k === 'critical' || k === 'deviation')).toEqual([]);
    expect(vivant(spectre.id).criticalWounds ?? 0).toBe(0);
    expect(vivant(spectre.id).wounds.current).toBe(30);
  });

  it('sauvegarde démoniaque réussie sur un double : Critique obtenu, sansPrise « sauvegarde », aucun Critique compté', () => {
    const h = mk('hero', 'h');
    const demon = mk('enemy', 'demon', { pos: { x: 1, y: 0 }, traits: [{ id: 'demoniaque', value: 8 }] as never });
    setBattle([h, demon]);
    const { finale, etapes } = frappe(h, demon, doubleReussi(h, demon));
    expect(etapes).toContain('sauvegarde');
    expect(finale).toMatchObject({ hit: true, critical: true, sansPrise: 'sauvegarde' });
    expect(finale.critiques ?? 0).toBe(0);
    expect(etapes.filter((k) => k === 'critical' || k === 'deviation')).toEqual([]);
    expect(vivant(demon.id).criticalWounds ?? 0).toBe(0);
    expect(vivant(demon.id).wounds.current).toBe(30);
  });

  it('Empoignade sur un double : le Critique du jet est conservé, sansPrise « empoignade », aucune Blessure', () => {
    const h = mk('hero', 'h', { engagedWith: ['proie'] as never });
    const proie = mk('enemy', 'proie', { pos: { x: 1, y: 0 }, engagedWith: ['h'] as never });
    setBattle([h, proie]);
    const { finale, etapes } = frappe(h, proie, doubleReussi(h, proie), true);
    expect(finale).toMatchObject({ hit: true, critical: true, sansPrise: 'empoignade', woundsLost: 0 });
    expect(finale.critiques ?? 0).toBe(0);
    expect(etapes.filter((k) => k === 'critical' || k === 'deviation')).toEqual([]);
    expect(vivant(proie.id).criticalWounds ?? 0).toBe(0);
    expect(vivant(proie.id).wounds.current).toBe(30);
  });

  it('Empoignade déclarée contre une Structure : ignorée, le coup inflige ses Dégâts (#1595 c.6230022636)', () => {
    const h = mk('hero', 'h');
    const mur = mk('enemy', 'mur', { pos: { x: 1, y: 0 }, bodyShape: 'structure', important: false });
    setBattle([h, mur]);
    const res = rederivePassiveAttack(h, mur, epee, { roll: 21, target: 90, success: true, sl: 6, isDouble: false } as never, 'melee', { rng: makeRNG(1595) }, 'corps');
    const { finale } = frappe(h, mur, res, true);
    expect(finale.hit).toBe(true);
    expect(finale.sansPrise).toBeUndefined();
    expect(finale.woundsLost).toBeGreaterThan(0);
    expect(vivant(mur.id).wounds.current).toBeLessThan(30);
    expect(vivant(mur.id).grapplingWith ?? []).toEqual([]);
    expect(vivant(h.id).grapplingWith ?? []).toEqual([]);
    expect(vivant(mur.id).conditions.map((c) => c.id)).not.toContain('empetre');
  });
});
