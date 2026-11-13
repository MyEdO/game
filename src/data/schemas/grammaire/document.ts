/**
 * FABRIQUE DE DOCUMENT (#1466 L1a) — la seule façon de déclarer un document de l'application.
 *
 * Elle rend un HANDLE FERMÉ : le schéma sort SCELLÉ, si bien que `.extend` et `.shape` n'existent
 * plus NI au type NI au runtime (zod 4.4.3 perd le registre et la `.meta()` d'un nœud à l'extension —
 * la composition se fait ICI, une fois, ou pas du tout). Une clé d'ENVELOPPE redéclarée dans `champs`
 * est une erreur de TYPE (mapped type → `never`) ET une erreur d'exécution nommant la clé ; chaque
 * clé de `champs` exige sa `MetaChamp` ; chaque document déclare son EXPOSITION (Codex, éditeur).
 *
 * L'adoption par les defs est #1467 ; son compte se MESURE : c'est le mesureur de `grammaire.test.ts`
 * (« contrats d'enveloppe REQUIS dans les defs `entite` ») qui l'établit.
 */
import { tableTotale } from '../../../lib/tableTotale';
import { z } from 'zod';
import { deDeTirageSchema, idDIconeSchema, maisonSchema, sourceRefSchema, secondarySourceRefSchema, variantOf, type GenreDeFragment } from './valeurs';
import { defDe, descendre, enfantsDe, ouverts, pasDeDonnee } from './descente';
import { noyauEnum, nommerChamps, metaDesChamps, type MetaChamp, type MetaDesChamps } from './meta';
import { exigeSource } from './sans-livre';
import { marquerProduit } from './interne/produits';
import { champsProse, refineAdapteDe, refineProse, type PorteurDeProse } from './prose';
import { marquerCollection, marqueDeListe, marqueDeRecord, refusDeCharge, type EspaceDeNoms } from './collection-cle';
import { estObjet } from '../../../lib/objet.mjs';

/** Les 3 EMBALLAGES de fichier d'un document : liste d'entrées, entrée seule, record clé → valeur.
 *  La CHARGE d'un document (ses rangées, `options.rangee`) est orthogonale à son emballage. */
export type FamilleDocument = 'entite' | 'config' | 'record';

/** Clés de l'ENVELOPPE — posées par la fabrique, jamais par un def. */
export const CLES_ENVELOPPE = ['id', 'type', 'label', 'labelF', 'desc', 'descRef', 'source', 'alsoIn', 'variants', 'maison', 'icon'] as const;
export type CleEnveloppe = (typeof CLES_ENVELOPPE)[number];

/**
 * Libellés FR des clés d'ENVELOPPE (#1466). `document()` REFUSE une `MetaChamp` sur une
 * clé d'enveloppe (la fabrique la pose, aucun def ne la déclare) : leur nom lisible appartient donc à
 * la FABRIQUE, ici. Consommé par la cascade de libellés de l'atelier (`src/noyau/codex/editFields.ts`).
 */
export const LIBELLES_ENVELOPPE: Readonly<Record<CleEnveloppe, string>> = {
  id: 'Identifiant',
  type: 'Type de document',
  label: 'Libellé',
  labelF: 'Libellé (forme féminine)',
  desc: 'Description',
  descRef: 'Adresse de la prose (livre)',
  source: 'Source',
  alsoIn: 'Aussi publié dans',
  variants: 'Variantes',
  maison: 'Arbitrage maison',
  icon: 'Icône',
};

/** Clés de CHARGE que la fabrique pose : `entries` (le contenu du document) et, sur un document à
 *  `options.rangee`, le `die?` de son tirage. */
export type CleCharge = 'entries' | 'die';

/**
 * Méta FR des clés de CHARGE (même régime que `LIBELLES_ENVELOPPE`) : la fabrique les pose, aucun def
 * ne les déclare, leur nom lisible vit donc ICI — un libellé par clé, pour tous les documents.
 * Le handle les publie dans sa `meta`, où la cascade de l'atelier les lit
 * (`src/noyau/codex/editFields.ts::libelleDuChamp`).
 */
export const META_CHARGE: Readonly<Record<CleCharge, MetaChamp>> = {
  entries: { label: 'Rangées', hint: 'Contenu du document, dans l’ordre authoré' },
  die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer une rangée (ex. « 1d10 », « d100 »)' },
};

/**
 * TABLE TIRÉE nichée dans un document : la charge d'un document à rangées tiré au dé
 * (`options.rangee` + `options.deDeTirage`), posée sous un champ — son dé `die` (`deDeTirageSchema`) et
 * ses rangées `entries` (au moins une), nommés par `META_CHARGE`. L'`enveloppe` apporte les champs propres à la table
 * (`weather.json › seasons[]` : `id`, `label`, `source`), chacun avec sa méta.
 */
export function tableTiree<R extends z.ZodType, E extends z.ZodRawShape = Record<never, never>>(rangee: R, enveloppe?: { champs: E; meta: MetaDesChamps<E> }) {
  const champs = enveloppe?.champs ?? ({} as E);
  const meta = { ...enveloppe?.meta, ...META_CHARGE } as MetaDesChamps<E & Record<CleCharge, z.ZodType>>;
  return marquerProduit(nommerChamps(z.strictObject({ ...champs, die: deDeTirageSchema, entries: rangeesDeCharge(z.array(rangee).min(1)) }), meta), 'tableTiree', 'table', champs);
}

/**
 * SOUS-TIRAGE nommé d'un document : le dé seul (`die`, `deDeTirageSchema`), posé sous une clé du concept
 * quand il ne tire pas de rangées propres (`stars.json › sub`, `peripeties.json › tirageQuotidien`). Lu par
 * `deDeLaTableTiree` (`src/engine/tables.ts`). #1667
 */
export const sousTirage = nommerChamps(z.strictObject({ die: deDeTirageSchema }), {
  die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour ce sous-tirage (ex. « d10 »)' },
});

/** Les RANGÉES d'une charge (`entries`), collection à clé `id` quand la rangée en déclare un, sous l'`espace` de
 *  noms que le document leur ouvre. */
function rangeesDeCharge<R extends z.ZodType>(rangees: z.ZodArray<R>, espace?: EspaceDeNoms): z.ZodArray<R> {
  return pasDeDonnee(ouverts([rangees.element]), 'id').length ? marquerCollection(rangees, marqueDeListe<{ id: string }>('id', espace)) : rangees;
}

/** Clés d'enveloppe qu'un document ne peut pas EXIGER : `id`/`type`/`label` sont déjà requises,
 *  `variants` n'est pas un champ simple (la fabrique le compose depuis `options.variantes`), et
 *  `descRef` n'est pas un porteur exigible — l'exigence de PROSE se dit `exiges: ['desc']` et
 *  s'énonce sur le texte, jamais sur l'un de ses deux porteurs (`grammaire/prose.ts`, V4). */
const NON_EXIGIBLES = ['id', 'type', 'label', 'variants', 'descRef'] as const;

/** POURQUOI chacune ne l'est pas — par CLÉ : les trois raisons sont différentes, et un message unique
 *  en dirait une fausse pour deux d'entre elles (`variants` n'est pas requise, `descRef` non plus). */
const RAISON_NON_EXIGIBLE: Readonly<Record<(typeof NON_EXIGIBLES)[number], string>> = {
  id: "l'enveloppe la pose déjà requise",
  type: "l'enveloppe la pose déjà requise",
  label: "l'enveloppe la pose déjà requise",
  variants: 'ce n’est pas un champ simple — la fabrique le compose depuis `options.variantes`',
  descRef: "l'exigence de PROSE se dit `exiges: ['desc']` — jamais sur un porteur (`descRef`)",
};

/**
 * Clés d'enveloppe qu'un document peut EXIGER (`options.exiges`) — DÉRIVÉES de `CLES_ENVELOPPE`,
 * jamais re-tapées : une liste parallèle mentirait en silence au prochain champ d'enveloppe.
 */
export type CleExigible = Exclude<CleEnveloppe, (typeof NON_EXIGIBLES)[number]>;
export const CLES_EXIGIBLES: readonly CleExigible[] = CLES_ENVELOPPE.filter(
  (k): k is CleExigible => !(NON_EXIGIBLES as readonly string[]).includes(k),
);

/** Une clé d'enveloppe présente dans `champs` s'annule en `never` : le def ne compile pas. */
export type ChampsHorsEnveloppe<C> = { [K in keyof C]: K extends CleEnveloppe ? never : C[K] };

/**
 * Vue TS de l'ENVELOPPE que la fabrique pose (`enveloppe()` ci-dessous), `type` élargi à `string`,
 * toutes clés exigibles optionnelles : la vue PARTAGÉE par tous les documents. Le dataset d'UN
 * document a, lui, son type exact au handle (`DatasetDuDocument`), que lit la porte `datasetDe`
 * (`src/data/datasets.ts`).
 */
export type EnveloppeDocument = Omit<z.infer<z.ZodObject<ReturnType<typeof enveloppe>>>, 'type'> & { type: string };

/**
 * L'enveloppe d'UN document au type : `type` = son littéral, `id` = la sortie de `options.idDocument`,
 * et les clés de `options.exiges` requises — sauf `desc`, dont l'exigence porte sur la PROSE (`desc`
 * OU `descRef`, refine V4 de `grammaire/prose.ts`), jamais sur l'un des deux porteurs.
 */
type EnveloppeDuDocument<T extends string, O extends OptionsDocument> = Omit<EnveloppeDocument, 'type' | 'id' | ExigeesAuType<O>> & {
  type: T;
  id: O extends { readonly idDocument: z.ZodType<infer I> } ? I : string;
} & Required<Pick<EnveloppeDocument, ExigeesAuType<O>>>;
type ExigeesAuType<O extends OptionsDocument> = O extends { readonly exiges: readonly (infer K extends CleExigible)[] } ? Exclude<K, 'desc'> : never;

/** La CHARGE que la fabrique pose (`entries`, `die`), au type de `options.rangee` ou `options.valeurRecord`. */
type ChargeDuDocument<O extends OptionsDocument> = O extends { readonly rangee: z.ZodType<infer R> }
  ? { entries: R[] } & (O extends { readonly deDeTirage: true } ? { die: z.output<typeof deDeTirageSchema> } : unknown)
  : O extends { readonly valeurRecord: z.ZodType<infer V> }
    ? { entries: Record<O extends { readonly cleRecord: z.ZodType<infer K extends string> } ? K : string, V> }
    : unknown;

/** Les champs du def au type ; aucun champ n'en ajoute aucun (`z.output` d'un objet vide est une signature d'index à
 *  `never`, qui ôterait toute clé à un `Omit` de l'entrée, `EntreeVivante`). */
type ChampsDuDocument<C extends Record<string, z.ZodType>> = [keyof C] extends [never] ? unknown : z.output<z.ZodObject<C>>;

/** L'ENTRÉE d'un document au type : enveloppe, champs du def, charge. */
type EntreeDuDocument<T extends string, C extends Record<string, z.ZodType>, O extends OptionsDocument> = EnveloppeDuDocument<T, O> &
  ChampsDuDocument<C> &
  ChargeDuDocument<O>;

/**
 * Le DATASET d'un document au type, tel que son fichier le porte : liste d'entrées (`entite`), l'entrée
 * seule (`config`, `record`). Hors type : `variants` (`options.variantes`) et ce qu'`affinerEntree`/
 * `affinerDataset` transformeraient — leurs nœuds rendent `z.ZodType<unknown>`.
 */
export type DatasetDuDocument<T extends string, F extends FamilleDocument, C extends Record<string, z.ZodType>, O extends OptionsDocument> = F extends 'entite'
  ? EntreeDuDocument<T, C, O>[]
  : EntreeDuDocument<T, C, O>;

/**
 * Vue TS d'un document à RANGÉES (`options.rangee`) : l'enveloppe, plus la charge que la fabrique
 * pose. Un def qui exporte la vue TS de son document la compose ICI — `DocumentARangees<z.infer<typeof
 * saRangee>>` —, sans jamais re-taper `entries` (un document à `deDeTirage` y ajoute `& { die: string }`, aux seuls cas qui le portent quand
 * `espace.chargeParDiscriminant` le nomme).
 */
export type DocumentARangees<L> = EnveloppeDocument & { entries: L[] };

/**
 * Ce que le CODEX expose de ce document : les clés de catégorie sous lesquelles le joueur le trouve
 * (`src/noyau/codex/registry.ts`), ou une EXEMPTION motivée. Déclarée au handle ; la DÉRIVATION des
 * tables du Codex à partir de ces déclarations vit dans `src/data/schemas/exposition-derivee.ts` (#1472).
 */
export type ExpositionCodex =
  | { readonly keys: readonly string[] }
  | { readonly exempt: { readonly kind: 'vocabulaire-app-interne' | 'dette'; readonly raison: string; readonly ticket?: string } };

type ExpositionEditHorsNiche =
  | { readonly dataset: string }
  | { readonly object: 'unique' | 'parCle' }
  | { readonly none: string; readonly dataset?: string };
type ExpositionNiche = { readonly niche: { readonly categories: Readonly<Record<string, string>> } };
/**
 * Ce que l'ÉDITEUR édite : le dataset-liste dont ce document est une entrée, l'OBJET de configuration
 * qu'il forme à lui seul (`unique`) ou dont il est une valeur (`parCle`), les TABLEAUX NICHÉS qu'il
 * porte (`niche`), ou rien (`none`, raison exigée — vraie lecture seule, aucune route d'édition).
 * Un document `none` dont les entrées SONT un dataset-liste de la mémoire (`src/data/overrides.ts`
 * `ARRAYS`) le nomme par `dataset` : sans route d'édition, il garde son fichier, et sa clé de dataset
 * (`CLES_DE_DATASET`, `schemas/_cles-de-dataset.generated.ts`).
 *
 * `niche.categories` associe chaque clé de catégorie Codex de CE document routée comme dataset
 * (`CodexEdit.CATEGORY_DATASET`) à la SUITE NICHÉE de la collection qu'elle édite
 * (`grammaire/cle-d-espace.ts`, `entries`, `[criticals-ldb-tete].entries`), jamais le document
 * entier ; le fichier PARENT est réécrit au save. Ses clés SONT les clés Codex du document : la
 * fabrique les pose en `codex.keys`, qu'un def à route niche ne déclare pas.
 */
export type ExpositionEdit = ExpositionEditHorsNiche | ExpositionNiche;

/** EXPOSITION d'un document au handle : où il se lit (Codex) et où il s'édite. */
export interface Exposition {
  readonly codex: ExpositionCodex;
  readonly edit: ExpositionEdit;
}

/** Ce qu'un def DÉCLARE à `document()` : une route niche ne porte pas de `codex`, la fabrique le pose. */
export type DeclarationExposition =
  | { readonly codex: ExpositionCodex; readonly edit: ExpositionEditHorsNiche }
  | { readonly codex?: never; readonly edit: ExpositionNiche };

/**
 * Options de `document()` — tout ce qui n'est pas la déclaration nue du document, pour garder la
 * signature positionnelle courte (`type, famille, champs, meta, declaration, options?`).
 */
export interface OptionsDocument {
  /** Champs qu'une variante réglée republie (`variantOf`, #563/#564). */
  readonly variantes?: readonly string[];
  /** Schéma d'une VALEUR du record — exigé par la famille `record`, refusé partout ailleurs. */
  readonly valeurRecord?: z.ZodType;
  /**
   * Schéma d'une RANGÉE du document — admissible dans TOUTE famille : la charge est orthogonale à
   * l'emballage du fichier. Même mécanique que `valeurRecord` : la fabrique pose
   * `entries` sur l'entrée, avec sa méta FR (`META_CHARGE`) — un def à rangées ne redéclare donc jamais
   * sa charge, `die` compris (`options.deDeTirage`). Une rangée qui déclare un `id` fait de `entries`
   * une collection à clé `id` (`marquerCollection`, `grammaire/collection-cle.ts`) ; sans `id`, la
   * rangée se désigne par sa fourchette (`findTableEntry`).
   */
  readonly rangee?: z.ZodType<object>;
  /**
   * Le document porte un DÉ DE TIRAGE : la fabrique pose `die` (`deDeTirageSchema`) avec sa
   * méta FR (`META_CHARGE`), requis — ou porté par les seuls cas qui le nomment dans
   * `espace.chargeParDiscriminant` (`refusDeCharge`). Sans cette déclaration, `die` n'existe pas sur le document — le poser à tous
   * ferait de `die` une clé DÉCLARÉE JAMAIS OBSERVÉE sur les documents qui n'en ont pas (inventaire
   * `STRUCTURES_DEFAUT`, `scripts/guards/lib/inventaireDeDette.mts`). Exige `rangee`.
   */
  readonly deDeTirage?: boolean;
  /**
   * Schéma d'une CLÉ du record — défaut `z.string().min(1)`. Un def dont l'univers de clés est FERMÉ
   * le déclare ici (`src/data/schemas/defs/teintesJeu.ts` : `z.record(z.enum(TEINTE_KEYS), couleurHexSchema)`)
   * et garde son verrou par construction, qu'une clé libre perdrait. Mesuré (zod 4.4.3) : une clé
   * énumérée rend le record TOTAL — toute clé déclarée doit être présente.
   */
  readonly cleRecord?: z.ZodType<string>;
  /**
   * Schéma de l'ID du document — défaut `z.string().min(1)`. Même mécanique que `cleRecord` : un def
   * dont le catalogue d'ids est FERMÉ le déclare ici et garde son verrou par construction, qu'un id
   * libre perdrait. Consommateur cible : `src/data/schemas/defs/characteristics.ts:13-19`
   * (`z.union([charKeySchema, z.enum([...])])` ; à la ligne 15 : « Catalogue FERMÉ (19 entrées) — union
   * énumérée, pas `z.string()` ») — sans cette option, l'adoption de la fabrique remplacerait ce verrou
   * par `z.string().min(1)` EN SILENCE.
   * Un schéma qui admettrait la chaîne vide ré-ouvrirait le contrat que l'enveloppe ferme (`.min(1)`) :
   * `document()` le REFUSE nommément (garde ci-dessous).
   */
  readonly idDocument?: z.ZodType<string>;
  /**
   * Clés d'ENVELOPPE que CE document rend REQUISES (l'enveloppe les pose optionnelles).
   * EXIGER = requis ET NON VIDE : les clés de chaîne exigées prennent `.min(1)`, `alsoIn` exigé prend
   * `.min(1)` sur son tableau — une exigence satisfaite par `''` ou `[]` ne prouverait rien (`desc` et
   * `maison` portent déjà ce `.min(1)` structurellement : pour elles, `exiges` ne change que l'optionalité).
   * `desc` EXIGÉE = PROSE exigée, quel qu'en soit le PORTEUR (`desc` inline ou `descRef`) : elle ne
   * passe pas par l'optionalité du champ mais par le refine V4 de `grammaire/prose.ts` — `descRef`
   * n'est donc pas exigible (`NON_EXIGIBLES`), il n'y a qu'UNE façon de dire « ce document a une prose ».
   * Ce que l'adoption relâcherait sans cette option est MESURÉ et figé par le test
   * `grammaire.test.ts` « contrats d'enveloppe REQUIS dans les defs `entite` » — mesureur : `shape[k]`
   * dont `safeParse(undefined)` est ROUGE, sur les defs `entite` du registre. Les CHIFFRES vivent
   * dans ce test, jamais recopiés ici : une copie se périme en silence à chaque vague d'adoption, et
   * un JSDoc ne rend aucun verdict vérifiable. Le verrou de contrepartie (l'entrée AMPUTÉE d'une clé
   * exigée est refusée, def par def) vit dans le même fichier.
   * ATTENTION : `source` dans `exiges` la rend STRICTEMENT requise : le refine de provenance `source ∨ maison`
   * en devient INATTEIGNABLE (il ne s'exécute que sur un objet dont `source` est déjà validée) — il n'y
   * a donc pas de second chemin à éteindre, c'est une conséquence de la forme, pas un branchement.
   */
  readonly exiges?: readonly CleExigible[];
  /**
   * Genres de fragment qu'une `descRef` de CE document admet (`descRefSchemaDe`, `grammaire/valeurs.ts`) — défaut :
   * tous. Un genre absent est refusé au parse, à l'adresse de l'entrée.
   */
  readonly fragmentsAdmis?: readonly GenreDeFragment[];
  /**
   * Porteurs de prose que CE document admet (`refineProse`, V5, `grammaire/prose.ts`) — défaut : les deux.
   * `['descRef']` refuse au parse toute `desc` inline, quel que soit le livre cité.
   */
  readonly porteursDeProse?: readonly PorteurDeProse[];
  /**
   * Raffinement de l'ENTRÉE, appliqué AVANT le sceau.
   * Mesuré (zod 4.4.3) : `superRefine`/`refine` rendent un `ZodObject` ENCORE extensible — l'ordre
   * entrée → affiner → `.pipe` est donc le seul qui scelle. Consommateurs cibles : `projet.ts`
   * (`superRefine` de document).
   * En famille `record`, l'ENTRÉE est le DOCUMENT ENTIER (enveloppe + `entries`) : le raffinement
   * reçoit donc l'objet qui parse le fichier, `entries` comprise.
   */
  readonly affinerEntree?: (entree: z.ZodObject<z.ZodRawShape>) => z.ZodType<unknown>;
  /**
   * Raffinement du DATASET, appliqué APRÈS l'emballage par famille.
   * Consommateurs mesurés : `names` (exhaustivité des ids du dataset-liste). Un invariant de record se
   * porte, lui, par `affinerEntree` — en famille `record` l'entrée EST le document, `entries` comprise.
   */
  readonly affinerDataset?: (dataset: z.ZodType<unknown>) => z.ZodType<unknown>;
  /**
   * Paramètres de l'ESPACE DE NOMS de racine (`discriminant`, `marqueurs` : `EspaceDeNoms`,
   * `grammaire/collection-cle.ts`) — ouvert par les familles `entite`/`record`, et par un document
   * `config` à rangées sur ses `entries` (`<fichier>#entries`) : ses rangées portent un id qu'une
   * référence désigne, et leur charge par discriminant y est bornée au parse de chaque rangée.
   */
  readonly espace?: EspaceDeNoms;
}

/** Handle FERMÉ d'un document : ce que le registre, l'éditeur et les gardes consomment. */
export interface DocumentHandle<T extends string, S = unknown> {
  /**
   * LE DATASET tel qu'il vit dans son fichier, emballé PAR FAMILLE (#1467) : `entite` →
   * `z.array(entrée)`, `config` → l'entrée seule, `record` → enveloppe + `entries`. Un def n'écrit
   * plus jamais son `z.array` à la main. Un fichier qui porte PLUSIEURS documents-tables est une
   * famille `entite` dont chaque entrée a sa charge `entries` (`options.rangee`). En `entite` et en
   * `record`, le nœud rendu est une collection à clé marquée ESPACE DE NOMS (`grammaire/collection-cle.ts`).
   * Sa sortie `S` est le dataset au type (`DatasetDuDocument`), lu par la porte `datasetDe`.
   */
  readonly schema: z.ZodType<S>;
  /**
   * L'ENTRÉE SCELLÉE seule — pour l'EMBARQUEMENT (statblocks, table posée dans un autre fichier),
   * jamais pour l'UI, qui consomme le dataset. En famille `record`, l'entrée EST le document entier
   * (enveloppe + `entries`) : `schema` y est `entree`, marquée collection à clé de ses `entries`. Sur un document à `rangee`,
   * l'entrée porte l'enveloppe ET ses rangées.
   */
  readonly entree: z.ZodType<unknown>;
  /**
   * L'entrée en PATCH (tous champs optionnels), dérivée AVANT le sceau puis SCELLÉE à son tour :
   * `.partial()` rend un `ZodObject` NU, que `.extend` rouvrirait — la fabrique n'expose aucun nœud
   * extensible, fût-il voisin. `.optional()`/`safeParse` restent servis.
   * Consommateur mesuré : `narratif.ts` (`presetPnjSchema.profil`, profil de PNJ embarqué) — il
   * CONSOMME `entreePartielle`. Sur le nœud SCELLÉ, `.partial` n'existe pas et l'appel
   * JETTE : c'est bien cette propriété-ci qui lui tient lieu de `.partial()`.
   * Le nœud est MARQUÉ de son document : `documentDeLEntreePartielle(entreePartielle) === schema`.
   */
  readonly entreePartielle: z.ZodType<unknown>;
  /**
   * Clés top-level de l'entrée (enveloppe + champs, plus la CHARGE posée par la fabrique),
   * relevées AVANT le sceau.
   * Consommateur mesuré : `variants-integrity.test.ts` (`SHAPE_BY_FILE`, où les TROIS defs à
   * variantes lisent `cles`).
   */
  readonly cles: readonly string[];
  /** `type` du document, écrit dans le JSON et vérifié au parse. */
  readonly type: T;
  readonly famille: FamilleDocument;
  /** Méta d'édition, une entrée par clé de `champs`. */
  readonly meta: Readonly<Record<string, MetaChamp>>;
  /** Exposition Codex / éditeur, déclarée par le def. */
  readonly exposition: Exposition;
  /** Champs qu'une variante réglée republie (`variantOf`, #563/#564) — vide = aucune variante admise. */
  readonly variantes: readonly string[];
  /**
   * Clés d'ENVELOPPE que ce document rend REQUISES (`options.exiges`) — la DÉCLARATION, lisible.
   * Le handle la publie ; le registre généré, lui, n'importe que les quatre exports plats
   * (`file`/`schema`/`famille`/`meta`, contrat `defsSansExportsPlats`), si bien qu'une garde qui part
   * du registre mesure l'exigence sur le SCHÉMA (l'entrée ampuée est-elle refusée ?) et non sur cette
   * liste — les deux disent la même chose, la seconde est la seule observable de l'extérieur.
   */
  readonly exiges: readonly CleExigible[];
}

/**
 * Pose un champ d'enveloppe : OPTIONNEL par défaut, ou sa forme NON VIDE quand le document l'EXIGE
 * (`options.exiges`). Le cast garde la VUE TS la plus permissive (`EnveloppeDocument` reste « tout
 * optionnel ») : le verrou d'un document qui exige est au PARSE, il ne rétrécit jamais le type
 * partagé par tous les documents.
 */
function champEnveloppe<S extends z.ZodType>(optionnel: S, exige: boolean, nonVide: S = optionnel): z.ZodOptional<S> {
  return (exige ? nonVide : optionnel.optional()) as z.ZodOptional<S>;
}

function enveloppe(type: string, idDocument?: z.ZodType<string>, exiges: readonly CleExigible[] = [], fragmentsAdmis?: readonly GenreDeFragment[]) {
  const requis = (k: CleExigible) => exiges.includes(k);
  return {
    id: (idDocument ?? z.string().min(1)) as z.ZodType<string>,
    type: z.literal(type),
    label: z.string().min(1),
    labelF: champEnveloppe(z.string(), requis('labelF'), z.string().min(1)),
    /** Les DEUX porteurs de la prose — `desc` inline ou `descRef` (l'adresse du passage dans le
     *  livre) — posés par `grammaire/prose.ts`, avec les verrous qui les gouvernent. Ni l'un ni
     *  l'autre n'est rendu requis ICI : l'EXIGENCE de prose se dit sur le texte, pas sur un porteur
     *  (`exiges: ['desc']` → refine V4). */
    ...champsProse(fragmentsAdmis),
    source: champEnveloppe(sourceRefSchema, requis('source')),
    alsoIn: champEnveloppe(z.array(secondarySourceRefSchema), requis('alsoIn'), z.array(secondarySourceRefSchema).min(1)),
    /**
     * Ce que le canon ne tranche pas : ce champ en porte la RAISON (`maisonSchema`, `grammaire/valeurs.ts`).
     *
     * Le TYPE est le contrat : une raison est une CHAÎNE. La forme booléenne (un drapeau « c'est
     * maison », qui ne dit aucune raison) est ÉTEINTE de la donnée — zéro `maison` non-chaîne sur les
     * deux racines, mesuré RÉCURSIVEMENT et gardé par `src/data/maison-sans-source.test.ts`.
     */
    maison: champEnveloppe(maisonSchema, requis('maison')),
    icon: champEnveloppe(idDIconeSchema, requis('icon')),
  };
}

/**
 * Options d'un champ ÉNUMÉRÉ — les valeurs de son noyau d'enum, `undefined` si le champ n'est pas
 * énuméré. COMPOSE le déroulé unique du dépôt (`noyauEnum`, `grammaire/meta.ts`), celui-là même dont la
 * lecture des libellés d'un enum nommé (`valeursDe`, #1694) tire son noyau.
 */
export function optionsEnum(noeud: z.ZodType): readonly string[] | undefined {
  const noyau = noyauEnum(noeud);
  return noyau ? Object.values(defDe(noyau)!.entries as Record<string, string>) : undefined;
}

function poseExposition(type: string, declaration: DeclarationExposition): Exposition {
  const e = declaration.edit as { dataset?: string; object?: string; niche?: { categories?: Readonly<Record<string, unknown>> }; none?: string };
  if (e.niche) {
    const carte = e.niche.categories;
    const cats = estObjet(carte) ? Object.keys(carte) : [];
    if (!(cats.length && cats.every((d) => d.length && typeof carte![d] === 'string' && (carte![d] as string).length))) {
      throw new Error(`document('${type}') : \`edit.niche.categories\` exige au moins une clé de catégorie routée, chacune vers sa suite nichée (chaînes non vides).`);
    }
    return { codex: { keys: cats }, edit: declaration.edit };
  }
  const c = declaration.codex as { keys?: readonly string[]; exempt?: { raison?: string } } | undefined;
  // Une exemption se MOTIVE : un mot ne dit rien — seuil de motif hérité du garde d'exposition (#1472).
  if (!(Array.isArray(c?.keys) && c.keys.length) && (c?.exempt?.raison ?? '').trim().length < 10) {
    throw new Error(
      `document('${type}') : \`codex\` exige des \`keys\` non vides ou un \`exempt\` motivé (raison ≥ 10 caractères).`,
    );
  }
  if (!e.dataset && !e.object && !e.none) {
    throw new Error(`document('${type}') : \`edit\` exige \`dataset\`, \`object\`, \`niche\` ou \`none\` (raison).`);
  }
  return declaration as Exposition;
}

/** L'entrée PARTIELLE d'un document → le nœud FINAL `schema` de ce document (marque posée par `document()`). */
const DOCUMENT_DE_L_ENTREE_PARTIELLE = new WeakMap<object, z.ZodType<unknown>>();

/**
 * Le `schema` du document dont `noeud` est l'entrée PARTIELLE (`DocumentHandle.entreePartielle`),
 * `undefined` sinon. Lu à la co-descente (`coDescendre`, `grammaire/descente.ts`) : une entrée
 * partielle EMBARQUÉE dans un autre document y retrouve son document par l'identité de `schema`
 * (`clesPortees`, `scripts/docs/lib/structures-scan.mts`).
 */
export const documentDeLEntreePartielle = (noeud: unknown): z.ZodType<unknown> | undefined =>
  noeud !== null && typeof noeud === 'object' ? DOCUMENT_DE_L_ENTREE_PARTIELLE.get(noeud) : undefined;

/** Le nœud porte-t-il, à travers ses enveloppes transparentes (`ouverts`), une entrée partielle marquée ? */
const porteUneEntreePartielle = (noeud: unknown): boolean => ouverts([noeud]).some((n) => documentDeLEntreePartielle(n) !== undefined);

/**
 * Les ADRESSES des entrées partielles EMBARQUÉES sous `racines` (#2206), en notation
 * `scripts/source/adresses.mjs` générique (`narratif.presetsPnj[].profil`), triées.
 */
export function adressesDesEntreesEmbarquees(racines: readonly unknown[]): string[] {
  const out = new Set<string>();
  descendre(racines, ({ noeud, path }) => {
    for (const e of enfantsDe(noeud)) {
      if (e.segment === '' || e.segment.startsWith('|') || e.segment.startsWith('&')) continue;
      if (porteUneEntreePartielle(e.noeud)) out.add((path + e.segment).replace(/\|\d+|&\d/g, '').replace(/^\./, ''));
    }
  });
  return [...out].sort();
}

/**
 * `refineAdapteDe` du nœud `schema`, étendu aux entrées partielles qu'il EMBARQUE : une clé dont
 * l'entrée porte `descRef` refuse `adapteDe` (#2001, #2206).
 */
export function exclusiviteAdapteDe(schema: z.ZodObject<z.ZodRawShape>): (v: unknown, ctx: z.RefinementCtx) => void {
  const embarquees = Object.keys(schema.shape).filter((k) => porteUneEntreePartielle(schema.shape[k]));
  return (v, ctx) => {
    refineAdapteDe(v, ctx);
    const n = (v ?? {}) as Record<string, { descRef?: unknown } | undefined> & { adapteDe?: unknown };
    if (n.adapteDe === undefined) return;
    for (const k of embarquees.filter((cle) => n[cle]?.descRef !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['adapteDe'], message: `texte adapté, alors que la description de « ${k} » est la copie adressée du livre.` });
    }
  };
}

/** Les champs de PROVENANCE d'une entrée ou d'une sous-entrée. */
export interface Provenance { source?: unknown; maison?: unknown }

/** PROVENANCE : `source` OU `maison`, jamais NI L'UN NI L'AUTRE — refine UNIQUE, partagé par la
 *  fabrique `document()` et toute sous-entrée qui porte sa propre provenance. `sujet` nomme ce qui
 *  la doit (« de l’entrée », « du billet »). */
export function refuserSansProvenance(v: Provenance, ctx: z.RefinementCtx, sujet: string): void {
  if (v.source === undefined && v.maison === undefined) {
    ctx.addIssue({ code: 'custom', path: ['source'], message: `provenance manquante : cite le livre et la page, ou dis la raison maison ${sujet}.` });
  }
}

/**
 * Déclare un document. `champs` = la charge utile propre au type, `meta` = son libellé FR par clé,
 * `declaration` = Codex + éditeur (une route niche tire ses clés Codex de ses catégories),
 * `options.variantes` = les champs qu'une variante réglée republie — la fabrique compose `variantOf`
 * elle-même, donc un champ hors de cette liste est refusé au parse et un document sans `variantes`
 * n'admet aucun `variants`.
 *
 * Elle rend AUSSI l'emballage du FICHIER (`schema`, par famille). Sur un document à CHARGE (`record`,
 * ou `options.rangee`), `champs`/`meta` décrivent les champs additionnels éventuels — le contenu,
 * lui, vit sous `entries`, que la fabrique pose seule (`options.valeurRecord`/`options.cleRecord` en
 * `record`, `options.rangee` ailleurs) et qu'un def ne redéclare pas.
 */
export function document<T extends string, F extends FamilleDocument, C extends Record<string, z.ZodType>, const O extends OptionsDocument = Record<never, never>>(
  type: T,
  famille: F,
  champs: C & ChampsHorsEnveloppe<C>,
  meta: MetaDesChamps<C>,
  declaration: DeclarationExposition,
  options?: OptionsDocument & O,
): DocumentHandle<T, DatasetDuDocument<T, F, C, O>> {
  const opts: OptionsDocument = options ?? {};
  const { variantes, valeurRecord, cleRecord, idDocument, exiges = [], fragmentsAdmis, porteursDeProse, rangee, deDeTirage, affinerEntree, affinerDataset, espace = {} } = opts;
  if (idDocument && idDocument.safeParse('').success) {
    throw new Error(
      `document('${type}') : \`idDocument\` admet la CHAÎNE VIDE — l'enveloppe ferme l'id à \`.min(1)\`, un schéma d'id ne le ré-ouvre pas.`,
    );
  }
  for (const [i, k] of exiges.entries()) {
    if ((NON_EXIGIBLES as readonly string[]).includes(k)) {
      throw new Error(
        `document('${type}') : « ${k} » n'est pas exigible — ${RAISON_NON_EXIGIBLE[k as (typeof NON_EXIGIBLES)[number]]} (clés exigibles : ${CLES_EXIGIBLES.join(', ')}).`,
      );
    }
    if (!(CLES_EXIGIBLES as readonly string[]).includes(k)) {
      throw new Error(
        `document('${type}') : \`exiges\` nomme « ${k} », qui n'est pas une clé exigible de l'enveloppe (${CLES_EXIGIBLES.join(', ')}).`,
      );
    }
    if (exiges.indexOf(k) !== i) {
      throw new Error(`document('${type}') : \`exiges\` répète « ${k} ».`);
    }
  }
  if (famille === 'record' && !valeurRecord) {
    throw new Error(`document('${type}') : la famille « record » exige \`valeurRecord\` (le schéma d'une valeur de \`entries\`).`);
  }
  if (famille !== 'record' && valeurRecord) {
    throw new Error(`document('${type}') : \`valeurRecord\` n'a de sens que pour la famille « record » (ici « ${famille} »).`);
  }
  if (famille !== 'record' && cleRecord) {
    throw new Error(`document('${type}') : \`cleRecord\` n'a de sens que pour la famille « record » (ici « ${famille} »).`);
  }
  if (famille === 'record' && rangee) {
    throw new Error(
      `document('${type}') : \`rangee\` et la famille « record » sont EXCLUSIVES — un record porte sa charge par CLÉ (\`valeurRecord\`), une liste ordonnée de rangées est un autre document.`,
    );
  }
  if (famille === 'config' && opts.espace && !rangee) {
    throw new Error(`document('${type}') : \`espace\` n'a de sens que pour les familles « entite » et « record », ou pour les rangées d'un document « config » (ici sans \`rangee\`) — un document de réglage n'ouvre aucun espace de noms de racine.`);
  }
  if (famille === 'config' && espace.marqueurs) {
    throw new Error(`document('${type}') : l'espace des rangées d'un document « config » n'a pas de \`marqueurs\`.`);
  }
  if (deDeTirage && !rangee) {
    throw new Error(`document('${type}') : \`deDeTirage\` exige \`rangee\` — un dé de tirage tire une RANGÉE.`);
  }
  /** La CHARGE de ce document : ce qu'aucun def ne redéclare dans `champs` (garde ci-dessous). */
  const clesCharge: readonly CleCharge[] = famille === 'record' ? ['entries'] : rangee ? ['entries', 'die'] : [];
  /** Celles que la fabrique pose RÉELLEMENT sur l'entrée — et dont elle publie la méta FR. */
  const clesPosees = clesCharge.filter((k) => k !== 'die' || deDeTirage);
  // L'ESPACE DE NOMS est celui de la liste du document (`entite`), de sa carte (`record`), ou celui de
  // ses RANGÉES (`config`), dont la charge par discriminant se borne alors au parse de chaque rangée.
  const espaceDesRangees = famille === 'config' ? opts.espace : undefined;
  const espaceDuDocument = famille === 'config' ? {} : espace;
  /** Le dé est une clé de CHARGE par discriminant dès qu'un cas de `espace.chargeParDiscriminant` le nomme :
   *  la fabrique le pose alors optionnel, et `refusDeCharge` l'exige des cas qui le déclarent, le refuse aux autres. */
  const deParDiscriminant = Object.values(espaceDuDocument.chargeParDiscriminant ?? {}).some((cles) => cles.includes('die'));
  const refusDeRangee = espaceDesRangees && rangee && refusDeCharge(type, espaceDesRangees, rangee instanceof z.ZodObject ? Object.keys(rangee.shape) : []);
  const rangeeChargee = rangee && refusDeRangee
    ? nommerChamps((rangee as z.ZodObject<z.ZodRawShape>).superRefine((v, ctx) => refusDeRangee(v as Record<string, unknown>, ctx)), metaDesChamps(rangee) ?? {})
    : rangee;
  const cles = Object.keys(champs);
  for (const k of cles) {
    if ((clesCharge as readonly string[]).includes(k)) {
      throw new Error(`document('${type}') : la fabrique pose « ${k} » (charge du document) — retire-le de \`champs\`.`);
    }
    if ((CLES_ENVELOPPE as readonly string[]).includes(k)) {
      throw new Error(`document('${type}') : « ${k} » est une clé d'ENVELOPPE, la fabrique la pose — retire-la de \`champs\`.`);
    }
    if (!(meta as Record<string, MetaChamp | undefined>)[k]) {
      throw new Error(`document('${type}') : le champ « ${k} » n'a pas de méta d'édition (\`{ label }\` au minimum).`);
    }
  }
  for (const k of Object.keys(meta)) {
    if (!cles.includes(k)) {
      throw new Error(`document('${type}') : méta d'édition « ${k} » sans champ correspondant.`);
    }
  }
  const exposition = poseExposition(type, declaration);
  const nomsEntree = { ...tableTotale(Object.keys(enveloppe(type)) as CleEnveloppe[], k => ({ label: LIBELLES_ENVELOPPE[k] })), ...meta };
  const champsDuDef = champs as Record<string, z.ZodType>;
  const entree = marquerProduit(nommerChamps(z.strictObject({
    ...enveloppe(type, idDocument, exiges, fragmentsAdmis),
    ...champsDuDef,
  }) as z.ZodObject<z.ZodRawShape>, nomsEntree), 'document', 'entree', champsDuDef);
  const declarees = [...(variantes ?? [])];
  for (const k of declarees) {
    if (!(k in entree.shape)) {
      throw new Error(`document('${type}') : « ${k} » est déclaré republiable par une variante, mais n'est pas un champ du document.`);
    }
  }
  const complet = declarees.length
    ? marquerProduit(z.strictObject({ ...entree.shape, variants: z.array(variantOf(entree, declarees)).optional() }) as z.ZodObject<z.ZodRawShape>, 'document', 'variantes', champsDuDef)
    : entree;
  // SCEAU : `.pipe` rend un `ZodPipe` — ni `.extend` ni `.shape` AU RUNTIME, `safeParse`/`z.infer` et le
  // refus `strict` intacts (mesuré sur zod 4.4.3 : `.superRefine`/`.check`/`.refine`/`.brand` rendent,
  // eux, un `ZodObject` encore extensible).
  // La CHARGE (`entries`, et le `die?` d'un document à rangées) est posée ICI : `affinerEntree`,
  // `entreePartielle` et `cles` la voient comme n'importe quel champ. Les deux formes de charge
  // diffèrent par leur structure — record clé→valeur, liste ordonnée de rangées.
  const corps =
    famille === 'record'
      ? marquerProduit(z.strictObject({
          ...complet.shape,
          entries: z.record(cleRecord ?? z.string().min(1), valeurRecord!),
        }) as z.ZodObject<z.ZodRawShape>, 'document', 'corps.record', champsDuDef)
      : rangee
        ? marquerProduit(z.strictObject({
            ...complet.shape,
            ...(deDeTirage ? { die: deParDiscriminant ? deDeTirageSchema.optional() : deDeTirageSchema } : {}),
            entries: rangeesDeCharge(z.array(rangeeChargee!), espaceDesRangees),
          }) as z.ZodObject<z.ZodRawShape>, 'document', 'corps.rangees', champsDuDef)
        : complet;
  const noms = { ...nomsEntree, ...tableTotale(clesPosees, k => META_CHARGE[k]), ...(declarees.length ? { variants: { label: LIBELLES_ENVELOPPE.variants } } : {}) };
  // PROSE de la partielle : les verrous de `avecProse` ci-dessous, sans obligation (#2206).
  const partielle = marquerProduit(corps.partial(), 'document', 'entreePartielle', champsDuDef).superRefine(
    refineProse({ type, exigeProse: false, porteurs: porteursDeProse }),
  ) as z.ZodObject<z.ZodRawShape>;
  const entreePartielle: z.ZodType<unknown> = nommerChamps(partielle, noms).pipe(z.transform((v) => v));
  const clesEntree: readonly string[] = Object.keys(corps.shape);
  // Un MARQUEUR d'espace est un champ de l'entrée : un nom hors de ses clés ouvrirait une sous-liste
  // qu'aucune donnée ne saurait jamais remplir (`gen-espaces` admet une sous-liste marquée VIDE).
  for (const marqueur of espaceDuDocument.marqueurs ?? [])
    if (!clesEntree.includes(marqueur))
      throw new Error(`document('${type}') : le marqueur d’espace « ${marqueur} » n’est aucun champ de l’entrée.`);
  // PROVENANCE : `source` OU `maison`, jamais NI L'UN NI L'AUTRE. Une entrée sans folio n'est pas
  // interdite — elle doit DIRE pourquoi. `exigeSource` consulte l'UNION `SANS_PROVENANCE_EXIGEE`
  // (`SANS_LIVRE_DEFINITIF` ∪ `SOURCE_EN_PROFONDEUR`) : sont hors régime les documents SANS aucun livre comme
  // ceux dont le livre est cité par SOUS-ENTRÉE — dans les deux cas rien n'est exigible à l'entrée de
  // racine. Refine PRÉ-sceau : `superRefine` rend un `ZodObject` encore extensible (mesuré zod
  // 4.4.3), donc `affinerEntree` reçoit bien un objet.
  // `exiges: ['source']` rend `source` structurellement requise : le refine ci-dessous ne s'exécute
  // alors que sur un objet dont `source` est déjà validée et ne peut JAMAIS lever — inatteignable par
  // construction, donc rien à éteindre ici (mesuré : un branchement qui l'éteindrait est inobservable).
  const avecProvenance = !exigeSource(type)
    ? corps
    : (corps.superRefine((v, ctx) => refuserSansProvenance(v as Provenance, ctx, 'de l’entrée')) as z.ZodObject<z.ZodRawShape>);
  // PROSE : les verrous du texte et de son adresse (`grammaire/prose.ts`, V1-V5), au même stade et
  // pour la même raison que le refine de provenance ci-dessus — PRÉ-sceau, sur l'entrée entière.
  const avecProse = avecProvenance.superRefine(
    refineProse({ type, exigeProse: exiges.includes('desc'), porteurs: porteursDeProse }),
  ) as z.ZodObject<z.ZodRawShape>;
  // CHARGE par discriminant (`espace.chargeParDiscriminant`) : bornée au parse de l'entrée d'une liste,
  // au même stade que la provenance et la prose. Un record porte sa charge par CLÉ, jamais par cas.
  if (famille === 'record' && espace.chargeParDiscriminant)
    throw new Error(`document('${type}') : \`chargeParDiscriminant\` partitionne les ENTRÉES d’une liste — un record porte sa charge par clé.`);
  const refusCharge = refusDeCharge(type, espaceDuDocument, clesEntree);
  const avecCharge = refusCharge
    ? (avecProse.superRefine((v, ctx) => refusCharge(v as Record<string, unknown>, ctx)) as z.ZodObject<z.ZodRawShape>)
    : avecProse;
  const affine = affinerEntree ? affinerEntree(avecCharge) : avecCharge;
  nommerChamps(affine as z.ZodObject<z.ZodRawShape>, { ...noms, ...metaDesChamps(affine) });
  const entreeScellee: z.ZodType<unknown> = affine.pipe(z.transform((v) => v));

  // EMBALLAGE par FAMILLE (#1467) : le dataset est ce que le FICHIER porte — une LISTE d'entrées
  // (`entite`), ou l'entrée elle-même (`config`, `record`).
  const dataset: z.ZodType<unknown> = famille === 'entite' ? z.array(entreeScellee) : entreeScellee;
  const affineDataset: z.ZodType<unknown> = affinerDataset ? affinerDataset(dataset) : dataset;
  // ESPACE DE NOMS de racine : la liste `entite` (ses `id`) ou la carte `entries` du `record`, marquée
  // sur le nœud FINAL — `affinerDataset` clone le nœud qu'il reçoit (#1463).
  const schema: z.ZodType<unknown> =
    famille === 'entite'
      ? marquerCollection(affineDataset, marqueDeListe<{ id: string }>('id', espace))
      : famille === 'record'
        ? marquerCollection(affineDataset, marqueDeRecord({ sous: 'entries', espace }))
        : affineDataset;
  const metaPubliee = { ...(meta as Record<string, MetaChamp>), ...tableTotale(clesPosees, (k) => META_CHARGE[k]) };
  DOCUMENT_DE_L_ENTREE_PARTIELLE.set(entreePartielle, schema);
  return {
    // Le nœud SCELLÉ (`.pipe(z.transform)`) sort `unknown` : sa sortie au type se déclare ici, depuis
    // les mêmes `champs` et `options` qui l'ont composé.
    schema: schema as z.ZodType<DatasetDuDocument<T, F, C, O>>,
    entree: entreeScellee,
    entreePartielle,
    cles: clesEntree,
    type,
    famille,
    meta: metaPubliee,
    exposition,
    variantes: declarees,
    exiges: [...exiges],
  };
}
