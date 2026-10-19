// @vitest-environment jsdom
/**
 * #399 : replier/déplier un cluster (`<details className="fold">`) de la barre de catégories ne
 * doit jamais crasher — `toggle` sur `<details>` ne bulle pas (spec HTML), React l'écoute donc en
 * DIRECT sur le nœud (hors flush synchrone du batching d'événement délégué). Le natif remet
 * `currentTarget` à `null` dès la fin du `dispatchEvent` ; lire `e.currentTarget.open` depuis le
 * CORPS d'un updater `setState` (appliqué plus tard, au rendu suivant) au lieu de le capturer
 * SYNCHRONEMENT dans le handler lève `Cannot read properties of null (reading 'open')`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { Component, type ReactNode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CompendiumScreen } from './CompendiumScreen';
// `new URL(rel, import.meta.url)` est détourné par l'implémentation URL de jsdom (base du document) :
// la résolution passe par le chemin du module.
const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_CSS = readFileSync(join(HERE, '..', 'styles', 'components.css'), 'utf8');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

describe('CompendiumScreen — toggle des clusters repliables (#399)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let boundary: Boundary;
  const originalOnError = window.onerror;

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    window.onerror = originalOnError;
  });

  it('replier/déplier un cluster de la famille Tables ne crashe pas (currentTarget lu APRÈS reset natif)', async () => {
    window.onerror = () => true; // React reporte l'erreur non-attrapée via window.onerror en jsdom
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    let boundaryRef: Boundary | null = null;
    act(() => {
      root.render(
        <Boundary ref={(r) => { boundaryRef = r; }}>
          <CompendiumScreen />
        </Boundary>,
      );
    });
    boundary = boundaryRef!;

    const groupBtns = [...container.querySelectorAll('.codex-groups button')] as HTMLButtonElement[];
    const tablesBtn = groupBtns.find((b) => b.textContent?.trim() === 'Tables')!;
    act(() => { tablesBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const fold = container.querySelector('details.fold') as HTMLDetailsElement;
    const wasOpen = fold.open;

    // Dispatch HORS `act` synchrone : laisse le natif terminer (et nuller `currentTarget`) avant
    // que le prochain tick applique l'updater `setManualOpen` en file — reproduit la fenêtre où
    // le crash a été vu en production (mise à jour d'état DÉFÉRÉE au-delà de la fin du dispatch).
    fold.open = !wasOpen;
    fold.dispatchEvent(new Event('toggle', { bubbles: false }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(boundary.state.error).toBeNull();
    expect(fold.open).toBe(!wasOpen);
  });
});

/**
 * #896 : sous 700px la barre des 7 groupes (`CODEX_GROUPS`) débordait sans échappatoire — elle
 * était rendue par `OptionChooser layout="seg"` (`.seg`, `src/ui/styles/sheet.css`), une primitive
 * bâtie `width: fit-content` + `overflow: hidden` pour peu d'options SUR UNE LIGNE (Parade/Esquive…),
 * jamais pensée pour une navigation à 7 entrées. Mesuré en recette à 360px : 3 des 7 groupes
 * (Magie/Monde/Tables) inatteignables, aucune affordance. Ce sont des onglets de NAVIGATION —
 * `<Tabs>` (`src/ui/composites/Tabs.tsx`) est la primitive faite pour ça : `.tabs` s'enroule déjà
 * (`flex-wrap: wrap`, `components.css`), role=tablist/tab + roving tabindex inclus gratuitement.
 * jsdom ne calcule pas de layout réel (pas de `scrollWidth`/`overflow` fiables) — la preuve de
 * non-troncature à 360px reste la recette navigateur ; ici on verrouille la STRUCTURE accessible.
 */
describe('CompendiumScreen — 7 groupes atteignables (#896)', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('les 7 groupes sont organisés en barre de navigation ACCESSIBLE (role=tablist) de 7 onglets', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CompendiumScreen />); });

    const groupBar = container.querySelector('.codex-groups');
    expect(groupBar, '.codex-groups introuvable').toBeTruthy();
    expect(groupBar!.querySelector('.seg'), 'les groupes utilisent encore `.seg` (#896 : non-enroulable, non-scrollable)').toBeNull();

    const tabsContainer = groupBar!.querySelector('.tabs');
    expect(tabsContainer, 'conteneur d\'onglets introuvable').toBeTruthy();
    expect(tabsContainer!.getAttribute('role')).toBe('tablist');
    
    const tabs = [...tabsContainer!.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde', 'Tables']);
  });

  it('le conteneur `.tabs` s\'enroule (`flex-wrap: wrap`, composé depuis `components.css` — jamais un `overflow` sans échappatoire)', () => {
    const tabsRule = COMPONENTS_CSS.match(/\.tabs \{[^}]*\}/);
    expect(tabsRule, '`.tabs` introuvable dans components.css').toBeTruthy();
    expect(tabsRule![0]).toMatch(/flex-wrap:\s*wrap/);
  });
});
