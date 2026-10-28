/**
 * Détermination (LDB 17 l.59) dépensée sur un Test de scène grevé d'un malus psychologique SOCIAL
 * (Animosité/Préjugé envers l'interlocuteur, LDB 21) : la dépense pose l'IMMUNITÉ à la Psychologie
 * (source unique `spendResolveForPsychImmunity`) et, sur le Test EN COURS, le malus tombe.
 *
 * Elle passe par le VERBE de flux `determine` (`FLOWS.test.caps.determine` → action `testDetermine`),
 * le même que l'étape de cascade psy — plus aucune action manuscrite parallèle (#1017 G3) : c'est ce
 * qui la rend routable par la possession (`jetOwnedIntents`) et donc jouable par le siège du testeur
 * en coop.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import type { PendingTest } from '../noyau/pendings';
import { isPsychImmune } from '../engine/psychology';
import { socialPsychMod, socialPsychLabel } from '../engine/skills';
import { ciblePsy } from '../engine/psych/ciblage';

const mk = (id: string, resolve: number): Combatant =>
  ({
    id, name: id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 45 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [], resolve,
  } as unknown as Combatant);

/** Test social OUVERT avec Animosité (−20) : le malus est DÉJÀ intégré à `skillValue` ET `target`
 *  (cf. `PendingTest.psychMod`), et conservé à part pour l'affichage. */
const pending = (): PendingTest =>
  ({
    actorId: 'h1', label: 'Convaincre', skill: 'Charme', skillId: 'charme',
    skillValue: 25, target: 25, difficulty: 'intermediaire', requireSL: 0,
    psychMod: -20, psychDetail: 'Animosité −20 envers Elfe',
    roll: null, success: false, sl: 0,
  } as unknown as PendingTest);

/** Le même héros, porteur d'une Animosité CIBLÉE (LDB 21) — c'est ce trait qui produit le −20 des
 *  Tests sociaux envers ce groupe, calculé par `socialPsychMod` (siège unique). */
const avecAnimosite = (resolve: number): Combatant =>
  ({ ...mk('h1', resolve), psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] } as unknown as Combatant);

describe('Test de scène — Détermination contre un malus psy social (LDB 17 l.59)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingTest: null }); });

  it('dépense 1 Détermination et RETIRE le malus de la valeur ET de la cible', () => {
    useGame.setState({ party: [mk('h1', 2)], pendingTest: pending() });
    useGame.getState().testDetermine();
    const pt = useGame.getState().pendingTest!;
    expect(pt.skillValue).toBe(45);
    expect(pt.target).toBe(45);
    expect(pt.psychMod).toBe(0);
    expect(pt.psychDetail).toBeUndefined();
    expect(useGame.getState().party[0].resolve).toBe(1);
  });

  /** RAW LDB 17 l.59 : « Demeurer immunisé à *Psychologie* jusqu'à la fin du prochain Round. » La
   *  durée est portée par un `ActiveEffect` de 2 Rounds (même mécanique que la Détermination de combat,
   *  `spendResolveForPsychImmunity`) ; l'immunité se lit par `isPsychImmune`, jamais par-nom. */
  it('pose l’IMMUNITÉ à la Psychologie (pas seulement la levée du malus du Test courant)', () => {
    useGame.setState({ party: [mk('h1', 2)], pendingTest: pending() });
    expect(isPsychImmune(useGame.getState().party[0]), 'précondition : pas immunisé avant la dépense').toBe(false);
    useGame.getState().testDetermine();
    const hero = useGame.getState().party[0];
    expect(isPsychImmune(hero), 'immunisé à la Psychologie après la dépense').toBe(true);
    const eff = (hero.activeEffects ?? []).find((e) => e.psychImmune);
    expect(eff?.duration, 'durée portée en Rounds (fin du prochain Round)').toEqual({ scale: 'rounds', left: 2 });
  });

  /**
   * RAW LDB 17 l.59 : l'immunité vaut « jusqu'à la fin du prochain Round » — donc pour TOUS les Tests
   * de sa fenêtre, pas seulement celui qu'on avait sous les yeux. Le malus social se calcule au SIÈGE
   * UNIQUE `socialPsychMod` (`engine/skills`, consommé par `openSkillTest` pour poser `psychMod`) :
   * c'est LÀ que l'immunité se lit, sinon le Test SUIVANT re-facturerait un point de Détermination.
   */
  it('le Test social SUIVANT de la fenêtre n’a plus le malus — sans nouvelle dépense', () => {
    useGame.setState({ party: [avecAnimosite(2)], pendingTest: pending() });
    expect(socialPsychMod(useGame.getState().party[0], ['elfe']), 'précondition : Animosité −20 envers Elfe').toBe(-20);
    useGame.getState().testDetermine();
    const hero = useGame.getState().party[0];
    expect(socialPsychMod(hero, ['elfe']), 'Test SUIVANT ouvert dans la fenêtre : plus de malus').toBe(0);
    expect(socialPsychLabel(hero, ['elfe']), 'et plus d’étiquette de malus à afficher').toBeUndefined();
    expect(hero.resolve, 'un seul point dépensé pour toute la fenêtre').toBe(1);
  });

  it('sans point de Détermination : aucun effet (ni sur le Test, ni sur la réserve)', () => {
    useGame.setState({ party: [mk('h1', 0)], pendingTest: pending() });
    useGame.getState().testDetermine();
    const pt = useGame.getState().pendingTest!;
    expect(pt.skillValue).toBe(25);
    expect(pt.psychMod).toBe(-20);
    expect(useGame.getState().party[0].resolve).toBe(0);
    expect(isPsychImmune(useGame.getState().party[0]), 'aucune immunité gratuite').toBe(false);
  });

  it('APRÈS le jet : refusé (le malus a déjà pesé sur le dé)', () => {
    useGame.setState({ party: [mk('h1', 2)], pendingTest: { ...pending(), roll: 30, success: false, sl: -1 } as PendingTest });
    useGame.getState().testDetermine();
    expect(useGame.getState().pendingTest!.skillValue).toBe(25);
    expect(useGame.getState().party[0].resolve).toBe(2);
  });

  it('sans malus psy : rien à ignorer, la réserve n’est pas entamée', () => {
    useGame.setState({ party: [mk('h1', 2)], pendingTest: { ...pending(), skillValue: 45, target: 45, psychMod: 0, psychDetail: undefined } as PendingTest });
    useGame.getState().testDetermine();
    expect(useGame.getState().party[0].resolve).toBe(2);
  });
});
