import * as THREE from 'three';

/** Décor billboardé qui occulte le rayon sans nommer une entité. */
export interface PickTarget {
  object: THREE.Object3D;
}

/** Point NDC (repère [-1,1], y vers le haut) d'un pixel relatif au coin haut-gauche du canevas. */
export function ndcAt(px: { x: number; y: number }, canvas: { w: number; h: number }): { x: number; y: number } {
  return { x: (px.x / canvas.w) * 2 - 1, y: -(px.y / canvas.h) * 2 + 1 };
}

const rayon = new THREE.Raycaster();

/** À distance égale, les ids de décor se départagent par ordre lexicographique. */
function emporteAEgalite(candidat: string, tenant: string): boolean {
  return candidat < tenant;
}

/** PLAGE de sommets ORIGINAUX d'un décor volumique dans la géométrie cuite du monde. Plusieurs plages
 *  disjointes peuvent porter le même `entId` : la cuisson groupe par matériau. */
export interface PropVertexRange { entId: string; vertexStart: number; vertexCount: number }

/**
 * Le décor que porte une face touchée, ou `null` (mur, sol, toit — toute face hors plage).
 *
 * Sur les SOMMETS, jamais sur `faceIndex` : un cutaway réécrit l'index de dessin du monde, si bien
 * qu'un rang de triangle ne désigne plus rien de stable, là où les sommets, eux, ne bougent pas.
 * Les trois sommets doivent tomber dans la MÊME plage — un triangle à cheval n'appartient à personne.
 */
export function propEntityAtHit(ranges: readonly PropVertexRange[], face: { a: number; b: number; c: number }): string | null {
  return ranges.find((r) => [face.a, face.b, face.c].every((i) => i >= r.vertexStart && i < r.vertexStart + r.vertexCount))?.entId ?? null;
}

/** Résultat partagé : combattant de la prise DOM d'une structure, décor volumique, ou rien. */
export type PickResult = { kind: 'combatant'; id: string } | { kind: 'entity'; id: string } | null;

/** Maillage du monde cuit, tel que le picking le lit. SOURCE UNIQUE des plages : la GÉOMÉTRIE, où la
 *  cuisson les a posées (`sceneMeshes.bakeWorldGeometry`) — rien n'est recopié sur le maillage au
 *  montage, et le maillage n'est ici qu'un PORTEUR de géométrie et de matrice monde. */
export interface WorldPickMesh extends THREE.Object3D {
  geometry: { userData: { propVertexRanges?: PropVertexRange[] } };
}

/** Le décor le plus proche tranche ; un billboard occulte sans nommer.
 *  À distance égale, un décor nommé prime, puis son id départage.
 *  Seules les faces inscrites dans une plage de décor sont candidates. */
export function pickNearestTarget(
  camera: THREE.Camera,
  targets: readonly PickTarget[],
  worldMesh: WorldPickMesh | null,
  ndc: { x: number; y: number },
): Extract<PickResult, { kind: 'entity' }> | null {
  rayon.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  let gagnant: Extract<PickResult, { kind: 'entity' }> | null = null;
  let plusProche = Infinity;
  /** Retient le candidat s'il bat le tenant — `id` nul = décor billboardé, qui occulte sans nommer. */
  const juger = (distance: number, candidat: Extract<PickResult, { kind: 'entity' }> | null) => {
    if (distance > plusProche) return;
    if (distance === plusProche) {
      if (candidat === null) return;
      if (gagnant !== null && !emporteAEgalite(candidat.id, gagnant.id)) return;
    }
    plusProche = distance;
    gagnant = candidat;
  };
  for (const cible of targets)
    for (const touche of rayon.intersectObject(cible.object, true))
      juger(touche.distance, null);
  const ranges = worldMesh?.geometry.userData.propVertexRanges;
  if (worldMesh && ranges?.length)
    for (const touche of rayon.intersectObject(worldMesh, true)) {
      const entId = touche.face ? propEntityAtHit(ranges, touche.face) : null;
      if (entId) juger(touche.distance, { kind: 'entity', id: entId });
    }
  return gagnant;
}
