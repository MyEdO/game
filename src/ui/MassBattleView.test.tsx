// @vitest-environment jsdom
/**
 * CONTRAT de l'affectation en BATAILLE DE MASSE (ADE II 8 l.116-118 : « les Personnages peuvent
 * choisir de participer à l'une des Scènes »).
 *
 * L'écran compose la MÊME case d'affectation que les rosters de postes (`AssignRow`) : il en hérite
 * donc les mêmes règles, et c'est ce que ce contrat verrouille — la primitive ne peut pas les tenir
 * ici et les perdre ailleurs.
 *  (1) une Scène SANS PJ affecté ne porte AUCUN MOT (arbitrage user 2026-08-24) : ni « Aucun PJ
 *      affecté », ni un texte d'invite — il reste l'affordance d'ajout et son nom accessible ;
 *  (2) l'ajout est un PANNEAU-PARAMÈTRE borné, ancré, aux candidats RÉELS (jamais une liste dépliée
 *      en permanence, jamais un second mécanisme de choix) ;
 *  (3) le portrait affecté se retire au clic, et il porte son geste dans l'arbre d'accessibilité ;
 *  (4) une Scène FIGÉE (Round résolu / attente) n'offre plus d'ajout.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useGame } from '../state/store';
import { seedBattleRng } from '../state/battleRng';
import { scenario } from '../scenes/test-scenarios/13-bataille-de-masse';
import { MassBattleView } from './MassBattleView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

/** Amorce la VRAIE bataille du scénario de test (même spec, même scène : les Scènes du Round sont
 *  posées sur le plan par leurs ancres authorées), par la porte du jeu `startMassBattle`. */
beforeEach(() => {
  seedBattleRng(1234);
  const { party, scene, massBattle } = scenario.construire();
  useGame.setState({
    party, scene, battle: null, interlude: null,
    journal: [], partyPos: { x: 3, y: 8 },
  });
  useGame.getState().startMassBattle(massBattle!);
});

/** Monte l'écran ET sélectionne une Scène sur le plan : son détail (donc sa case) s'ouvre à droite.
 *  Une puce non sélectionnée n'affiche aucun détail — c'est un maître-détail, pas une liste plate. */
function monter(): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(<MassBattleView />); });
  const puces = [...container.querySelectorAll('.poste-chips .chip')] as HTMLElement[];
  for (const p of puces) {
    act(() => { p.click(); });
    if (container!.querySelector('.pr-cases')) break;
  }
  return container;
}

/** Les cases d'affectation de l'écran (une par Scène NON combat). */
const cases = (el: HTMLElement) => [...el.querySelectorAll('.pr-cases')] as HTMLElement[];
const premierAjout = (el: HTMLElement) => el.querySelector('.pr-cases .pr-add') as HTMLButtonElement | null;

describe('MassBattleView — affectation aux Scènes (ADE II 8)', () => {
  it('1. une Scène sans PJ affecté ne porte AUCUN MOT dans sa case', () => {
    const el = monter();
    expect(cases(el).length, 'au moins une Scène offre l’affectation').toBeGreaterThan(0);
    for (const c of cases(el)) {
      const portraits = c.querySelectorAll('.ptile').length;
      if (portraits > 0) continue;
      expect(c.textContent?.trim(), 'ni « Aucun PJ affecté », ni invite').toBe('');
    }
    // La phrase d'invite ne revient par AUCUN chemin.
    expect(el.textContent).not.toMatch(/Aucun PJ affecté|choisissez qui/i);
  });

  it('2. le [+] porte un nom accessible et ouvre un PANNEAU-PARAMÈTRE borné aux candidats réels', () => {
    const el = monter();
    const add = premierAjout(el)!;
    expect(add, 'l’affordance d’ajout est là').toBeTruthy();
    expect(add.textContent?.trim(), 'muette à l’écran').toBe('');
    expect(add.getAttribute('aria-label'), 'mais nommée dans l’arbre a11y').toMatch(/: affecter un Personnage$/);
    act(() => { add.click(); });
    const panneau = document.querySelector('[data-panneau-parametre]') as HTMLElement;
    expect(panneau, 'un seul mécanisme de choix borné dans le dépôt').toBeTruthy();
    expect(panneau.getAttribute('aria-label')).toBe(add.getAttribute('aria-label'));
    // Les candidats sont les HÉROS du groupe, montrés en portraits — pas une liste de mots.
    const noms = [...panneau.querySelectorAll('button')].map((b) => b.textContent ?? '');
    for (const h of useGame.getState().party) expect(noms.join(' | '), h.label).toContain(h.label);
    expect(panneau.querySelectorAll('.ptile').length, 'chaque candidat porte son portrait').toBe(noms.length);
    expect(panneau.querySelectorAll('button button').length, 'aucun bouton imbriqué').toBe(0);
  });

  it('3. choisir AFFECTE le héros à la Scène ; son portrait s’y retire au clic', () => {
    const el = monter();
    act(() => { premierAjout(el)!.click(); });
    const premier = useGame.getState().party[0];
    const btn = [...document.querySelectorAll('[data-panneau-parametre] button')]
      .find((b) => b.textContent?.includes(premier.label)) as HTMLButtonElement;
    act(() => { btn.click(); });

    const posted = () => Object.values(useGame.getState().massBattle?.assignment ?? {}).flat();
    expect(posted(), 'le héros est POSTÉ sur une Scène').toContain(premier.id);

    const portrait = [...el.querySelectorAll('.pr-cases .ptile')]
      .find((p) => p.getAttribute('aria-label')?.includes(premier.label)) as HTMLButtonElement;
    expect(portrait, 'le portrait est DANS la case de la Scène').toBeTruthy();
    expect(portrait.getAttribute('aria-label')).toMatch(new RegExp(`^Retirer ${premier.label} de `));
    act(() => { portrait.click(); });
    expect(posted(), 'le clic le retire').not.toContain(premier.id);
  });

  it('4. Scène FIGÉE (attente de la suite) : les portraits restent, l’ajout disparaît', () => {
    const el = monter();
    expect(premierAjout(el), 'ouvert tant que le Round se joue').toBeTruthy();
    act(() => { useGame.setState({ massBattle: { ...useGame.getState().massBattle!, awaitingNext: true } }); });
    expect(premierAjout(el), 'figé : plus d’ajout offert').toBeNull();
  });
});
