import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { diamondPath, type Dims } from '../../geometry/iso';
import { ExplorePathPreview, TapPreview } from './MoveOverlays';
import type { BattleState } from '../../noyau/etat';
import type { Combatant } from '../../engine/types';

const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };
const path = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 5, y: 0 },
];

describe('ExplorePathPreview', () => {
  it('trace tous les pas et conserve le losange sur la destination réelle', () => {
    const html = renderToStaticMarkup(<ExplorePathPreview path={path} dims={dims} lift={() => 0} />);
    const points = html.match(/<polyline[^>]*points="([^"]+)"/)?.[1].split(' ');

    expect(points).toHaveLength(path.length);
    expect(html).toContain('M416,224 L448,240 L416,256 L384,240 Z');
  });

  it('ne rend aucun SVG pendant une marche', () => {
    expect(renderToStaticMarkup(<ExplorePathPreview path={path} dims={dims} lift={() => 0} walking />)).toBe('');
  });
});

/**
 * APERÇU TAP-1 (tactile) — le geste en deux temps : la première touche montre le trajet et son COÛT,
 * la seconde commet. Il vivait dans la couche de surbrillances affine (`stage/highlightLayer`) et a
 * suivi les overlays d'interaction à la mort de cette voie (#1176 P3-4, commit C5a).
 */
describe('TapPreview — le premier appui montre où l’on va, et ce que ça coûte', () => {
  const héros = { id: 'h1', label: 'h1', kind: 'hero', pos: { x: 1, y: 0 }, size: 'moyenne', conditions: [], characteristics: {}, liveTraits: [], items: [] } as unknown as Combatant;
  // `order`/`turn`/`movementUsed` : le badge dit désormais ce que le geste fait du Mouvement du Tour
  // (`previewResourceDelta` → `activeCombatant`), il lui faut donc un Tour.
  const battleAvec = (preview: unknown): BattleState => ({ combatants: [héros], order: ['h1'], turn: 0, movementUsed: 0, preview } as unknown as BattleState);

  it('un aperçu de MARCHE porte son tracé et le badge de coût', () => {
    const html = renderToStaticMarkup(
      <svg><TapPreview battle={battleAvec({ kind: 'move', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], tile: { x: 1, y: 0 }, cost: 2 })} activeC={héros} dims={dims} liftOf={() => 0} myTurn /></svg>,
    );
    expect(html, 'le badge doit dire le COÛT, pas seulement montrer un trait').toContain('Aller (2)');
    expect(html).toContain('<polyline');
  });

  it('un aperçu d’ATTAQUE marque l’EMPREINTE de la cible', () => {
    const cible = { ...héros, id: 'e1', pos: { x: 3, y: 0 } } as unknown as Combatant;
    const html = renderToStaticMarkup(
      <svg><TapPreview battle={{ combatants: [héros, cible], order: ['h1'], turn: 0, movementUsed: 0, preview: { kind: 'attack', targetId: 'e1', path: [] } } as unknown as BattleState} activeC={héros} dims={dims} liftOf={() => 0} myTurn /></svg>,
    );
    expect(html).toContain('Attaquer');
    // L'empreinte de la cible : le losange de SA case, à l'opacité de marquage (aucune autre forme de
    // cet aperçu ne la porte).
    expect(html.match(/opacity="0.18"/g), 'la case de la cible doit être marquée').toHaveLength(1);
    expect(html, 'et sur la case de la CIBLE (3,0), pas celle de l’attaquant').toContain(diamondPath(3, 0, dims, 0));
  });

  it('AUCUN aperçu hors de son tour, ni sans aperçu armé', () => {
    const armé = battleAvec({ kind: 'move', path: [{ x: 0, y: 0 }], tile: { x: 0, y: 0 }, cost: 1 });
    expect(renderToStaticMarkup(<svg><TapPreview battle={armé} activeC={héros} dims={dims} liftOf={() => 0} myTurn={false} /></svg>)).toBe('<svg></svg>');
    expect(renderToStaticMarkup(<svg><TapPreview battle={battleAvec(null)} activeC={héros} dims={dims} liftOf={() => 0} myTurn /></svg>)).toBe('<svg></svg>');
  });
});
