import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { scenario } from '../scenes/test-scenarios/42-belier-porte';
import { runEnemyAI } from './combatFlow';
const scenarioConstruit = scenario.construire();

/**
 * Soft-lock recette (cluster bélier-porte #196-#199) — quand le DERNIER ennemi vivant meurt mais que
 * le combat CONTINUE (`victoryCondition` non authorable atteinte, ex. `destroyStructure` avec la porte
 * encore intacte), un allié IA (`aiControlled`, ex. servant du crew d'un poste d'engin de siège) n'a
 * plus AUCUNE cible (`foeKind` en face = vide) — `runEnemyAI` retournait alors SANS appeler
 * `advanceTurn` : le tour ne se termine jamais (soft-lock, reproduit en recette sur `belier-porte`).
 * Scène RÉELLE (pas une fixture synthétique) : `crewIds` du poste bélier + `garde-du-village` PNJ IA
 * (`ai:true` → `aiControlled`, `combatSlice.ts` bascule son `kind` en 'hero' car `side:'ally'`).
 */
describe('un tour IA se termine TOUJOURS, même sans adversaire vivant et combat non terminé', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('gobelin (dernier ennemi) mort, porte intacte : le tour du servant du bélier se clôt (advanceTurn), le combat continue', () => {
    useGame.setState({ party: scenario.construire().party });
    useGame.getState().startScene(scenarioConstruit.scene);
    useGame.getState().startCombat('siege-belier');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const gobelin = b.combatants.find((c) => c.kind === 'enemy' && !c.inert)!;
    expect(gobelin).toBeTruthy();
    gobelin.dead = true; // dernier ennemi hors de combat — la porte, elle, reste intacte (victoryCondition non remplie)
    const servant = b.combatants.find((c) => c.aiControlled)!;
    expect(servant).toBeTruthy();
    // Donne le tour au servant.
    const turnIdx = b.order.indexOf(servant.id);
    useGame.setState({ battle: { ...b, turn: turnIdx, acted: false, action: null } });
    runEnemyAI(useGame.getState, useGame.setState, servant.id);
    vi.runOnlyPendingTimers(); // purge tout timer de télégraphe/attaque éventuel
    const after = useGame.getState().battle!;
    expect(after.over).toBeFalsy(); // le combat continue (objectif « porte abattue » non rempli)
    expect(after.turn).not.toBe(turnIdx); // le tour a bien avancé — pas de soft-lock
  });
});
