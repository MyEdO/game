// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dims } from '../../geometry/iso';
import { emptyScene, type Scene } from '../../state/scene';
import { cloisons, piece } from '../../state/pieces.fixture';
import { aretesUtilisables } from '../../state/aretes';
import { projeterAretes, type AreteProjetee } from './aretesProjetees';
import { AreteOverlay } from './AreteOverlay';

/**
 * CONTRAT DU PEINTRE UNIQUE (#1687, lot 1b-3). `AreteOverlay` rend les TROIS capacités que la chaîne
 * sert — seuil, escalade, chute — par une table de matière, et ne prend pas le pointeur : la chaîne de
 * picking résout l'arête (`stage/pickResolve.ts:areteSousLePixel`) et lui tend son verdict. Lui restent
 * SON tracé — dont la parité avec la géométrie que le picking résout, tenue parce que le segment lui
 * est DONNÉ et jamais reprojeté — et l'activation AU CLAVIER, seule chose que la chaîne ne rend pas.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };
/** Accès que la pièce (1,1) du contrôleur perce : un PASSAGE vers la pièce (2,1) à l'est, une SORTIE
 *  extérieure ouverte au nord, une porte FERMÉE vers la pièce (0,1) à l'ouest. Un accès absent est muré,
 *  comme le côté sud. */
type Acces = 'passage' | 'sortie' | 'fermee';
function scèneDePièces(acces: readonly Acces[]): Scene {
  const s = emptyScene(dims.w, dims.h);
  s.effectZones = [piece('room-a', 1, 1), piece('room-b', 2, 1), piece('room-c', 0, 1)];
  s.walls = [
    ...cloisons(1, 1, ['S', ...(acces.includes('passage') ? [] : ['E' as const])]),
    acces.includes('sortie') ? { x: 1, y: 1, side: 'N', door: true, closed: false } : { x: 1, y: 1, side: 'N' },
    acces.includes('fermee') ? { x: 0, y: 1, side: 'E', door: true, closed: true } : { x: 0, y: 1, side: 'E' },
  ];
  return s;
}

/** Ce que l'hôte tend au peintre : les arêtes du DÉRIVEUR, projetées par la MÊME fonction que le
 *  picking consulte — aucune géométrie n'est fabriquée pour le banc. */
const projete = (acces: readonly Acces[], visible: string[]): readonly AreteProjetee[] => projeterAretes(
  aretesUtilisables({ scene: scèneDePièces(acces), visible: new Set(visible), controleur: { x: 1, y: 1, z: 0 }, activeZ: 0 }),
  dims,
  () => 0,
);

/** Scène 5×4 : une arête grimpable en (1,1,E), la case d'en face (2,1) 4 m plus haut — le mobile s'y
 *  tient (même scène que celle du dériveur, `state/aretes.test.ts`). */
function scèneGrimpable(): Scene {
  const s = emptyScene(5, 4);
  const h = new Array(5 * 4).fill(0) as number[];
  h[1 * 5 + 2] = 4;
  s.layers[0].height = h;
  s.walls = [{ x: 1, y: 1, side: 'E', climb: { kind: 'surface' } }];
  return s;
}

/** Scène 5×4 : une CORNICHE — toute la rangée y=0 à 4 m, le reste au sol, sans arête `climb`. Depuis
 *  (2,0), seul le cardinal SUD descend. */
function scèneDeFalaise(): Scene {
  const s = emptyScene(5, 4);
  const h = new Array(5 * 4).fill(0) as number[];
  for (let x = 0; x < 5; x += 1) h[x] = 4;
  s.layers[0].height = h;
  return s;
}

/** Les arêtes de DÉNIVELÉ des deux scènes ci-dessus, dérivées puis projetées comme l'hôte le fait. */
const denivele = (scene: Scene, controleur: { x: number; y: number; z: number }, visible: string[]): readonly AreteProjetee[] => projeterAretes(
  aretesUtilisables({ scene, visible: new Set(visible), controleur, activeZ: 0 }),
  dims,
  () => 0,
);
const ESCALADE = () => denivele(scèneGrimpable(), { x: 1, y: 1, z: 0 }, ['1,1,0', '2,1,0']);
const CHUTE = () => denivele(scèneDeFalaise(), { x: 2, y: 0, z: 0 }, ['2,0,0', '2,1,0']);

const lineLength = (line: Element): number => Math.hypot(
  Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
  Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
);

describe('AreteOverlay — peintre unique des arêtes utilisables', () => {
  let root: Root | null = null;
  /** Conteneur ATTACHÉ au document (le focus n'existe que dans un arbre connecté) — détaché quoi
   *  qu'il arrive, y compris quand une assertion rompt le test. */
  let attache: HTMLElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    attache?.remove();
    attache = null;
  });

  it('distingue passage, porte et sortie sans peindre les labels de zones', () => {
    const html = renderToStaticMarkup(
      <svg>
        <AreteOverlay
          aretes={projete(['passage', 'sortie'], ['1,1,0', '2,1,0', '1,0,0'])}
          areteSurvolee={null}
          activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined}
        />
      </svg>,
    );

    expect(html).toContain('portal-passage');
    expect(html).toContain('portal-exterior');
    expect(html).toContain('<title>Passage vers une autre pièce</title>');
    expect(html).toContain('<title>Sortie extérieure</title>');
    expect(html).not.toContain('room-a');
    expect(html).not.toContain('room-b');
  });

  it('n’a AUCUN handler de pointeur : les marques restent hors hit-test, le trait qui nomme le garde et laisse l’événement remonter', () => {
    // Le pixel est résolu par la chaîne, jamais par la cible — mais le nom au survol est ici une
    // infobulle NATIVE, que seul un élément hit-testable montre. Le trait de prise garde donc son
    // hit-test SANS handler : le `pointerdown` bulle jusqu'au SVG racine du stage.
    for (const aretes of [projete(['passage'], ['1,1,0']), ESCALADE(), CHUTE()]) {
      const capacite = aretes[0].arete.capacite;
      const activerArete = vi.fn();
      const aLaRacine = vi.fn();
      const container = document.createElement('div');
      attache = container;
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => root!.render(
        <svg onPointerDown={aLaRacine}>
          <AreteOverlay
            aretes={aretes}
            areteSurvolee={null}
            activerArete={activerArete} onFocusArete={() => undefined} onBlurArete={() => undefined}
          />
        </svg>,
      ));
      const prise = container.querySelector('[data-arete-cible]')!;
      const marques = [...container.querySelectorAll('line, path')].filter((el) => el !== prise);

      expect(marques.length, capacite).toBeGreaterThan(0);
      expect(marques.every((el) => el.getAttribute('pointer-events') === 'none'), capacite).toBe(true);
      expect(prise.querySelector('title')?.textContent, capacite).toBe(aretes[0].arete.libelle);
      expect(prise.getAttribute('pointer-events'), capacite).toBe('visibleStroke');

      act(() => prise.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
      expect(aLaRacine.mock.calls, capacite).toHaveLength(1);
      expect(activerArete, capacite).not.toHaveBeenCalled();

      act(() => root!.unmount());
      root = null;
      container.remove();
      attache = null;
    }
  });

  it('expose un bouton nommé et activable au clavier POUR CHAQUE capacité, qui appelle LE geste de l’arête', () => {
    for (const aretes of [projete(['passage'], ['1,1,0']), ESCALADE(), CHUTE()]) {
      const activerArete = vi.fn();
      const container = document.createElement('div');
      root = createRoot(container);
      act(() => root!.render(
        <svg>
          <AreteOverlay aretes={aretes} areteSurvolee={null} activerArete={activerArete} onFocusArete={() => undefined} onBlurArete={() => undefined} />
        </svg>,
      ));
      const target = container.querySelector('[data-arete-cible]')!;

      expect(target.getAttribute('role')).toBe('button');
      expect(target.getAttribute('aria-label')).toBe(aretes[0].arete.libelle);
      expect(target.getAttribute('tabindex')).toBe('0');
      act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
      act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));

      expect(activerArete.mock.calls, aretes[0].arete.capacite).toEqual([[aretes[0].arete], [aretes[0].arete]]);
      act(() => root!.unmount());
      root = null;
    }
  });

  it('au FOCUS clavier, l’arête atteinte porte l’accent — et le perd au blur', () => {
    // L'arête est un trait TRANSPARENT sans contour de navigateur : son rendu de focus EST l'accent du
    // survol, posé par le même état que le pointeur (`areteSurvolee`, une CLÉ). Sans ce canal, le Tab
    // n'affiche rien et le geste n'est pas armé (deux Entrée sur un appareil sans survol).
    const aretes = projete(['passage', 'sortie'], ['1,1,0', '1,0,0']);
    function Harnais() {
      const [survolee, setSurvolee] = useState<string | null>(null);
      return (
        <svg>
          <AreteOverlay
            aretes={aretes}
            areteSurvolee={survolee}
            activerArete={() => undefined}
            onFocusArete={(arete) => setSurvolee(arete.cle)}
            onBlurArete={() => setSurvolee(null)}
          />
        </svg>
      );
    }
    const container = document.createElement('div');
    attache = container;
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Harnais />));
    const cibles = [...container.querySelectorAll('[data-arete-cible]')] as SVGElement[];
    const accents = () => [...container.querySelectorAll('[data-portal-visual="accent"]')];
    const nomAccentué = () => container.querySelector('.portal-highlight [data-arete-cible]')?.getAttribute('aria-label') ?? null;

    expect(cibles).toHaveLength(2);
    expect(accents(), 'rien n’est accentué tant que rien n’est atteint').toHaveLength(0);

    act(() => cibles[1].focus());
    expect(accents(), 'le seuil focalisé porte l’accent').toHaveLength(1);
    expect(nomAccentué()).toBe(aretes[1].arete.libelle);

    act(() => cibles[1].blur());
    expect(accents(), 'quitté, il le perd').toHaveLength(0);
  });

  it('trace l’arête à la LARGEUR DE PRISE du dériveur, et sur le segment qu’il a reçu', () => {
    for (const aretes of [projete(['passage'], ['1,1,0']), ESCALADE(), CHUTE()]) {
      const container = document.createElement('div');
      container.innerHTML = renderToStaticMarkup(
        <svg>
          <AreteOverlay aretes={aretes} areteSurvolee={null} activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined} />
        </svg>,
      );
      const target = container.querySelector('[data-arete-cible]')!;

      expect(Number(target.getAttribute('stroke-width')), aretes[0].arete.capacite).toBe(aretes[0].arete.largeurPrise);
      expect([
        Number(target.getAttribute('x1')), Number(target.getAttribute('y1')),
        Number(target.getAttribute('x2')), Number(target.getAttribute('y2')),
      ]).toEqual([aretes[0].a.cx, aretes[0].a.cy, aretes[0].b.cx, aretes[0].b.cy]);
    }
  });

  it('limite les marqueurs passifs au milieu du seuil sans ligne visible pleine arête', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <svg>
        <AreteOverlay
          aretes={projete(['passage', 'sortie', 'fermee'], ['1,1,0', '2,1,0', '0,1,0'])}
          areteSurvolee={null}
          activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined}
        />
      </svg>,
    );
    const targets = [...container.querySelectorAll('[data-arete-cible]')];
    const passiveLines = [...container.querySelectorAll('[data-portal-visual="passive"]')];

    expect(targets).toHaveLength(3);
    expect(targets.every((target) => target.getAttribute('stroke') === 'transparent')).toBe(true);
    expect(passiveLines.length).toBeGreaterThanOrEqual(3);
    expect(passiveLines.every((line) => lineLength(line) <= 12)).toBe(true);
    expect(passiveLines.every((line) => Number(line.getAttribute('stroke-width')) <= 2)).toBe(true);
    expect(passiveLines.every((line) => Number(line.getAttribute('opacity')) <= 0.38)).toBe(true);
    expect(container.querySelector('[data-portal-symbol="closed"]')).not.toBeNull();
    const exteriorSymbol = container.querySelector('[data-portal-symbol="exterior"]');
    expect(exteriorSymbol).not.toBeNull();
    expect(exteriorSymbol?.getAttribute('fill')).toBe('none');
  });

  it('ajoute au seul seuil survolé un accent local et modeste', () => {
    const aretes = projete(['passage', 'sortie'], ['1,1,0']);
    const survolee = aretes.find(({ arete }) => arete.portail?.exterior)!.arete.cle;
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <svg>
        <AreteOverlay
          aretes={aretes}
          areteSurvolee={survolee}
          activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined}
        />
      </svg>,
    );
    const accents = [...container.querySelectorAll('[data-portal-visual="accent"]')];

    expect(container.querySelectorAll('.portal-highlight')).toHaveLength(1);
    expect(accents).toHaveLength(1);
    expect(lineLength(accents[0])).toBeLessThanOrEqual(18);
    expect(Number(accents[0].getAttribute('stroke-width'))).toBeLessThanOrEqual(3.5);
    expect(Number(accents[0].getAttribute('opacity'))).toBeLessThanOrEqual(0.95);
  });

  it('escalade et chute partagent LE MÊME trait de dénivelé, sur toute l’arête, et se nomment', () => {
    // Verdict de design du 2026-09-10 : peintre commun pour les deux gestes de dénivelé (même trait,
    // même encre, même 9 px) ; ce qui les sépare est leur SOURCE et leur libellé.
    const attendus = [
      { aretes: ESCALADE(), capacite: 'escalade', libelle: 'Escalader' },
      { aretes: CHUTE(), capacite: 'chute', libelle: 'Sauter en bas (4 m)' },
    ];
    for (const { aretes, capacite, libelle } of attendus) {
      const container = document.createElement('div');
      container.innerHTML = renderToStaticMarkup(
        <svg>
          <AreteOverlay aretes={aretes} areteSurvolee={null} activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined} />
        </svg>,
      );
      const trait = container.querySelector(`[data-arete-trait="${capacite}"]`)!;

      expect(aretes, capacite).toHaveLength(1);
      expect(trait, capacite).not.toBeNull();
      expect(trait.getAttribute('stroke')).toBe('var(--iso-climb)');
      expect(trait.getAttribute('stroke-width')).toBe('9');
      expect(trait.getAttribute('stroke-dasharray')).toBe('3 5');
      expect(Number(trait.getAttribute('opacity'))).toBe(0.5);
      expect(lineLength(trait)).toBeCloseTo(lineLength(container.querySelector('[data-arete-cible]')!), 6);
      expect(container.querySelector('title')?.textContent).toBe(libelle);
      expect(container.querySelector('[data-portal-visual]'), 'aucun marqueur de seuil sur un dénivelé').toBeNull();
    }
  });

  it('l’arête de dénivelé ARMÉE (survol, focus, tap-1) devient franche', () => {
    const aretes = ESCALADE();
    const opacite = (survolee: string | null) => {
      const container = document.createElement('div');
      container.innerHTML = renderToStaticMarkup(
        <svg>
          <AreteOverlay aretes={aretes} areteSurvolee={survolee} activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined} />
        </svg>,
      );
      return Number(container.querySelector('[data-arete-trait="escalade"]')!.getAttribute('opacity'));
    };

    expect(opacite(null)).toBe(0.5);
    expect(opacite('une-autre-arete'), 'l’accent ne suit que la clé survolée').toBe(0.5);
    expect(opacite(aretes[0].arete.cle)).toBe(0.95);
  });
});
