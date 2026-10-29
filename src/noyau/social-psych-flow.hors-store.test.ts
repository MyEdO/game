import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runFlow } from './combatEffects';
import { testFlow } from './monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { createHero } from '../engine/character';
import { adresseDeCreation } from '../engine/adresseDeCreation';
import { ciblePsy } from '../engine/psych/ciblage';
import type { PsychTrait } from '../engine/psychology';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Humains (Reiklander), « Affable *ou* Perspicace » (LDB 05 l.490) : Perspicace, la Sociabilité reste nue. */
const PERSPICACE = { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } };

describe('Test de Sociabilité vs groupe haï (dialogue) — malus psy appliqué (LDB 21, P3)', () => {
  beforeEach(() => {
    banc.setState({ pendingTest: null, battle: null });
  });

  function hero(name: string, soc: number, traits: PsychTrait[] = []) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: name, seed: 1, speciesTalentChoices: PERSPICACE });
    h.characteristics.sociabilite = soc;
    h.skills = []; // pas d'avances → testValue = Soc brut
    h.psychTraits = traits;
    return h;
  }

  it('un Test de Charme vs « Elfes » : le PJ haineux subit −20, target réduite', () => {
    const a = hero('Gotrek', 50, [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }]);
    banc.setState({ party: [a] });
    runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'charme' }, difficulty: 'intermediaire', vsGroups: ['elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = banc.getState().pendingTest!;
    expect(pt.actorId).toBe(a.id);
    expect(pt.skillValue).toBe(30); // 50 − 20 (Animosité)
    expect(pt.target).toBe(30); // Intermédiaire +0
    expect(pt.psychMod).toBe(-20);
    expect(pt.psychDetail).toBe('Animosité −20 envers Elfe'); // libellé lisible (finding #5)
  });

  it('choisit le meilleur PJ EFFECTIF (malus intégré au choix)', () => {
    const haineux = hero('Gotrek', 50, [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }]); // 50 − 20 = 30
    const neutre = hero('Felix', 40); // 40, pas de malus
    banc.setState({ party: [haineux, neutre] });
    runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'charme' }, vsGroups: ['elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = banc.getState().pendingTest!;
    expect(pt.actorId).toBe(neutre.id); // Felix (40) > Gotrek (30 après malus)
    expect(pt.psychMod ?? 0).toBe(0); // l'acteur choisi n'a pas de malus
  });

  it('Test NON-social (Force) vs un groupe → aucun malus psy', () => {
    const a = hero('Gotrek', 50, [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }]);
    banc.setState({ party: [a] });
    runFlow(banc.getState, banc.setState, testFlow({ characteristic: 'force', vsGroups: ['elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = banc.getState().pendingTest!;
    expect(pt.psychMod ?? 0).toBe(0); // F n'est pas un Test de Sociabilité
  });

  it('Animosité ACTIVE (Test de Psy échoué) → pas de malus social « contenu » (compulsion, LDB 21 l.21)', () => {
    const a = hero('Gotrek', 50, [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }]);
    a.psychState = [{ type: 'animosite', cible: ciblePsy.groupe('elfe'), active: true }]; // état actif (échec)
    banc.setState({ party: [a] });
    runFlow(banc.getState, banc.setState, testFlow({ skill: { id: 'charme' }, vsGroups: ['elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = banc.getState().pendingTest!;
    expect(pt.psychMod ?? 0).toBe(0); // actif → compulsion, pas le −20 contenu
    expect(pt.skillValue).toBe(50);
  });
});
