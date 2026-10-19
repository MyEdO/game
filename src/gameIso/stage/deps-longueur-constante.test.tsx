// @vitest-environment jsdom
/**
 * DÉPENDANCES DE RÉTENTION À LONGUEUR VARIABLE — le read-set de la cuisson (`worldBakeDeps`) porte une
 * entrée par RECETTE volumique EMPLOYÉE et une par MATÉRIAU qu'elles nomment, chacune une seule fois
 * (`depsUniques`, `backends/webgl/sceneMeshes.ts`) : sa longueur suit le catalogue EMPLOYÉ, donc CHANGE
 * dès qu'une scène en remplace une autre qui pose d'autres recettes.
 *
 * Deux faits mesurés ici, sur l'écran MONTÉ :
 *  1. aucun avertissement React « changed size between renders » — un tel jeu de dépendances ne peut
 *     pas être remis tel quel à un hook React, qui exige une longueur CONSTANTE (le porteur est le
 *     retenteur du dépôt, `noyau/monde/sceneMemo.memoByRefDeps`, qui compare longueur PUIS identité) ;
 *  2. et la rétention qu'il porte ne bouge pas d'un pouce : rien de recalculé à un rendu de plus,
 *     tout au changement de scène.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';
import { MondeDeCampagne } from './MondeDeCampagne';
import { useGame } from '../../state/store';
import { emptyScene, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import { worldBakeDeps } from '../backends/webgl/sceneMeshes';
import * as roofs from '../builders/roofs';
import { findPropById } from '../../data';
import type { Combatant } from '../../engine/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

/** Des décors du catalogue qui portent VRAIMENT chacun une recette volumique DISTINCTE : ce sont
 *  elles qui pèsent dans le read-set de la cuisson (une entrée par recette employée). */
const REFS_VOLUMIQUES = ['caisse', 'tonneau', 'coffre', 'urne'] as const;

function décor(id: string, ref: string, x: number): SceneEntity {
  return { id, kind: 'prop', ref, pos: { x, y: 1 } } as SceneEntity;
}

/** Scène de 6×6 portant les `n` premières recettes volumiques de `REFS_VOLUMIQUES`, une instance chacune. */
function scèneAvec(n: number): Scene {
  const scene = emptyScene(6, 6);
  for (let i = 0; i < n; i++) scene.entities.push(décor(`vol-${i}`, REFS_VOLUMIQUES[i], i));
  return scene;
}

function poser(scene: Scene) {
  useGame.setState({
    scene,
    mode: 'exploration',
    partyPos: { x: 2, y: 2 },
    party: [hero('h1', { x: 2, y: 2 })],
    battle: null,
    dialogue: null,
    flags: {},
  });
}

describe('GameStage3D — le read-set de la cuisson n’est jamais remis tel quel à un hook React', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let erreurs: string[] = [];

  beforeEach(() => {
    erreurs = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { erreurs.push(args.map(String).join(' ')); });
  });

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('prémisse : la longueur du read-set SUIT le nombre de recettes volumiques employées', () => {
    for (const ref of REFS_VOLUMIQUES) expect(findPropById(ref)?.volume, `${ref} doit porter une recette`).toBeTruthy();
    const court = worldBakeDeps(scèneAvec(1), 1).length;
    const long = worldBakeDeps(scèneAvec(4), 1).length;
    expect(long).toBeGreaterThan(court);
  });

  it('un changement de scène qui change les recettes volumiques employées n’émet AUCUN avertissement de taille', () => {
    poser(scèneAvec(1));
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));

    act(() => { poser(scèneAvec(4)); });
    act(() => root!.render(<MondeDeCampagne />));

    expect(erreurs.filter((e) => e.includes('changed size between renders'))).toEqual([]);
  });

  it('…et la RÉTENTION du champ de couvert reste celle du read-set : rien au rendu de plus, tout au changement de scène', () => {
    const spy = vi.spyOn(roofs, 'shelterField');
    poser(scèneAvec(1));
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    const auMontage = spy.mock.calls.length;
    expect(auMontage).toBeGreaterThan(0);

    // Un rendu de PLUS, rien changé : le couvert ne se recalcule pas.
    act(() => root!.render(<MondeDeCampagne />));
    expect(spy.mock.calls.length).toBe(auMontage);

    // Une scène NEUVE (recettes volumiques différentes) : il se recalcule.
    act(() => { poser(scèneAvec(4)); });
    act(() => root!.render(<MondeDeCampagne />));
    expect(spy.mock.calls.length).toBeGreaterThan(auMontage);
  });
});
