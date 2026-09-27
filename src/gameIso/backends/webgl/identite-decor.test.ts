import { describe, expect, it } from 'vitest';
import { collectBillboards, wholeSceneBillboardEls } from './sceneMeshes';
import type { BillboardPropEl } from '../../builders/types';
import { propSvg } from '../../catalog/decor';
import { props } from '../../../data';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../../state/scene';

/**
 * IDENTITÉ DE DESSIN DU DÉCOR (#1176, P3-3). L'identité d'un billboard EST sa clé de cache de texture
 * (`billboardTextureKey`) : deux sujets qui la partagent partagent leur image. Tant que le cache se
 * vidait à chaque référence de scène (`clearBillboardTextures` au tick), une identité trop grossière
 * ne se voyait pas — la rétention par contenu a supprimé cette purge, et le trou devient permanent :
 * un modèle changé à l'inspecteur garderait l'ancien sprite toute la session.
 *
 * Ce qui est mesuré : deux DESSINS différents ne peuvent plus tomber sur la même identité, ni pour un
 * décor d'entité (même id, modèle changé) ni pour un overlay de terrain (même case, terrain changé).
 */

/** Deux décors encore BILLBOARD, DÉRIVÉS du catalogue : la vague volumique (#1343) convertit les refs
 *  lot par lot — deux refs écrites en dur feraient rougir cette garde le jour de LEUR recette. */
const [REF_A, REF_B] = props.filter((p) => !p.volume).map((p) => p.id);

function scèneAvecDecor(ref: string): Scene {
  const s = emptyScene(6, 6);
  const decor: SceneEntity = { id: 'decor-1', kind: 'prop', pos: { x: 2, y: 2 }, ref } as SceneEntity;
  return { ...s, entities: [decor] };
}

const identités = (scene: Scene) =>
  collectBillboards(scene, sceneMetresPerTile(scene), wholeSceneBillboardEls(scene))
    .filter((b) => b.kind === 'prop')
    .map((b) => b.identity);

describe('Identité d’un billboard de DÉCOR — la clé porte le DESSIN (#1176, P3-3)', () => {
  it('le filet des fixtures billboard tient encore : au moins deux refs SANS recette au catalogue', () => {
    expect(
      props.filter((p) => !p.volume).length,
      'la phase 4 de #1343 (mort du chemin billboard des props) fera tomber ce filet EXPRÈS : ces fixtures '
      + 'devront alors être reformulées — il n’y aura plus de décor billboard à témoin.',
    ).toBeGreaterThanOrEqual(2);
  });

  it('changer le MODÈLE d’un décor change son identité — deux dessins ne partagent plus une texture', () => {
    const a = scèneAvecDecor(REF_A);
    const b = scèneAvecDecor(REF_B);
    // Le dessin diverge RÉELLEMENT (sans quoi la garde ne prouverait rien).
    expect(propSvg(REF_A, undefined, 0)).not.toEqual(propSvg(REF_B, undefined, 0));
    expect(identités(a)).not.toEqual(identités(b));
  });

  it('…et la clé d’élément SEULE ne les distingue pas — c’est bien la signature qui tranche', () => {
    const a = wholeSceneBillboardEls(scèneAvecDecor(REF_A)).props.map((el) => el.key);
    const b = wholeSceneBillboardEls(scèneAvecDecor(REF_B)).props.map((el) => el.key);
    expect(a).toEqual(b);
    expect(a).toEqual(['prop:decor-1']);
  });

  /**
   * OVERLAY de terrain : sa clé d'élément est la CASE (`ov:x,y,z`, `builders/props.ts`) — deux
   * terrains à décor différents sur une même case y collisionneraient. Le catalogue n'en porte qu'UN
   * aujourd'hui (mesuré : `bois → arbre` est le SEUL `TerrainDef.overlayProp` du dépôt), la collision
   * est donc LATENTE et non exploitable — raison de plus pour que la clé porte le décor avant qu'un
   * second terrain à décor n'existe.
   */
  it('OVERLAY de terrain : l’identité porte le DÉCOR, pas seulement la case', () => {
    const base = emptyScene(4, 4);
    const layers = base.layers.map((l) => ({ ...l, tiles: [...l.tiles] }));
    layers[0].tiles[0] = 'bois';
    expect(identités({ ...base, layers })).toEqual(['prop:ov:0,0,0|arbre||1']);
  });
});

/**
 * …et ce que l'identité doit porter en PLUS depuis que les quads survivent par différence (#1396) :
 * un survivant garde SON quad, taillé au montage. Deux props de même clé et de même modèle mais
 * d'ÉCHELLE différente partageraient donc un quad de la mauvaise taille ; d'ORIENTATION différente,
 * une texture qui ne montre pas le bon côté (`propSvg` prend le cap).
 */
describe('Identité d’un prop — l’échelle et le cap en font partie (#1396)', () => {
  const propEl = (patch: { facing?: 'S' | 'E'; scale?: number }): BillboardPropEl => ({
    kind: 'prop', source: 'entity', key: 'prop:decor-1', entId: 'decor-1', span: { w: 1, h: 1 }, ref: REF_A,
    cell: { x: 2, y: 2, z: 0 }, foot: { offX: 0, offY: 0, scale: patch.scale ?? 1 },
    states: { visible: true },
    ...(patch.facing ? { facing: patch.facing } : {}),
  });
  const scene = emptyScene(6, 6);
  const identité = (patch: { facing?: 'S' | 'E'; scale?: number }) =>
    collectBillboards(scene, sceneMetresPerTile(scene), { tokens: [], props: [propEl(patch)] })[0].identity;

  it('deux ÉCHELLES d’empreinte donnent deux identités (un quad ne se partage pas)', () => {
    expect(identité({ scale: 1 })).not.toBe(identité({ scale: 2 }));
  });

  it('deux CAPS donnent deux identités — c’est le cap que `propSvg` reçoit', () => {
    expect(identité({ facing: 'S' })).not.toBe(identité({ facing: 'E' }));
  });
});
