import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { scenario } from '../scenes/test-scenarios/42-belier-porte';
import { runEnemyAI } from './combatFlow';
const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * Soft-lock recette (cluster bélier-porte #196-#199) — quand le DERNIER ennemi vivant meurt mais que
 * le combat CONTINUE (`victoryCondition` non authorable atteinte, ex. `destroyStructure` avec la porte
 * encore intacte), un allié IA (`aiControlled`, ex. servant du crew d'un poste d'engin de siège) n'a
 * plus AUCUNE cible (`foeKind` en face = vide) — `runEnemyAI` retournait alors SANS appeler
 * `advanceTurn` : le tour ne se termine jamais (soft-lock, reproduit en recette sur `belier-porte`).
 * Scène RÉELLE (pas une fixture synthétique) : `crewIds` du poste bélier + `brute` PNJ IA
 * (`ai:true` → `aiControlled`, `combatSlice.ts` bascule son `kind` en 'heros' car `side:'allie'`).
 */
describe('un tour IA se termine TOUJOURS, même sans adversaire vivant et combat non terminé', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); banc.setState({ battle: null }); });

  it('gobelin (dernier ennemi) mort, porte intacte : le tour du servant du bélier se clôt (advanceTurn), le combat continue', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat('siege-belier');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const gobelin = b.combatants.find((c) => c.kind === 'ennemi' && !c.inert)!;
    expect(gobelin).toBeTruthy();
    gobelin.dead = true; // dernier ennemi hors de combat — la porte, elle, reste intacte (victoryCondition non remplie)
    const servant = b.combatants.find((c) => c.aiControlled)!;
    expect(servant).toBeTruthy();
    // Donne le tour au servant.
    const turnIdx = b.order.indexOf(servant.id);
    banc.setState({ battle: { ...b, turn: turnIdx, acted: false, action: null } });
    runEnemyAI(banc.getState, banc.setState, servant.id);
    banc.reprendreLesEnAttente(); // purge tout timer de télégraphe/attaque éventuel
    const after = banc.getState().battle!;
    expect(after.over).toBeFalsy(); // le combat continue (objectif « porte abattue » non rempli)
    expect(after.turn).not.toBe(turnIdx); // le tour a bien avancé — pas de soft-lock
  });
});
