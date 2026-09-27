import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Raycaster, Vector2, Vector3, type Intersection } from 'three';
import { describe, expect, it } from 'vitest';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../../state/scene';
import { findPropById, findPropMaterialById, props } from '../../../data';
import { buildWorldGeometry, wholeSceneBillboardEls, worldBakeDeps, type WorldGeometry } from './sceneMeshes';
import { worldSurfaceMaterials } from './worldMaterials';
import { pickNearestTarget, propEntityAtHit, type PickTarget, type PropVertexRange, type WorldPickMesh } from './spriteRaycast';

/**
 * PICKING PAR `entId` — un décor volumique est cuit dans la MASSE du monde : il n'a ni maillage propre
 * ni quad. Ce qui le rend cliquable, ce sont les plages de sommets ORIGINAUX relevées à la cuisson,
 * qu'un cutaway (qui réécrit l'index de dessin, jamais les sommets) ne peut pas périmer.
 *
 * L'invariant #1297 est l'autre moitié du contrat : la géométrie NON-prop du monde (mur, sol, toit)
 * n'entre jamais dans les candidats, donc un acteur derrière un mur reste cliquable.
 */
const CAMERA = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
CAMERA.updateMatrixWorld(true);
const NDC = { x: 0, y: 0 };

const sceneWith = (...entities: SceneEntity[]): Scene => ({ ...emptyScene(8, 8), entities });
const volumeEntity = (id: string): SceneEntity =>
  ({ id, kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S' }) as SceneEntity;
/** Un décor encore BILLBOARD, DÉRIVÉ du catalogue : la vague volumique (#1343) convertit les refs lot
 *  par lot — une ref écrite en dur ferait rougir cette garde le jour de SA recette. */
const REF_BILLBOARD = props.find((p) => !p.volume)!.id;
const legacyEntity = (id: string): SceneEntity =>
  ({ id, kind: 'prop', pos: { x: 5, y: 5 }, ref: REF_BILLBOARD }) as SceneEntity;
const figurant = (id: string): SceneEntity =>
  ({ id, kind: 'personnage', ref: 'humain', pos: { x: 6, y: 6 } }) as SceneEntity;
/** Deux listes de deps sont-elles la MÊME ? — par IDENTITÉ, terme à terme : le patron de rétention. */
const memesDeps = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((d, i) => d === b[i]);
const patchEntity = (scene: Scene, id: string, patch: Partial<SceneEntity>): Scene =>
  ({ ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, ...patch } as SceneEntity : e)) });

/** Les triangles CUITS d'un décor, tels que le rayon les rendrait : trois index de sommets ORIGINAUX. */
function* bakedPropFaces(world: WorldGeometry, entId: string): Generator<{ a: number; b: number; c: number }> {
  for (const r of world.userData.propVertexRanges) {
    if (r.entId !== entId) continue;
    for (let v = r.vertexStart; v < r.vertexStart + r.vertexCount; v += 3) yield { a: v, b: v + 1, c: v + 2 };
  }
}

describe('Cuisson d’un décor volumique — une seule voie, et son id de picking', () => {
  it('cuit un prop volumique une fois, sans sujet billboard, et conserve son id de picking', () => {
    const scene = sceneWith(volumeEntity('table-1'), legacyEntity('billboard-1'));
    const els = wholeSceneBillboardEls(scene);
    expect(els.props.map((p) => p.entId)).toEqual(['billboard-1']);
    const world = buildWorldGeometry(scene, 2, () => 1);
    expect(world.userData.propVertexRanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ entId: 'table-1', vertexStart: expect.any(Number), vertexCount: expect.any(Number) }),
    ]));
    // Deux matériaux de recette ⇒ deux groupes de surface ⇒ deux plages DISJOINTES sous le même id.
    expect(world.userData.propVertexRanges.filter((r) => r.entId === 'table-1').length).toBeGreaterThan(1);
    let triangles = 0;
    for (const face of bakedPropFaces(world, 'table-1')) {
      expect(propEntityAtHit(world.userData.propVertexRanges, face)).toBe('table-1');
      triangles++;
    }
    expect(triangles).toBeGreaterThan(0);
    expect(worldBakeDeps(scene, 2)).toEqual(expect.arrayContaining([findPropById('table-ronde-4-tabourets')!.volume]));
  });

  it('worldBakeDeps invalide la cuisson pour add/remove/pos/ref/facing d’un prop', () => {
    const base = sceneWith(volumeEntity('table-1'));
    for (const changed of [
      { ...base, entities: [] },
      { ...base, entities: [...base.entities, volumeEntity('table-2')] },
      patchEntity(base, 'table-1', { pos: { x: 3, y: 4 } }),
      patchEntity(base, 'table-1', { ref: 'comptoir-droit' }),
      patchEntity(base, 'table-1', { facing: 'E' }),
    ]) expect(memesDeps(worldBakeDeps(changed, 2), worldBakeDeps(base, 2))).toBe(false);
  });

  /**
   * L'AUTRE MOITIÉ, celle qui coûte : `scene.entities` est reforgé à chaque tour de combat (despawn,
   * déplacement forcé) sur des scènes qui ne bougent pas d'un meuble. Keyer la cuisson dessus la
   * rejouait — 634 ms mesurés sur La Diligence par le module lui-même. La dep n'est donc PAS le
   * tableau : c'est la signature des seuls décors à recette.
   */
  it('ce qui n’est pas un décor volumique ne recuit RIEN — tableau reforgé, personnage déplacé, décor billboardé déplacé', () => {
    const base = sceneWith(volumeEntity('table-1'), legacyEntity('billboard-1'), figurant('pnj-1'));
    for (const inerte of [
      { ...base, entities: [...base.entities] }, // même contenu, tableau NEUF
      patchEntity(base, 'pnj-1', { pos: { x: 7, y: 7 } }), // un corps qui marche
      { ...base, entities: base.entities.filter((e) => e.id !== 'pnj-1') }, // un despawn de combat
      patchEntity(base, 'billboard-1', { pos: { x: 1, y: 1 } }), // un décor BILLBOARD, hors de la masse cuite
    ]) expect(memesDeps(worldBakeDeps(inerte, 2), worldBakeDeps(base, 2))).toBe(true);
  });

  it('le filet des fixtures billboard tient encore : au moins deux refs SANS recette au catalogue', () => {
    expect(
      props.filter((p) => !p.volume).length,
      'la phase 4 de #1343 (mort du chemin billboard des props) fera tomber ce filet EXPRÈS : ces fixtures '
      + 'devront alors être reformulées — il n’y aura plus de décor billboard à témoin.',
    ).toBeGreaterThanOrEqual(2);
  });

  /** La RECETTE elle-même est une dep : une retouche au Codex périme la cuisson sans que la scène bouge. */
  it('worldBakeDeps porte la recette ET ses matériaux, pas seulement la signature de placement', () => {
    const scene = sceneWith(volumeEntity('table-1'));
    const prop = findPropById('table-ronde-4-tabourets')!;
    expect(worldBakeDeps(scene, 2)).toEqual(expect.arrayContaining([prop.volume]));
    for (const primitive of prop.volume!.primitives)
      expect(worldBakeDeps(scene, 2)).toEqual(expect.arrayContaining([findPropMaterialById(primitive.material)]));
  });
});

/**
 * CÂBLAGE — l'assemblage EXACT de l'écran (`stage/GameStage3D`, groupe MONDE) : la cuisson pose les
 * plages sur la GÉOMÉTRIE, le montage n'en recopie RIEN sur le maillage (il n'y écrit que `emprunte`),
 * et le picking doit malgré tout nommer le meuble. Sans ce test, cinq assertions vertes tenaient sur un
 * objet forgé par le test — que la production ne construit jamais.
 */
describe('Le picking lit le monde que l’écran monte VRAIMENT', () => {
  /** Le maillage monde tel que `GameStage3D` l'assemble : géométrie cuite + matériaux de surface. */
  function mondeDeLEcran(scene: Scene) {
    const geometry = buildWorldGeometry(scene, sceneMetresPerTile(scene), () => 1);
    const { materials } = worldSurfaceMaterials(geometry, 1, { enFile: true });
    const mesh = new Mesh(geometry, materials);
    mesh.userData.emprunte = true; // …et RIEN d'autre : le montage ne recopie aucune plage
    mesh.updateMatrixWorld(true);
    return { geometry, mesh };
  }

  /** Caméra braquée sur le barycentre des sommets d'un décor : le rayon central traverse son volume. */
  function cameraSur(geometry: WorldGeometry, entId: string) {
    const pos = geometry.getAttribute('position');
    let n = 0, sx = 0, sy = 0, sz = 0;
    for (const r of geometry.userData.propVertexRanges) {
      if (r.entId !== entId) continue;
      for (let v = r.vertexStart; v < r.vertexStart + r.vertexCount; v++, n++) {
        sx += pos.getX(v); sy += pos.getY(v); sz += pos.getZ(v);
      }
    }
    expect(n, 'aucun sommet relevé pour ce décor : rien à viser').toBeGreaterThan(0);
    const c = { x: sx / n, y: sy / n, z: sz / n };
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    camera.position.set(c.x, c.y, c.z + 40);
    camera.lookAt(c.x, c.y, c.z);
    camera.updateMatrixWorld(true);
    return camera;
  }

  it('le maillage monté ne porte AUCUNE plage sur son userData — la géométrie est la seule source', () => {
    const { geometry, mesh } = mondeDeLEcran(sceneWith(volumeEntity('table-1')));
    expect(mesh.userData.propVertexRanges).toBeUndefined();
    expect(geometry.userData.propVertexRanges.some((r) => r.entId === 'table-1')).toBe(true);
  });

  it('sur CE maillage, le rayon nomme le décor volumique', () => {
    const scene = sceneWith(volumeEntity('table-1'));
    const { geometry, mesh } = mondeDeLEcran(scene);
    expect(pickNearestTarget(cameraSur(geometry, 'table-1'), [], mesh, NDC)).toEqual({ kind: 'entity', id: 'table-1' });
  });

  it('…et un jeton PLUS PROCHE que le meuble le reprend, sur ce même maillage', () => {
    const scene = sceneWith(volumeEntity('table-1'));
    const { geometry, mesh } = mondeDeLEcran(scene);
    const camera = cameraSur(geometry, 'table-1');
    const quad = new Mesh(new PlaneGeometry(4, 4), new MeshBasicMaterial());
    quad.position.copy(camera.position).add(camera.getWorldDirection(new Vector3()).multiplyScalar(5));
    quad.quaternion.copy(camera.quaternion);
    quad.updateMatrixWorld(true);
    expect(pickNearestTarget(camera, [{ cid: 'hero-1', object: quad }], mesh, NDC)).toEqual({ kind: 'combatant', id: 'hero-1' });
  });
});

// ————————————————————————————————————————————————————————————————
// Maillages SYNTHÉTIQUES : la seule façon de poser à la main un index déjà compacté par un cutaway,
// et des profondeurs exactes autour d'un décor.
// ————————————————————————————————————————————————————————————————

/** Deux triangles de 2×2 m centrés sur l'axe de la caméra, à `z` — six sommets, dans cet ordre. */
function quadVertices(z: number): number[] {
  const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x, y, z]);
  return [...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]].flat();
}

/** Maillage monde à N quads empilés en profondeur, index d'IDENTITÉ moins les quads `retirés`. */
function mondeCuit(quads: readonly number[], retirés: readonly number[], ranges: PropVertexRange[]): WorldPickMesh & Mesh {
  const positions = quads.flatMap((z) => quadVertices(z));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const index: number[] = [];
  quads.forEach((_, q) => {
    if (retirés.includes(q)) return; // le cutaway a COMPACTÉ l'index : ces sommets ne sont plus dessinés
    for (let k = 0; k < 6; k++) index.push(q * 6 + k);
  });
  geo.setIndex(new BufferAttribute(new Uint32Array(index), 1));
  geo.userData = { propVertexRanges: ranges }; // comme la cuisson : les plages voyagent dans la GÉOMÉTRIE
  const mesh = new Mesh(geo, new MeshBasicMaterial()) as WorldPickMesh & Mesh;
  mesh.updateMatrixWorld(true);
  return mesh;
}

/** Quad de billboard d'un combattant, à `z`. */
function combatantBillboard(cid: string, z = -5): PickTarget {
  const m = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
  m.position.set(0, 0, z);
  m.updateMatrixWorld(true);
  return { cid, object: m };
}

/** Première intersection du rayon central avec le maillage monde. */
function raycastProp(mesh: Mesh): Intersection {
  const r = new Raycaster();
  r.setFromCamera(new Vector2(NDC.x, NDC.y), CAMERA);
  const [hit] = r.intersectObject(mesh, true);
  return hit;
}

describe('pickNearestTarget — le décor volumique se clique par ses sommets', () => {
  it('un cutaway placé avant le prop conserve le picking par sommets originaux', () => {
    // Quad 0 = masse DÉGAGÉE devant (index compacté, plus dessinée) ; quad 1 = le décor, derrière.
    const propRange: PropVertexRange = { entId: 'table-1', vertexStart: 6, vertexCount: 6 };
    const mesh = mondeCuit([-3, -5], [0], [propRange]);
    const hit = raycastProp(mesh);
    expect(hit.face && [hit.face.a, hit.face.b, hit.face.c].every((i) => i >= propRange.vertexStart && i < propRange.vertexStart + propRange.vertexCount)).toBe(true);
    expect(pickNearestTarget(CAMERA, [], mesh, NDC)).toEqual({ kind: 'entity', id: 'table-1' });
  });

  it('arbitre combattants et faces de prop par distance globale', () => {
    const monde = mondeCuit([-5], [], [{ entId: 'table-1', vertexStart: 0, vertexCount: 6 }]);
    expect(pickNearestTarget(CAMERA, [combatantBillboard('hero-1', -7)], monde, NDC)).toEqual({ kind: 'entity', id: 'table-1' });
    expect(pickNearestTarget(CAMERA, [combatantBillboard('hero-1', -3)], monde, NDC)).toEqual({ kind: 'combatant', id: 'hero-1' });
  });

  it('ignore une face monde non-prop et conserve le clic acteur derrière le mur', () => {
    // Quad 0 = MUR devant (aucune plage) ; quad 1 = un décor loin derrière — le monde EST donc balayé.
    const wallFirst = mondeCuit([-2, -8], [], [{ entId: 'table-1', vertexStart: 6, vertexCount: 6 }]);
    const wallHit = raycastProp(wallFirst);
    expect(propEntityAtHit(wallFirst.geometry.userData.propVertexRanges!, wallHit.face!)).toBeNull();
    expect(pickNearestTarget(CAMERA, [combatantBillboard('hero-1')], wallFirst, NDC)).toEqual({ kind: 'combatant', id: 'hero-1' });
  });
});
