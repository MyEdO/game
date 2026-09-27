import { describe, expect, it } from 'vitest';
import { props } from '../../data';
import { empreinteDeriveeDuProp, type PropData } from '../../data/props.types';
import { DIR4_ORDER } from '../../state/dir8';
import { propFootTiles } from '../../state/footprint';
import { emptyScene, isWalkable, sceneMetresPerTile } from '../../state/scene';

/**
 * DÉGÉNÉRESCENCES DE L'EMPREINTE DÉRIVÉE (#1509, « Design jugé » point 2) : les deux pannes qu'un
 * prédicat d'empreinte peut produire — une empreinte VIDE (un meuble solide qu'on traverse) et une
 * empreinte qui disparaît quand tout le corps est exclu. L'explosion aux caps diagonaux est tenue par
 * la chaîne de refus du cap diagonal (`props-volumiques.test.ts`, « le cap DIAGONAL est refusé de bout
 * en bout »).
 */
const RECETTES = props.filter((p) => p.volume);
const POS = { x: 5, y: 5 };

describe('empreinte dérivée — aucune dégénérescence', () => {
  it.each(RECETTES.filter((p) => p.solid).map((p) => p.id))(
    '%s : décor SOLIDE, chacune de ses cases bloque la marche à ses quatre caps (jamais traversable)',
    (id) => {
      for (const facing of DIR4_ORDER) {
        const scene = emptyScene(14, 14);
        scene.entities = [{ id: 'd', kind: 'prop', pos: POS, ref: id, facing }];
        const cases = propFootTiles(id, POS, facing, sceneMetresPerTile(scene));
        expect(cases.length, `${id} cap ${facing}`).toBeGreaterThan(0);
        for (const c of cases) expect(isWalkable(scene, c.x, c.y), `${id} cap ${facing} case ${c.x},${c.y}`).toBe(false);
      }
    },
  );

  it('une recette dont TOUT le corps est siège garde une empreinte d’au moins une case', () => {
    const base = props.find((p) => p.id === 'tabouret')!;
    const [assise] = base.volume!.primitives;
    const toutSiege = {
      ...base,
      id: 'tout-siege-de-fixture',
      volume: { ...base.volume!, primitives: [assise] },
      seatSlots: [{ id: 'place-1', anchor: { xM: assise.center.xM, yM: assise.center.yM, hM: 2 }, facing: 'S', approach: { x: 0, y: -1 } }],
    } as PropData;
    for (const facing of DIR4_ORDER) {
      const { w, h } = empreinteDeriveeDuProp(toutSiege, facing, 2);
      expect(w * h, `cap ${facing}`).toBeGreaterThanOrEqual(1);
    }
  });
});
