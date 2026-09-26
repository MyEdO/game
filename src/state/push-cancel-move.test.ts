import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { emptyScene } from './scene';
import { itemFromTrappingById } from '../engine/items';
import type { Combatant, ShipPoste } from '../engine/types';
import type { BattleState } from './store';

/**
 * #199 — « Annuler dépl. » sans effet sur la poussée d'un engin de siège crewé (bélier-porte). Cause
 * racine : `pushCommitTile` (targetingModes.ts) ne peuplait JAMAIS `battle.moveSnapshot` (seul
 * `battleClickTile` le faisait) → `cancelMove` n'avait rien à restaurer. Fixé en mutualisant la capture
 * (`captureMoveSnapshot`, combatGeometry.ts) entre les trois sites de premier segment.
 */

const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mkPoste = (crewIds: string[]): ShipPoste => ({ item: itemFromTrappingById('belier-ade2')!, crewIds });

const mkHull = (poste: ShipPoste, pos = { x: 5, y: 5 }): Combatant =>
  ({ id: 'hull', label: 'Bélier', kind: 'enemy', pos, conditions: [], weapons: [],
    inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes: [poste] }) as unknown as Combatant;

const mkChef = (id: string, poste: ShipPoste, pos = { x: 5, y: 6 }): Combatant =>
  ({ id, label: id, kind: 'hero', characteristics: CHARS, wounds: { current: 12, max: 12 }, advantage: 0,
    conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
    mannedPoste: poste }) as unknown as Combatant;

const mkServant = (id: string, pos: { x: number; y: number }): Combatant =>
  ({ id, label: id, kind: 'npc', characteristics: CHARS, wounds: { current: 8, max: 8 }, advantage: 0,
    conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos }) as unknown as Combatant;

function pushSetup() {
  const poste = mkPoste(['chef', 's1', 's2']); // 3 servants ≥ moitié de l'Équipe requise (6/2 = 3)
  const hull = mkHull(poste);
  const chef = mkChef('chef', poste);
  const s1 = mkServant('s1', { x: 6, y: 6 });
  const s2 = mkServant('s2', { x: 4, y: 6 });
  const combatants = [chef, hull, s1, s2];
  const battle: BattleState = {
    combatants, order: [chef.id], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  };
  useGame.setState({ party: [chef], mode: 'battle', battle, scene: emptyScene(20, 20) });
  return { chef, hull, s1, s2 };
}

/** Une case atteignable DISTINCTE de la case de départ (le réticule 'push' inclut l'origine à coût 0). */
function reachDest(from: { x: number; y: number }): { x: number; y: number } {
  const keys = [...useGame.getState().battle!.reachable.keys()].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });
  return keys.find((p) => p.x !== from.x || p.y !== from.y)!;
}

describe('#199 — cancelMove défait une poussée d’engin de siège (pushCommitTile)', () => {
  beforeEach(() => useGame.setState({ battle: null, party: [], scene: undefined }));

  it('pousse d’une case : engin + chef + servants avancent, servants marqués loseNextMovement', () => {
    const { chef, hull, s1, s2 } = pushSetup();
    useGame.getState().battlePushEngine();
    expect(useGame.getState().battle!.action).toBe('push');
    expect(useGame.getState().battle!.reachable.size).toBeGreaterThan(0);
    const dest = reachDest(chef.pos!);
    useGame.getState().battleClickTile(dest);
    const st = useGame.getState();
    const find = (id: string) => st.battle!.combatants.find((c) => c.id === id)!;
    expect(find(chef.id).pos).toEqual(dest);
    expect(find(hull.id).pos).not.toEqual({ x: 5, y: 5 }); // translaté du même delta que le chef
    expect(find(s1.id).loseNextMovement).toBe(true);
    expect(find(s2.id).loseNextMovement).toBe(true);
    expect(st.battle!.moveSnapshot).not.toBeNull(); // #199 : DOIT être peuplé (c'était le bug)
  });

  it('cancelMove restaure positions/facing de l’engin + chef + servants ET défait loseNextMovement', () => {
    const { chef, hull, s1, s2 } = pushSetup();
    const from = { chef: { ...chef.pos! }, hull: { ...hull.pos! }, s1: { ...s1.pos! }, s2: { ...s2.pos! } };
    useGame.getState().battlePushEngine();
    const dest = reachDest(from.chef);
    useGame.getState().battleClickTile(dest);
    // Précondition : la poussée a bien bougé tout le monde et posé loseNextMovement (sinon le test ne
    // vérifie rien) — voir le test précédent pour l'assertion détaillée.
    expect(useGame.getState().battle!.combatants.find((c) => c.id === chef.id)!.pos).toEqual(dest);

    useGame.getState().cancelMove();
    const st = useGame.getState();
    const find = (id: string) => st.battle!.combatants.find((c) => c.id === id)!;
    expect(find(chef.id).pos).toEqual(from.chef);
    expect(find(hull.id).pos).toEqual(from.hull);
    expect(find(s1.id).pos).toEqual(from.s1);
    expect(find(s2.id).pos).toEqual(from.s2);
    expect(find(s1.id).loseNextMovement ?? false).toBe(false); // annulé : plus de Mouvement perdu au tour suivant
    expect(find(s2.id).loseNextMovement ?? false).toBe(false);
    expect(st.battle!.movementUsed).toBe(0); // Mouvement du chef re-disponible
    expect(st.battle!.moveSnapshot ?? null).toBeNull();
  });
});
