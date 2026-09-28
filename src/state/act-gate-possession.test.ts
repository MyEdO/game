/**
 * #1262 V1 lot 1 — POSSESSION du gate d'Action par Round (op `actGate`, Racine de mandragore,
 * `LDB 71 l.35`). Sonde B du juge de design : le prédicat du site était `humanControlled`
 * (affordance LOCALE — « qui a la main devant CET écran »). Chez l'hôte, le gate d'un héros
 * possédé par un INVITÉ tombait donc dans la branche inline : le d100 était jeté en silence et,
 * sur un échec, `out.loseMovement` retirait au joueur son Mouvement sans lui ouvrir la moindre
 * fenêtre — la décision « Action OU Mouvement » que le RAW lui laisse était prise pour lui.
 *
 * `surfaceOf` (`rollSeam`) est SEAT-AGNOSTIQUE : le porteur d'un autre siège surface aussi.
 * En SOLO les deux prédicats coïncident (`ownsLocally` vrai pour tous) — d'où le harnais à deux
 * sièges de `roll-seam-socle.test.ts` (#1262 B7) : sans lui la régression est invisible.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { resolveActGates } from './combatFlow'; // baril : charge `combat/turnHooks` (hooks + appliers)
import { cascadeAppliers } from './cascade';
import { surfaceOf } from './rollSeam';
import { modalOwnerOf } from './modalArbiter';
import { ownsLocally, seatOwns, humanControlled } from './netOwnership';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { CascadeStep } from './pendings';
import type { Combatant } from '../engine/types';

const NET0 = useGame.getState().net;
const MODE0 = useGame.getState().mode;
const SCENE0 = useGame.getState().scene;

const chars = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 20, sociabilite: 30 };

/** Un porteur de Racine de mandragore : gate de Force Mentale par Round. */
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, label: id, kind: 'hero', characteristics: { ...chars },
    conditions: [], engagedWith: [], skills: [], talents: [], weapons: [],
    advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 12, max: 12 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4,
    activeEffects: [{ label: 'Racine de mandragore', actGate: { char: 'force-mentale' } }],
    ...over,
  }) as unknown as Combatant;

const g = useGame.getState;
const etapes = (): CascadeStep[] => g().pendingCascade?.participants ?? [];

/** Monte une arène d'un seul combattant, actif, et pose les sièges. */
function setup(hero: Combatant, net: Record<string, unknown>): Combatant {
  seedBattleRng(3);
  const battle: BattleState = {
    combatants: [hero], order: [hero.id], baseOrder: [hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingCascade: null, suspendedCascades: [],
    net: { ...NET0, ...net },
  } as never);
  return hero;
}

/** HÔTE au siège 0 ; le porteur `H1` appartient au siège 1 (l'invité) — harnais B7. */
const COOP = { mode: 'host', mySeat: 0, ownership: { H1: 1 }, slots: [0, 1, 0, 0] };
const SOLO = { mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] };

beforeEach(() => {
  useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [] } as never);
});
afterEach(() => {
  useGame.setState({ net: NET0, mode: MODE0, scene: SCENE0, battle: null, pendingCascade: null, suspendedCascades: [] } as never);
});

describe('#1262 — sonde B : le gate d’Action d’un héros d’INVITÉ ne se roule pas chez l’hôte', () => {
  it('COOP — la fenêtre s’ouvre au siège du porteur, et son Mouvement reste intact', () => {
    const hero = setup(mk('H1'), COOP);
    // L'ÉNONCÉ du fix, figé sur le harnais coop : les deux prédicats DIVERGENT ici, et c'est la seule
    // configuration où ils le font (en solo `ownsLocally` est vrai pour tous, donc ils coïncident).
    expect({
      ownsLocally: ownsLocally(g(), 'H1'),
      humanControlled: humanControlled(g(), hero),
      surfaceOf: surfaceOf(g, hero.id),
    }).toEqual({ ownsLocally: false, humanControlled: false, surfaceOf: true });

    const out = resolveActGates(g, useGame.setState, hero);

    expect(out.lines, 'aucune ligne inline : le dé n’a pas été jeté en silence chez l’hôte').toEqual([]);
    expect(out.loseMovement, 'le Mouvement de l’invité ne se perd pas sans qu’il ait été consulté').toBe(false);

    const [st] = etapes();
    expect(st, 'une étape de cascade INFLUENÇABLE est ouverte').toBeTruthy();
    expect(st.kind).toBe('actGate');
    expect(st.actorId, 'le mint NOMME le porteur → l’arbitre rend son id, et la fenêtre part à SON siège').toBe('H1');
    expect(st.result, 'le dé n’est pas tombé : c’est la fenêtre qui le jette').toBeNull();
    expect(st.target, 'FM 20, Difficulté intermédiaire +0').toBe(20);
    expect(st.base).toBe(20);
    expect(st.rollLabel).toBe('Force Mentale');
    expect(st.difficulty).toBe('intermediaire');
    expect(st.stake, 'l’enjeu (#1117) descend à l’entité qui exige le gate').toBeTruthy();

    // Assertion COOP (#1262 B7) : la fenêtre atteint le siège 1, jamais l'hôte.
    expect(modalOwnerOf(g())).toBe('H1');
    expect(seatOwns(g(), 1, 'H1'), 'elle est au siège 1, qui possède le porteur').toBe(true);
  });

  it('SOLO — inchangé : le héros manuel garde SA fenêtre (le fix est inobservable ici)', () => {
    const hero = setup(mk('H1'), SOLO);
    const out = resolveActGates(g, useGame.setState, hero);
    expect(out.lines).toEqual([]);
    expect(out.loseMovement).toBe(false);
    expect(etapes()[0]?.actorId).toBe('H1');
  });

  it('porteur qu’AUCUN siège ne tient (héros conduit par l’IA) → jet INLINE, aucune fenêtre', () => {
    const hero = setup(mk('H1', { aiControlled: true } as Partial<Combatant>), COOP);
    expect(surfaceOf(g, hero.id)).toBe(false);
    const out = resolveActGates(g, useGame.setState, hero);
    expect(out.lines.length, 'l’IA roule son gate en ligne, journalisé').toBeGreaterThan(0);
    expect(out.loseMovement, 'FM 20, graine 3 : le Test échoue → l’Action est gardée, le Mouvement perdu').toBe(true);
    expect(g().pendingCascade, 'aucune fenêtre pour un porteur que personne ne tient').toBeNull();
  });
});

describe('#1262 — l’étape de CHOIX insérée par l’applier naît du mint (`choiceStep`)', () => {
  it('échec du gate → choix `actGateChoice` PORTÉ par le héros, jamais partagé', () => {
    const hero = setup(mk('H1'), COOP);
    const step = { id: 'actGate-H1-force-mentale', kind: 'actGate', label: 'Garder ses moyens', result: { roll: 90, target: 20, sl: -7, success: false } } as unknown as CascadeStep;
    const res = cascadeAppliers.actGate!.apply(useGame.getState, useGame.setState, step, hero, { steps: [step], index: 0 });
    const [choix] = res!.insert!;
    expect(choix.kind).toBe('actGateChoice');
    expect(choix.actorId, 'le choix porte SON porteur : l’hôte ne tranche pas la voie de l’invité').toBe('H1');
    expect(choix.groupOwner, '`options` + `groupOwner` = n’importe quel siège tranche pour autrui').toBeUndefined();
    expect(choix.defaultChoice).toBe('action');
    expect(choix.options!.map((o) => o.key)).toEqual(['action', 'move']);
  });

  it('succès du gate → aucune insertion (rien à restreindre)', () => {
    const hero = setup(mk('H1'), COOP);
    const step = { id: 'actGate-H1-force-mentale', kind: 'actGate', label: 'Garder ses moyens', result: { roll: 5, target: 20, sl: 1, success: true } } as unknown as CascadeStep;
    const res = cascadeAppliers.actGate!.apply(useGame.getState, useGame.setState, step, hero, { steps: [step], index: 0 });
    expect(res!.insert).toBeUndefined();
  });
});
