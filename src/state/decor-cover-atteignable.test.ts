/**
 * COUVERT DE DÉCOR — le couvert RENDU par le moteur égale le couvert DÉCLARÉ par la donnée
 * (#1680 ligne 14).
 *
 * `lineOfSightCover` (`noyau/monde/lineOfSight.ts`) lit `PropData.opaque` par `tileBlocksSight` AVANT de lire
 * `PropData.cover` : une case opaque rend « bloqué » à distance, ou force « totale » quand la cible y
 * est collée, et `continue` — la classe de `cover` n'est jamais consultée. Un décor qui déclare
 * `opaque` ET une classe autre que « totale » énonce donc une règle que le moteur n'applique nulle
 * part. Ce contrat le mesure SUR LE MOTEUR, jamais sur la donnée seule : c'est le rendu qui décide.
 *
 * `validatePropCatalog` (`data/props.types.ts`) porte la garde STRUCTURELLE du même invariant, en
 * amont ; les deux se tiennent — l'une empêche d'écrire la donnée, l'autre prouve que le moteur la lit.
 */
import { describe, expect, it } from 'vitest';
import { props } from '../data';
import { emptyScene, type Scene, type SceneEntity } from '../noyau/monde/scene';
import { lineOfSightCover } from '../noyau/monde/lineOfSight';

/** Une scène nue portant le seul décor mesuré, au centre. */
const scèneAvec = (ref: string, at: { x: number; y: number }): Scene => {
  const s = emptyScene('scene-test', 12, 12);
  s.entities = [{ id: 'd1', kind: 'prop', ref, pos: at } as SceneEntity];
  return s;
};

/** Les décors qui déclarent quelque chose à ce sujet — `cover`, `opaque`, ou les deux. */
const PORTEURS = props.filter((p) => p.opaque || p.cover);

describe('décor — le couvert RENDU par lineOfSight égale le couvert DÉCLARÉ', () => {
  it('la population mesurée n’est pas vide (sinon ce contrat mesurerait du néant)', () => {
    expect(PORTEURS.length).toBeGreaterThan(10);
  });

  it.each(PORTEURS.map((p) => p.id))('%s : cible COLLÉE au décor — le couvert rendu est celui déclaré', (id) => {
    const declare = props.find((p) => p.id === id)!.cover ?? 'none';
    // Tireur en 4,5 — décor en 5,5 — cible en 6,5 : le décor est la SEULE case traversée, et la cible
    // lui est adjacente (la branche « couvert d'adjacence » de `lineOfSightCover`).
    const rendu = lineOfSightCover(scèneAvec(id, { x: 5, y: 5 }), { x: 4, y: 5 }, { x: 6, y: 5 }, []);
    expect(rendu, `${id} : couvert rendu ≠ couvert déclaré`).toEqual({ blocked: false, cover: declare });
  });

  it.each(PORTEURS.filter((p) => !p.opaque).map((p) => p.id))(
    '%s (non opaque) : cible LOINTAINE — la vue passe, avec le couvert déclaré',
    (id) => {
      const declare = props.find((p) => p.id === id)!.cover ?? 'none';
      const rendu = lineOfSightCover(scèneAvec(id, { x: 5, y: 5 }), { x: 2, y: 5 }, { x: 8, y: 5 }, []);
      expect(rendu).toEqual({ blocked: false, cover: declare });
    },
  );

  it.each(PORTEURS.filter((p) => p.opaque).map((p) => p.id))(
    '%s (opaque) : cible LOINTAINE — la vue est COUPÉE, et le couvert est totale',
    (id) => {
      const rendu = lineOfSightCover(scèneAvec(id, { x: 5, y: 5 }), { x: 2, y: 5 }, { x: 8, y: 5 }, []);
      expect(rendu).toEqual({ blocked: true, cover: 'totale' });
    },
  );
});
