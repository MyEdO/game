/**
 * LES MATIÈRES DU VOLUME (#3476) : la résolution d'une matière de terrain, de relief ou de décor en sa def, sa couleur
 * de base et sa recette de détail, depuis la donnée (`src/data/terrains.json`, domaines `relief` et `prop` de
 * `src/data/materials.json`), avec le repli VISIBLE d'un id absent (`./missing`). Une seule résolution, que lisent le
 * rendu web et tout hôte du noyau.
 */
import { terrainEntree } from '../terrain';
import { matieresDe } from '../../../data';
import { hash32 } from '../../../data/hash';
import type { TerrainDef } from '../../../data/terrains.types';
import type { DetailRecipe, MaterialRef, PropMaterialData, ReliefMaterialDef } from '../../../data/materials.types';
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

/** Entrée de REPLI VISIBLE (#877) : une matière de décor au ton d'alarme, jamais l'apparence d'un autre matériau. Sa
 *  réponse à la lumière est NEUTRE (diffus pur, aucun métal) : le repli ne peint pas un vernis ni un bronze qu'aucune
 *  donnée n'a authorés. */
const DECOR_MANQUANT: PropMaterialData = {
  id: MISSING_ID,
  type: 'materials',
  label: MISSING_LABEL,
  domain: 'prop',
  color: MISSING_TONE,
  roughness: 1,
  metalness: 0,
};

/** Matériau de décor par id ; id absent du registre → repli VISIBLE + avertissement DEV. Résolution VIVANTE
 *  (`matieresDe`), comme `reliefMaterial`. */
export function propMaterial(id: string): PropMaterialData {
  return catalogEntry((cle) => matieresDe('prop').find((m) => m.id === cle), id, 'matière de décor', DECOR_MANQUANT);
}

/** Une matière du VOLUME : celles que ses builders posent sur leurs faces, le sol (`./floors`) et le décor
 *  (`./propVolumes`). */
export type MatiereDuVolume = MaterialRef & { domain: 'terrain' | 'relief' | 'prop' };

/** Couleur de base d'une matière du volume : le `swatch` d'un terrain ; la face d'un relief, le dessus de pente d'une
 *  rampe qui en porte un ; la couleur d'un matériau de décor. */
export function couleurDeMatiere({ domain, id, part }: MatiereDuVolume): string {
  if (domain === 'terrain') return terrainDef(id).swatch;
  if (domain === 'prop') return propMaterial(id).color;
  const m = reliefMaterial(id);
  return (part === 'ramp' ? m.slopeTop : undefined) ?? m.face;
}

/** Recette de détail d'une matière du volume, prise à sa def ; un matériau de décor n'en porte aucune. */
export function recetteDeMatiere({ domain, id }: MatiereDuVolume): DetailRecipe | undefined {
  if (domain === 'terrain') return terrainDef(id).detail;
  return domain === 'relief' ? reliefMaterial(id).detail : undefined;
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
