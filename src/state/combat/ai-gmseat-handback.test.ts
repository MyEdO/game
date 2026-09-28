import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { runEnemyAI } from '../combatFlow';
import { setGmSeat } from '../netFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { testScene } from '../../scenes/test-fixture';
import { resetCadence } from '../../engine/cadence';
import { humanControlled, aiDriven } from '../netOwnership';

/**
 * Bac-à-sable MJ × exécution DIFFÉRÉE (#918 phase 2a). `maybeRunEnemyTurn` (`combatFlow.ts`) évalue
 * `aiDriven` PUIS diffère par `scheduleCombatTimer` ; `setGmSeat` (`netFlow.ts`) n'attend aucune fenêtre
 * de combat. Un siège MJ pris entre la planification et le tir rend l'ennemi conduit À LA MAIN
 * (`pilotedByHuman` d'un ennemi = « un siège porte le rôle MJ », `netOwnership.ts`) : `runEnemyAI` doit
 * RE-TESTER son prédicat à l'entrée et rendre la main, au lieu de jouer un acteur qui ne lui appartient
 * plus — ce que la porte de repli `rollSansPilote` exposait par un throw en DEV (Stupide, Rechargement…).
 */
describe('IA × siège MJ pris après planification — runEnemyAI rend la main (#918)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetCadence();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    setGmSeat(useGame.getState, useGame.setState, null);
    resetCadence();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    seedBattleRng(777);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.traits = [{ id: 'stupide' }]; // Stupide (LDB 85) : Test d'Intelligence inline en tête de tour
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 14, y: 10 };
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  it('siège MJ + cadence manuelle : l’ennemi est humanControlled et N’EST PLUS aiDriven', () => {
    const { E } = setup();
    setGmSeat(useGame.getState, useGame.setState, 0);
    const s = useGame.getState();
    expect(humanControlled(s, E)).toBe(true);
    expect(aiDriven(s, E)).toBe(false);
  });

  it('siège MJ pris entre la planification et le tir : runEnemyAI rend la main SANS jouer ni jeter', () => {
    const { E } = setup();
    const turnBefore = useGame.getState().battle!.turn;
    setGmSeat(useGame.getState, useGame.setState, 0); // le MJ s'assied APRÈS que le timer a été armé
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => runEnemyAI(useGame.getState, useGame.setState, E.id)).not.toThrow();

    const b = useGame.getState().battle!;
    expect(b.turn).toBe(turnBefore); // la main N'est pas passée : le MJ jouera cet acteur lui-même
    expect(b.acted).toBeFalsy();     // aucune Action consommée par l'IA
    expect(spy).not.toHaveBeenCalled(); // aucun jet silencieux d'un acteur piloté
  });

  it('témoin — SANS siège MJ, le même ennemi reste aiDriven et runEnemyAI joue bien son tour', () => {
    const { E } = setup();
    expect(aiDriven(useGame.getState(), E)).toBe(true);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    runEnemyAI(useGame.getState, useGame.setState, E.id);
    vi.runAllTimers();
    const b = useGame.getState().battle!;
    expect(b.acted || b.turn !== 0 || (b.log?.length ?? 0) > 0).toBe(true); // l'IA a agi (Stupide, mouvement ou attaque)
    expect(spy).not.toHaveBeenCalled();
  });
});
