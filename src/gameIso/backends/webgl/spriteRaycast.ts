/**
 * LANCER DE RAYON de picking du monde volumique (#1176, lot P2-3) — la réponse de la voie WebGL au
 * hit-test de sprite (`stage/spritePicker.ts`). Un canevas n'a pas d'arbre à interroger : le pixel
 * redevient un RAYON, et c'est la DISTANCE CAMÉRA qui tranche l'empilement — là où le peintre affine
 * tranchait par son tri de profondeur (`stage/objs.ts`).
 *
 * CIBLES : les QUADS de billboard — ceux d'un combattant portent son id, ceux du DÉCOR n'en portent
 * aucun (`cid: null`) — et, dans la masse du monde, les SEULES faces qu'une plage de décor volumique
 * (`PropVertexRange`) sait nommer. Une face de mur, de sol ou de toit n'entre jamais dans les
 * candidats : elle ne masque donc pas le clic d'un acteur derrière elle (#1297).
 *
 * LA RÈGLE (#1297) : « ce qui se voit se clique ». Le plus PROCHE touché tranche, et un DÉCOR qui gagne
 * rend `null` — le clic retombe sur la tuile, comme un sprite qui cache un corps le rend inatteignable.
 * Seule l'occultation par la géométrie CUITE du monde tombe : le jeton s'y peint à travers — son
 * ANNEAU (`dynamicMarkMeshes.buildSilhouetteTwin`)
 * — donc le pixel où on le lit rend son id.
 *
 * UN CHOIX ASSUMÉ (#1297) : AUCUNE BORNE DE DISTANCE — un jeton occulté par le monde reste cliquable
 * à toute profondeur, comme les jumeaux de silhouette qui le révèlent sans borne. Ce qui SE VOIT d'un
 * jeton occulté est désormais son corps entier, à la boîte près : sa surface de réponse au clic est
 * celle qu'il donne à voir (l'alpha du sprite mis à part, cf. la seconde divergence ci-dessous).
 *
 * DIVERGENCE MESURÉE AVEC L'AFFINE (`stage/sprite-pick-parity.test.ts`) : le peintre affine n'a pas de
 * silhouette — un mur peint APRÈS le jeton reçoit l'`elementFromPoint`, ne porte aucun `data-cid`, et le
 * clic y retombe sur la tuile de sol. Sur les mêmes situations la voie volumique rend l'id du jeton.
 *
 * SECONDE DIVERGENCE : un quad est plein pour le rayon alors que l'`alphaTest` du matériau le rend
 * transparent à l'affichage. Le hit-test natif du SVG suit le TRACÉ (on clique à travers le vide d'un
 * sprite) ; le rayon suit la BOÎTE, coins compris. Lever cet écart demande de lire l'alpha de la
 * texture à l'UV touché (rasterisation en cache, hors de ce lot).
 */
import * as THREE from 'three';

/** Une cible du rayon : l'objet à toucher, et l'id du combattant qu'il dessine — `cid: null` = sprite
 *  de DÉCOR, qui ne rend jamais d'id mais OCCULTE le clic quand il gagne le rayon (§ en-tête). */
export interface PickTarget {
  cid: string | null;
  object: THREE.Object3D;
}

/** Point NDC (repère [-1,1], y vers le haut) d'un pixel relatif au coin haut-gauche du canevas. */
export function ndcAt(px: { x: number; y: number }, canvas: { w: number; h: number }): { x: number; y: number } {
  return { x: (px.x / canvas.w) * 2 - 1, y: -(px.y / canvas.h) * 2 + 1 };
}

const rayon = new THREE.Raycaster();

/** DÉPARTAGE à égalité EXACTE de distance entre deux JETONS (deux quads coplanaires au même point,
 *  deux combattants sur la même case) : l'ordre lexicographique des ids — arbitraire, mais STABLE.
 *  C'est ce qui rend le verdict indépendant de l'ordre du tableau de cibles. */
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

/** Ce que le pixel désigne : un COMBATTANT (jeton), une ENTITÉ de scène (décor volumique), ou rien. */
export type PickResult = { kind: 'combatant'; id: string } | { kind: 'entity'; id: string } | null;

/** Maillage du monde cuit, tel que le picking le lit. SOURCE UNIQUE des plages : la GÉOMÉTRIE, où la
 *  cuisson les a posées (`sceneMeshes.bakeWorldGeometry`) — rien n'est recopié sur le maillage au
 *  montage, et le maillage n'est ici qu'un PORTEUR de géométrie et de matrice monde. */
export interface WorldPickMesh extends THREE.Object3D {
  geometry: { userData: { propVertexRanges?: PropVertexRange[] } };
}

/**
 * Ce que le rayon désigne : le candidat le plus PROCHE de la caméra tranche — l'id de son JETON, celui
 * de son DÉCOR VOLUMIQUE, ou `null` si c'est un décor billboardé (§ en-tête : ce qui se voit se clique).
 * À distance ÉGALE, deux candidats nommés se départagent par `emporteAEgalite`, et un candidat nommé
 * l'emporte sur un décor coplanaire. L'ordre du tableau de cibles n'entre JAMAIS dans le verdict.
 *
 * UNE PASSE : les QUADS (deux triangles chacun), plus les seules faces du monde qu'une plage de décor
 * nomme. La géométrie non-prop du monde est balayée mais jamais candidate — un acteur derrière un mur
 * reste cliquable (#1297).
 */
export function pickNearestTarget(
  camera: THREE.Camera,
  targets: readonly PickTarget[],
  worldMesh: WorldPickMesh | null,
  ndc: { x: number; y: number },
): PickResult {
  rayon.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  let gagnant: PickResult = null;
  let plusProche = Infinity;
  /** Retient le candidat s'il bat le tenant — `id` nul = décor billboardé, qui occulte sans nommer. */
  const juger = (distance: number, candidat: PickResult) => {
    if (distance > plusProche) return;
    if (distance === plusProche) {
      // Égalité EXACTE : un décor ne prend jamais la place du tenant (un jeton coplanaire d'un
      // décor reste cliquable), et entre deux candidats nommés c'est l'id lexicographique qui tranche.
      if (candidat === null) return;
      if (gagnant !== null && !emporteAEgalite(candidat.id, gagnant.id)) return;
    }
    plusProche = distance;
    gagnant = candidat;
  };
  for (const cible of targets)
    for (const touche of rayon.intersectObject(cible.object, true))
      juger(touche.distance, cible.cid === null ? null : { kind: 'combatant', id: cible.cid });
  const ranges = worldMesh?.geometry.userData.propVertexRanges;
  if (worldMesh && ranges?.length)
    for (const touche of rayon.intersectObject(worldMesh, true)) {
      const entId = touche.face ? propEntityAtHit(ranges, touche.face) : null;
      if (entId) juger(touche.distance, { kind: 'entity', id: entId });
    }
  return gagnant;
}
