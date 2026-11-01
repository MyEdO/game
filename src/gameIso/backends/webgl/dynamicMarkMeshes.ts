/**
 * BACKEND VOLUMIQUE des marques DYNAMIQUES (#1176, P3-0d) — les trois repères que le rendu trace à la
 * frame : lien d'ENGAGEMENT, contour de l'unité ACTIVE, repère de position du GROUPE — plus l'ANNEAU
 * D'ÉQUIPE au sol de chaque jeton (P3-0e). Même partage que
 * `highlightMeshes.ts` : le MONTAGE est ici, la POSE par frame vit dans `stage/dynamicMarkPose.ts`.
 *
 * QUATRE POOLS de capacité FIXE, montés une fois pour la vie de l'écran. Contrairement aux marques
 * statiques, la capacité ne suit même pas des paliers : ces marques se réécrivent SOIXANTE FOIS PAR
 * SECONDE (elles suivent la glisse de marche), et un pool qui se redimensionne dans la boucle de rendu
 * est un pool qui alloue dans la boucle de rendu.
 *
 * LE LIEN EST FAIT DE QUADS, pas d'une ligne, et c'est mesuré :
 *  - `LineBasicMaterial.linewidth` part à `gl.lineWidth`, que la quasi-totalité des pilotes WebGL
 *    borne à 1 (`ALIASED_LINE_WIDTH_RANGE`) — l'épaisseur 2 du gabarit (`builders/dynamicMarks`) n'y serait pas rendue ;
 *  - `LineSegments.computeLineDistances()`, qu'exige `LineDashedMaterial` à chaque changement de
 *    géométrie, RECONSTRUIT son tableau et son `Float32BufferAttribute` à chaque appel
 *    (`three/src/objects/LineSegments.js`) — donc une allocation par frame de marche.
 * Un pointillé de quads n'a ni l'une ni l'autre limite : l'épaisseur est une échelle d'instance, et la
 * pose ne fait que réécrire des matrices. Le COÛT est borné par la nature de l'engagement : deux
 * combattants Engagés sont en CONTACT de mêlée, donc le lien fait environ une case — au pas de
 * pointillé du gabarit (7 px, pour un pas de case qui se projette sur 35,78 px, cf.
 * `builders/dynamicMarks`), six quads pour un lien d'une case.
 */
import * as THREE from 'three';
import { ACTIVE_HALO_TINT, ENGAGE_TINT } from '../../highlightTints';
import { RING_FRAME_K, tileFrameGeometry, tileQuadGeometry } from './highlightMeshes';
import { SPECKLE_LIFT_M } from './groundAccents';
import { withRenderRank } from './renderRanks';
import { materiauPlanTransparent } from './worldMaterials';
import { poserCompteInstances } from './instancePools';

/** Un pool de marques dynamiques. */
export type DynMarkSlot = 'tether' | 'actif' | 'groupe' | 'anneau';

/** Les quatre pools, dans l'ordre de RANG croissant. */
export const DYN_MARK_SLOTS: readonly DynMarkSlot[] = ['actif', 'groupe', 'anneau', 'tether'];

/** RANG de superposition, dans la MÊME échelle que les marques statiques (`highlightMeshes.SLOT_RANK`,
 *  qui s'arrête à 8) : ces quatre-là passent AU-DESSUS de toutes les marques de case. L'ANNEAU d'équipe
 *  passe au-dessus du contour d'actif et du repère de groupe : le monde le pose au SOL, sur la case du
 *  jeton qu'il ceint.
 *
 *  LE LIEN D'ENGAGEMENT EST AU SOMMET (correctif du juge vision, 2026-08-13) : sous le contour d'actif,
 *  son dernier tiers disparaissait dans la bande or de la case active — un cadre d'opacité 1, large de
 *  `RING_FRAME_K` de case, que le lien traverse pour rejoindre le centre de cette case. Un lien amputé
 *  se lit comme un lien PLUS COURT, donc comme une autre situation de mêlée. Le rang 13 appartient déjà
 *  aux halos d'interaction (`interactHaloMeshes.HALO_SLOT_RANK`) : le bloc dynamique reste borné à 12. */
export const DYN_SLOT_RANK: Record<DynMarkSlot, number> = { actif: 9, groupe: 10, anneau: 11, tether: 12 };

/** Décollement (m) d'un pool au-dessus de la surface qui le porte. */
export function dynSlotLiftM(slot: DynMarkSlot): number {
  return (DYN_SLOT_RANK[slot] + 1) * SPECKLE_LIFT_M;
}

/** Opacités du gabarit (`builders/dynamicMarks`), à l'identique (ni le contour de l'actif ni l'anneau
 *  d'équipe n'en portent) — SAUF le lien d'engagement.
 *
 *  LIEN : la parité d'EFFET PERÇU prime sur la parité de valeur (correctif du juge vision, 2026-08-13).
 *  Le sol volumique est mesuré à 73 de luminance ; `ENGAGE_TINT` valant 137,7, le lien n'en détachait
 *  que 38,8 à l'opacité 0,6 du gabarit — il s'y lisait plus sombre que l'anneau d'équipe ennemi qu'il
 *  rejoint. À pleine opacité il en détache 64,7. */
export const DYN_SLOT_OPACITY: Record<DynMarkSlot, number> = { tether: 1, actif: 1, groupe: 0.5, anneau: 1 };

/** Teintes — le catalogue partagé `gameIso/highlightTints`. `null` = teinte PAR INSTANCE :
 *  l'anneau d'équipe porte celle de son combattant (`builders/dynamicMarks.teamRingDecor`). */
export const DYN_SLOT_TINT: Record<DynMarkSlot, string | null> = {
  tether: ENGAGE_TINT,
  actif: ACTIVE_HALO_TINT,
  groupe: ACTIVE_HALO_TINT,
  anneau: null,
};

/** Épaisseur du cadre du repère de GROUPE : la MOITIÉ de celle du contour d'actif — le rapport exact
 *  des deux traits du gabarit (`builders/dynamicMarks` : 1,5 px contre 3). */
export const PARTY_FRAME_K = RING_FRAME_K / 2;

/** Capacité FIXE de chaque pool. `tether` : une dizaine de quads par lien, donc de l'ordre de vingt
 *  liens simultanés ; `actif` : l'empreinte de la plus grande unité (5×5 = 25) ; `groupe` : le repère
 *  est unique ; `anneau` : une trentaine de cordes par anneau (le trait plein en demande plus que le
 *  pointillé), donc de l'ordre de vingt jetons postés simultanément. Au-delà, la pose écrit ce qu'elle
 *  peut et s'arrête à la capacité — elle ne réalloue jamais dans la boucle de rendu. */
export const DYN_SLOT_CAPACITY: Record<DynMarkSlot, number> = { tether: 256, actif: 32, groupe: 4, anneau: 768 };

/** Pool d'un slot : géométrie du slot (quad plein pour un tiret de lien ou d'anneau, cadre pour un
 *  contour), matériau NON éclairé — un repère de jeu ne s'assombrit pas la nuit — et NON EMBRUMÉ
 *  (`fog: false`) : cette marque est du chrome d'interface, pas de la matière du monde. La brume du POV
 *  (`applyFogGamma`, `sceneMeshes.ts`) mangerait sinon l'opacité que le slot porte au titre de la
 *  lisibilité — à 26 cases, la courbe extérieure en retire 71 % (#1176 P3-1c). Un slot dont la teinte
 *  est `null` la porte PAR INSTANCE (`instanceColor` alloué dès la construction, comme
 *  `buildHighlightMesh`) : l'anneau d'équipe change de couleur d'un combattant à l'autre. */
export function buildDynamicMarkMesh(slot: DynMarkSlot, capacity = DYN_SLOT_CAPACITY[slot]): THREE.InstancedMesh {
  const teinte = DYN_SLOT_TINT[slot];
  const geo = slot === 'tether' || slot === 'anneau' ? tileQuadGeometry() : tileFrameGeometry(slot === 'groupe' ? PARTY_FRAME_K : RING_FRAME_K);
  const mat = materiauPlanTransparent({
    color: new THREE.Color(teinte ?? 0xffffff),
    opacity: DYN_SLOT_OPACITY[slot],
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  if (!teinte) {
    const blanc = new THREE.Color(1, 1, 1);
    for (let i = 0; i < capacity; i++) mesh.setColorAt(i, blanc);
  }
  mesh.name = `marquesDyn:${slot}`;
  mesh.frustumCulled = false; // ces marques suivent l'action : la sphère du pool vaudrait la scène
  poserCompteInstances(mesh, 0);
  return withRenderRank(mesh, 'chrome');
}

/** Opacité du JUMEAU DE SILHOUETTE (#1297, LOT A). Le jumeau ne peint QUE des pixels occlus, sur une
 *  géométrie de monde dont la clarté n'est pas connue à l'avance ; la valeur se calibre donc contre le
 *  sol volumique, le fond le plus clair qu'elle rencontre (luminance mesurée 73 en moyenne de canaux,
 *  l'échelle de `DYN_SLOT_OPACITY`). L'anneau le plus SOMBRE du catalogue est celui d'ennemi
 *  (`teamColors.ENEMY_RING` #c0392b, moyenne 97,3) : à cette valeur il détache 15,8 de ce sol, contre
 *  6,1 au quart d'opacité que le juge a mesuré illisible. Un anneau de héros (#4f8fe0, moyenne 148,7)
 *  en détache 49,2. */
export const SILHOUETTE_TWIN_OPACITY = 0.65;

/**
 * JUMEAU DE SILHOUETTE d'un pool (#1297, LOT A) : le MÊME pool, rendu une seconde fois avec le test de
 * profondeur RETOURNÉ (`GreaterDepth`) — il ne peint donc que là où la géométrie du monde a déjà écrit
 * DEVANT lui, c'est-à-dire exactement les pixels où l'original est occlus. Un seul draw call pour tous
 * les acteurs : géométrie, matrices d'instance et couleurs d'instance sont les objets de l'original
 * (pas des copies), donc la pose par frame (`stage/dynamicMarkPose`) les alimente tous les deux d'une
 * seule écriture — seul le `count` se propage (`silhouetteTwinOf`).
 *
 * Rang `jumeau` (registre `renderRanks.ts`) : il passe AVANT les billboards. Ceux-ci trichent de 0,3 m
 * vers la caméra et écrivent leur profondeur APRÈS le passage du jumeau ; rendu après eux, il
 * couvrirait des corps VISIBLES (marge mesurée : 36 472 pas ortho, 503 329 pas POV).
 *
 * ÉCART DÉCLARÉ : le jumeau ne révèle l'anneau qu'à travers la géométrie OPAQUE du monde. Un anneau
 * caché derrière un autre BILLBOARD reste invisible — ce sprite n'a pas écrit sa profondeur au moment
 * où le jumeau passe. Déterministe, et hors du périmètre de ce lot.
 *
 * `fog: false` comme tout le chrome (#1176 P3-1c) — l'original l'est déjà. Aucun `onBeforeCompile` ici :
 * le matériau est nu, donc aucune `customProgramCacheKey` n'est requise (`depthFunc`/`depthWrite`/
 * `opacity` ne sont PAS des paramètres de programme — cf. `WebGLPrograms.getProgramCacheKeyParameters` ;
 * partager le programme de l'original est correct, l'état de profondeur s'applique au draw).
 */
export function buildSilhouetteTwin(source: THREE.InstancedMesh): THREE.InstancedMesh {
  const mat = materiauPlanTransparent({
    color: new THREE.Color(0xffffff), // la teinte vient de `instanceColor`, partagé avec l'original
    opacity: SILHOUETTE_TWIN_OPACITY,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
    fog: false,
  });
  // Capacité 0 au constructeur : `InstancedMesh` allouerait sinon un `instanceMatrix` de
  // `capacité × 16` flottants (768 × 16 pour l'anneau) que la ligne suivante remplace par celui de
  // l'original. La capacité RÉELLE du jumeau est donc celle du buffer emprunté.
  const jumeau = new THREE.InstancedMesh(source.geometry, mat, 0);
  jumeau.instanceMatrix = source.instanceMatrix;
  jumeau.instanceColor = source.instanceColor;
  jumeau.name = `${source.name}:silhouette`;
  jumeau.frustumCulled = false;
  withRenderRank(jumeau, 'jumeau');
  poserCompteInstances(jumeau, source.count);
  jumeau.userData.emprunte = true; // géométrie et buffers appartiennent à l'original (`viderGroupe`)
  (source.userData as { silhouette?: THREE.InstancedMesh }).silhouette = jumeau;
  return jumeau;
}

/** Le jumeau de silhouette d'un pool, s'il en porte un — la couture par laquelle la pose propage son
 *  `count` sans rien réécrire. */
export function silhouetteTwinOf(mesh: THREE.InstancedMesh): THREE.InstancedMesh | null {
  return (mesh.userData as { silhouette?: THREE.InstancedMesh }).silhouette ?? null;
}
