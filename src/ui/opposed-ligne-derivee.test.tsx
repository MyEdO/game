// @vitest-environment jsdom
/**
 * LA LIGNE ADVERSE SE DÉRIVE AU RENDU (#1279) — un flux qui fige le jet d'un adversaire DÉCLARE ce
 * qu'il teste (`meta.opposed.test`, une STRUCTURE d'ids), et c'est le rendu qui en écrit le libellé
 * (`testSkillLabel`, catalogue). Mesuré AVANT ce lot : le flux de taverne composait la chaîne
 * lui-même (`attackerLabel: testSkillLabel(test)`) — l'affichage était tranché au flux.
 *
 * Monté POUR DE VRAI (`CascadeBody`, patron `SequencePanel.test.tsx`) sur une partie réelle contre un
 * adversaire de la salle : c'est la fenêtre que le joueur voit qui est mesurée, pas un ctx forgé.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from '../state/battleRng';
import { CascadeBody } from './CascadeModal';
import { frozenOpposedBatchStep } from '../state/combat/triggeredTest';
import { findQualityById } from '../data';
import { EMPTY_FLOW } from '../state/flow';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
const get = useGame.getState.bind(useGame);
const texte = () => host.textContent ?? '';

beforeEach(() => {
  seedBattleRng(3);
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, sequence: null, tavernGames: null } as never);
});

describe('Test opposé à jet figé — le flux DÉCLARE, le rendu ÉCRIT', () => {
  it('taverne contre la salle : la fenêtre lit « <adversaire> — Pari », dérivé de la STRUCTURE', () => {
    const [a] = makePregens().slice(0, 1) as [Combatant];
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });

    const opp = get().pendingCascade!.participants[0].meta!.opposed!;
    expect(opp.test, 'le flux fige la STRUCTURE du Test adverse').toEqual({ skill: 'pari' });
    expect(opp.attackerLabel, 'et ne compose AUCUN libellé : l’affichage ne lui appartient pas').toBeUndefined();

    act(() => { root.render(<CascadeBody />); });
    expect(texte(), 'le rendu compose la ligne depuis {attackerName, test}').toContain(`${opp.attackerName} — Pari`);
  });

  /**
   * LE JOURNAL de la manche MONO/ÉTENDUE nomme les DEUX camps, par la MÊME dérivation que la rangée
   * (`opposedAttackerLabel`, source unique). Mesuré AVANT : la manche se racontait par un libellé nu
   * (« Force : -4 DR. ») — ni le joueur, ni son vis-à-vis, ni ce que chacun avait obtenu ne s'y
   * lisaient, et une partie gagnée était indistinguable d'une partie perdue.
   */
  it('JOURNAL de la manche mono : les DEUX camps sont NOMMÉS, avec leur Test', () => {
    seedBattleRng(4);
    const [a] = makePregens().slice(0, 1) as [Combatant];
    useGame.setState({ party: [a], journal: [] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const step = get().pendingCascade!.participants[0];
    const opp = step.meta!.opposed!;
    act(() => { get().cascadeRoll(step.id); });
    act(() => { get().cascadeNext(); });

    const journal = get().journal.join('\n');
    expect(journal, 'le challenger est nommé, avec son Test').toContain(`${a.label} — Pari :`);
    expect(journal, 'et l’adversaire aussi, dérivé de la MÊME structure').toContain(`${opp.attackerName} — Pari :`);
  });

  /**
   * L'ALTERNATIVE AUTHORÉE passe AVANT la dérivation, et c'est mesuré sur le gel RÉELLEMENT produit
   * par le flux (`frozenOpposedBatchStep`) à partir de la donnée réelle : la Déstabilisante
   * (`qualities.json`) déclare « Force/Athlétisme » — deux Compétences au choix, qu'aucune structure
   * n'exprime. Dériver d'abord écrirait « Athlétisme » et PERDRAIT la moitié de la règle : c'est la
   * régression que ce cas verrouille.
   */
  it('alternative AUTHORÉE : la fenêtre écrit « Force/Athlétisme », jamais la dérivation seule', () => {
    const [a, b] = makePregens().slice(0, 2) as [Combatant, Combatant];
    useGame.setState({ party: [a, b] });
    const eff = findQualityById('destabilisante')!.effects![0];
    const choix = eff.flow;
    if (choix?.kind !== 'choice' || choix.yes.kind !== 'test') throw new Error('la donnée de la Déstabilisante doit porter un choix → Test');
    const ft = choix.yes.test;
    const aT = { roll: 42, target: 55, base: 55, sl: 1, success: true, isDouble: false };
    const step = frozenOpposedBatchStep([a], ft, { onSuccess: EMPTY_FLOW, onFail: EMPTY_FLOW }, EMPTY_FLOW, 'intermediaire', b, aT)!;
    expect(step, 'le producteur réel monte bien la bande opposée').toBeTruthy();
    expect(step.meta!.opposed!.attackerLabel, 'l’alternative authorée voyage telle quelle').toBe('Force/Athlétisme');

    act(() => {
      useGame.setState({ pendingCascade: { title: 'Déstabilisante', purpose: 'combat', participants: [step], cursor: 0, log: [] } });
      root.render(<CascadeBody />);
    });
    expect(texte()).toContain(`${b.label} — Force/Athlétisme`);
    expect(texte(), 'la dérivation seule aurait perdu la moitié de la règle').not.toContain(`${b.label} — Athlétisme`);
  });
});
