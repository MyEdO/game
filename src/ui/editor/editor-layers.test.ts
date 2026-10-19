import { describe, it, expect } from 'vitest';
import { emptyScene, surfaceLink } from '../../noyau/monde/scene';
import { pathTo } from '../../noyau/monde/path';
import { addLayer, fillTerrainRect, paintHeight } from './editorState';

/**
 * Multi-couche à l'éditeur SANS escalier. La façon de relier deux couches : `addLayer` pose la surface
 * supérieure (tablier/passerelle), `fillTerrainRect` la rend
 * marchable, et `paintHeight` sculpte une RAMPE (montée ≤ STEP_MAX par case) dont la traversée verticale
 * s'AUTO-DÉRIVE du delta de hauteur — `surfaceLink` (flat/ramp/cliff) et `pathTo` (BFS multi-couches) la
 * franchissent à pied. Aucune donnée `stairs` : la connexion EST le relief.
 *
 * Scène 6×3, on travaille la rangée y=1 : sol z=0 (herbe, 0 m) et un tablier z=1 (plancher) en x=1..4.
 */
function withUpperDeck() {
  let s = addLayer(emptyScene(6, 3), 1); // z=1 tout « vide » (non marchable) au départ
  s = fillTerrainRect(s, { x: 1, y: 1, w: 4, h: 1 }, 'plancher', 1); // tablier marchable en x=1..4, y=1
  return s;
}

describe('éditeur multi-couche — rampe qui relie (addLayer + paintHeight)', () => {
  it('une rampe métrique (montée 1 m/case) relie le sol z=0 au tablier z=1 — surfaceLink flat/ramp', () => {
    let s = withUpperDeck();
    // paintHeight sculpte la rampe sur le tablier : 1 → 2 → 3 → 4 m (chaque pas = +1 m ≤ STEP_MAX)
    s = paintHeight(s, { x: 1, y: 1 }, 1, 1, 1);
    s = paintHeight(s, { x: 2, y: 1 }, 2, 1, 1);
    s = paintHeight(s, { x: 3, y: 1 }, 3, 1, 1);
    s = paintHeight(s, { x: 4, y: 1 }, 4, 1, 1);

    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(s.layers[1].height![1 * 6 + 4]).toBe(4); // sommet du tablier (x=4, y=1) à 4 m

    // Pied de rampe : la case sol (0,1) rejoint la case tablier (1,1,z1) — delta 1 m ⇒ 'ramp' (franchissable)
    expect(surfaceLink(s, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 })).toEqual({ grade: 'ramp', drop: 1 });
    // Montée de la rampe, de case en case : chaque marche est une 'ramp' de +1 m
    expect(surfaceLink(s, { x: 1, y: 1, z: 1 }, { x: 2, y: 1, z: 1 })).toEqual({ grade: 'ramp', drop: 1 });
    expect(surfaceLink(s, { x: 3, y: 1, z: 1 }, { x: 4, y: 1, z: 1 })).toEqual({ grade: 'ramp', drop: 1 });

    // pathTo monte du sol (z=0) jusqu'au sommet du tablier (z=1) à pied
    const up = pathTo(s, { x: 0, y: 1 }, { x: 4, y: 1, z: 1 }, { blocked: new Set() });
    expect(up).not.toBeNull();
    expect(up![0]).toEqual({ x: 0, y: 1 }); // départ au sol (z=0 omis)
    expect(up![up!.length - 1]).toEqual({ x: 4, y: 1, z: 1 }); // arrivée sur le tablier

    // On marche AUSSI DESSOUS : le sol z=0 reste franchissable sous le tablier
    const under = pathTo(s, { x: 0, y: 1 }, { x: 5, y: 1 }, { blocked: new Set() });
    expect(under).not.toBeNull();
    expect(under![under!.length - 1]).toEqual({ x: 5, y: 1 });
  });

  it('sans rampe, un tablier haut perché est une FALAISE : isolé du sol (pathTo échoue)', () => {
    let s = withUpperDeck();
    // Tout le tablier à 4 m d'un coup : le sol (0 m) → tablier (4 m) est un dénivelé 'cliff' (> STEP_MAX)
    for (const x of [1, 2, 3, 4]) s = paintHeight(s, { x, y: 1 }, 4, 1, 1);

    expect(surfaceLink(s, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 })).toEqual({ grade: 'cliff', drop: 4 });
    // Aucun accès à pied au tablier : pathTo vers une case z=1 renvoie null
    expect(pathTo(s, { x: 0, y: 1 }, { x: 4, y: 1, z: 1 }, { blocked: new Set() })).toBeNull();
    // Le sol reste marchable de bout en bout (seule la connexion verticale manque)
    expect(pathTo(s, { x: 0, y: 1 }, { x: 5, y: 1 }, { blocked: new Set() })).not.toBeNull();
  });
});
