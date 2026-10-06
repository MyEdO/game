import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../../state/scene';
import { buildWorldGeometry, type WorldGeometry } from './sceneMeshes';
import { worldSurfaceMaterials } from './worldMaterials';
import {
  aretesDeCalage,
  calageActif,
  CALAGE_APLAT,
  CALAGE_OPACITE,
  materiauCalage,
  materiauxDeCalage,
  NOM_ARETES_CALAGE,
  rangsDeDecor,
} from './calageProps';

/**
 * MODE CALAGE — ce qui se mesure ici, sur le monde RÉELLEMENT CUIT (jamais une géométrie forgée) :
 *  - la DÉCISION : le mode ne vaut que calque visible ET contraste demandé ;
 *  - le PÉRIMÈTRE : la surcharge ne touche que les groupes de DÉCOR VOLUMIQUE — sol, murs et toits
 *    gardent leur matériau d'origine, par IDENTITÉ ;
 *  - les ARÊTES : elles ne portent que des sommets du décor, jamais ceux du sol qui l'entoure.
 */
const sceneAvecDecor = (): Scene => ({
  ...emptyScene(8, 8),
  entities: [{ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S' } as SceneEntity],
});

const mondeCuit = (scene: Scene): WorldGeometry => buildWorldGeometry(scene, sceneMetresPerTile(scene), 'jeu', () => 1);

/** Boîte des sommets du DÉCOR, relevée sur les plages de picking — l'index indépendant des groupes. */
function boiteDuDecor(geometry: WorldGeometry): THREE.Box3 {
  const pos = geometry.getAttribute('position');
  const boite = new THREE.Box3();
  for (const r of geometry.userData.propVertexRanges)
    for (let v = r.vertexStart; v < r.vertexStart + r.vertexCount; v++)
      boite.expandByPoint(new THREE.Vector3(pos.getX(v), pos.getY(v), pos.getZ(v)));
  return boite;
}

describe('calageActif — le mode ne s’allume que calque VISIBLE et contraste DEMANDÉ', () => {
  it('visible ET contraste : actif', () => {
    expect(calageActif({ visible: true, contraste: true })).toBe(true);
  });

  it('calque masqué : inactif, même contraste demandé (rien à comparer)', () => {
    expect(calageActif({ visible: false, contraste: true })).toBe(false);
  });

  it('calque visible sans contraste, ou aucun calque : inactif', () => {
    expect(calageActif({ visible: true, contraste: false })).toBe(false);
    expect(calageActif(null)).toBe(false);
  });
});

describe('Surcharge de matériau — le DÉCOR VOLUMIQUE seul, sur le monde cuit', () => {
  it('les rangs de décor sont ceux des groupes `prop`, et ils ne sont pas tous les groupes', () => {
    const geometry = mondeCuit(sceneAvecDecor());
    const rangs = rangsDeDecor(geometry);
    const groupes = geometry.userData.surfaceGroups;
    expect(rangs.length).toBeGreaterThan(0);
    expect(rangs.length).toBeLessThan(groupes.length); // le sol de la scène reste hors du mode
    for (const rang of rangs) expect(groupes[rang].prop).toBe(true);
    for (let i = 0; i < groupes.length; i++) if (!rangs.includes(i)) expect(groupes[i].prop).toBeUndefined();
  });

  it('le tableau surchargé pose l’aplat aux rangs de décor et REND les autres matériaux À L’IDENTIQUE', () => {
    const geometry = mondeCuit(sceneAvecDecor());
    const { materials } = worldSurfaceMaterials(geometry, 1, { enFile: true });
    const aplat = materiauCalage();
    const surcharge = materiauxDeCalage(materials, geometry, aplat)!;
    const rangs = new Set(rangsDeDecor(geometry));
    expect(surcharge).toHaveLength(materials.length);
    surcharge.forEach((mat, rang) => expect(mat).toBe(rangs.has(rang) ? aplat : materials[rang]));
  });

  it('une scène SANS décor volumique n’a rien à surcharger : `null` (le maillage n’est pas touché)', () => {
    const geometry = mondeCuit(emptyScene(8, 8));
    expect(rangsDeDecor(geometry)).toEqual([]);
    const { materials } = worldSurfaceMaterials(geometry, 1, { enFile: true });
    expect(materiauxDeCalage(materials, geometry, materiauCalage())).toBeNull();
    expect(aretesDeCalage(geometry)).toBeNull();
  });

  it('l’aplat est le cyan du mode, translucide, et NON DoubleSide (c’est un volume, pas un plan)', () => {
    const mat = materiauCalage();
    expect(mat.color.getHexString()).toBe(CALAGE_APLAT.slice(1));
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(CALAGE_OPACITE);
    expect(mat.side).not.toBe(THREE.DoubleSide);
  });
});

describe('Arêtes du mode — un maillage de lignes bâti des SEULS triangles de décor', () => {
  it('rend des segments nommés, et AUCUN sommet hors de la boîte du décor', () => {
    const geometry = mondeCuit(sceneAvecDecor());
    const lignes = aretesDeCalage(geometry)!;
    expect(lignes).toBeInstanceOf(THREE.LineSegments);
    expect(lignes.name).toBe(NOM_ARETES_CALAGE);
    const pos = lignes.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(0);
    const boite = boiteDuDecor(geometry).expandByScalar(1e-4);
    for (let v = 0; v < pos.count; v++)
      expect(boite.containsPoint(new THREE.Vector3(pos.getX(v), pos.getY(v), pos.getZ(v)))).toBe(true);
  });

  it('la géométrie du MONDE n’est pas touchée par la construction des arêtes', () => {
    const geometry = mondeCuit(sceneAvecDecor());
    const sommetsAvant = geometry.getAttribute('position').count;
    const indexAvant = geometry.getIndex()!.count;
    const groupesAvant = geometry.groups.length;
    aretesDeCalage(geometry);
    expect(geometry.getAttribute('position').count).toBe(sommetsAvant);
    expect(geometry.getIndex()!.count).toBe(indexAvant);
    expect(geometry.groups.length).toBe(groupesAvant);
  });
});
