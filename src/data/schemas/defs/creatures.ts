/**
 * Schéma de `creatures.json` — le BESTIAIRE (493 entrées), miroir de `CreatureData`
 * (`src/data/index.ts`). GROS dataset : inventaire de clés fait par script node sur
 * TOUTES les entrées du fichier (histogramme complet, pas d'échantillonnage) — le compte
 * ci-dessus suit le fichier, il ne le fige pas.
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { availabilitySchema, harvestRaritySchema, entityAppearanceSchema, moneySchema } from '../grammaire/valeurs';
import { refSchema, talentRefSchema, trappingRefSchema, traitInstanceSchema } from '../grammaire/reference';
import { refOuSpec } from '../grammaire/ref';

export const file = 'creatures.json';
export const famille = 'entite';

/** `OptionalEntry` (`src/engine/statEntry.ts`) — un élément d'`optionals` (LDB 76) : soit un
 *  `TraitInstance` ordinaire, soit une NOTE composée irréductible à un trait (discriminée par `note`) :
 *  joker « tous les traits » (Mutant, LDB 83 l.91) ou variante « remplacer des Traits par un bonus »
 *  (Grand Loup ZI 1 l.229, Griffon ZI). La note porte son `label` source VERBATIM + les champs d'application. */
const optionalWildcardSchema = z.strictObject({
  note: z.literal('all-traits'),
  label: z.string(),
});
const swapGrantSchema = z.union([
  z.strictObject({ char: z.string(), value: z.number() }),
  refOuSpec('skill', { value: z.number() }),
]);
const optionalSwapSchema = z.strictObject({
  note: z.literal('swap'),
  label: z.string(),
  remove: z.array(z.string()),
  /** Un ou plusieurs octrois (Vouivre ZI : 4 — 3 caractéristiques + 1 compétence). */
  grant: z.array(swapGrantSchema),
  size: z.string().optional(),
  wounds: z.number().optional(),
});
const optionalEntrySchema = z.union([traitInstanceSchema, optionalWildcardSchema, optionalSwapSchema]);

/** `SkillRef` (`src/data/index.ts`) — la réf de Compétence de la GRAMMAIRE (`refOuSpec`, régimes
 *  `spec` XOR `choix`) composée avec la charge utile du statbloc : `value`, le nombre IMPRIMÉ
 *  (#1463, « `value` = le seul nom du NOMBRE IMPRIMÉ au statbloc »). MÊME nœud que `swapGrantSchema`
 *  ci-dessus — une seule graphie de Compétence dans ce document. */
const skillRefSchema = refOuSpec('skill', { value: z.number() });


/** `HarvestDanger` (`src/data/index.ts`). */
const harvestDangerSchema = z.enum(['Inoffensive', 'Inquiétante', 'Menaçante', 'Mortelle']);


/** Champs PROPRES d'une entrée de `creatures.json` — l'enveloppe est posée par `document()`. */
const champs = {
  /** SOUS-TITRE de statbloc (« Bandit humain », « Prince démon de Slaanesh »). Mesuré 2026-08-31 :
     *  493/493 porteuses, dont 440 à `null` et 53 à valeur recopiée du livre. LECTEUR NOMINATIF :
     *  `src/ui/compendium/registry.ts` (rubrique `creatures`, `sub: c.title ?? undefined`) — c'est le
     *  sous-titre de la fiche Codex. Le `null` est un ÉTAT VOULU, pas un trou : le co-invariant des
     *  deux sens (posé → rendu à l'identique, nul → aucun sous-titre, jamais un repli) est verrouillé
     *  par `src/ui/compendium/registry-sous-titre-null.test.ts`. Ce champ n'infère JAMAIS la
     *  nommé-ité : `isNamed` lit `named`. */
    title: z.string().nullable(),
    named: z.boolean().optional(),
    folder: z.string().nullable(),
    /** Ids de `groups.json` de cette créature (`groupsFor`) : sa CATÉGORIE (« demon », « bete »…) et,
     *  le cas échéant, le Groupe du dieu du Chaos qu'elle sert. Absent = aucun Groupe. */
    grantGroups: z.array(z.string()).optional(),
    /** `Record<string, number|null>` (`src/data/index.ts`) — clés = abréviations de caractéristique
     *  (10 attendues : CC/CT/F/E/I/Ag/Dex/Int/FM/Soc, + M/B hors-jet vus ailleurs sur d'autres profils).
     *  `record` reste ouvert par construction (anomalie #1 de tête : clé `"undefined"` structurellement
     *  acceptée, mais fausse — à corriger à la main, pas un défaut de CE schéma). */
    char: z.record(z.string(), z.union([z.number(), z.null()])),
    traits: z.array(traitInstanceSchema),
    optionals: z.array(optionalEntrySchema),
    skills: z.array(skillRefSchema),
    talents: z.array(talentRefSchema),
    trappings: z.array(trappingRefSchema),
    spells: z.array(refSchema),
    /** Emplacements SECONDAIRES (#563) — le MÊME statbloc réimprimé par un autre livre (Bête des
     *  marais : LDB 79 l.14, republiée verbatim par VDM 13 folio 179). L'ANCRE `source` reste seule
     *  à porter la `desc` ; jamais une seconde entrée. */
    appearance: entityAppearanceSchema.optional(),
    harvest: z.strictObject({ rarity: harvestRaritySchema, danger: harvestDangerSchema, uses: z.string() }).optional(),
    followsCharacterRules: z.boolean().optional(),
    /** Facette ACHAT (montures, LDB 70 / EDOC 07). */
    purchase: z.strictObject({
      price: moneySchema,
      availability: availabilitySchema.optional(),
    }).optional(),
};

/** VUE TS d'un profil de créature EMBARQUÉ (patch PARTIEL de l'entrée, `defs-scenes/narratif.ts`) :
 *  le nœud rendu par la fabrique est SCELLÉ, donc `z.infer` y vaut `unknown` — la vue se recompose
 *  ici, sans jamais rouvrir le nœud (patron `axes.ts`). */
export type CreatureProfilPartiel = Partial<EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>>;

const doc = document(
  'creatures',
  famille,
  champs,
  {
    title: {
      label: 'Sous-titre (Codex)',
      hint: 'Second nom affiché sous le libellé — jamais lu pour détecter un individu nommé (c’est `named` qui le dit)',
    },
    named: { label: 'Individu nommé', hint: 'Source unique de la nommé-ité (vs créature générique) — éditable au Codex' },
    folder: {
      label: 'Catégorie Codex',
      hint: 'Catégorie de classement de la créature dans l’arborescence du Codex, distincte de Groupes accordés',
    },
    grantGroups: { label: 'Groupes accordés', hint: 'Catégorie de la créature et Groupe du dieu du Chaos servi' },
    char: {
      label: 'Caractéristiques',
      hint: 'Table des 10 caractéristiques (CC/CT/F/E/I/Ag/Dex/Int/FM/Soc) — valeur ou vide si non imprimée',
    },
    traits: { label: 'Traits', hint: 'Traits de créature structurés (identifiant + argument ou valeur)' },
    optionals: {
      label: 'Traits optionnels',
      hint: 'Traits ou notes composées proposés au choix à l’apparition de la créature (LDB 76)',
    },
    skills: { label: 'Compétences', hint: 'Compétences de la créature : identifiant + valeur de Test imprimée' },
    talents: { label: 'Talents', hint: 'Talents de la créature : identifiant + spécialisation ou niveau' },
    trappings: { label: 'Possessions', hint: 'Objets portés par la créature (référence catalogue ou texte narratif)' },
    spells: { label: 'Sorts connus', hint: 'Sorts que la créature peut lancer' },
    appearance: { label: 'Apparence', hint: 'Apparence par défaut de la créature (espèce, tenue, couleurs), lue par le rig' },
    harvest: { label: 'Récolte', hint: 'Rareté, dangerosité et usages des organes récoltables sur cette créature' },
    followsCharacterRules: {
      label: 'Suit les règles de Personnage',
      hint: 'La créature suit les règles réservées aux Personnages',
    },
    purchase: { label: 'Facette Achat', hint: 'Prix et Disponibilité à l’achat (montures)' },
  },
  {
    codex: { keys: ['creatures'] },
    edit: { dataset: 'creatures' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
/** L'entrée en PATCH, pour l'embarquement d'un profil ad hoc (`defs-scenes/narratif.ts`). */
export const entreePartielle = doc.entreePartielle;
