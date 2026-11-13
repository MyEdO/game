/**
 * LES MATIÈRES DU VOLUME (#3476) : la résolution d'une matière de terrain, de relief, de décor, de couverture ou de mur
 * en sa def, sa couleur de base et sa recette de détail, depuis la donnée (`src/data/terrains.json`, domaines `relief`,
 * `prop` et `roof` de `src/data/materials.json`, `src/data/structureAppearance.json` par `./structures`), avec le repli
 * VISIBLE d'un id absent (`./missing`). Une seule résolution, que lisent le rendu web et tout hôte du noyau.
 */
import { terrainEntree } from '../terrain';
import { matieresDe } from '../../../data';
import { hash32 } from '../../../data/hash';
import type { TerrainDef } from '../../../data/terrains.types';
import type { DetailRecipe, MaterialRef, PropMaterialData, ReliefMaterialDef, RoofMaterialDef } from '../../../data/materials.types';
import type { EntreeVivante } from '../../../data/datasets';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE, MISSING_TONE_DARK } from './missing';
import { facadeStructureAppearance, wallPartColor } from './structures';
import type { WallPart } from '../../../data/structureAppearance.types';

/** Entrée de REPLI VISIBLE (#877) : un terrain au ton d'alarme, jamais l'apparence d'un autre terrain.
 *  `stops` VIDE : le dégradé peint du repli est `MISSING_GRADIENT`, émis par `defsGlobaux()` — une
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
const RELIEF_MANQUANT: EntreeVivante<ReliefMaterialDef> = {
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
export function reliefMaterial(id: string): EntreeVivante<ReliefMaterialDef> {
  return catalogEntry((cle) => matieresDe('relief').find((m) => m.id === cle), id, 'relief', RELIEF_MANQUANT);
}

/** Entrée de REPLI VISIBLE (#877) : une matière de décor au ton d'alarme, jamais l'apparence d'un autre matériau. Sa
 *  réponse à la lumière est NEUTRE (diffus pur, aucun métal) : le repli ne peint pas un vernis ni un bronze qu'aucune
 *  donnée n'a authorés. */
const DECOR_MANQUANT: EntreeVivante<PropMaterialData> = {
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
export function propMaterial(id: string): EntreeVivante<PropMaterialData> {
  return catalogEntry((cle) => matieresDe('prop').find((m) => m.id === cle), id, 'matière de décor', DECOR_MANQUANT);
}

/** Entrée de REPLI VISIBLE (#877) : une couverture au ton d'alarme sur tous ses pans et sur son plan vu
 *  du dessus, jamais l'apparence d'un autre matériau. */
const COUVERTURE_MANQUANTE: EntreeVivante<RoofMaterialDef> = {
  id: MISSING_ID,
  type: 'materials',
  label: MISSING_LABEL,
  domain: 'roof',
  N: MISSING_TONE,
  E: MISSING_TONE,
  S: MISSING_TONE,
  O: MISSING_TONE,
  line: MISSING_TONE_DARK,
  planBody: MISSING_TONE,
  planEdge: MISSING_TONE_DARK,
  planInner: MISSING_TONE_DARK,
  planText: MISSING_TONE,
};

/** Matériau de toit par id ; id absent du registre → repli VISIBLE + avertissement DEV. Résolution
 *  VIVANTE (`matieresDe`) : le document se mute en place à l'édition, un index cuit à l'import servirait
 *  encore l'ancienne couverture. */
export function roofMaterial(id: string): EntreeVivante<RoofMaterialDef> {
  return catalogEntry((cle) => matieresDe('roof').find((m) => m.id === cle), id, 'toiture', COUVERTURE_MANQUANTE);
}

/** ÉPAISSEUR (m) par défaut d'une planche de rive, quand la def n'en porte pas — MÊME calibrage que les
 *  saillies de mur (`wallPartRelief`, table des biais mesurés par scène) : au-dessus du décalage de la
 *  carte d'ombre le plus large des scènes-témoins (0,2118 m à l'opéra), marge comprise. */
export const FASCIA_THICK_M = 0.26;

/** ÉPAISSEUR MONDE (m) de la planche de rive d'une couverture — SOURCE UNIQUE du backend volumique. */
export function roofFasciaThickM(mat: EntreeVivante<RoofMaterialDef>): number {
  return mat.fasciaThickM ?? FASCIA_THICK_M;
}

/** Couleur d'une face de TOITURE. Les PANS partagent tous la teinte de référence `N` du matériau, quel que soit leur
 *  cardinal : c'est la lumière qui creuse les versants. `soffite` et `fascia` gardent la leur — ce sont des PARTIES
 *  distinctes (dessous débordant, planche de rive), pas deux orientations d'une même couverture. Un matériau sans
 *  aucune teinte de pente (les teintes de pente sont optionnelles, `RoofMaterialDef`) peint au ton d'alarme (#877). */
function couleurDeCouverture(id: string, part: string | undefined): string {
  const sh = roofMaterial(id);
  if (part === 'soffite') return sh.soffite ?? sh.N ?? MISSING_TONE;
  if (part === 'fascia') return sh.fascia ?? sh.line ?? sh.N ?? MISSING_TONE;
  return sh.N ?? MISSING_TONE;
}

/** Couleur de base d'une matière : le `swatch` d'un terrain ; la face d'un relief, le dessus de pente d'une rampe qui en
 *  porte un ; la couleur d'un matériau de décor ; la couleur de la partie d'une apparence de mur (`wallPartColor`) ; la
 *  teinte d'une couverture (`couleurDeCouverture`). */
export function couleurDeMatiere({ domain, id, part }: MaterialRef): string {
  switch (domain) {
    case 'terrain': return terrainDef(id).swatch;
    case 'prop': return propMaterial(id).color;
    case 'structure': return wallPartColor(facadeStructureAppearance(id), part as WallPart);
    case 'roof': return couleurDeCouverture(id, part);
    case 'relief': {
      const m = reliefMaterial(id);
      return (part === 'ramp' ? m.slopeTop : undefined) ?? m.face;
    }
  }
}

/** Recette de détail d'une matière, prise à sa def ; un matériau de décor n'en porte aucune. */
export function recetteDeMatiere({ domain, id }: MaterialRef): DetailRecipe | undefined {
  switch (domain) {
    case 'terrain': return terrainDef(id).detail;
    case 'relief': return reliefMaterial(id).detail;
    case 'structure': return facadeStructureAppearance(id).detail;
    case 'roof': return roofMaterial(id).detail;
    case 'prop': return undefined;
  }
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
