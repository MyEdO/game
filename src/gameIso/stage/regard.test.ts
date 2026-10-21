/**
 * LE REGARD, unité d'art des billboards (#1373) — les faits PURS dont la repose des quads, la
 * pré-chauffe des textures et l'identité de cache dépendent toutes les trois.
 *
 * Le fait qui coûte cher quand il est faux : huit caps se planchérisent sur QUATRE crans, donc le cran
 * ne suffit pas à distinguer deux regards. Une garde qui ne comparerait que le cran laisserait le
 * décor peint au cap quitté sur la moitié des changements de cap.
 */
import { describe, expect, it } from 'vitest';
import { DIR8_ORDER, type Dir8 } from '../../geometry/dir8';
import type { Rot } from '../../geometry/iso';
import { billboardView } from '../backends/webgl/billboardMath';
import type { View } from '../rig/facing';
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';
import { CRANS_ART, bbCameraDe, cleRegard, identiteAuCran, povArtRot, povYawDeg, regardsVoisins } from './regard';

/** L'art d'un décor tourné au SUD, vu depuis un cap — la table mesurée sur les huit caps. */
const vueDepuis = (cap: Dir8): { view: View; mirror: boolean } =>
  billboardView(bbCameraDe({ rot: povArtRot(cap), facing: cap }), 'S');

/** Cap → cran d'art, vue et miroir d'un sujet au SUD. Table de RÉFÉRENCE : c'est elle que le banc de
 *  montage retrouve dans les clés de texture demandées. */
const TABLE: Record<Dir8, { rot: Rot; view: View; mirror: boolean }> = {
  N: { rot: 0, view: 'front', mirror: false },
  NE: { rot: 1, view: 'front', mirror: false },
  E: { rot: 1, view: 'profile', mirror: false },
  SE: { rot: 2, view: 'back', mirror: false },
  S: { rot: 2, view: 'back', mirror: false },
  SO: { rot: 3, view: 'back', mirror: true },
  O: { rot: 3, view: 'profile', mirror: true },
  NO: { rot: 0, view: 'front', mirror: true },
};

describe('Regard — le CAP est l’unité, le cran n’en est que la projection', () => {
  it('les huit caps donnent leur cran et leur vue', () => {
    for (const cap of DIR8_ORDER) {
      const attendu = TABLE[cap];
      expect(povArtRot(cap), `cran du cap ${cap}`).toBe(attendu.rot);
      expect(vueDepuis(cap), `vue du cap ${cap}`).toEqual({ view: attendu.view, mirror: attendu.mirror });
    }
  });

  it('quatre PAIRES de caps partagent leur cran — c’est ce que la clé de regard doit distinguer', () => {
    const parCran = new Map<Rot, Dir8[]>();
    for (const cap of DIR8_ORDER) parCran.set(povArtRot(cap), [...(parCran.get(povArtRot(cap)) ?? []), cap]);
    expect([...parCran.keys()].sort(), 'les quatre crans doivent être atteints').toEqual([...CRANS_ART]);
    expect([...parCran.values()].map((caps) => caps.length), 'deux caps par cran').toEqual([2, 2, 2, 2]);
    // …et la CLÉ, elle, les sépare : huit caps, huit clés.
    expect(new Set(DIR8_ORDER.map((facing) => cleRegard({ rot: povArtRot(facing), facing }))).size).toBe(8);
  });

  it('la clé d’un regard de PLATEAU est son cran, et jamais celle d’un cap', () => {
    expect(CRANS_ART.map((rot) => cleRegard({ rot, facing: null }))).toEqual(['r0', 'r1', 'r2', 'r3']);
    const capsEtCrans = new Set([
      ...CRANS_ART.map((rot) => cleRegard({ rot, facing: null })),
      ...DIR8_ORDER.map((facing) => cleRegard({ rot: povArtRot(facing), facing })),
    ]);
    expect(capsEtCrans.size, 'un cap et un cran ne doivent jamais se confondre').toBe(12);
  });

  it('`povYawDeg` place les huit caps tous les 45°, le cap N à 45°', () => {
    expect(DIR8_ORDER.map(povYawDeg)).toEqual([45, 90, 135, 180, 225, 270, 315, 0]);
  });

  it('la caméra d’un regard de plateau est ORTHO au lacet du cran, celle d’un cap est PERSPECTIVE', () => {
    expect(CRANS_ART.map((rot) => bbCameraDe({ rot, facing: null }))).toEqual([
      { kind: 'ortho', yawDeg: 0 }, { kind: 'ortho', yawDeg: 90 },
      { kind: 'ortho', yawDeg: 180 }, { kind: 'ortho', yawDeg: 270 },
    ]);
    expect(bbCameraDe({ rot: 0, facing: 'N' }).kind).toBe('perspective');
  });
});

describe('Regard — les VOISINS qu’un temps mort réchauffe', () => {
  it('PLATEAU : les trois autres crans, jamais le sien', () => {
    for (const rot of CRANS_ART) {
      const voisins = regardsVoisins({ rot, facing: null });
      expect(voisins.map((v) => v.rot).sort(), `cran ${rot}`).toEqual(CRANS_ART.filter((r) => r !== rot));
      expect(voisins.every((v) => v.facing === null), 'un regard de plateau n’a pas de cap').toBe(true);
    }
  });

  it('PREMIÈRE PERSONNE : les deux caps à ±45°, et leur cran d’art', () => {
    expect(regardsVoisins({ rot: povArtRot('N'), facing: 'N' })).toEqual([
      { rot: povArtRot('NE'), facing: 'NE' },
      { rot: povArtRot('NO'), facing: 'NO' },
    ]);
    // Un demi-tour progressif ne saute aucun cap : de proche en proche, les voisins couvrent les huit.
    const atteints = new Set<Dir8>();
    let cap: Dir8 = 'N';
    for (let i = 0; i < 8; i++) {
      atteints.add(cap);
      cap = regardsVoisins({ rot: povArtRot(cap), facing: cap })[0].facing!;
    }
    expect(atteints.size, 'la chaîne des voisins doit parcourir les huit caps').toBe(8);
  });
});

describe('Regard — l’identité de cache porte le cran POUR LE DÉCOR seul', () => {
  const sujet = (kind: BillboardSubject['kind']): BillboardSubject => ({ kind, identity: 'x' } as BillboardSubject);

  it('un décor a une identité par cran, un personnage une seule', () => {
    expect(CRANS_ART.map((rot) => identiteAuCran(sujet('prop'), rot))).toEqual(['x|r0', 'x|r1', 'x|r2', 'x|r3']);
    // L'art d'un corps ignore le cran : l'y mettre rasteriserait quatre fois la MÊME image.
    expect(new Set(CRANS_ART.map((rot) => identiteAuCran(sujet('personnage'), rot))).size).toBe(1);
  });
});
