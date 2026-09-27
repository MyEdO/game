/**
 * SURFACE d'une `Face` du pivot — UNE résolution matériau → (couleur de base, recette de détail, clé de
 * texture, échelle d'UV), par DOMAINE et depuis les MÊMES catalogues que les deux backends écran :
 * structures (`wallPartColor`, partagé avec le POV), relief (`reliefMaterial`), toiture (`roofMaterial`),
 * terrain (`swatch` du dataset `src/data/terrains.json`). Aucun littéral de couleur ici.
 *
 * Les DEUX modes d'usage du renderer (unlit = couleur cuite au sommet ; lit = matériau éclairé) partent
 * de CETTE couleur de base : le mode est un choix de MATÉRIAU, pas de couleur, et ne se paramètre donc
 * pas ici. Aucun ombrage d'écran pré-calculé n'y est cuit — la lumière du renderer le remplace. Seul
 * le MODELÉ DE FORME y a son facteur (`shadeFactorOf`) : c'est une irradiance ambiante AUTHORÉE
 * (`AMBIANCE.faceShade`), donc une lecture de catalogue comme les couleurs, indexée par la famille
 * d'orientation que la géométrie donne (`worldTris.ts:shadeFamily`).
 *
 * DIVERGENCE ASSUMÉE avec l'affine sur les SOLS : un `TerrainDef` porte un dégradé `stops` (ombrage
 * CUIT dans l'image, du clair en haut vers le sombre en bas de la tuile) en plus de son `swatch`. Ce
 * dégradé est de la lumière peinte à la main : ici la couleur de base est le `swatch` seul, et le
 * soleil du renderer fait l'ombrage. Seule la variance de teinte PAR TUILE (`detail.tintVar`) est
 * reprise — elle est de l'identité de matériau, pas de la lumière (cf. `tintVarFactor`).
 *
 * MÊME DIVERGENCE sur les PANS DE TOIT : un `RoofMaterialDef` porte quatre teintes N/E/S/O, un ombrage
 * par cardinal cuit par le peintre affine (qui n'a pas de lumière). Ici tous les pans d'un matériau
 * partent de sa teinte de référence `N` et c'est le soleil qui creuse les versants. Mesuré le
 * 2026-08-10 sur `vitrine-batiments-top-unlit` AVANT ce choix : les deux versants d'un même toit
 * rendaient 87,1 contre 45,7 de luminance (×1,91) et 9,79 contre 1,24 d'écart-type — le pan sombre
 * perdait jusqu'à son appareillage, le joint de la recette y étant PLUS CLAIR que le pan. Garde de
 * planche « MATIÈRE UNIQUE par toit ».
 */
import { AMBIANCE } from '../../catalog/ambiance';
import { reliefMaterial } from '../../catalog/relief';
import { roofMaterial } from '../../catalog/roofs';
import { structureAppearance, wallPartColor, type WallPart } from '../../catalog/structures';
import { terrainDef } from '../../catalog/terrain';
import { propMaterial } from '../../catalog/propMaterials';
import { MISSING_TONE } from '../../catalog/missing';
import { TINT_SPREAD } from '../../detail/expand';
import { coursesPeriodM, groundPeriodM } from '../../detail/courses';
import { hash32 } from '../../../data/hash';
import type { DetailRecipe } from '../../detail/types';
import type { Face } from '../../builders/types';
import { SHADE_CYCLE, type ShadeFamily } from './worldTris';

/** Modes de rendu d'une face — deux MATÉRIAUX du renderer, une seule couleur de base (`faceSurface`). */
export type ColorMode = 'unlit' | 'lit';

function reliefColor(id: string, part: string | undefined): string {
  const m = reliefMaterial(id);
  return (part === 'ramp' ? m.slopeTop : undefined) ?? m.face;
}

/** Couleur d'une face de TOITURE. Les PANS partagent tous la teinte de référence `N` du matériau, quel
 *  que soit leur cardinal : `sh.N` est déjà le repli des deux backends pour une part sans ton propre.
 *  `soffite` et `fascia` gardent la leur — ce sont des PARTIES distinctes (dessous débordant, planche de
 *  rive), pas deux orientations d'une même couverture.
 *
 *  Un matériau de toit qui n'a AUCUNE teinte de pente peint au ton d'alarme (#877) : `roofMaterial` a
 *  déjà rendu son repli visible pour un id inconnu, il reste le cas d'une entrée RÉELLE sans `N` — les
 *  teintes de pente sont optionnelles au type (`catalog/roofs/types.ts:18`). Mesuré le 2026-09-02 :
 *  1 entrée sur 4 est dans ce cas (`plan`, qui ne porte que ses teintes de vue du dessus) et AUCUNE
 *  masse de toit des documents du dépôt ne la nomme — la donnée n'est donc pas fautive, mais rien
 *  n'interdit à un auteur de la choisir (`validateScene` admet les 4 ids), et ce jour-là la face se
 *  voit au lieu de prendre la teinte d'un sol. */
function roofColor(id: string, part: string | undefined): string {
  const sh = roofMaterial(id);
  if (part === 'soffite') return sh.soffite ?? sh.N ?? MISSING_TONE;
  if (part === 'fascia') return sh.fascia ?? sh.line ?? sh.N ?? MISSING_TONE;
  return sh.N ?? MISSING_TONE;
}

/** Surface d'une face : ce qu'il faut pour la peindre ET pour la texturer. */
export interface FaceSurface {
  /** Couleur de base (`#rrggbb` ou toute couleur CSS des defs), dans les deux modes. */
  color: string;
  /** Recette de détail portée par la def d'apparence du matériau (absente = surface lisse). */
  recipe?: DetailRecipe;
  /** Identité de la surface par son CONTENU (couleur + recette) : deux faces qui la partagent
   *  partagent leur texture. Un atlas s'y indexe sans dédupliquer lui-même. */
  surfaceKey: string;
  /** Taille MÉTRIQUE d'une période de texture (m). Absente quand la recette n'a pas d'assises : rien
   *  ne se répète, l'UV monde n'a pas d'échelle propre. */
  uvScaleM?: { u: number; v: number };
  /** Réponse à la lumière d'une matière de DÉCOR (`materials.json`, domaine `prop`) : le seul domaine qui l'authore.
   *  Absente ailleurs — les autres surfaces sont lambertiennes, sans rugosité ni métal authorés. */
  pbr?: { roughness: number; metalness: number };
}

/** Recette de détail du matériau d'une face, prise à SA def d'apparence. */
function faceRecipe(face: Face): DetailRecipe | undefined {
  const { domain, id } = face.material;
  switch (domain) {
    case 'structure':
      return structureAppearance(id).detail;
    case 'relief':
      return reliefMaterial(id).detail;
    case 'roof':
      return roofMaterial(id).detail;
    case 'terrain':
      return terrainDef(id).detail;
    case 'prop':
      return undefined;
  }
}

function faceBaseColor(face: Face): string {
  const { domain, id, part } = face.material;
  switch (domain) {
    case 'structure':
      return wallPartColor(structureAppearance(id), part as WallPart);
    case 'relief':
      return reliefColor(id, part);
    case 'roof':
      return roofColor(id, part);
    case 'terrain':
      return terrainDef(id).swatch;
    case 'prop':
      return propMaterial(id).color;
  }
}

/** Période de texture d'une face : celle du SOL pour un terrain (surface continue, période élargie),
 *  celle d'une face d'appareillage sinon (`detail/courses`). */
function faceUvScaleM(face: Face, recipe: DetailRecipe | undefined): { u: number; v: number } | undefined {
  const c = recipe?.courses;
  if (!c) return undefined;
  return face.material.domain === 'terrain' ? groundPeriodM(c) : coursesPeriodM(c);
}

/** Clé d'une surface par son CONTENU : la couleur ET la recette y entrent toutes deux. Deux matériaux
 *  de même teinte mais d'appareillage différent (une pierre lisse et une pierre à assises) ne se
 *  partagent donc PAS une texture — c'est le dessin, pas seulement la teinte, qui fait la surface. */
export function surfaceKeyOf(color: string, recipe?: DetailRecipe): string {
  return `${color}~${recipe ? hash32(JSON.stringify(recipe)).toString(36) : '-'}`;
}

/** Résolution UNIQUE d'une face : sa couleur, sa recette, sa clé de texture, son échelle d'UV. */
export function faceSurface(face: Face): FaceSurface {
  const color = faceBaseColor(face);
  const recipe = faceRecipe(face);
  const mat = face.material.domain === 'prop' ? propMaterial(face.material.id) : undefined;
  return {
    color,
    recipe,
    surfaceKey: surfaceKeyOf(color, recipe),
    uvScaleM: faceUvScaleM(face, recipe),
    ...(mat ? { pbr: { roughness: mat.roughness, metalness: mat.metalness } } : {}),
  };
}

/** Facteur d'irradiance ambiante d'une FAMILLE D'ORIENTATION (`worldTris.ts:shadeFamily`), lu à la
 *  donnée d'ambiance (`AMBIANCE.faceShade`) : la famille est une géométrie, son facteur un catalogue —
 *  d'où sa place ici, avec les autres lectures de catalogue de la face. Une famille indéterminée ne
 *  modèle rien : facteur NEUTRE, jamais un assombrissement par défaut. */
export function shadeFactorOf(f: ShadeFamily | null): number {
  const d = AMBIANCE.faceShade;
  if (f === null) return 1;
  if (f === 'haut') return d.haut;
  if (f === 'bas') return d.bas;
  return d.verticales[SHADE_CYCLE.indexOf(f)];
}

/** Facteur de variance de TEINTE d'une surface à l'identité MONDE de sa case ∈ [1−tintVar, 1+tintVar] :
 *  MÊME tirage que l'affine (`authoring/detailSvg.ts` `terrainFillGradient`) — variante
 *  `hash32('tint', x, y, z) % TINT_SPREAD.length`, facteur `1 + tintVar × TINT_SPREAD[k]`. Les deux
 *  backends tombent donc sur la même nuance pour la même tuile. 1 sans `tintVar` (surface uniforme). */
export function tintVarFactor(recipe: DetailRecipe | undefined, cell: { x: number; y: number; z: number }): number {
  const tv = recipe?.tintVar;
  if (!tv) return 1;
  return 1 + tv * TINT_SPREAD[hash32('tint', cell.x, cell.y, cell.z) % TINT_SPREAD.length];
}
