// @vitest-environment jsdom
/**
 * Outil VOLÉE de l'éditeur — l'auteur trace une file de cases entre deux surfaces cotées et les cotes
 * s'interpolent par crans franchissables. L'invariant est UNIQUE (`noyau/stairFlight.ts`) : ce fichier
 * mesure d'abord que la MÊME file donne les MÊMES cotes par le chemin ASCII (`cells.stair` de
 * `buildScene`) et par le geste d'éditeur — sans quoi l'extraction ne serait qu'une copie de plus.
 * Puis que le REFUS est lisible à l'écran (raison en français sous le bouton, `GatedAction`) plutôt
 * qu'absorbé en silence.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildScene, type MapSpec } from '../../noyau/mapSpec';
import { heightAt, type Scene } from '../../noyau/monde/scene';
import { planStairFlight, applyStairFlight, type Pt } from './editorState';
import { Palette } from './Palette';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Foyer coté 1 m (F) → 3 cases de volée (E) → galerie cotée 4 m (G) sur la couche 1. */
const BASE = {
  id: 's',
  label: 'S',
  size: [4, 3] as [number, number],
  terrain: 'mur' as const,
  levels: { z0: ['....', 'FEEE', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
  elevate: { F: 1, G: 4 },
};

/** Scène du chemin ASCII : la volée est compilée par la recette `cells.stair`. */
const asciiScene = (): Scene =>
  buildScene({ ...BASE, legend: { F: 'pave', G: 'pierre' }, cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } } } as MapSpec);

/** MÊME carte, sans recette de volée : les cases E ne sont que du sol à 0 m — l'état sur lequel
 *  l'auteur pose sa volée à la main dans l'éditeur. */
const editorBase = (): Scene => buildScene({ ...BASE, legend: { F: 'pave', G: 'pierre', E: 'pierre' } } as MapSpec);

const RUN: Pt[] = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
const cotes = (s: Scene, cells: readonly Pt[]) => cells.map((c) => heightAt(s, c.x, c.y, 0));

describe('volée — invariant PARTAGÉ entre le compilateur ASCII et l’outil d’éditeur', () => {
  it('la même file de cases produit les mêmes cotes par les deux chemins', () => {
    const plan = planStairFlight(editorBase(), RUN, 0, 1);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const posee = applyStairFlight(editorBase(), plan.steps, 0);
    expect(cotes(posee, RUN)).toEqual(cotes(asciiScene(), RUN));
    expect(cotes(posee, RUN)).toEqual([2, 3, 4]); // crans de 1 m entre le foyer (1 m) et la galerie (4 m)
  });

  it('le SENS du tracé ne change rien : la cote suit le relief, pas le geste', () => {
    const plan = planStairFlight(editorBase(), [...RUN].reverse(), 0, 1);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(cotes(applyStairFlight(editorBase(), plan.steps, 0), RUN)).toEqual([2, 3, 4]);
  });

  it('l’outil ne pose AUCUN décor : une volée est de la cote', () => {
    const plan = planStairFlight(editorBase(), RUN, 0, 1);
    if (!plan.ok) throw new Error(plan.reason);
    const posee = applyStairFlight(editorBase(), plan.steps, 0);
    expect(posee.entities.filter((e) => e.kind === 'prop')).toHaveLength(0);
  });

  it('file impossible : le plan REFUSE avec sa raison, aucune cote n’est écrite', () => {
    const branchee = planStairFlight(editorBase(), [...RUN, { x: 2, y: 0 }], 0, 1);
    expect(branchee.ok).toBe(false);
    if (branchee.ok) return;
    expect(branchee.reason).toMatch(/non-linéaire\/ramifiée/);
    const troopCourte = planStairFlight(editorBase(), [{ x: 3, y: 1 }], 0, 1);
    expect(troopCourte.ok).toBe(false);
    if (troopCourte.ok) return;
    expect(troopCourte.reason).toMatch(/insuffisante/);
  });
});

function mountPalette(scene: Scene, stairRun: Pt[], onStairApply = () => {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  return {
    container,
    mount: () =>
      act(() => {
        root.render(
          <Palette
            scene={scene}
            tool={{ mode: 'stair', toZ: 1 }}
            setTool={() => {}}
            brush={1}
            setBrush={() => {}}
            terrainRect={false}
            setTerrainRect={() => {}}
            encTarget=""
            setEncTarget={() => {}}
            encRef=""
            setEncRef={() => {}}
            enemyCreatures={[]}
            currentLayer={0}
            stairRun={stairRun}
            onStairApply={onStairApply}
            onStairClear={() => {}}
            architectureMode={false}
            architectureBodyId={null}
            architectureStoreyId={null}
            architectureAction="select"
            onArchitectureMode={() => {}}
            onArchitectureBody={() => {}}
            onArchitectureStorey={() => {}}
            onAddArchitectureBody={() => {}}
            onAddArchitecturePart={() => {}}
            onAddArchitectureStorey={() => {}}
            onAddRoofSection={() => {}}
            onArmFacade={() => {}}
          />,
        );
      }),
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const applyButton = (container: HTMLElement) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Poser la volée')) as HTMLButtonElement;

describe('outil Volée — le refus est ATTEIGNABLE (jamais absorbé)', () => {
  it('file ramifiée : bouton indisponible + raison en français portée par le bouton', async () => {
    const ui = mountPalette(editorBase(), [...RUN, { x: 2, y: 0 }]);
    await ui.mount();
    const btn = applyButton(ui.container);
    // CONTRAT de `GatedAction` : un contrôle refusé porte `aria-disabled`, jamais `disabled` — il reste
    // atteignable au clavier et à la manette, même quand sa raison est déjà à l'écran.
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.disabled).toBe(false);
    // DIAGNOSTIC D'AUTHORING : la raison reste EN CLAIR sous le bouton (`raisonInline`) — l'auteur
    // corrige sa file d'après ce texte, il ne le découvre pas au survol (exception nommée à l'arbitrage
    // user 2026-08-24, qui vise les cases de jeu).
    const reason = ui.container.querySelector('.gated-action-reason');
    expect(reason?.textContent).toMatch(/non-linéaire\/ramifiée/);
    expect(btn.getAttribute('aria-describedby')).toBe(reason?.id);
    await ui.unmount();
  });

  it('CONTRE-ÉPREUVE — file valide : bouton disponible, aucune raison affichée', async () => {
    let posees = 0;
    const ui = mountPalette(editorBase(), RUN, () => { posees += 1; });
    await ui.mount();
    const btn = applyButton(ui.container);
    expect(btn.getAttribute('aria-disabled'), 'une file valide ne présente aucun refus').toBeNull();
    expect(ui.container.querySelector('.gated-action-reason')).toBeNull();
    await act(async () => btn.click());
    expect(posees).toBe(1);
    await ui.unmount();
  });

  it('le plan est ANNONCÉ avant la pose (cotes lisibles dans la palette)', async () => {
    const ui = mountPalette(editorBase(), RUN);
    await ui.mount();
    expect(ui.container.textContent).toContain('1 m → 4 m');
    expect(ui.container.textContent).toContain('2 · 3 · 4');
    await ui.unmount();
  });
});
