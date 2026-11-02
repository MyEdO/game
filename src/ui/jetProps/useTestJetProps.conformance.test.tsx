// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { Combatant } from '../../engine/types';
import { useGame } from '../../state/store';
import { runFlow } from '../../noyau/combatEffects';
import { testFlow } from '../../noyau/monde/flow';
import { EMPTY_FLOW } from '../../engine/flowCore';
import type { TravelPlan } from '../../noyau/travelFlow';
import { RollShell } from '../RollShell';
import { useTestJetProps } from './useTestJetProps';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * ÉCRAN du Test de compétence de scène (store → `openSkillTest` → `useTestJetProps` → `RollShell`).
 *
 * Ce que la mesure verrouille : les modificateurs qui ont fait la CIBLE sont ceux qui s'AFFICHENT,
 * parce que le pending TRANSPORTE la ligne montée (`PendingTest.base`/`.mods`, posée par le monteur
 * `rollSeam.rollStep`). Le corollaire est la seconde mesure : privé de cette ligne, l'écran ne montre
 * AUCUNE chip — il ne re-dérive rien. Une décomposition d'affichage parallèle pourrait annoncer une
 * autre famille, une autre fiche, ou un autre nombre que celui qui a servi au jet.
 */

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 45, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

function hero(id: string, over: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, name: id, label: id, kind: 'hero',
    characteristics: { ...CHARS },
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4,
    skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 5 }],
    talents: [], items: [], psychState: [], engagedWith: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as unknown as Combatant;
}

const seaPlan = (): TravelPlan => ({
  routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 8, km: 100, kmDone: 0,
  sea: {
    heading: 'ouest', windFrom: 'ouest', daysToEvent: 5, daysAtSea: 0, step: 'meteo', lines: [], milesToday: 0,
    weather: { precipitations: 'abondantes', temperature: 'mediane', visibilite: 'degage', vent: 'brise-fraiche' },
  },
} as unknown as TravelPlan);

function Probe() {
  const props = useTestJetProps();
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** Ouvre le Test RÉEL (météo maritime active, un soutien capable), puis monte l'écran. */
function renderTest(opts: { sansLigneMontee?: boolean } = {}): HTMLDivElement {
  const h1 = hero('h1', { conditions: [{ id: 'extenue', value: 1 }] } as unknown as Partial<Combatant>);
  const h2 = hero('h2', { characteristics: { ...CHARS, agilite: 25 } } as unknown as Partial<Combatant>);
  useGame.setState({
    battle: null, scene: null, mode: 'exploration', flags: {}, pendingTest: null, pendingCascade: null,
    party: [h1, h2], travelPlan: seaPlan(),
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, difficulty: 'intermediaire', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
  if (opts.sansLigneMontee) {
    // MUTATION : le pending ARRIVE sans sa ligne montée (producteur qui ne la pose pas). L'écran doit
    // rester MUET sur les modificateurs — jamais les reconstruire depuis la valeur.
    const pt = useGame.getState().pendingTest!;
    useGame.setState({ pendingTest: { ...pt, base: undefined, mods: undefined } });
  }
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

const ligne = (v: HTMLDivElement) => v.querySelector('.rm-roll-block') as HTMLElement;
const chips = (v: HTMLDivElement) => Array.from(ligne(v).querySelectorAll('.rm-mod')).map((c) => c.textContent ?? '');

describe('Test de scène — l’écran REND la ligne montée, il ne la recompose pas (#1153 L2’)', () => {
  it('les modificateurs de la cible sont VISIBLES, un par source, avec leur fiche de règle', () => {
    const v = renderTest();
    const txt = chips(v).join(' | ');
    expect(txt).toContain('Soutien');
    expect(txt).toContain('Exténué');
    expect(txt).toContain('Abondantes'); // météo maritime (MDG 13), émise avec sa fiche
    // Chaque chip est une affordance de règle (`CodexRef` porte la classe `rm-mod`) — la fiche vient
    // de l'ÉMISSION : une chip sans renvoi serait un modificateur dont la règle n'est pas atteignable.
    expect(ligne(v).querySelectorAll('.rm-mod.codex-ref').length).toBe(chips(v).length);
  });

  it('la base affichée est le Niveau de Compétence NU, et base + Σ mods + Difficulté === cible', () => {
    const v = renderTest();
    const pt = useGame.getState().pendingTest!;
    expect(pt.base).toBe(50); // Ag 45 + 5 avances (l'État et le Soutien sont des lignes)
    expect(ligne(v).textContent).toContain('50');
    expect(pt.base! + pt.mods!.reduce((s, m) => s + m.value, 0)).toBe(pt.target);
  });

  it('MUTATION — pending SANS ligne montée : AUCUNE chip, aucune re-dérivation d’affichage', () => {
    const v = renderTest({ sansLigneMontee: true });
    expect(chips(v)).toEqual([]);
    expect(ligne(v).textContent).not.toContain('Soutien');
    expect(ligne(v).textContent).not.toContain('Abondantes');
  });
});
