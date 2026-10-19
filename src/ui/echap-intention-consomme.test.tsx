// @vitest-environment jsdom
/**
 * ÉCHAP QUI DÉSARME NE DOIT PAS OUVRIR LE MENU (#1411, P0-A défaut 3).
 *
 * Recette du 2026-08-19 : « Échap désarme l'intention MAIS ouvre parfois le menu-pause par-dessus »
 * (une fois sur trois). Le registre n'élit qu'UN raccourci par événement (`useGameKeyboard::onKey`,
 * 1ᵉʳ match) — un appui isolé ne peut donc pas faire les deux. Ce qui le peut, c'est la RÉPÉTITION
 * automatique du clavier : le même appui maintenu un instant émet plusieurs `keydown`, le premier
 * désarme, et les suivants — l'intention désormais nulle — retombent sur `toggle-menu`.
 *
 * Contrat : tant que la touche n'a pas été RELÂCHÉE, l'appui qui a désarmé garde la touche ; le menu
 * ne s'ouvre qu'à un appui NEUF, quand plus rien n'était armé.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { useGameKeyboard } from './clavier/useGameKeyboard';

function Harness() {
  useGameKeyboard();
  return null;
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

/** Combat témoin piloté par ce client, écran de jeu, aucune modale — le contexte des trois portes
 *  d'Échap (`intent-cancel`, `cursor-cancel`, `toggle-menu`). */
function armer(localIntent: { actionId: string } | null) {
  useGame.setState({
    screen: 'campaign', mode: 'battle', gameMenuOpen: false, dialogue: null,
    battle: { over: false, action: null, order: ['chef'], turn: 0, combatants: [{ id: 'chef', kind: 'hero', pos: { x: 1, y: 1 } }], movementUsed: 0, preview: null },
    net: { mode: 'local', mySeat: 0 }, combatCursor: null, preemptAiming: null, localIntent,
  } as never);
}

const échap = (repeat: boolean) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', repeat })); });
const relâcher = () => act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' })); });

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<Harness />));
});
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
  useGame.setState({ gameMenuOpen: false, localIntent: null } as never);
});

describe('Échap consommé par le désarmement (#1411 P0-A)', () => {
  it('l’appui qui désarme l’intention n’ouvre pas le menu, même RÉPÉTÉ par le clavier', () => {
    armer({ actionId: 'charge' });
    échap(false);
    expect(useGame.getState().localIntent, 'Échap n’a pas désarmé').toBeNull();
    expect(useGame.getState().gameMenuOpen, 'le désarmement a ouvert le menu par-dessus').toBe(false);
    échap(true); // MÊME appui, répétition automatique
    échap(true);
    expect(useGame.getState().gameMenuOpen, 'la répétition du MÊME appui a ouvert le menu').toBe(false);
  });

  it('un appui NEUF (après relâchement), plus rien d’armé, ouvre bien le menu', () => {
    armer({ actionId: 'charge' });
    échap(false);
    relâcher();
    échap(false);
    expect(useGame.getState().gameMenuOpen, 'Échap n’atteint plus le menu quand rien n’est armé').toBe(true);
  });

  it('sans rien d’armé, le PREMIER Échap ouvre le menu (aucune touche mangée)', () => {
    armer(null);
    échap(false);
    expect(useGame.getState().gameMenuOpen).toBe(true);
  });
});
