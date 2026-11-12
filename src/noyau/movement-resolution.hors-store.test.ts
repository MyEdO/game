import { idsDeTest } from '../engine/idsDeTest.testkit';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHero } from '../engine/character';
import { effectiveMovement } from '../engine/encumbrance';
import { testScene } from '../scenes/test-fixture';
import { bus, EVT } from './bus';
import { resolveMovement } from './combatFlow';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  const battle = banc.getState().battle!;
  const active = battle.combatants.find((combatant) => combatant.kind === 'heros')!;
  active.pos = { x: 6, y: 10 };
  active.engagedWith = [];
  let enemyX = 20;
  for (const enemy of battle.combatants.filter((combatant) => combatant.kind === 'ennemi')) {
    enemy.pos = { x: enemyX++, y: 20 };
  }
  banc.setState({
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
  beforeEach(() => banc.setState({ battle: null, pendingRun: null, pendingDisengage: null }));

  it('résout Marche et Course avec le chemin et le coût canoniques', () => {
    const active = setup();
    const walkDest = { x: active.pos!.x + 2, y: active.pos!.y };
    const walk = resolveMovement(banc.getState, walkDest);
    expect(walk).toMatchObject({ status: 'possible', kind: 'deplacement', cost: 2 });
    if (walk.status === 'possible') expect(walk.path[walk.path.length - 1]).toEqual(walkDest);

    const runDest = { x: active.pos!.x + effectiveMovement(active) + 2, y: active.pos!.y };
    const run = resolveMovement(banc.getState, runDest);
    expect(run).toMatchObject({ status: 'possible', kind: 'course', cost: effectiveMovement(active) + 2 });
    if (run.status === 'possible') expect(run.path[run.path.length - 1]).toEqual(runDest);
  });

  it('retourne la raison du même gate qui bloque le déplacement', () => {
    const active = setup();
    active.engagedWith = ['enemy'];
    const result = resolveMovement(banc.getState, { x: active.pos!.x - 1, y: active.pos!.y });
    expect(result).toEqual({ status: 'bloque', reason: 'engage' });
  });

  it('réutilise au commit le chemin et le coût stockés au premier tap', () => {
    const active = setup();
    const dest = { x: active.pos!.x + 2, y: active.pos!.y };
    banc.getState().cliquerLaCase(dest);
    const preview = banc.getState().battle!.preview;
    expect(preview).toMatchObject({ kind: 'deplacement', cost: 2 });
    if (!preview || preview.kind !== 'deplacement') throw new Error('aperçu de Marche absent');

    let emittedPath: unknown;
    const unsubscribe = bus.on(EVT.ANIM_MOVE, (payload) => { emittedPath = payload.path; });
    banc.getState().cliquerLaCase(dest);
    unsubscribe();

    expect(emittedPath).toBe(preview.path);
    expect(banc.getState().battle!.movementUsed).toBe(preview.cost);
  });

  it('conserve le chemin de Course du premier tap dans le pending', () => {
    const active = setup();
    const dest = { x: active.pos!.x + effectiveMovement(active) + 2, y: active.pos!.y };
    // Course ARMÉE (spec HUD § ARBITRAGE 2026-08-19) : sans elle, le clic au-delà de la Marche refuse.
    banc.getState().cliquerLaCase(dest, undefined, { intentionId: 'course' });
    const preview = banc.getState().battle!.preview;
    expect(preview?.kind).toBe('course');
    if (!preview || preview.kind !== 'course') throw new Error('aperçu de Course absent');

    banc.getState().cliquerLaCase(dest, undefined, { intentionId: 'course' });

    expect(banc.getState().pendingRun?.path).toBe(preview.path);
    expect(banc.getState().pendingRun?.cost).toBe(preview.cost);
  });

  it('refuse l’ouverture directe d’une Course sans résolution atteignable', () => {
    const active = setup();
    banc.getState().ouvrirLaCourse({ x: active.pos!.x + 30, y: active.pos!.y });
    expect(banc.getState().pendingRun).toBeNull();
  });

  it('la priorité Désengagement ouvre son flux sans intention de déplacement', () => {
    const active = setup();
    const enemy = banc.getState().battle!.combatants.find((combatant) => combatant.kind === 'ennemi')!;
    enemy.pos = { x: active.pos!.x + 1, y: active.pos!.y };
    active.engagedWith = [enemy.id];
    enemy.engagedWith = [active.id];

    banc.getState().cliquerLaCase({ x: active.pos!.x - 1, y: active.pos!.y });

    expect(banc.getState().pendingDisengage).not.toBeNull();
    expect(banc.getState().battle!.preview).toBeNull();
  });
});
