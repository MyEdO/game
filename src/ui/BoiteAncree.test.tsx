// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { BoiteAncree, placerAncre, usePlacementAncre } from './BoiteAncree';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('placerAncre — la boîte tient dans le viewport, du côté qui a le plus de place', () => {
  const VW = 1000;
  const VH = 800;
  const L = 320;

  it('ancrage en HAUT → ancrée par le haut (dessous), maxHeight ≤ place disponible dessous', () => {
    const p = placerAncre({ left: 100, right: 180, top: 50, bottom: 70 }, VW, VH, L);
    expect(p.top).toBe(70 + 6);
    expect(p.bottom).toBeUndefined();
    expect(p.maxHeight).toBeLessThanOrEqual(VH - 70);
  });

  it('ancrage en BAS → ancrée par le bas (dessus), jamais hors viewport', () => {
    const p = placerAncre({ left: 100, right: 180, top: 760, bottom: 780 }, VW, VH, L);
    expect(p.bottom).toBe(VH - 760 + 6);
    expect(p.top).toBeUndefined();
    expect(p.maxHeight).toBeLessThanOrEqual(760);
  });

  it('jamais top ET bottom à la fois, quelle que soit la position', () => {
    for (const top of [10, 200, 400, 600, 790]) {
      const p = placerAncre({ left: 0, right: 80, top, bottom: top + 18 }, VW, VH, L);
      expect(p.top === undefined || p.bottom === undefined).toBe(true);
    }
  });

  it('viewport étroit (360px) → largeur et gauche bornées au viewport', () => {
    const p = placerAncre({ left: 950, right: 1030, top: 100, bottom: 120 }, 360, VH, L);
    expect(p.width).toBeLessThanOrEqual(360 - 16);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left).toBeLessThanOrEqual(360 - p.width - 8);
  });

  it('horizontal : alignée sur le bord GAUCHE de l’ancrage quand elle y tient', () => {
    expect(placerAncre({ left: 100, right: 180, top: 100, bottom: 120 }, VW, VH, L).left).toBe(100);
  });

  it('horizontal : alignée sur le bord DROIT de l’ancrage quand la gauche déborde à droite', () => {
    const p = placerAncre({ left: 800, right: 852, top: 100, bottom: 120 }, VW, VH, L);
    expect(p.left).toBe(852 - L);
  });

  it('horizontal : sur la marge de la fenêtre quand les deux alignements débordent', () => {
    const vw = 400;
    const p = placerAncre({ left: 150, right: 250, top: 100, bottom: 120 }, vw, VH, L);
    expect(p.left).toBe(vw - L - 8);
  });

  it('maxHeight plafonné à 0.6×vh', () => {
    const p = placerAncre({ left: 0, right: 80, top: 400, bottom: 420 }, VW, VH, L);
    expect(p.maxHeight).toBeLessThanOrEqual(Math.floor(VH * 0.6));
  });
});

/** Banc : un bouton ouvre une boîte ancrée contre lui ; un effet du commit d'ouverture relève si la
 *  boîte existe déjà (c'est là qu'un emprunt de focus la cherche). */
function Banc({ journal, detacher = false }: { journal: string[]; detacher?: boolean }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const placement = usePlacementAncre(ancre, 320);
  useEffect(() => {
    if (ancre) journal.push(`effet d'ouverture : boîte ${boxRef.current ? 'présente' : 'absente'}`);
  }, [ancre, journal]);
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAncre(detacher ? document.createElement('span') : e.currentTarget)}
      >
        Ancre
      </button>
      {placement && <BoiteAncree ref={boxRef} placement={placement} className="banc-boite">boîte</BoiteAncree>}
    </>
  );
}

describe('usePlacementAncre — le placement naît au commit d’ouverture', () => {
  it('le commit qui reçoit l’ancrage porte déjà la boîte placée', () => {
    const journal: string[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(<Banc journal={journal} />); });
    act(() => { container.querySelector('button')!.click(); });
    expect(journal, 'un effet du commit d’ouverture trouve la boîte').toEqual(["effet d'ouverture : boîte présente"]);
    const boite = document.querySelector<HTMLElement>('.banc-boite')!;
    expect(boite.classList.contains('boite-ancree')).toBe(true);
    for (const v of ['--ancre-left', '--ancre-top', '--ancre-bottom', '--ancre-h', '--ancre-w']) {
      expect(boite.style.getPropertyValue(v), `variable ${v} posée`).toMatch(/^(auto|-?\d+(\.\d+)?px)$/);
    }
    expect(boite.getAttribute('style')).not.toMatch(/(^|;)\s*(top|left|bottom|width|max-height)\s*:/);
    act(() => { root.unmount(); });
    container.remove();
  });

  it('le commit d’ouverture qui déplace l’ancrage : la boîte suit sa position mesurée après ce commit', () => {
    const journal: string[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(<Banc journal={journal} />); });
    const bouton = container.querySelector('button')!;
    let lectures = 0;
    Object.defineProperty(bouton, 'getBoundingClientRect', {
      value: () => { lectures += 1; const top = lectures === 1 ? 100 : 300; return { top, bottom: top + 20, left: 40 }; },
    });
    act(() => { bouton.click(); });
    const boite = document.querySelector<HTMLElement>('.banc-boite')!;
    expect(boite.style.getPropertyValue('--ancre-top'), 'placée à la position de l’ancrage après le commit').toBe(`${300 + 20 + 6}px`);
    act(() => { root.unmount(); });
    container.remove();
  });

  it('un ancrage détaché du document ne pose aucune boîte', () => {
    const journal: string[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(<Banc journal={journal} detacher />); });
    act(() => { container.querySelector('button')!.click(); });
    expect(document.querySelector('.banc-boite'), 'ancrage hors du document : aucune boîte').toBeNull();
    act(() => { root.unmount(); });
    container.remove();
  });

  it('rendu serveur : aucun avertissement d’effet de mise en page', () => {
    const erreurs: unknown[] = [];
    const origine = console.error;
    console.error = (...a: unknown[]) => { erreurs.push(a.join(' ')); };
    try {
      renderToStaticMarkup(<Banc journal={[]} />);
    } finally {
      console.error = origine;
    }
    expect(erreurs.filter((e) => String(e).includes('useLayoutEffect'))).toEqual([]);
  });
});
