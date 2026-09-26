/**
 * VALEURS de la grammaire de document (#1466 L1a) — les types de VALEUR partagés par tout document
 * de l'application : source, dés, formule, difficulté, caractéristique, localisation, apparence,
 * variante réglée, recette de détail. Aucune dépendance à la MÉCANIQUE : sous la grammaire, ce
 * fichier ne compose que la RÉFÉRENCE (`refOuSpec`).
 */
import { z } from 'zod';
import { AVAILABILITIES, COUVERT_DIFFICULTES, REACH_LABELS, REACH_VARIABLE, STAKE_FORMS } from '../../../engine/types';
import { SLOTS } from '../../palette.types';
import { refOuSpec, idDe } from './ref';
import { estGraphieDeChapitre } from '../../source/decoupe';

/**
 * ENUM NOMMÉ (#1694) — la FABRIQUE d'un univers fermé dont chaque valeur porte son libellé FR SUR LE
 * NŒUD, à sa déclaration : `z.enum(Object.keys(valeurs)).meta({ valeurs })`. Couverture et ORDRE sont
 * vrais PAR CONSTRUCTION (les options SONT les clés de la table), si bien qu'aucun contrôle externe
 * n'a plus à les vérifier, et qu'un site d'affichage lit le libellé par `libelleDeValeur(noeud, v)`
 * (`grammaire/meta.ts`) au lieu de tenir sa propre table par valeur.
 *
 * Le porteur est le NŒUD, jamais la clé de premier niveau : un enum niché (`[].outcomes[].on`) ou
 * partagé par 2 950 chemins (`actorRefSchema`) se nomme UNE fois, ici, comme un champ de racine.
 *
 * Une valeur peut porter, EN PLUS de son libellé, un HINT mécanique (`hints`, même porteur : le nœud) :
 * ce que la règle FAIT quand cette valeur est choisie, lu par `hintDeValeur` (`grammaire/meta.ts`) et
 * rendu en infobulle d'option. Une réf nue, jamais une prose de source (règle stricte 5).
 *
 * `.extract`/`.exclude` sont REFUSÉS sur un enum nommé : zod 4.4.3 rend un NOUVEAU nœud dont la
 * `.meta()` est vide (mesuré) — le sous-univers perdrait ses libellés EN SILENCE. Un sous-univers se
 * déclare par son propre `enumNomme`. Le refus posé ci-dessous n'est PAS un verrou par construction :
 * il ne couvre que l'usage DIRECT de l'instance, un clone (`.describe(…)`, `.meta(…)`, `.optional()`)
 * rendant un nœud neuf qui reprend les méthodes de zod. Le verrou est la garde STRUCTURELLE de
 * `valeurs-de-champ.test.ts` : aucun `.extract(`/`.exclude(` sur un enum nommé dans `src/**`.
 */
export function enumNomme<const V extends Readonly<Record<string, string>>>(
  valeurs: V,
  hints?: Partial<Record<Extract<keyof V, string>, string>>,
) {
  type Cle = Extract<keyof V, string>;
  const options = Object.keys(valeurs) as [Cle, ...Cle[]];
  const noeud = z.enum(options).meta({ valeurs, ...(hints ? { hints } : {}) });
  const refuse = (op: string) => (): never => {
    throw new Error(
      `enumNomme : \`.${op}()\` sur un enum NOMMÉ rendrait un nœud SANS ses libellés de valeurs (zod 4.4.3 : la meta ne suit pas le sous-enum) — déclarer le sous-univers par son propre \`enumNomme\`.`,
    );
  };
  const site = noeud as unknown as Record<string, unknown>;
  site.extract = refuse('extract');
  site.exclude = refuse('exclude');
  return noeud;
}

/**
 * Nature d'une Mutation (`Mutation.kind`, `src/engine/corruption.ts`) — UNE déclaration pour les trois
 * nœuds qui portent ce vocabulaire : `mutations.kind` (`defs/mutations.ts`) et les deux capacités de
 * trait `mutationAtSpawn` / `markMutations.first` (`defs/traits.ts`). Un enum = une const nommée : un
 * jumeau redéclaré en `z.enum` rendrait un `select` ANONYME que rien ne suivrait, le stock de
 * `valeurs-de-champ.test.ts` se tenant par VOCABULAIRE.
 */
export const mutationKindSchema = enumNomme({ physique: 'Physique', mentale: 'Mentale' });

/**
 * Registre d'où DÉRIVE le pool de spécialisations d'une def (`SpecsSource`, `src/data/index.ts` ;
 * catalogue `SPEC_SOURCES`) — UNE déclaration pour les trois defs qui portent ce champ
 * (`skills`/`talents`/`traits`), qui en tenaient chacune une copie. La couverture est TOTALE (16/16 de
 * `SPEC_SOURCES`, verrouillée par `grammaire/enums-nommes-grammaire.test.ts`) : elle ne peut pas être
 * partielle, les options SONT les clés de la table. `weaponsMelee`/`weaponsRanged` portent le
 * libellé de la catégorie de catalogue que leur `pool()` FILTRE (`trappings.categorie`,
 * `defs/trappings.ts`), seule graphie FR déjà posée sur ce filtre.
 */
export const specsSourceSchema = enumNomme({
  weaponGroupsMelee: 'Groupes d’arme (mêlée)',
  weaponGroupsRanged: 'Groupes d’arme (distance)',
  winds: 'Vents de magie',
  arcaneDomains: 'Domaines arcaniques',
  cultBlessings: 'Bénédictions (dieux)',
  cultMiracles: 'Miracles (dieux)',
  cultChaos: 'Magie du Chaos (dieux)',
  seaShanties: 'Chansons de marin',
  groups: 'Groupes (créatures/factions)',
  diseases: 'Maladies',
  sizes: 'Tailles',
  mutations: 'Mutations',
  breathTypes: 'Types de Souffle',
  damageTypes: 'Types de Dégâts (immunité)',
  weaponsMelee: 'Armes de mêlée',
  weaponsRanged: 'Armes à distance',
});

/**
 * Sévérité d'un symptôme de Maladie (`SymptomSeverity`, `src/data/index.ts`) — UNE déclaration pour
 * les trois nœuds qui portent ce vocabulaire : `maladies.symptoms[].severity` (`defs/maladies.ts`) et
 * les charges des ops `aggravateSymptom`/`grantSymptom` (`grammaire/mecanique.ts`).
 */
export const symptomSeveritySchema = enumNomme({ moderee: 'Modérée', grave: 'Grave' });

/**
 * Alignement d'une source de Corruption (`ChaosAlign`, `src/engine/corruption.ts`) — UNE déclaration
 * pour les deux nœuds qui portent ce vocabulaire : la charge de l'op `corruption`
 * (`grammaire/mecanique.ts`) et l'effet de scène `corruption.align` (`defs-scenes/effets.ts`).
 */
export const chaosAlignSchema = enumNomme({
  toute: 'Toute Puissance',
  khorne: 'Khorne',
  nurgle: 'Nurgle',
  slaanesh: 'Slaanesh',
  tzeentch: 'Tzeentch',
});

/**
 * Palier d'une Influence corruptrice (`ExposureLevel`, `src/engine/corruption.ts` ; LDB 19 l.23-75) —
 * UNE déclaration pour la charge de l'op `corruptionExposure` (`grammaire/mecanique.ts`) et l'effet de
 * scène `corruptionExposure.level` (`defs-scenes/effets.ts`).
 */
export const exposureLevelSchema = enumNomme({ mineure: 'mineure', moderee: 'modérée', majeure: 'majeure' });

/**
 * `Dir8` (`src/state/dir8.ts`) — orientation MONDE à huit aires, UNE déclaration pour les deux nœuds
 * qui la portent : `entities[].facing` d'une Scène (`defs-scenes/scene.ts`) et le cap d'une place assise
 * de décor (`defs/props.ts`).
 */
export const dir8Schema = enumNomme({
  N: 'Nord',
  NE: 'Nord-Est',
  E: 'Est',
  SE: 'Sud-Est',
  S: 'Sud',
  SO: 'Sud-Ouest',
  O: 'Ouest',
  NO: 'Nord-Ouest',
});

/**
 * Disponibilité (`Availability`, `src/engine/types.ts`) — le schéma DÉRIVE du tuple canon au lieu de
 * retaper ses 4 paliers : c'est la porte unique des defs (`disponibilite`, `creatures`, `vehicles`,
 * `trappings`).
 */
export const availabilitySchema = z.enum(AVAILABILITIES);

/**
 * Rareté d'une pièce de créature récoltée (`HarvestRarity`, `src/data/index.ts`) = les paliers de
 * Disponibilité + `'Unique'`. Le 5ᵉ palier est RAW, pas une dérive : la table « COÛT DE BASE POUR
 * 1 ENC DE PIÈCES DE CRÉATURE BRUTES » imprime cinq colonnes (`ZI 13 l.286`).
 */
export const harvestRaritySchema = z.enum([...AVAILABILITIES, 'Unique']);

/**
 * Forme déclarée d'un texte d'enjeu (`StakeForm`, `src/engine/types.ts`) — porte unique des 6 defs
 * qui portent un enjeu (`night-stakes`, `flow-stakes`, `combat-stakes`, `activities`, `psychology`,
 * `maneuvers`). L'OPTIONALITÉ reste au site : elle se décide par def, pas ici.
 */
export const stakeFormSchema = z.enum(STAKE_FORMS);

/**
 * Réf de source récurrente `{ book, page }` — vue sur 2-3 datasets (`characteristics.json`,
 * `species.json`/`SpeciesData.source`, `careers.json`/`CareerData.source` dans `src/data/index.ts`) :
 * même forme partout. `book` = id de `books.json` (id-pur, cf. commit `21aa4881`) ; `page` = folio
 * IMPRIMÉ du livre, JAMAIS l'index de la ré-extraction Marker (piège prouvé par la garde
 * `scripts/guards/lib/folioIntegrity.mjs`, qui recoupe la `desc` verbatim et les `data-folio`).
 */
export const sourceRefSchema = z.strictObject({
  book: z.string(),
  page: z.number(),
  /** Précision optionnelle (ch./l. du passage, portée VERBATIM…). Aucune LOGIQUE DE JEU ne la lit ;
   *  une GARDE la lit désormais : quand elle est de la forme `<ABRÉV> <ch> l.<ligne>`,
   *  `scripts/guards/lib/folioLineAlign.mjs` la confronte au marqueur `data-folio` qui gouverne cette
   *  ligne — `page` et `note` doivent désigner le même endroit (#1318 E8). Toute autre forme est
   *  ignorée par la garde (aucune contrainte de saisie ajoutée). */
  note: z.string().optional(),
});

/** Vue TS de `sourceRefSchema` — SEULE forme à importer côté `src/data/index.ts` (jamais `{ book:
 *  string; page: number }` inline, F20). Réf de source UNIQUE du repo (#278) : posée par ENTRÉE sur
 *  les datasets d'extraction de table RAW (`sea-events`/`sea-navigation`/`sea-perils`/`sea-weather`/
 *  `ship-construction`/`naval-progression`/`crew-morale`/`crew-test-types`/`mass-battle`/
 *  `land-cargo`/`sea-cargo`/`river-navigation`/`river-perils`), à la racine quand le dataset est un
 *  objet de config unique plutôt qu'une liste. */
export type SourceRef = z.infer<typeof sourceRefSchema>;

/**
 * Emplacement SECONDAIRE d'une entrée définie à plusieurs endroits (#563 — doctrine user 2026-07-17 :
 * « jamais 2 talents différents », mais un même Talent/Trait/Qualité peut être réimprimé ailleurs).
 * L'ANCRE (`source`, scalaire, inchangée) reste seule à porter la `desc` (règle stricte 5,
 * STRUCTURELLE — jamais `refs[0]` positionnel, indémontable par réordonnancement d'éditeur).
 * `quote` = auto-attestation authorée (verbatim, prouvable dans le span du folio déclaré) pour les cas
 * où le `label` de l'entrée n'apparaît pas tel quel dans ce span (ex. une TABLE imprime un nom
 * différent — `zweihander-flamberge`) : charge de la preuve sur l'auteur, comme `desc` pour l'ancre.
 */
export const secondarySourceRefSchema = sourceRefSchema.extend({
  /** Preuve verbatim authorée que l'entrée est bien à cet emplacement (ligne de stats d'une table,
   *  phrase distinctive…) — distinct de `note` (display-only, jamais vérifié). */
  quote: z.string().optional(),
});
/** Vue TS de `secondarySourceRefSchema` — porté par le champ `alsoIn?: SecondaryRef[]` de toute
 *  entrée multi-emplacement. Accesseurs `allLocations`/`sourceBooks` (`src/data/index.ts`). */
export type SecondaryRef = z.infer<typeof secondarySourceRefSchema>;

/**
 * FRAGMENT DE BLOCS d'une adresse de prose : la suite CONTIGUË `b0..b1` des blocs d'affichage d'une
 * section de chapitre, plus l'empreinte du texte normalisé qu'elle rend. Forme et sémantique du
 * parseur `src/data/source/decoupe.ts` (`FragmentBlocs`) — les deux définitions coïncident, et
 * `grammaire.test.ts` le vérifie AU TYPE.
 */
export const fragmentBlocsSchema = z.strictObject({
  kind: z.literal('blocs'),
  sec: z.string(),
  secOcc: z.number().int().min(1),
  b0: z.number().int().min(0),
  b1: z.number().int().min(0),
  sum: z.string().regex(/^[0-9a-f]{16}$/),
});

/**
 * FRAGMENT DE CELLULE : une case de table, adressée par clé de LIGNE × en-tête de COLONNE — jamais
 * par indices, qu'une ré-extraction déplacerait. `row`/`col` sont des CHAÎNES : la clé de ligne d'une
 * table de d100 (`01-10`) n'est pas un nombre. `table` : `TableDeSection.cle` (`decoupe.ts`).
 */
export const fragmentCelluleSchema = z.strictObject({
  kind: z.literal('cellule'),
  sec: z.string(),
  secOcc: z.number().int().min(1),
  row: z.string().min(1),
  col: z.string().min(1),
  table: z.string().regex(/#\d+$/).optional(),
  sum: z.string().regex(/^[0-9a-f]{16}$/),
});

/**
 * Nombre de fragments qu'une adresse doit porter pour ADRESSER quelque chose. En dessous, il n'y a
 * pas d'adresse : il y a un livre choisi, et un passage encore à désigner. SEUIL UNIQUE — le schéma
 * `descRefSchema` le pose (`.min`), et `adresseUnPassage` le lit : l'écran et le disque tranchent pareil.
 */
export const MIN_FRAGMENTS = 1;

/**
 * L'adresse portée par une entrée DÉSIGNE-t-elle effectivement un passage ? C'est la définition
 * d'une adresse COMPLÈTE côté écran : en cours de composition (`{ book, ch: '', parts: [] }`, ce que
 * `DescRefField` rend dès le choix du livre), l'adresse ne résout rien — la prose appartient encore à
 * l'auteur. Accepte de l'`unknown` : l'appelant édite des objets de donnée non typés (`estDerive`,
 * `src/ui/compendium/editFields.ts`).
 */
export function adresseUnPassage(ref: unknown): boolean {
  const parts = (ref as { parts?: unknown } | null | undefined)?.parts;
  return Array.isArray(parts) && parts.length >= MIN_FRAGMENTS;
}

/**
 * ADRESSE DE PROSE (#1389, épique #1388 §2.2) — ce qu'une entrée porte À LA PLACE de la prose
 * recopiée du livre : le livre, le chapitre, et jusqu'à TROIS fragments d'un même chapitre.
 *
 * Les verrous sont STRUCTURELS : un seul chapitre par construction (`ch` est à la racine), au plus
 * trois fragments (un montage plus long n'est plus une citation mais une réécriture), et chaque
 * fragment porte son empreinte `sum` — sans elle, une ré-extraction du livre changerait le texte
 * rendu en silence. Les verrous de COHÉRENCE (exclusivité avec `desc`, résolubilité du livre,
 * accord avec `source`) vivent dans `grammaire/prose.ts`, avec le champ qui les porte.
 */
export const descRefSchema = z
  .strictObject({
    book: z.string().min(1),
    /** Numéro de chapitre dans la GRAPHIE de son fichier d'extraction (`07`, `21`, `105`), jugée par
     *  le prédicat de sa maison (`estGraphieDeChapitre`, `src/data/source/decoupe.ts`) : des
     *  chiffres, deux au minimum, et un numéro de chapitre — `00` désigne l'index. La largeur JUSTE
     *  pour le livre se juge contre le disque, là où le livre est connu
     *  (`src/data/prose-resolution.test.ts`, volet F). */
    ch: z.string().refine(estGraphieDeChapitre, {
      message: 'adresse de prose : `ch` est la graphie d’un numéro de CHAPITRE — des chiffres, deux au minimum, et pas `00` (l’index n’est pas un chapitre).',
    }),
    parts: z.array(z.discriminatedUnion('kind', [fragmentBlocsSchema, fragmentCelluleSchema])).min(MIN_FRAGMENTS).max(3),
  })
  .superRefine((v, ctx) => {
    v.parts.forEach((p, i) => {
      if (p.kind === 'blocs' && p.b1 < p.b0) {
        ctx.addIssue({
          code: 'custom',
          path: ['parts', i, 'b1'],
          message: `adresse de prose : bornes inversées (\`b1\` ${p.b1} < \`b0\` ${p.b0}) — un fragment de blocs est une suite contiguë.`,
        });
      }
    });
  });

/** Vue TS de `descRefSchema` — la MÊME forme que `DescRef` du parseur (`src/data/source/decoupe.ts`). */
export type DescRef = z.infer<typeof descRefSchema>;

/**
 * ENTRÉE DE CATALOGUE DE SPÉCIALISATION (`SpecEntry`, `src/data/index.ts`) — ce qu'une def de
 * Compétence/Talent énumère sous `specs[]` : l'id STABLE manipulé par la logique, son `label` FR
 * d'affichage, l'attestation de l'entrée quand elle vient d'un autre folio (`source`/`alsoIn`), et
 * `pool: false` pour une entrée VALIDE mais non PROPOSÉE d'office (`LDB 09 l.40`). SOURCE UNIQUE :
 * `skills.ts` et `talents.ts` la composent, aucun des deux ne la retape — c'est le catalogue que
 * `specRef`/`refOuSpec` confrontent (`grammaire/ref.ts`, registre `SPECS_PAR_DATASET`).
 */
export const specEntrySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  source: sourceRefSchema.optional(),
  alsoIn: z.array(secondarySourceRefSchema).optional(),
  pool: z.literal(false).optional(),
});

// ============================================================================
// COMBAT FEATURE (`src/engine/combatFeatures/types.ts`) — sac de flags CLOS conféré par un Talent/Trait,
// `aa` récursif (variante « Avantage de groupe », Aux Armes Annexe I). Promu ici (partagé avec
// `talents.ts`) : SOURCE UNIQUE pour tout schéma qui porte `combat`/`variants[].combat`.
// La FORME est retapée ici, pas dérivée : `CombatFeature` est un TYPE, sans contrepartie runtime à
// importer (au contraire d'`AVAILABILITIES`/`STAKE_FORMS`, tuples importés de `src/engine/types` l.8).
// Reflet FIDÈLE de l'interface TS — une dérive rougit au parse des données qui portent `combat`.
// ============================================================================

export const castingKindSchema = z.enum(['mineure', 'arcane', 'invocation', 'beni', 'chaos']);

export const combatFeatureSchema: z.ZodType<unknown> = z.lazy(() =>
  z.strictObject({
    offHandPenalty: z.strictObject({ perLevel: z.number(), zeroAt: z.number() }).optional(),
    attackModes: z.array(z.string()).optional(),
    meleeDamageBonus: z.boolean().optional(),
    rangedDamageBonus: z.boolean().optional(),
    brawlDamageBonus: z.boolean().optional(),
    chargeDamageBonus: z.boolean().optional(),
    slayer: z.boolean().optional(),
    damageReduction: z.boolean().optional(),
    critExtraWounds: z.boolean().optional(),
    rangedAPIgnore: z.boolean().optional(),
    ignoreCalledShotHead: z.boolean().optional(),
    ignoreCalledShotRanged: z.boolean().optional(),
    ignoreSizeRangedMods: z.boolean().optional(),
    sniper: z.boolean().optional(),
    initiativeBonus: z.boolean().optional(),
    strikeFirstRanged: z.boolean().optional(),
    surpriseSave: z.boolean().optional(),
    reloadDR: z.enum(['all', 'blackpowder']).optional(),
    runBonus: z.boolean().optional(),
    fleeBonus: z.boolean().optional(),
    pursuitTargetBonus: z.boolean().optional(),
    shieldAdvantage: z.boolean().optional(),
    advantageDefenseReaction: z.strictObject({ avantage: z.number() }).optional(),
    counterOnDefenseWin: z.boolean().optional(),
    counterRequiresFastParry: z.boolean().optional(),
    stealAdvantage: z.boolean().optional(),
    stealOne: z.boolean().optional(),
    transferWeight: z.number().optional(),
    reloadAssessAdvantage: z.boolean().optional(),
    fearSizeAsMount: z.boolean().optional(),
    retreatCost: z.number().optional(),
    keepAdvantageOnDisengage: z.boolean().optional(),
    disengageWithLessAdvantage: z.boolean().optional(),
    battement: z.boolean().optional(),
    distraire: z.boolean().optional(),
    outnumberCount: z.boolean().optional(),
    braveheart: z.boolean().optional(),
    fearImmune: z.boolean().optional(),
    bleedIgnore: z.boolean().optional(),
    focusNoMiscastOnDouble: z.boolean().optional(),
    castNoMiscastOnDouble: z.boolean().optional(),
    causesFear: z.boolean().optional(),
    reverseFailed: z.strictObject({ skills: z.array(refOuSpec('skill')).min(1), capDR: z.number().optional() }).optional(),
    bargainBonus: z.boolean().optional(),
    encumbranceBonus: z.boolean().optional(),
    corruptionThreshold: z.boolean().optional(),
    surgery: z.boolean().optional(),
    castingKind: castingKindSchema.optional(),
    commandTeam: z.boolean().optional(),
    seaShanty: z.boolean().optional(),
    critRollTwice: z.boolean().optional(),
  }),
);

/**
 * `RuleValue` (`src/engine/policy.ts:44`) — valeur effective d'une règle optionnelle du registre
 * `OPTIONAL_RULES` (`policy.ts:43`, lue par `rule(id)`). Union fermée retapée, même raison que
 * `combatFeatureSchema` ci-dessus : le type n'a pas de contrepartie runtime à dériver.
 */
export const ruleValueSchema = z.union([z.boolean(), z.number(), z.string()]);

/** Garde d'une variante RÉGLÉE : la règle optionnelle visée et la valeur attendue. `rule` DOIT être
 *  un id du registre `OPTIONAL_RULES` (`src/engine/policy.ts:43`), jamais un label ni un flag
 *  parallèle (gardes `src/data/variants-integrity.test.ts`) ; `equals` défaut `true`. */
export const variantWhenSchema = z.strictObject({ rule: z.string(), equals: ruleValueSchema.optional() });

/**
 * Fabrique de VARIANTE d'un dataset (#563/#564 — ex. « Aux Armes, Annexe I : Avantage de groupe »).
 * Une variante est un PATCH PARTIEL de l'entrée, TYPÉ PAR SON DATASET et RESTREINT aux champs que ce
 * dataset RÉSOUT réellement par `effectiveEntry` : `resolved` est la liste blanche, chaque def
 * déclare la sienne (`VARIANT_RESOLVED_FIELDS`) et n'y inscrit un champ qu'une fois son consommateur
 * routé par `effectiveEntry` — un champ admis mais lu BRUT ferait diverger l'affichage et le moteur.
 * À composer dans chaque def :
 * `variants: z.array(variantOf(<schéma d'ENTRÉE, sans le champ `variants`>, VARIANT_RESOLVED_FIELDS)).optional()`.
 *
 * Sémantique de fusion : REPLACE par champ DÉCLARÉ, au premier niveau (`effectiveEntry`,
 * `src/engine/variants.ts`) — un champ absent de la variante est hérité de l'entrée de base, un champ
 * présent remplace celui de base EN ENTIER (le livre republie l'entrée entière ; aucune fusion profonde
 * implicite). `desc`/`source` d'une variante portent la règle stricte 5 (verbatim + folio) comme
 * l'ancre — `folioIntegrity.mjs:citedEntriesOf` les découvre déjà à toute profondeur (#563 Lot 3).
 */
export function variantOf<T extends z.ZodRawShape, K extends Extract<keyof T, string>>(
  entrySchema: z.ZodObject<T>,
  resolved: readonly K[],
) {
  const mask = Object.fromEntries(resolved.map((k) => [k, true]));
  const picked = entrySchema.pick(mask as Parameters<typeof entrySchema.pick>[0]) as unknown as z.ZodObject<Pick<T, K>>;
  return picked.partial().extend({ when: variantWhenSchema });
}

/** Vue TS COMMUNE d'une variante — le contrat de FORME (runtime) est celui de `variantOf` par dataset ;
 *  cette vue expose les champs partagés par tous les porteurs et laisse les autres en `unknown`. Portée
 *  par le champ `variants?: Variant[]` de toute entrée à variante réglée (`activeVariant`/`effectiveEntry`,
 *  `src/engine/variants.ts`). */
export type Variant = {
  when: { rule: string; equals?: z.infer<typeof ruleValueSchema> };
  desc?: string;
  source?: SourceRef;
  [field: string]: unknown;
};

/**
 * Recette de détail de surface (`DetailRecipe`, `src/gameIso/detail/types.ts`) — portée par le champ
 * optionnel `detail` de 2 datasets d'apparence (`materials.json` — domaines `roof` et `relief` — et
 * `structureAppearance.json`). Reflet STRICT de l'interface TS (mêmes sous-objets/champs requis).
 */
export const detailRecipeSchema = z.strictObject({
  courses: z
    .strictObject({
      hM: z.number(),
      joint: z.string(),
      jointW: z.number(),
      stagger: z.number().optional(),
      blockWM: z.tuple([z.number(), z.number()]).optional(),
      edgeWobble: z.number().optional(),
      paletteVar: z.number().optional(),
    })
    .optional(),
  bands: z.array(z.strictObject({ atV: z.number(), hM: z.number(), color: z.string() })).optional(),
  timber: z
    .strictObject({
      postEveryM: z.number(),
      braces: z.enum(['X', 'V']).optional(),
      wM: z.number(),
      color: z.string(),
    })
    .optional(),
  speckle: z
    .strictObject({
      perM2: z.number(),
      rM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
      vBias: z.number().optional(),
    })
    .optional(),
  tufts: z
    .strictObject({
      perM2: z.number(),
      hM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
    })
    .optional(),
  tintVar: z.number().optional(),
  seedScope: z.enum(['edge', 'tile', 'instance']),
});

/**
 * Niveau de `Difficulty` (`src/engine/types.ts`) tel qu'il apparaît en DONNÉE — vu sur plusieurs
 * datasets naval-commerce (`sea-navigation.json`, `sea-cargo.json`, `land-cargo.json`,
 * `sea-weather.json`) qui portent tous des champs `difficulty`/`*Difficulty` typés `Difficulty` par
 * leurs consommateurs (`DATA as unknown as { ... difficulty: Difficulty ... }`). Les 10 valeurs du
 * type canon (LDB Tests + extrêmes EDO App.2) — pas seulement le sous-ensemble présent aujourd'hui —
 * car c'est le type que les consommateurs attendent, une future entrée peut légitimement en ajouter.
 */
export const difficultySchema = z.enum([
  'tresFacile',
  'facile',
  'accessible',
  'intermediaire',
  'complexe',
  'difficile',
  'tresDifficile',
  'presqueImpossible',
  'impossible',
]);

/**
 * Sous-ensemble de `difficultySchema` que la colonne « Pénalité de Couvert » d'une Structure peut porter
 * (`AA 10 l.28-51`) : les quatre échelons auxquels une classe de couvert répond (`CoverClass`,
 * `engine/cover.ts`). DÉRIVE du tuple canon `COUVERT_DIFFICULTES` (`src/engine/types.ts`) par
 * `.extract` — il ne re-tape rien.
 */
export const couvertDifficultySchema = difficultySchema.extract(COUVERT_DIFFICULTES);

/**
 * `CharKey` (`src/engine/types.ts`) — les 10 Caractéristiques. Réf récurrente (Conditions `compare`,
 * `Formula.bonusOf`/`charOf`, `FlowTest.characteristic`, `AdvancementRef`…) — porte UNIQUE des defs qui
 * nomment une Caractéristique (`domains`/`maneuvers`/`qualities`/`talents`/`etats`/`spells`/`species`/
 * `careerLevels`…).
 */
export const charKeySchema = z.enum([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

/**
 * Clés d'un PROFIL chiffré : les 10 Caractéristiques ∪ `M` (Déplacement) ∪ `B` (Blessures) — la
 * graphie de `CustomStatblock.char` (`src/engine/statblock.ts`) et des profils de créature. `M` et `B`
 * ne sont pas des Caractéristiques à jet : ils n'entrent donc pas dans `charKeySchema`, dont ils
 * fausseraient toutes les autres portes (Conditions, `Formula.bonusOf`, `FlowTest`…).
 */
export const charStatKeySchema = z.enum([...charKeySchema.options, 'M', 'B']);

/** `SizeCategory` (`src/engine/size.ts:14`) — CANON de la Taille (LDB 85), porte UNIQUE des defs qui
 *  nomment une catégorie (`trappings.sizeFor`, `CustomStatblock.size`). */
export const sizeCategorySchema = enumNomme({
  minuscule: 'Minuscule',
  tresPetite: 'Très petite',
  petite: 'Petite',
  moyenne: 'Moyenne',
  grande: 'Grande',
  enorme: 'Énorme',
  monstrueuse: 'Monstrueuse',
});

/** Couleur `#rrggbb` en minuscules, la SEULE graphie de couleur du dépôt : toute couleur persistée, dont
 *  chaque surcharge de palette du rig (`buildTokenMap`/`tableDObjet`, #1903 A6). */
export const couleurHexSchema = z.string().regex(/^#[0-9a-f]{6}$/, 'couleur hexadécimale « #rrggbb » attendue');

/** SURCHARGE de palette persistée (`Palette`, `src/gameIso/rig/palette.ts`) : clés dans `SLOTS`, valeurs
 *  `couleurHexSchema` (#1903). `buildTokenMap` ne lit une surcharge que sur une base : une clé de rôle
 *  (`…O`/`…H`) n'est pas une clé de surcharge. `colors` d'apparence et d'espèce, `skin` d'objet, d'op et
 *  d'effet de scène. */
export const surchargePaletteSchema = z.partialRecord(z.enum(SLOTS), couleurHexSchema);

/** `ReachValue` (`src/engine/types.ts`) : les SEPT longueurs de l'axe d'Allonge (LDB 62 l.156-164) ou
 *  « Variable » (Arme improvisée, l.31). Vocabulaire FERMÉ, validé au CHARGEMENT (fail-fast) : hors de
 *  cette liste, `reachIdOf` ne rendrait aucun rang et toute règle d'Allonge se tairait en silence. */
export const reachSchema = z.enum([REACH_VARIABLE, ...Object.values(REACH_LABELS)]);

/** `Money` (`src/engine/money.ts:10`) — bourse à 3 dénominations, toutes CHIFFRÉES : la forme des
 *  CATALOGUES (`trappings`/`creatures`/`vehicles`/`crew-roles`/`mass-battle`), qui impriment un montant complet. */
export const moneySchema = z.strictObject({ gold: z.number(), silver: z.number(), brass: z.number() });

/** Montant PARTIEL authoré (coût d'un choix, mise minimale, octroi) — mêmes 3 dénominations, chacune
 *  facultative ; `toMoney` (`src/engine/money.ts`) normalise en `Money` plein les dénominations absentes. */
export const moneyPartialSchema = z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() });

/** `DiceSpec` (`src/engine/dice.ts`) — jet `{n, sides, plus?}`, partagé par `CountSpec.roll` et `Formula.dice`. */
export const diceSpecSchema = z.strictObject({ n: z.number(), sides: z.number(), plus: z.number().optional() });

/** `ShipSize` (`src/data/index.ts`) — les sept Tailles de bateau du tableau standard (`MDG 12 l.122-129`),
 *  dérivées de la LONGUEUR par `shipSizeOfLength` (`src/engine/shipBuild.ts`). Déclarées ICI une fois :
 *  `ship-construction` (colonne Taille), `sea-perils` (bornes min/max) et `ship-criticals` (bandes de la
 *  table « Tomber du gréement ») les lisent, aucun ne les réécrit. */
export const shipSizeSchema = enumNomme({
  minuscule: 'Minuscule',
  'tres-petite': 'Très petite',
  petite: 'Petite',
  moyenne: 'Moyenne',
  grande: 'Grande',
  enorme: 'Énorme',
  monstrueuse: 'Monstrueuse',
});

/** `ShipLocation` (`src/engine/combat.ts`) — les Localisations de coque des DEUX jeux de Critiques
 *  (MDG naval : cargaison/gréement/coque/avirons/équipements ; MSRC fluvial : gouvernail/superstructure). */
export const shipLocationSchema = z.enum(['cargaison', 'greement', 'coque', 'avirons', 'equipements', 'gouvernail', 'superstructure']);

/** Localisation qui encaisse un coup à l'Équipage quand PERSONNE n'est exposé (`MDG 13 l.584` RAW ;
 *  `MSRC 07 l.70`, arbitrage `maison` du choix que le livre laissait au MJ) — déclarée ICI une fois :
 *  `ship-criticals` et `river-criticals` la LISENT, aucun ne la réécrit. */
export const replisSansExposeSchema = z.strictObject({
  cible: shipLocationSchema,
  maison: z.string().optional(),
});

/**
 * UNE VALEUR PAR SAISON — les deux livres de commerce impriment leurs tableaux en quatre colonnes
 * saisonnières (`Season`, `src/engine/travelStages.ts`) : disponibilité d100 (MDG 15 l.406-418, MSRC 13
 * l.73-78) comme prix de base (MDG 15 l.422-434, MSRC 13 l.84-89). Les quatre clés se déclarent ICI,
 * une seule fois pour le dépôt ; ce que la colonne CONTIENT reste au porteur.
 */
export const parSaison = <T extends z.ZodTypeAny>(valeur: T) =>
  z.strictObject({ printemps: valeur, ete: valeur, automne: valeur, hiver: valeur });

/**
 * PRIX DE BASE d'une cargaison par SAISON (MDG 15 l.422-434, MSRC 13 l.80-90) : le résolveur y lit la
 * colonne de la saison courante. Le concept `prix` du lexique n'avait AUCUN nœud ici — les deux defs
 * le retapaient à l'identique.
 */
export const prixSaisonnierSchema = parSaison(z.number());

/**
 * PRIX TIRÉ AU DÉ — une case du tableau de prix porte un jet au lieu d'un nombre (MDG 15 l.429 : le Vin
 * maritime est à « 3d10 » aux quatre saisons, tiré une fois à l'achat et NOTÉ, l.436). Le dé est le
 * `DiceSpec` unique du projet, jamais une expression en chaîne.
 *
 * Les deux branches s'exportent SÉPARÉMENT : chaque site compose l'union qu'il admet — un porteur de
 * prix qui n'a pas de saisons (`trappings.price`) ne doit pas hériter des colonnes par une union
 * fourre-tout.
 */
export const prixTireSchema = z.strictObject({ dice: diceSpecSchema });

/** `{x,y}` en CASES de grille — position d'un poste de pont (`vehicles.json`) comme case d'ABORD
 *  d'une place assise (`props.json`). */
export const cell2Schema = z.strictObject({ x: z.number().finite(), y: z.number().finite() });

/**
 * `raceKey` — id STABLE des 7 espèces jouables (LDB + suppléments), patron `defs/characteristics`
 * (#310). Clé de `species.json.refChar`, `hairs.json`/`eyes.json.color`, `details.json.ageBase`/
 * `ageRoll`/`heightBase`/`heightRoll` (#313 — ces 4 Record étaient label-keyés). `names.json` en
 * reste EXCLU par exception documentée (`defs/names.ts`) : le label EST la donnée affichée.
 */
export const raceKeySchema = z.enum(['humain', 'halfling', 'nain', 'gnome', 'ogre', 'haut-elfe', 'elfe-sylvain']);
export type RaceKey = z.infer<typeof raceKeySchema>;

/**
 * `refCareerId` — `raceKeySchema` + 4 variantes culturelles humaines (Middenheim/Middenland/
 * Nordland/Norse) du Tableau des Classes et Carrières aléatoires (LDB 05 l.197+). Clé de
 * `species.json.refCareer` et `careers.json.rand` (#313).
 */
export const refCareerIdSchema = z.enum([
  'humain', 'halfling', 'nain', 'gnome', 'ogre', 'haut-elfe', 'elfe-sylvain',
  'middenheim', 'middenland', 'nordland', 'norse',
]);
export type RefCareerId = z.infer<typeof refCareerIdSchema>;

/**
 * `CastingNumberMod` (`src/engine/castingNumber.ts`) — modificateur de NIVEAU D'INCANTATION porté
 * par un objet, un lieu, un support de lecture ou une Activité. Partagé par tous les datasets qui
 * en portent (`arcane-phenomena.json`, `rituals.json`).
 */
export const castingNumberModSchema = z
  .strictObject({
    multiply: z.number().optional(),
    divide: z.number().optional(),
    round: z.enum(['inferieur', 'superieur']).optional(),
    delta: z.number().optional(),
    min: z.number().optional(),
    scope: z
      .strictObject({
        domains: z.array(z.string()).min(1).optional(),
        domainsExcept: z.array(z.string()).min(1).optional(),
        chaosMagic: z.boolean().optional(),
        spellIds: z.array(z.string()).min(1).optional(),
        kinds: z.array(z.enum(['sort', 'rituel'])).min(1).optional(),
      })
      .optional(),
    /** Valeur maison ÉDITABLE portant sa justification, quand le RAW laisse un point ouvert
     *  (sens d'arrondi non imprimé…) — CLAUDE.md règle 7. */
    maison: z.string().optional(),
    source: sourceRefSchema,
    /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
    desc: z.string(),
  })
  .refine((m) => m.divide == null || m.round != null, {
    message: 'castingNumberMod : une division de NI doit déclarer son sens d’arrondi (`round`)',
  })
  .refine((m) => m.multiply != null || m.divide != null || m.delta != null, {
    message: 'castingNumberMod : un modificateur sans `multiply`/`divide`/`delta` ne modifie rien',
  });

/** `CountSpec` (`src/data/index.ts`) — quantité fixe ou tirage de dés. Dupliqué dans `careerLevels`/
 *  `classes`/`creatures`. */
export const countSpecSchema = z.union([
  z.strictObject({ fixed: z.number() }),
  z.strictObject({ roll: diceSpecSchema }),
]);

/** `EntityAppearance` (`src/engine/authoringAppearance.ts`) — apparence d'entité (créature/trait/mutation).
 *  Dupliqué à l'identique dans `creatures`/`traits` ; `mutations` l'étend d'un `legs` anomalique
 *  (cf. `mutations.ts`, non repris ici — anomalie propre à ce seul dataset). */
export const entityAppearanceSchema = z.strictObject({
  seed: z.number().optional(),
  monster: z
    .strictObject({
      tete: z.string().optional(),
      brasG: z.string().optional(),
      brasD: z.string().optional(),
      jambes: z.string().optional(),
      cornes: z.boolean().optional(),
      queue: z.boolean().optional(),
      ailes: z.boolean().optional(),
    })
    .optional(),
  colors: surchargePaletteSchema.optional(),
  parts: z.strictObject({ cheveux: z.number().optional(), visage: z.number().optional() }).optional(),
  sex: z.enum(['M', 'F']).optional(),
  build: z.number().optional(),
  species: z.string().optional(),
  tenue: z.string().optional(),
  /** Set d'ÉQUIPEMENT quadrupède porté (id du registre `gameIso/rig/quadruped/harnais`, #1128) —
   *  absent = bête nue. */
  harnais: z.string().optional(),
  /** Armure de statblock (PA par localisation, sans inventaire) VISIBLE/portée (#774) — défaut
   *  absent : les PA restent mécaniques PURS, aucun art d'armure synthétisé (nu de l'espèce/naturel). */
  armurePortee: z.boolean().optional(),
  eyes: z.strictObject({ G: z.string().optional(), D: z.string().optional() }).optional(),
  features: z.array(z.string()).optional(),
});

/** `HitLocation` (`src/engine/types.ts`) — 6 zones de touche (dé inversé, LDB). Resserré depuis
 *  `z.string()` (variantes `domains`/`talents`/`etats`/`spells`) sur l'enum SOURCE : aucune des 9 JSON
 *  ne porte de valeur hors de ces 6 (vérifié au parse). */
export const hitLocationSchema = z.enum(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']);

/** `Formula` (`src/engine/ops.ts:87`) — quantité résolue à l'application (littéral/dés/bonus/Indice/
 *  jet-associé/pions/écart d'Avantage/Blessures/somme/facteur/borne basse). Resserré ici sur `CharKey`
 *  (fidèle à `src/engine/ops.ts:87`), sans risque pour les datasets (vérifié au parse). */
/** Feuille de référence du terme `{rule}`, instanciée UNE fois : `formulaSchema` est un `z.lazy` que
 *  chaque composition ré-évalue — une fabrique appelée DANS le `lazy` poserait une marque par instance
 *  (58 mesurées), là où le site de référence est UN. */
const refRegleOptionnelle = idDe('regleOptionnelle');

export const formulaSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.number(),
    z.strictObject({ bonusOf: charKeySchema }),
    z.strictObject({ charOf: charKeySchema }),
    z.strictObject({ dice: diceSpecSchema }),
    z.strictObject({ rolled: z.literal(true) }),
    z.strictObject({ indiceOf: z.literal(true) }),
    z.strictObject({ stacks: z.literal('self') }),
    z.strictObject({ engagedAdvantageGap: z.literal(true) }),
    z.strictObject({ woundsDealt: z.literal(true) }),
    // DR du Test COURANT (`ctx.sl`) — échelle MULTIPLICATIVE de la marge (LDB 09 l.97 : « Bonus de
    // Sociabilité x DR »), là où `perSL` n'exprime qu'un pas linéaire ajouté à un socle.
    z.strictObject({ sl: z.literal(true) }),
    // Valeur d'une RÈGLE OPTIONNELLE du registre : référence de la grammaire (`idDe`), donc résolue AU
    // PARSE. Sa forme NUMÉRIQUE (`kind: 'param'`) est gardée sur la donnée par `data-wellformed.test`.
    z.strictObject({ rule: refRegleOptionnelle }),
    z.strictObject({ sum: z.array(formulaSchema) }),
    // `factor` est une Formula (PRODUIT de deux formules — « (Force Mentale) × 1d10 minutes », VDM 05).
    z.strictObject({ times: z.strictObject({ of: formulaSchema, factor: formulaSchema }) }),
    // BORNE BASSE d'un terme — « 1d10 – (Bonus d'Endurance) Rounds (minimum de 1) » (AA 07 l.113,
    // LDB 18 l.88) : le minimum vit dans la formule de l'entrée, jamais au moteur. Récursif.
    z.strictObject({ minimum: z.number().int().nonnegative(), of: formulaSchema }),
  ]),
);

/** Terme « (Points de Péché) » du porteur du jet — `LDB 40 l.58/62/65/68/73/75`. Substitué à
 *  l'EXPANSION d'une rangée de Colère des dieux (`engine/miscast.ts::resolveJsonFormula`), jamais à
 *  l'application de l'op : le Péché est expié AVANT `applyOps` (`state/combatFlow.ts`). */
export const sinPointsSchema = z.strictObject({ sinPoints: z.literal(true) });

/** `Formula` du dialecte de la Colère des dieux : une formule GÉNÉRALE, le terme de Péché, ou leur
 *  SOMME — la seule composition que le livre imprime (« 1d10 + (Points de Péché) »). */
export const formulaSinSchema: z.ZodType<unknown> = z.union([
  formulaSchema,
  sinPointsSchema,
  z.strictObject({ sum: z.array(z.union([formulaSchema, sinPointsSchema])) }),
]);

/** Compétences du Test d'Exposition à une Influence corruptrice — alphabet FERMÉ (`LDB 19 l.23-75`).
 *  SOURCE UNIQUE : les deux portes `corruptionExposure.skill` (op `GameOp`, effet de scène), le
 *  sélecteur de l'atelier (`ui/editor/GameOpEditor.tsx`) et la couture du slot
 *  (`state/corruptionFlow.ts`) en dérivent — jamais une deuxième liste. */
export const TESTS_DE_CORRUPTION = ['resistance', 'calme'] as const;
export type TestDeCorruption = (typeof TESTS_DE_CORRUPTION)[number];

/** Référence de Compétence BORNÉE à `TESTS_DE_CORRUPTION` : porte UNIQUE des deux slots
 *  `corruptionExposure.skill`. Sans elle, toute Compétence passe la porte et le runtime la rabote
 *  en silence — la donnée mentirait sur le Test réellement joué. Forme ENUM (patron `charKeySchema`) :
 *  l'alphabet TYPE l'id, il ne le branche pas ; les deux Compétences n'étant pas spécialisables,
 *  aucun régime `spec`/`choix` n'a de sens ici — d'où la réf nue plutôt que `refOuSpec('skill')`. */
export const refTestDeCorruption = z.strictObject({
  id: z.enum(TESTS_DE_CORRUPTION, {
    error: (iss) =>
      `corruptionExposure.skill : « ${String(iss.input)} » hors des deux Compétences admises — Résistance (« resistance ») ou Calme (« calme ») (LDB 19 l.23-75).`,
  }),
});

/**
 * FOURCHETTE d'une rangée de table de tirage — forme CANONIQUE du concept `plage`
 * (`scripts/docs/lib/structures-lexique.mts`) : deux bornes INCLUSIVES, PLATES, portées par la rangée
 * elle-même, jamais emboîtées sous un champ `range`. C'est exactement ce que lit `findTableEntry`
 * (`src/engine/tables.ts`), primitive unique du lookup par fourchette.
 *
 * La charge utile d'une rangée est INHÉRENTE à sa table (mutation tirée, Localisation touchée,
 * critique, maladie…) : elle s'ajoute par la SHAPE — `z.strictObject({ ...plageSchema.shape, … })`,
 * graphie UNIQUE de dérivation dans la grammaire (`qualityRefSchema`, `grammaire/reference.ts`), que
 * le volet `extend` de `src/data/grammaire-guard.test.ts` tient. UNE seule déclaration des deux
 * bornes pour tout le dépôt. Se compose sur un schéma de RANGÉE, jamais sur un document scellé par
 * `document()` (handle fermé). Une table dont les DEUX bornes sont toute la charge utile prend
 * `plageSchema` tel quel.
 *
 * Aucune borne de domaine n'est posée ici : les tables du dépôt tirent au d100, au 2d10 (Obsessions)
 * ou sur une expression de dé authorée (`structure-criticals.die`). La couverture EXACTE du domaine
 * se vérifie, elle, par `ecartsDeCouverture` ci-dessous.
 */
export const plageSchema = z.strictObject({ min: z.number(), max: z.number() });

/**
 * FOURCHETTE À BORNE HAUTE OUVERTE — même concept `plage`, une seule divergence : la DERNIÈRE bande
 * n'a pas de plafond, et JSON n'a pas d'Infinity (`max: null` ; c'est le lookup qui ouvre, cf.
 * `src/engine/advancement.ts`). Composée sur la SHAPE de `plageSchema`, graphie UNIQUE de dérivation
 * dans la grammaire. Mesuré 2026-09-01 sur les deux racines de donnée : DEUX bandes ouvertes
 * (`advancementCosts.json`, « 71 et + », LDB 07 l.49/l.70 ; `sea-cargo.json › sell.offerPrice`,
 * « 4 ou plus », MDG 15 l.383) contre plus de 1470 fourchettes FERMÉES — sonde tenue par
 * `src/data/plage-bornes-contrat.test.ts` (volet E). La couverture d'une suite de telles bandes se vérifie
 * par `ecartsDeCouverture(…, 'ouverte')` ci-dessous.
 */
export const plageOuverteSchema = z.strictObject({ ...plageSchema.shape, max: z.number().nullable() });

/**
 * BORNES DE DOMAINE d'un RÉGLAGE chiffré — concept `bornes` du lexique
 * (`scripts/docs/lib/structures-lexique.mts`), DISTINCT de `plage` : aucune rangée n'est tirée ici,
 * rien ne traverse `findTableEntry` ; ce sont les bornes de SAISIE d'un paramètre éditable, qui
 * vivent avec sa valeur par défaut ou son pas. Les deux bornes sont OPTIONNELLES (un réglage peut
 * n'en porter aucune), mais jamais SEULES : le domaine d'une saisie a deux côtés — d'où le refine de
 * co-présence, partagé par `ecartDeCoPresenceDesBornes` avec les sites qui composent la shape
 * (le spread ne transporte pas un refine). Mesuré 2026-09-01 : 23/23 entrées `kind:'param'` de
 * `reglesOptionnelles.json` portent les deux.
 *
 * CE NŒUD N'EST CONSOMMÉ COMME SCHÉMA PAR AUCUN SITE : il est la DÉCLARATION du concept (sa shape et
 * son invariant, là où le lexique les nomme), et la composition passe par `...bornesSchema.shape` +
 * `ecartDeCoPresenceDesBornes` — c'est le PORTEUR réel (`defs/reglesOptionnelles.ts`) que les gates
 * mesurent, jamais ce nœud seul.
 */
export const bornesSchema = z
  .strictObject({ min: z.number().optional(), max: z.number().optional(), step: z.number().optional() })
  .superRefine((v, ctx) => {
    const ecart = ecartDeCoPresenceDesBornes(v);
    if (ecart) ctx.addIssue({ code: 'custom', path: [ecart.borne], message: ecart.message });
  });

/**
 * Co-présence des deux bornes d'un RÉGLAGE : rend l'écart (vide = conforme), à verser dans le refus
 * NOMINATIF de la def appelante — même patron qu'`ecartsDeCouverture`, et même raison : un site qui
 * compose `...bornesSchema.shape` perd le refine du nœud, la règle ne doit pas pour autant se
 * ré-écrire chez lui.
 */
export function ecartDeCoPresenceDesBornes(v: {
  min?: number | null;
  max?: number | null;
}): { borne: 'min' | 'max'; message: string } | null {
  const aMin = v.min != null;
  const aMax = v.max != null;
  if (aMin === aMax) return null;
  const borne = aMin ? 'max' : 'min';
  return {
    borne,
    message: `bornes de réglage : la borne ${borne === 'min' ? 'basse' : 'haute'} manque — le domaine d'une saisie a DEUX côtés, une borne seule laisse l'autre à l'infini sans que rien ne le dise.`,
  };
}

/**
 * COUVERTURE d'une suite de fourchettes `{min, max}` — invariant PARTAGÉ des tables que
 * `findTableEntry` (`src/engine/tables.ts`) lit : le domaine est couvert EXACTEMENT une fois, sans
 * trou ni chevauchement. Rend la liste des écarts (vide = conforme), à verser dans le refus NOMINATIF
 * de la def appelante.
 *
 * Pourquoi un verrou : `findTableEntry` REPLIE sur la dernière entrée quand rien ne couvre le jet —
 * un trou ouvert au Codex ne lève donc rien, il fait tomber le tirage sur la dernière rangée en
 * silence. Un chevauchement, lui, rend la seconde rangée inatteignable (le `find` prend la première).
 *
 * ORDRE INERTE : les fourchettes sont triées par `min` avant mesure — les deux bornes étant
 * authorées, réordonner les rangées au Codex ne change RIEN au tirage, et ne doit donc rien refuser.
 * `jusqua: 'ouverte'` = la dernière fourchette n'a PAS de plafond (`max: null`, cf. la bande
 * « 71 et + », LDB 07 l.70) ; sinon la borne haute exacte est exigée.
 */
export function ecartsDeCouverture<F extends { min?: number; max?: number | null }>(
  fourchettes: readonly F[],
  depuis: number,
  jusqua: number | 'ouverte',
  nom: (f: F) => string,
): string[] {
  if (!fourchettes.length) return ['aucune fourchette'];
  const ecarts: string[] = [];
  const triees = [...fourchettes].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  let attendu = depuis;
  for (const [i, f] of triees.entries()) {
    if (f.min !== attendu) ecarts.push(`${nom(f)} commence à ${f.min} au lieu de ${attendu}`);
    if (i === triees.length - 1 && jusqua === 'ouverte') {
      if (f.max !== null) ecarts.push(`${nom(f)} est la DERNIÈRE et porte un plafond (${f.max}) : sa borne haute reste OUVERTE (\`max: null\`)`);
      return ecarts;
    }
    if (typeof f.max !== 'number') {
      ecarts.push(`${nom(f)} n'a pas de borne haute`);
      return ecarts;
    }
    if (f.max < (f.min ?? attendu)) ecarts.push(`${nom(f)} finit (${f.max}) avant de commencer (${f.min})`);
    attendu = f.max + 1;
  }
  if (jusqua !== 'ouverte' && attendu !== jusqua + 1) {
    ecarts.push(`la dernière fourchette s'arrête à ${attendu - 1} au lieu de ${jusqua}`);
  }
  return ecarts;
}

/**
 * DISPONIBILITÉ SAISONNIÈRE d'une cargaison — quatre colonnes d100, chacune une FOURCHETTE `{min, max}`
 * (MDG 15 l.406-418, MSRC 13 l.73-78). Nœud NOMMÉ du concept, symétrique de `prixSaisonnierSchema` :
 * les deux defs de commerce composaient `parSaison(plageSchema)` chacune de leur côté.
 */
export const dispoSaisonniereSchema = parSaison(plageSchema);

/** Les quatre colonnes, DÉRIVÉES du nœud : la liste des saisons n'est écrite qu'une fois (`parSaison`). */
const SAISONS_DE_DISPO = Object.keys(dispoSaisonniereSchema.shape) as (keyof z.infer<typeof dispoSaisonniereSchema>)[];

/** Ce qu'une entrée MARCHANDE doit porter pour que la couverture se mesure : un libellé (le refus est
 *  NOMINATIF) et les quatre colonnes. */
type EntreeMarchande = { label: string; avail: z.infer<typeof dispoSaisonniereSchema> };
/** Un MARQUEUR de colonne Production/Produits : reconnu à son CHAMP d'exclusion, comme le moteur le
 *  reconnaît (`isEchangeable`, `src/engine/cargo.ts`). */
type EntreeMarqueur = { echangeable: false };

/**
 * CATALOGUE DE CARGAISONS TIRÉ AU D100 — fabrique du tableau `cargoes` des deux livres de commerce
 * (maritime MDG 15 l.406-418, terrestre MSRC 13 l.73-78) : un tableau d'entrées MARCHANDES ou de
 * MARQUEURS, sous l'invariant que chacune des quatre colonnes saisonnières couvre 1 à 100 d'un seul
 * tenant. L'invariant porte sur la COLONNE, jamais sur une entrée — d'où sa place au TABLEAU.
 *
 * Pourquoi une fabrique et non deux refines jumeaux : les deux livres impriment la MÊME table à quatre
 * colonnes, et les deux defs en écrivaient le verrou à l'identique. Ce qui reste au site est ce qui
 * DIFFÈRE : les schémas d'entrée (le Vin terrestre porte `wine`) et le `site` cité par le refus.
 *
 * Le filtre des marqueurs est celui du moteur (`isEchangeable`) : le CHAMP d'exclusion, jamais un id.
 *
 * @param marchand schéma d'une cargaison échangeable (doit porter `label` et `avail`)
 * @param marqueur schéma d'un marqueur de colonne Production/Produits (`echangeable: false`)
 * @param options `site` = le porteur cité en tête du refus (`'sea-cargo.json › cargoes'`)
 */
export function catalogueSaisonnier<A extends EntreeMarchande, B extends EntreeMarqueur>(
  marchand: z.ZodType<A>,
  marqueur: z.ZodType<B>,
  options: { site: string },
): z.ZodType<(A | B)[]> {
  return z.array(z.union([marchand, marqueur])).superRefine((entrees: (A | B)[], ctx) => {
    const marchandes = entrees.filter((e): e is A => !('echangeable' in e) || e.echangeable !== false);
    for (const saison of SAISONS_DE_DISPO) {
      const ecarts = ecartsDeCouverture(
        marchandes.map((c) => ({ ...c.avail[saison], label: c.label })),
        1,
        100,
        (f) => `« ${f.label} » (${f.min}–${f.max})`,
      );
      if (ecarts.length) {
        ctx.addIssue({
          code: 'custom',
          message: `${options.site} : la colonne de disponibilité ${saison} ne couvre pas le d100 de 1 à 100 d'un seul tenant — ${ecarts.join(' ; ')}.`,
        });
      }
    }
  });
}
