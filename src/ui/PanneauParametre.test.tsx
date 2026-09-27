// @vitest-environment jsdom
/**
 * PANNEAU-PARAMÈTRE BORNÉ (`PanneauParametre.tsx`, spec HUD combat zone 10) — contrats de la
 * PRIMITIVE, indépendamment de tout appelant : il naît de SON déclencheur, un clic commet ET ferme,
 * Échap et le clic-dehors ferment SANS commettre (annulation gratuite par construction).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PanneauParametre, type ParamOption } from './PanneauParametre';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

let host: HTMLDivElement;
let root: Root;
let ancre: HTMLButtonElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  ancre = document.createElement('button');
  ancre.textContent = 'Dissiper';
  document.body.appendChild(ancre);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  ancre.remove();
});

const panneau = () => document.body.querySelector('[data-panneau-parametre]');
const boutons = () => [...(panneau()?.querySelectorAll('button') ?? [])];

function monter(options: ParamOption[], onClose: () => void, anchor: HTMLElement | null = ancre) {
  act(() => {
    root.render(<PanneauParametre anchor={anchor} intitule="Quel Sort dissiper ?" options={options} onClose={onClose} />);
  });
}

describe('PanneauParametre — paramètre BORNÉ, ancré, annulable', () => {
  it('rend UN bouton par candidat, avec sa méta, et se nomme par sa question', () => {
    const opts: ParamOption[] = [
      { key: 'a', label: 'Vol', meta: 'NI 3', onSelect: () => {} },
      { key: 'b', label: 'Bouclier éthéré', meta: 'NI 5', onSelect: () => {} },
    ];
    monter(opts, () => {});
    expect(panneau()?.getAttribute('aria-label')).toBe('Quel Sort dissiper ?');
    expect(panneau()?.getAttribute('role')).toBe('dialog');
    expect(boutons().map((b) => b.textContent)).toEqual(['VolNI 3', 'Bouclier éthéréNI 5']);
  });

  it('ANCRAGE : sans déclencheur, aucun panneau ne flotte à l’écran', () => {
    monter([{ key: 'a', label: 'Vol', onSelect: () => {} }], () => {}, null);
    expect(panneau()).toBeNull();
  });

  it('un clic = COMMIT + FERMETURE (la fermeture est portée par la primitive, pas par l’appelant)', () => {
    const choisi = vi.fn();
    const close = vi.fn();
    monter([{ key: 'a', label: 'Vol', onSelect: choisi }, { key: 'b', label: 'Bouclier', onSelect: () => {} }], close);
    act(() => { boutons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(choisi).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('ÉCHAP ferme SANS commettre — et la touche est CONSOMMÉE (le panneau est la couche du dessus)', () => {
    const choisi = vi.fn();
    const close = vi.fn();
    const global = vi.fn();
    document.addEventListener('keydown', global);
    monter([{ key: 'a', label: 'Vol', onSelect: choisi }], close);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    document.removeEventListener('keydown', global);
    expect(close).toHaveBeenCalledTimes(1);
    expect(choisi, 'aucune ressource engagée : Échap n’est pas un choix').not.toHaveBeenCalled();
    expect(global, 'Échap ne doit pas ALLER AUSSI au curseur tactique / au menu système').not.toHaveBeenCalled();
  });

  it('CLIC DEHORS ferme sans commettre ; un clic DANS le panneau ou sur son déclencheur ne ferme pas', () => {
    const close = vi.fn();
    monter([{ key: 'a', label: 'Vol', onSelect: () => {} }], close);
    act(() => { panneau()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    act(() => { ancre.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(close, 'le panneau et son déclencheur comptent comme « dedans »').not.toHaveBeenCalled();
    act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('une option REFUSÉE reste visible mais inerte (le refus se voit, il ne se cache pas)', () => {
    const choisi = vi.fn();
    monter([{ key: 'a', label: 'Vol', disabled: true, onSelect: choisi }], () => {});
    expect(boutons()[0].disabled).toBe(true);
    act(() => { boutons()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(choisi).not.toHaveBeenCalled();
  });

  it('AUCUN candidat = AUCUN panneau (un panneau vide serait une promesse creuse)', () => {
    monter([], () => {});
    expect(panneau()).toBeNull();
  });

  // A11Y DE DIALOGUE — le panneau porte `role="dialog"`, donc il câble le hook partagé du dépôt
  // (`useModalA11y`) : sans lui, un joueur clavier qui ouvre le panneau perd son point de
  // navigation et ne retrouve jamais l'alvéole d'où il vient.
  // PORTÉE MESURÉE ICI : le RETOUR de focus. Le focus D'ENTRÉE, lui, est hors de portée de jsdom —
  // `visibleFocusables` (`focus.ts`)/`choiceOptions` (`Modal.tsx`) filtrent sur `getClientRects()`, qui rend
  // toujours 0 sans moteur de rendu ; l'affirmer ici serait mesurer jsdom, pas le panneau.
  it('A11Y : à la fermeture, le focus REVIENT au déclencheur (hook `useModalA11y` câblé)', () => {
    ancre.focus();
    expect(document.activeElement, 'témoin : le déclencheur tient le focus avant l’ouverture').toBe(ancre);
    monter([{ key: 'a', label: 'Vol', onSelect: () => {} }, { key: 'b', label: 'Bouclier', onSelect: () => {} }], () => {});
    expect(panneau(), 'témoin : le panneau doit être monté pour que la mesure ait un sens').not.toBeNull();
    // Le joueur a posé le focus DANS le panneau : à la fermeture, cet élément disparaît du document
    // et le focus retomberait sur `<body>` — c'est exactement ce que le hook rattrape.
    boutons()[0].focus();
    expect(document.activeElement, 'témoin : le focus est bien parti dans le panneau').toBe(boutons()[0]);
    act(() => { root.render(null); });
    expect(document.activeElement, 'le focus ne revient pas à l’alvéole qui a ouvert le panneau').toBe(ancre);
  });
});
