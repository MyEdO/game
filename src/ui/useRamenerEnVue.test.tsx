// @vitest-environment jsdom
/**
 * `useRamenerEnVue` / `ramenerEnVue` (#1806) — le geste de mise en vue, en UN point.
 * Deux contrats, au patron de `MasterDetail.test.tsx` (espion posé sur `Element.prototype`,
 * restauré à la main) : le FRONT MONTANT ne déclenche qu'un appel, et `prefers-reduced-motion`
 * coupe le défilement ANIMÉ sans jamais renoncer à la mise en vue.
 * Le CÂBLAGE de la frise est mesuré ici aussi : au navigateur, l'acteur au trait ne change pas de
 * tour tant que la cascade de Défense gèle le combat (#1852).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { InitiativeStrip } from './InitiativeStrip';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function mockMatchMedia(reduit: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: /prefers-reduced-motion/.test(query) ? reduit : false,
    media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const noop = () => {};
const HAND = { label: 'Pause', ariaLabel: 'Pause au prochain Round', raised: false, onToggle: noop };

function fixtures() {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });
  h.id = 'h1';
  const foe = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brigand', seed: 5 }), id: 'e1', kind: 'enemy' as Combatant['kind'] };
  return { h, foe };
}

describe('useRamenerEnVue — mise en vue de l’acteur au trait', () => {
  let container: HTMLDivElement;
  let root: Root;
  const scrollSpy = vi.fn();
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const originalMatchMedia = window.matchMedia;

  function frise(turn: number, over = false) {
    const { h, foe } = fixtures();
    return (
      <InitiativeStrip order={['e1', 'h1']} turn={turn} round={1} combatants={[h, foe]} over={over}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />
    );
  }

  function mount(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(node); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    // Assignations DIRECTES : `vi.restoreAllMocks` ne les couvre pas (`isolate: false`).
    Element.prototype.scrollIntoView = originalScrollIntoView;
    window.matchMedia = originalMatchMedia;
    scrollSpy.mockClear();
  });

  it('changement de tour : l’entrée AU TRAIT est ramenée en vue, en ’nearest’ sur les deux axes', () => {
    mockMatchMedia(false);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(frise(0));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    act(() => { root.render(frise(1)); });
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });

  it('re-render au MÊME tour : aucun nouvel appel (front montant, pas à chaque render)', () => {
    mockMatchMedia(false);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(frise(0));
    act(() => { root.render(frise(0)); });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('combat TERMINÉ (aucun acteur au trait) : rien à ramener, aucun appel', () => {
    mockMatchMedia(false);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(frise(0, true));
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('prefers-reduced-motion : la mise en vue a lieu, SANS défilement animé', () => {
    mockMatchMedia(true);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(frise(0));
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });

  it('`scrollIntoView` absent (jsdom nu, galeries) : aucune exception', () => {
    mockMatchMedia(false);
    // @ts-expect-error — on RETIRE la méthode pour reproduire l'environnement qui ne l'implémente pas.
    delete Element.prototype.scrollIntoView;
    expect(() => mount(frise(0))).not.toThrow();
  });
});
