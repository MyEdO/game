// @vitest-environment jsdom
/**
 * L'ENJEU d'un jet HÔTÉ est LU par le joueur AU MOMENT OÙ IL DÉCIDE (#1117 / #1262 V2 L6c).
 *
 * KO de recette qui a produit cette mesure : scénario « Le Caveau piégé », dalle piégée — l'enjeu
 * authoré dans la scène était bien sur l'étape (`participants[0].stake.authored`), la plomberie
 * `CascadeModal` → `RollShell` → `StakeNote` existait, et pourtant AUCUNE trace de la phrase à
 * l'écran : une étape HÔTE (`jet:'test'`) est rendue par le hook de props de son `pending*`, qui ne
 * connaît pas l'étape — l'enjeu n'atteignait donc jamais la coquille.
 *
 * La phase mesurée est celle de la DÉCISION : plusieurs candidats, choix du lanceur par portrait,
 * aucun dé jeté. L'arbitrage veut l'enjeu ANNONCÉ AVANT de lancer ; une phrase qui n'apparaîtrait
 * qu'après le jet arriverait après la décision, donc trop tard.
 *
 * Montage RÉEL, du store à l'écran : `runFlow(testFlow(…))` → `openSkillTest` → étape hôte →
 * `CascadeBody`. Aucun composant simulé.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Combatant } from '../engine/types';
import { useGame } from '../state/store';
import { runFlow } from '../noyau/combatEffects';
import { testFlow } from '../noyau/monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { combatStakeRef } from '../data';
import type { StakeRef } from '../data';
import { CascadeBody } from './CascadeModal';

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 45, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

function hero(id: string, agilite = 45): Combatant {
  return {
    id, name: id, label: id, kind: 'hero',
    characteristics: { ...CHARS, agilite },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
    skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 5 }],
    talents: [], items: [], psychState: [], engagedWith: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  useGame.setState({ pendingTest: null, pendingCascade: null, party: [] });
});

/** Ouvre le Test de scène RÉEL (deux candidats → phase de CHOIX du lanceur) et monte la fenêtre. */
function ouvrir(stake?: StakeRef): HTMLDivElement {
  useGame.setState({
    battle: null, scene: null, mode: 'exploration', flags: {}, pendingTest: null, pendingCascade: null,
    suspendedCascades: [], journal: [], party: [hero('h1'), hero('h2', 25)],
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  runFlow(
    useGame.getState, useGame.setState,
    testFlow({ skill: { id: 'athletisme' }, difficulty: 'intermediaire', requireSL: 0, label: 'Esquiver les piques de la dalle', ...(stake ? { stake } : {}) }, EMPTY_FLOW, EMPTY_FLOW),
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<CascadeBody />));
  return host;
}

/** Ce que le joueur LIT dans la fenêtre, espaces normalisés. */
const ecran = (v: HTMLDivElement) => (v.textContent ?? '').replace(/\s+/g, ' ');
const occurrences = (v: HTMLDivElement, phrase: string) => ecran(v).split(phrase).length - 1;

const ENJEU = 'Se figer à temps sur la dalle : sinon les piques frappent le groupe.';

describe('enjeu d’un jet HÔTÉ — annoncé à la phase de DÉCISION (#1262 V2 L6c)', () => {
  it('la phase mesurée EST celle du choix : plusieurs candidats, aucun dé jeté', () => {
    const v = ouvrir({ authored: ENJEU });
    const pt = useGame.getState().pendingTest!;
    expect(pt.candidates!.length, 'sans plusieurs candidats, la fenêtre ne serait pas en phase de choix').toBeGreaterThan(1);
    expect(pt.roll ?? null, 'la décision se prend AVANT le jet').toBeNull();
    expect(ecran(v)).toContain('Esquiver les piques de la dalle');
  });

  it('l’enjeu AUTHORÉ par la scène est LU dans la fenêtre, une seule fois', () => {
    const v = ouvrir({ authored: ENJEU });
    expect(ecran(v), 'le joueur décide qui tente le jet sans savoir ce qu’il met en jeu').toContain(ENJEU);
    expect(occurrences(v, ENJEU), 'une phrase, une surface — jamais deux `StakeNote`').toBe(1);
  });

  it('même zone pour un enjeu de CATALOGUE (le relais ne connaît pas la provenance)', () => {
    const v = ouvrir(combatStakeRef('climbTest', { values: { metres: 4 } }));
    expect(ecran(v)).toContain('4 m de chute');
  });

  it('sans enjeu authoré, la fenêtre n’en invente aucun', () => {
    const v = ouvrir();
    expect(ecran(v)).not.toContain(ENJEU);
    expect(v.querySelector('.rm-stake')).toBeNull();
  });
});
