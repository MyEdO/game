// @vitest-environment jsdom
/**
 * ÉCHAP EST UNE PILE (#1476) — comportement STANDARD du congédiement : la DERNIÈRE surface ouverte
 * se ferme la PREMIÈRE (LIFO), un appui ferme AU PLUS une couche, et rien ne « traverse » vers
 * l'échelle métier tant qu'une couche est à l'écran.
 *
 * Bug d'origine : chaque surface posait son propre écouteur. Le popover de règle se fermait ET
 * laissait la touche filer jusqu'au registre → le menu système s'ouvrait par-dessus. Le panneau-
 * paramètre, lui, la mangeait en capture (`stopImmediatePropagation`) → une modale ouverte APRÈS
 * lui devenait insensible à Échap. Les deux portes se contredisaient.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { dismissStackKinds } from '../state/dismissStack';
import { useDismissLayer, resetDismissLayers } from './useDismissLayer';
import { Modal } from './Modal';
import { PanneauParametre } from './PanneauParametre';
import { CodexRef } from './compendium/CodexRef';
import { padButton } from './useGamepad';
import { useGameKeyboard } from './useGameKeyboard';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

let host: HTMLDivElement;
let root: Root;
let ancre: HTMLButtonElement;
/** Le hook clavier RÉEL du jeu, monté à part : quand la pile est VIDE, c'est lui qui déroule
 *  l'échelle métier — la coexistence des deux chemins fait partie du contrat mesuré ici. */
let clavier: { hote: HTMLDivElement; root: Root };
const Clavier = () => { useGameKeyboard(); return null; };

/** Écran de jeu, aucun autre état armé : `toggle-menu` est le DERNIER barreau de l'échelle d'Échap,
 *  et son ouverture est le témoin qu'une touche a « traversé » une couche. */
function ecranDeJeu() {
  useGame.setState({
    screen: 'campaign', mode: 'battle', gameMenuOpen: false, dialogue: null,
    battle: { over: false, action: null, order: ['chef'], turn: 0, combatants: [{ id: 'chef', kind: 'hero', pos: { x: 1, y: 1 } }], movementUsed: 0, preview: null },
    net: { mode: 'local', mySeat: 0 }, combatCursor: null, preemptAiming: null, localIntent: null,
  } as never);
}

const echap = () => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); });
const menuOuvert = () => useGame.getState().gameMenuOpen;

beforeEach(() => {
  resetDismissLayers();
  ecranDeJeu();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  ancre = document.createElement('button');
  ancre.textContent = 'Dissiper';
  document.body.appendChild(ancre);
  const hote = document.createElement('div');
  document.body.appendChild(hote);
  clavier = { hote, root: createRoot(hote) };
  act(() => clavier.root.render(<Clavier />));
});
afterEach(() => {
  act(() => root.unmount());
  act(() => clavier.root.unmount());
  clavier.hote.remove();
  host.remove();
  ancre.remove();
  useGame.setState({ gameMenuOpen: false, localIntent: null } as never);
});

describe('Échap — pile de couches LIFO', () => {
  it('SONDE LIFO : un panneau-paramètre ouvert AVANT une modale ne lui vole plus la touche', () => {
    const fermePanneau = vi.fn();
    const fermeModale = vi.fn();
    const Scene = ({ modale }: { modale: boolean }) => (
      <>
        <PanneauParametre anchor={ancre} intitule="Quel Sort dissiper ?" options={[{ key: 'a', label: 'Vol', onSelect: () => {} }]} onClose={fermePanneau} />
        {modale && <Modal title="Jet d’Athlétisme" onClose={fermeModale}><button type="button">Lancer</button></Modal>}
      </>
    );
    act(() => root.render(<Scene modale={false} />));
    expect(document.querySelector('[data-panneau-parametre]'), 'le panneau est ouvert').toBeTruthy();
    act(() => root.render(<Scene modale />)); // la modale s'ouvre PAR-DESSUS
    expect(dismissStackKinds()).toEqual(['panneau-parametre', 'modale']);

    echap();
    expect(fermeModale, 'la dernière ouverte se ferme la PREMIÈRE').toHaveBeenCalledTimes(1);
    expect(fermePanneau, 'un appui = AU PLUS une fermeture').not.toHaveBeenCalled();
    expect(menuOuvert(), 'la touche ne traverse pas la pile').toBe(false);
  });

  it('POPOVER ÉPINGLÉ : Échap le referme et n’ouvre PAS le menu système (bug d’origine du ticket)', () => {
    // Témoin : sans aucune couche, cet appui-là ouvre bien le menu.
    echap();
    expect(menuOuvert(), 'témoin : l’échelle métier répond quand la pile est vide').toBe(true);
    useGame.setState({ gameMenuOpen: false } as never);

    act(() => root.render(
      <CodexRef category="talents" id="affable" label="Affable" wrap><button type="button">Affable ×2</button></CodexRef>,
    ));
    const declencheur = host.querySelector('.codex-ref') as HTMLElement;
    act(() => { declencheur.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.querySelector('.codex-pop'), 'le popover est épinglé').toBeTruthy();

    echap();
    expect(document.querySelector('.codex-pop'), 'Échap referme le popover').toBeNull();
    expect(menuOuvert(), 'et le menu système NE s’ouvre PAS derrière').toBe(false);
  });

  it('COUCHE BLOQUANTE (`onDismiss: null`) : Échap est consommé, rien ne bouge', () => {
    const Bloquante = () => {
      const boite = useRef<HTMLDivElement>(null);
      useDismissLayer({ kind: 'bloquante', nature: 'modale', plan: 'application', boite }, null);
      return <div ref={boite} />;
    };
    act(() => root.render(<Bloquante />));
    echap();
    expect(dismissStackKinds(), 'la couche bloquante reste en place').toEqual(['bloquante']);
    expect(menuOuvert(), 'et la touche ne descend pas jusqu’au menu').toBe(false);
  });

  it('LA COUCHE RESTE (`onDismiss` rend `false`) : aucune cascade vers la couche du dessous', () => {
    const dessous = vi.fn();
    const Deux = () => {
      const bas = useRef<HTMLDivElement>(null);
      const haut = useRef<HTMLDivElement>(null);
      useDismissLayer({ kind: 'dessous', nature: 'modale', plan: 'application', boite: bas }, dessous);
      useDismissLayer({ kind: 'dessus', nature: 'modale', plan: 'application', boite: haut }, () => false);
      return <><div ref={bas} /><div ref={haut} /></>;
    };
    act(() => root.render(<Deux />));
    echap();
    expect(dessous, 'la couche du dessous ne doit pas être congédiée à la place').not.toHaveBeenCalled();
    expect(dismissStackKinds()).toEqual(['dessous', 'dessus']);
    expect(menuOuvert()).toBe(false);
  });

  it('une couche ouverte AU-DESSUS retire la surface de survol qu’elle recouvre', () => {
    const Scene = ({ modale }: { modale: boolean }) => (
      <>
        <CodexRef category="talents" id="affable" label="Affable" wrap><button type="button">Affable ×2</button></CodexRef>
        {modale && <Modal title="Jet" onClose={() => {}}><button type="button">Lancer</button></Modal>}
      </>
    );
    act(() => root.render(<Scene modale={false} />));
    const declencheur = host.querySelector('.codex-ref') as HTMLElement;
    act(() => { declencheur.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.querySelector('.codex-pop'), 'le survol affiche le popover').toBeTruthy();
    act(() => root.render(<Scene modale />));
    expect(document.querySelector('.codex-pop'), 'la modale le recouvrait : il se retire').toBeNull();
  });
});

describe('Échap — parité MANETTE (bouton B)', () => {
  it('EN CARTE : B prend l’échelle métier réelle (il ne se limite plus à `cursor-cancel`)', () => {
    useGame.setState({ localIntent: { actionId: 'charge' } } as never);
    act(() => { padButton('B'); });
    expect(useGame.getState().localIntent, 'B désarme l’intention, comme Échap').toBeNull();
    expect(menuOuvert(), 'un appui = un échelon').toBe(false);
  });

  it('EN MODALE : B congédie la couche du dessus SANS synthétiser d’événement clavier', () => {
    const espion = vi.fn();
    document.addEventListener('keydown', espion);
    const ferme = vi.fn();
    act(() => root.render(<Modal title="Jet" onClose={ferme}><button type="button">Lancer</button></Modal>));
    act(() => { padButton('B'); });
    document.removeEventListener('keydown', espion);
    expect(ferme, 'la modale se ferme').toHaveBeenCalledTimes(1);
    expect(espion, 'aucun KeyboardEvent synthétique : B appelle la couture directement').not.toHaveBeenCalled();
  });
});
