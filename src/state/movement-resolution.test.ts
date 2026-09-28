import { beforeEach, describe, expect, it } from 'vitest';
import { createHero } from '../engine/character';
import { effectiveMovement } from '../engine/encumbrance';
import { testScene } from '../scenes/test-fixture';
import { bus, EVT } from './bus';
import { resolveMovement } from './combatFlow';
import { useGame } from './store';

function setup() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene());
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  const battle = useGame.getState().battle!;
  const active = battle.combatants.find((combatant) => combatant.kind === 'hero')!;
  active.pos = { x: 6, y: 10 };
  active.engagedWith = [];
  let enemyX = 20;
  for (const enemy of battle.combatants.filter((combatant) => combatant.kind === 'enemy')) {
    enemy.pos = { x: enemyX++, y: 20 };
  }
  useGame.setState({
    battle: {
      ...battle,
      turn: battle.order.indexOf(active.id),
      action: null,
      acted: false,
      movementUsed: 0,
      movedPreAction: false,
      preview: null,
    },
    pendingRun: null,
    pendingDisengage: null,
  });
  return active;
}

describe('résolution canonique du déplacement', () => {
  beforeEach(() => useGame.setState({ battle: null, pendingRun: null, pendingDisengage: null }));

  it('résout Marche et Course avec le chemin et le coût canoniques', () => {
    const active = setup();
    const walkDest = { x: active.pos!.x + 2, y: active.pos!.y };
    const walk = resolveMovement(useGame.getState, walkDest);
    expect(walk).toMatchObject({ status: 'ok', kind: 'move', cost: 2 });
    if (walk.status === 'ok') expect(walk.path[walk.path.length - 1]).toEqual(walkDest);

    const runDest = { x: active.pos!.x + effectiveMovement(active) + 2, y: active.pos!.y };
    const run = resolveMovement(useGame.getState, runDest);
    expect(run).toMatchObject({ status: 'ok', kind: 'run', cost: effectiveMovement(active) + 2 });
    if (run.status === 'ok') expect(run.path[run.path.length - 1]).toEqual(runDest);
  });

  it('retourne la raison du même gate qui bloque le déplacement', () => {
    const active = setup();
    active.engagedWith = ['enemy'];
    const result = resolveMovement(useGame.getState, { x: active.pos!.x - 1, y: active.pos!.y });
    expect(result).toEqual({ status: 'blocked', reason: 'engaged' });
  });

  it('réutilise au commit le chemin et le coût stockés au premier tap', () => {
    const active = setup();
    const dest = { x: active.pos!.x + 2, y: active.pos!.y };
    useGame.getState().battleClickTile(dest);
    const preview = useGame.getState().battle!.preview;
    expect(preview).toMatchObject({ kind: 'move', cost: 2 });
    if (!preview || preview.kind !== 'move') throw new Error('aperçu de Marche absent');

    let emittedPath: unknown;
    const unsubscribe = bus.on(EVT.ANIM_MOVE, (payload) => { emittedPath = payload.path; });
    useGame.getState().battleClickTile(dest);
    unsubscribe();

    expect(emittedPath).toBe(preview.path);
    expect(useGame.getState().battle!.movementUsed).toBe(preview.cost);
  });

  it('conserve le chemin de Course du premier tap dans le pending', () => {
    const active = setup();
    const dest = { x: active.pos!.x + effectiveMovement(active) + 2, y: active.pos!.y };
    // Course ARMÉE (spec HUD § ARBITRAGE 2026-08-19) : sans elle, le clic au-delà de la Marche refuse.
    useGame.getState().battleClickTile(dest, { courseArmee: true });
    const preview = useGame.getState().battle!.preview;
    expect(preview?.kind).toBe('run');
    if (!preview || preview.kind !== 'run') throw new Error('aperçu de Course absent');

    useGame.getState().battleClickTile(dest, { courseArmee: true });

    expect(useGame.getState().pendingRun?.path).toBe(preview.path);
    expect(useGame.getState().pendingRun?.cost).toBe(preview.cost);
  });

  it('refuse l’ouverture directe d’une Course sans résolution atteignable', () => {
    const active = setup();
    useGame.getState().battleRun({ x: active.pos!.x + 30, y: active.pos!.y });
    expect(useGame.getState().pendingRun).toBeNull();
  });

  it('la priorité Désengagement ouvre son flux sans intention de déplacement', () => {
    const active = setup();
    const enemy = useGame.getState().battle!.combatants.find((combatant) => combatant.kind === 'enemy')!;
    enemy.pos = { x: active.pos!.x + 1, y: active.pos!.y };
    active.engagedWith = [enemy.id];
    enemy.engagedWith = [active.id];

    useGame.getState().battleClickTile({ x: active.pos!.x - 1, y: active.pos!.y });

    expect(useGame.getState().pendingDisengage).not.toBeNull();
    expect(useGame.getState().battle!.preview).toBeNull();
  });

  it('purge l’intention de survol au tap, au commit et à l’annulation de Course', () => {
    const active = setup();
    const walkDest = { x: active.pos!.x + 2, y: active.pos!.y };
    useGame.setState({ hoverDelta: { action: 0, move: 0, adv: 0, movement: { status: 'blocked', reason: 'out-of-range' } } });
    useGame.getState().battleClickTile(walkDest);
    expect(useGame.getState().hoverDelta).toBeNull();

    useGame.setState({ hoverDelta: { action: 0, move: 2, adv: 0 } });
    useGame.getState().battleClickTile(walkDest);
    expect(useGame.getState().hoverDelta).toBeNull();

    const battle = useGame.getState().battle!;
    const moved = battle.combatants.find((combatant) => combatant.id === active.id)!;
    const runDest = { x: moved.pos!.x + effectiveMovement(moved) + 1, y: moved.pos!.y };
    useGame.setState({ battle: { ...battle, movementUsed: 0, movedPreAction: false } });
    useGame.getState().battleClickTile(runDest);
    useGame.getState().battleClickTile(runDest);
    useGame.setState({ hoverDelta: { action: 1, move: effectiveMovement(moved) + 1, adv: 0 } });
    useGame.getState().runCancel();
    expect(useGame.getState().hoverDelta).toBeNull();
  });
});
