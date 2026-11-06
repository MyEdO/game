/**
 * LES MATIÈRES DU SOL (#3476) : la résolution d'une matière de terrain ou de relief en sa def, sa couleur de base et sa
 * recette de détail, depuis la donnée (`src/data/terrains.json`, domaine `relief` de `src/data/materials.json`), avec
 * le repli VISIBLE d'un id absent (`./missing`). Une seule résolution, que lisent le rendu web et tout hôte du noyau.
 */
import { terrainEntree } from '../terrain';
import { matieresDe } from '../../../data';
import { hash32 } from '../../../data/hash';
import type { TerrainDef } from '../../../data/terrains.types';
import type { DetailRecipe, MaterialRef, ReliefMaterialDef } from '../../../data/materials.types';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE, MISSING_TONE_DARK } from './missing';

/** Entrée de REPLI VISIBLE (#877) : un terrain au ton d'alarme, jamais l'apparence d'un autre terrain.
 *  `stops` VIDE : le dégradé peint du repli est `MISSING_GRADIENT`, émis par `defsGlobaux()` (`gameIso/sprites`) — une
 *  rampe recopiée ici en serait une seconde définition. Infranchissable et de priorité nulle : le repli ne déborde sur
 *  aucun voisin et n'ouvre aucun passage que la donnée n'a pas authorisé. */
const TERRAIN_MANQUANT: TerrainDef = {
  id: MISSING_ID,
  type: 'terrains',
  label: MISSING_LABEL,
  maison: 'entrée de REPLI VISIBLE du catalogue de rendu — hors dataset, aucune donnée ne la référence',
  walkable: false,
  priority: 0,
  swatch: MISSING_TONE,
  stops: {},
};

/** Terrain par id ; id absent du dataset → repli VISIBLE + avertissement DEV. Le seul accès du rendu
 *  au dataset : `swatch`, `detail` et `gradient` en sortent tous, donc du MÊME repli. */
export function terrainDef(id: string): TerrainDef {
  return catalogEntry(terrainEntree, id, 'terrain', TERRAIN_MANQUANT);
}

/** Entrée de REPLI VISIBLE (#877) : un relief au ton d'alarme, jamais l'apparence d'un autre matériau. */
const RELIEF_MANQUANT: ReliefMaterialDef = {
  id: MISSING_ID,
  type: 'materials',
  label: MISSING_LABEL,
  domain: 'relief',
  face: MISSING_TONE,
  foot: MISSING_TONE_DARK,
  slopeTop: MISSING_TONE,
  shadeDark: 1,
};

/** Matériau de relief par id ; id absent du registre → repli VISIBLE + avertissement DEV. Résolution
 *  VIVANTE (`matieresDe`) : le document se mute en place à l'édition, un index cuit à l'import servirait
 *  encore l'ancien relief. */
export function reliefMaterial(id: string): ReliefMaterialDef {
  return catalogEntry((cle) => matieresDe('relief').find((m) => m.id === cle), id, 'relief', RELIEF_MANQUANT);
}

/** Une matière du SOL : celles que le builder de sols (`./floors`) pose sur ses faces. */
export type MatiereDuSol = MaterialRef & { domain: 'terrain' | 'relief' };

/** Couleur de base d'une matière du sol : le `swatch` d'un terrain ; la face d'un relief, le dessus de pente d'une rampe
 *  qui en porte un. */
export function couleurDuSol({ domain, id, part }: MatiereDuSol): string {
  if (domain === 'terrain') return terrainDef(id).swatch;
  const m = reliefMaterial(id);
  return (part === 'ramp' ? m.slopeTop : undefined) ?? m.face;
}

/** Recette de détail d'une matière du sol, prise à sa def. */
export function recetteDuSol({ domain, id }: MatiereDuSol): DetailRecipe | undefined {
  return domain === 'terrain' ? terrainDef(id).detail : reliefMaterial(id).detail;
}

/** Variantes de variance de TEINTE par case (facteurs d'étalement du `tintVar` d'une recette) — dosage
 *  PARTAGÉ par tous les rendus : dégradés de terrain de l'affine, couleur de sommet du WebGL, volume du monde des hôtes.
 *  La variante se choisit au hash de l'identité MONDE de la case, jamais stockée. */
export const TINT_SPREAD = [-1, -0.4, 0.35, 1];

/** Facteur de variance de TEINTE d'une surface à l'identité MONDE de sa case ∈ [1−tintVar, 1+tintVar] :
 *  variante `hash32('tint', x, y, z) % TINT_SPREAD.length`, facteur `1 + tintVar × TINT_SPREAD[k]` — la même nuance
 *  pour la même tuile dans tous les rendus. 1 sans `tintVar` (surface uniforme). */
export function tintVarFactor(recipe: DetailRecipe | undefined, cell: { x: number; y: number; z: number }): number {
  const tv = recipe?.tintVar;
  if (!tv) return 1;
  return 1 + tv * TINT_SPREAD[hash32('tint', cell.x, cell.y, cell.z) % TINT_SPREAD.length];
}
