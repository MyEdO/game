/**
 * LECTURES de l'ENJEU d'une clé de dataset sous un catalogue (#5070) : ses catégories d'entrée à pool, le texte que
 * `resolveStake` (`src/data/index.ts`) rendrait et ses trous.
 */
import { collectionDuCatalogue, entreeDe, type Catalogue, type EntreeDuDataset } from './catalogue';
import { CLES_CODEX, DATASET_DE_LA_CATEGORIE, type CleCodex } from '../_cles-de-dataset.generated';
import type { z } from 'zod';
import type { authoredStakeSchema } from '../grammaire/mecanique';
import type * as criticalsDef from '../defs/criticals';
import type * as miscastDef from '../defs/miscast';
import type * as structureCriticalsDef from '../defs/structure-criticals';
import type * as artilleryMisfireDef from '../defs/artillery-misfire';
import type * as crewTestTypesDef from '../defs/crew-test-types';
import type * as tableauDesEvenements from '../defs/interludeEvents';
import type * as shipCriticalsDef from '../defs/ship-criticals';
import type * as riverCriticalsDef from '../defs/river-criticals';

/** CASCADE d'un enjeu de `stakes.json` : la famille de jets qu'il sert — ses valeurs sont celles de
 *  `StakeKey.dataset` (`schemas/defs/stakes.ts`). */
export type StakeCascade = 'nuit' | 'voyage' | 'flux' | 'combat';

/** DATASET d'enjeux servant une famille de jets (#1117). Union FERMÉE : une cascade de plus est une
 *  valeur de `StakeCascade` et ses entrées dans `stakes.json` ; les trois autres familles portent leur
 *  enjeu sur l'ENTITÉ (météo, Activité, État) et ont chacune leur branche dans `texteDeLEnjeu`. */
export type StakeDataset = StakeCascade | 'meteo' | 'activite' | 'etat';

/** CLÉ d'enjeu — la coordonnée de la DONNÉE, jamais son texte. `entryId` fait DESCENDRE la résolution
 *  à l'ENTRÉE jouée quand elle existe (le symptôme d'une étape de maladie, la psychologie affrontée)
 *  ; sans lui, la résolution reste au `kind`. C'est la clé
 *  `{dataset, kind, entryId?}` du design #1117 — le repli sur `kind` est déclaré, jamais silencieux.
 *
 *  `entryCategory` couvre le cas UN KIND → N CATÉGORIES, que la déclaration statique du dataset ne
 *  peut pas trancher : une Blessure critique se joue sur la table de SA localisation
 *  (`criticalsTete`/`Bras`/`Corps`/`Jambe`), connue seulement au tirage. Le producteur la fournit
 *  alors avec l'`entryId` ; le catalogue déclaratif reste la SOURCE par défaut (le dynamique ne
 *  s'applique qu'aux kinds qui n'en déclarent aucune). */
export interface StakeKey {
  dataset: StakeDataset;
  /** L'id de l'entrée dans son dataset : l'enjeu d'une cascade, la météo, l'Activité, l'État. */
  kind: string;
  entryId?: string;
  entryCategory?: string;
}

/** CLÉ d'enjeu qu'un DOCUMENT vise (`catalogStakeSchema`) : la récupération d'un État n'en est pas une. */
export type CleDEnjeuSaisie = StakeKey & { dataset: Exclude<StakeDataset, 'etat'> };

/** Catégories d'entrée à pool NOMMÉES une à une : le pool de chacune est une ligne de `STAKE_ENTRY_POOLS`
 *  (`src/data/index.ts`). */
const CATEGORIES_NOMMEES_A_POOL = [
  'symptoms', 'seaShanties', 'maladies', 'psychologies', 'maneuvers', 'spells', 'mutations', 'mutationTables',
  'tavernGames', 'talents', 'traits', 'trappings', 'qualities', 'etats', 'creatures', 'regles', 'activities', 'skills',
] as const satisfies readonly CleCodex[];

export type CategorieNommeeAPool = (typeof CATEGORIES_NOMMEES_A_POOL)[number];

/** Fichiers à TABLES TIRÉES dont CHAQUE catégorie Codex (`DATASET_DE_LA_CATEGORIE`) est un pool d'entrées : le nom
 *  est lié par le type au `file` de son def (#3923). */
const FICHIERS_DES_TABLES_TIREES: readonly string[] = [
  'criticals.json' satisfies typeof criticalsDef.file,
  'miscast.json' satisfies typeof miscastDef.file,
  'structure-criticals.json' satisfies typeof structureCriticalsDef.file,
  'artillery-misfire.json' satisfies typeof artilleryMisfireDef.file,
  'crew-test-types.json' satisfies typeof crewTestTypesDef.file,
  'interludeEvents.json' satisfies typeof tableauDesEvenements.file,
  'ship-criticals.json' satisfies typeof shipCriticalsDef.file,
  'river-criticals.json' satisfies typeof riverCriticalsDef.file,
];

/** Catégories à pool d'un fichier dont les autres catégories n'en sont pas (`sea-events.json` : `seaFastVoyage`,
 *  `seaManannFactors`), liées par le type aux clés Codex (#3923). */
const CATEGORIES_DES_TABLES_TIREES: readonly CleCodex[] = ['seaBoardEvents', 'seaPortEvents'];

/** Catégories à pool des TABLES TIRÉES : leurs entrées sont les lignes de la table. */
export const CATEGORIES_A_POOL_DES_TABLES_TIREES: ReadonlySet<string> = new Set(CLES_CODEX.filter((c) =>
  (c in DATASET_DE_LA_CATEGORIE && FICHIERS_DES_TABLES_TIREES.includes(DATASET_DE_LA_CATEGORIE[c].fichier)) || CATEGORIES_DES_TABLES_TIREES.includes(c)));

const NOMMEES: ReadonlySet<string> = new Set(CATEGORIES_NOMMEES_A_POOL);

export const estCategorieNommeeAPool = (categorie: string): categorie is CategorieNommeeAPool => NOMMEES.has(categorie);

/** La catégorie d'entrée `categorie` a-t-elle un pool ? */
export const categorieAPool = (categorie: string): boolean =>
  estCategorieNommeeAPool(categorie) || CATEGORIES_A_POOL_DES_TABLES_TIREES.has(categorie);

/** Les `kind` de la famille MALADIE : chacun joue un SYMPTÔME nommé. */
const KINDS_A_SYMPTOME: readonly string[] = ['maladie-test-quotidien', 'maladie-gangrene', 'maladie-persistance'];

/** Catégorie de l'ENTRÉE jouée d'une clé : celle que déclare l'enjeu `kind` de `stakes` (toutes cascades
 *  confondues), sinon celle de la famille maladie, sinon `key.entryCategory` s'il a un pool. */
export function categorieDeLEntreeDeLEnjeu(key: StakeKey, cat: Catalogue): string | undefined {
  let declaree: string | undefined;
  for (const e of collectionDuCatalogue('stakes', cat)) if (e.id === key.kind && e.entryCategory) declaree = e.entryCategory;
  if (declaree) return declaree;
  if (KINDS_A_SYMPTOME.includes(key.kind)) return 'symptoms';
  return key.entryCategory !== undefined && categorieAPool(key.entryCategory) ? key.entryCategory : undefined;
}

/** Texte porté par l'ENTRÉE jouée, par catégorie : patron `ActivityDef.stake`. */
function texteDeLEntree(key: StakeKey, cat: Catalogue): string | undefined {
  if (!key.entryId) return undefined;
  switch (categorieDeLEntreeDeLEnjeu(key, cat)) {
    case 'psychologies': return entreeDe('psychologies', key.entryId, cat)?.stake;
    case 'maneuvers': return entreeDe('maneuvers', key.entryId, cat)?.stake;
    default: return undefined;
  }
}

/** Le foyer de règle qu'une entrée d'enjeu déclare (`rule`). */
type FoyerDeclare = EntreeDuDataset<'stakes'>['rule'] | EntreeDuDataset<'activities'>['rule'];

/** L'ENTRÉE d'enjeu de la clé sous `cat` : le texte qu'elle rend et le foyer qu'elle déclare ; `undefined` quand la
 *  clé ne nomme aucune entrée d'enjeu. */
export function texteDeLEnjeu(key: StakeKey, cat: Catalogue): { texte?: string; foyer?: FoyerDeclare } | undefined {
  if (key.dataset === 'meteo') {
    const enjeu = entreeDe('weatherConditions', key.kind, cat)?.resistanceTest?.enjeu;
    return enjeu ? { texte: enjeu } : undefined;
  }
  if (key.dataset === 'etat') {
    const recover = entreeDe('etats', key.kind, cat)?.recover;
    return recover ? { texte: recover.enjeu } : undefined;
  }
  if (key.dataset === 'activite') {
    const e = entreeDe('activities', key.kind, cat);
    return e?.stake ? { texte: e.stake, ...(e.rule ? { foyer: e.rule } : {}) } : undefined;
  }
  const e = collectionDuCatalogue('stakes', cat).find((x) => x.cascade === key.dataset && x.id === key.kind);
  if (!e) return undefined;
  const texte = texteDeLEntree(key, cat) ?? e.template;
  return { ...(texte ? { texte } : {}), ...(e.rule ? { foyer: e.rule } : {}) };
}

/** Un TROU du gabarit d'enjeu : `{nom}`, rempli par la valeur que le flux calcule (`CatalogStake.values`). */
export const TROU_D_ENJEU = /\{(\w+)\}/g;

/** Les TROUS du texte d'enjeu de la clé sous `cat` ; `undefined` quand la clé ne nomme aucune entrée d'enjeu. */
export function trousDeLEnjeu(key: CleDEnjeuSaisie, cat: Catalogue): string[] | undefined {
  const lu = texteDeLEnjeu(key, cat);
  return lu && [...(lu.texte ?? '').matchAll(TROU_D_ENJEU)].map((m) => m[1]);
}

/** L'enjeu authoré ou de catalogue parle-t-il ? Critère de `stakeSpeaks` (`src/data/index.ts`) hors enjeu dérivé. #1117 */
export function enjeuParle(stake: z.output<typeof authoredStakeSchema> | { readonly key: StakeKey } | undefined): boolean {
  if (!stake) return false;
  return 'authored' in stake ? !!stake.authored.trim() : true;
}
