// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../noyau/monde/scene';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { hasSpritePicker, targetUnderPointer } from './spritePicker';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';

/** Le canevas porte le monde ; le SVG porte les prises et les overlays d'interaction. */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Renderer de BANC : jsdom n'a aucun contexte WebGL, et un contexte refusé fait DIRE le refus au
 *  joueur (`stage/SansWebgl`) au lieu de peindre. Sans banc, ce fichier mesurerait ce message. */
brancherArdoise();

beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', species: 'humains-reiklander', pos, size: 'moyenne',
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
    scene: emptyScene('scene-test', 6, 6),
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

/** Monte le stage sur la scène minimale. */
function monter(): HTMLDivElement {
  poserEtat();
  act(() => root!.render(<MondeDeCampagne />));
  return container!;
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
    const el = monter();
    const canvas = el.querySelector('canvas.iso-stage');
    const svg = el.querySelector('svg.iso-stage');
    expect(canvas).not.toBeNull();
    expect(svg).not.toBeNull();
    // Ordre du DOM : le canevas AVANT le SVG (donc peint dessous, overlays au-dessus).
    expect(canvas!.compareDocumentPosition(svg!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((svg as HTMLElement).style.background).toBe('transparent');
    // Cette scène vide ne porte aucune prise de structure.
    expect(el.querySelectorAll('[data-cid]').length).toBe(0);
  });
});

/** L'inscription du lanceur choisit la réponse WebGL ; son absence active le repli DOM. */
describe('Hit-test de sprite — la voie qui peint est celle qui répond (#1176 P2-3)', () => {
  it('sans lanceur inscrit, le repli DOM lit la prise d’une structure', () => {
    expect(hasSpritePicker()).toBe(false);
    // `AreteOverlay` pose la prise de structure sur une ligne SVG.
    const jeton = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    jeton.setAttribute('data-cid', 'structure-1');
    document.body.appendChild(jeton);
    document.elementFromPoint = () => jeton; // jsdom n'a pas de mise en page : le hit-test natif se stubbe
    expect(targetUnderPointer(10, 10)).toEqual({ kind: 'combatant', id: 'structure-1' });
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

