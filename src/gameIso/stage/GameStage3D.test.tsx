// @vitest-environment jsdom
import { Profiler, StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { hasSpritePicker, targetUnderPointer } from './spritePicker';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';

/**
 * LE MONDE EST VOLUMIQUE, ET LUI SEUL (#1176 P3-4, commit C5a) : l'écran de jeu ne peint plus aucun
 * décor dans son SVG — celui-ci ne porte que les overlays d'interaction et reçoit le picking de TUILE.
 * Plus aucun jeton n'y porte de `data-cid` : le picking de SPRITE passe par la couture
 * `stage/spritePicker.ts`, où cet écran INSCRIT son lancer de rayon (P2-3) — c'est l'inscription, et
 * non un drapeau de voie, qui bascule le pointeur.

 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Renderer de BANC : jsdom n'a aucun contexte WebGL, et un contexte refusé fait DIRE le refus au
 *  joueur (`stage/SansWebgl`) au lieu de peindre. Sans banc, ce fichier mesurerait ce message. */
brancherArdoise();

beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/** Scène minimale montrable, et un conteneur frais racine du prochain montage. */
function poserEtat(): void {
  useGame.setState({
    scene: emptyScene(6, 6),
    mode: 'exploration',
    partyPos: { x: 2, y: 2 },
    party: [hero('h1', { x: 2, y: 2 })],
    battle: null,
    dialogue: null,
    flags: {},
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
}

/** Monte le stage, et COMPTE les commits de son sous-arbre (`Profiler` : aucun rendu = aucun commit). */
function monter(): { el: HTMLDivElement; commits: () => number } {
  poserEtat();
  let n = 0;
  act(() => root!.render(<Profiler id="stage" onRender={() => { n += 1; }}><MondeDeCampagne /></Profiler>));
  return { el: container!, commits: () => n };
}

/** Le montage RÉEL du jeu : `src/main.tsx` rend l'application sous `<React.StrictMode>`, et la voie
 *  volumique est celle du jeu (#1176, P3-4) — le double-montage des effets est donc son chemin ordinaire, pas un cas
 *  d'école. */
function monterStrict(): HTMLDivElement {
  poserEtat();
  act(() => root!.render(<StrictMode><MondeDeCampagne /></StrictMode>));
  return container!;
}

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
});

describe('Le monde de l’écran de jeu est VOLUMIQUE, et lui seul (#1176 C5a)', () => {
  it('le canevas est monté SOUS le SVG, qui ne porte plus la couche monde', () => {
    const { el } = monter();
    const canvas = el.querySelector('canvas.iso-stage');
    const svg = el.querySelector('svg.iso-stage');
    expect(canvas).not.toBeNull();
    expect(svg).not.toBeNull();
    // Ordre du DOM : le canevas AVANT le SVG (donc peint dessous, overlays au-dessus).
    expect(canvas!.compareDocumentPosition(svg!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((svg as HTMLElement).style.background).toBe('transparent');
    // La couche monde est peinte au canevas : le SVG ne porte aucun jeton `data-cid`.
    expect(el.querySelectorAll('[data-cid]').length).toBe(0);
  });
});

/**
 * COUTURE DU HIT-TEST DE SPRITE (P2-3) : c'est le MONTAGE de la voie volumique qui bascule le
 * pointeur, rien d'autre. Sans inscription, `targetUnderPointer` retombe sur le hit-test natif — le
 * chemin de la voie affine, inchangé.
 */
describe('Hit-test de sprite — la voie qui peint est celle qui répond (#1176 P2-3)', () => {
  it('SANS écran volumique monté, la question va au DOM (`data-cid`) — le chemin des hôtes SVG restants', () => {
    expect(hasSpritePicker()).toBe(false);
    // Un porteur de `data-cid` quelconque : c'est ce que les hôtes SVG encore vivants (POV, éditeur —
    // morts à C5b) posent sous le pointeur, et ce que le hit-test natif rend.
    const jeton = document.createElement('div');
    jeton.setAttribute('data-cid', 'h1');
    document.body.appendChild(jeton);
    document.elementFromPoint = () => jeton; // jsdom n'a pas de mise en page : le hit-test natif se stubbe
    expect(targetUnderPointer(10, 10)).toEqual({ kind: 'combatant', id: 'h1' });
    delete (document as Partial<Document>).elementFromPoint;
    jeton.remove();
  });

  it('voie VOLUMIQUE : le rayon est inscrit au montage et la question ne va plus au DOM', () => {
    monter();
    expect(hasSpritePicker()).toBe(true);
    document.elementFromPoint = () => {
      throw new Error('le DOM ne doit plus être interrogé en volumique');
    };
    expect(targetUnderPointer(10, 10)).toBeNull(); // aucun contexte WebGL en jsdom : aucune frame, donc aucune caméra
    delete (document as Partial<Document>).elementFromPoint;
  });

  it('…et l’inscription MEURT avec l’écran volumique (retour à l’affine sans rien de collant)', () => {
    monter();
    expect(hasSpritePicker()).toBe(true);
    act(() => root!.unmount());
    root = null;
    expect(hasSpritePicker()).toBe(false);
  });

  it('sous StrictMode (le montage RÉEL) : le double-montage laisse UNE inscription vivante, et rien après', () => {
    monterStrict();
    // React monte, démonte puis remonte les effets : la désinscription du premier passage ne doit pas
    // survivre au second, ni le second laisser un répondeur mort derrière lui.
    expect(hasSpritePicker()).toBe(true);
    act(() => root!.unmount());
    root = null;
    expect(hasSpritePicker()).toBe(false);
  });
});

/**
 * L'ORIENTATION MONDE est lue par le monde volumique, qui la suit : toute écriture de cap
 * (`faceToward`, à chaque pas et à chaque attaque) reforge la table, et l'abonnement vit dans
 * `VolumetricWorld` — le sous-arbre du stage doit donc bien commiter quand elle change.
 *
 * L'orientation est posée sur un id qu'AUCUN jeton de la scène ne porte : un corps abonné à SA propre
 * orientation (`useRigAnim` : `s.facing?.[id]`) reste alors indifférent, et seul l'abonnement à la
 * TABLE ENTIÈRE peut produire un commit — c'est bien celui du monde que la sonde mesure.
 */
const SONDE = '__sonde-orientation'; // aucun jeton ne porte cet id

describe('Orientation monde — le monde volumique la suit (#1176)', () => {
  it('une écriture de cap re-rend le stage (la table y est lue) — la sonde n’est pas inerte', () => {
    const { commits } = monter();
    const avant = commits();
    act(() => { useGame.getState().faceToward(SONDE, { x: 1, y: 0 }, { x: 0, y: 0 }); }); // cap O
    expect(commits()).toBeGreaterThan(avant);
  });
});
