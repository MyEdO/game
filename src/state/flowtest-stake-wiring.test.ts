import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from '../noyau/combatEffects';
import { testFlow } from '../noyau/monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { combatStakeRef, resolveStake, findSpellById } from '../data';
import { routeTriggeredTest } from '../noyau/combat/triggeredTest';
import { planClimb } from '../noyau/monde/climbMove';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import type { Combatant } from '../engine/types';
import { desDuTest } from '../engine/dice.testkit';

/**
 * CÂBLAGE de l'ENJEU sur la voie `runFlow` (#1117) — la SECONDE porte d'un `FlowTest`, à côté de
 * `runCombatFlow` : `openSkillTest` (`combatEffects.ts`) bâtit lui-même l'étape qui lance, donc c'est
 * LUI qui doit faire descendre `FlowTest.stake` jusqu'à elle. Sans ce transport, un enjeu authoré au
 * site est une donnée MORTE : le cliquet le voit posé, le joueur ne le lit jamais.
 *
 * Mesuré sur le CHEMIN RÉEL : `runFlow` → `openSkillTest` → `pendingCascade.steps[0]`, l'étape que
 * `CascadeModal` rend (`cur.stake` → `StakeNote`/`StakeRule`), et le texte est celui que `resolveStake`
 * produit — trous remplis par les valeurs du producteur.
 */
const hero = (): Combatant => ({
  id: 'h1', name: 'Grimpeur', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 40, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
  skills: [{ id: 'escalade', characteristic: 'force', advances: 0 }], talents: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
} as unknown as Combatant);

/** Falaise de 4 m (patron `climbMove.test.ts`) : pied en (2,1) à 0 m, sommet (2,0) à 4 m, arête N
 *  grimpable en `surface` — la hauteur RÉELLE du décor fait l'enjeu. */
function cliff(): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const h = new Array(4 * 4).fill(0) as number[];
  h[0 * 4 + 2] = 4;
  s.layers[0].height = h;
  s.walls = [{ x: 2, y: 1, side: 'N', climb: { kind: 'surface' } }];
  return s;
}

/** L'étape qui LANCE d'une cascade fraîche (`startCascade` la pose en `participants[0]`). */
const firstStep = () => useGame.getState().pendingCascade!.participants[0];

describe('l’enjeu d’un `FlowTest` DESCEND jusqu’à l’étape qui lance, voie `runFlow` (#1117)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingTest: null, pendingCascade: null, party: [hero()] }); });

  it('`openSkillTest` transporte `spec.stake` jusqu’à l’étape de la cascade', () => {
    const stake = combatStakeRef('climbTest', { values: { metres: 4 } });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'escalade' }, stake, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const step = firstStep();
    expect(step.stake, 'étape muette : le joueur ne saurait pas ce que ce jet met en jeu').toEqual(stake);
    expect(resolveStake(step.stake!).text).toContain('4 m de chute');
    expect(resolveStake(step.stake!).rule).toEqual({ category: 'regles', id: 'chute' });
  });

  it('sans enjeu déclaré NI porteur, l’étape reste sans `stake` (le transport n’en invente pas)', () => {
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'escalade' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(firstStep().stake).toBeUndefined();
  });

  /**
   * LES DEUX ÉTAGES du contrat (#1262 V2 L6d, arbitrage user 2026-08-12 : « Le socle dérive l'enjeu de
   * l'entité porteuse […]. Un auteur PEUT toujours surcharger par un texte authoré. ») — mesurés sur le
   * CHEMIN RÉEL du Test déclenché (`routeTriggeredTest` → l'étape qui lance), pas sur la fonction pure :
   *  · étage 2 — un `FlowTest` de DONNÉE, muet, exigé par une entité : l'étape dit « ce qui se joue »
   *    en NOMMANT cette entité, et son renvoi Codex vise SA fiche ;
   *  · étage 1 — le même jet, déclaré : l'enjeu déclaré PRIME, le porteur ne le recouvre pas.
   */
  it('étage 2 : un jet MUET exigé par une entité DÉRIVE son enjeu du porteur, jusqu’à l’étape', () => {
    routeTriggeredTest(useGame.getState, useGame.setState, useGame.getState().party[0], useGame.getState().party[0],
      testFlow({ skill: { id: 'escalade' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW), { rng: desDuTest, source: { kind: 'spell', id: 'chute' } });
    const stake = firstStep().stake;
    expect(stake, 'jet muet : le porteur n’a pas été lu').toBeTruthy();
    const resolu = resolveStake(stake!);
    expect(resolu.text, 'l’enjeu doit NOMMER l’entité porteuse').toContain(findSpellById('chute')!.label);
    expect(resolu.rule, 'le renvoi Codex vise la fiche de l’entité').toEqual({ category: 'spells', id: 'chute' });
  });

  it('étage 1 : l’enjeu DÉCLARÉ prime — la dérivation ne recouvre jamais l’auteur', () => {
    const stake = combatStakeRef('climbTest', { values: { metres: 4 } });
    routeTriggeredTest(useGame.getState, useGame.setState, useGame.getState().party[0], useGame.getState().party[0],
      testFlow({ skill: { id: 'escalade' }, stake, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW), { rng: desDuTest, source: { kind: 'spell', id: 'chute' } });
    expect(firstStep().stake).toEqual(stake);
  });

  /**
   * ENJEU AUTHORÉ (#1262 V2 L6c, arbitrage user 2026-08-12) — la forme que porte un Flow de DOCUMENT :
   * le texte voyage avec la scène, et il descend par le MÊME transport que la référence de dataset,
   * jusqu'à la MÊME zone de la fenêtre (`resolveStake`, porte unique). Le transport n'invente toujours
   * rien : ce qui s'affiche est mot pour mot ce que l'auteur a écrit.
   */
  it('un enjeu AUTHORÉ par le document descend jusqu’à l’étape et se résout tel qu’écrit', () => {
    const stake = { authored: 'Franchir la corniche sans tomber : sinon la chute, et l’alerte donnée.' };
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'escalade' }, stake, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const step = firstStep();
    expect(step.stake).toEqual(stake);
    expect(resolveStake(step.stake!).text).toBe(stake.authored);
    expect(resolveStake(step.stake!).rule, 'un document ne renvoie à aucune fiche Codex').toBeUndefined();
  });

  it('FAIL-CLOSED : un enjeu authoré VIDE jette au lieu d’afficher un blanc', () => {
    expect(() => resolveStake({ authored: '   ' })).toThrow(/enjeu vide/);
  });

  it('bout en bout : le plan d’ESCALADE joué par `runFlow` porte l’enjeu de SA hauteur', () => {
    const plan = planClimb(cliff(), { x: 2, y: 1 }, { x: 2, y: 0 }, false);
    expect(plan?.kind, 'la falaise doit produire un plan à Test (sinon la sonde ne mesure rien)').toBe('test');
    if (plan?.kind !== 'test') throw new Error('attendu test');
    runFlow(useGame.getState, useGame.setState, plan.flow);
    expect(resolveStake(firstStep().stake!).text).toContain('4 m de chute'); // hauteur RÉELLE du décor
  });
});
