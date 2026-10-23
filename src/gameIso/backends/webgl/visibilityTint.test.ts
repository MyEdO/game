import { describe, expect, it } from 'vitest';
import { tintFor, tintOf, visibilityField } from './visibilityTint';
import { AMBIANCE } from '../../catalog/ambiance';

/**
 * ORACLE FIGÉ (#1176 P3-4, commit C5a). Ce banc confrontait la teinte volumique au VOILE SVG de
 * production (`gameIso/FogLayer.fogFilterFor`), mort avec la voie affine. La donnée qui les liait, elle,
 * survit : `AMBIANCE.fogTint` (`src/data/ambiance.json`), la seule table de la politique de visibilité.
 * Le second terme est donc devenu le TEXTE du voile disparu, mesuré sur l'arbre d'avant la suppression :
 *   - mémorisé : `brightness(0.42) saturate(.45) opacity(.82)` — le `brightness` valait exactement
 *     `AMBIANCE.fogTint.explored`, ce que la première assertion garde vrai ;
 *   - inconnu : `brightness(0) opacity(.38)` — la voie SVG ÉTEIGNAIT la case sur le fond de carte, là
 *     où le monde volumique en garde un facteur bas NON NUL (aucune carte dessous : à zéro, la case
 *     disparaîtrait au lieu de s'assombrir) ;
 *   - en vue : aucun filtre, facteur plein.
 */
/** Le `brightness` que le voile SVG appliquait à une case MÉMORISÉE (mesuré avant retrait, C5a). */
const BRIGHTNESS_MEMORISE_SVG = 0.42;

describe('les teintes sont ANCRÉES sur la donnée de visibilité (`AMBIANCE.fogTint`)', () => {
  it('exploré = le terme `brightness` que le voile de production appliquait (une seule donnée)', () => {
    expect(tintOf('explored')).toBe(AMBIANCE.fogTint.explored);
    expect(tintOf('explored')).toBe(BRIGHTNESS_MEMORISE_SVG);
  });

  it('inconnu : facteur bas mais NON NUL — le volumique assombrit là où le SVG éteignait', () => {
    expect(tintOf('unknown')).toBeGreaterThan(0);
    expect(tintOf('unknown')).toBeLessThan(tintOf('explored'));
  });

  it('vue : facteur plein', () => {
    expect(tintOf('visible')).toBe(1);
  });
});

/** La TABLE DE VÉRITÉ de `visibilityOf` vit dans sa couche (`src/noyau/visibility.test.ts`) : ici on ne
 *  teste que l'APPLICATION — le mappage état → teinte. */
describe('tintFor — l’APPLICATION : la politique, puis le mappage état → teinte', () => {
  const visible = new Set(['1,2,0']);
  const explored = new Set(['1,2,0', '3,4,0']);

  it('chaque case rend la teinte de SON état', () => {
    expect(tintFor('1,2,0', visible, explored)).toBe(tintOf('visible'));
    expect(tintFor('3,4,0', visible, explored)).toBe(tintOf('explored'));
    expect(tintFor('9,9,1', visible, explored)).toBe(tintOf('unknown'));
  });

  it('les trois teintes se rangent dans l’ordre de la politique', () => {
    expect(tintOf('visible')).toBeGreaterThan(tintOf('explored'));
    expect(tintOf('explored')).toBeGreaterThan(tintOf('unknown'));
  });
});

/**
 * CHAMP CONTINU (#1176, C6). La politique reste PAR CASE — c'est le système de jeu. L'échantillonnage,
 * lui, ne suit plus le quadrillage : `visibilityField` interpole entre CENTRES de case, de sorte qu'un
 * sommet de face, un mur d'arête ou un coin de quad reçoivent la valeur du monde où ils se tiennent.
 * Les quatre clauses ci-dessous SONT la loi ; la passe de teinte (`applyVisibilityTint`) l'applique.
 */
describe('visibilityField — l’ÉCHANTILLONNEUR : le champ entre les centres de case', () => {
  // Carte 4×1 : deux cases vues à gauche, deux inconnues à droite — une frontière franche à traverser.
  const DIMS = { w: 4, h: 1 };
  const visible = new Set(['0,0,0', '1,0,0']);
  const explored = new Set<string>();
  const champ = visibilityField(visible, explored, DIMS);

  it('aux coordonnées ENTIÈRES, le champ rend EXACTEMENT la valeur discrète de la case', () => {
    for (let x = 0; x < DIMS.w; x++) expect(champ(x, 0, 0)).toBe(tintFor(`${x},0,0`, visible, explored));
  });

  it('entre deux centres, la valeur INTERPOLE — la frontière se fond au lieu de sauter', () => {
    const vu = tintOf('visible');
    const inconnu = tintOf('unknown');
    expect(champ(1.5, 0, 0)).toBeCloseTo((vu + inconnu) / 2, 12);
    expect(champ(1.25, 0, 0)).toBeCloseTo(vu + (inconnu - vu) * 0.25, 12);
    // …et elle est MONOTONE le long de la traversée : aucune marche, aucun rebond.
    let précédent = Infinity;
    for (let t = 1; t <= 2.0001; t += 0.1) {
      const v = champ(t, 0, 0);
      expect(v).toBeLessThanOrEqual(précédent + 1e-12);
      précédent = v;
    }
  });

  it('bilinéaire sur les DEUX axes : le centre de quatre cases vaut leur moyenne', () => {
    const carte = { w: 2, h: 2 };
    const f = visibilityField(new Set(['0,0,0']), new Set(['1,1,0']), carte);
    const attendu = (tintOf('visible') + tintOf('unknown') * 2 + tintOf('explored')) / 4;
    expect(f(0.5, 0.5, 0)).toBeCloseTo(attendu, 12);
  });

  it('hors carte, l’échantillon se RABAT sur le bord — le pourtour ne s’assombrit pas d’un dehors', () => {
    // Le coin extérieur d'une nappe de bord tombe à −0,5 case : sans rabat, il prendrait la moitié
    // d'un « inconnu » qui n'est pas une case de la carte.
    expect(champ(-0.5, 0, 0)).toBe(champ(0, 0, 0));
    expect(champ(-40, -40, 0)).toBe(champ(0, 0, 0));
    expect(champ(DIMS.w + 10, 0, 0)).toBe(champ(DIMS.w - 1, 0, 0));
  });

  it('chaque ÉTAGE porte son propre champ (la visibilité est par case, z compris)', () => {
    expect(champ(0, 0, 0)).toBe(tintOf('visible'));
    expect(champ(0, 0, 1)).toBe(tintOf('unknown'));
  });
});
