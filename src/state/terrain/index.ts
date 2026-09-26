/**
 * TERRAINS — façade de lecture du dataset `src/data/terrains.json` (#1690). Ajouter un terrain =
 * ajouter une entrée au dataset ; plus aucun module TS ne déclare de sol.
 *
 * C'est le SEAM unique : la walkability, le raccord d'arêtes, la Ligne de Vue, les builders de rendu
 * et l'éditeur passent tous par les accesseurs ci-dessous, jamais par le tableau brut.
 *
 * LECTURE VIVE, index O(1). Le tableau exporté par `src/data/index.ts` est le binding que
 * `setDataset` mute EN PLACE (`data/overrides.ts` : `arr.splice(0, arr.length, …)`) — son IDENTITÉ ne
 * change donc jamais, et `memoByRef` (`state/sceneMemo.ts`, mémo par identité de référence) y serait
 * un cache qui ne s'invalide pas : ce patron-là suppose qu'une mutation rende une NOUVELLE réf, ce
 * que la couche donnée ne fait pas. Le témoin est la VERSION du dataset, posée par le seam d'écriture
 * lui-même (`memoParVersion`, `data/versionDataset.ts`, #1692) : une lecture y coûte seulement une
 * comparaison d'entiers, là où le témoin de CONTENU rebalayait les 25 entrées à chaque accès — et
 * `tileBlocksSight` en pose un par PAS DE RAYON.
 */
import { terrains } from '../../data/index';
import { memoParVersion } from '../../data/versionDataset';
import type { TerrainDef } from '../../data/terrains.types';
import type { Terrain } from '../scene';

export type { TerrainDef } from '../../data/terrains.types';

const indexVif = memoParVersion('terrains', () =>
  Object.fromEntries(terrains.map((t) => [t.id, t])) as Readonly<Record<string, TerrainDef>>,
);

/** Le dataset indexé par id — reconstruit à la première lecture qui suit une écriture au seam. */
export function indexDesTerrains(): Readonly<Record<string, TerrainDef>> {
  return indexVif();
}

/** Les entrées du dataset, dans l'ordre authoré (palette de l'éditeur, audits de plan). */
export function tousLesTerrains(): readonly TerrainDef[] {
  return terrains;
}

/** Ids du dataset, dans l'ordre authoré. */
export function terrainIds(): string[] {
  return terrains.map((t) => t.id);
}

/** L'entrée d'un id, ou `undefined` — le seul accès brut, pour un appelant qui porte son propre repli. */
export function terrainEntree(id: string): TerrainDef | undefined {
  return indexDesTerrains()[id];
}

/** Nom d'auteur du terrain, ou `undefined` — l'appelant AFFICHE l'id brut à défaut. */
export function terrainLabel(id: string): string | undefined {
  return indexDesTerrains()[id]?.label;
}

export function terrainWalkable(id: string): boolean {
  return indexDesTerrains()[id]?.walkable ?? false;
}
export function terrainPriority(id: string): number {
  return indexDesTerrains()[id]?.priority ?? 0;
}
/** Le terrain coupe la Ligne de Vue (`lineOfSightCover`, brouillard de vision). */
export function terrainOpaque(id: string): boolean {
  return indexDesTerrains()[id]?.opaque === true;
}
/** Surface BÂTIE : construction qui PORTE l'étage posé dessus. */
export function terrainBuilt(id: string): boolean {
  return indexDesTerrains()[id]?.built === true;
}
/**
 * LES DEUX RÔLES ADRESSÉS (#1789) — le moteur ne récite aucun id : il demande au dataset QUI tient le
 * rôle. `absence` = la non-tuile (ce qu'une couche porte là où rien n'est bâti) ; `bordDuMonde` = ce
 * que la grille rend au-delà de ses bornes. Le schéma (`defs/terrains.ts`, `affinerDataset`) exige
 * qu'EXACTEMENT une entrée porte chacun : le porteur est donc une FONCTION du dataset, vive comme
 * l'index, et l'absence de porteur est un dataset ROMPU, pas un cas à replier en silence.
 */
function porteurDuRole(role: 'absence' | 'bordDuMonde'): Terrain {
  const porteurs = terrains.filter((t) => t[role] === true);
  if (porteurs.length !== 1)
    throw new Error(
      `terrains : le rôle « ${role} » est porté par ${porteurs.length} entrée(s) (${porteurs.map((t) => t.id).join(', ') || 'aucune'}) — il en faut EXACTEMENT une`,
    );
  return porteurs[0].id;
}

const absenceVive = memoParVersion('terrains', () => porteurDuRole('absence'));
const horsGrilleVif = memoParVersion('terrains', () => porteurDuRole('bordDuMonde'));

/** Le terrain qui EST l'absence de tuile — ce qu'une couche porte là où rien n'est bâti. */
export function terrainAbsent(): Terrain {
  return absenceVive();
}

/** Ce terrain est-il l'absence de tuile ? Un id INCONNU n'est pas une absence : c'est un id inconnu. */
export function estAbsent(id: string): boolean {
  return indexDesTerrains()[id]?.absence === true;
}

/** Le terrain que la grille rend AU-DELÀ de ses bornes (`tileAt` hors grille) — ses propriétés font
 *  la Ligne de Vue, le raccord d'arêtes et les piliers au bord du monde. */
export function terrainHorsGrille(): Terrain {
  return horsGrilleVif();
}

/**
 * TERRAINS ÉLECTIFS (#1789) — ceux qu'un AUTEUR peut élire comme terrain de référence d'une op
 * (`offTerrainMod` : « la créature se meut dans un élément que le marcheur ne foule pas »). Un porteur
 * de RÔLE n'en est pas : l'absence de tuile n'est pas un élément où l'on nage, et le bord du monde
 * n'est pas un lieu. Le filtre se dérive des DRAPEAUX du dataset, jamais d'une liste d'ids récitée :
 * un rôle déposé demain sur une autre entrée la retire de la palette le jour même.
 */
const electifsVifs = memoParVersion('terrains', () =>
  terrains.filter((t) => t.absence !== true && t.bordDuMonde !== true),
);

/** Les terrains ÉLECTIBLES par un auteur — le dataset MOINS les porteurs de rôle, ordre authoré. */
export function terrainsElectifs(): readonly TerrainDef[] {
  return electifsVifs();
}

/**
 * GLYPHE D'AUTHORING (#1789) — le caractère qui pose ce terrain dans une carte ASCII. C'est une
 * DONNÉE de l'entrée (`terrains.json › ascii`, unique et hors grammaire du plan, tenu au parse) : la
 * légende de base d'un plan se DÉRIVE du dataset au lieu d'être récitée par le lecteur, et un terrain
 * déposé demain au Codex avec son glyphe s'écrit dans les plans le jour même.
 */
const glyphesVifs = memoParVersion('terrains', () =>
  Object.fromEntries(
    terrains.filter((t) => typeof t.ascii === 'string').map((t) => [t.ascii as string, t.id]),
  ) as Readonly<Record<string, Terrain>>,
);

/** Le glyphe d'authoring d'un terrain, ou `undefined` — tous n'en portent pas. */
export function glypheDe(id: string): string | undefined {
  return indexDesTerrains()[id]?.ascii;
}

/** La LÉGENDE DE BASE de toute carte ASCII : glyphe déclaré → id de terrain, index vif. Une `legend`
 *  de scène se pose PAR-DESSUS (elle surcharge, elle ne remplace pas). */
export function terrainsAvecGlyphe(): Readonly<Record<string, Terrain>> {
  return glyphesVifs();
}

/** Décor billboard posé sur chaque tuile du terrain (id de `props.json`), ou undefined. */
export function terrainOverlayProp(id: string): string | undefined {
  return indexDesTerrains()[id]?.overlayProp;
}
/** Hauteur (m) du BLOC PLEIN d'un terrain (rendu seulement — s'ajoute à `heightAt` pour l'AFFICHAGE), 0 sinon. */
export function terrainSolidHeightM(id: string): number {
  return indexDesTerrains()[id]?.solidHeightM ?? 0;
}
/** MATIÈRE des faces verticales du BLOC PLEIN d'un terrain (#1691) — id de `materials.json` domaine
 *  `relief`, lu par `gameIso/builders/floors.ts`. `undefined` sur un terrain sans bloc plein : le
 *  schéma exige le champ si et seulement si `solidHeightM` est posée, l'appelant n'a donc à le
 *  demander que pour un bloc. */
export function terrainMatiere(id: string): string | undefined {
  return indexDesTerrains()[id]?.matiere;
}
/** Recette de détail d'un terrain, RESTREINTE aux sections d'ACCENT (touffes, mouchetis) — `null`
 *  quand l'entrée n'en porte aucune. Deux consommateurs la lisent : l'affine (`authoring/floorsSvg.ts`)
 *  et le volumique (`groundAccents.ts`) ; le POV lit la recette NON restreinte en direct monde
 *  volumique. Elle vit avec le dataset qu'elle interroge, au même titre que `terrainOverlayProp`.
 *
 *  Type par ACCÈS INDEXÉ sur `TerrainDef`, déjà importé ici : `DetailRecipe` vit dans
 *  `gameIso/detail/types.ts`, et la police de pureté state→gameIso (#161) ne refuse plus, depuis
 *  #1709, qu'une arête d'EXÉCUTION — un `import type` serait donc licite ; l'accès indexé économise
 *  seulement un second import. */
export function terrainDetail(id: string): NonNullable<TerrainDef['detail']> | null {
  const d = indexDesTerrains()[id]?.detail;
  return d && (d.tufts || d.speckle) ? d : null;
}
