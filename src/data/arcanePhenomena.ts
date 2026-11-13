/**
 * Magie ENVIRONNEMENTALE (`arcane-phenomena.json`, `VDM 14` folios 189-207) — TYPES + chargement +
 * lookups. Même patron que `effectTables.ts` : ce module ne porte AUCUNE mécanique (elle vit dans
 * `src/engine/magicEnvironment.ts`) ; régler un phénomène = éditer le JSON, jamais ce fichier.
 */
import arcaneJson from './arcane-phenomena.json';
import { datasetDe, type DatasetDe } from './datasets';
import type * as arcaneDef from './schemas/defs/arcane-phenomena';

/** Le document `arcane-phenomena.json` (VDM 14), au type de son schéma. */
export type ArcaneData = DatasetDe<typeof arcaneDef>;
export type SaturationLevel = ArcaneData['saturationLevels'][number];
export type WindSaturationEffects = ArcaneData['windSaturationEffects'][number];
export type ArcanePhenomenon = ArcaneData['phenomena'][number];
export type ArcaneTable = ArcaneData['tables'][number];
/** Rangée d'une table du chapitre — fourchette `[min,max]` (lookup `findTableEntry`). */
export type ArcaneTableRow = ArcaneTable['entries'][number];
export type PhenomenonTestMod = NonNullable<ArcanePhenomenon['testMods']>[number];
/** Tests qu'un phénomène peut modifier — surensemble de `WindTest` (`engine/domainAttributes.ts`). */
export type PhenomenonTest = PhenomenonTestMod['tests'][number];
export type PhenomenonScope = NonNullable<PhenomenonTestMod['scope']>;
export type SaturationEffect = NonNullable<ArcanePhenomenon['saturation']>;

/** Le document VIVANT, lu ici seul : `data/overrides.ts` l'importe pour le seam. */
export const arcanePhenomenaData = datasetDe<typeof arcaneDef>(arcaneJson);
const DATA = arcanePhenomenaData;

/** Les cinq paliers de Saturation environnementale, dans l'ordre du document — MÊME référence que
 *  `DATA.saturationLevels` : une édition Compendium (`setObjectDataset`, `data/overrides.ts`) mute ce
 *  tableau en place et reste visible sans rechargement de page. */
export const saturationLevels: SaturationLevel[] = DATA.saturationLevels;
/** La rangée d'Effets de Saturation de chaque Vent. */
export const windSaturationEffects: WindSaturationEffects[] = DATA.windSaturationEffects;
/** Tous les phénomènes arcaniques du chapitre. */
export const arcanePhenomena: ArcanePhenomenon[] = DATA.phenomena;
/** Les tables du chapitre (Corruption chaotique/nécromantique, Flux magique). */
export const arcaneTables: ArcaneTable[] = DATA.tables;

// Pas d'index précalculé (Map) : les 4 tableaux ci-dessus sont minuscules (5/8/19/3 entrées) et
// mutés EN PLACE par l'éditeur (`setObjectDataset`) — un `Map` construit une fois au chargement du
// module resterait périmé après une édition Compendium (la donnée disque changerait, l'index non).
// Les lookups relisent donc directement le tableau live à chaque appel.

/** Palier de Saturation par `id` STABLE — `undefined` si la zone n'en déclare aucun. */
export function findSaturationLevelById(id: string | null | undefined): SaturationLevel | undefined {
  return id ? saturationLevels.find((l) => l.id === id) : undefined;
}

/** Phénomène par `id` STABLE — `undefined` si l'id n'est pas au registre. */
export function findArcanePhenomenonById(id: string | null | undefined): ArcanePhenomenon | undefined {
  return id ? arcanePhenomena.find((p) => p.id === id) : undefined;
}

/** Table du chapitre par `id` STABLE — FAIL-FAST (id inconnu = bug de données/authoring). */
export function findArcaneTableById(id: string): ArcaneTable {
  const t = arcaneTables.find((t) => t.id === id);
  if (!t) throw new Error(`findArcaneTableById : table « ${id} » introuvable (arcane-phenomena.json)`);
  return t;
}

/** Effets de Saturation du Vent d'un Domaine — `undefined` pour un Domaine sans Vent (Sorcellerie…). */
export function findWindSaturationEffects(domainId: string | null | undefined): WindSaturationEffects | undefined {
  return domainId ? windSaturationEffects.find((w) => w.domainId.id === domainId) : undefined;
}
