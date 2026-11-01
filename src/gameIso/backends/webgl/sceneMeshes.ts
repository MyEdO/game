/**
 * ASSEMBLEUR DU MONDE VOLUMIQUE : les builders du pivot (`builders/floors|walls|roofs|props`)
 * deviennent (a) UNE géométrie de monde fusionnée (positions + couleurs de sommet), (b) une liste de
 * SUJETS de billboard (le décor), chacun capable de rendre SA chaîne SVG pour une vue.
 *
 * Deux invariants de ce module :
 *  - FUSION : toutes les faces de la scène tiennent dans UNE `BufferGeometry` (la couleur de face est
 *    cuite au sommet, le mode de rendu n'est qu'un choix de MATÉRIAU) — jamais un mesh par face. Elle
 *    est INDEXÉE, d'un index IDENTITÉ (un sommet par usage : `computeVertexNormals` donne toujours la
 *    normale de FACE) que le masque de dégagement compacte sans toucher aux sommets ;
 *  - DÉLÉGATION : aucune couleur, aucune vue, aucun seuil n'est décidé ici — `faceSurface`, le champ
 *    de teinte (`visibilityTint`), `facesGeometry` (biais coplanaire compris), `propSvg` font foi.
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
import { estPropVolumique, type CellSide, type Face, type PropEl, type RoofEl, type SceneEl, type TokenEl, type WallEl } from '../../builders/types';
import { findPropById, findPropMaterialById, matieresDe, refEstVolumique } from '../../../data';
import { roofMaterial } from '../../catalog/roofs';
import { toitureEffective } from '../../../noyau/sceneEdit';
import type { PropVertexRange } from './spriteRaycast';
import { roofCourseStepM, variantOf } from '../../detail/courses';
import type { DetailRecipe } from '../../../data/materials.types';
import type { PeriodKind } from './periodTexture';
import { faceBakeKey, needsFaceBake } from './faceBake';
import { facePoly, faceUvFrame, facesGeometry, orienterPoly, shadeFamily } from './worldTris';
import { faceSurface, shadeFactorOf, tintVarFactor } from './faceColors';
import { faceDepthOf } from './faceRelief';
import { BB_W, BB_H } from '../../pov/billboardCore';
import { povDepth } from '../../pov/camera';
import { defsGlobaux } from '../../sprites';
import { tousLesTerrains } from '../../../noyau/monde/terrain';
import { propSvg } from '../../catalog/decor';
import { AMBIANCE, METEO_SANS_EFFET, type WeatherLight } from '../../catalog/ambiance';
import type { Combatant } from '../../../engine/types';
import type { View } from '../../facing';
import type { Rot } from '../../../geometry/iso';
import type { Dir8 } from '../../../geometry/dir8';
import { doorIsOpen, heightAt, porteAuteur, porteEnJeu, structureIsDown, tuilesEffondreesSignature, type LectureDArete, type Scene, type WallSide } from '../../../noyau/monde/scene';
import { memoByRef, memoByRefDeps } from '../../../noyau/monde/sceneMemo';

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
function faceEls(scene: Scene, lecture: LectureDArete): SceneEl[] {
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  return [
    ...buildFloors(scene, undefined, { activeZ: maxZ }),
    ...buildWalls(scene, lecture),
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

export function worldFaces(scene: Scene, lecture: LectureDArete): WorldFace[] {
  const out: WorldFace[] = [];
  for (const el of faceEls(scene, lecture)) {
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
 *  appareillage. Le nombre de dessins passe de 1 à quelques dizaines : le prix d'une texture
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
 * les TERRAINS par `terrainDeps`. `scene.flags` n'y entre que par ses LECTURES de cuisson :
 * `etatDesAretesSignature` (porte en jeu, battant, structure abattue) et `tuilesEffondreesSignature`. Un
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
    propVolumeSignature(scene), etatDesAretesSignature(scene), tuilesEffondreesSignature(scene),
    ...propRecipeDeps(scene), ...matiereDeps(scene), ...terrainDeps()];
}

/** Ce qu'une identité de cache écrit à la place d'un type NON NOMMÉ (#877) — jeton de SIGNATURE,
 *  jamais un id : rien ne se résout sous ce nom, et il ne peut collider avec aucune entrée de
 *  `props.json` (les crochets n'appartiennent pas aux ids). */
const REF_NON_NOMMEE = '[sans type]';

/** Ce que la cuisson lit de `scene.flags` par les ARÊTES (`wallGeometry`) : porte en jeu (révélation
 *  d'une secrète), battant ouvert, structure abattue — une chaîne, jamais `scene.flags` entier : un flag
 *  sans lecteur de cuisson ne recuit rien. */
function etatDesAretesSignature(scene: Scene): string {
  const parts: string[] = [];
  for (const w of scene.walls ?? []) {
    const enJeu = porteEnJeu(scene, w), ouverte = porteAuteur(w) && doorIsOpen(scene, w), abattue = structureIsDown(scene, w);
    if (enJeu || ouverte || abattue) parts.push(`${w.x},${w.y},${w.side},${w.z ?? 0}|${+enJeu}${+ouverte}${+abattue}`);
  }
  return parts.join(';');
}

/** Ce que la cuisson retient des ENTITÉS : la signature des seuls décors à recette — id, ref, case,
 *  couche, cap. `scene.entities` ENTIER n'entrerait pas ici : un despawn de combat ou un déplacement
 *  forcé en reforge la référence à chaque tour, et recuirait un monde que rien n'a déplacé. */
function propVolumeSignature(scene: Scene): string {
  const parts: string[] = [];
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop' || !refEstVolumique(ent.ref)) continue;
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
 *    masses DÉRIVÉES héritent — `toitureEffective`, `noyau/sceneEdit.ts` : corps, puis type de bâtiment,
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

/** READ-SET de `heightAt` (`noyau/monde/scene.ts`) — la SEULE lecture de scène des passes de billboards
 *  (`collectBillboards` : il prend tout le reste de ses éléments). */
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
  for (const el of buildWalls(scene, 'jeu')) if (el.roomZoneIds?.length) table.set(el.key, el.roomZoneIds);
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
export function bakeWorldGeometry(scene: Scene, mpt: number, lecture: LectureDArete): BakedWorld {
  const listées = worldFaces(scene, lecture);
  const faces = listées.map((f) => f.face);
  // Le RANG coplanaire se calcule sur la liste ENTIÈRE de la scène (contrat de `coplanarRanks`).
  const geoms = facesGeometry(faces, mpt, faceDepthOf());
  const positions: number[] = [];
  const uvs: number[] = [];
  const uv1s: number[] = [];
  const spans: FaceSpan[] = [];
  const shades: number[] = [];
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
  return { geometry, spans, mpt, shades: new Float32Array(shades) };
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
 *  CHAMP CONTINU PAR SOMMET (#1176) : la teinte s'échantillonne à la POSITION MONDE de CHAQUE
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
 *  sans modelé.
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
export function buildWorldGeometry(scene: Scene, mpt: number, lecture: LectureDArete, tintAt: TintAt, fade = 1): WorldGeometry {
  return applyVisibilityTint(bakeWorldGeometry(scene, mpt, lecture), tintAt, fade).geometry;
}

/** Un décor prêt à texturer : sa position, son échelle et son dessin. */
export interface BillboardSubject {
  /** Identité de cache (hors vue/miroir/palier — cf. `billboardTextureKey`). */
  identity: string;
  /** Ancre PIEDS en repère three (mètres). */
  anchor: THREE.Vector3;
  /** Orientation MONDE d'auteur. */
  facing: Dir8;
  /** Multiplicateur de taille (empreinte de décor). */
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
}

/** Éléments de scène à billboarder : les décors de la sortie des BUILDERS, donc les MÊMES filtres que
 *  la voie affine (étage isolé/actif, hors-vue). Il n'y a PAS de second jeu de lois côté volumique :
 *  l'écran de jeu passe les éléments de SON stage. */
export interface SceneBillboardEls {
  props: readonly PropEl[];
}

/** Éléments de la scène ENTIÈRE — pour un appelant SANS loi de vue ni combat en cours (les planches QC :
 *  elles jugent l'ENVIRONNEMENT, pas le brouillard), au même titre que `keepEl` absent.
 *  Un écran de JEU ne passe JAMAIS ceci : c'est là que se perdrait sa loi de vue. */
export function wholeSceneBillboardEls(scene: Scene): SceneBillboardEls {
  return {
    // Un décor volumique est cuit dans la masse du monde : il n'a pas de sujet de billboard à poser.
    props: buildProps(scene).filter((el) => !estPropVolumique(el)),
  };
}

/** Sujets de billboard de la scène : le DÉCOR. */
export function collectBillboards(scene: Scene, mpt: number, els: SceneBillboardEls): BillboardSubject[] {
  const out: BillboardSubject[] = [];
  const defs = `<defs>${defsGlobaux()}</defs>`;
  for (const el of els.props) {
    if (estPropVolumique(el)) continue; // cuit dans la masse du monde, jamais billboardé
    const gx = el.cell.x + el.foot.offX;
    const gy = el.cell.y + el.foot.offY;
    const h = heightAt(scene, el.cell.x, el.cell.y, el.cell.z) + (el.liftM ?? 0);
    out.push({
      // IDENTITÉ = la clé de l'élément ET sa SIGNATURE DE DESSIN (#1176). La clé seule ne suffit PAS : elle
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
 * et lui seul, tout primitif.
 *
 * Sa raison d'être : les builders rendent des tableaux NEUFS à chaque calcul de vue (`buildProps` prend
 * le champ de visibilité), si bien qu'un pas du groupe passait des éléments identiques sous une
 * référence neuve — et remontait tous les quads du monde.
 *
 * IL VIT ICI, contre le collecteur : c'est la même lecture, et deux fichiers ne peuvent pas la tenir
 * d'accord.
 */
export function memesBillboardEls(a: SceneBillboardEls, b: SceneBillboardEls): boolean {
  if (a === b) return true;
  if (a.props.length !== b.props.length) return false;
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

/** ACTEUR posé du monde volumique : le combattant (groupe en exploration, combattants en combat) et sa
 *  case LOGIQUE. Lecteurs : la proximité de montage (`stage/GameStage3D.centreDuGroupe`) et la base du
 *  glissement de marche (`stage/VolumetricWorld`, `StageWalkAnim.glide`). */
export interface ActorPose {
  c: Combatant;
  x: number;
  y: number;
  z: number;
}

/** Poses d'acteur des ÉLÉMENTS DU BUILDER — la SEULE dérivation acteurs du monde volumique (les filtres
 *  de rendu sont déjà ceux du builder). Un couple MONTÉ donne UNE pose : celle de la monture, qui porte
 *  la case. */
export function actorPoses(tokenEls: readonly TokenEl[]): ActorPose[] {
  const out: ActorPose[] = [];
  for (const tk of tokenEls) {
    const s = tk.subject;
    const unit = s.kind === 'combatant' ? s.c : s.kind === 'mounted' ? s.mount : null;
    if (!unit?.pos) continue;
    out.push({ c: unit, x: unit.pos.x, y: unit.pos.y, z: tk.cell.z });
  }
  return out;
}

/** POSE du jeton de GROUPE hors combat — la seule que le builder de jetons ne produit pas (le groupe
 *  n'est pas un combattant posté). */
export function partyActorPose(partyToken: { leader: Combatant; pos: { x: number; y: number; z?: number } }): ActorPose {
  return { c: partyToken.leader, x: partyToken.pos.x, y: partyToken.pos.y, z: partyToken.pos.z ?? 0 };
}

/** Clé de MÉMO d'un acteur du monde volumique (`stage/VolumetricWorld`) : son id et sa case. */
export function actorPoseKey(p: ActorPose): string {
  return `${p.c.id}:${p.x},${p.y},${p.z}`;
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
 *  ESPACE DE MÉLANGE (#1176) : three mélange la brume en LINÉAIRE (le fragment
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
 *  qu'un gamma vienne de la donnée ou d'un appelant. #1176 */
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
 *  d'écran dégénère (#1176). */
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
function builtFacesBox(scene: Scene, mpt: number, lecture: LectureDArete): THREE.Box3 | null {
  return builtFacesBoxMemo(scene, [mpt, lecture], () => computeBuiltFacesBox(scene, mpt, lecture));
}

function computeBuiltFacesBox(scene: Scene, mpt: number, lecture: LectureDArete): THREE.Box3 | null {
  const faces = worldFaces(scene, lecture).map((f) => f.face);
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
  lecture: LectureDArete,
  subjects: readonly BillboardSubject[],
  quadOf: (sub: BillboardSubject) => { widthM: number; heightM: number },
  fallback: THREE.Box3,
): THREE.Box3 {
  return worldShadowBox(builtFacesBox(scene, mpt, lecture) ?? fallback, subjects, quadOf);
}
