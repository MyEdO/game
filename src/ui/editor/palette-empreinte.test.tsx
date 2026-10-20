// @vitest-environment jsdom
/**
 * CHIP D'EMPREINTE de la palette de décors — ce que l'auteur lit AVANT de poser (#1509 L7′).
 *
 * Deux moitiés d'un même contrat : la chip ne dit quelque chose que d'un décor qui DÉPASSE sa case
 * (un 1×1 n'a rien à annoncer, et vingt chips « 1×1 » ne seraient que du bruit), et ce qu'elle
 * annonce est l'empreinte DÉRIVÉE du corps, à l'échelle de la scène éditée, au CAP D'IDENTITÉ — la
 * palette n'a pas d'instance, donc pas de cap ; c'est l'inspecteur qui annonce au cap réel
 * (`Inspector.test.tsx`).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { Palette } from './Palette';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function monter(scene: Scene) {
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
            tool={{ mode: 'entity', kind: 'prop', ref: 'tonneau' }}
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
            stairRun={[]}
            onStairApply={() => {}}
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

/** La chip d'un décor de la liste, ou `null` s'il n'en porte pas. */
const chipDe = (container: HTMLElement, label: string): string | null => {
  const item = [...container.querySelectorAll('button.pal-item')].find((b) => b.textContent?.startsWith(label));
  expect(item, `décor « ${label} » absent de la palette`).toBeTruthy();
  return item!.querySelector('.chip')?.textContent ?? null;
};

describe('Palette — la chip d’empreinte annonce ce que la scène posera', () => {
  it('se tait pour un décor d’une case, et annonce les cases de ceux qui dépassent', async () => {
    const h = monter(emptyScene('scene-test', 8, 8)); // aucun `metresPerTile` posé : le défaut du monde, 2 m/case
    await h.mount();
    expect(chipDe(h.container, 'Tonneau')).toBeNull();
    expect(chipDe(h.container, 'Chaise')).toBeNull();
    // Les deux recettes multi-case du catalogue, au cap d'identité : 3,80 m et 3,00 m de long.
    expect(chipDe(h.container, 'Table longue')).toBe('2×1');
    expect(chipDe(h.container, 'Table murale et 2 tabourets')).toBe('2×1');
    await h.unmount();
  });

  it('suit l’ÉCHELLE de la scène éditée : à 4 m/case, la table longue retombe sur une case', async () => {
    const h = monter({ ...emptyScene('scene-test', 8, 8), metresPerTile: 4 });
    await h.mount();
    expect(chipDe(h.container, 'Table longue')).toBeNull();
    expect(chipDe(h.container, 'Table murale et 2 tabourets')).toBeNull();
    await h.unmount();
  });
});
