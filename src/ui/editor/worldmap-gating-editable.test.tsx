// @vitest-environment jsdom
/**
 * #684 L3 — le GATING de carte est ÉDITABLE au studio : `MapPlace.when` (« Visible si ») et
 * `MapRoute.when`/`refus` (« Praticable si » + raison), par la SOURCE UNIQUE `WhenEditor`
 * (« Toujours » ↔ `undefined`). Trois contrats : le lieu pose/retire sa condition ; la route
 * dit à l'auteur, AVANT toute sauvegarde, que `refus` est exigé dès qu'un `when` est posé
 * (`mapRouteSchema.superRefine`, `src/data/schemas/defs-scenes/worldmap.ts`) ; l'offre de kinds
 * est BORNÉE par `CONDITION_KINDS_CARTE` — un kind non évaluable au contexte de la carte
 * (`compare`, `slThreshold`…) n'est pas proposable.
 * Harnais contrôlé du patron `WorldMapEditor.test.tsx`.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapEditor } from './WorldMapEditor';
import { emptyWorldMap, type WorldMap, type MapPlace, type MapRoute } from '../../state/worldMap';
import { emptyScene, type Scene } from '../../state/scene';
import { CONDITION_KINDS_CARTE } from '../../data/schemas/defs-scenes/worldmap';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let lastMap: WorldMap | null;

function scenes(): Scene[] {
  return [
    { ...emptyScene(), id: 's1', label: 'Scène Un' },
    { ...emptyScene(), id: 's2', label: 'Scène Deux' },
  ];
}

function baseMap(): WorldMap {
  const m = emptyWorldMap();
  const place: MapPlace = { id: 'p1', label: 'Altdorf', pos: { x: 10, y: 10 }, scene: 's1' };
  const place2: MapPlace = { id: 'p2', label: 'Marienburg', pos: { x: 40, y: 20 }, scene: 's2' };
  const route: MapRoute = { id: 'r1', a: 'p1', b: 'p2', km: 20, modes: ['pied'] };
  return { ...m, places: [place, place2], routes: [route] };
}

function Harness() {
  const [m, setM] = useState<WorldMap | null>(baseMap());
  const [axes, setAxes] = useState<string[] | undefined>(undefined);
  lastMap = m;
  return <WorldMapEditor map={m} setMap={setM} scenes={scenes()} objets={[]} onClose={() => {}} activeAxes={axes} setActiveAxes={setAxes} />;
}

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Harness />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function click(el: Element) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function selectPlace(label: string) {
  const g = [...container.querySelectorAll('svg > g[transform]')].find((e) => e.querySelector('text')?.textContent === label);
  if (!g) throw new Error(`lieu « ${label} » introuvable`);
  act(() => { g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
}
function selectRoute() {
  const g = container.querySelector('svg g[style*="cursor: pointer"]');
  if (!g) throw new Error('route introuvable');
  click(g);
}
/** Le sélecteur de kind du `WhenEditor` du panneau ouvert (un seul `when` par onglet). */
function kindSelect(): HTMLSelectElement {
  const el = container.querySelector('select.cond-kind');
  if (!el) throw new Error('éditeur de condition introuvable dans le panneau');
  return el as HTMLSelectElement;
}
function flagInput(): HTMLInputElement {
  const el = container.querySelector('input.cond-flag');
  if (!el) throw new Error('champ de flag introuvable');
  return el as HTMLInputElement;
}
function refusInput(): HTMLInputElement | null {
  const wrap = [...container.querySelectorAll('.ed-field, label')].find((e) => (e.textContent ?? '').includes('Raison du refus'));
  return (wrap?.querySelector('input') ?? null) as HTMLInputElement | null;
}
function alerte(): string | null {
  return container.querySelector('[role="alert"]')?.textContent ?? null;
}

describe('#684 L3 — panneau LIEU : « Visible si » (MapPlace.when)', () => {
  it('pose une condition de visibilité puis la retire (« Toujours » = pas de condition)', () => {
    mount();
    selectPlace('Altdorf');
    expect(lastMap!.places[0].when).toBeUndefined();
    expect(kindSelect().value).toBe('always');

    setValue(kindSelect(), 'flag');
    setValue(flagInput(), 'altdorf-revele');
    expect(lastMap!.places[0].when).toEqual({ kind: 'flag', expr: 'altdorf-revele' });

    setValue(kindSelect(), 'always');
    expect(lastMap!.places[0].when).toBeUndefined();
  });
});

describe('#684 L3 — panneau ROUTE : « Praticable si » + raison du refus (MapRoute.when/refus)', () => {
  it('exige la raison du refus dès qu’une condition est posée, et la pose', () => {
    mount();
    selectRoute();
    expect(refusInput()).toBeNull();
    expect(alerte()).toBeNull();

    setValue(kindSelect(), 'flag');
    setValue(flagInput(), 'pont-repare');
    expect(lastMap!.routes[0].when).toEqual({ kind: 'flag', expr: 'pont-repare' });

    // L'exigence du schéma est dite À L'ÉCRAN, avant toute sauvegarde.
    expect(alerte()).toMatch(/[Rr]aison du refus/);

    setValue(refusInput()!, 'Le pont est coupé par la crue.');
    expect(lastMap!.routes[0].refus).toBe('Le pont est coupé par la crue.');
    expect(alerte()).toBeNull();

    // Retour à « Toujours » : la raison part avec la condition (pas de `refus` orphelin en donnée).
    setValue(kindSelect(), 'always');
    expect(lastMap!.routes[0].when).toBeUndefined();
    expect(lastMap!.routes[0].refus).toBeUndefined();
  });
});

describe('#684 L3 — l’offre de kinds est bornée par le contexte de la carte', () => {
  it('ne propose QUE les kinds évaluables (CONDITION_KINDS_CARTE), lieu et route', () => {
    mount();

    selectPlace('Altdorf');
    const offreLieu = [...kindSelect().options].map((o) => o.value);
    expect(new Set(offreLieu)).toEqual(new Set(CONDITION_KINDS_CARTE));
    // Un kind qui lit `target`/`sl` serait FAUX en silence sur la carte : jamais proposable.
    expect(offreLieu).not.toContain('compare');
    expect(offreLieu).not.toContain('slThreshold');
    expect(offreLieu).toContain('flag');

    selectRoute();
    const offreRoute = [...kindSelect().options].map((o) => o.value);
    expect(new Set(offreRoute)).toEqual(new Set(CONDITION_KINDS_CARTE));
  });
});
