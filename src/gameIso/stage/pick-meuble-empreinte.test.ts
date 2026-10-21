import { describe, it, expect } from 'vitest';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import { propFootTiles } from '../../noyau/monde/footprint';
import type { Dir4 } from '../../geometry/dir8';
import type { Dims } from '../../geometry/iso';
import { poseFromDims, worldToScreen } from './projection';
import { resoudrePixel, type CadreDePick, type EtatDePick, type Verdict } from './pickResolve';

/**
 * UN MEUBLE EST CLIQUABLE SUR TOUTE SON EMPREINTE (#1509 L6′).
 *
 * La chaîne de picking (`resoudrePixel`) demande « cette case porte-t-elle un meuble ? » à l'index
 * case → décor (`noyau/monde/decorIndex.ts`), bâti sur la couture unique `propFootTiles` : un décor qui
 * couvre deux cases répond donc sur les DEUX, et le verdict rend sa case d'ANCRAGE — la même que la
 * voie `decor` du rayon, celle d'où l'interaction d'exploration le reprend.
 *
 * Le pixel est celui du CENTRE de chaque case, posé par la projection du peintre
 * (`projection.worldToScreen`) : c'est l'inverse exact de celle que la chaîne applique, et la parité
 * de cette inversion avec la voie volumique a sa propre garde (`pick-parity.test.tsx`).
 */
const REF = 'table-2x1';
const ID = 'table';
const POS = { x: 5, y: 5 };

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

function sceneAvecTable(facing: Dir4, z = 0): Scene {
  const s = emptyScene('scene-test', 14, 14);
  s.entities = [{ id: ID, kind: 'prop', pos: { ...POS }, ref: REF, facing, ...(z ? { z } : {}) } as SceneEntity];
  return s;
}

/** L'état d'exploration MINIMAL que la chaîne lit — le groupe est posé loin du meuble : ce qui répond
 *  ici doit être le meuble, jamais un voisinage de pas. */
const etat = (scene: Scene): EtatDePick =>
  ({ scene, mode: 'exploration', battle: null, partyPos: { x: 0, y: 0 } }) as EtatDePick;

/** Verdict de la chaîne sous le pixel-CENTRE d'une case, sans aucun rayon (`vise` nul). */
function souslaCase(scene: Scene, x: number, y: number, activeZ = 0): Verdict {
  const dims = dimsDe(scene);
  const cadre: CadreDePick = { pose: poseFromDims(dims), dims, activeZ, aretes: [] };
  const g = worldToScreen(cadre.pose, { x, y, lift: 0 });
  return resoudrePixel(etat(scene), null, () => g, cadre);
}

const cases = (scene: Scene): { x: number; y: number }[] => {
  const ent = scene.entities[0];
  return propFootTiles(ent.ref, ent.pos, ent.facing, sceneMetresPerTile(scene));
};

describe('picking d’un meuble MULTI-CASE — ses deux cases le désignent, et rendent son ancre', () => {
  it('la fixture EXERCE bien le cas : `table-2x1` couvre deux cases, et son empreinte tourne', () => {
    expect(cases(sceneAvecTable('S'))).toEqual([{ x: 5, y: 5 }, { x: 6, y: 5 }]);
    expect(cases(sceneAvecTable('E'))).toEqual([{ x: 5, y: 5 }, { x: 5, y: 6 }]);
  });

  it.each(['N', 'E', 'S', 'O'] as Dir4[])('cap %s : chaque case de l’empreinte rend `meuble` et la case d’ANCRAGE', (facing) => {
    const scene = sceneAvecTable(facing);
    const vus = cases(scene).map((t) => {
      const v = souslaCase(scene, t.x, t.y);
      return `(${t.x},${t.y}) → ${v.via} ${v.tile ? `(${v.tile.x},${v.tile.y},${v.tile.z})` : 'rien'}`;
    });
    expect(vus).toHaveLength(2);
    expect(vus).toEqual(cases(scene).map((t) => `(${t.x},${t.y}) → meuble (${POS.x},${POS.y},0)`));
  });

  it('TÉMOIN — une case HORS de l’empreinte ne rend pas `meuble` : la garde ne répond pas partout', () => {
    const scene = sceneAvecTable('S');
    const v = souslaCase(scene, POS.x + 2, POS.y);
    expect(v.via).toBe('sol');
    expect(v.tile).toEqual({ x: POS.x + 2, y: POS.y, z: 0 });
  });

  it('l’ÉTAGE reste tranchant : un meuble de la couche 1 ne répond pas sous le pixel de la couche 0', () => {
    const scene = sceneAvecTable('S', 1);
    expect(cases(scene).map((t) => souslaCase(scene, t.x, t.y, 0).via)).toEqual(['sol', 'sol']);
  });
});
