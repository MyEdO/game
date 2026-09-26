/**
 * FABRIQUE DE DOCUMENT (#1466 L1a) — la seule façon de déclarer un document de l'application.
 *
 * Elle rend un HANDLE FERMÉ : le schéma sort SCELLÉ, si bien que `.extend` et `.shape` n'existent
 * plus NI au type NI au runtime (zod 4.4.3 perd le registre et la `.meta()` d'un nœud à l'extension —
 * la composition se fait ICI, une fois, ou pas du tout). Une clé d'ENVELOPPE redéclarée dans `champs`
 * est une erreur de TYPE (mapped type → `never`) ET une erreur d'exécution nommant la clé ; chaque
 * clé de `champs` exige sa `MetaChamp` ; chaque document déclare son EXPOSITION (Codex, éditeur).
 *
 * L'adoption par les defs est le lot L1b (#1467) : 122 defs l'appellent (121 sous `defs/`, 1 sous
 * `defs-scenes/`). Les defs `entite` ont TOUS adopté. Le compte fait foi à la MESURE, pas à cette
 * phrase : c'est le mesureur de `grammaire.test.ts` (« contrats d'enveloppe REQUIS dans les defs
 * `entite` ») qui l'établit.
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema, variantOf } from './valeurs';
import { noyauEnum, type MetaChamp, type MetaDesChamps } from './meta';
import { exigeSource } from './sans-livre';
import { champsProse, refineProse } from './prose';

/** Les 3 EMBALLAGES de fichier d'un document : liste d'entrées, entrée seule, record clé → valeur.
 *  La CHARGE d'un document (ses rangées, `options.rangee`) est orthogonale à son emballage. */
export type FamilleDocument = 'entite' | 'config' | 'record';

/** Clés de l'ENVELOPPE — posées par la fabrique, jamais par un def. */
export const CLES_ENVELOPPE = ['id', 'type', 'label', 'labelF', 'desc', 'descRef', 'source', 'alsoIn', 'variants', 'maison', 'icon'] as const;
export type CleEnveloppe = (typeof CLES_ENVELOPPE)[number];

/**
 * Libellés FR des clés d'ENVELOPPE (#1466 L1a, point 6). `document()` REFUSE une `MetaChamp` sur une
 * clé d'enveloppe (la fabrique la pose, aucun def ne la déclare) : leur nom lisible appartient donc à
 * la FABRIQUE, ici. Consommé par la cascade de libellés de l'atelier (`src/ui/compendium/editFields.ts`).
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
 * (`src/ui/compendium/editFields.ts::libelleDuChamp`).
 */
export const META_CHARGE: Readonly<Record<CleCharge, MetaChamp>> = {
  entries: { label: 'Rangées', hint: 'Contenu du document, dans l’ordre authoré' },
  die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer une rangée (ex. « 1d10 », « d100 »)' },
};

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
 * Vue TS de l'ENVELOPPE que la fabrique pose (`enveloppe()` ci-dessous), `type` élargi à `string`.
 *
 * Le handle rend ses nœuds SCELLÉS (`z.ZodType<unknown>`) : `z.infer<typeof schema>` d'un def adopté
 * vaut donc `unknown`. Un def qui exporte la VUE TS de son document (les casts de `src/data/index.ts`)
 * la recompose ici — `EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>` — sans jamais rouvrir
 * un nœud ni élargir un cast.
 */
export type EnveloppeDocument = Omit<z.infer<z.ZodObject<ReturnType<typeof enveloppe>>>, 'type'> & { type: string };

/**
 * Vue TS d'un document à RANGÉES (`options.rangee`) : l'enveloppe, plus la charge que la fabrique
 * pose. Un def qui exporte la vue TS de son document la compose ICI — `DocumentARangees<z.infer<typeof
 * saRangee>>` —, sans jamais re-taper `entries` (un document à `deDeTirage` y ajoute `& { die: string }`).
 */
export type DocumentARangees<L> = EnveloppeDocument & { entries: L[] };

/**
 * Ce que le CODEX expose de ce document : les clés de catégorie sous lesquelles le joueur le trouve
 * (`src/ui/compendium/registry.ts`), ou une EXEMPTION motivée. Déclarée au handle ; la DÉRIVATION des
 * tables du Codex à partir de ces déclarations vit dans `src/data/schemas/exposition-derivee.ts` (#1472).
 */
export type ExpositionCodex =
  | { readonly keys: readonly string[] }
  | { readonly exempt: { readonly kind: 'vocabulaire-app-interne' | 'dette'; readonly raison: string; readonly ticket?: string } };

/**
 * Ce que l'ÉDITEUR édite : le dataset-liste dont ce document est une entrée, l'OBJET de configuration
 * qu'il forme à lui seul (`single`) ou dont il est une valeur (`record`), les TABLEAUX NICHÉS qu'il
 * porte (`niche`), ou rien (`none`, raison exigée — vraie lecture seule, aucune route d'édition).
 *
 * `niche.categories` nomme les clés de catégorie Codex de CE document qui sont routées comme datasets
 * (`CodexEdit.CATEGORY_DATASET`) : chacune édite UN champ tableau du document, jamais le document
 * entier ; le fichier PARENT est réécrit au save. Une clé Codex du document absente de cette liste
 * n'a aucune route d'édition.
 */
export type ExpositionEdit =
  | { readonly dataset: string }
  | { readonly object: 'single' | 'record' }
  | { readonly niche: { readonly categories: readonly string[] } }
  | { readonly none: string };

/** EXPOSITION d'un document : où il se lit (Codex) et où il s'édite. */
export interface Exposition {
  readonly codex: ExpositionCodex;
  readonly edit: ExpositionEdit;
}

/**
 * Options de `document()` — tout ce qui n'est pas la déclaration nue du document, pour garder la
 * signature positionnelle courte (`type, famille, champs, meta, exposition, options?`).
 */
export interface OptionsDocument {
  /** Champs qu'une variante réglée republie (`variantOf`, #563/#564). */
  readonly variantes?: readonly string[];
  /** Schéma d'une VALEUR du record — exigé par la famille `record`, refusé partout ailleurs. */
  readonly valeurRecord?: z.ZodTypeAny;
  /**
   * Schéma d'une RANGÉE du document — admissible dans TOUTE famille : la charge est orthogonale à
   * l'emballage du fichier. Même mécanique que `valeurRecord` : la fabrique pose
   * `entries: z.array(rangee)` sur l'entrée, avec sa méta FR (`META_CHARGE`) — un def à rangées
   * ne redéclare donc jamais sa charge, `die` compris (`options.deDeTirage`).
   */
  readonly rangee?: z.ZodTypeAny;
  /**
   * Le document porte un DÉ DE TIRAGE : la fabrique pose `die` (requis) avec sa méta FR
   * (`META_CHARGE`). Sans cette déclaration, `die` n'existe pas sur le document — le poser à tous
   * ferait de `die` une clé DÉCLARÉE JAMAIS OBSERVÉE sur les documents qui n'en ont pas (mesuré :
   * `STRUCTURES_DEFAUT` +5). Exige `rangee`.
   */
  readonly deDeTirage?: boolean;
  /**
   * Schéma d'une CLÉ du record — défaut `z.string().min(1)`. Un def dont l'univers de clés est FERMÉ
   * le déclare ici (`src/data/schemas/defs/teintesJeu.ts` : `z.record(z.enum(TEINTE_KEYS), couleurHexSchema)`)
   * et garde son verrou par construction, qu'une clé libre perdrait. Mesuré (zod 4.4.3) : une clé
   * énumérée rend le record EXHAUSTIF — toute clé déclarée doit être présente.
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
}

/** Handle FERMÉ d'un document : ce que le registre, l'éditeur et les gardes consomment. */
export interface DocumentHandle<T extends string> {
  /**
   * LE DATASET tel qu'il vit dans son fichier, emballé PAR FAMILLE (#1467) : `entite` →
   * `z.array(entrée)`, `config` → l'entrée seule, `record` → enveloppe + `entries`. Un def n'écrit
   * plus jamais son `z.array` à la main. Un fichier qui porte PLUSIEURS documents-tables est une
   * famille `entite` dont chaque entrée a sa charge `entries` (`options.rangee`).
   */
  readonly schema: z.ZodType<unknown>;
  /**
   * L'ENTRÉE SCELLÉE seule — pour l'EMBARQUEMENT (statblocks, table posée dans un autre fichier),
   * jamais pour l'UI, qui consomme le dataset. En famille `record`, l'entrée EST le document entier
   * (enveloppe + `entries`), donc `entree` et `schema` y coïncident. Sur un document à `rangee`,
   * l'entrée porte l'enveloppe ET ses rangées.
   */
  readonly entree: z.ZodType<unknown>;
  /**
   * L'entrée en PATCH (tous champs optionnels), dérivée AVANT le sceau puis SCELLÉE à son tour :
   * `.partial()` rend un `ZodObject` NU, que `.extend` rouvrirait — la fabrique n'expose aucun nœud
   * extensible, fût-il voisin. `.optional()`/`safeParse` restent servis.
   * Consommateur mesuré : `narratif.ts` (`presetPnjSchema.profil`, profil de PNJ embarqué) — il
   * CONSOMME désormais `entreePartielle`. Sur le nœud SCELLÉ, `.partial` n'existe pas et l'appel
   * JETTE : c'est bien cette propriété-ci qui lui tient lieu de `.partial()`.
   */
  readonly entreePartielle: z.ZodType<unknown>;
  /**
   * Clés top-level de l'entrée (enveloppe + champs, plus la CHARGE posée par la fabrique),
   * relevées AVANT le sceau.
   * Consommateurs mesurés : `variants-integrity.test.ts` (`SHAPE_BY_FILE`, où les TROIS defs à
   * variantes lisent désormais `cles` — plus aucun `element.shape`, le dernier est mort avec
   * l'adoption de `spells`) et `scripts/guards/lib/fieldConsumerTargets.mjs` (`if (schema?.shape)` —
   * sans cette liste, la garde dégrade en SILENCE à zéro champ).
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
function champEnveloppe<S extends z.ZodTypeAny>(optionnel: S, exige: boolean, nonVide: S = optionnel): z.ZodOptional<S> {
  return (exige ? nonVide : optionnel.optional()) as z.ZodOptional<S>;
}

function enveloppe(type: string, idDocument?: z.ZodType<string>, exiges: readonly CleExigible[] = []) {
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
    ...champsProse(),
    source: champEnveloppe(sourceRefSchema, requis('source')),
    alsoIn: champEnveloppe(z.array(secondarySourceRefSchema), requis('alsoIn'), z.array(secondarySourceRefSchema).min(1)),
    /**
     * Ce que le canon ne tranche pas : ce champ en porte la RAISON, en clair. `.min(1)` est
     * STRUCTUREL : une chaîne vide ne prouve rien et le refine de provenance ci-dessous ne saurait
     * pas la distinguer d'une raison réelle. Mesuré (2026-08-27) : aucune chaîne vide dans la donnée.
     *
     * Le TYPE est le contrat : une raison est une CHAÎNE. La forme booléenne (un drapeau « c'est
     * maison », qui ne dit aucune raison) est ÉTEINTE de la donnée — zéro `maison` non-chaîne sur les
     * deux racines, mesuré RÉCURSIVEMENT et gardé par `src/data/maison-sans-source.test.ts`.
     */
    maison: champEnveloppe(z.string().min(1), requis('maison')),
    icon: champEnveloppe(z.string(), requis('icon'), z.string().min(1)),
  };
}

/**
 * Options d'un champ ÉNUMÉRÉ, à travers les enveloppes qui ne changent pas son univers de valeurs
 * (`optional`, `nullable`, `default`, `array`) — `undefined` si le champ n'est pas énuméré. COMPOSE le
 * déroulé unique du dépôt (`noyauEnum`, `grammaire/meta.ts`), celui-là même dont la lecture des
 * libellés d'un enum nommé (`valeursDe`, #1694) tire son noyau.
 */
export function optionsEnum(noeud: z.ZodTypeAny): readonly string[] | undefined {
  const noyau = noyauEnum(noeud);
  return noyau ? Object.values(noyau._zod!.def!.entries as Record<string, string>) : undefined;
}

function verifieExposition(type: string, exposition: Exposition): void {
  const c = exposition.codex as { keys?: readonly string[]; exempt?: { raison?: string } };
  // Une exemption se MOTIVE : un mot ne dit rien — seuil de motif hérité du garde d'exposition (#1472).
  if (!(Array.isArray(c.keys) && c.keys.length) && (c.exempt?.raison ?? '').trim().length < 10) {
    throw new Error(
      `document('${type}') : \`codex\` exige des \`keys\` non vides ou un \`exempt\` motivé (raison ≥ 10 caractères).`,
    );
  }
  const e = exposition.edit as { dataset?: string; object?: string; niche?: { categories?: readonly string[] }; none?: string };
  if (e.niche) {
    const cats = e.niche.categories;
    if (!(Array.isArray(cats) && cats.length && cats.every((d) => typeof d === 'string' && d.length))) {
      throw new Error(`document('${type}') : \`edit.niche.categories\` exige au moins une clé de catégorie routée (chaînes non vides).`);
    }
    if (!(Array.isArray(c.keys) && c.keys.length)) {
      throw new Error(
        `document('${type}') : \`edit.niche\` route des catégories alors que \`codex\` est EXEMPT — aucune clé Codex à router.`,
      );
    }
    const horsCodex = cats.filter((k) => !c.keys!.includes(k));
    if (horsCodex.length) {
      throw new Error(
        `document('${type}') : \`edit.niche.categories\` nomme des clés absentes de \`codex.keys\` : ${horsCodex.join(', ')}.`,
      );
    }
    return;
  }
  if (!e.dataset && !e.object && !e.none) {
    throw new Error(`document('${type}') : \`edit\` exige \`dataset\`, \`object\`, \`niche\` ou \`none\` (raison).`);
  }
}

/**
 * Déclare un document. `champs` = la charge utile propre au type, `meta` = son libellé FR par clé,
 * `exposition` = Codex + éditeur, `options.variantes` = les champs qu'une variante réglée republie —
 * la fabrique compose `variantOf` elle-même, donc un champ hors de cette liste est refusé au parse et
 * un document sans `variantes` n'admet aucun `variants`.
 *
 * Elle rend AUSSI l'emballage du FICHIER (`schema`, par famille). Sur un document à CHARGE (`record`,
 * ou `options.rangee`), `champs`/`meta` décrivent les champs additionnels éventuels — le contenu,
 * lui, vit sous `entries`, que la fabrique pose seule (`options.valeurRecord`/`options.cleRecord` en
 * `record`, `options.rangee` ailleurs) et qu'un def ne redéclare pas.
 */
export function document<T extends string, C extends Record<string, z.ZodTypeAny>>(
  type: T,
  famille: FamilleDocument,
  champs: C & ChampsHorsEnveloppe<C>,
  meta: MetaDesChamps<C>,
  exposition: Exposition,
  options: OptionsDocument = {},
): DocumentHandle<T> {
  const { variantes, valeurRecord, cleRecord, idDocument, exiges = [], rangee, deDeTirage, affinerEntree, affinerDataset } = options;
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
  if (deDeTirage && !rangee) {
    throw new Error(`document('${type}') : \`deDeTirage\` exige \`rangee\` — un dé de tirage tire une RANGÉE.`);
  }
  /** La CHARGE de ce document : ce qu'aucun def ne redéclare dans `champs` (garde ci-dessous). */
  const clesCharge: readonly CleCharge[] = famille === 'record' ? ['entries'] : rangee ? ['entries', 'die'] : [];
  /** Celles que la fabrique pose RÉELLEMENT sur l'entrée — et dont elle publie la méta FR. */
  const clesPosees = clesCharge.filter((k) => k !== 'die' || deDeTirage);
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
  verifieExposition(type, exposition);
  const entree = z.strictObject({
    ...enveloppe(type, idDocument, exiges),
    ...(champs as Record<string, z.ZodTypeAny>),
  }) as z.ZodObject<z.ZodRawShape>;
  const declarees = [...(variantes ?? [])];
  for (const k of declarees) {
    if (!(k in entree.shape)) {
      throw new Error(`document('${type}') : « ${k} » est déclaré republiable par une variante, mais n'est pas un champ du document.`);
    }
  }
  const complet = declarees.length
    ? (z.strictObject({ ...entree.shape, variants: z.array(variantOf(entree, declarees)).optional() }) as z.ZodObject<z.ZodRawShape>)
    : entree;
  // SCEAU : `.pipe` rend un `ZodPipe` — ni `.extend` ni `.shape` AU RUNTIME, `safeParse`/`z.infer` et le
  // refus `strict` intacts (mesuré sur zod 4.4.3 : `.superRefine`/`.check`/`.refine`/`.brand` rendent,
  // eux, un `ZodObject` encore extensible).
  // La CHARGE (`entries`, et le `die?` d'un document à rangées) est posée ICI : `affinerEntree`,
  // `entreePartielle` et `cles` la voient comme n'importe quel champ. Les deux formes de charge
  // diffèrent par leur structure — record clé→valeur, liste ordonnée de rangées.
  const corps =
    famille === 'record'
      ? (z.strictObject({
          ...complet.shape,
          entries: z.record(cleRecord ?? z.string().min(1), valeurRecord!),
        }) as z.ZodObject<z.ZodRawShape>)
      : rangee
        ? (z.strictObject({
            ...complet.shape,
            ...(deDeTirage ? { die: z.string().min(1) } : {}),
            entries: z.array(rangee),
          }) as z.ZodObject<z.ZodRawShape>)
        : complet;
  const entreePartielle: z.ZodType<unknown> = corps.partial().pipe(z.transform((v) => v));
  const clesEntree: readonly string[] = Object.keys(corps.shape);
  // PROVENANCE : `source` OU `maison`, jamais NI L'UN NI L'AUTRE. Une entrée sans folio n'est pas
  // interdite — elle doit DIRE pourquoi. `exigeSource` consulte l'UNION `SANS_PROVENANCE_EXIGEE`
  // (`SANS_LIVRE` ∪ `SOURCE_EN_PROFONDEUR`) : sont hors régime les documents SANS aucun livre comme
  // ceux dont le livre est cité par SOUS-ENTRÉE — dans les deux cas rien n'est exigible à l'entrée de
  // racine. Refine PRÉ-sceau : `superRefine` rend un `ZodObject` encore extensible (mesuré zod
  // 4.4.3), donc `affinerEntree` reçoit bien un objet.
  // `exiges: ['source']` rend `source` structurellement requise : le refine ci-dessous ne s'exécute
  // alors que sur un objet dont `source` est déjà validée et ne peut JAMAIS lever — inatteignable par
  // construction, donc rien à éteindre ici (mesuré : un branchement qui l'éteindrait est inobservable).
  const avecProvenance = !exigeSource(type)
    ? corps
    : (corps.superRefine((v, ctx) => {
        const d = v as { source?: unknown; maison?: unknown };
        if (d.source === undefined && d.maison === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['source'],
            message: `document('${type}') : entrée sans \`source\` — un document sans folio porte \`maison\` (la raison de l'arbitrage).`,
          });
        }
      }) as z.ZodObject<z.ZodRawShape>);
  // PROSE : les verrous du texte et de son adresse (`grammaire/prose.ts`, V1-V4), au même stade et
  // pour la même raison que le refine de provenance ci-dessus — PRÉ-sceau, sur l'entrée entière.
  const avecProse = avecProvenance.superRefine(
    refineProse({ type, site: type, exigeProse: exiges.includes('desc') }),
  ) as z.ZodObject<z.ZodRawShape>;
  const affine = affinerEntree ? affinerEntree(avecProse) : avecProse;
  const entreeScellee: z.ZodType<unknown> = affine.pipe(z.transform((v) => v));

  // EMBALLAGE par FAMILLE (#1467) : le dataset est ce que le FICHIER porte — une LISTE d'entrées
  // (`entite`), ou l'entrée elle-même (`config`, `record`).
  const dataset: z.ZodType<unknown> = famille === 'entite' ? z.array(entreeScellee) : entreeScellee;
  const schema: z.ZodType<unknown> = affinerDataset ? affinerDataset(dataset) : dataset;
  const metaPubliee = { ...(meta as Record<string, MetaChamp>), ...Object.fromEntries(clesPosees.map((k) => [k, META_CHARGE[k]])) };
  return {
    schema,
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
