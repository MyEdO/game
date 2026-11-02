// @vitest-environment jsdom
/**
 * Comportement RÉEL (clic) du tableau de bord État, en complément des tests SSR (`EtatPanel.test.tsx`,
 * `renderToStaticMarkup` — aucun clic). Contrats : le clic sur une affliction codex-liée OUVRE la
 * fiche Codex (les afflictions ne sont plus `tooltipOnly` — bug récurrent user : le clic ne rouvrait
 * pas le Codex), et le titre de bande ouvre la CATÉGORIE. Patron réel du repo pour les tests
 * clic/clavier interactifs (`createRoot`/`act`/`dispatchEvent` — `@testing-library` n'est PAS une
 * dépendance, cf. `career-talent-roving.test.tsx`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Combatant } from '../engine/types';
import { EtatPanel } from './EtatPanel';
import { ETAT_ANCHOR_CRITIQUES } from './sheetAlarms';
import { useGame } from '../state/store';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = blessuresSurLeProfil({
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12),
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    conditions: [{ id: 'assourdi', value: 1 } as never],
    skills: [],
    talents: [],
    movement: 4,
    items: [],
  }) as unknown as Combatant;
  mut?.(c);
  return c;
};

describe('EtatPanel — comportement clic (LOT L pt.3)', () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount() {
    useGame.setState({ codexOverlay: null, screen: 'menu' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<EtatPanel hero={mkHero()} />); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ codexOverlay: null, screen: 'menu' });
  });

  it('3(a) — les ids etat-* du DOM existent (absence de la rubrique Critiques, présence de la rubrique États actives) : ne vérifie QUE l’existence, pas le comportement de clic (couvert par 3(b)/2 ci-dessous)', () => {
    mount();
    // `ETAT_ANCHOR_CRITIQUES` = MÊME constante que consomme `sheetAlarms()` — l'ancre cliquée par
    // la bande d'alarmes doit exister sur CETTE bande de section (pas de dérive post-refonte LOT K).
    expect(document.getElementById(ETAT_ANCHOR_CRITIQUES)).toBeNull(); // pas de critique ici (héros sain de critiques)
    expect(document.getElementById('etat-etats')).not.toBeNull();
  });

  it('3(b) — clic sur une chip d’État OUVRE la fiche Codex sur SON entrée (bug récurrent : le clic ne rouvrait pas le Codex, corrigé en retirant tooltipOnly des afflictions)', () => {
    mount();
    const trigger = container.querySelector('#etat-etats .codex-ref') as HTMLElement;
    expect(trigger).not.toBeNull();
    // Affliction NON tooltipOnly : c'est l'élément interactif (role button), pas une épingle de popover.
    expect(trigger.getAttribute('role')).toBe('button');
    expect(trigger.getAttribute('aria-expanded')).toBeNull();
    expect(useGame.getState().codexOverlay).toBeNull();
    act(() => { trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    // Store OBSERVÉ : le clic pose `codexOverlay` sur l'entrée `etats`/`assourdi` (fiche réelle).
    const ov = useGame.getState().codexOverlay;
    expect(ov?.category).toBe('etats');
    expect(ov?.id).toBe('assourdi');
  });

  it('2 — « Effets actifs » est une bande MIXTE (États + buffs de sort + contrecoups) : son TITRE n’est PAS un lien Codex (catégorie unique fausse) — seules les chips portent leur lien codex individuel (3(b))', () => {
    mount();
    // Section hétérogène : aucune catégorie unique ne décrit un buff de sort → pas de titre-lien
    // (`codexCategory` omis, cf. doc de `Section`). Le titre reste un libellé simple, pas un bouton.
    const titleBtn = container.querySelector('#etat-etats .creator-band-title-link');
    expect(titleBtn).toBeNull();
    expect(container.querySelector('#etat-etats')?.textContent).toContain('Effets actifs');
  });
});
