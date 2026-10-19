// @vitest-environment jsdom
/**
 * MODIFICATEURS AUTORITAIRES (#1687 lot 0) — mesuré sur le VRAI hook et de vrais `KeyboardEvent`.
 *
 * Un raccourci ne répond que si Ctrl/Alt/Maj tenus sont EXACTEMENT ceux qu'il déclare (`mods`) :
 *  • sans `mods`, il se TAIT sous un modificateur (Alt+D ne fait pas un pas d'exploration) ;
 *  • `Ctrl+KeyZ` déclenche l'annulation de l'éditeur, et `KeyZ` seul ne la déclenche pas.
 * L'éditeur passe par le PONT (`state/editeurBridge`) : pont vide (éditeur démonté), la touche ne
 * fait rien et ne jette pas.
 *
 * Une touche-MODIFICATEUR est son propre modificateur (`modsDeLaTouche`) : Alt nue porte un raccourci.
 * Et le RELÂCHEMENT s'apparie par la PRISE, pas par une seconde élection : le geste maintenu se termine
 * quels que soient les modificateurs tenus, le `when` du moment et le focus au keyup.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { emptyScene } from '../noyau/monde/scene';
import { resetStageWalk } from '../state/stageWalk';
import { publierEditeur } from '../state/editeurBridge';
import { useGameKeyboard } from './clavier/useGameKeyboard';
import { Listbox } from './composites/GroupesDeChoix';
import { KEYBINDINGS, modsMatch, type KeyBinding, type KeyMod } from '../state/clavier/keybindings';

/** Raccourci FABRIQUÉ, posé EN TÊTE du registre : ce qui est éprouvé ici est la LOI du hook (prise,
 *  relâchement), jamais le stock de raccourcis du jeu. En tête = il gagne l'élection sur un code déjà
 *  porté par le registre. `KEYBINDINGS` est le registre de PRODUCTION, partagé par tout le fichier de
 *  test (et, `isolate: false`, par le module lui-même) : sa remise en état est STRUCTURELLE — snapshot
 *  au `beforeEach`, restauration au `afterEach`, aucun retrait à la charge d'un cas. */
const poser = (b: Pick<KeyBinding, 'id' | 'codes'> & Partial<KeyBinding>): void => {
  KEYBINDINGS.unshift({ labelKey: 'key.camLeft', section: 'camera', when: () => true, run: () => {}, ...b } as KeyBinding);
};

/** Raccourcis du registre que cette touche (code + modificateurs tenus) désigne — la SONDE du juge. */
const candidats = (code: string, tenus: KeyMod[]): string[] =>
  KEYBINDINGS.filter((k) => k.codes.includes(code) && modsMatch(k.mods ?? [], tenus, code)).map((k) => k.id);

function Harness() {
  useGameKeyboard();
  return null;
}

type Mods = { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean };
const frapper = (type: 'keydown' | 'keyup', code: string, mods: Mods = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...mods }));
  });

describe('raccourcis — les modificateurs font partie de la touche', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let host: HTMLDivElement;
  let root: Root;
  let registre: KeyBinding[];
  beforeEach(() => {
    registre = [...KEYBINDINGS];
    vi.useFakeTimers();
    resetStageWalk();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const sc = emptyScene(12, 12);
    sc.id = 'raccourcis-mods';
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 6, y: 6 } });
    useGame.getState().startScene(sc);
    useGame.setState({
      screen: 'campaign', mode: 'exploration', partyPos: { x: 6, y: 6 },
      camRot: 0, camEdge: false, viewMode: undefined, povActive: false,
      dialogue: null, gameMenuOpen: false, merchant: null, worldMapOpen: false, battle: null,
      keyOverrides: {},
    } as never);
    act(() => root.render(<Harness />));
  });
  afterEach(() => {
    KEYBINDINGS.splice(0, KEYBINDINGS.length, ...registre);
    act(() => root.unmount());
    host.remove();
    resetStageWalk();
    vi.useRealTimers();
  });

  it('un raccourci SANS `mods` se tait quand Alt ou Ctrl est tenu, et répond seul', () => {
    const depart = { ...useGame.getState().partyPos };
    frapper('keydown', 'KeyD', { altKey: true });
    frapper('keyup', 'KeyD', { altKey: true });
    expect(useGame.getState().partyPos, 'Alt+D a déclenché le pas d’exploration de D').toEqual(depart);
    frapper('keydown', 'KeyD', { ctrlKey: true });
    frapper('keyup', 'KeyD', { ctrlKey: true });
    expect(useGame.getState().partyPos, 'Ctrl+D a déclenché le pas d’exploration de D').toEqual(depart);
    // Référence positive : la même touche NUE agit bien (la garde n'est pas devenue muette).
    frapper('keydown', 'KeyD');
    frapper('keyup', 'KeyD');
    expect(useGame.getState().partyPos).not.toEqual(depart);
  });

  it('l’écran de jeu ne répond PAS aux touches déclarées de l’éditeur, et réciproquement', () => {
    const annuler = vi.fn();
    const retirer = publierEditeur({ annuler });
    frapper('keydown', 'KeyZ', { ctrlKey: true }); // écran de jeu : l'éditeur n'a pas la main
    expect(annuler, 'un raccourci d’éditeur a mordu sur l’écran de jeu').not.toHaveBeenCalled();
    useGame.setState({ screen: 'editor' } as never);
    frapper('keydown', 'KeyZ'); // sans Ctrl : ce n'est pas la touche déclarée
    expect(annuler, 'Z seul a déclenché l’annulation').not.toHaveBeenCalled();
    frapper('keydown', 'KeyZ', { ctrlKey: true });
    expect(annuler).toHaveBeenCalledOnce();
    retirer();
  });

  it('Ctrl+Maj+Z rétablit, et ce n’est PAS la touche de Ctrl+Z', () => {
    const annuler = vi.fn();
    const retablir = vi.fn();
    useGame.setState({ screen: 'editor' } as never);
    const retirer = publierEditeur({ annuler, retablir });
    frapper('keydown', 'KeyZ', { ctrlKey: true, shiftKey: true });
    expect(retablir, 'Ctrl+Maj+Z n’a pas rétabli').toHaveBeenCalledOnce();
    expect(annuler, 'Ctrl+Maj+Z a annulé (les modificateurs ne font pas partie de la touche)').not.toHaveBeenCalled();
    frapper('keyup', 'KeyZ', { ctrlKey: true, shiftKey: true });
    frapper('keydown', 'KeyZ', { ctrlKey: true });
    expect(annuler).toHaveBeenCalledOnce();
    expect(retablir, 'Ctrl+Z a rétabli').toHaveBeenCalledOnce();
    retirer();
  });

  it('touche NUE = POSITION physique quelle que soit la COUCHE : Maj+1 reste la case 1, Alt+1 non', () => {
    // Sur AZERTY, la rangée de chiffres EST la couche Maj : « 1 » se frappe Maj+`Digit1`. Une touche
    // nue qui refuserait Maj rendrait les cases 1-8 de la grille de capacités injouables.
    expect(candidats('Digit1', ['shift'])).toContain('hotbar-1');
    expect(candidats('Digit1', [])).toContain('hotbar-1');
    expect(candidats('Digit1', ['alt'])).not.toContain('hotbar-1');
    expect(candidats('Digit1', ['ctrl'])).not.toContain('hotbar-1');
    expect(candidats('Digit1', ['ctrl', 'alt']), 'AltGr COMPOSE un caractère, il ne frappe pas un raccourci').not.toContain('hotbar-1');
    // Ctrl+Z reste EXACT : Ctrl+Maj+Z est une autre touche, celle du rétablissement.
    expect(candidats('KeyZ', ['ctrl'])).toEqual(['editeur-annuler']);
    expect(candidats('KeyZ', ['ctrl', 'shift'])).toEqual(['editeur-retablir-maj']);
  });

  it('la couche Maj sur une touche NUE agit AUSSI dans le vrai hook (Maj+D = pas d’exploration)', () => {
    const depart = { ...useGame.getState().partyPos };
    frapper('keydown', 'KeyD', { shiftKey: true });
    frapper('keyup', 'KeyD', { shiftKey: true });
    expect(useGame.getState().partyPos, 'Maj+D n’a pas fait le pas d’exploration de D').not.toEqual(depart);
  });

  it('focus RÉSIDUEL d’un bouton : la flèche reste à l’application, l’item d’une liste la garde', () => {
    const deplacer = vi.fn();
    useGame.setState({ screen: 'editor' } as never);
    const retirer = publierEditeur({ deplacer });
    const bouton = document.createElement('button');
    document.body.appendChild(bouton);
    try {
      bouton.focus();
      expect(document.activeElement).toBe(bouton);
      frapper('keydown', 'ArrowRight');
      expect(deplacer, 'un bouton de palette encore focalisé mange la flèche de l’éditeur').toHaveBeenCalledWith(1, 0);
      // Un bouton DANS une liste à roving tabindex (`Listbox`) : la flèche est à la liste, pas à l'éditeur.
      const hote = document.createElement('div');
      document.body.appendChild(hote);
      const liste = createRoot(hote);
      act(() => liste.render(<Listbox suivi="focus" label="Liste"><button type="button">item</button></Listbox>));
      hote.querySelector('button')!.focus();
      frapper('keyup', 'ArrowRight');
      frapper('keydown', 'ArrowRight');
      expect(deplacer, 'la flèche d’une liste à roving tabindex a AUSSI déplacé la sélection').toHaveBeenCalledOnce();
      act(() => liste.unmount());
      hote.remove();
    } finally {
      bouton.remove();
      retirer();
    }
  });

  it('pont VIDE (éditeur démonté) : la touche ne fait rien et ne jette pas', () => {
    useGame.setState({ screen: 'editor' } as never);
    expect(() => {
      frapper('keydown', 'KeyZ', { ctrlKey: true });
      frapper('keydown', 'Escape');
      frapper('keydown', 'Space');
      frapper('keyup', 'Space');
    }).not.toThrow();
  });

  it('Échap de l’éditeur : la PRÉSENCE de `fermerMenuFichier` lui donne la touche, sinon désélection', () => {
    const fermerMenuFichier = vi.fn();
    const deselectionner = vi.fn();
    useGame.setState({ screen: 'editor' } as never);
    const retirerTout = publierEditeur({ deselectionner });
    const retirerMenu = publierEditeur({ fermerMenuFichier });
    frapper('keydown', 'Escape');
    expect(fermerMenuFichier).toHaveBeenCalledOnce();
    expect(deselectionner, 'le menu ouvert devait prendre la touche seul').not.toHaveBeenCalled();
    retirerMenu(); // le menu se ferme : la touche revient à la désélection
    frapper('keyup', 'Escape');
    frapper('keydown', 'Escape');
    expect(deselectionner).toHaveBeenCalledOnce();
    retirerTout();
  });

  it('une touche-MODIFICATEUR porte son raccourci : Alt enfoncée agit, Alt relâchée termine', () => {
    const run = vi.fn();
    const runUp = vi.fn();
    poser({ id: 'test-alt-nu', codes: ['AltLeft', 'AltRight'], mods: [], run, runUp });
    frapper('keydown', 'AltLeft', { altKey: true });
    expect(run, 'l’appui d’Alt porte `altKey` : le raccourci d’Alt ne s’est jamais armé').toHaveBeenCalledOnce();
    frapper('keyup', 'AltLeft', { altKey: false });
    expect(runUp, 'Alt relâchée n’a pas terminé son geste').toHaveBeenCalledOnce();
  });

  it('un keyup d’une touche JAMAIS prise ne termine rien', () => {
    const runUp = vi.fn();
    poser({ id: 'test-jamais-pris', codes: ['KeyJ'], runUp });
    frapper('keyup', 'KeyJ');
    expect(runUp, 'le relâchement a joué sans appui').not.toHaveBeenCalled();
  });

  it('le geste MAINTENU se termine même si Alt est pressée PENDANT l’appui', () => {
    const runUp = vi.fn();
    poser({ id: 'test-maintenu-alt', codes: ['KeyJ'], runUp });
    frapper('keydown', 'KeyJ');
    frapper('keydown', 'AltLeft', { altKey: true }); // Alt vient par-dessus le maintien
    frapper('keyup', 'KeyJ', { altKey: true });
    expect(runUp, 'Alt pressée pendant le maintien laisse le geste courir sans fin').toHaveBeenCalledOnce();
  });

  it('le geste MAINTENU se termine même si son contexte (`when`) est retombé pendant l’appui', () => {
    const runUp = vi.fn();
    let actif = true;
    poser({ id: 'test-when-retombe', codes: ['KeyJ'], when: () => actif, runUp });
    frapper('keydown', 'KeyJ');
    actif = false; // changement d'écran pendant que la touche est tenue
    frapper('keyup', 'KeyJ');
    expect(runUp, 'un `when` retombé laisse le geste courir jusqu’au blur').toHaveBeenCalledOnce();
  });

  it('le geste MAINTENU se termine même si un champ de saisie a pris le focus pendant l’appui', () => {
    const runUp = vi.fn();
    poser({ id: 'test-saisie-pendant', codes: ['KeyJ'], runUp });
    const champ = document.createElement('input');
    document.body.appendChild(champ);
    try {
      frapper('keydown', 'KeyJ');
      champ.focus();
      expect(document.activeElement).toBe(champ);
      frapper('keyup', 'KeyJ');
      expect(runUp, 'un clic dans un champ texte avale la fin du geste').toHaveBeenCalledOnce();
    } finally {
      champ.remove();
    }
  });

  it('Maj tenue puis relâchée AVANT la touche : le geste se termine quand même', () => {
    const run = vi.fn();
    const runUp = vi.fn();
    poser({ id: 'test-maj-fleche', codes: ['ArrowRight'], run, runUp });
    frapper('keydown', 'ArrowRight', { shiftKey: true });
    expect(run).toHaveBeenCalledOnce();
    frapper('keyup', 'ArrowRight', { shiftKey: false });
    expect(runUp).toHaveBeenCalledOnce();
  });

  /**
   * RÉVÉLER LES UTILISABLES (#1687 lot 3-II-b) — le binding de PRODUCTION `decor.reveler`, mesuré sur
   * le vrai registre : Alt maintenu pose l'état que les halos et les plaques de nom lisent, et il se
   * rend au relâchement comme au `blur` (Alt-Tab : la touche part sans keyup).
   */
  it('Alt maintenu RÉVÈLE, et l’état se rend au relâchement — les deux positions de la touche', () => {
    for (const code of ['AltLeft', 'AltRight']) {
      frapper('keydown', code, { altKey: true });
      expect(useGame.getState().reveler, `${code} enfoncée`).toBe(true);
      frapper('keyup', code, { altKey: false });
      expect(useGame.getState().reveler, `${code} relâchée`).toBe(false);
    }
  });

  it('ALT-TAB : la fenêtre perd le focus, la révélation se rend (aucun keyup ne viendra)', () => {
    frapper('keydown', 'AltLeft', { altKey: true });
    expect(useGame.getState().reveler).toBe(true);
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(useGame.getState().reveler, 'l’état serait resté collé jusqu’au prochain appui').toBe(false);
  });
});
