/**
 * ASSEMBLEUR DU MONDE VOLUMIQUE : les builders du pivot (`builders/floors|walls|roofs|props`)
 * deviennent (a) UNE géométrie de monde fusionnée (positions + couleurs de sommet), (b) une liste de
 * SUJETS de billboard (personnages riggés + décor), chacun capable de rendre SA chaîne SVG pour une vue.
 *
 * Deux invariants de ce module :
 *  - FUSION : toutes les faces de la scène tiennent dans UNE `BufferGeometry` (la couleur de face est
 *    cuite au sommet, le mode de rendu n'est qu'un choix de MATÉRIAU) — jamais un mesh par face. Elle
 *    est INDEXÉE, d'un index IDENTITÉ (un sommet par usage : `computeVertexNormals` donne toujours la
 *    normale de FACE) que le masque de dégagement compacte sans toucher aux sommets ;
 *  - DÉLÉGATION : aucune couleur, aucune vue, aucun seuil n'est décidé ici — `faceSurface`, le champ
 *    de teinte (`visibilityTint`), `facesGeometry` (biais coplanaire compris), `propSvg`,
 *    `resolveRender`/`resolveRig` font foi.
 *
 * Sans DOM et sans renderer (la rasterisation vit dans `svgTexture.ts`) : ce module tourne donc sous
 * VITEST, où les gardes le montent tel quel. Il n'est en revanche PAS chargeable en Node CLI nu
 * (`npx tsx`) : sa chaîne d'imports traverse `src/audio/engine.ts:96`, qui lit `import.meta.env.DEV`
 * — mesuré C6, l'import échoue à `Cannot read properties of undefined (reading 'DEV')`.
 */
import * as THREE from 'three';
import { buildFloors } from '../../builders/floors';
import { buildWalls } from '../../builders/walls';
import { buildRoofs, ROOF_SLOPE_M } from '../../builders/roofs';
import { buildProps } from '../../builders/props';
import { buildTokens } from '../../builders/tokens';
import { teamRingDecor } from '../../builders/dynamicMarks';
import { estPropVolumique, type CellSide, type Face, type PropEl, type RoofEl, type SceneEl, type TokenEl, type WallEl } from '../../builders/types';
import { findPropById, findPropMaterialById, matieresDe } from '../../../data';
import { roofMaterial } from '../../catalog/roofs';
import { toitureEffective } from '../../../state/sceneEdit';
import type { PropVertexRange } from './spriteRaycast';
import { roofCourseStepM, variantOf } from '../../detail/courses';
import type { DetailRecipe } from '../../detail/types';
import type { PeriodKind } from './periodTexture';
import { faceBakeKey, needsFaceBake } from './faceBake';
import { facePoly, faceUvFrame, facesGeometry, orienterPoly, shadeFamily } from './worldTris';
import { faceSurface, shadeFactorOf, tintVarFactor } from './faceColors';
import { faceDepthOf } from './faceRelief';
import { BB_W, BB_H } from '../../pov/billboardCore';
import { povDepth } from '../../pov/camera';
import { type BillboardKind } from './billboardMath';
import { defsGlobaux } from '../../sprites';
import { tousLesTerrains } from '../../../state/terrain';
import { propSvg } from '../../catalog/decor';
import { AMBIANCE, METEO_SANS_EFFET, type WeatherLight } from '../../catalog/ambiance';
import { bonesToSvg } from '../../rig/renderBones';
import { resolveRig, rigComposition } from '../../rig/composeRig';
import type { RigOverlay } from '../../rig/bones';
import { entityRigProfileFor, enemyRigProfile, rendersFromOwnInventory } from '../../rig/enemyProfile';
import { planById, planOptsForRecord, type RenderResolution, type ResolveOpts, type WingState } from '../../rig/bodyPlan';
import { defaultAppearance, type Appearance } from '../../rig/appearance';
import { equipFromCombatant, isShield, type EquipCtx } from '../../rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from '../../rig/parts/combatantVisuals';
import { mountedPlanOpts, mountedRest, seatPlacement, seatRiderOnMount, seatedRest } from '../../rig/mountedRig';
import { seatSitHeight, type SeatPose } from '../../../state/seating';
import { diagOnce } from '../../rig/devDiag';
import { addPose } from '../../rig/poses';
import { seatedPose, weaponRest } from '../../rig/anim/weaponClips';
import { boxUnitsPerM } from './billboardMath';
import { COLLAPSE_MS, clipTotalMs, easeOutCubic, frameSampleMs, planPoseAt, rigPoseAtFrame, type ClipDef } from '../../rig/anim/actorAnimSelect';
import { isStructure } from '../../../engine/structures';
import type { Combatant, Weapon } from '../../../engine/types';
import { hasLeap } from '../../../engine/traits/dispatch';
import { combatantRender, combatantTokenScale, entityRender, entityTokenScale, sceneEntityForRender, sizeTokenScale } from '../../sizeScale';
import { RIG_GROUND_PIVOT, groundStateOf, planGroundPose, rigGroundPose, rigGroundTiltDeg, type GroundState, type Pose } from '../../groundPose';
import { hash32 } from '../../../data/hash';
import { entitySize } from '../../../state/spawn';
import { sizeFootprint } from '../../../state/footprint';
import type { View } from '../../rig/facing';
import type { Rot } from '../../../geometry/iso';
import type { Dir8 } from '../../../state/dir8';
import { heightAt, type Scene, type SceneEntity, type WallSide } from '../../../state/scene';
import { memoByRef, memoByRefDeps } from '../../../state/sceneMemo';
import { PERCABLE_ATTRIBUT } from './percageLocal';

/** ÉCHANTILLONNEUR du champ de teinte de visibilité (1 = pleine), fourni par l'appelant
 *  (`visibilityTint.visibilityField`). `x`/`y` sont des coordonnées de GRILLE CONTINUES — un sommet de
 *  face tombe entre deux centres de case, et c'est ce que le champ sait rendre ; `z` est l'ÉTAGE,
 *  entier. Un appelant qui n'a qu'une case (un corps posé sur la sienne) passe ses coordonnées
 *  entières : le champ y rend exactement la valeur discrète de la case. */
export type TintAt = (x: number, y: number, z: number) => number;

/** Verdict de GÉOMÉTRIE sur un élément de scène : le canal du DÉGAGEMENT (`cleared`), distinct de la
 *  teinte de visibilité — une masse dégagée ne se rend PAS, elle ne s'estompe pas. Il ne filtre RIEN au
 *  bake (`applyCutawayMask` le porte, sur le monde déjà cuit) : un appelant sans loi de dégagement
 *  (planches QC) ne pose simplement aucun masque et rend la scène entière. */
export type KeepEl = (el: SceneEl) => boolean;

/** Éléments à FACES de la scène, dans l'ordre de peinture des builders (toutes couches pleines, comme
 *  les planches QC jugent l'ENVIRONNEMENT, pas le brouillard de l'étage actif). */
function faceEls(scene: Scene): SceneEl[] {
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  return [
    ...buildFloors(scene, undefined, { activeZ: maxZ }),
    ...buildWalls(scene),
    ...buildRoofs(scene),
    ...buildProps(scene).filter(estPropVolumique),
  ];
}

/** Faces MONDE de la scène dans l'ordre de peinture des builders, chacune avec la clé de case qui porte
 *  sa teinte de visibilité — la liste EXACTE que `bakeWorldGeometry` fusionne (les gardes s'y adossent
 *  au lieu de la reconstituer). */
export interface WorldFace {
  face: Face;
  cell: SceneEl['cell'];
  cellKey: string;
  /** Élément de PROVENANCE — l'identité sur laquelle se relit la loi de dégagement (`KeepEl`) une fois
   *  la face fondue dans la géométrie commune. */
  el: SceneEl;
  /** Pente (m) de la nappe dont la face vient — un PAN de toit seulement : le pas de rang, donc
   *  l'échelle verticale de sa texture, en dépend (`roofCourseStepM`). */
  pitchM?: number;
  /** CÔTÉ D'ARÊTE de l'élément qui porte la face (mur, falaise, wedge) — l'identité MONDE sur laquelle
   *  se cale la variante d'anti-périodicité, EXACTEMENT comme le backend affine (`authoring/wallsSvg` passe
   *  `el.side`, `authoring/floorsSvg` passe `f.side`). Absent d'un pan de toit ou d'une nappe de sol. */
  side?: WallSide | CellSide;
}

export function worldFaces(scene: Scene): WorldFace[] {
  const out: WorldFace[] = [];
  for (const el of faceEls(scene)) {
    if (!('faces' in el)) continue;
    const cellKey = `${el.cell.x},${el.cell.y},${el.cell.z}`;
    const pitchM = (el as RoofEl).pitch;
    const elSide = (el as WallEl).side;
    for (const face of el.faces) out.push({ face, cell: el.cell, cellKey, el, pitchM, side: face.side ?? elSide });
  }
  return out;
}

/** GROUPE DE SURFACE : la maille de fusion du monde. Une géométrie UNIQUE porte toute la scène (jamais
 *  un mesh par face) et se découpe en `groups` three — un par (surface × variante d'anti-périodicité ×
 *  échelle de période), plus les CUISSONS PAR FACE (colombage) et LE groupe nu des faces sans
 *  appareillage. Le nombre de dessins passe de 1 à quelques dizaines : le prix ASSUMÉ d'une texture
 *  répétée qui ne se répète pas à l'œil. */
export interface SurfaceGroup {
  /** Identité du groupe (= clé de cache de sa texture). */
  key: string;
  /** `null` = groupe NU : aucune période, la couleur de sommet suffit. */
  kind: PeriodKind | null;
  surfaceKey?: string;
  variant?: number;
  /** Couleur de base de la surface — le masque de période n'en garde que des rapports. */
  color?: string;
  recipe?: DetailRecipe;
  /** Taille MÉTRIQUE de la période SUR CETTE SURFACE (le `v` d'un pan de toit suit sa pente). Absente
   *  d'un groupe CUIT PAR FACE : son image ne se répète pas, elle s'échantillonne sur `uv1`. */
  periodM?: { u: number; v: number };
  /** Gabarit MÉTRIQUE (quantifié au cm) d'un groupe CUIT PAR FACE — les faces qui le partagent
   *  partagent leur image (`faceBake`). */
  bake?: { wM: number; hM: number };
  /** PART de mur des faces du groupe — seule une part que le colombage habille se cuit (`needsFaceBake`). */
  part?: string;
  /** Réponse à la lumière authorée du matériau (décor volumique) — le groupe se monte alors en
   *  matériau à rugosité/métal (`worldMaterials`) au lieu du lambertien commun. */
  pbr?: { roughness: number; metalness: number };
  /** Le groupe porte du DÉCOR VOLUMIQUE (`material.domain === 'prop'`) — l'identité STRUCTURELLE que
   *  le mode calage de l'éditeur interroge pour ne surcharger que le mobilier (`calageProps.ts`),
   *  jamais un préfixe de `key` relu à la ficelle. */
  prop?: true;
}

const NU: SurfaceGroup = { key: 'nu', kind: null };

/** Dimension de face quantifiée au CENTIMÈTRE : la maille de partage d'une cuisson. */
const cm = (m: number): number => Math.round(m * 100) / 100;

/** Groupe d'une face : sa surface (couleur + recette), sa variante de période, et l'échelle métrique de
 *  celle-ci. Le SOL a une période propre, seedée à la seule recette (`groundCoursesPeriod`) : une seule
 *  variante. Un PAN DE TOIT garde la largeur de période de l'appareillage mais son pas de rang vient de
 *  SA pente — deux nappes de pentes différentes ne partagent donc pas un groupe. Une face à COLOMBAGE
 *  sort de la période pour sa propre CUISSON, groupée par gabarit (`faceBakeKey`). */
export function faceGroup(wf: WorldFace, mpt: number): SurfaceGroup {
  const surface = faceSurface(wf.face);
  const { domain, part } = wf.face.material;
  // DÉCOR VOLUMIQUE : un groupe par MATÉRIAU de recette — aucune période, aucune cuisson par face, mais
  // sa réponse à la lumière lui est propre, et c'est le groupe qui la porte jusqu'au matériau monté.
  if (domain === 'prop')
    return { key: `prop|${wf.face.material.id}`, kind: null, surfaceKey: surface.surfaceKey, color: surface.color, prop: true, ...(surface.pbr ? { pbr: surface.pbr } : {}) };
  const kind: PeriodKind = domain === 'terrain' ? 'ground' : 'wall';
  // La variante se cale sur le CÔTÉ D'ARÊTE de l'élément — la même clé que `variantOf(cell, side)` de
  // le peintre SVG (`authoring/detailSvg.ts`). Sans côté (pan de toit),
  // la `part` du matériau tient lieu d'identité.
  const variant = kind === 'ground' ? 0 : variantOf(wf.cell, wf.side ?? part ?? domain);
  if (needsFaceBake(surface.recipe, kind, part)) {
    const frame = faceUvFrame(facePoly(wf.face, mpt));
    const bake = { wM: cm(frame.du), hM: cm(frame.dv) };
    // La variante d'anti-périodicité ne joue que sur le FOND de période de la cuisson : sans assises,
    // les N variantes cuisent la MÊME image sous N clés (mesuré : 3 textures identiques par gabarit).
    const bakeVariant = surface.recipe?.courses ? variant : 0;
    return {
      key: faceBakeKey(surface.surfaceKey, bake.wM, bake.hM, bakeVariant),
      kind,
      surfaceKey: surface.surfaceKey,
      variant: bakeVariant,
      color: surface.color,
      recipe: surface.recipe,
      bake,
      part,
    };
  }
  // ASSISES : décidées par la SURFACE (recette + échelle d'UV), sans aucun filtre de `WallPart`. Le
  // peintre SVG, lui, les restreint à trois parts (`COURSED`, `authoring/wallsSvg.ts`) — une part
  // maçonnée hors de ce jeu (plinthe…) portant `courses` reçoit donc ici des assises que le SVG ne
  // peint pas. Bascule VISIBLE PAR LE JOUEUR au passage au volumique
  // (#1176) : à trancher en recette, pas au hasard d'un backend.
  const c = surface.recipe?.courses;
  if (!surface.uvScaleM || !c) return NU;
  const periodM =
    domain === 'roof'
      ? { u: surface.uvScaleM.u, v: 2 * roofCourseStepM(wf.pitchM, c.hM, ROOF_SLOPE_M) }
      : surface.uvScaleM;
  return {
    key: `${surface.surfaceKey}|${kind}|v${variant}|p${periodM.v.toFixed(4)}`,
    kind,
    surfaceKey: surface.surfaceKey,
    variant,
    color: surface.color,
    recipe: surface.recipe,
    periodM,
  };
}

/** Découpage d'une liste de faces en groupes de surface : les groupes DANS L'ORDRE d'émission, et pour
 *  chacun les index de ses faces (dans l'ordre de peinture des builders — le rang coplanaire, lui, s'est
 *  calculé sur la liste entière AVANT tout regroupement). */
export function surfaceGrouping(listées: readonly WorldFace[], mpt: number): { groups: SurfaceGroup[]; faceIndices: number[][] } {
  const groups: SurfaceGroup[] = [];
  const faceIndices: number[][] = [];
  const rang = new Map<string, number>();
  listées.forEach((wf, i) => {
    const g = faceGroup(wf, mpt);
    let k = rang.get(g.key);
    if (k === undefined) {
      k = groups.length;
      rang.set(g.key, k);
      groups.push(g);
      faceIndices.push([]);
    }
    faceIndices[k].push(i);
  });
  return { groups, faceIndices };
}

/** La géométrie fusionnée porte ses groupes de surface (index = `materialIndex` de `geometry.groups`) :
 *  c'est le contrat entre le maillage et les matériaux que l'écran monte. */
export interface WorldGeometry extends THREE.BufferGeometry {
  userData: { surfaceGroups: SurfaceGroup[]; propVertexRanges: PropVertexRange[] };
}

/** PLAGE d'une face dans la géométrie fusionnée : les sommets qu'elle occupe, le groupe de surface qui
 *  la dessine, l'élément dont elle vient, la case d'ANCRAGE de cet élément, et sa couleur NUE
 *  (albédo de surface + variance de teinte de tuile). C'est le seul index dont les DEUX passes en place
 *  ont besoin : `applyVisibilityTint` (couleurs) et `applyCutawayMask` (index de dessin). */
export interface FaceSpan {
  /** Case d'ANCRAGE de l'élément. Sa teinte de visibilité ne s'y prend PAS : le champ s'échantillonne à
   *  la position de chaque SOMMET (`applyVisibilityTint`) — seul l'ÉTAGE `z` vient d'ici. */
  cell: { x: number; y: number; z: number };
  /** Élément de PROVENANCE — ce que la loi de dégagement (`KeepEl`) interroge. */
  el: SceneEl;
  /** Groupe de surface qui dessine la face (= `materialIndex` de `geometry.groups`). */
  group: number;
  /** Premier sommet de la face, et nombre de sommets. */
  start: number;
  count: number;
  /** Albédo NU de la surface (jamais teinté : la teinte se re-multiplie sur lui, elle ne s'y cumule pas). */
  color: string;
  /** Variance de teinte de la tuile — invariante à la visibilité, donc cuite avec la géométrie. */
  varFactor: number;
}

/** Monde CUIT : la géométrie (positions, uv, uv1, groupes de surface) et l'index qui permet d'en
 *  repeindre les couleurs par case et d'en masquer les faces par élément. Le bake est INVARIANT à la
 *  visibilité ET au dégagement.
 *
 *  CONTRAT DE PROPRIÉTÉ — un bake sert UN consommateur à la fois : la géométrie rendue EST le bake
 *  (`applyVisibilityTint` réécrit son attribut `color` en place, `applyCutawayMask` son index, et tous
 *  deux la rendent telle quelle), donc deux vues qui teinteraient ou masqueraient le MÊME `BakedWorld`
 *  s'écraseraient l'une l'autre. Un second consommateur prend SON bake (`bakeWorldGeometry`), il
 *  n'emprunte pas celui d'un autre. */
export interface BakedWorld {
  geometry: WorldGeometry;
  spans: FaceSpan[];
  /** Échelle MÉTRIQUE de la cuisson (mètres par tuile) : de quoi ramener la position d'un sommet en
   *  coordonnées de GRILLE, la maille du champ de visibilité. */
  mpt: number;
  /** MODELÉ DE FORME (#1300) : le facteur de famille d'orientation de CHAQUE SOMMET, cuit avec la
   *  géométrie (il n'est fonction que d'elle). PAR SOMMET et non par `FaceSpan`, parce qu'un span est
   *  une FACE et qu'une face de structure est une BOÎTE : mesuré sur l'arène, 1 598 spans sur 4 395
   *  (71,1 % des triangles) portent au moins deux familles, jusqu'à 5 dans un seul span — un facteur
   *  par span aurait donné aux deux joues d'un mur la même valeur. */
  shades: Float32Array;
  /** PERÇABILITÉ (#1176) : ce que la découpe locale a le droit de trouer, PAR SOMMET — `0` pour une
   *  nappe de SOL, `1` pour tout ce qui se dresse ou coiffe (murs, toits). L'exclusion du sol est
   *  STRUCTURELLE : elle se lit sur le `kind` de l'élément de provenance à la cuisson, jamais sur une
   *  liste tenue à la main ailleurs — un trou dans le sol ouvrirait un puits sur le fond de la scène.
   *  PAR SOMMET pour la même raison que `shades` : c'est l'attribut que le shader lit (`aPercable`,
   *  `percageLocal.ts`), et un attribut est par sommet. */
  percables: Float32Array;
}

/** PORTE du modelé : ce que le facteur de famille devient sous un soleil allumé à la part `fade`
 *  (`sunFade`, `stage/stageLights.ts`). `fade = 0` — intérieur, nuit, soleil rasant — laisse le
 *  facteur PLEIN ; `fade = 1` le ramène à 1, la directionnelle faisant seule le modelé. CONTINUE et
 *  affine en `fade` : le lever ne peut pas y faire de marche. */
export function shadeSousSoleil(shade: number, fade: number): number {
  return 1 - (1 - shade) * (1 - fade);
}

/**
 * READ-SET de la CUISSON du monde (`worldFaces` → `buildFloors`/`buildWalls`/`buildRoofs`, plus
 * l'orientation des triangles qui lit `scene.dimensions`) et des accents de sol qui la partagent
 * (`groundAccents.sceneGroundAccents`, bâti sur les MÊMES faces). Un hôte qui reforge la référence de
 * scène à chaque geste (l'éditeur : `paintTiles` en produit une par `pointermove`) retient sa cuisson
 * SUR CETTE LISTE — sinon 634 ms de re-cuisson par tick, mesurés sur La Diligence.
 *
 * DÉRIVÉE DU READ-SET, pas devinée — et gardée champ par champ (`bake-retention.test.ts`), parce
 * qu'un champ manquant = un monde périmé à l'écran, invisible autrement.
 * `scene.entities` n'y entre PAS par sa référence : le décor VOLUMIQUE y contribue par une SIGNATURE
 * (`propVolumeSignature`, une chaîne) et par les objets de recette/matériau qu'il fait lire
 * (`propRecipeDeps`) ; les matières des deux autres domaines cuits y entrent par `matiereDeps`, et
 * les TERRAINS par `terrainDeps`. Un
 * tableau d'entités reforgé sans que le mobilier bouge — le cas COURANT du combat (despawn,
 * déplacement forcé) — ne recuit donc rien, et la garde discriminante vit dans `prop-picking.test.ts`.
 * `scene.effectZones` en est ABSENT sciemment : `buildRoofs` le lit (`massRoomZoneIds`), mais il
 * n'entre dans AUCUNE face, aucun sommet, aucun groupe de surface — seulement dans le champ
 * `roomZoneIds`, quel que soit l'élément qui le porte (toit, façade, décor volumique solidaire d'une
 * nappe). Ce champ ne SURVIT PLUS à la cuisson (`elCuit` ci-dessous le retire) : un monde cuit ne peut
 * donc pas rendre une zone de pièce périmée à la loi de dégagement qui l'interroge. L'hôte qui en a
 * besoin la résout sur SA scène vive, par la clé stable de l'élément (`roomZonesByElKey`).
 */
export function worldBakeDeps(scene: Scene, mpt: number): readonly unknown[] {
  return [scene.layers, scene.dimensions, scene.walls, scene.architecture, scene.reliefDefaults, scene.roofDefaults, scene.metresPerTile, mpt,
    propVolumeSignature(scene), ...propRecipeDeps(scene), ...matiereDeps(scene), ...terrainDeps()];
}

/** Ce qu'une identité de cache écrit à la place d'un type NON NOMMÉ (#877) — jeton de SIGNATURE,
 *  jamais un id : rien ne se résout sous ce nom, et il ne peut collider avec aucune entrée de
 *  `props.json` (les crochets n'appartiennent pas aux ids). */
const REF_NON_NOMMEE = '[sans type]';

/** Ce que la cuisson retient des ENTITÉS : la signature des seuls décors à recette — id, ref, case,
 *  couche, cap. `scene.entities` ENTIER n'entrerait pas ici : un despawn de combat ou un déplacement
 *  forcé en reforge la référence à chaque tour, et recuirait un monde que rien n'a déplacé. */
function propVolumeSignature(scene: Scene): string {
  const parts: string[] = [];
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop' || !findPropById(ent.ref)?.volume) continue;
    parts.push(`${ent.id}|${ent.ref}|${ent.pos.x},${ent.pos.y}|${ent.z ?? 0}|${ent.facing ?? 'S'}`);
  }
  return parts.join(';');
}

/**
 * UNE DEP PAR OBJET EMPLOYÉ — la règle de TAILLE du read-set, écrite une seule fois pour les deux
 * moissons de catalogue ci-dessous (#1343). Les entrées sont comparées par IDENTITÉ, terme à terme, à
 * chaque geste de l'hôte : un objet cité N fois n'y détecte rien de plus que la première fois, et
 * gonfle la comparaison à proportion de ce que la scène POSE. Le `Set` garde l'ordre de première
 * rencontre — deux scènes au même catalogue employé rendent le même ENSEMBLE, dans l'ordre de leurs
 * entités et de leurs corps, que `propVolumeSignature` et `scene.architecture` portent déjà. PURE.
 */
const depsUniques = (moisson: (ajouter: (dep: unknown) => void) => void): readonly unknown[] => {
  const out = new Set<unknown>();
  moisson((dep) => { out.add(dep); });
  return [...out];
};

/** Ce que la cuisson lit du CATALOGUE pour les décors volumiques de la scène : leur recette et les
 *  matériaux qu'elle nomme, à PLAT (une dep par objet, comparée par identité comme les autres) — une
 *  retouche de recette au Codex change l'objet, donc la dep, sans que la scène ait bougé.
 *  Une dep par recette EMPLOYÉE (`depsUniques`), quel que soit le nombre d'instances posées. */
function propRecipeDeps(scene: Scene): readonly unknown[] {
  return depsUniques((ajouter) => {
    for (const ent of scene.entities) {
      if (ent.kind !== 'prop') continue;
      const volume = findPropById(ent.ref)?.volume;
      if (!volume) continue;
      ajouter(volume);
      for (const primitive of volume.primitives) ajouter(findPropMaterialById(primitive.material));
    }
  });
}

/**
 * Ce que la cuisson lit du catalogue des MATIÈRES pour les deux autres domaines du monde — MÊME patron
 * que `propRecipeDeps`, et par la MÊME règle (`depsUniques`) : une dep par OBJET EMPLOYÉ, comparée par
 * identité, si bien qu'une retouche de matière au Codex change la dep sans que la scène ait bougé.
 * Le dédoublonnage mord ici comme là : un quartier de cent corps couverts de la même tuile n'a qu'UNE
 * couverture à surveiller, et la couverture effective d'un corps est le plus souvent celle de ses
 * propres masses.
 *  - TOITURES : celles que la scène NOMME (`BuildingMass.material`, et la couverture EFFECTIVE dont les
 *    masses DÉRIVÉES héritent — `toitureEffective`, `state/sceneEdit.ts` : corps, puis type de bâtiment,
 *    puis scène).
 *    Résolues par le MÊME accès que la cuisson (`roofMaterial`, `builders/roofs.ts`). Une couverture
 *    qu'aucun corps ne pose ne recuit donc rien.
 *  - RELIEF : le domaine ENTIER. Les ids que le sol émet viennent de la SCÈNE (`reliefDefaults`, dep
 *    propre de `worldBakeDeps`) et des TERRAINS à bloc plein (`terrainDeps`) — filtrer le domaine sur
 *    ces deux sources en ferait une troisième vérité. Le domaine, lui, est DÉRIVÉ du document : il ne
 *    peut pas rater une matière lue. Prix de l'exhaustivité, dit : éditer une matière de relief
 *    qu'aucune scène ne pose recuit une fois pour rien.
 */
function matiereDeps(scene: Scene): readonly unknown[] {
  return depsUniques((ajouter) => {
    for (const body of scene.architecture ?? []) {
      ajouter(roofMaterial(toitureEffective(scene, body).material));
      for (const mass of body.masses) ajouter(roofMaterial(mass.material));
    }
    for (const matiere of matieresDe('relief')) ajouter(matiere);
  });
}

/**
 * Ce que la cuisson lit du dataset des TERRAINS (#1690) — le document ENTIER, une dep par entrée,
 * comparée par identité : `swatch`, `detail`, `priority` et `solidHeightM` entrent tous dans les
 * faces de sol (`buildFloors` → `faceSurface`), et l'atelier réécrit l'entrée éditée. Le lire ENTIER
 * plutôt que « ce que la scène pose » est le MÊME choix que le domaine `relief` ci-dessus : les ids
 * de terrain vivent dans les couches, et un filtre les recopierait. Prix dit : éditer `neige` recuit
 * une scène qui n'en pose pas.
 */
function terrainDeps(): readonly unknown[] {
  return tousLesTerrains();
}

/** READ-SET de `heightAt` (`state/scene.ts`) — la SEULE lecture de scène des passes de billboards
 *  (`collectBillboards`, `actorBillboards` : elles prennent tout le reste de leurs éléments). */
export function sceneHeightDeps(scene: Scene): readonly unknown[] {
  return [scene.layers, scene.dimensions];
}

/**
 * Ce que le monde CUIT retient d'un élément : son identité de dégagement, PRIVÉE de tout champ dérivé
 * d'une donnée HORS read-set de la cuisson. Un seul aujourd'hui, et il est piégeux — `roomZoneIds`
 * (nappes de toit `buildRoofs`, façades `buildWalls`, décor volumique solidaire d'une nappe
 * `buildProps`) descend de `scene.effectZones` : retenu dans le bake, il aurait rendu une vérité
 * PÉRIMÉE à `applyCutawayMask`, qui interroge `KeepEl` sur l'élément cuit. Le retirer rend la
 * péremption IMPOSSIBLE au lieu de la rendre improbable — pour TOUT élément qui en porte, sans liste.
 */
function elCuit(el: SceneEl): SceneEl {
  if ((el as { roomZoneIds?: readonly string[] }).roomZoneIds === undefined) return el;
  const { roomZoneIds: _zones, ...reste } = el as SceneEl & { roomZoneIds?: readonly string[] };
  return reste as SceneEl;
}

/**
 * ZONES DE PIÈCE par clé d'élément, résolues sur une scène VIVE — le pendant d'`elCuit` : ce que le
 * monde cuit ne retient pas, l'hôte le redemande ici, et sa loi de dégagement (`KeepEl`) le lit à
 * jour. La clé est celle du builder (`SceneEl.key`), stable d'une frame à l'autre.
 * MÉMOÏSÉE par référence de scène : en JEU la référence est stable (ce calcul ne se rejoue pas d'un
 * pas à l'autre) ; un hôte qui la reforge au tick ne la consomme pas (l'éditeur n'a pas de cutaway).
 */
const zonesVivesMemo = memoByRef((scene: Scene) => {
  const table = new Map<string, readonly string[]>();
  for (const el of buildRoofs(scene)) if (el.roomZoneIds?.length) table.set(el.key, el.roomZoneIds);
  for (const el of buildWalls(scene)) if (el.roomZoneIds?.length) table.set(el.key, el.roomZoneIds);
  for (const el of buildProps(scene))
    if (estPropVolumique(el) && el.roomZoneIds?.length) table.set(el.key, el.roomZoneIds);
  return table;
});

export function roomZonesByElKey(scene: Scene): ReadonlyMap<string, readonly string[]> {
  return zonesVivesMemo(scene);
}

/** Géométrie MONDE fusionnée de la scène, SANS teinte de visibilité ni dégagement : une
 *  `BufferGeometry` dont chaque triangle a ses propres sommets (→ `computeVertexNormals` donne la
 *  normale de FACE, l'ombrage plat du mode éclairé), indexée d'un index IDENTITÉ que
 *  `applyCutawayMask` compacte ensuite. C'est la passe LOURDE — triangulation, rang coplanaire, UV,
 *  groupes de surface (mesuré #1176 : 437 ms sur l'arène, 1 601 ms sur l'opéra) — et rien de ce
 *  qu'elle calcule ne dépend de ce que le groupe voit ni de ce qui le coiffe : elle ne se rejoue qu'à
 *  la scène ou à l'échelle.
 *  Un appelant = un bake (cf. `BakedWorld`) : `stage/GameStage3D`
 *  (l'écran de jeu) le sien — aucun des deux ne partage le bake de l'autre. */
export function bakeWorldGeometry(scene: Scene, mpt: number): BakedWorld {
  const listées = worldFaces(scene);
  const faces = listées.map((f) => f.face);
  // Le RANG coplanaire se calcule sur la liste ENTIÈRE de la scène (contrat de `coplanarRanks`).
  const geoms = facesGeometry(faces, mpt, faceDepthOf());
  const positions: number[] = [];
  const uvs: number[] = [];
  const uv1s: number[] = [];
  const spans: FaceSpan[] = [];
  const shades: number[] = [];
  const percables: number[] = [];
  // ORIENTATION des triangles : la LOI est `worldTris.ts:orienterPoly`, seule définition du dehors —
  // la cuisson en tire le sens de parcours et la famille d'ombrage, l'instrument de QC son cull et sa
  // teinte (`scripts/qc/lib/plancheVolumique.ts`). Sous le régime `oriented`, l'heuristique de
  // carte y retournait la joue intérieure de chaque boîte de mur (mesuré #1176 : siège 1216/2480
  // triangles de mur, arène 2756/5512, soit ~50 %) et 1887/4020 triangles de décor (#1624).
  // Le CENTRE de la carte est ce que ce site fournit à la loi : elle en tire le dehors d'une surface
  // ouverte verticale.
  const centreCarte = { x: ((scene.dimensions.w - 1) / 2) * mpt, z: ((scene.dimensions.h - 1) / 2) * mpt };
  // PLAGES DE PICKING : les sommets ORIGINAUX d'un décor volumique, relevés AVANT toute indexation —
  // un cutaway réécrit l'index de dessin, jamais les sommets. Un lot par (entité × groupe de surface) :
  // la cuisson groupe par matériau, donc un même décor à deux matériaux occupe deux plages disjointes.
  const propVertexRanges: PropVertexRange[] = [];
  let plageEnCours: PropVertexRange | null = null;
  const pousser = (i: number, groupe: number) => {
    const g = geoms[i];
    const début = positions.length / 3;
    // PERÇABILITÉ (#1176) : le `kind` de l'élément de provenance, et lui seul — le SOL ne se troue pas.
    const perçable = listées[i].el.kind === 'floor' ? 0 : 1;
    g.tris.forEach((tri, t) => {
      const { versLExterieur, normale } = orienterPoly(tri, g.oriented, centreCarte);
      // MODELÉ DE FORME (#1300) : la famille se lit sur la normale TELLE QUE LA LOI LA PRÉSENTE — la
      // normale géométrique d'origine ne porte de sens QUE sous le régime `oriented`. Mesuré sur trois
      // cartes (arène, opéra, siège) : 100 % des triangles de sol sortent du pivot avec une normale
      // géométrique vers le BAS (5 112 / 1 178 / 3 328), que cette loi retourne vers le haut ; les lire
      // avant elle aurait peint tous les sols de toutes les scènes en famille de soffite.
      const s = shadeFactorOf(shadeFamily(normale));
      // Le retournement d'un triangle PERMUTE ses UV comme ses sommets (elles sont par SOMMET).
      const ordre = versLExterieur ? [0, 1, 2] : [0, 2, 1];
      for (const k of ordre) {
        const p = tri[k];
        positions.push(p.x, p.y, p.z);
        uvs.push(g.uv[t][k].u, g.uv[t][k].v);
        uv1s.push(g.uv1[t][k].u, g.uv1[t][k].v);
        shades.push(s);
        percables.push(perçable);
      }
    });
    // La couleur de sommet porte l'albédo du matériau × la variance de teinte de la surface (un aplat
    // répété tuile après tuile se lit sinon comme une nappe de peinture) × la visibilité ÉCHANTILLONNÉE
    // au sommet — ce dernier facteur SEUL est réversible, et c'est `applyVisibilityTint` qui le pose.
    const entId = faces[i].entId;
    if (entId) {
      if (plageEnCours && plageEnCours.entId === entId && plageEnCours.vertexStart + plageEnCours.vertexCount === début)
        plageEnCours.vertexCount = positions.length / 3 - plageEnCours.vertexStart;
      else {
        plageEnCours = { entId, vertexStart: début, vertexCount: positions.length / 3 - début };
        propVertexRanges.push(plageEnCours);
      }
    } else plageEnCours = null;
    const surface = faceSurface(faces[i]);
    spans.push({
      cell: listées[i].cell,
      el: elCuit(listées[i].el),
      group: groupe,
      start: début,
      count: positions.length / 3 - début,
      color: surface.color,
      varFactor: tintVarFactor(surface.recipe, listées[i].cell),
    });
  };
  // Les faces sortent GROUPÉES par surface (un groupe = un dessin) ; à l'intérieur d'un groupe, l'ordre
  // de peinture des builders est conservé. Les `spans` en héritent : ils sont CONTIGUS par groupe, et
  // dans l'ordre des groupes — ce dont le masque de dégagement se sert pour compacter l'index d'une
  // seule passe linéaire.
  const { groups, faceIndices } = surfaceGrouping(listées, mpt);
  const groupSpans: [number, number][] = [];
  faceIndices.forEach((idx, k) => {
    const début = positions.length / 3;
    plageEnCours = null; // une plage ne franchit jamais un groupe : c'est le matériau qui la borne
    for (const i of idx) pousser(i, k);
    groupSpans.push([début, positions.length / 3 - début]);
  });
  const geometry = new THREE.BufferGeometry() as WorldGeometry;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
  // `uv` = maille MONDE en mètres (textures répétées) ; `uv1` = face d'origine en [0,1]² (ornements
  // cuits par face). Les deux jeux voyagent dans LA géométrie fusionnée — jamais un mesh par surface.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1s, 2));
  // PERÇABILITÉ : l'attribut que le fragment de découpe locale lit (`percageLocal.ts`). Il voyage dans
  // LA géométrie fusionnée comme les uv — un matériau qui ne porte pas le défine ne le déclare même pas.
  geometry.setAttribute(PERCABLE_ATTRIBUT, new THREE.Float32BufferAttribute(percables, 1));
  groupSpans.forEach(([début, count], k) => geometry.addGroup(début, count, k));
  geometry.userData = { surfaceGroups: groups, propVertexRanges };
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  // INDEX IDENTITÉ : le monde nu se dessine entier, sommet par sommet dans l'ordre où il a été cuit.
  // Aucun sommet n'est partagé (`computeVertexNormals` ci-dessus a donc bien donné des normales de
  // FACE) ; l'index n'existe que pour donner au masque de dégagement une case à réécrire.
  const nbSommets = positions.length / 3;
  const identité = new Uint32Array(nbSommets);
  for (let i = 0; i < nbSommets; i++) identité[i] = i;
  geometry.setIndex(new THREE.BufferAttribute(identité, 1));
  return { geometry, spans, mpt, shades: new Float32Array(shades), percables: new Float32Array(percables) };
}

/** Applique le DÉGAGEMENT d'architecture à un monde cuit : l'index de dessin est ré-écrit EN PLACE en
 *  COMPACTANT les faces gardées, groupe de surface par groupe de surface, et les `groups` de la
 *  géométrie sont ré-ancrés sur ces plages. Positions, couleurs, uv, normales et matériaux sont
 *  INTOUCHÉS : une masse retirée cesse simplement d'être référencée par l'index.
 *
 *  C'est le canal GÉOMÉTRIE, jumeau d'`applyVisibilityTint` : il suit le PAS du groupe (`cleared`
 *  change à chaque case franchie et à chaque cran de caméra) sans jamais rejouer la triangulation.
 *  Rend LA géométrie du bake, pas une copie — cf. le contrat de propriété de `BakedWorld` — et ce qui
 *  a RÉELLEMENT bougé : `bouge` est vrai si l'index de dessin ou l'ancrage d'un groupe a changé. Même
 *  patron que `reposeGroundAccents` (`backends/webgl/groundAccents`) : un verdict identique ne vaut ni
 *  image ni carte d'ombre, et une référence de `KeepEl` neuve pour un verdict identique est le cas
 *  COURANT (un franchissement de cran en passe une). */
export function applyCutawayMask(baked: BakedWorld, keepEl: KeepEl): { geometry: WorldGeometry; bouge: boolean } {
  const { geometry, spans } = baked;
  const index = geometry.getIndex() as THREE.BufferAttribute;
  const arr = index.array as Uint32Array;
  const groups = geometry.groups;
  let écrit = 0;
  let groupe = -1;
  let début = 0;
  let bouge = false;
  const clore = () => {
    if (groupe >= 0) {
      if (groups[groupe].start !== début || groups[groupe].count !== écrit - début) bouge = true;
      groups[groupe].start = début;
      groups[groupe].count = écrit - début;
    }
  };
  for (const span of spans) {
    if (span.group !== groupe) {
      clore();
      groupe = span.group;
      début = écrit;
    }
    if (!keepEl(span.el)) continue;
    const fin = span.start + span.count;
    for (let i = span.start; i < fin; i++) {
      if (arr[écrit] !== i) bouge = true;
      arr[écrit++] = i;
    }
  }
  clore();
  index.needsUpdate = true;
  return { geometry, bouge };
}

/** Repeint la VISIBILITÉ d'un monde cuit : l'attribut `color` est ré-écrit EN PLACE depuis la couleur
 *  NUE de chaque face (jamais depuis la couleur affichée — une teinte se re-multiplie, elle ne se cumule
 *  pas), la géométrie n'est pas touchée. C'est la passe qui suit le PAS du groupe. Rend la géométrie,
 *  pour l'appelant qui compose les deux — LA géométrie du bake, pas une copie : le dernier appel fait
 *  la couleur affichée. D'où le contrat de propriété de `BakedWorld` (un bake = un consommateur de teinte).
 *
 *  CHAMP CONTINU PAR SOMMET (#1176, C6) : la teinte s'échantillonne à la POSITION MONDE de CHAQUE
 *  sommet, ramenée en coordonnées de grille (`baked.mpt`), à l'étage de l'élément. La grille est du
 *  système de jeu ; la lumière et la vue n'en dépendent pas. Une masse qui couvre 17 cases n'est donc
 *  plus teintée d'un bloc par sa case d'ancrage, et un mur d'arête — à cheval sur deux cases — reçoit
 *  aux deux bouts la teinte du monde où il se tient : la frontière du brouillard se FOND, elle ne se
 *  décalque plus sur le quadrillage.
 *
 *  C'est aussi la passe qui porte le MODELÉ DE FORME (#1300) : le facteur de famille d'orientation du
 *  sommet (`baked.shades`), passé par la PORTE du soleil `fade` — la part de soleil réellement allumée
 *  (`sunFade`, `stage/stageLights.ts`). `fade = 1` (plein soleil) est le NEUTRE de cette porte : le
 *  modelé s'efface entièrement, la directionnelle le faisant seule. C'est pourquoi un appelant qui
 *  n'a pas de soleil à déclarer (gardes de géométrie, cadrage) obtient exactement les couleurs
 *  d'avant le lot.
 *
 *  Rend aussi ce qui a RÉELLEMENT été écrit (`bouge`, même patron que son jumeau ci-dessus) : deux
 *  champs de vision qui donnent les mêmes couleurs ne valent pas une image. */
export function applyVisibilityTint(baked: BakedWorld, tintAt: TintAt, fade = 1): { geometry: WorldGeometry; bouge: boolean } {
  const attr = baked.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  const pos = (baked.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const c = new THREE.Color();
  const parTuile = 1 / baked.mpt;
  let bouge = false;
  for (const span of baked.spans) {
    c.set(span.color).multiplyScalar(span.varFactor);
    const fin = (span.start + span.count) * 3;
    for (let i = span.start * 3, v = span.start; i < fin; i += 3, v++) {
      // `position` et `color` partagent l'indexation par sommet : i pointe le MÊME sommet dans les deux.
      const k = shadeSousSoleil(baked.shades[v], fade) * tintAt(pos[i] * parTuile, pos[i + 2] * parTuile, span.cell.z);
      const r = c.r * k;
      const g = c.g * k;
      const b = c.b * k;
      if (!bouge && (arr[i] !== r || arr[i + 1] !== g || arr[i + 2] !== b)) bouge = true;
      arr[i] = r;
      arr[i + 1] = g;
      arr[i + 2] = b;
    }
  }
  attr.needsUpdate = true;
  return { geometry: baked.geometry, bouge };
}

/** Monde cuit ET teinté en un geste — pour un appelant qui n'a pas de teinte à faire varier (gardes,
 *  cadrage). Un écran qui suit la visibilité garde le bake et ne rejoue que `applyVisibilityTint`. */
export function buildWorldGeometry(scene: Scene, mpt: number, tintAt: TintAt, fade = 1): WorldGeometry {
  return applyVisibilityTint(bakeWorldGeometry(scene, mpt), tintAt, fade).geometry;
}

/** Un sujet de billboard prêt à texturer : où il se pose, à quelle échelle, et comment il se dessine. */
export interface BillboardSubject {
  /** Identité de cache (hors vue/miroir/palier — cf. `billboardTextureKey`). */
  identity: string;
  /** Id du COMBATTANT dessiné, quand ce sujet en est un (`actorBillboards`) — ce que le hit-test de
   *  sprite rend au pointeur (`stage/spritePicker.ts`). Absent pour un figurant ou un décor : ni l'un
   *  ni l'autre n'est cliquable. */
  cid?: string;
  /** Id de l'ENTITÉ DE SCÈNE dessinée, quand ce figurant JOUE une ambiance authorée
   *  (`SceneEntity.anim`) — l'identité de sa piste de flipbook (`stage/boardPose.boardTrackId`), et
   *  rien d'autre : il ne devient ni cliquable ni glissable pour autant. */
  eid?: string;
  /** COULEUR D'ÉQUIPE du jeton (#1297) — celle de son anneau aux pieds (`teamRingDecor`), portée ici
   *  pour que sa SILHOUETTE à travers les murs en soit teintée. Absente pour un figurant ou un décor,
   *  qui n'appartiennent à aucune équipe et ne se silhouettent pas. */
  teamColor?: string;
  kind: BillboardKind;
  /** Ancre PIEDS en repère three (mètres). */
  anchor: THREE.Vector3;
  /** Orientation MONDE d'auteur. */
  facing: Dir8;
  /** Multiplicateur de taille (espèce × Taille pour un personnage, empreinte de décor pour un prop). */
  scaleK: number;
  /** CASE d'ancrage — celle dont la teinte de visibilité s'applique au quad. Le sujet porte la case,
   *  jamais la teinte : la teinte est une VALEUR DE FRAME, que la passe de pose échantillonne
   *  (`stage/boardPose.poseBoards`). Cuite ici, elle mettrait le champ de vision dans l'IDENTITÉ des
   *  sujets, et un pas du groupe remonterait tous les quads du monde. */
  cell: { x: number; y: number; z: number };
  /** Boîte locale du fragment SVG. */
  box: { w: number; h: number };
  /** Fragment SVG pour une vue (défs globaux inclus : le blob de rasterisation est un document isolé). */
  svg: (view: View, mirror: boolean, camRot: Rot) => string;
  /**
   * MÊME chaîne de dessin que `svg`, à la FRAME `k` d'une planche de `n` frames du geste `def` — ce
   * qu'un flipbook cuit frame par frame (`backends/webgl/atlasBake.ts`), là où `svg` fige la pose du
   * sujet à l'instant du build.
   *
   * C'est ICI que vit tout ce que l'écran n'a pas : le `BodyPlan` d'un gabarit (`planPoseAt`), la
   * PRISE D'ARME d'un bipède (`addPose(holdPose, pose)`, parité `RigToken`), les opts d'apparence et
   * l'équipement. L'appelant ne fournit qu'un geste et un rang de frame — jamais une pose d'os.
   *
   * CONTRAT : porté par les sujets à UN corps (rig bipède, gabarit de créature). Le couple MONTÉ ne le
   * porte pas — son fragment est un composite (cavalier assis sur les os de la monture), dont
   * l'animation demande DEUX poses. Un `def` d'une AUTRE voie que celle du corps rend son REPOS.
   *
   * `opts.ground` : l'effondrement d'un bipède n'est pas un clip mais une interpolation vers la pose
   * au sol visée (`rigPoseAtFrame`) — un gabarit, lui, la porte dans son def (`planDyingDef`).
   */
  frameSvg?: (view: View, mirror: boolean, def: ClipDef, k: number, n: number, opts?: { ground?: Exclude<GroundState, null> }) => string;
  /** Ce que le FLIPBOOK doit savoir du CORPS de ce sujet — le contrat qui évite à l'écran de
   *  connaître `BodyPlan`, le store, ou la garde-robe (#1176, L4). */
  anim?: SubjectAnim;
}

/** Ce qu'un sujet dit de son corps au flipbook : de quoi CHOISIR ses gestes, jamais de quoi les
 *  dessiner (le dessin reste derrière `frameSvg`). */
export interface SubjectAnim {
  /** Voie de corps : bipède rigué, ou gabarit de créature. */
  voie: 'rig' | 'plan';
  /** Clip d'AMBIANCE authoré (`SceneEntity.anim`) — figurant de scène seulement, et seulement quand
   *  ce corps sait le jouer. */
  ambient?: string;
  /** État AU SOL du corps au montage (mort / À Terre) : le geste joué est l'EFFONDREMENT. */
  ground?: Exclude<GroundState, null>;
  /** Déplacement par BOND (trait LDB 85) plutôt que pas de marche — gabarits. */
  leap?: boolean;
}

/** Arme PRINCIPALE d'un équipement — la MÊME lecture que le stage affine (`useRigAnim`), d'où se
 *  dérive la PRISE D'ARME du corps (`weaponRest`). */
function mainWeaponOf(equip: EquipCtx): Weapon | undefined {
  return equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
}

/** DESSIN d'un personnage de scène : rig humanoïde (`resolveRig`) ou gabarit de créature (`planById`),
 *  même résolution par la DONNÉE que le jeu (`entityRender`, preset de PNJ compris) et même
 *  équipement que l'iso (`entityRigProfileFor`, dont l'appartenance à une rencontre : `enrolled`).
 *  Rend le corps AU REPOS (`draw`) et la couture de flipbook du MÊME corps (`frame`).
 *  `null` = aucune apparence résoluble. */
function personnageDraw(ent: SceneEntity, enrolled: boolean, assis: number | null): {
  voie: 'rig' | 'plan';
  /** Ce corps sait-il jouer une boucle d'ambiance ? Un gabarit sans `idlePose` cuirait N frames
   *  identiques — il reste statique. */
  animable: boolean;
  draw: (view: View, mirror: boolean) => string;
  frame: (view: View, mirror: boolean, def: ClipDef, k: number, n: number) => string;
} | null {
  const e = sceneEntityForRender(ent);
  const r = entityRender(e);
  if (r.kind === 'rig') {
    const prof = entityRigProfileFor(e, enrolled);
    if (!prof) return null;
    // PRISE D'ARME du figurant, composée à chaque frame comme sur un corps de rig (`RigToken`) : sans
    // elle, un garde animé lâche sa hallebarde dès la première cellule de sa planche.
    const arme = mainWeaponOf(prof.equip);
    const hold = weaponRest(arme);
    const at = (view: View, mirror: boolean, pose: Pose) =>
      bonesToSvg(resolveRig(prof.appearance, prof.equip, pose, prof.tenue, view, [], mirror));
    // ASSIS (`Scene.seatAssignments`) : le corps est POSÉ sur sa place à la hauteur d'assise reçue
    // (`assis`, unités de boîte), arme RANGÉE (`seatedRest`). Un geste d'ambiance s'y compose par le
    // dessus, filtré par `seatedPose` — les jambes restent celles de l'assise, aucune boucle
    // authorée ne peut redresser un attablé.
    const repos = (view: View): Pose =>
      (assis === null ? {} : seatedRest(view, rigComposition(prof.appearance, prof.equip, prof.tenue, view), assis, arme));
    const geste = (view: View, def: Parameters<typeof rigPoseAtFrame>[0], k: number, n: number): Pose =>
      assis !== null
        ? addPose(repos(view), seatedPose(addPose(hold, rigPoseAtFrame(def, k, n))))
        : addPose(hold, rigPoseAtFrame(def, k, n));
    return {
      voie: 'rig',
      animable: true,
      draw: (view, mirror) => at(view, mirror, repos(view)),
      frame: (view, mirror, def, k, n) =>
        def.voie === 'rig' ? at(view, mirror, geste(view, def, k, n)) : at(view, mirror, repos(view)),
    };
  }
  const plan = planById(r.plan);
  if (!plan) return null;
  const at = (view: View, mirror: boolean, pose: Pose, wings?: WingState) => {
    const body = bonesToSvg(plan.resolve(r.species, view, pose, wings === 'spread' ? { wings } : {}));
    // Miroir de la boîte 120×150 (centre en x=60), MÊME convention que `propSvg` pour un profil gauche.
    return mirror ? `<g transform="translate(${BB_W},0) scale(-1,1)">${body}</g>` : body;
  };
  return {
    voie: 'plan',
    animable: !!plan.idlePose,
    draw: (view, mirror) => at(view, mirror, plan.restPose()),
    frame: (view, mirror, def, k, n) => {
      if (def.voie !== 'plan') return at(view, mirror, plan.restPose());
      const { pose, wings } = planPoseAt(plan, def, frameSampleMs(k, n, clipTotalMs(def)));
      return at(view, mirror, pose, wings);
    },
  };
}

/** Éléments de scène à billboarder : la sortie des BUILDERS, donc les MÊMES filtres que la voie
 *  affine (embuscade `hiddenUntilCombat`, entité enrôlée que son combattant rend déjà, case couverte
 *  par un combattant, étage isolé/actif, hors-vue). Il n'y a PAS de second jeu de lois côté volumique :
 *  l'écran de jeu passe les éléments de SON stage. */
export interface SceneBillboardEls {
  tokens: readonly TokenEl[];
  props: readonly PropEl[];
}

/** Éléments de la scène ENTIÈRE — pour un appelant SANS loi de vue ni combat en cours (les planches QC :
 *  elles jugent l'ENVIRONNEMENT, pas le brouillard), au même titre que `keepEl` absent.
 *  Un écran de JEU ne passe JAMAIS ceci : c'est là que se perdraient l'embuscade et le combat. */
export function wholeSceneBillboardEls(scene: Scene): SceneBillboardEls {
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  return {
    tokens: buildTokens(scene, undefined, null, { activeZ: maxZ, viewZ: null, top: false }),
    // Un décor volumique est cuit dans la masse du monde : il n'a pas de sujet de billboard à poser.
    props: buildProps(scene).filter((el) => !estPropVolumique(el)),
  };
}

/** Sujets de billboard de la scène : personnages FIGURANTS (`kind:'personnage'`) puis décor. Les
 *  COMBATTANTS n'entrent pas ici — ils passent par `actorBillboards`, à leur position visuelle ; c'est
 *  le builder qui garantit qu'une entité enrôlée n'est pas dessinée deux fois. */
export function collectBillboards(scene: Scene, mpt: number, els: SceneBillboardEls): BillboardSubject[] {
  const out: BillboardSubject[] = [];
  const defs = `<defs>${defsGlobaux()}</defs>`;
  for (const tk of els.tokens) {
    if (tk.subject.kind !== 'figurant') continue;
    const { ent, enrolled, seat } = tk.subject;
    if (ent.kind !== 'personnage') continue;
    const scaleK = entityTokenScale(ent);
    // Hauteur d'ASSISE portée par la POSTURE, dans le repère du RIG : la mesure du monde (mètres au
    // catalogue de décor) entre dans la boîte de corps par l'échelle du quad (`boxUnitsPerM`) — un
    // ogre voit le même tabouret plus bas que ne le voit un halfling.
    const assise = seat ? seatSitHeight(seat) * boxUnitsPerM('personnage', scaleK) : null;
    const corps = personnageDraw(ent, enrolled, assise);
    if (!corps) continue;
    // Empreinte multi-cases : le corps se centre sur l'empreinte.
    const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
    // ASSIS : le corps se POSE sur l'ancre de sa place (fraction de case), pas sur sa case logique —
    // celle-ci reste sa case d'abord (`SceneEntity.pos`), d'où il se lève. En HAUTEUR il reste ancré
    // au SOL : la hauteur d'assise (`seatSitHeight`) est portée par la POSTURE, pas par l'ancre. La
    // CASE (`cell`, teinte de visibilité) ne bouge pas : un corps est éclairé par la case qu'il occupe.
    const gx = seat ? seat.anchor.x : ent.pos.x + off;
    const gy = seat ? seat.anchor.y : ent.pos.y + off;
    const z = tk.cell.z;
    // AMBIANCE AUTHORÉE (`SceneEntity.anim`, catalogue `gameIso/sceneAnims`) : ce figurant JOUE sa
    // boucle, ses frames cuites dans sa planche. Sans ambiance — ou sur un corps qui ne sait pas la
    // jouer — il reste une texture d'UNE frame.
    const ambient = ent.anim && corps.animable ? ent.anim : undefined;
    out.push({
      // L'ambiance entre dans l'IDENTITÉ : c'est ce qui périme la texture d'un figurant dont l'auteur
      // change l'anim à l'inspecteur, et ce qui interdit à deux ambiances de partager une planche.
      // La PLACE entre dans l'identité : le même figurant debout puis attablé ne dessine pas le même
      // corps, et deux places du même meuble ne partagent pas d'entrée de cache.
      identity: `perso:${ent.id}${ambient ? `|${ambient}` : ''}${seat ? `|assis:${seat.propId}:${seat.slotId}` : ''}`,
      ...(ambient ? { eid: ent.id, anim: { voie: corps.voie, ambient } } : {}),
      kind: 'personnage',
      anchor: new THREE.Vector3(gx * mpt, seat ? seat.ground : heightAt(scene, ent.pos.x, ent.pos.y, z), gy * mpt),
      facing: seat ? seat.facing : ent.facing ?? 'S',
      scaleK,
      cell: { x: ent.pos.x, y: ent.pos.y, z },
      box: { w: BB_W, h: BB_H },
      svg: (view, mirror) => defs + corps.draw(view, mirror),
      ...(ambient ? { frameSvg: (view, mirror, def, k, n) => defs + corps.frame(view, mirror, def, k, n) } : {}),
    });
  }
  for (const el of els.props) {
    if (estPropVolumique(el)) continue; // cuit dans la masse du monde, jamais billboardé
    const gx = el.cell.x + el.foot.offX;
    const gy = el.cell.y + el.foot.offY;
    const h = heightAt(scene, el.cell.x, el.cell.y, el.cell.z) + (el.liftM ?? 0);
    out.push({
      // IDENTITÉ = la clé de l'élément ET sa SIGNATURE DE DESSIN (#1176, P3-3) — même doctrine que
      // l'acteur (`ActorDrawInputs`/`combatantRenderSignature`). La clé seule ne suffit PAS : elle
      // porte l'id de l'ENTITÉ (`prop:decor-1`) ou la CASE d'un overlay de terrain (`ov:x,y,z`), donc
      // deux modèles de décor différents — ou deux terrains à décor différents sur la même case —
      // partageaient une entrée de cache et le premier dessin restait à l'écran. Le cache de textures
      // ne se vide plus à chaque référence de scène (rétention par contenu) : il n'y a plus de purge
      // pour masquer cette collision, un modèle changé à l'inspecteur la rendrait éternelle.
      // Le CAP et l'ÉCHELLE y entrent : l'un choisit le dessin servi (`propSvg`), l'autre la TAILLE du
      // quad — deux props de même clé et de même modèle mais d'empreinte différente ne peuvent pas
      // partager une entrée de cache, ni un quad (#1396).
      // L'ABSENCE de type est NOMMÉE dans l'identité de cache (#877) : deux décors, l'un sans type et
      // l'autre au type littéralement nommé « undefined », ne partagent pas une texture.
      identity: `prop:${el.key}|${el.ref ?? REF_NON_NOMMEE}|${el.facing ?? ''}|${el.foot.scale}`,
      kind: 'prop',
      anchor: new THREE.Vector3(gx * mpt, h, gy * mpt),
      facing: el.facing ?? 'S',
      scaleK: el.foot.scale,
      cell: { x: el.cell.x, y: el.cell.y, z: el.cell.z },
      box: { w: BB_W, h: BB_H },
      // Le décor délègue sa vue à `propSvg` (dir + cran caméra), exactement comme les deux backends.
      svg: (_view, _mirror, camRot) => defs + propSvg(el.ref, el.facing, camRot),
    });
  }
  return out;
}

/**
 * DEUX LOTS D'ÉLÉMENTS DONNENT-ILS LES MÊMES SUJETS ? — le read-set de `collectBillboards` ci-dessus,
 * et lui seul : ce qu'un figurant apporte de lui-même passe par la RÉFÉRENCE de son entité de scène
 * (une retouche d'auteur en produit une neuve), le reste est primitif.
 *
 * Sa raison d'être : les builders rendent des tableaux NEUFS à chaque calcul de vue (`buildTokens`/
 * `buildProps` prennent le champ de visibilité), si bien qu'un pas du groupe passait des éléments
 * identiques sous une référence neuve — et remontait tous les quads du monde. Le pendant exact de la
 * clé de pose des acteurs (`actorPoseKey`, `stage/VolumetricWorld`), du côté du décor.
 *
 * IL VIT ICI, contre le collecteur : c'est la même lecture, et deux fichiers ne peuvent pas la tenir
 * d'accord.
 */
/** Deux places résolues sont-elles la MÊME (identité + géométrie posée) ? `undefined` des deux côtés
 *  = même absence de place. */
function memePlace(a: SeatPose | undefined, b: SeatPose | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.propId === b.propId && a.slotId === b.slotId && a.facing === b.facing
    && a.anchor.x === b.anchor.x && a.anchor.y === b.anchor.y && a.anchor.h === b.anchor.h && a.ground === b.ground;
}

export function memesBillboardEls(a: SceneBillboardEls, b: SceneBillboardEls): boolean {
  if (a === b) return true;
  if (a.tokens.length !== b.tokens.length || a.props.length !== b.props.length) return false;
  for (let i = 0; i < a.tokens.length; i++) {
    const x = a.tokens[i];
    const y = b.tokens[i];
    if (x === y) continue;
    if (x.cell.z !== y.cell.z) return false;
    const sx = x.subject;
    const sy = y.subject;
    if (sx.kind !== sy.kind) return false;
    // Seuls les FIGURANTS deviennent des sujets ici (les combattants passent par `actorBillboards`) :
    // un token d'une autre nature ne se compare pas au-delà de sa nature.
    if (sx.kind !== 'figurant' || sy.kind !== 'figurant') continue;
    if (sx.ent !== sy.ent || sx.enrolled !== sy.enrolled) return false;
    // La PLACE fait partie de ce que le sujet dessine (ancre, cap, corps plié) : deux lots qui ne
    // s'accordent pas dessus ne donnent pas les mêmes sujets. Comparée par VALEUR — la pose est
    // reforgée à chaque résolution (`seatPoseOf`), sa référence ne dit rien.
    if (!memePlace(sx.seat, sy.seat)) return false;
  }
  for (let i = 0; i < a.props.length; i++) {
    const x = a.props[i];
    const y = b.props[i];
    if (x === y) continue;
    if (x.key !== y.key || x.ref !== y.ref || x.facing !== y.facing) return false;
    if (x.cell.x !== y.cell.x || x.cell.y !== y.cell.y || x.cell.z !== y.cell.z) return false;
    if (estPropVolumique(x) !== estPropVolumique(y)) return false;
    if (estPropVolumique(x) || estPropVolumique(y)) continue; // cuit dans la masse : aucun sujet à comparer
    if (x.liftM !== y.liftM) return false;
    if (x.foot.offX !== y.foot.offX || x.foot.offY !== y.foot.offY || x.foot.scale !== y.foot.scale) return false;
  }
  return true;
}

/** ACTEUR à billboarder : le combattant (groupe en exploration, combattants en combat) et sa case
 *  LOGIQUE — l'ancre CUITE du quad. Le GLISSEMENT de marche n'entre pas ici : la boucle de rendu le
 *  redemande par frame (`StageWalkAnim.glide`) et ne décale que la matrice du quad (#1176, P2-4). */
export interface ActorPose {
  c: Combatant;
  x: number;
  y: number;
  z: number;
  /** Orientation MONDE vivante (store `facing`, jamais un champ du combattant). */
  facing?: Dir8;
  /** CAVALIER du couple, quand `c` est une MONTURE portée (`TokenSubjectEl` `mounted`) : le sujet
   *  devient alors UN billboard COMPOSITE (cavalier assis sur la monture, trié à l'os), à la case et
   *  à l'échelle de la monture — UN corps, UN quad. */
  rider?: Combatant;
  /** ORDINAL d'anneau de héros (`TokenSubjectEl.heroIndex`) — l'identité d'équipe du jeton, dont sa
   *  couleur d'anneau ET la teinte de sa silhouette se dérivent (`teamRingDecor`). Pour un couple
   *  MONTÉ, c'est l'ordinal du CAVALIER : il se lit avec `rider`, jamais avec la monture. */
  heroIndex?: number;
  /** PLACE ASSISE tenue par ce corps (`state/seating`) — le meneur du groupe attablé. Elle porte
   *  l'ancre du quad, le cap du corps et sa pose ; `x`/`y` ci-dessus restent la case LOGIQUE (l'abord),
   *  celle du brouillard et de la teinte. Aucun `mountId` : une chaise n'est pas une monture. */
  seat?: SeatPose;
}

/** Poses d'acteur des ÉLÉMENTS DU BUILDER — la SEULE dérivation acteurs du monde volumique (l'écran
 *  n'a aucun second jeu de lois : les filtres de rendu sont déjà ceux du builder). Un couple MONTÉ
 *  donne UNE pose : la monture porte case et échelle, le cavalier voyage avec elle. */
export function actorPoses(tokenEls: readonly TokenEl[], facings: Record<string, Dir8 | undefined>): ActorPose[] {
  const out: ActorPose[] = [];
  for (const tk of tokenEls) {
    const s = tk.subject;
    const unit = s.kind === 'combatant' ? s.c : s.kind === 'mounted' ? s.mount : null;
    if (!unit?.pos) continue;
    // `heroIndex` : l'ordinal d'anneau du builder, la SEULE entrée de la couleur d'équipe d'un héros
    // (`teamRingDecor`) — il voyage avec la pose, sinon la silhouette du corps et l'anneau aux pieds
    // d'un même jeton se peindraient de deux couleurs. Un couple MONTÉ porte celui de son cavalier.
    const heroIndex = s.kind === 'combatant' || s.kind === 'mounted' ? s.heroIndex : undefined;
    out.push({ c: unit, x: unit.pos.x, y: unit.pos.y, z: tk.cell.z, facing: facings[unit.id], ...(heroIndex !== undefined ? { heroIndex } : {}), ...(s.kind === 'mounted' ? { rider: s.rider } : {}) });
  }
  return out;
}

/** POSE du jeton de GROUPE hors combat — la seule que le builder de jetons ne produit pas (le groupe
 *  n'est pas un combattant posté). Son CAP se lit à la clé que PUBLIE le constructeur du jeton
 *  (`builders/tokens.partyTokenOf` → `capKey`), jamais à l'id du meneur : le regard est une valeur du
 *  GROUPE, que le changement de meneur ne fait pas sauter. Assis, c'est le cap de la PLACE qui sert
 *  (`capActeur`). */
export function partyActorPose(
  partyToken: { leader: Combatant; pos: { x: number; y: number; z?: number }; seat?: SeatPose; capKey: string },
  facings: Record<string, Dir8 | undefined>,
): ActorPose {
  return {
    c: partyToken.leader,
    x: partyToken.pos.x,
    y: partyToken.pos.y,
    z: partyToken.pos.z ?? 0,
    facing: facings[partyToken.capKey],
    ...(partyToken.seat ? { seat: partyToken.seat } : {}),
  };
}

/** Tout ce dont le DESSIN d'un acteur dépend, résolu à UN seul endroit : le tracé (`actorBillboards`)
 *  et la SIGNATURE (`combatantRenderSignature`) lisent la MÊME structure. Aucun des deux ne peut donc
 *  consommer une entrée que l'autre ignore — c'était la double péremption mesurée (#1176) : une tenue,
 *  une arme ou une Taille changeaient le dessin sans changer ni la clé de mémo du monde volumique ni
 *  l'identité de cache de texture. */
export interface ActorDrawInputs {
  render: RenderResolution;
  ground: GroundState;
  /** Multiplicateur de taille du jeton (espèce × Taille, ou empreinte propre). */
  scaleK: number;
  /** Branche RIG (humanoïde) — absente pour un gabarit de créature. */
  rig?: { appearance: Appearance; equip: EquipCtx; tenue: string | undefined; overlays: RigOverlay[] };
  /** Branche GABARIT (`plan.resolve`) — opts d'apparence du record + override d'authoring. */
  plan?: ResolveOpts;
}

/** Entrées de dessin d'un combattant : profil d'ennemi ou inventaire propre, garde-robe, calques
 *  d'état (mutations, blessures, métamorphose vivante), pose au sol, échelle de jeton. */
export function actorDrawInputs(c: Combatant): ActorDrawInputs {
  const render = combatantRender(c);
  const ground = groundStateOf(c);
  const scaleK = combatantTokenScale(c);
  if (render.kind !== 'rig') return { render, ground, scaleK, plan: planOptsForRecord(c.creatureId, c.appearanceOverride) };
  const prof = rendersFromOwnInventory(c) ? null : enemyRigProfile(c);
  return {
    render,
    ground,
    scaleK,
    rig: {
      appearance: combatantAppearance(prof?.appearance ?? c.appearance ?? defaultAppearance(c), c),
      equip: prof?.equip ?? equipFromCombatant(c),
      tenue: prof?.tenue ?? c.career,
      overlays: combatantOverlays(c),
    },
  };
}

/** Sérialisation DÉTERMINISTE : clés TRIÉES et champs absents omis — deux résolutions de mêmes entrées
 *  donnent la même chaîne quel que soit l'ordre d'insertion des objets qui les portent. */
function stableStr(v: unknown): string {
  if (v === undefined) return 'u';
  if (v === null || typeof v !== 'object') return JSON.stringify(v)!;
  if (Array.isArray(v)) return `[${v.map(stableStr).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${k}:${stableStr(o[k])}`).join(',')}}`;
}

/** SIGNATURE des entrées de dessin d'un combattant — stable tant que le corps rendu ne change pas.
 *  Consommée par les DEUX péremptions du monde volumique : la clé de mémo des acteurs
 *  (`stage/VolumetricWorld`) et
 *  l'identité de cache de texture (`BillboardSubject.identity`). */
export function combatantRenderSignature(c: Combatant): string {
  return hash32(stableStr(actorDrawInputs(c))).toString(16);
}

/** Clé de MÉMO d'un acteur du monde volumique : ce qui doit reforger le tableau d'acteurs du stage —
 *  identité, position VISUELLE, orientation, et la signature de ce que le billboard dessine. Même
 *  source que l'identité de cache de texture : une entrée de dessin ne peut pas périmer l'une sans
 *  l'autre. */
export function actorPoseKey(p: ActorPose): string {
  const monté = p.rider ? `+${p.rider.id}:${combatantRenderSignature(p.rider)}` : '';
  // La PLACE entre dans la clé : elle décide l'ancre du quad, le cap servi et la pose du corps — un
  // meneur qui s'assoit ou se lève doit reforger son acteur. Ses DEUX hauteurs y entrent : le `ground`
  // porte l'ancre du quad, l'assise (`anchor.h − ground`) porte la posture ; un meuble reposé sur un
  // sol d'une autre hauteur, ou un siège plus haut, sont un autre dessin.
  const assis = p.seat ? `:assis:${p.seat.propId}:${p.seat.slotId}:${p.seat.ground}:${seatSitHeight(p.seat)}` : '';
  return `${p.c.id}:${p.x},${p.y},${p.z}:${capActeur(p)}:${combatantRenderSignature(p.c)}${monté}${assis}`;
}

/** Cap MONDE servi au quad d'un acteur : celui de sa PLACE s'il est assis (le corps regarde la table,
 *  pas la direction où il marchait), sinon son orientation vivante. Définition UNIQUE, partagée par le
 *  montage, la repose de cap et la clé de mémo. */
function capActeur(p: ActorPose): Dir8 {
  return p.seat ? p.seat.facing : p.facing ?? 'S';
}

/**
 * Clé d'IDENTITÉ d'un acteur — QUI est ce sujet et QUEL ART il porte, jamais OÙ il est ni de quel
 * côté il regarde (#1396).
 *
 * C'est elle qui décide du MONTAGE des quads. La position et le cap n'y entrent pas : ils
 * appartiennent à la POSE, que la passe de frame relit (`stage/boardPose.poseBoards` pour la case,
 * `choisirFrame` pour la vue d'un corps animé) et que la repose ci-dessous porte aux sujets déjà
 * montés. Position comprise, un seul pas — d'un héros comme d'un PNJ — détruisait et remontait TOUS
 * les quads du monde, décor inclus (mesuré : 13 matériaux libérés, 0 survivant sur un banc de douze
 * décors).
 *
 * La SIGNATURE DE DESSIN, elle, reste une identité : elle dit ce que le corps montre (équipement,
 * apparence, état au sol), donc l'art à rasteriser.
 */
export function actorIdentityKey(p: ActorPose): string {
  const monté = p.rider ? `+${p.rider.id}:${combatantRenderSignature(p.rider)}` : '';
  return `${p.c.id}:${combatantRenderSignature(p.c)}${monté}`;
}

/** Ancre PIEDS (mètres) et CASE d'un acteur posé — la SEULE définition de cette géométrie, partagée
 *  par le montage (`actorBillboards`) et la repose de position. Le glissement de marche n'y est pas :
 *  il se compte DEPUIS ce point, par la boucle de rendu. */
function ancreActeur(p: ActorPose, scene: Scene, mpt: number): { anchor: THREE.Vector3; cell: { x: number; y: number; z: number } } {
  const off = (sizeFootprint(p.c.size) - 1) / 2;
  const cell = { x: Math.round(p.x), y: Math.round(p.y), z: p.z };
  // ASSIS : l'ancre est celle de la PLACE en plan (fraction de case) et le SOL en hauteur — la
  // hauteur d'assise appartient à la posture (`seatSitHeight`). La case, elle, reste la case logique
  // du corps : c'est elle qui porte la teinte de visibilité et la profondeur de tri.
  if (p.seat) return { anchor: new THREE.Vector3(p.seat.anchor.x * mpt, p.seat.ground, p.seat.anchor.y * mpt), cell };
  return {
    anchor: new THREE.Vector3((p.x + off) * mpt, heightAt(scene, cell.x, cell.y, cell.z), (p.y + off) * mpt),
    cell,
  };
}

/**
 * REPOSE DE POSE des acteurs : les sujets DÉJÀ MONTÉS suivent la case et le cap où le store vient de
 * les poser, en place — aucun quad démonté, aucune texture périmée (l'art ne dépend ni de l'une ni de
 * l'autre : la case se lit à la frame, la vue se choisit à la frame).
 *
 * Rend ce qui a bougé : `ancres` = au moins une case (une image à peindre, une carte d'ombre à
 * redemander) ; `caps` = les sujets dont le cap a tourné, que l'appelant repose au regard courant
 * (seuls les corps SANS flipbook en ont besoin — un corps animé choisit sa vue par image).
 */
export function reposerActeurs(
  subjects: readonly BillboardSubject[],
  actors: readonly ActorPose[],
  scene: Scene,
  mpt: number,
): { ancres: boolean; caps: BillboardSubject[] } {
  const caps: BillboardSubject[] = [];
  if (!subjects.length) return { ancres: false, caps };
  const parCid = new Map<string, BillboardSubject>();
  for (const s of subjects) if (s.cid) parCid.set(s.cid, s);
  let ancres = false;
  for (const p of actors) {
    const sujet = parCid.get(p.c.id);
    if (!sujet) continue;
    const cap = capActeur(p);
    if (sujet.facing !== cap) {
      sujet.facing = cap;
      caps.push(sujet);
    }
    const { anchor, cell } = ancreActeur(p, scene, mpt);
    if (sujet.anchor.equals(anchor) && sujet.cell.x === cell.x && sujet.cell.y === cell.y && sujet.cell.z === cell.z) continue;
    sujet.anchor.copy(anchor);
    sujet.cell = cell;
    ancres = true;
  }
  return { ancres, caps };
}

/** Les trois vues d'un corps. La boîte d'un sujet est UNE (le quad ne change pas quand la caméra
 *  tourne) : une boîte dérivée du dessin se mesure donc sur les trois. */
const VUES: readonly View[] = ['front', 'profile', 'back'];

/** Couple MONTÉ (LDB 14 l.175-187) rendu comme UN SEUL corps : le cavalier est ASSIS sur les os réels
 *  de la monture (`seatRiderOnMount` : ancre de selle dérivée de l'os `tronc`, z du cavalier remappé
 *  dans l'échelle du quadrupède), et le composite trié à l'os sort en UN fragment SVG. La monture donne
 *  la vue et le miroir du couple ; le cavalier prend la pose montée (`mountedRest`, selon l'arme
 *  tenue). Aucune animation ici : la loi de selle, et elle seule.
 *
 *  Le couple est le premier sujet à DÉBORDER la boîte canonique : assis, le cavalier monte au-dessus
 *  du garrot, et son crâne sortait par le haut d'une boîte de rasterisation 120×150 (mesuré #1176 :
 *  −18,6 en face). La boîte rendue est donc HAUSSÉE du débord et le fragment descend d'autant — pieds
 *  de la monture au bas de la boîte, ancre inchangée, quad plus haut (`subjectQuad`).
 *
 *  `null` = monture sans gabarit ou cavalier sans rig : l'appelant retombe sur le corps SEUL de la
 *  monture (le cavalier disparaît — défaut de DONNÉE, dit une fois en dev). */
function mountedSvg(
  mount: Combatant,
  rider: Combatant,
  riderInputs: ActorDrawInputs,
): { draw: (view: View, mirror: boolean) => string; box: { w: number; h: number } } | null {
  const mr = combatantRender(mount);
  const plan = planById(mr.plan);
  if (!plan || !riderInputs.rig) {
    if (import.meta.env?.DEV)
      diagOnce(`monté:${mount.id}+${rider.id}`, () =>
        console.error(
          `[bodyPlan] couple monté « ${mount.creatureId ?? mount.label} » + « ${rider.creatureId ?? rider.label} » : ${plan ? 'cavalier sans rig humanoïde' : 'monture sans gabarit'} — seule la monture est dessinée, donnée à corriger.`,
        ),
      );
    return null;
  }
  const { appearance, equip, tenue, overlays } = riderInputs.rig;
  const ground = groundStateOf(mount);
  const couché = planGroundPose(plan, ground);
  const opts: ResolveOpts = {
    ...mountedPlanOpts(mount.creatureId, mount.appearanceOverride),
    ...(ground ? { wings: 'spread' as const } : {}),
  };
  const arme = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  // k : échelle du cavalier DANS la boîte de la monture — chaîne d'échelles monde (art × Taille),
  // jamais une constante (un cheval recalibré ou une autre monture garde un couple proportionné).
  const k = combatantRender(rider).scale / (mr.scale * sizeTokenScale(mount.size));
  const osMonture = (view: View) => plan.resolve(mr.species, view, couché ?? plan.restPose(), opts);
  const assise = (view: View) => ({ view, mountScale: 1, riderScale: k });
  // Haut de la boîte du cavalier (0..150, contrat du rig) ramenée dans la boîte de la monture, pris
  // à la vue la plus haute : négatif = ce qui manque de ciel au-dessus des 150 px.
  const haut = Math.min(...VUES.map((v) => seatPlacement(osMonture(v), assise(v))[5]));
  const débord = Math.max(0, Math.ceil(-haut));
  return {
    box: { w: BB_W, h: BB_H + débord },
    draw: (view, mirror) => {
      const riderBones = resolveRig(appearance, equip, mountedRest(view, arme), tenue, view, overlays, mirror);
      const body = bonesToSvg(seatRiderOnMount(osMonture(view), riderBones, assise(view)));
      const posé = mirror ? `<g transform="translate(${BB_W},0) scale(-1,1)">${body}</g>` : body;
      return débord ? `<g transform="translate(0,${débord})">${posé}</g>` : posé;
    },
  };
}

/**
 * BASCULE AU SOL d'un rig en BILLBOARD (#1334) — la rotation de tout le corps autour de ses pieds
 * (`rigGroundTiltDeg` : 82° cadavre, 72° À Terre ; pivot `RIG_GROUND_PIVOT`), portée dans la boîte de
 * rasterisation du sujet.
 *
 * SANS elle, un corps au sol ne reçoit que sa POSE d'os (`CORPSE_POSE`/`PRONE_POSE`) : membres
 * écartés, mais corps DEBOUT. C'est ce qui se voyait à l'écran — un mis hors de combat planté sur ses
 * jambes. La pose dit comment le corps s'affaisse ; la bascule dit qu'il est À TERRE.
 *
 * DEUX grandeurs se dérivent ici, et rien d'autre n'en décide :
 *  - la BOÎTE : la rotation sort le corps d'une boîte de `BB_W`×`BB_H` (tête à x≈208 à 82°, et une
 *    boîte tournée de 20° est HAUTE de 182), donc la boîte du sujet prend le BALAYAGE ENTIER de la
 *    chute — la boîte est UNE pour toutes les cellules d'une planche, et des bornes prises au seul
 *    angle final trancheraient les frames du milieu. Agrandir la boîte n'agrandit PAS le corps :
 *    l'échelle art→monde du quad se prend sur la boîte (`subjectQuad`), donc un pixel de boîte garde
 *    sa taille monde et la boîte ne gagne que du ciel et des marges ;
 *  - le PLACEMENT : le corps basculé se recentre sur la case et se POSE sur le bas de la boîte —
 *    c'est-à-dire sur l'ancre du quad, c'est-à-dire au sol. À bascule nulle, la transformation n'est
 *    que ce placement : la première cellule d'une chute reste EXACTEMENT le corps debout.
 *
 * Le SENS suit le corps : une vue miroitée bascule de l'autre côté (`resolveRig` a déjà retourné les
 * os), sans quoi un profil et son miroir tomberaient du même côté de l'écran.
 */
export interface RigGroundTilt {
  /** Boîte (px) qui contient le corps sur TOUTE la bascule. */
  boxW: number;
  boxH: number;
  /** Transformation SVG du corps à la fraction `frac` de la bascule (0 = debout, 1 = posé). */
  at: (frac: number, mirror: boolean) => string;
}

/** Échantillons du balayage — les bornes d'une rotation ne tombent pas forcément à l'angle final (le
 *  coin le plus lointain passe par son maximum d'abscisse en route, et la boîte tournée est plus
 *  HAUTE à mi-chemin qu'à ses deux bouts). */
const TILT_ECHANTILLONS = 32;

/** Boîte rasterisée du rig, tournée de `deg` autour du pivot des pieds. */
function tiltBounds(deg: number): { xmin: number; xmax: number; ymin: number; ymax: number } {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const [x, y] of [[0, 0], [BB_W, 0], [0, BB_H], [BB_W, BB_H]] as const) {
    const dx = x - RIG_GROUND_PIVOT.x;
    const dy = y - RIG_GROUND_PIVOT.y;
    const px = RIG_GROUND_PIVOT.x + dx * cos - dy * sin;
    const py = RIG_GROUND_PIVOT.y + dx * sin + dy * cos;
    xmin = Math.min(xmin, px);
    xmax = Math.max(xmax, px);
    ymin = Math.min(ymin, py);
    ymax = Math.max(ymax, py);
  }
  return { xmin, xmax, ymin, ymax };
}

/** Arrondi d'affichage des transformations (le fragment est une clé de cache : il doit être STABLE). */
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export function rigGroundTilt(ground: Exclude<GroundState, null>): RigGroundTilt {
  const total = rigGroundTiltDeg(ground);
  let boxW = BB_W;
  let boxH = BB_H;
  for (let i = 0; i <= TILT_ECHANTILLONS; i++) {
    const b = tiltBounds((total * i) / TILT_ECHANTILLONS);
    boxW = Math.max(boxW, Math.ceil(b.xmax - b.xmin));
    boxH = Math.max(boxH, Math.ceil(b.ymax - b.ymin));
  }
  return {
    boxW,
    boxH,
    at: (frac, mirror) => {
      const deg = total * Math.max(0, Math.min(1, frac)) * (mirror ? -1 : 1);
      const b = tiltBounds(deg);
      const dx = boxW / 2 - (b.xmin + b.xmax) / 2;
      const dy = boxH - b.ymax;
      return `translate(${r3(dx)},${r3(dy)}) rotate(${r3(deg)},${RIG_GROUND_PIVOT.x},${RIG_GROUND_PIVOT.y})`;
    },
  };
}

/** Fraction de bascule à la frame `k` d'une planche d'effondrement de `n` cellules — la MÊME courbe
 *  et le MÊME instant que la pose d'os de cette cellule (`rigPoseAtFrame` → `rigCollapsePoseAt`),
 *  sinon le corps s'affaisse à une cadence et se couche à une autre. */
function tiltFracAtFrame(k: number, n: number): number {
  return easeOutCubic(frameSampleMs(k, n, COLLAPSE_MS) / COLLAPSE_MS);
}

/** Billboards des ACTEURS (héros, ennemis, alliés) — le pendant volumique de ce que le stage affine
 *  monte en corps React. Les entrées de dessin sont celles d'`actorDrawInputs` (classifieur de corps,
 *  profil d'ennemi, équipement, garde-robe, calques d'état, échelle de jeton), l'ÉTAT AU SOL passe par
 *  les deux moteurs d'animation (`rigGroundPose` / `planGroundPose`) et la FORME rendue est celle de
 *  `personnageSvg` ci-dessus. Une structure de siège est sautée : elle se rend sur son arête, pas en
 *  jeton (cf. `tokenBodyKind`).
 *
 *  La BASCULE d'un corps au sol y est portée par `rigGroundTilt` (#1334) : un hors de combat est À
 *  TERRE, et la pose d'os seule ne le couche pas — un rig sous `CORPSE_POSE` sans rotation reste
 *  DEBOUT, membres écartés (mesuré à l'écran : un Gobelin mis hors de combat restait planté). */
export function actorBillboards(actors: readonly ActorPose[], scene: Scene, mpt: number): BillboardSubject[] {
  const defs = `<defs>${defsGlobaux()}</defs>`;
  const out: BillboardSubject[] = [];
  for (const { c, x, y, z, facing, rider, heroIndex, seat } of actors) {
    if (isStructure(c)) continue;
    const inputs = actorDrawInputs(c);
    const { render: r, ground } = inputs;
    // Couple MONTÉ : UN sujet composite (jamais deux quads superposés), à la case et à l'échelle de
    // la monture — un seul corps composite. Une monture
    // sans gabarit ou un cavalier sans rig retombe sur le corps SEUL de la monture, ci-dessous.
    // Les entrées du cavalier sont résolues UNE fois : le tracé du composite et sa signature les
    // partagent (`actorDrawInputs` traverse tout l'équipement et la garde-robe).
    const riderInputs = rider ? actorDrawInputs(rider) : undefined;
    const monté = rider && riderInputs ? mountedSvg(c, rider, riderInputs) : null;
    let draw: ((view: View, mirror: boolean) => string) | null = monté?.draw ?? null;
    // MÊME chaîne de dessin, FRAME de geste (`BillboardSubject.frameSvg`) : le corps figé ci-dessous
    // en est l'échantillon à la pose du build. La voie de corps décide de ce qu'une frame échantillonne
    // — un clip pour un bipède, les fonctions de pose du `BodyPlan` pour un gabarit — et ni l'une ni
    // l'autre ne sort d'ici : l'écran ne connaît que des gestes et des rangs de frame.
    let frameAt: BillboardSubject['frameSvg'] = undefined;
    let voie: SubjectAnim['voie'] | null = null;
    // BOÎTE de rasterisation du sujet : la canonique, agrandie quand un rig au sol BASCULE (#1334).
    let boxW = BB_W;
    let boxH = BB_H;
    if (!draw && inputs.rig) {
      const { appearance, equip, tenue, overlays } = inputs.rig;
      const couché = rigGroundPose(ground);
      const hold = weaponRest(mainWeaponOf(equip));
      // BASCULE (#1334) : un corps au sol se couche pour de bon. Elle appartient au SUJET (sa boîte
      // en dépend), et chaque fragment la porte — y compris à fraction nulle, où elle n'est que le
      // recentrage dans la boîte élargie.
      const bascule = ground ? rigGroundTilt(ground) : null;
      if (bascule) {
        boxW = bascule.boxW;
        boxH = bascule.boxH;
      }
      const drawAt = (view: View, mirror: boolean, pose: Pose, frac = 0) => {
        const body = bonesToSvg(resolveRig(appearance, equip, pose, tenue, view, overlays, mirror));
        return bascule ? `<g transform="${bascule.at(frac, mirror)}">${body}</g>` : body;
      };
      // ASSIS (le meneur attablé) : corps plié sur sa place, arme RANGÉE (`seatedRest`). Un corps AU
      // SOL n'est jamais assis — l'effondrement prime, et `releaseSeat` l'aura de toute façon levé.
      const drop = seat ? seatSitHeight(seat) * boxUnitsPerM('personnage', inputs.scaleK) : 0;
      const assise = !ground && seat
        ? (view: View) => seatedRest(view, rigComposition(appearance, equip, tenue, view, overlays), drop, mainWeaponOf(equip))
        : null;
      draw = (view, mirror) => drawAt(view, mirror, assise ? assise(view) : couché ?? {}, 1);
      voie = 'rig';
      // PRISE D'ARME composée à CHAQUE frame, comme sur un corps de rig (`RigToken`) : la pose de geste
      // seule dessine un corps qui a lâché sa garde. Assis, le geste passe par `seatedPose` : aucune
      // cellule de planche ne peut redresser les jambes du corps posé sur sa chaise.
      frameAt = (view, mirror, def, k, n, o) =>
        def.voie === 'rig'
          ? drawAt(
            view,
            mirror,
            assise
              ? addPose(assise(view), seatedPose(addPose(hold, rigPoseAtFrame(def, k, n, o?.ground))))
              : addPose(hold, rigPoseAtFrame(def, k, n, o?.ground)),
            o?.ground ? tiltFracAtFrame(k, n) : 0,
          )
          : drawAt(view, mirror, assise ? assise(view) : couché ?? {}, 1);
    } else if (!draw) {
      const plan = planById(r.plan);
      if (plan) {
        // Gabarit AU SOL : pose de mort (ou affaissement À Terre) et ailes ÉTALÉES, comme `usePlanAnim`.
        const couché = planGroundPose(plan, ground);
        const opts = inputs.plan ?? {};
        const drawAt = (view: View, mirror: boolean, pose: Pose, wings?: WingState) => {
          const body = bonesToSvg(plan.resolve(r.species, view, pose, { ...opts, ...(wings === 'spread' ? { wings } : {}) }));
          return mirror ? `<g transform="translate(${BB_W},0) scale(-1,1)">${body}</g>` : body;
        };
        draw = (view, mirror) => drawAt(view, mirror, couché ?? plan.restPose(), ground ? 'spread' : undefined);
        voie = 'plan';
        frameAt = (view, mirror, def, k, n) => {
          if (def.voie !== 'plan') return drawAt(view, mirror, couché ?? plan.restPose(), ground ? 'spread' : undefined);
          const p = planPoseAt(plan, def, frameSampleMs(k, n, clipTotalMs(def)));
          return drawAt(view, mirror, p.pose, p.wings);
        };
      }
    }
    if (!draw) continue;
    const composite = monté ? rider : undefined; // cavalier RÉELLEMENT entré dans le fragment
    const trace = draw;
    const traceAt = frameAt;
    const pose: ActorPose = { c, x, y, z, ...(facing ? { facing } : {}), ...(seat ? { seat } : {}) };
    const { anchor, cell } = ancreActeur(pose, scene, mpt);
    out.push({
      // la signature du DESSIN, cf. `combatantRenderSignature` — le couple monté a SA clé (les deux
      // corps y entrent) : ni la monture seule ni le cavalier à pied ne peuvent la resservir. La PLACE
      // y entre au même titre : debout et attablé ne sont pas le même art.
      identity: `acteur:${c.id}${composite ? `+${composite.id}` : ''}${seat ? `|assis:${seat.propId}:${seat.slotId}` : ''}|${hash32(stableStr(composite ? [inputs, riderInputs] : inputs)).toString(16)}`,
      cid: c.id,
      // TEINTE D'ÉQUIPE (#1297) : la MÊME dérivation que l'anneau aux pieds du jeton et que le jeton
      // affine — une seule loi de couleur d'équipe, quelle que soit la voie qui la peint. Un couple
      // MONTÉ se lit au CAVALIER (avec l'ordinal qu'il a réservé) : le record de la monture porte
      // souvent un autre camp que celui qu'elle transporte (`builders/tokens`).
      teamColor: teamRingDecor(rider ?? c, heroIndex).color,
      kind: 'personnage',
      anchor,
      facing: capActeur(pose),
      scaleK: inputs.scaleK,
      // Un CORPS prend la teinte de SA case (position logique arrondie), pas celle du point où il
      // glisse : un acteur est un objet du système de jeu, posé sur une case, et son quad porte UNE
      // couleur. Le champ continu est la matière du MONDE, qui, lui, a des sommets à échantillonner.
      cell,
      box: monté?.box ?? { w: boxW, h: boxH },
      svg: (view, mirror) => defs + trace(view, mirror),
      ...(traceAt ? { frameSvg: (view, mirror, def, k, n, o) => defs + traceAt(view, mirror, def, k, n, o) } : {}),
      // CE QUE LE FLIPBOOK DOIT SAVOIR DU CORPS : sa voie, son état au sol, et — pour un gabarit — son
      // BOND (trait LDB 85, `hasLeap`). L'écran n'a aucune de ces trois lectures : ni `BodyPlan`, ni
      // état de combattant, ni traits.
      ...(voie
        ? { anim: { voie, ...(ground ? { ground } : {}), ...(voie === 'plan' && hasLeap(c.traits) ? { leap: true } : {}) } }
        : {}),
    });
  }
  return out;
}

// ————————————————————————————————————————————————————————————————
// LUMIÈRE — le soleil de PLANCHE : calibré, FIXE, indépendant de la taille de la carte
// ————————————————————————————————————————————————————————————————
//
// Ce soleil-ci ne bouge JAMAIS : ni l'heure de jeu ni le nord de la carte n'y entrent. C'est le
// contrat des planches QC de jeu (`scripts/qc/capture-jeu.mjs`), qui
// comparent des captures d'une session à l'autre — une planche ne peut pas changer parce que
// l'horloge a tourné. Le soleil du JEU, lui, suit l'heure et le nord de la scène : `sunJeu.ts`
// (course) → `stage/stageLights.ts` (montage), et il pose sa direction par `sunRigFrom`.

/** Élévation du soleil de PLANCHE au-dessus de l'horizon (degrés). CONSTANTE : une hauteur dérivée de la
 *  taille de la carte met le soleil d'autant plus près du zénith que la scène est grande, et les blocs de
 *  terrain cessent d'y projeter. Mesuré (#1176, lancer de rayon sur les centroïdes de sol) : sol d'HERBE
 *  occulté 0,0 % à `siege-enceinte` sous le soleil dérivé, 6,3 % à 38°. */
export const SUN_ELEVATION_DEG = 38;

/** Azimut du soleil de PLANCHE — direction unitaire au sol du point OÙ IL EST (sud-ouest). Mesuré (#1176,
 *  même lancer de rayon) : herbe occultée siège 0,0 % au nord-ouest → 6,3 % au sud-ouest ; arène 21,8 % →
 *  32,0 %. Le nord-ouest jetait les ombres des remparts vers l'intérieur pavé, jamais sur la plaine. */
export const SUN_AZIMUTH = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };

/** Couleur des DEUX lumières. Une lumière module la LUMINANCE ; la teinte de l'albédo est l'identité du
 *  jeu et ne se repeint pas (soleil ambré mesuré #1176 : bois `#6E5940` rendu `#473827`). */
export const LIGHT_COLOR = 0xffffff;

/** Ambiante : le PLANCHER lumineux d'une face dos au soleil (jamais le noir). */
export const AMBIENT_INTENSITY = 0.45;
/** Directionnelle, calibrée AVEC l'ambiante : sous le modèle lambertien de three, une nappe au sol reçoit
 *  `AMBIENT + SUN·sin(SUN_ELEVATION_DEG)` et une face dos au soleil `AMBIENT`, soit un CONTRASTE
 *  `1 + sin(élévation)·SUN/AMBIENT` = 2,16 aux valeurs ci-dessus. */
export const SUN_INTENSITY = 0.85;

/** Côté (px) de la carte d'ombre. */
export const SHADOW_MAP_SIZE = 2048;
/** Décalage du receveur le long de sa normale, exprimé en TEXELS de la carte d'ombre (jamais en mètres
 *  fixes : à 0,35 m il mangeait l'ombre entière d'un bloc bas et laissait les franges des silhouettes). */
export const SHADOW_NORMAL_BIAS_TEXELS = 3;
/** Marge (m) entre la sphère englobante de la scène et les plans du frustum d'ombre. */
export const SHADOW_MARGIN_M = 4;

/** Contraste ANALYTIQUE du réglage : nappe au sol ÷ face dos au soleil, sous le lambertien de three. */
export function sunContrast(): number {
  return 1 + Math.sin((SUN_ELEVATION_DEG * Math.PI) / 180) * (SUN_INTENSITY / AMBIENT_INTENSITY);
}

/** Réglage complet du soleil d'une scène : pose + frustum d'ombre SERRÉ sur sa sphère englobante. */
export interface SunRig {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Demi-côté du frustum d'ombre (m). */
  span: number;
  near: number;
  far: number;
  mapSize: number;
  normalBias: number;
}

/** Réglage d'ombre d'une scène de boîte englobante `box` pour une direction de soleil DONNÉE (direction
 *  unitaire du point OÙ IL EST) : distance et frustum d'ombre dérivés du seul rayon englobant — toute la
 *  scène caste, et rien de plus n'entre dans la carte d'ombre (chaque mètre de frustum en trop est de la
 *  précision perdue). La `box` attendue est celle des CASTEURS, billboards compris (`worldShadowBox`).
 *
 *  C'est la porte du soleil de JEU (`sunJeu.ts` : heure d'horloge × nord de la scène) ; le soleil de
 *  PLANCHE passe par `sunRig`, qui n'est que cette fonction à direction FIXE. */
export function sunRigFrom(box: THREE.Box3, dir: { x: number; y: number; z: number }): SunRig {
  const target = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  const unité = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
  const distance = radius * 2 + SHADOW_MARGIN_M;
  return {
    position: target.clone().addScaledVector(unité, distance),
    target,
    span: radius,
    near: Math.max(0.1, distance - radius - SHADOW_MARGIN_M),
    far: distance + radius + SHADOW_MARGIN_M,
    mapSize: SHADOW_MAP_SIZE,
    normalBias: ((2 * radius) / SHADOW_MAP_SIZE) * SHADOW_NORMAL_BIAS_TEXELS,
  };
}

/** Soleil de PLANCHE d'une scène de boîte englobante `box` : élévation et azimut FIXES (cf. l'en-tête de
 *  section). Ni l'heure de jeu ni le nord de la carte n'y entrent — c'est ce que les gardes de planche
 *  épinglent, et c'est pourquoi le jeu passe, lui, par `sunRigFrom` + `sunJeu`. */
export function sunRig(box: THREE.Box3): SunRig {
  const elev = (SUN_ELEVATION_DEG * Math.PI) / 180;
  return sunRigFrom(box, {
    x: SUN_AZIMUTH.x * Math.cos(elev),
    y: Math.sin(elev),
    z: SUN_AZIMUTH.z * Math.cos(elev),
  });
}

// ————————————————————————————————————————————————————————————————
// CIEL & BRUME — les couleurs du POV, prises au catalogue d'ambiance
// ————————————————————————————————————————————————————————————————

/** Nombre de paliers du dégradé de ciel. */
const SKY_STEPS = 64;

/** Couleur `#rrggbb` du catalogue en composantes SANS conversion d'espace : la texture de fond est
 *  déclarée sRGB, ses octets sont donc ceux de la donnée. */
function srgb(hex: string): THREE.Color {
  return new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
}

/** TEINTE MÉTÉO d'une couleur de ciel, de brume ou de fond (#1247) : elle se déplace vers la teinte du
 *  voile authoré, dosée par son alpha (`weatherLightScalars`, `catalog/ambiance.ts`). C'est la MÊME
 *  donnée que celle qui dose les lampes de la scène (`stage/stageLights.ts`) — le ciel ne peut donc pas
 *  rester clair sur un monde assombri par l'orage. Rend une couleur NEUVE : `base` est intacte. PURE. */
export function weatherTinted(base: THREE.Color, meteo: WeatherLight = METEO_SANS_EFFET): THREE.Color {
  return meteo.tint ? base.clone().lerp(new THREE.Color(meteo.tint), meteo.k) : base.clone();
}

/** FOND du canevas volumique — ce que la caméra voit LÀ OÙ IL N'Y A PAS DE CARTE (#1176). Il est en
 *  DONNÉE (`ambiance.json`, `iso.stageBg`) comme le ciel du POV : le hors-carte doit se lire comme un
 *  fond sourd, jamais comme un trou noir enclavé entre deux corps de bâtiment. SOURCE UNIQUE : l'écran
 *  de jeu et les planches QC le lisent ici. La météo le teinte (`stageClearColor`). */
export function stageBg(): number {
  return new THREE.Color(AMBIANCE.iso.stageBg).getHex();
}

/** Couleur d'effacement du canevas sous cette météo — le fond suit le même déplacement que la lumière
 *  et que le ciel du POV. PURE. */
export function stageClearColor(meteo: WeatherLight = METEO_SANS_EFFET): number {
  return weatherTinted(new THREE.Color(stageBg()), meteo).getHex();
}

/** ATTÉNUATION D'AMBIANCE du ciel et des brumes (#1176) : le palier de luminosité de la scène —
 *  `ambianceLum` de `stageLightScalars` (`stage/stageLights.ts`), soit `ambianceLuminance(palier)`,
 *  LE MÊME scalaire que celui qui dose les lampes du monde. 1 = plein jour (neutre, la donnée telle
 *  quelle).
 *
 *  ESPACE : la multiplication se fait en LINÉAIRE, l'espace où les lampes multiplient l'albédo des
 *  faces (three éclaire en linéaire, et `applyVisibilityTint` pose ses couleurs de sommet décodées).
 *  Un ciel atténué sur l'octet sRGB tomberait ~3,6× sous le sol qu'il surplombe au même palier.
 *  `base` est en composantes OCTET (cf. `srgb`) et le résultat aussi ; couleur NEUVE, `base` intacte. */
function ambientDimmed(base: THREE.Color, lum: number): THREE.Color {
  const c = base.clone();
  return lum >= 1 ? c : c.convertSRGBToLinear().multiplyScalar(lum).convertLinearToSRGB();
}

/** Fond de CIEL : dégradé vertical `skyTop` (haut) → `fogOutdoor` (horizon à mi-hauteur, et dessous),
 *  soit EXACTEMENT le dégradé `pov-sky` du POV SVG (`povAmbianceDefs`) — aucune teinte propre au volumique.
 *  La météo déplace les DEUX bouts du dégradé (#1247) : sous l'orage, l'horizon ne tranche pas avec
 *  des sols assombris. Le PALIER d'ambiance (`ambianceLum`) atténue ensuite les deux bouts ET la
 *  teinte météo : le ciel de nuit s'éteint avec le monde, il n'a pas de luminosité propre. */
export function skyTexture(meteo: WeatherLight = METEO_SANS_EFFET, ambianceLum = 1): THREE.DataTexture {
  const data = new Uint8Array(SKY_STEPS * 4);
  écrireCielTexels(data, meteo, ambianceLum);
  const tex = new THREE.DataTexture(data, 1, SKY_STEPS, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Les TEXELS du dégradé, écrits dans le tampon qu'on lui donne. Rend `true` si un octet a changé —
 *  c'est ce verdict que la repose ci-dessous transmet au téléversement. */
function écrireCielTexels(data: Uint8Array, meteo: WeatherLight, ambianceLum: number): boolean {
  const haut = ambientDimmed(weatherTinted(srgb(AMBIANCE.pov.skyTop), meteo), ambianceLum);
  const horizon = ambientDimmed(weatherTinted(srgb(AMBIANCE.pov.fogOutdoor), meteo), ambianceLum);
  const mélange = new THREE.Color();
  let changé = false;
  for (let i = 0; i < SKY_STEPS; i++) {
    const v = i / (SKY_STEPS - 1); // 0 = bas de l'image
    const c = mélange.copy(horizon).lerp(haut, Math.max(0, (v - 0.5) * 2));
    const octets = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255];
    for (let k = 0; k < 4; k++) {
      if (data[i * 4 + k] !== octets[k]) { data[i * 4 + k] = octets[k]; changé = true; }
    }
  }
  return changé;
}

/**
 * LE MÊME CIEL, REPOSÉ (#1404) — un palier d'heure ou un changement de météo réécrit les texels de la
 * texture EN PLACE et redemande son téléversement ; la `DataTexture` est montée une fois pour la vie de
 * l'écran. Une texture recréée à chaque palier libérait la sienne sur le GPU et en réallouait une pour
 * 256 octets de dégradé. Rend `true` si le dégradé a changé (donc s'il faut repeindre).
 */
export function reposerCiel(
  tex: THREE.DataTexture,
  meteo: WeatherLight = METEO_SANS_EFFET,
  ambianceLum = 1,
): boolean {
  const changé = écrireCielTexels(tex.image.data as Uint8Array, meteo, ambianceLum);
  if (changé) tex.needsUpdate = true;
  return changé;
}

/** FOND de la première personne SOUS UN TOIT : le POV n'y dessine aucun plafond — ce qui n'est pas
 *  peint est cette nappe sombre. DEHORS, le fond est le dégradé de ciel monté pour la vie de l'écran
 *  (`skyTexture`, reposé par `reposerCiel`), et il porte la brume du CIEL (`fogOutdoor`) là où les
 *  surfaces portent la leur (`povFog` ci-dessous) — cf. le JSDoc de `AMBIANCE.pov.fogOutdoorSurface`.
 *  La météo n'entre pas ici : entré sous un toit, on est sorti d'elle. Le palier d'ambiance, lui, y
 *  entre : la nappe d'intérieur est une nappe du monde et en suit la lumière (elle part de si bas —
 *  `fogIndoor` #0a0a10 — que le geste ne s'y voit qu'au bord du noir). La couleur est DÉCODÉE
 *  (composantes de travail linéaires) : le facteur s'y multiplie dans le même espace que celui du
 *  ciel ci-dessus. */
export function povBackgroundIndoor(ambianceLum = 1): THREE.Color {
  return new THREE.Color(AMBIANCE.pov.fogIndoor).multiplyScalar(ambianceLum);
}

/** Brume atmosphérique des SURFACES du POV : la courbe du milieu (`povDepth`, en CASES → mètres) et
 *  la brume qui lui répond — extérieur clair et chaud (`fogOutdoorSurface`, jamais le bleu du ciel :
 *  les sols lointains s'y relèveraient, « délavé »), intérieur sombre (`fogIndoor`). Le sol s'y éteint
 *  au lieu de finir sur une arête franche. Le GAMMA de la courbe, lui, vit au shader (`installFogGamma`
 *  + `applyFogGamma`) : `THREE.Fog` ne sait qu'interpoler en smoothstep.
 *
 *  MÉTÉO (#1247) : dehors, une brume authorée (`brume.color`) REMPLACE la couleur du milieu et son
 *  `povTightenK` resserre la courbe — le resserrement vient de `povDepth`, qui sert AUSSI le plan
 *  lointain de la caméra : la brume atteint 1 exactement à la coupure de rendu, jamais avant ni après.
 *
 *  AMBIANCE (#1176) : la teinte du milieu est un ALBÉDO comme celui d'une face — le palier
 *  (`ambianceLum`) la multiplie, faute de quoi un sol lointain se relèverait vers une brume de plein
 *  jour à minuit. La multiplication est ici directement en composantes de travail (linéaires), le
 *  même espace que celui d'`ambientDimmed`.
 *
 *  ESPACE DE MÉLANGE (réf juge de design P3-1c) : three mélange la brume en LINÉAIRE (le fragment
 *  travaille après conversion), là où le POV la mélange en sRGB (`pov/camera.mixHex`). À facteur égal,
 *  les deux rendent donc des octets différents : 13,3/255 par canal à mi-course sur un couple gris
 *  sombre → brume claire, 8,1/255 à trois quarts. Le FACTEUR, lui, est le même des deux côtés (courbe
 *  vérifiée à 1e-9, `sceneMeshes.test.ts`) : l'écart est perceptuel, il se juge à l'écran. */
export function povFog(
  mpt: number,
  indoor: boolean,
  brume?: BrumeAuthorée,
  ambianceLum = 1,
): THREE.Fog {
  const p = paramsBrume(mpt, indoor, brume, ambianceLum);
  return new THREE.Fog(p.couleur, p.near, p.far);
}

/** La brume AUTHORÉE d'une météo, telle que la scène la porte (`AMBIANCE.iso.weather.*.brume`). */
type BrumeAuthorée = { color: string; povTightenK?: number } | null;

/** Les trois paramètres d'une brume de POV : une seule dérivation, pour la fabriquer comme pour la
 *  reposer. */
function paramsBrume(
  mpt: number,
  indoor: boolean,
  brume: BrumeAuthorée | undefined,
  ambianceLum: number,
): { couleur: THREE.Color; near: number; far: number } {
  const c = povDepth(indoor, brume?.povTightenK).curve;
  const teinte = !indoor && brume ? brume.color : indoor ? AMBIANCE.pov.fogIndoor : AMBIANCE.pov.fogOutdoorSurface;
  return { couleur: new THREE.Color(teinte).multiplyScalar(ambianceLum), near: c.start * mpt, far: c.end * mpt };
}

/**
 * LA MÊME BRUME, REPOSÉE (#1394) — au patron de `reposerCiel` : la brume de la première personne est
 * montée une fois pour la durée du regard, et un palier d'heure, une météo ou une échelle de carte
 * n'en réécrivent que les paramètres, sur l'objet déjà posé. Rend `true` si l'un d'eux a changé, et
 * c'est le SEUL témoin de ce changement : la scène porte la même `THREE.Fog` de part et d'autre,
 * qu'aucune comparaison de référence ne distinguerait.
 */
export function reposerBrume(
  fog: THREE.Fog,
  mpt: number,
  indoor: boolean,
  brume?: BrumeAuthorée,
  ambianceLum = 1,
): boolean {
  const p = paramsBrume(mpt, indoor, brume, ambianceLum);
  if (fog.color.equals(p.couleur) && fog.near === p.near && fog.far === p.far) return false;
  fog.color.copy(p.couleur);
  fog.near = p.near;
  fog.far = p.far;
  return true;
}

/** Nom du `#define` par lequel un matériau réclame le gamma de la courbe POV. Un matériau qui ne le
 *  porte pas garde la brume de three au trait près : la surcharge de chunk ci-dessous est GLOBALE au
 *  module three (elle touche donc tous les écrans), le gamma ne l'est pas. */
export const FOG_GAMMA_DEFINE = 'POV_FOG_GAMMA';

/** Vrai une fois la surcharge posée — elle ne se pose qu'UNE fois par module three chargé. */
let gammaInstallé = false;

/** La ligne de `ShaderChunk.fog_fragment` (three r185) devant laquelle le gamma s'insère. Son absence
 *  (montée de version) laisse la brume de three intacte, et le banc de `sceneMeshes.test.ts` rouge. */
const ANCRE_FOG = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';

/**
 * SURCHARGE (idempotente, module-level) du fragment de brume de three. Le fog natif est
 * `smoothstep( fogNear, fogFar, vFogDepth )` — la MOITIÉ de la courbe du POV, qui est
 * `smoothstep^gamma` (`fogAt`, `pov/camera.ts`). Le `pow` manquant s'ajoute ici, pour TOUS les
 * matériaux embrumés d'un coup : un `onBeforeCompile` par matériau referait ce même travail quatre-
 * vingt-dix fois. Sous `#ifdef` : sans le define, le chunk surchargé rend exactement le chunk d'origine.
 */
export function installFogGamma(): void {
  if (gammaInstallé) return;
  gammaInstallé = true;
  const chunk = THREE.ShaderChunk.fog_fragment;
  THREE.ShaderChunk.fog_fragment = chunk.replace(
    ANCRE_FOG,
    `#ifdef ${FOG_GAMMA_DEFINE}\n\t\tfogFactor = pow( fogFactor, ${FOG_GAMMA_DEFINE} );\n\t#endif\n\t${ANCRE_FOG}`,
  );
}

/** Le `#define` est une constante de COMPILATION : un littéral flottant GLSL, jamais un entier nu
 *  (`pow( x, 2 )` ne compile pas). Quatre décimales : un gamma sous 0,00005 s'écrirait « 0.0000 », donc
 *  `pow(x, 0) = 1` — une brume PLEINE partout, sans un mot. Le schéma de la donnée le borne déjà
 *  (`fogGamma` ≥ 0,1, `src/data/schemas/defs/ambiance.ts`) ; ce garde-fou tient le site du littéral,
 *  qu'un gamma vienne de la donnée ou d'un appelant. #1176 P3-1c */
const littéralGlsl = (v: number): string => {
  const s = v.toFixed(4);
  if (!(Number(s) > 0)) throw new Error(`gamma de brume irreprésentable au shader : ${v} → « ${s} »`);
  return s;
};

/** Un matériau qui SAIT s'embrumer : `fog` n'est pas déclaré sur la classe de base de three, seulement
 *  sur les matériaux de surface (`MeshBasicMaterial`, `MeshLambertMaterial`…). */
export type MatériauEmbrumable = THREE.Material & { fog?: boolean };

/**
 * Pose (ou retire, avec `null`) le gamma de brume sur tous les matériaux EMBRUMÉS d'un sous-arbre, et
 * renvoie `true` si au moins un a changé (donc recompilé). C'est un `#define` et non un uniform : les
 * uniformes d'un matériau intégré (`MeshLambertMaterial`) sont clonés par three à la compilation et
 * inatteignables depuis le JS, là où `defines` est une propriété du matériau. Une scène entière partage
 * la même valeur → une seule clé de programme, donc UN programme comme avant.
 */
export function applyFogGamma(root: THREE.Object3D, gamma: number | null): boolean {
  if (gamma !== null) installFogGamma();
  const voulu = gamma === null ? undefined : littéralGlsl(gamma);
  let changé = false;
  root.traverse((o) => {
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const m of mats) {
      if (!m.fog) continue;
      const actuel = m.defines?.[FOG_GAMMA_DEFINE] as string | undefined;
      if (actuel === voulu) continue;
      if (voulu === undefined) delete m.defines![FOG_GAMMA_DEFINE];
      else (m.defines ??= {})[FOG_GAMMA_DEFINE] = voulu;
      m.needsUpdate = true;
      changé = true;
    }
  });
  return changé;
}

// ————————————————————————————————————————————————————————————————
// BILLBOARDS — profondeur et ombre de contact
// ————————————————————————————————————————————————————————————————

/** Biais de PROFONDEUR (m) d'un quad de billboard : un plan aligné écran plonge sinon dans la géométrie
 *  qu'il touche (silhouettes tranchées par une ligne de crête). Il ne DÉPLACE pas le sujet — un
 *  déplacement monde le long du regard faisait glisser l'ombre de contact de ±0,33 m avec la caméra et
 *  grossissait la silhouette de 17,6 % au POV à 2 m. Il se dépose sur le seul tampon de profondeur
 *  (`polygonOffset`), donc ni sur la passe d'ombre (three fabrique son propre `MeshDepthMaterial` :
 *  `getDepthMaterial`, `three.module.js:9467`, qui ne recopie pas `polygonOffset*`), ni sur la taille. */
export const BILLBOARD_DEPTH_BIAS_M = 0.3;

/** Bits du tampon de profondeur d'un contexte WebGL (`depth: true`) — l'unité de `polygonOffsetUnits`
 *  vaut 2^-BITS de profondeur FENÊTRE. */
export const DEPTH_BUFFER_BITS = 24;

/** `polygonOffsetUnits` (négatif = vers l'œil) qui vaut `BILLBOARD_DEPTH_BIAS_M` pour une caméra de
 *  bornes `near`/`far`. ORTHO : la profondeur fenêtre est linéaire, un mètre y vaut `1/(far−near)`.
 *  PERSPECTIVE (`depthM` fourni) : elle ne l'est pas — `z_w = a + b/z_view`, donc un mètre à la
 *  PROFONDEUR `z` vaut `near·far/((far−near)·z²)`. La grandeur attendue est `z_view` (`billboardViewDepth`),
 *  jamais la distance euclidienne à l'œil. */
export function billboardDepthOffsetUnits(near: number, far: number, depthM: number | null = null): number {
  const parMetre = depthM === null
    ? 1 / (far - near)
    : (near * far) / ((far - near) * Math.max(depthM, near) ** 2);
  return -BILLBOARD_DEPTH_BIAS_M * parMetre * 2 ** DEPTH_BUFFER_BITS;
}

/** Œil et axe de VISÉE de travail — la caméra les redonne à chaque appel, et une allocation par
 *  billboard et par frame n'a rien à faire dans une boucle de pose. */
const OEIL_VUE = new THREE.Vector3();
const AVANT_VUE = new THREE.Vector3();

/** `z_view` d'un point sous `camera` : sa profondeur le long de l'axe de visée — la SEULE grandeur dont
 *  dépend la profondeur fenêtre d'une perspective. Un quad aligné écran est parallèle au plan image,
 *  donc son `z_view` est constant sur toute sa surface (ancre et centre compris), là où sa distance à
 *  l'œil croît vers les bords du champ : mesuré au FOV_X 75° (16/9), la distance ne rendait que
 *  0,185 m de biais au coin de l'écran pour 0,300 m demandés. */
export function billboardViewDepth(camera: THREE.Camera, p: THREE.Vector3): number {
  camera.getWorldPosition(OEIL_VUE);
  AVANT_VUE.set(0, 0, -1).applyQuaternion(camera.quaternion);
  return (p.x - OEIL_VUE.x) * AVANT_VUE.x + (p.y - OEIL_VUE.y) * AVANT_VUE.y + (p.z - OEIL_VUE.z) * AVANT_VUE.z;
}

/** Position MONDE du centre d'un quad aligné écran : l'ancre PIEDS est EXACTE, le quad monte de sa
 *  demi-hauteur le long du HAUT D'ÉCRAN. Aucune avance le long du regard : l'arête basse du quad reste
 *  sur l'ancre quelle que soit la caméra.
 *
 *  SÉMANTIQUE D'ÉCRAN, à DESSEIN, et c'est ce dont dépend l'ÉTINCELLE d'un décor fouillable
 *  (`stage/interactHaloPose`) : son glyphe se décale en PIXELS d'écran, donc son élévation doit suivre
 *  le haut de l'écran, même couché dans le plan du sol. Les CORPS, eux, ne passent plus par ici : leur
 *  centre se prend à `stage/boardPose.boardCenter`, qui bascule sur la VERTICALE MONDE quand ce haut
 *  d'écran dégénère (#1176, P3-5c). */
export function billboardPose(anchor: THREE.Vector3, centerLiftM: number, camQuat: THREE.Quaternion): THREE.Vector3 {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);
  return anchor.clone().addScaledVector(up, centerLiftM);
}

/** Boîte des CASTEURS d'ombre : la géométrie du monde ÉLARGIE aux quads des billboards. Le sujet le plus
 *  haut du siège dépassait la boîte de géométrie de 0,769 m (mesuré #1176, convention `jeu` ; 3,44 m à
 *  `pont-vitrine` en `heroique`) — hors frustum, une silhouette cesse de projeter. */
export function worldShadowBox(
  geoBox: THREE.Box3,
  subjects: readonly BillboardSubject[],
  quadOf: (sub: BillboardSubject) => { widthM: number; heightM: number },
): THREE.Box3 {
  const box = geoBox.clone();
  const p = new THREE.Vector3();
  for (const sub of subjects) {
    const { widthM, heightM } = quadOf(sub);
    const r = widthM / 2;
    for (const dx of [-r, r])
      for (const dz of [-r, r])
        for (const dy of [0, heightM]) box.expandByPoint(p.copy(sub.anchor).add(new THREE.Vector3(dx, dy, dz)));
  }
  return box;
}

/** Boîte du BÂTI d'une scène : les faces dont le matériau n'est PAS du terrain nu (relief, structure,
 *  toiture). `null` quand la carte n'en porte aucune. La géométrie se calcule sur la liste ENTIÈRE puis
 *  se FILTRE — le rang coplanaire de `facesGeometry` se mesure sur toute la scène (contrat de
 *  `coplanarRanks`) : sur une liste amputée, les mêmes faces sortent à un biais différent.
 *
 *  MÉMOÏSÉE par (scène, `mpt`) via le patron canonique `memoByRefDeps` : elle rejoue `worldFaces` +
 *  `facesGeometry`, soit la passe de `buildWorldGeometry` une seconde fois (mesuré #1181 : 1633 ms sur
 *  `opera`, contre 1815 ms pour la géométrie du monde) — une rotation ou un zoom ne la repaie plus. */
const builtFacesBoxMemo = memoByRefDeps<Scene, THREE.Box3 | null>();
function builtFacesBox(scene: Scene, mpt: number): THREE.Box3 | null {
  return builtFacesBoxMemo(scene, [mpt], () => computeBuiltFacesBox(scene, mpt));
}

function computeBuiltFacesBox(scene: Scene, mpt: number): THREE.Box3 | null {
  const faces = worldFaces(scene).map((f) => f.face);
  const geoms = facesGeometry(faces, mpt, faceDepthOf());
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (let i = 0; i < faces.length; i++) {
    if (faces[i].material.domain === 'terrain') continue;
    for (const tri of geoms[i].tris) for (const s of tri) box.expandByPoint(p.set(s.x, s.y, s.z));
  }
  return box.isEmpty() ? null : box;
}

/** Boîte du CONTENU d'une scène — ce qu'un cadrage doit tenir : le BÂTI élargi aux quads des sujets.
 *  Repli sur `fallback` (la géométrie entière) pour une carte SANS bâti : cadrer sur une boîte vide n'a
 *  pas de sens. Écart mesuré (#1176) entre géométrie et contenu : `vitrine-batiments` 60×48 m → 51,4×37,1 m,
 *  `pont-vitrine` 32×32 m → 31,9×25,9 m ; `siege-enceinte` 60,2×92 m → 60,2×85,9 m (son bâti touche presque
 *  les bords : là, c'est l'ÉCHELLE, pas le contenu, qui débordait le cadre). */
export function contentBox(
  scene: Scene,
  mpt: number,
  subjects: readonly BillboardSubject[],
  quadOf: (sub: BillboardSubject) => { widthM: number; heightM: number },
  fallback: THREE.Box3,
): THREE.Box3 {
  return worldShadowBox(builtFacesBox(scene, mpt) ?? fallback, subjects, quadOf);
}

/** Le disque d'ombre de contact n'a lieu d'être qu'en couleur CUITE : en mode éclairé, le billboard
 *  projette sa VRAIE ombre (`castShadow`) et le disque en ferait une seconde, à l'aplomb. */
export function wantsContactShadow(kind: BillboardKind, lit: boolean): boolean {
  return kind === 'personnage' && !lit;
}

/** Décollement (m) du disque d'ombre au-dessus du sol qui le porte. */
export const CONTACT_SHADOW_LIFT_M = 0.02;
/** Rayon de l'ombre de contact, en part de la largeur CANONIQUE du sujet (`contactShadowWidthM`). */
export const CONTACT_SHADOW_RADIUS_K = 0.35;
export const CONTACT_SHADOW_OPACITY = 0.28;

/** Largeur (m) sur laquelle se taille le socle d'un sujet : celle qu'aurait sa boîte DEBOUT — `BB_W`
 *  ramené au monde par la MÊME chaîne d'échelle que le quad (`subjectQuad` : un pixel de boîte vaut
 *  `heightM / box.h` mètres). La boîte d'ART courante ne convient pas : la chute la BALAIE (193×193
 *  pour un corps au sol contre 120×150 debout), et le disque du mort sortirait ×1,61 plus large que
 *  celui du même sujet vivant à côté — alors qu'il est centré sur les pieds. Un couple MONTÉ n'y perd
 *  rien : `mountedSvg` ne hausse que la HAUTEUR de sa boîte (`box.w === BB_W`), sa largeur de socle
 *  était déjà canonique. */
export function contactShadowWidthM(
  sub: Pick<BillboardSubject, 'box'>,
  quad: { heightM: number },
): number {
  return (quad.heightM / sub.box.h) * BB_W;
}

/** Ombre de CONTACT d'un billboard : un disque sombre plaqué au sol, à l'aplomb EXACT de l'ancre pieds
 *  (mêmes x/z que le sujet — un décalage y laisse une ellipse orpheline à côté du personnage). Il ne
 *  prend PAS la largeur du quad : le sujet et son quad entrent entiers, la largeur du socle se dérive
 *  ici (`contactShadowWidthM`) — aucun appelant n'a de largeur à choisir. */
export function contactShadow(
  sub: Pick<BillboardSubject, 'anchor' | 'box'>,
  quad: { heightM: number },
): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const geo = new THREE.CircleGeometry(contactShadowWidthM(sub, quad) * CONTACT_SHADOW_RADIUS_K, 24);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: CONTACT_SHADOW_OPACITY,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  poseContactShadow(mesh, sub.anchor);
  return mesh;
}

/** (Re)plaque un disque d'ombre sous une ancre pieds — le SEUL endroit qui décide de son aplomb, que
 *  le disque vienne d'être monté ou qu'il suive un sujet qui glisse (`stage/boardPose.ts`). */
export function poseContactShadow(disque: THREE.Object3D, anchor: THREE.Vector3): void {
  disque.position.set(anchor.x, anchor.y + CONTACT_SHADOW_LIFT_M, anchor.z);
}
