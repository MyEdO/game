// @vitest-environment jsdom
/**
 * AUCUNE COUCHE FANTÔME (#1476, grief du juge sur le 1ᵉʳ jet du lot).
 *
 * Une couche n'existe que si son dialogue est À L'ÉCRAN. Le défaut mesuré venait de composants
 * montés en PERMANENCE par l'écran de jeu :
 *  - `GameMenu` est toujours monté (son bouton ☰ vit dans le HUD) ; fermé, il n'avait pas d'`onClose`
 *    — et « pas d'`onClose` » veut dire couche BLOQUANTE. Une couche bloquante fantôme mangeait donc
 *    Échap pour TOUTE la session : plus rien ne désarmait, plus rien n'ouvrait le menu.
 *  - `VictoryScreen` appelle ses hooks AVANT son early-return (règle des Hooks) : hors victoire, il
 *    empilait une couche dont le congédiement COMMETTAIT (`dismissVictory`, et en coop
 *    `victoryReady(mySeat)` RÉPLIQUÉ au relais) — le 1ᵉʳ Échap de la partie validait un butin absent.
 *
 * Ce banc monte les composants PERMANENTS avec le hook clavier RÉEL : c'est le seul endroit où le
 * défaut se voit, une modale montée à la main ne le reproduit pas.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { dismissStackKinds } from '../state/dismissStack';
import { resetDismissLayers } from './useDismissLayer';
import { useGameKeyboard } from './clavier/useGameKeyboard';
import { GameMenu } from './GameMenu';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { VictoryScreen } from './VictoryScreen';
import { tacheSuivante } from './focus.testkit';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

let host: HTMLDivElement;
let root: Root;

/** L'écran de jeu tel qu'il est monté en partie : le HUD porte le menu système (fermé) et l'écran de
 *  victoire (sans victoire), plus le hook clavier. Aucun des deux ne s'affiche. */
const Ecran = () => { useGameKeyboard(); return <><GameMenu time={0} onQuit={() => {}} /><VictoryScreen /></>; };

const echap = () => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })); });

beforeEach(() => {
  resetDismissLayers();
  useGame.setState({
    screen: 'campaign', mode: 'battle', gameMenuOpen: false, dialogue: null,
    battle: { over: false, action: null, order: ['chef'], turn: 0, combatants: [{ id: 'chef', kind: 'hero', pos: { x: 1, y: 1 } }], movementUsed: 0, preview: null },
    net: { mode: 'local', mySeat: 0 }, combatCursor: null, preemptAiming: null,
    localIntent: { actionId: 'charge' }, pendingVictory: null,
  } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ gameMenuOpen: false, localIntent: null } as never);
});

describe('Échap — les composants PERMANENTS n’empilent rien tant qu’ils ne s’affichent pas', () => {
  it('menu système FERMÉ + écran de victoire SANS victoire ⇒ pile VIDE, et Échap désarme bien l’intention', () => {
    const dismissVictory = vi.fn();
    useGame.setState({ dismissVictory } as never);
    act(() => root.render(<Ecran />));

    expect(dismissStackKinds(), 'aucun des deux n’est à l’écran : aucune couche').toEqual([]);

    echap();
    expect(useGame.getState().localIntent, 'la touche atteint l’échelle métier (intent-cancel)').toBeNull();
    expect(dismissVictory, 'une couche fantôme de victoire aurait COMMIS ici').not.toHaveBeenCalled();
    expect(useGame.getState().gameMenuOpen, 'un appui = un échelon : le menu ne s’ouvre pas en plus').toBe(false);
  });

  it('le menu système OUVERT est une couche, et redevient RIEN une fois refermé', () => {
    act(() => root.render(<Ecran />));
    act(() => { useGame.setState({ gameMenuOpen: true } as never); });
    expect(dismissStackKinds()).toEqual(['menu-systeme']);

    echap();
    expect(useGame.getState().gameMenuOpen, 'Échap referme le menu ouvert').toBe(false);
    expect(dismissStackKinds(), 'refermé, il n’est plus une couche').toEqual([]);
  });
});

/** Bouton du menu système désigné par son LIBELLÉ visible (ou son `aria-label`) — chemin du joueur :
 *  on clique ce qui est à l'écran, jamais un état interne poussé en props. */
const bouton = (libelle: string): HTMLButtonElement => {
  const b = [...host.querySelectorAll('button')].find(
    (x) => x.getAttribute('aria-label') === libelle || x.textContent?.replace(/\s+/g, ' ').trim() === libelle,
  );
  if (!b) throw new Error(`bouton « ${libelle} » absent de l’écran`);
  return b;
};
const clic = (libelle: string) => act(() => { bouton(libelle).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const sousEcran = () => host.querySelector('.game-menu-sub');
const racine = () => host.querySelector('.game-menu-card:not(.game-menu-sub)');

describe('Échap depuis un SOUS-ÉCRAN du menu système (#1752) — la surface reste, sa couche AUSSI', () => {
  beforeEach(() => {
    act(() => root.render(<Ecran />));
    act(() => { useGame.setState({ gameMenuOpen: true } as never); });
  });

  for (const [entree, titre] of [['Options', 'Options'], ['Coopération', 'Coopération']] as const) {
    it(`sous-écran ${entree} : le 1ᵉʳ Échap remonte à la racine (couche CONSERVÉE), le 2ᵉ ferme`, () => {
      clic(entree); // chemin RÉEL : l'entrée du menu racine, cliquée
      expect(sousEcran()?.textContent, 'le sous-écran est à l’écran').toContain(titre);
      expect(racine(), 'la racine a cédé la place').toBeNull();
      expect(dismissStackKinds()).toEqual(['menu-systeme']);

      echap();
      expect(useGame.getState().gameMenuOpen, 'un appui = UN échelon : le menu reste ouvert').toBe(true);
      expect(sousEcran(), 'le sous-écran est refermé').toBeNull();
      expect(racine(), 'la carte racine est de retour').toBeTruthy();
      expect(dismissStackKinds(), 'la surface est à l’écran : elle GARDE sa couche').toEqual(['menu-systeme']);

      echap();
      expect(useGame.getState().gameMenuOpen, 'le 2ᵉ appui ferme le menu').toBe(false);
      expect(dismissStackKinds(), 'fermé, il n’est plus une couche').toEqual([]);
    });
  }

  it('le ☰ annoncé « Fermer le menu » ferme le menu, y compris depuis un sous-écran', () => {
    clic('Options');
    expect(sousEcran(), 'on est bien dans le sous-écran').toBeTruthy();
    clic('Fermer le menu'); // l'affordance annoncée par `aria-label`/`aria-expanded` se clique
    expect(useGame.getState().gameMenuOpen, 'le ☰ ferme le menu').toBe(false);
    expect(dismissStackKinds()).toEqual([]);
  });
});

/**
 * LE FOCUS ENTRE DANS LA BOÎTE, MÊME MONTÉE EN PERMANENCE (#1752, recette clavier pas 9).
 *
 * `GameMenu` vit toujours dans le HUD et ne rend sa boîte qu'à l'ouverture : au premier rendu son
 * `ref` est vide. Les deux effets de focus d'`useModalA11y` dépendent donc d'`actif`, sans quoi ils
 * sortent à vide une fois pour toutes et le joueur clavier reste sur `<body>` — menu ouvert comme
 * après un retour de sous-écran (où c'est le SAUVETAGE par mutations qui replace le focus).
 */
describe('Menu système — le focus clavier entre dans la carte (#1752)', () => {
  // Le focus est MESURÉ ici : sans layout, aucun focusable ne passerait le filtre de `Modal`.
  let retirerLayout: () => void;
  beforeAll(() => { retirerLayout = poserLayoutJsdom(); });
  afterAll(() => retirerLayout());

  const carte = () => host.querySelector('.game-menu-overlay') as HTMLElement;

  /** Le SAUVETAGE du focus (`useModalA11y`) est lu à la tâche suivante : on la laisse passer avant de
   *  lire `activeElement`. */
  const vider = tacheSuivante;

  it('à l’OUVERTURE, le focus est dans la carte — et il y revient après le retour de sous-écran', async () => {
    act(() => root.render(<Ecran />));
    act(() => { useGame.setState({ gameMenuOpen: true } as never); });
    expect(carte().contains(document.activeElement), 'ouverture : le clavier a une prise').toBe(true);

    clic('Options');
    await vider();
    expect(carte().contains(document.activeElement), 'sous-écran : le focus a suivi').toBe(true);

    echap();
    await vider();
    expect(racine(), 'on est revenu à la carte racine').toBeTruthy();
    expect(carte().contains(document.activeElement), 'retour au menu : le focus suit').toBe(true);
  });

  it('la CLASSE entière : l’écran de victoire, lui aussi monté en permanence, prend le focus à sa révélation', () => {
    // La boîte ne se MONTE qu'à `over === 'victory' && revealed` : elle naît APRÈS le délai de tenue du
    // coup fatal (`VICTORY_REVEAL_MS`, `VictoryScreen.tsx`), bien après le premier rendu.
    vi.useFakeTimers();
    try {
      act(() => root.render(<Ecran />));
      act(() => {
        useGame.setState({ battle: { ...useGame.getState().battle!, over: 'victory' } } as never);
      });
      act(() => { vi.advanceTimersByTime(1000); });
      const victoire = [...host.querySelectorAll<HTMLElement>('[role="dialog"]')]
        .find((d) => document.getElementById(d.getAttribute('aria-labelledby') ?? '')?.textContent === 'Victoire') ?? null;
      expect(victoire, 'l’écran de victoire est révélé, et il porte son nom').toBeTruthy();
      expect(victoire!.contains(document.activeElement), 'le clavier a une prise sur [Continuer]').toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
