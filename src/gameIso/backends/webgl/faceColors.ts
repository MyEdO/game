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
import { couleurDeMatiere, propMaterial, recetteDeMatiere } from '../../../noyau/monde/volume/matieres';
import { coursesPeriodM, groundPeriodM } from '../../detail/courses';
import { hash32 } from '../../../data/hash';
import type { DetailRecipe } from '../../../data/materials.types';
import type { Face } from '../../../noyau/monde/volume/types';
import { SHADE_CYCLE, type ShadeFamily } from '../../../noyau/monde/volume/worldTris';

/** Modes de rendu d'une face — deux MATÉRIAUX du renderer, une seule couleur de base (`faceSurface`). */
export type ColorMode = 'unlit' | 'lit';

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
  const color = couleurDeMatiere(face.material);
  const recipe = recetteDeMatiere(face.material);
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
