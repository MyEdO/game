// @vitest-environment jsdom
/**
 * Ouverture cérémonielle (#717) — contrats POSITIFS du rendu : le pitch passe par `<Prose>` (donnée
 * VERBATIM, jamais du texte en dur), la compagnie est une rangée de tuiles-figurines STATIQUES (pas
 * un picker), l'ambiance par défaut est la veillée, et « Prendre la route » borne le chapitre.
 *
 * Rendu CLIENT (`createRoot`) et non `renderToStaticMarkup` : en SSR, zustand sert l'état INITIAL
 * (`getServerState || getInitialState`, zustand/esm/index.mjs) — un écran piloté par le store y
 * rendrait toujours son cas vide, et le test ne prouverait rien.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CampaignOpeningScreen } from './CampaignOpeningScreen';
import { useGame } from '../state/store';
import type { OuvertureBlock } from '../data/schemas/defs-scenes/narratif';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string): Combatant {
  return {
    id, label, kind: 'hero', career: 'repurgateur',
    characteristics: {} as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
}

const ouverture: OuvertureBlock = {
  surtitre: 'Une campagne pour Warhammer Fantasy Roleplay',
  titre: 'L’Ennemi Intérieur',
  chapitre: 'Chapitre 1 — On recherche : aventuriers courageux',
  pitch: 'Nos héros forment un **groupe hétéroclite**.',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGame.setState({ pendingOuverture: ouverture, party: [hero('h1', 'Magnus'), hero('h2', 'Elsbeth')] });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useGame.setState({ pendingOuverture: null, party: [], chapitreDepuis: null, net: { ...useGame.getState().net, mode: 'local', mySeat: 0 } });
});

async function mount() {
  await act(async () => { root.render(<CampaignOpeningScreen />); });
}

describe('CampaignOpeningScreen (#717)', () => {
  it('rend le titre, le surtitre, le chapitre et le pitch en Markdown (primitive `Prose`)', async () => {
    await mount();
    const txt = container.textContent ?? '';
    expect(txt).toContain('L’Ennemi Intérieur');
    expect(txt).toContain('Une campagne pour Warhammer Fantasy Roleplay');
    expect(txt).toContain('Chapitre 1 — On recherche : aventuriers courageux');
    expect(container.querySelector('.parchment-card strong')?.textContent).toBe('groupe hétéroclite'); // Markdown RENDU
    expect(container.querySelector('.parchment-card .wax-seal')).not.toBeNull(); // sceau de CIRE (aucun tirage)
    expect(container.querySelector('.parchment-seal')).toBeNull(); // ni médaillon d100
  });

  it('rend UNE tuile-figurine par héros, en STATIQUE (aucune sémantique de picker)', async () => {
    await mount();
    const tuiles = container.querySelectorAll('.fig-row .fig-tile');
    expect(tuiles).toHaveLength(2);
    expect([...tuiles].map((t) => t.tagName)).toEqual(['DIV', 'DIV']);
    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(container.textContent).toContain('Magnus');
    expect(container.textContent).toContain('Elsbeth');
  });

  it('sans ambiance authorée, l’écran est une VEILLÉE ; la strate authorée gagne', async () => {
    await mount();
    expect(container.querySelector('[data-ambiance]')?.getAttribute('data-ambiance')).toBe('veillee');
    await act(async () => { useGame.setState({ pendingOuverture: { ...ouverture, ambiance: 'parchemin' } }); });
    expect(container.querySelector('[data-ambiance]')?.getAttribute('data-ambiance')).toBe('parchemin');
  });

  it('« Prendre la route » ferme l’ouverture et BORNE le chapitre (PX/vivants/date)', async () => {
    useGame.setState({ gameTime: 4200 });
    await mount();
    const bouton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Prendre la route')!;
    expect(bouton).toBeTruthy();
    await act(async () => bouton.click());
    expect(useGame.getState().pendingOuverture).toBeNull();
    expect(useGame.getState().chapitreDepuis).toEqual({ xpParHeros: { h1: 0, h2: 0 }, vivants: ['h1', 'h2'], gameTime: 4200 });
    expect(container.textContent).toBe(''); // slot vide = plus de rideau
  });

  it('COOP : l’invité VOIT le rideau, mais le geste porte son refus et ne lève rien', async () => {
    useGame.setState({ gameTime: 4200, net: { ...useGame.getState().net, mode: 'guest', mySeat: 1 } });
    await mount();
    expect(container.textContent).toContain('L’Ennemi Intérieur'); // la cérémonie se partage à la table
    const bouton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Prendre la route')!;
    expect(bouton.getAttribute('aria-disabled')).toBe('true');
    const raison = document.getElementById(bouton.getAttribute('aria-describedby')!);
    expect(raison?.textContent).toBe('L’hôte tourne la page.');

    await act(async () => bouton.click());
    expect(useGame.getState().pendingOuverture?.titre).toBe('L’Ennemi Intérieur');
    expect(useGame.getState().chapitreDepuis).toBeNull();
  });
});
