import { nommerChamps, nommerNoeud, metaDesChamps, type MetaDesChamps } from './meta';
/**
 * VALEURS de la grammaire de document (#1466 L1a) — les types de VALEUR partagés par tout document
 * de l'application : source, dés, formule, difficulté, caractéristique, localisation, apparence,
 * variante réglée, recette de détail. Aucune dépendance à la MÉCANIQUE : sous la grammaire, ce
 * fichier ne compose que la RÉFÉRENCE (`refOuSpec`).
 */
import { tableTotale } from '../../../lib/tableTotale';
import type { Dir8 } from '../../../geometry/dir8';
import type { Formula, FormuleSansTirage } from '../../../engine/ops';
import type { RegleOptionnelleId } from '../../../engine/policy';
import type { Equipe } from '../../../engine/relations';
import { z } from 'zod';
import { parseStatus, type Money } from '../../../engine/money';
import { parseDice, totalDuDe } from '../../../engine/dice';
import { deDeLaTableTiree, facesDuDe, type PorteurDeDe } from '../../../engine/tables';
import { messageDApparenceDObjet, findTrappingById, type TrappingResolver } from '../../apparencesObjets';
import { estObjet } from '../../../lib/objet.mjs';
import type { TrappingData } from '../../index';

import {
  type Amateur,
  type ConditionUnlock,
  type ContexteDeTest,
  type Availability,
  type TestedAvailability,
  CHAR_LABELS,
  COUVERT_DIFFICULTES,
  DIFFICULTY_LABELS,
  HIT_LOCATION_LABELS,
  LOCALISATIONS_DE_COUP,
  REACH_LABELS,
  REACH_VARIABLE,
  STAKE_FORMS,
} from '../../../engine/types';
import type { Slot } from '../../../lib/palette';
import type { Sexe as SexeDApparence } from '../../../lib/sexe';
import { ref, refOuSpec, idDe, recordDIds, refs, specDe, refTypee, type PorteeLocale, type RefTypee } from './ref';
import { TESTS_DE_REGLE } from '../../../engine/ruleRefs';
import { COMPETENCE_DU_MODE } from '../../../engine/propulsion';
import { controlerSousPortee, listeCle } from './collection-cle';
import { libelleDeValeur } from './meta';
import { descendre } from './descente';
import { marquerProduit, produitDe } from './interne/produits';
import { saisonParId } from '../../saisons';
import { LIBELLES_DES_ICONES } from '../../icons';
import { MAX_FRAGMENTS, estGraphieDeChapitre } from '../../source/decoupe';

export const blocageDeLivraison = nommerChamps(z.strictObject({ ticket: z.string(), raison: z.string() }), {
  ticket: { label: 'ticket' }, raison: { label: 'raison' },
});

/**
 * ENUM NOMMÉ (#1694) — la FABRIQUE d'un univers fermé dont chaque valeur porte son libellé FR SUR LE
 * NŒUD, à sa déclaration : `z.enum(Object.keys(valeurs)).meta({ valeurs })`. Couverture et ORDRE sont
 * vrais PAR CONSTRUCTION (les options SONT les clés de la table), si bien qu'aucun contrôle externe
 * n'a plus à les vérifier, et qu'un site d'affichage lit le libellé par `libelleDeValeur(noeud, v)`
 * (`grammaire/meta.ts`) au lieu de tenir sa propre table par valeur.
 *
 * Le porteur est le NŒUD, jamais la clé de premier niveau : un enum niché (`[].outcomes[].on`) ou
 * partagé entre defs (`actorRefSchema`) se nomme UNE fois, ici, comme un champ de racine.
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

/** Id d'icône du registre `src/data/icons/` (`npm run gen`) : un id hors registre se refuse au parse. */
export const idDIconeSchema = enumNomme(LIBELLES_DES_ICONES);

/** Équipe d'un combattant ou d'une armée (`Equipe`, `engine/relations.ts`). */
export const equipeSchema = enumNomme({ allie: 'Allié', ennemi: 'Ennemi' } satisfies Record<Equipe, string>);

/** Taille d'agglomération d'un marché : la colonne de la table de Disponibilité (LDB 59 l.25-34). */
export const settlementSchema = enumNomme({ village: 'village', ville: 'ville', cite: 'cité' });
export type Settlement = z.output<typeof settlementSchema>;

/** Contexte de Test d'une source d'inversion (`ContexteDeTest`, LDB 12 l.42). */
export const contexteDeTestSchema = enumNomme({
  psych: 'pour résister à un Trait Psychologique',
  perilDesEaux: 'pour traverser des eaux dangereuses',
  bandages: 'avec des Bandages',
  amateurDArt: 'face à un amateur d’art',
  amateurDeTheatre: 'face à un amateur de théâtre',
} satisfies Record<ContexteDeTest, string>);

/** Contrepartie d'un Test de Sociabilité déclarée par une fiche de PNJ (`Amateur`, ACE 12 l.60-62). */
export const amateurSchema = enumNomme({
  amateurDArt: 'amateur d’art',
  amateurDeTheatre: 'amateur de théâtre',
} satisfies Record<Amateur, string>);

/**
 * Nature d'une Mutation (`Mutation.kind`, `src/engine/corruption.ts`) — UNE déclaration pour les trois
 * nœuds qui portent ce vocabulaire : `mutations.kind` (`defs/mutations.ts`) et les deux capacités de
 * trait `mutationAtSpawn` / `markMutations.first` (`defs/traits.ts`). Un enum = une const nommée : un
 * jumeau redéclaré en `z.enum` rendrait un `select` ANONYME que rien ne suivrait, le stock de
 * `valeurs-de-champ.test.ts` se tenant par VOCABULAIRE.
 */
export const mutationKindSchema = enumNomme({ physique: 'Physique', mentale: 'Mentale' });

/** Le genre d'une arme, d'un Groupe d'arme ou d'une attaque : corps à corps ou à distance (LDB 62). */
export const genreDArmeSchema = enumNomme({ melee: 'Corps à corps', distance: 'À distance' });

/** Les rôles d'animation d'ambiance d'une entité de scène. */
export const roleAmbiantSchema = enumNomme({ repas: 'Se nourrit', priere: 'Prie', tapi: 'Se recroqueville', debout: 'Se tient debout', hurlement: 'Hurle' });
export type RoleAmbiant = z.infer<typeof roleAmbiantSchema>;

/** Dé de TIRAGE d'une table à fourchettes (`die`) : une expression de dé (« d10 », « 2d10 ») que
 *  `parseDice` (`src/engine/dice.ts`) lit en `DiceSpec`. UNE déclaration pour la fabrique
 *  (`options.deDeTirage`, `grammaire/document.ts`), les tables de `arcane-phenomena.json`, les porteurs
 *  de N tables (`defs/rencontres-edoc.ts`, `defs/ship-criticals.ts`) et l'op `rollTable`
 *  (`grammaire/mecanique.ts`). #1669 */
export const deDeTirageSchema = z.string().refine((s) => parseDice(s) !== null, { message: 'dé de tirage illisible : une expression « NdM » (ex. « d10 », « 2d10 »)' });

/** Maniement d'une arme : l'axe d'ANIMATION (prise physique), distinct du Groupe de règles — UNE déclaration
 *  pour les racines de `apparences.json` (`defs/apparences.ts`) et les Groupes d'arme de `weaponGroups.json`
 *  (`defs/weaponGroups.ts`), lus par `maniementDe` (`src/noyau/animation.ts`). #3076 */
export const maniementSchema = enumNomme({
  lame1m: 'Lame à une main', escrime: 'Escrime', lourde2m: 'Arme lourde à deux mains', hampe: 'Hampe',
  lance_cav: 'Lance de cavalerie', fleau: 'Fléau', parade: 'Parade', poings: 'Poings',
  arc: 'Arc', arbalete: 'Arbalète', arme_feu: 'Arme à feu', fronde: 'Fronde', jet: 'Jet',
  entraves: 'Entraves', explosif: 'Explosif', cornes: 'Cornes',
});
export type Maniement = z.infer<typeof maniementSchema>;

/**
 * Registre d'où DÉRIVE le pool de spécialisations d'une def (`SpecsSource`, `src/data/index.ts` ;
 * catalogue `SPEC_SOURCES`) — UNE déclaration pour les trois defs qui portent ce champ
 * (`skills`/`talents`/`traits`), qui en tenaient chacune une copie. La couverture est TOTALE (toutes les clés de
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
  ciblesPsy: 'Cibles psychologiques (Groupes, personnes)',
  groupesDAppartenance: 'Groupes d’appartenance (hors Groupes relatifs)',
  diseases: 'Maladies',
  sizes: 'Tailles',
  mutations: 'Mutations',
  breathTypes: 'Types de Souffle',
  damageTypes: 'Types de Dégâts (immunité)',
  weaponsMelee: 'Armes de mêlée',
  weaponsRanged: 'Armes à distance',
  exposureLevels: 'Degrés d’Exposition',
  difficulties: 'Difficultés',
});

/**
 * Sévérité d'un symptôme de Maladie (`SymptomSeverity`, `src/data/index.ts`) — UNE déclaration pour
 * les trois nœuds qui portent ce vocabulaire : `maladies.symptoms[].severity` (`defs/maladies.ts`) et
 * les charges des ops `aggravateSymptom`/`grantSymptom` (`grammaire/mecanique.ts`).
 */
export const symptomSeveritySchema = enumNomme({ moderee: 'Modérée', grave: 'Grave' });

/** Variante de Cible qu'un type de psychologie CIBLÉ admet (`psychology.json`, `cibles`) : un Groupe (LDB 21
 *  l.19), un individu (LDB 21 l.75 ; EDOC 11 l.648). Son libellé nomme la variante dans les refus. #3045 */
export const varianteDeCibleSchema = enumNomme({ groupe: 'un Groupe', individu: 'une personne' });
export type VarianteDeCible = z.infer<typeof varianteDeCibleSchema>;

/**
 * FAMILLE d'attaque d'une manœuvre et d'une arme naturelle (`AttackKind`, `src/engine/creatureAttacks.ts`) — le libellé est
 * celui de la FAMILLE, jamais l'affichage d'une manœuvre PRÉCISE (`ManeuverDef.label`, ex. « Souffle
 * (Feu) ») : plusieurs `ManeuverDef` partagent un `kind` (6 souffles, 2 étreintes, 4 hurlements).
 */
export const attackKindSchema = enumNomme({
  arme: 'Arme / griffes',
  morsure: 'Morsure',
  caudale: 'Attaque caudale',
  cornes: 'Cornes',
  souffle: 'Souffle',
  vomi: 'Vomissement',
  tentacules: 'Tentacules',
  etreinte: 'Étreinte',
  regard: 'Regard pétrifiant',
  langue: 'Langue préhensile',
  hurlement: 'Hurlement',
  pietinement: 'Piétinement',
});

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
 * UNE déclaration pour la charge de l'op `corruptionExposure` (`grammaire/mecanique.ts`), l'effet de
 * scène `corruptionExposure.level` (`defs-scenes/effets.ts`) et le Degré du Trait Corruption
 * (`grammaire/vocabulaires.ts`). Libellés : `LDB 19 l.33`, `l.43`, `l.56`.
 */
export const exposureLevelSchema = enumNomme({ mineure: 'Mineure', moderee: 'Modérée', majeure: 'Majeure' });

/**
 * `Dir8` (`src/geometry/dir8.ts`) — orientation MONDE à huit aires, UNE déclaration pour les deux nœuds
 * qui la portent : `entities[].facing` d'une Scène (`defs-scenes/scene.ts`) et le cap d'une place assise
 * de décor (`defs/props.ts`). Ses clés sont celles de `Dir8`, exigées par le compilateur.
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
} satisfies Record<Dir8, string>);

/**
 * Disponibilité (`Availability`, `src/engine/types.ts`) — le schéma DÉRIVE du tuple canon au lieu de
 * retaper ses 4 paliers : c'est la porte unique des defs (`disponibilite`, `creatures`, `vehicles`,
 * `trappings`).
 */
export const LIBELLES_DE_DISPONIBILITE = { commune: 'Commune', limitee: 'Limitée', rare: 'Rare', exotique: 'Exotique' } as const satisfies Record<Availability, string>;
export const availabilitySchema = enumNomme(LIBELLES_DE_DISPONIBILITE);
/** Les Disponibilités qui se testent au d100 (`TestedAvailability`). LDB 59 l.25-30 */
export const dispoPctAvailabilitySchema = enumNomme({ limitee: LIBELLES_DE_DISPONIBILITE.limitee, rare: LIBELLES_DE_DISPONIBILITE.rare } satisfies Record<TestedAvailability, string>);
/** Libellé de Statut (« Argent 2 ») : lisible par `parseStatus`, que `statutDeDonnee` garantit ensuite. LDB 08 l.9 */
export const statutSchema = z.string().refine((s) => parseStatus(s) !== null, 'Statut illisible : « Bronze N », « Argent N » ou « Or N » attendu.');

/**
 * Rareté d'une pièce de créature récoltée (`HarvestRarity`, `src/data/index.ts`) = les paliers de
 * Disponibilité + `'Unique'`. Le 5ᵉ palier est RAW, pas une dérive : la table « COÛT DE BASE POUR
 * 1 ENC DE PIÈCES DE CRÉATURE BRUTES » imprime cinq colonnes (`ZI 13 l.286`).
 */
export const harvestRaritySchema = enumNomme({ ...LIBELLES_DE_DISPONIBILITE, unique: 'Unique' });

/** Dangerosité d'une créature récoltée (`HarvestDanger`, `src/data/index.ts`). ZI 13 l.286 */
export const harvestDangerSchema = enumNomme({ inoffensive: 'Inoffensive', inquietante: 'Inquiétante', menacante: 'Menaçante', mortelle: 'Mortelle' });

/**
 * Forme déclarée d'un texte d'enjeu (`StakeForm`, `src/engine/types.ts`) — porte unique des defs
 * qui portent un enjeu (`stakes`, `activities`, `psychology`, `maneuvers`, `etats`). L'OPTIONALITÉ reste
 * au site : elle se décide par def, pas ici.
 */
export const stakeFormSchema = z.enum(STAKE_FORMS);

/** Les espaces où le FOYER d'une règle peut vivre — l'entité qui la PORTE, `regle` (`regles.json`)
 *  n'étant que le foyer des règles de cadre (#1117, amendement A). */
export const typeDeFoyerSchema = enumNomme({
  regle: 'Règle de jeu',
  skill: 'Compétence',
  talent: 'Talent',
  etat: 'État',
  quality: 'Qualité',
  characteristic: 'Caractéristique',
  spell: 'Sort',
  psychology: 'État psychologique',
  symptome: 'Symptôme',
  steamBreakdown: 'Panne de navire à vapeur',
});
export type TypeDeFoyer = z.infer<typeof typeDeFoyerSchema>;

/**
 * FOYER de la règle derrière un jet, une action ou une étape : `{ id, type }` (#2820) — la fiche que le
 * ⓘ ouvre. UNE graphie pour ses porteurs (`actions`, `activities`, `stakes`, `crew-test-types`), l'id
 * résolu AU PARSE dans l'espace de son type.
 */
export const foyerDeRegleSchema = refTypee(typeDeFoyerSchema);
export type FoyerDeRegle = RefTypee<TypeDeFoyer>;

/**
 * Réf de source récurrente `{ book, page }` — vue sur 2-3 datasets (`characteristics.json`,
 * `species.json`/`SpeciesData.source`, `careers.json`/`CareerData.source` dans `src/data/index.ts`) :
 * même forme partout. `book` = id de `books.json` (id-pur, cf. commit `21aa4881`) ; `page` = folio
 * IMPRIMÉ du livre, JAMAIS l'index de la ré-extraction Marker (piège prouvé par la garde
 * `scripts/guards/lib/folioIntegrity.mjs`, qui recoupe la `desc` verbatim et les `data-folio`).
 */
export const sourceRefSchema = nommerChamps(z.strictObject({
  book: idDe('book', undefined, { nue: true }),
  page: z.number(),
  /** Précision optionnelle (ch./l. du passage, portée VERBATIM…). Aucune LOGIQUE DE JEU ne la lit ;
   *  une GARDE la lit : quand elle est de la forme `<ABRÉV> <ch> l.<ligne>`,
   *  `scripts/guards/lib/folioLineAlign.mjs` la confronte au marqueur `data-folio` qui gouverne cette
   *  ligne — `page` et `note` doivent désigner le même endroit (#1318). Toute autre forme est
   *  ignorée par la garde (aucune contrainte de saisie ajoutée). */
  note: z.string().optional(),
}), { book: { label: "livre" }, page: { label: "page" }, note: { label: "note" } });

/** Vue TS de `sourceRefSchema` — SEULE forme à importer côté `src/data/index.ts` (jamais `{ book:
 *  string; page: number }` inline, F20). Réf de source UNIQUE du repo (#278) : posée par ENTRÉE sur
 *  les datasets d'extraction de table RAW (`sea-events`/`sea-navigation`/`sea-perils`/`sea-weather`/
 *  `ship-construction`/`naval-progression`/`crew-morale`/`crew-test-types`/`mass-battle`/
 *  `land-cargo`/`sea-cargo`/`cargoes`/`river-navigation`/`river-perils`), à la racine quand le dataset est un
 *  objet de config unique plutôt qu'une liste. */
export type SourceRef = z.infer<typeof sourceRefSchema>;

/**
 * RAISON d'une valeur MAISON : ce que le canon ne tranche pas, dit en clair (AGENTS.md règle 7). Nœud UNIQUE
 * de la provenance maison : l'enveloppe de `document()` (`grammaire/document.ts`) et toute sous-entrée qui
 * porte sa propre raison le COMPOSENT, jamais ne le retapent. `.min(1)` est STRUCTUREL : une chaîne vide ne
 * dit aucune raison, et `refuserSansProvenance` ne saurait la distinguer d'une raison réelle.
 */
export const maisonSchema = z.string().min(1);

/**
 * Emplacement SECONDAIRE d'une entrée définie à plusieurs endroits (#563 — doctrine user 2026-07-17 :
 * « jamais 2 talents différents », mais un même Talent/Trait/Qualité peut être réimprimé ailleurs).
 * L'ANCRE (`source`, scalaire, inchangée) reste seule à porter la `desc` (règle stricte 5,
 * STRUCTURELLE — jamais `refs[0]` positionnel, indémontable par réordonnancement d'éditeur).
 * `quote` = auto-attestation authorée (verbatim, prouvable dans le span du folio déclaré) pour les cas
 * où le `label` de l'entrée n'apparaît pas tel quel dans ce span (ex. une TABLE imprime un nom
 * différent — `zweihander-flamberge`) : charge de la preuve sur l'auteur, comme `desc` pour l'ancre.
 */
export const secondarySourceRefSchema = nommerChamps(sourceRefSchema.extend({
  /** Preuve verbatim authorée que l'entrée est bien à cet emplacement (ligne de stats d'une table,
   *  phrase distinctive…) — distinct de `note` (display-only, jamais vérifié). */
  quote: z.string().optional(),
}), { ...metaDesChamps(sourceRefSchema, { exigees: true }), quote: { label: 'citation' } });
/** Vue TS de `secondarySourceRefSchema` — porté par le champ `alsoIn?: SecondaryRef[]` de toute
 *  entrée multi-emplacement. Accesseurs `allLocations`/`sourceBooks` (`src/data/index.ts`). */
export type SecondaryRef = z.infer<typeof secondarySourceRefSchema>;

/**
 * FRAGMENT DE BLOCS d'une adresse de prose : l'INTERVALLE du fil d'un chapitre qui va du bloc `b0` de
 * la section `sec#secOcc` au bloc `b1` de la section `finSec#finSecOcc` — par défaut la section de
 * départ, et alors ABSENTE —, plus l'empreinte du texte normalisé qu'il rend. Forme et sémantique du
 * parseur `src/data/source/decoupe.ts` (`FragmentBlocs`) — les deux définitions coïncident, et
 * `grammaire.test.ts` le vérifie AU TYPE.
 */
export const fragmentBlocsSchema = nommerChamps(z.strictObject({
  kind: z.literal('blocs'),
  sec: z.string(),
  secOcc: z.number().int().min(1),
  b0: z.number().int().min(0),
  finSec: z.string().optional(),
  finSecOcc: z.number().int().min(1).optional(),
  b1: z.number().int().min(0),
  sum: z.string().regex(/^[0-9a-f]{16}$/),
}), { kind: { label: "type" }, sec: { label: "section" }, secOcc: { label: "occurrence de section" }, b0: { label: "premier bloc" }, finSec: { label: "section de fin" }, finSecOcc: { label: "occurrence de fin" }, b1: { label: "dernier bloc" }, sum: { label: "empreinte" } }, { label: 'Blocs de section' });

/**
 * FRAGMENT DE CELLULE : une case de table, adressée par clé de LIGNE × en-tête de COLONNE — jamais
 * par indices, qu'une ré-extraction déplacerait. `row`/`col` sont des CHAÎNES : la clé de ligne d'une
 * table de d100 (`01-10`) n'est pas un nombre. `table` : `TableDeSection.cle` (`decoupe.ts`).
 */
export const fragmentCelluleSchema = nommerChamps(z.strictObject({
  kind: z.literal('cellule'),
  sec: z.string(),
  secOcc: z.number().int().min(1),
  row: z.string().min(1),
  col: z.string().min(1),
  table: z.string().regex(/#\d+$/).optional(),
  sum: z.string().regex(/^[0-9a-f]{16}$/),
}), { kind: { label: "type" }, sec: { label: "section" }, secOcc: { label: "occurrence de section" }, row: { label: "ligne" }, col: { label: "colonne" }, table: { label: "table" }, sum: { label: "empreinte" } }, { label: 'Cellule de table' });

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
 * `src/noyau/codex/editFields.ts`).
 */
export function adresseUnPassage(ref: unknown): boolean {
  const parts = (ref as { parts?: unknown } | null | undefined)?.parts;
  return Array.isArray(parts) && parts.length >= MIN_FRAGMENTS;
}

/** Genres de fragment d'une adresse : le `kind` de `fragmentBlocsSchema` et de `fragmentCelluleSchema`. */
export const GENRES_DE_FRAGMENT = [fragmentBlocsSchema.shape.kind.value, fragmentCelluleSchema.shape.kind.value] as const;
/** Un genre de fragment. */
export type GenreDeFragment = (typeof GENRES_DE_FRAGMENT)[number];

/**
 * ADRESSE DE PROSE (#1389, épique #1388 §2.2) — ce qu'une entrée porte À LA PLACE de la prose
 * recopiée du livre : le livre, le chapitre, et jusqu'à `MAX_FRAGMENTS` fragments d'un même chapitre.
 *
 * Les verrous sont STRUCTURELS : un seul chapitre par construction (`ch` est à la racine), au plus
 * `MAX_FRAGMENTS` fragments (un montage plus long n'est plus une citation mais une réécriture), et
 * chaque fragment porte son empreinte `sum` — sans elle, une ré-extraction du livre changerait le texte
 * rendu en silence. Les verrous de COHÉRENCE (exclusivité avec `desc`, résolubilité du livre,
 * accord avec `source`) vivent dans `grammaire/prose.ts`, avec le champ qui les porte.
 *
 * PARAMÈTRE `fragmentsAdmis` : les genres de fragment que les adresses d'un document admettent (défaut :
 * tous, `GENRES_DE_FRAGMENT`). Un document le déclare par `options.fragmentsAdmis` (`document.ts`).
 */
export function descRefSchemaDe(fragmentsAdmis: readonly GenreDeFragment[] = GENRES_DE_FRAGMENT) {
  return marquerProduit(nommerChamps(z
    .strictObject({
      book: idDe('book', undefined, { nue: true }),
      /** Numéro de chapitre dans la GRAPHIE de son fichier d'extraction (`07`, `21`, `105`), jugée par
       *  le prédicat de sa maison (`estGraphieDeChapitre`, `src/data/source/decoupe.ts`) : des
       *  chiffres, deux au minimum, et un numéro de chapitre — `00` désigne l'index. La largeur JUSTE
       *  pour le livre se juge contre le disque, là où le livre est connu
       *  (`src/data/prose-resolution.test.ts`, volet F). */
      ch: z.string().refine(estGraphieDeChapitre, {
        message: 'adresse de prose : `ch` est la graphie d’un numéro de CHAPITRE — des chiffres, deux au minimum, et pas `00` (l’index n’est pas un chapitre).',
      }),
      parts: z.array(z.discriminatedUnion('kind', [fragmentBlocsSchema, fragmentCelluleSchema])).min(MIN_FRAGMENTS).max(MAX_FRAGMENTS),
    })
    .superRefine((v, ctx) => {
      v.parts.forEach((p, i) => {
        if (!fragmentsAdmis.includes(p.kind)) {
          ctx.addIssue({
            code: 'custom',
            path: ['parts', i, 'kind'],
            message: `adresse de prose : fragment \`${p.kind}\` non admis par ce document (admis : ${fragmentsAdmis.join(', ')}).`,
          });
        }
        if (p.kind !== 'blocs') return;
        if ((p.finSec == null) !== (p.finSecOcc == null)) {
          ctx.addIssue({
            code: 'custom',
            path: ['parts', i, p.finSec == null ? 'finSec' : 'finSecOcc'],
            message: 'adresse de prose : `finSec` et `finSecOcc` désignent ensemble la section de fin — l’un ne va pas sans l’autre.',
          });
        } else if (p.finSec === p.sec && p.finSecOcc === p.secOcc) {
          ctx.addIssue({
            code: 'custom',
            path: ['parts', i, 'finSec'],
            message: 'adresse de prose : la section de fin est celle du départ — elle ne s’écrit pas (forme canonique unique).',
          });
        } else if (p.finSec == null && p.b1 < p.b0) {
          ctx.addIssue({
            code: 'custom',
            path: ['parts', i, 'b1'],
            message: `adresse de prose : bornes inversées (\`b1\` ${p.b1} < \`b0\` ${p.b0}) — un fragment de blocs est une suite contiguë.`,
          });
        }
      });
    }), { book: { label: "livre", texte: { regime: 'technique', usage: 'id du livre de l’adresse de prose' } }, ch: { label: "chapitre", texte: { regime: 'technique', usage: 'adresse du chapitre extrait' } }, parts: { label: "parties" } }), 'descRefSchemaDe', 'descRef');
}

/** L'adresse de prose qui admet tous les genres de fragment (`descRefSchemaDe`). */
export const descRefSchema = descRefSchemaDe();

/** Vue TS de `descRefSchema` — la MÊME forme que `DescRef` du parseur (`src/data/source/decoupe.ts`). */
export type DescRef = z.infer<typeof descRefSchema>;

/** Le nœud `noeud` est-il une adresse de prose (`descRefSchemaDe`), quels que soient les genres de fragment qu'il admet ? */
export const estAdresseDeProse = (noeud: unknown): boolean => produitDe(noeud)?.fabrique === 'descRefSchemaDe';

/**
 * ENTRÉE DE CATALOGUE DE SPÉCIALISATION (`SpecEntry`, `src/data/index.ts`) — ce qu'une def de
 * Compétence/Talent énumère sous `specs[]` : l'id STABLE manipulé par la logique, son `label` FR
 * d'affichage, l'attestation de l'entrée quand elle vient d'un autre folio (`source`/`alsoIn`), et
 * `pool: false` pour une entrée VALIDE mais non PROPOSÉE d'office (`LDB 09 l.40`). SOURCE UNIQUE :
 * `specsSchema` la compose — c'est le catalogue que `specRef`/`refOuSpec` confrontent
 * (`grammaire/ref.ts`, espace `<fichier>#[<id>].specs` de l'INDEX DES IDS).
 */
const specEntrySchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  source: sourceRefSchema.optional(),
  alsoIn: z.array(secondarySourceRefSchema).optional(),
  pool: z.literal(false).optional(),
}), { id: { label: "identifiant" }, label: { label: "libellé" }, source: { label: "source" }, alsoIn: { label: "autres sources" }, pool: { label: "réserve" } });

/**
 * CATALOGUE DE SPÉCIALISATIONS d'une entrée (`specs[]`) : un ESPACE DE NOMS, clé `id`, désigné par
 * `spec` d'un `refOuSpec`/`specRef` (`grammaire/ref.ts`). SOURCE UNIQUE : `skills.ts` et `talents.ts`
 * le composent, aucun des deux ne le retape.
 */
export const specsSchema = listeCle(specEntrySchema, 'id', { espace: {} });

// ============================================================================
// COMBAT FEATURE (`src/engine/combatFeatures/types.ts`) — sac de flags CLOS conféré par un Talent/Trait.
// Promu ici (partagé avec `talents.ts`) : SOURCE UNIQUE pour tout schéma qui porte `combat`/`variants[].combat`, dont `CombatFeature`
// (`src/engine/combatFeatures/types.ts`) est la sortie.
// ============================================================================

export const castingKindSchema = z.enum(['mineure', 'arcane', 'invocation', 'beni', 'chaos']);

export const combatFeatureSchema = z.lazy(() =>
  nommerChamps(z.strictObject({
    /** Pénalité de main secondaire transformée par niveau (Ambidextre, LDB 10 : -20 → -10 à 1×, 0 à `zeroAt`).
     *  DÉCLARATIF (`offHandPenalty(c)` l'interprète) — jamais une hook-fonction, 100 % donnée éditable. */
    offHandPenalty: nommerChamps(z.strictObject({ perLevel: z.number(), zeroAt: z.number() }), { perLevel: { label: "par niveau" }, zeroAt: { label: "seuil de zéro" } }).optional(),
    /** Modes d'attaque ajoutés par la capacité (Maniement de deux armes → ['dual-wield']). */
    attackModes: z.array(z.string()).optional(),
    /** Pénalité aux défenses du porteur après une double frappe, jusqu'au début de son prochain Tour
     *  (Maniement de deux armes, LDB 10 l.773). Lue par `dualStrikeDefensePenalty(c)`. */
    dualStrikeDefense: z.number().optional(),
    // ── Dégâts (× niveau) ──────────────────────────────────────────────────────
    /** Coup puissant : +niveau Dégâts avec les armes de Corps à corps. */
    meleeDamageBonus: z.boolean().optional(),
    /** Tir précis : +niveau Dégâts avec les armes à distance. */
    rangedDamageBonus: z.boolean().optional(),
    /** Combat déloyal : +niveau Dégâts avec Corps à corps (Bagarre). */
    brawlDamageBonus: z.boolean().optional(),
    /** Charge berserk / Déterminé : +niveau Dégâts quand on Charge. */
    chargeDamageBonus: z.boolean().optional(),
    /** Tueur : Bonus de Force = Bonus d'Endurance de la cible s'il est plus élevé. */
    slayer: z.boolean().optional(),
    /** Robuste : réduit tous les Dégâts SUBIS de niveau (min 1 Blessure). */
    damageReduction: z.boolean().optional(),
    /** Frappe blessante : +niveau Blessures quand on inflige une Blessure Critique. */
    critExtraWounds: z.boolean().optional(),
    /** Tir sûr : ignore niveau PA de la cible au tir. */
    rangedAPIgnore: z.boolean().optional(),
    // ── Modificateurs de Test d'attaque ────────────────────────────────────────
    /** Frappe assommante : pas de −20 de Localisation visée (Tête) avec une arme Assommante. */
    ignoreCalledShotHead: z.boolean().optional(),
    /** Tir mortel : choisit la Localisation au tir — pas de −20 de Localisation visée à distance. */
    ignoreCalledShotRanged: z.boolean().optional(),
    /** Tireur d'élite : ignore les modificateurs de Taille de la cible au tir. */
    ignoreSizeRangedMods: z.boolean().optional(),
    /** Tireur embusqué : aucune pénalité à Longue portée, moitié à Portée extrême. */
    sniper: z.boolean().optional(),
    // ── Initiative / économie d'action ─────────────────────────────────────────
    /** Combat instinctif : +10 × niveau à l'Initiative de combat. */
    initiativeBonus: z.boolean().optional(),
    /** Tir rapide : tire hors de l'ordre d'Initiative si l'arme à distance est chargée (pré-emption gratuite). */
    strikeFirstRanged: z.boolean().optional(),
    /** Vigilance : Test de Perception Intermédiaire (+0) pour ignorer la Surprise. */
    surpriseSave: z.boolean().optional(),
    /** Rechargement rapide ('all') / Artilleur ('blackpowder') : +niveau DR aux Tests de rechargement. */
    reloadDR: z.enum(['all', 'blackpowder']).optional(),
    /** Sprinter : Mouvement +1 quand on Court. */
    runBonus: z.boolean().optional(),
    /** Fuite ! : Mouvement +1 quand on Fuit. */
    fleeBonus: z.boolean().optional(),
    /** Fuite ! — variante « Nouveaux talents et talents mis à jour » (AA 13 l.68) : Mouvement +1 quand on
     *  est la Cible d'une Poursuite. Lu par la manche de poursuite terrestre (`noyau/pursuitFlow.ts`,
     *  `pursuedMovement`) au calcul du DR de vitesse (LDB 15 l.104-108). */
    pursuitTargetBonus: z.boolean().optional(),
    // ── Défense / Avantage ─────────────────────────────────────────────────────
    /** Porte-Bouclier (LDB 10 l.972) : +niveau Avantage quand on se défend au Bouclier et qu'on PERD le
     *  Test opposé (consolation d'une situation désespérée — pas sur une défense gagnée). */
    shieldAdvantage: z.boolean().optional(),
    /** Réaction défensive à coût d'Avantages de réserve (Porte-Bouclier variante « Avantage de groupe »,
     *  AA 13 l.84) : quand on se défend au Bouclier, 1×/Round, dépenser `cost` Avantages soit pour causer des
     *  Dégâts « comme s'il s'agissait de son Action », soit pour repousser l'attaquant de 2 m et se
     *  désengager. Déclarée en DONNÉE (variante `variants[].combat`, active en mode Avantage de groupe) ;
     *  offerte par le chooser de défense (`shieldReactionCost`), débitée par `campSpend`, résolue par
     *  `applyShieldReaction`. */
    advantageDefenseReaction: nommerChamps(z.strictObject({ avantage: z.number() }), { avantage: { label: "Avantage" } }).optional(),
    /** Contre-attaque en gagnant un Test opposé de défense en mêlée (Champion LDB 85 sans condition d'arme ;
     *  Riposte LDB 10 avec `counterRequiresFastParry`). GÉNÉRIQUE : tout talent/trait qui le déclare contre. */
    counterOnDefenseWin: z.boolean().optional(),
    /** La contre-attaque exige une arme de PARADE Rapide (Riposte ; Champion ne l'exige pas). */
    counterRequiresFastParry: z.boolean().optional(),
    /** La contre-attaque se DÉCLARE, au plus Niveau fois par Round (Riposte LDB 10 l.1037). */
    counterDeclaredPerLevel: z.boolean().optional(),
    /** Renversement : en gagnant le Test opposé de Corps à corps, prend TOUS les Avantages adverses au lieu de +1. */
    stealAdvantage: z.boolean().optional(),
    /** Renversement — variante « Avantage de groupe » (AA 13 l.92-98) : prend 1 Avantage dans la réserve
     *  ADVERSE (au lieu de tout l'Avantage individuel de l'adversaire), l'ajoute à sa réserve, sans Dégât. */
    stealOne: z.boolean().optional(),
    /** Coude-à-coude — variante « Avantage de groupe » (AA 13 l.43) : « compte comme deux combattants »
     *  au décompte de domination de fin de Round (transfert d'Avantage). Poids par défaut 1. */
    transferWeight: z.number().optional(),
    /** Artilleur / Rechargement rapide — variante « Avantage de groupe » (AA 13 l.9/90) : recharger une
     *  arme pendant un combat compte comme une Action Évaluer → +1 Avantage supplémentaire au rechargement. */
    reloadAssessAdvantage: z.boolean().optional(),
    /** Cavalier émérite — variante « Avantage de groupe » (AA 13 l.25) : Taille considérée égale à celle de
     *  la monture pour résister à la Peur/Terreur causée UNIQUEMENT par la Taille de l'adversaire. */
    fearSizeAsMount: z.boolean().optional(),
    /** Impitoyable — variante « Avantage de groupe » (AA 13 l.74) : le coût d'Avantage d'une Retraite
     *  stratégique (Désengagement, défaut 2 Avantages, AA 11 l.37) tombe à cette valeur pour le porteur. */
    retreatCost: z.number().optional(),
    /** Impitoyable (LDB 10 l.591) : au Désengagement « Sacrifier l'Avantage », GARDE niveau Avantages au
     *  lieu de tomber à 0 (× niveau). */
    keepAdvantageOnDisengage: z.boolean().optional(),
    /** Impitoyable (LDB 10 l.591) : peut Sacrifier l'Avantage pour se Désengager MÊME avec moins d'Avantage
     *  que ses adversaires (relâche la garde de supériorité stricte). */
    disengageWithLessAdvantage: z.boolean().optional(),
    /** Battement — variante « Avantage de groupe » (AA 13 l.17) : manœuvre d'Action retirant de l'Avantage
     *  à la réserve ADVERSE (−1 sur Succès de Corps à corps, −1 de plus à 6 DR). Le porteur peut la déclarer. */
    battement: z.boolean().optional(),
    /** Distraire (LDB 10 / AA 13 l.51) : manœuvre de Mouvement — Test opposé Athlétisme/Calme ; sur Succès,
     *  la cible (mode groupe : sa réserve) ne gagne aucun Avantage jusqu'à la fin du prochain Round. */
    distraire: z.boolean().optional(),
    /** Maîtrise du combat : compte pour 1+niveau personnes au calcul du surnombre. */
    outnumberCount: z.boolean().optional(),
    /** Cœur vaillant : tente de retirer le Brisé même Engagé (Calme en fin de Round). */
    braveheart: z.boolean().optional(),
    /** Sans peur (LDB 10 l.1051) : PAS une immunité — détecte que le porteur a le Talent contre
     *  l'Ennemi spécifié (`ctx.spec` ; sans spec — talent ACCORDÉ par Flambeau de Vertu/Cœurs
     *  ardents — toutes sources). L'effet réel (un seul Test de Calme Accessible (+20), qui PEUT
     *  échouer) est résolu par `sansPeurVs`/`psychTest`/`pasDePeur` (psychology.ts). */
    fearImmune: z.boolean().optional(),
    /** Endurci : ignore niveau Points de Blessure perdus par l'État Hémorragique. */
    bleedIgnore: z.boolean().optional(),
    // ── Magie / psychologie ────────────────────────────────────────────────────
    /** Harmonisation aethyrique : pas d'Incantation Imparfaite sur un double RÉUSSI de Focalisation. */
    focusNoMiscastOnDouble: z.boolean().optional(),
    /** Diction instinctive : pas d'Incantation Imparfaite sur un double RÉUSSI de Langue (Magick). */
    castNoMiscastOnDouble: z.boolean().optional(),
    /** Effrayant : le porteur a un Indice de Peur égal à son niveau. */
    causesFear: z.boolean().optional(),
    // ── Tests hors combat ──────────────────────────────────────────────────────
    /** Inverse un Test RATÉ de la Compétence référencée s'il devient réussi (Sociable → Ragot, Studieux →
     *  Recherche…). Réfs STRUCTURÉES `{ id, spec? }` (jamais un match par libellé) ; `capDR` plafonne le DR
     *  (Pansement +1). TOUJOURS une LISTE : un Talent peut couvrir plusieurs Compétences en « ou »
     *  (Pilote → Ramer OU Voile, LDB 10 l.964). `contexte` : le Test que le Talent vise (LDB 10 l.899, l.966). */
    reverseFailed: nommerChamps(z.strictObject({ skills: z.array(refOuSpec('skill')).min(1), capDR: z.number().optional(), contexte: contexteDeTestSchema.optional() }), { skills: { label: "Compétences" }, capDR: { label: "limite de DR" }, contexte: { label: "contexte du Test" } }).optional(),
    // ── Économie / social ──────────────────────────────────────────────────────
    /** Négociateur : LDB 10 l.818 ; appliqué par `engine/bargain`. */
    bargainBonus: z.boolean().optional(),
    // ── Capacités diverses (hors combat direct) ──────────────────────────────────
    /** Costaud (LDB 10) : limite d'Encombrement +2 × niveau (items.maxEncumbrance). */
    encumbranceBonus: z.boolean().optional(),
    /** Âme pure (LDB 10) : seuil de Corruption +niveau (corruption.corruptionThresholdExceeded). */
    corruptionThreshold: z.boolean().optional(),
    /** Chirurgie (LDB 10) : débloque le mode de soin chirurgical (healing/partyFlow : fracture/amputation). */
    surgery: z.boolean().optional(),
    // ── Incantation (apprentissage des sorts — grimoire.ts) ──────────────────────
    /** Talent de lanceur (LDB 10) : famille d'incantation qu'il ouvre (Magie mineure → 'mineure',
     *  Magie des Arcanes → 'arcane', Invocation → 'invocation', Béni → 'beni', Magie du Chaos → 'chaos').
     *  La spécialisation (Domaine/Culte) est portée par `ctx.spec`. Remplace le name-match de grimoire. */
    castingKind: castingKindSchema.optional(),
    /** Commandant d'équipe (AA 13 l.29-35) : peut DIRIGER une équipe servant une Arme d'équipe « à portée
     *  de voix » (Test de Commandement Intermédiaire) — sur réussite, l'équipe tire au score de Projectiles
     *  du Personnage. Lu par `hasCommandTeam` (affordance + substitution `noyau/monde/commandTeam`). */
    commandTeam: z.boolean().optional(),
    /** Chanson de marin (MDG 09 l.32-40) : peut ENTONNER une chanson de marin connue (une spec du Talent =
     *  une chanson apprise, l.36) — Test de Divertissement (Chant), effet 3 min + DR sur tout l'équipage,
     *  une seule chanson par quart. Lu par `shantySingers` (affordance) + `chanterLaChanson` (state). */
    seaShanty: z.boolean().optional(),
    /** Frappe blessante — variante « Nouveaux talents et talents mis à jour » (AA 13 l.57) : au lieu de
     *  Blessures supplémentaires (`critExtraWounds`), lance deux fois le tableau de Blessures Critiques et
     *  garde le résultat préféré. Lu par la résolution de Critique (kind-agnostique, même primitive que le
     *  drapeau temporaire `critRollTwice` de Bénédiction de Sauvagerie, `engine/activeFlags.ts`). */
    critRollTwice: z.boolean().optional(),
  }), { offHandPenalty: { label: "malus de main secondaire" }, attackModes: { label: "modes d’attaque" }, dualStrikeDefense: { label: "pénalité de défense après double frappe" }, meleeDamageBonus: { label: "bonus de dégâts au contact" }, rangedDamageBonus: { label: "bonus de dégâts au tir" }, brawlDamageBonus: { label: "bonus de dégâts de bagarre" }, chargeDamageBonus: { label: "bonus de dégâts de charge" }, slayer: { label: "tueur" }, damageReduction: { label: "réduction des dégâts" }, critExtraWounds: { label: "Blessures critiques supplémentaires" }, rangedAPIgnore: { label: "armure ignorée au tir" }, ignoreCalledShotHead: { label: "ignorer la visée à la tête" }, ignoreCalledShotRanged: { label: "ignorer la visée à distance" }, ignoreSizeRangedMods: { label: "ignorer les modificateurs de Taille au tir" }, sniper: { label: "tireur d’élite" }, initiativeBonus: { label: "bonus d’Initiative" }, strikeFirstRanged: { label: "tirer le premier" }, surpriseSave: { label: "sauvegarde de surprise" }, reloadDR: { label: "DR de rechargement" }, runBonus: { label: "bonus de course" }, fleeBonus: { label: "bonus de fuite" }, pursuitTargetBonus: { label: "bonus de poursuite" }, shieldAdvantage: { label: "Avantage du bouclier" }, advantageDefenseReaction: { label: "réaction défensive avec Avantage" }, counterOnDefenseWin: { label: "riposte après défense réussie" }, counterRequiresFastParry: { label: "riposte avec parade rapide" }, counterDeclaredPerLevel: { label: "riposte déclarée, plafond par Niveau" }, stealAdvantage: { label: "vol d’Avantage" }, stealOne: { label: "voler un point" }, transferWeight: { label: "poids transféré" }, reloadAssessAdvantage: { label: "Avantage d’évaluation au rechargement" }, fearSizeAsMount: { label: "Taille de la monture pour la Peur" }, retreatCost: { label: "coût de retraite" }, keepAdvantageOnDisengage: { label: "conserver l’Avantage au désengagement" }, disengageWithLessAdvantage: { label: "désengagement avec moins d’Avantage" }, battement: { label: "battement" }, distraire: { label: "distraction" }, outnumberCount: { label: "nombre pour la supériorité numérique" }, braveheart: { label: "courage" }, fearImmune: { label: "immunité à la Peur" }, bleedIgnore: { label: "ignorer le saignement" }, focusNoMiscastOnDouble: { label: "aucune Imparfaite sur un double réussi de Focalisation" }, castNoMiscastOnDouble: { label: "aucune Imparfaite sur un double réussi d’incantation" }, causesFear: { label: "Peur provoquée" }, reverseFailed: { label: "inverser les échecs" }, bargainBonus: { label: "bonus de marchandage" }, encumbranceBonus: { label: "bonus d’encombrement" }, corruptionThreshold: { label: "seuil de Corruption" }, surgery: { label: "chirurgie" }, castingKind: { label: "type d’incantation" }, commandTeam: { label: "équipe commandée" }, seaShanty: { label: "chant de marin" }, critRollTwice: { label: "double jet de Critique" } }),
);

/**
 * Valeur d'une règle optionnelle du registre `OPTIONAL_RULES` (`src/engine/policy.ts`) SANS sa règle, dont
 * `RuleValue` dérive ; la valeur d'UNE règle, que rend `rule(id)`, est `ValeurDeRegle[id]` (`_ids.generated.ts`).
 */
export const ruleValueSchema = z.union([z.boolean(), z.number(), z.string()]);

/** Garde d'une variante RÉGLÉE : la règle optionnelle visée (`OPTIONAL_RULES`, `src/engine/policy.ts`)
 *  et la valeur attendue ; `equals` défaut `true`. */
export const variantWhenSchema = nommerChamps(z.strictObject({ rule: idDe('regleOptionnelle'), equals: ruleValueSchema.optional() }), { rule: { label: "règle" }, equals: { label: "égalité" } });

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
 * l'ancre — `folioIntegrity.mjs:citedEntriesOf` les découvre déjà à toute profondeur (#563).
 */
export function variantOf<T extends z.ZodRawShape, K extends Extract<keyof T, string>>(
  entrySchema: z.ZodObject<T>,
  resolved: readonly K[],
) {
  const mask = tableTotale(resolved, () => true);
  const noms = metaDesChamps(entrySchema, { exigees: true });
  const final = marquerProduit(
    (entrySchema.pick(mask as Parameters<typeof entrySchema.pick>[0]) as unknown as z.ZodObject<Pick<T, K>>).partial().extend({ when: variantWhenSchema }),
    'variantOf',
    'variante',
    tableTotale(resolved, (cle) => entrySchema.shape[cle]),
  );
  return nommerChamps(final, {
    ...tableTotale(resolved, cle => noms[cle]),
    when: { label: 'condition' },
  } as MetaDesChamps<typeof final.shape>);
}

/** Vue TS COMMUNE d'une variante — le contrat de FORME (runtime) est celui de `variantOf` par dataset ;
 *  cette vue expose les champs partagés par tous les porteurs et laisse les autres en `unknown`. Portée
 *  par le champ `variants?: Variant[]` de toute entrée à variante réglée (`activeVariant`/`effectiveEntry`,
 *  `src/engine/variants.ts`). */
export type Variant = {
  when: { rule: RegleOptionnelleId; equals?: z.infer<typeof ruleValueSchema> };
  desc?: string;
  source?: SourceRef;
  [field: string]: unknown;
};

/**
 * Recette de détail de surface (`DetailRecipe`, `src/data/materials.types.ts`) — portée par le champ
 * optionnel `detail` de 2 datasets d'apparence (`materials.json` — domaines `roof` et `relief` — et
 * `structureAppearance.json`). Reflet STRICT de l'interface TS (mêmes sous-objets/champs requis).
 */
export const detailRecipeSchema = nommerChamps(z.strictObject({
  courses: nommerChamps(z
    .strictObject({
      hM: z.number(),
      joint: z.string(),
      jointW: z.number(),
      stagger: z.number().optional(),
      blockWM: z.tuple([z.number(), z.number()]).optional(),
      edgeWobble: z.number().optional(),
      paletteVar: z.number().optional(),
    }), { hM: { label: "hauteur en mètres" }, joint: { label: "joint" }, jointW: { label: "largeur du joint" }, stagger: { label: "décalage des rangs" }, blockWM: { label: "bloquer la carte du monde" }, edgeWobble: { label: "irrégularité des arêtes" }, paletteVar: { label: "variation de palette" } })
    .optional(),
  bands: z.array(nommerChamps(z.strictObject({ atV: z.number(), hM: z.number(), color: z.string() }), { atV: { label: "position verticale" }, hM: { label: "hauteur en mètres" }, color: { label: "couleur" } })).optional(),
  timber: nommerChamps(z
    .strictObject({
      postEveryM: z.number(),
      braces: z.enum(['X', 'V']).optional(),
      wM: z.number(),
      color: z.string(),
    }), { postEveryM: { label: "espacement des poteaux" }, braces: { label: "consoles" }, wM: { label: "largeur en mètres" }, color: { label: "couleur" } })
    .optional(),
  speckle: nommerChamps(z
    .strictObject({
      perM2: z.number(),
      rM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
      vBias: z.number().optional(),
    }), { perM2: { label: "par mètre carré" }, rM: { label: "rayon en mètres" }, colors: { label: "couleurs" }, vBias: { label: "biais vertical" } })
    .optional(),
  tufts: nommerChamps(z
    .strictObject({
      perM2: z.number(),
      hM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
    }), { perM2: { label: "par mètre carré" }, hM: { label: "hauteur en mètres" }, colors: { label: "couleurs" } })
    .optional(),
  tintVar: z.number().optional(),
  seedScope: z.enum(['edge', 'tile', 'instance']),
}), { courses: { label: "rangs" }, bands: { label: "bandes" }, timber: { label: "charpente" }, speckle: { label: "mouchetures" }, tufts: { label: "touffes" }, tintVar: { label: "variation de teinte" }, seedScope: { label: "portée de la graine" } });

/**
 * Niveau de `Difficulty` (`src/engine/types.ts`) tel qu'il apparaît en DONNÉE — vu sur plusieurs
 * datasets naval-commerce (`sea-navigation.json`, `sea-cargo.json`, `land-cargo.json`,
 * `sea-weather.json`) qui portent tous des champs `difficulty`/`*Difficulty` typés `Difficulty` par
 * leurs consommateurs (`DATA as unknown as { ... difficulty: Difficulty ... }`). Les 10 valeurs du
 * type canon (LDB Tests + extrêmes EDO App.2) — pas seulement le sous-ensemble présent aujourd'hui —
 * car c'est le type que les consommateurs attendent, une future entrée peut légitimement en ajouter.
 */
export const difficultySchema = enumNomme(DIFFICULTY_LABELS);

/** Acte de soin qui lève le verrou d'un État (`ConditionUnlock`, `engine/types.ts`). LDB 18 */
export const acteDeDeverrouillageSchema = enumNomme({ medicalAid: 'Aide Médicale', surgery: 'Chirurgie', magic: 'Soin magique' } satisfies Record<ConditionUnlock, string>);

/**
 * Sous-ensemble de `difficultySchema` que la colonne « Pénalité de Couvert » d'une Structure peut porter
 * (`AA 10 l.28-51`) : les quatre échelons auxquels une classe de couvert répond (`CoverClass`,
 * `engine/cover.ts`). DÉRIVE du tuple canon `COUVERT_DIFFICULTES` (`src/engine/types.ts`) et des
 * libellés canon `DIFFICULTY_LABELS` — il ne re-tape rien, et garde ses libellés (son propre `enumNomme`).
 */
export const couvertDifficultySchema = enumNomme(tableTotale(COUVERT_DIFFICULTES, (d) => DIFFICULTY_LABELS[d]));

/** `DeckCoverClass` (`src/engine/types.ts`) — couvert gradué d'un poste de pont ou d'un décor : porte UNIQUE
 *  des defs qui le portent (`vehicles`, `naval-traits`, `props`). */
export const deckCoverSchema = z.enum(['imparfaite', 'moyenne', 'totale']);

/**
 * `CharKey` (`src/engine/types.ts`) — les 10 Caractéristiques. Réf récurrente (Conditions `compare`,
 * `Formula.bonusOf`/`charOf`, `FlowTest.characteristic`, `AdvancementRef`…) — porte UNIQUE des defs qui
 * nomment une Caractéristique (`domains`/`maneuvers`/`qualities`/`talents`/`etats`/`spells`/`species`/
 * `careerLevels`…).
 */
export const charKeySchema = enumNomme(CHAR_LABELS);

/** Une Caractéristique et sa valeur IMPRIMÉE (`OptionalSwap['grant']`, `src/engine/statEntry.ts`) : l'octroi d'une
 *  variante « swap » (ZI 1 l.229). */
export const caracteristiqueChiffreeSchema = nommerChamps(
  z.strictObject({ characteristic: charKeySchema, value: nommerNoeud(z.number(), { nom: 'valeur' }) }),
  { characteristic: { label: 'caractéristique' }, value: { label: 'valeur' } },
);

/**
 * Clés d'un PROFIL chiffré : les 10 Caractéristiques ∪ `M` (Déplacement) ∪ `B` (Blessures) — la
 * graphie de `CustomStatblock.char` (`src/engine/statblock.ts`) et des profils de créature. `M` et `B`
 * ne sont pas des Caractéristiques à jet : ils n'entrent donc pas dans `charKeySchema`, dont ils
 * fausseraient toutes les autres portes (Conditions, `Formula.bonusOf`, `FlowTest`…).
 */
export const charStatKeySchema = enumNomme({ ...CHAR_LABELS, M: 'Mouvement', B: 'Blessures' });

/**
 * Un PROFIL chiffré (`CustomStatblock.char`, `Creature.char`) : clés FERMÉES sur `charStatKeySchema`,
 * chacune facultative. Écrit en objet à champs optionnels, jamais en `z.record` : `z.record(z.enum, …)`
 * est EXHAUSTIF en zod 4 (il exigerait les 12 clés), et `z.record(z.string(), …)` accepterait toute clé.
 */
export function profilChiffreSchema<V extends z.ZodType>(valeur: V) {
  return marquerProduit(nommerChamps(z.strictObject(
    tableTotale(charStatKeySchema.options, () => valeur.optional()),
  ), tableTotale(charStatKeySchema.options, cle => ({ label: libelleDeValeur(charStatKeySchema, cle) }))), 'profilChiffreSchema', 'profil');
}

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
 *  chaque surcharge de palette (#1903). */
export const couleurHexSchema = z.string().regex(/^#[0-9a-f]{6}$/, 'couleur hexadécimale « #rrggbb » attendue');

/** Le libellé de chaque emplacement de palette (`SLOTS`, `src/lib/palette.ts`). */
const LIBELLES_DES_SLOTS = {
  peau: 'Peau', cheveux: 'Cheveux', yeux: 'Yeux', vet1: 'Étoffe principale', vet2: 'Étoffe secondaire', cuir: 'Cuir', metal: 'Métal',
  corps: 'Corps', accent: 'Accent', bois: 'Bois', corne: 'Corne', fourrure: 'Fourrure', plume: 'Plume', vegetal: 'Végétal',
} as const satisfies Readonly<Record<Slot, string>>;

/** Un emplacement de palette. */
export const slotSchema = enumNomme(LIBELLES_DES_SLOTS);

/** Palette de couleurs persistée : clés dans `SLOTS`, valeurs `couleurHexSchema` (#1903) — palette des teintes d'objet
 *  de `materials.json`. */
export const surchargePaletteSchema = z.partialRecord(slotSchema, couleurHexSchema);

/** `ReachValue` (`src/engine/types.ts`) : les SEPT longueurs de l'axe d'Allonge (LDB 62 l.156-164) ou
 *  « Variable » (Arme improvisée, l.31). Vocabulaire FERMÉ, validé au CHARGEMENT (fail-fast) : hors de
 *  cette liste, `reachIdOf` ne rendrait aucun rang et toute règle d'Allonge se tairait en silence. */
export const reachSchema = z.enum([REACH_VARIABLE, ...Object.values(REACH_LABELS)]);

/** `WeaponDamageSpec` (`src/engine/types.ts`) — Dégâts d'arme : littéral, ou Bonus de Force + valeur fixe.
 *  Lu par les armes du catalogue (`trappings`) et les manœuvres qui portent leurs Dégâts (`maneuvers`). ZI */
export const weaponDamageSpecSchema = z.union([
  nommerChamps(z.strictObject({ literal: z.string() }), { literal: { label: 'Valeur littérale' } }),
  nommerChamps(z.strictObject({ plusBF: z.boolean(), flat: z.number(), bare: z.literal(true).optional(), bfInclus: z.literal(true).optional() }), {
    plusBF: { label: 'Ajouter le Bonus de Force' },
    flat: { label: 'Valeur fixe' },
    bare: { label: 'Mains nues' },
    bfInclus: { label: 'Indice BF inclus' },
  }),
]);

/** `WeaponRangeSpec` : mètres fixes, ou Bonus de Force × bf (armes de jet). */
export const weaponRangeSpecSchema = z.union([z.number(), nommerChamps(z.strictObject({ bf: z.number() }), { bf: { label: 'Bonus de Force' } })]);

/** `AmmoRangeMod` : fraction de la Portée de l'arme, ou ± mètres. */
export const ammoRangeModSchema = z.union([nommerChamps(z.strictObject({ mult: z.number() }), { mult: { label: 'Multiplicateur' } }), nommerChamps(z.strictObject({ add: z.number() }), { add: { label: 'Ajout' } })]);

/** `ItemCapabilities` (`src/data/index.ts`) — sac de drapeaux IRRÉDUCTIBLES, tous optionnels. */
export const itemCapabilitiesSchema = nommerChamps(z.strictObject({
  preventForcedDrop: z.boolean().optional(),
  weatherProtection: z.boolean().optional(),
  isShelter: z.boolean().optional(),
  isRations: z.boolean().optional(),
  isGrimoire: z.boolean().optional(),
  lockpicks: z.boolean().optional(),
  scurvyGuard: z.boolean().optional(),
  sealskin: z.boolean().optional(),
  shipParts: z.boolean().optional(),
  disarmImmune: z.boolean().optional(),
  ropeMode: z.boolean().optional(),
  waterContainer: z.boolean().optional(),
  improvisedWithoutCharge: z.boolean().optional(),
}), {
  preventForcedDrop: { label: 'Empêche la perte forcée' },
  weatherProtection: { label: 'Protection contre les intempéries' },
  isShelter: { label: 'Abri' },
  isRations: { label: 'Rations' },
  isGrimoire: { label: 'Grimoire' },
  lockpicks: { label: 'Crochets' },
  scurvyGuard: { label: 'Protection contre le scorbut' },
  sealskin: { label: 'Peau de phoque' },
  shipParts: { label: 'Pièces de navire' },
  disarmImmune: { label: 'Immunité au désarmement' },
  ropeMode: { label: 'Usage de la corde' },
  waterContainer: { label: 'Récipient d’eau' },
  improvisedWithoutCharge: { label: 'Improvisée sans Charge' },
});

/** Une capacité de `itemCapabilitiesSchema`, nommée par le libellé de son champ (`skills.tool.capability`). */
export const capaciteDObjetSchema = enumNomme(tableTotale(itemCapabilitiesSchema.keyof().options, (cle) => metaDesChamps(itemCapabilitiesSchema, { exigees: true })[cle].label));

/** Un palier d'entraînement à une prothèse (`prosthesisTraining`), son coût en XP et ce qu'il réduit ou accorde. LDB 73 l.19/23 */
export const entrainementDeProtheseSchema = nommerChamps(z.strictObject({ px: z.number(), label: z.string(), reduces: z.number().optional(), grants: z.enum(['movement', 'all']).optional() }), {
  px: { label: 'Points d’Expérience' },
  label: { label: 'Libellé' },
  reduces: { label: 'Réductions' },
  grants: { label: 'Accorde' },
});

/** La contenance d'un contenant (`container`). */
export const contenantSchema = nommerChamps(z.strictObject({ capacity: z.number() }), { capacity: { label: 'Capacité' } });

/** `Money` (`src/engine/money.ts:10`) — bourse à 3 dénominations, toutes CHIFFRÉES : la forme des
 *  CATALOGUES (`trappings`/`creatures`/`vehicles`/`crew-roles`/`mass-battle`), qui impriment un montant complet. */
export const moneySchema = nommerChamps(z.strictObject({ gold: z.number(), silver: z.number(), brass: z.number() }), { gold: { label: "couronnes d’or" }, silver: { label: "pistoles d’argent" }, brass: { label: "sous de cuivre" } }, { label: 'montant' });

/** La pièce d'une somme (`keyof Money`), ses libellés au pluriel. LDB 57 */
export const monnaieSchema = enumNomme({ gold: 'couronnes d’or', silver: 'pistoles d’argent', brass: 'sous de cuivre' } satisfies Record<keyof Money, string>);

/** La nature d'une mention (`DotationDeMention`), son libellé de rubrique. #4053 */
export const natureDeMentionSchema = enumNomme({ personne: 'Personnes', bete: 'Bêtes', vehicule: 'Véhicules', immeuble: 'Lieux', titre: 'Titres et droits', intangible: 'Réputation et tempérament' });
export type NatureDeMention = z.infer<typeof natureDeMentionSchema>;

/** Montant PARTIEL authoré (coût d'un choix, mise minimale, octroi) — mêmes 3 dénominations, chacune
 *  facultative ; `toMoney` (`src/engine/money.ts`) normalise en `Money` plein les dénominations absentes. */
export const moneyPartialSchema = nommerChamps(z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() }), { gold: { label: "couronnes d’or" }, silver: { label: "pistoles d’argent" }, brass: { label: "sous de cuivre" } });

/** `DiceSpec` (`src/engine/dice.ts`) — jet `{n, sides, fois?, plus?}`, partagé par `CountSpec.roll`, `Formula.dice` et `details`. */
export const diceSpecSchema = nommerChamps(z.strictObject({ n: z.number(), sides: z.number(), fois: z.number().positive().optional(), plus: z.number().optional() }), { n: { label: "nombre" }, sides: { label: "faces" }, fois: { label: "multiplicateur" }, plus: { label: "ajout" } });

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

/** Profil d'un mode de propulsion, Mouvement et équipage (MDG 12 l.114-133) — déclaré ICI une fois :
 *  `ship-construction` (tableau standard) et `vehicles` (avirons d'un navire) le lisent. */
export const profilDePropulsionSchema = nommerChamps(z.strictObject({ m: z.number(), crew: z.number() }), { m: { label: 'Mouvement' }, crew: { label: 'équipage' } });
export type ProfilDePropulsion = z.output<typeof profilDePropulsionSchema>;

/** Voile d'un navire : son profil et sa Spécialisation de Voile (MDG 13 l.18 ; LDB 09 l.571 ;
 *  issuecomment-6189471604, issuecomment-6191607539 de #1595). */
export const profilDeVoileSchema = nommerChamps(z.strictObject({ ...profilDePropulsionSchema.shape, spec: specDe('skill', COMPETENCE_DU_MODE.voile) }), { ...metaDesChamps(profilDePropulsionSchema, { exigees: true }), spec: { label: 'Spécialisation de Voile' } });
export type ProfilDeVoile = z.output<typeof profilDeVoileSchema>;

/** Axes de la MÉTÉO MARINE (`SeaWeather`, `engine/seaWeather.ts`) : une rangée de sa table, ou le climat
 *  qu'un événement impose. MDG 13 l.170 */
export const ventMarinSchema = z.enum(['calme-plat', 'legere-brise', 'brise-fraiche', 'vent-modere', 'vent-violent', 'violente-tempete']);
const AXES_DE_LA_METEO_MARINE = {
  precipitations: z.enum(['aucune', 'legeres', 'abondantes', 'tres-abondantes']),
  temperature: z.enum(['caniculaire', 'chaude', 'mediane', 'froide', 'glaciale']),
  visibilite: z.enum(['degage', 'brume', 'brouillard', 'puree-de-pois']),
  vent: ventMarinSchema,
};
const META_DE_LA_METEO_MARINE = {
  precipitations: { label: 'Précipitations' },
  temperature: { label: 'Température' },
  visibilite: { label: 'Visibilité' },
  vent: { label: 'Vent' },
};
export const meteoMarineSchema = nommerChamps(z.strictObject(AXES_DE_LA_METEO_MARINE), META_DE_LA_METEO_MARINE);
/** Climat IMPOSÉ : les seuls axes qu'il fixe (`Partial<SeaWeather>`), un au moins. MDG 15 l.189, l.199, l.248 */
export const meteoImposeeSchema = nommerChamps(z.strictObject({
  precipitations: AXES_DE_LA_METEO_MARINE.precipitations.optional(),
  temperature: AXES_DE_LA_METEO_MARINE.temperature.optional(),
  visibilite: AXES_DE_LA_METEO_MARINE.visibilite.optional(),
  vent: AXES_DE_LA_METEO_MARINE.vent.optional(),
}).refine((m) => Object.keys(m).length > 0, { message: 'météo imposée VIDE : nommer au moins un axe (précipitations, température, visibilité, vent).' }), META_DE_LA_METEO_MARINE);

/** `ShipLocation` (`src/engine/combat.ts`) — les Localisations de coque des DEUX jeux de Critiques
 *  (MDG naval : cargaison/gréement/coque/avirons/équipements ; MSRC fluvial : gouvernail/superstructure). */
export const shipLocationSchema = z.enum(['cargaison', 'greement', 'coque', 'avirons', 'equipements', 'gouvernail', 'superstructure']);

/** MDG 13 l.584 ; MSRC 07 l.70 */
export const replisSansExposeSchema = nommerChamps(z.strictObject({
  cible: shipLocationSchema,
  maison: maisonSchema.optional(),
}), { cible: { label: "cible" }, maison: { label: "arbitrage maison" } });

const libelleDeSaison = (cle: string): string => saisonParId(cle)?.label ?? cle;

/**
 * UNE VALEUR PAR SAISON — quatre colonnes saisonnières (`Season`, `src/engine/travelStages.ts`) :
 * disponibilité d100 (MDG 15 l.406-418, MSRC 13 l.73-78) et prix de base (MDG 15 l.422-434, MSRC 13
 * l.84-89) des cargaisons, modificateur de la météo marine (MDG 13 l.164-166). Les quatre clés se
 * déclarent ICI, une seule fois pour le dépôt ; ce que la colonne CONTIENT reste au porteur. Le libellé
 * d'une colonne est celui de la saison en donnée (`saisonParId`), lu à chaque accès ; une saison sans
 * fiche se nomme par sa clé.
 */
export const parSaison = <T extends z.ZodType>(valeur: T) =>
  marquerProduit(nommerChamps(z.strictObject({ printemps: valeur, ete: valeur, automne: valeur, hiver: valeur }), {
    printemps: { get label() { return libelleDeSaison('printemps'); } },
    ete: { get label() { return libelleDeSaison('ete'); } },
    automne: { get label() { return libelleDeSaison('automne'); } },
    hiver: { get label() { return libelleDeSaison('hiver'); } },
  }), 'parSaison', 'saisons');

/** Les clés de `parSaison`, lues sur son nœud. */
type Saison = keyof ReturnType<typeof parSaison<z.ZodNever>>['shape'];

/** Une SAISON, valeur d'un champ : les clés de `parSaison`, chacune nommée par sa fiche (`saisonParId`), lue
 *  à chaque accès. */
export const saisonSchema = enumNomme(
  Object.defineProperties({}, tableTotale(Object.keys(parSaison(z.never()).shape) as Saison[], (s) => ({ enumerable: true, get: () => libelleDeSaison(s) }))) as Record<Saison, string>,
);

/**
 * PRIX DE BASE d'une cargaison par SAISON (MDG 15 l.422-434, MSRC 13 l.80-90) : le résolveur y lit la
 * colonne de la saison courante.
 */
export const prixSaisonnierSchema = parSaison(z.number());

/** UNITÉ du prix de base du livre d'une voie : l'Encombrement que couvre un prix (MSRC 13 l.91, MDG 15 l.436),
 *  lue par `prixParPointDEnc` (`src/engine/cargo.ts`). */
export const prixDuLivreSchema = nommerChamps(z.strictObject({ encParPrix: z.number().positive(), source: sourceRefSchema }), {
  encParPrix: { label: 'Encombrement couvert par un prix' },
  source: { label: 'Source' },
});

/**
 * TIRAGE — une valeur authorée TIRÉE au dé (`Tirage`, `src/engine/dice.ts`, lue par `tirer`) : prix du
 * Vin maritime (MDG 15 l.429), Blessures d'une avarie, jours d'un événement de mer… Le dé est le
 * `DiceSpec` unique du projet, jamais une expression en chaîne (`EXPRESSION_DE_DE`). #1652
 */
export const tirageSchema = nommerChamps(z.strictObject({ dice: diceSpecSchema }), { dice: { label: "dés" } });


/** Modificateur de dés SIGNÉ (`EffetSigne`, `src/engine/dice.ts`, lu par `tirerSigne`) : MDG 14 (Moral),
 *  MDG 15 l.97-124 (Humeur de Manann). #1652 */
export const effetSigneSchema = nommerChamps(z.strictObject({ sign: z.union([z.literal(1), z.literal(-1)]), dice: diceSpecSchema }), { sign: { label: "signe" }, dice: { label: "dés" } });

/** Expression de dé écrite EN CHAÎNE (« 2d10 », « 1d10-4 », « 20+1d10 », « +2d10 ») : graphie hors
 *  grammaire dans la donnée authorée, où seule la clé `die` d'une table la porte. #1652 */
export const EXPRESSION_DE_DE = /^\s*[+-]?\s*(\d+\s*\+\s*)?\d*\s*d\s*\d+\s*([+-]\s*\d+)?\s*$/i;

/** `{x,y}` en CASES de grille — position d'un poste de pont (`vehicles.json`) comme case d'ABORD
 *  d'une place assise (`props.json`). */
export const cell2Schema = nommerChamps(z.strictObject({ x: z.number().finite(), y: z.number().finite() }), { x: { label: "abscisse" }, y: { label: "ordonnée" } });

/** `{x,y}` CONTINU du plan, point et non case, dans l'unité que nomme le champ qui le compose : pour cent d'un canevas
 *  (0-100) pour un lieu sur la carte du monde ou un point d'intérêt sur le plan de son lieu (`defs-scenes/worldmap.ts`),
 *  part du jeu libre d'un décor dans son empreinte (-1 à +1) pour son calage (`SceneEntity.calage`, `defs-scenes/scene.ts`). */
export const pointDuPlanSchema = nommerChamps(z.strictObject({ x: z.number(), y: z.number() }), { x: { label: "abscisse" }, y: { label: "ordonnée" } });

/**
 * `raceKey` — id STABLE des 7 espèces jouables (LDB + suppléments), patron `defs/characteristics`
 * (#310). Clé de `species.json.refChar`, `hairs.json`/`eyes.json.color`, `details.json.age`/
 * `taille` (#313). `names.json` en
 * reste EXCLU par exception documentée (`defs/names.ts`) : le label EST la donnée affichée.
 */
export const raceKeySchema = z.enum(['humain', 'halfling', 'nain', 'gnome', 'ogre', 'haut-elfe', 'elfe-sylvain']);
export type RaceKey = z.infer<typeof raceKeySchema>;

/** Rangée d'une table de couleur par espèce, à son seuil du dé de la table — partagée par `eyes.json`
 *  (LDB 05 l.742-754) et `hairs.json` (LDB 05 l.756-768). */
export const rangeeDeCouleurSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  rand: z.number(),
  /** Borne haute propre à une colonne (NADJ 15 l.99-104, #420) ; défaut = `rand`. */
  randByRace: z.partialRecord(raceKeySchema, z.number()).optional(),
  color: z.partialRecord(raceKeySchema, z.string()),
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  rand: { label: 'Seuil aléatoire (borne haute du dé)', hint: 'Borne haute cumulée du dé de la table qui atteint cette couleur, sauf borne propre à une race' },
  randByRace: { label: 'Borne par race', hint: 'Borne haute du dé propre à une race, quand elle diffère du LDB' },
  color: { label: 'Couleur par race', hint: 'Couleur affichée, par race (colonne du tableau)' },
});

/**
 * `CastingNumberMod` (`src/engine/castingNumber.ts`) — modificateur de NIVEAU D'INCANTATION porté
 * par un objet, un lieu, un support de lecture ou une Activité. Partagé par tous les datasets qui
 * en portent (`arcane-phenomena.json`, `rituals.json`).
 */
export const castingNumberModSchema = nommerChamps(z
  .strictObject({
    multiply: z.number().optional(),
    divide: z.number().optional(),
    round: z.enum(['inferieur', 'superieur']).optional(),
    delta: z.number().optional(),
    min: z.number().optional(),
    scope: nommerChamps(z
      .strictObject({
        domains: refs('domain', { min: 1 }).optional(),
        domainsExcept: refs('domain', { min: 1 }).optional(),
        chaosMagic: z.boolean().optional(),
        spellIds: refs('spell', { min: 1 }).optional(),
        kinds: z.array(z.enum(['sort', 'rituel'])).min(1).optional(),
      }), { domains: { label: "domaines" }, domainsExcept: { label: "domaines exclus" }, chaosMagic: { label: "magie du Chaos" }, spellIds: { label: "sorts" }, kinds: { label: "types" } })
      .optional(),
    /** Valeur maison ÉDITABLE portant sa justification, quand le RAW laisse un point ouvert
     *  (sens d'arrondi non imprimé…) — AGENTS.md règle 7. */
    maison: maisonSchema.optional(),
    source: sourceRefSchema,
    /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
    desc: z.string(),
  })
  .refine((m) => m.divide == null || m.round != null, {
    message: 'castingNumberMod : une division de NI doit déclarer son sens d’arrondi (`round`)',
  })
  .refine((m) => m.multiply != null || m.divide != null || m.delta != null, {
    message: 'castingNumberMod : un modificateur sans `multiply`/`divide`/`delta` ne modifie rien',
  }), { multiply: { label: "multiplier" }, divide: { label: "diviser" }, round: { label: "arrondi" }, delta: { label: "variation" }, min: { label: "minimum" }, scope: { label: "portée" }, maison: { label: "arbitrage maison" }, source: { label: "source" }, desc: { label: "texte" } });

/** Quantité fixe ou tirage de dés (`CountSpec`). */
export const countSpecSchema = z.union([
  nommerChamps(z.strictObject({ fixed: z.number() }), { fixed: { label: "fixé" } }),
  nommerChamps(z.strictObject({ roll: diceSpecSchema }), { roll: { label: "jet" } }),
]);
/** Quantité d'une dotation : nombre fixe ou jet de dés. */
export type CountSpec = z.infer<typeof countSpecSchema>;

/** Le libellé de chaque sexe d'une apparence (`SEXES`, `src/lib/sexe.ts`). */
const LIBELLES_DES_SEXES = { M: 'Masculin', F: 'Féminin' } as const satisfies Readonly<Record<SexeDApparence, string>>;

/** Sexe d'une apparence — UNE déclaration pour `entityAppearanceSchema` et `defs/pregens.ts`.
 *  Chaque affichage lit le libellé par
 *  `libelleDeValeur(sexeSchema, v)`. */
export const sexeSchema = enumNomme(LIBELLES_DES_SEXES);
export type Sexe = z.infer<typeof sexeSchema>;

/** La main d'un objet tenu ou d'une arme, UNE déclaration : `defs/presets-de-personnage.ts` (`prises`) et
 *  `grammaire/mecanique.ts` (`weaponHand`). */
export const mainSchema = enumNomme({ main: 'Main directrice', secondaire: 'Main secondaire' });

/** Les objets de la campagne (`narratif.objets`), que désignent hors du catalogue l'objet donné (Effet et GameOp
 *  `giveTrapping`) et la clé d'une apparence par objet (`apparencesDObjetsSchema`) ; le projet l'ouvre (`projetSchema`).
 *  Déclarée ici et non dans `defs-scenes/communs.ts`, qui importe ce module. */
export const OBJETS_DU_PROJET = { collection: 'narratif.objets', catalogue: 'objets de la campagne' } as const satisfies PorteeLocale;

type FauteDApparence = { readonly path: readonly (string | number)[]; readonly message: string };

/** #2948 — l'apparence `apparence` de l'objet `trappingId` (absent : objet `custom`), résolu par `resoudre`, au `path`. */
function fautesDApparence(trappingId: string | undefined, apparence: string, resoudre: TrappingResolver, path: readonly (string | number)[]): FauteDApparence[] {
  const message = messageDApparenceDObjet(trappingId, apparence, resoudre);
  return message ? [{ path, message }] : [];
}

/** L'objet de la campagne `entree(id)`, en résolveur d'objet. */
const objetDeLaCampagne = (entree: (id: string) => unknown): TrappingResolver => (id) => entree(id) as TrappingData | undefined;

const signaler = (ctx: z.RefinementCtx, fautes: readonly FauteDApparence[]): void => {
  for (const f of fautes) ctx.addIssue({ code: 'custom', path: [...f.path], message: f.message });
};

/** OBJET DONNÉ (Effet et GameOp `giveTrapping`) : l'apparence d'un objet du catalogue ou `custom` se juge au catalogue ;
 *  celle d'un objet de la campagne, sous `OBJETS_DU_PROJET` (`controlerSousPortee`). */
export function avecApparenceDObjetDonne<N extends z.ZodType<{ trappingId?: string; apparence?: { id: string } }>>(noeud: N): N {
  const jugee = noeud.superRefine((v, ctx) => {
    if (v.apparence && (v.trappingId === undefined || findTrappingById(v.trappingId))) signaler(ctx, fautesDApparence(v.trappingId, v.apparence.id, findTrappingById, ['apparence', 'id']));
  });
  return controlerSousPortee(jugee, OBJETS_DU_PROJET, (valeur, entree) => {
    if (!estObjet(valeur) || typeof valeur.trappingId !== 'string' || entree(valeur.trappingId) === undefined) return [];
    const apparence = idDApparence(valeur.apparence);
    return apparence === undefined ? [] : fautesDApparence(valeur.trappingId, apparence, objetDeLaCampagne(entree), ['apparence', 'id']);
  });
}

/** L'id d'une référence d'apparence `{ id }` lisible, `undefined` pour toute autre valeur (refusée par son propre nœud). */
const idDApparence = (apparence: unknown): string | undefined => (estObjet(apparence) && typeof apparence.id === 'string' ? apparence.id : undefined);

/** Apparence par objet porté, clé = id de trapping du catalogue ou objet de la campagne (`OBJETS_DU_PROJET`) :
 *  `EntityAppearance.apparencesObjets`, presets de personnage (#3086). Ses clés sont celles d'un `recordDIds`, qui laisse
 *  la référence d'apparence jugée au parse de mesure. */
export const apparencesDObjetsSchema: z.ZodType<Partial<Record<string, { id: string }>>, Partial<Record<string, { id: string }>>> = controlerSousPortee(
  recordDIds('trapping', ref('apparence'), undefined, { portee: OBJETS_DU_PROJET }).superRefine((v, ctx) => {
    for (const [trappingId, apparence] of Object.entries(v)) if (apparence && findTrappingById(trappingId)) signaler(ctx, fautesDApparence(trappingId, apparence.id, findTrappingById, [trappingId, 'id']));
  }),
  OBJETS_DU_PROJET,
  (valeur, entree) =>
    estObjet(valeur)
      ? Object.entries(valeur).flatMap(([trappingId, apparence]) => {
          const id = idDApparence(apparence);
          return id !== undefined && entree(trappingId) !== undefined ? fautesDApparence(trappingId, id, objetDeLaCampagne(entree), [trappingId, 'id']) : [];
        })
      : [],
);

/** Refus d'une espèce d'apparence hors de `especeDApparenceSchema`. */
export function messageDEspeceInconnue(id: string): string {
  return `espèce « ${id} » inconnue : ni espèce jouable, ni espèce du plan de bestiaire (planDeBestiaire.json).`;
}

/** Espèce d'APPARENCE (`EntityAppearance.species`) : espèce jouable ou espèce du plan de bestiaire (#2993). */
export const especeDApparenceSchema = z.union(
  [idDe('species'), idDe('planDeBestiaire')],
  { error: (iss) => messageDEspeceInconnue(String(iss.input)) },
);

/** Faute de l'espèce d'apparence `id` (`especeDApparenceSchema`), `null` si elle est admise. */
export function fauteDEspece(id: string): string | null {
  return especeDApparenceSchema.safeParse(id).success ? null : messageDEspeceInconnue(id);
}

/** Tenue d’apparence qui se FERME sur la donnée : carrière ou `nu`. #3116, #3456 */
export const tenueFermeeSchema: z.ZodType<string, string> = z.union([idDe('career'), z.literal('nu')], {
  error: (iss) => messageDeTenueInconnue(String(iss.input)),
});

/** Refus d'une tenue hors de `tenueFermeeSchema`. */
export function messageDeTenueInconnue(id: string): string {
  return `tenue « ${id} » inconnue : ni carrière, ni « nu ».`;
}

export const emblemeSchema = ref('gardeRobe', undefined, 'embleme');

/** Palette d'un personnage ou d'un élément 3D : une couleur du nuancier (`materials.json`, domaine `couleur`) par
 *  emplacement de palette. */
export const couleursSchema = z.partialRecord(slotSchema, ref('material', undefined, 'couleur'));
export type Couleurs = z.input<typeof couleursSchema>;

/** `EntityAppearance` (`src/engine/authoringAppearance.ts`) — apparence d'entité, composée par
 *  `creatures`, la scène (`SceneEntity.appearance`) et le narratif. */
export const entityAppearanceSchema = nommerChamps(z.strictObject({
  sex: sexeSchema.optional(),
  species: especeDApparenceSchema.optional(),
  tenue: tenueFermeeSchema.optional(),
  /** Armure de statblock (PA par localisation, sans inventaire) VISIBLE/portée (#774) — défaut
   *  absent : les PA restent mécaniques PURS, aucun art d'armure synthétisé (nu de l'espèce/naturel). */
  armurePortee: z.boolean().optional(),
  apparencesObjets: apparencesDObjetsSchema.optional(),
  embleme: emblemeSchema.optional(),
  couleurs: couleursSchema.optional(),
}), { embleme: { label: 'emblème' }, couleurs: { label: 'couleurs', hint: 'Couleur du nuancier par emplacement de palette ; absente, la teinte de l’objet ou la matière du modèle' }, sex: { label: "sexe" }, species: { label: "espèce" }, tenue: { label: "tenue" }, armurePortee: { label: "armure portée" }, apparencesObjets: { label: "apparences d’objets", texte: { regime: "technique" } } });

/** `HitLocation` (`src/engine/types.ts`) — 6 zones de touche (dé inversé, LDB). Resserré depuis
 *  `z.string()` (variantes `domains`/`talents`/`etats`/`spells`) sur l'enum SOURCE : aucune des 9 JSON
 *  ne porte de valeur hors de ces 6 (vérifié au parse). */
export const hitLocationSchema = z.enum(LOCALISATIONS_DE_COUP);

/** Matière d'une armure : celle du Groupe d'une pièce (`weaponGroups.material`) et celle du Trait Armure posé
 *  (`TraitPose.matiere`). LDB 63 l.41-58 ; LDB 63 l.97 ; LDB 85 l.39 ; VDM 02 l.169 ; #1463. */
export const matiereDArmureSchema = enumNomme({ metal: 'métal', leather: 'cuir', chaos: 'armure du Chaos', peau: 'peau' });
export type MatiereDArmure = z.infer<typeof matiereDArmureSchema>;

/** Indice par Localisation : les six Localisations, chacune son Indice. AA 09 l.184 ; MCLB 02 l.101. */
export const parLocalisationSchema = nommerChamps(
  z.strictObject(tableTotale(LOCALISATIONS_DE_COUP, () => z.number().int().nonnegative())),
  tableTotale(LOCALISATIONS_DE_COUP, (loc) => ({ label: HIT_LOCATION_LABELS[loc] })),
);

/** Feuille de référence du terme `{rule}`, instanciée UNE fois : `formulaSchema` est un `z.lazy` que
 *  chaque composition ré-évalue — une fabrique appelée DANS le `lazy` poserait une marque par instance
 *  (58 mesurées), là où le site de référence est UN. */
const refRegleOptionnelle = idDe('regleOptionnelle');

/** Termes de jet de la grammaire (`TermeDeJet`, `src/engine/ops.ts`) : leur valeur ne se connaît qu'AU jet. */
export const TERMES_DE_JET = ['dice', 'rolled', 'sl', 'tire'] as const;

/** Premier terme de jet rencontré dans une formule (imbrications `sum[]`, `times.of`, `times.factor`,
 *  `minimum.of`, `parTranche.of`), ou `null`. PURE. */
const termeDeJet = (f: unknown): string | null => {
  if (f == null || typeof f !== 'object') return null;
  const o = f as Record<string, unknown>;
  const direct = TERMES_DE_JET.find((t) => t in o);
  if (direct) return direct;
  if (Array.isArray(o.sum)) for (const terme of o.sum) { const trouve = termeDeJet(terme); if (trouve) return trouve; }
  const times = o.times as { of?: unknown; factor?: unknown } | undefined;
  if (times && typeof times === 'object') return termeDeJet(times.of) ?? termeDeJet(times.factor);
  return 'minimum' in o || 'parTranche' in o ? termeDeJet(o.of) : null;
};

/** Le refus d'une quantité lue avant tout jet qui porte un terme de jet, ou `undefined` si `f` n'en
 *  porte aucun. */
export const messageDeTermeDeJet = (f: unknown): string | undefined => {
  const terme = termeDeJet(f);
  return terme ? `le terme \`{${terme}}\` est tiré au jet, or cette quantité se lit avant tout jet (portée, cibles, zone, bonus de DR, modificateur de Test affiché). Emploie un littéral, une caractéristique ou un \`{rule}\` éditable.` : undefined;
};

/** Le terme « bonus de caractéristique » de la grammaire d'une quantité, que composent aussi les champs
 *  qui n'admettent que lui (`max` d'un Talent). */
export const termeBonusDe = nommerChamps(z.strictObject({ bonusOf: charKeySchema }), { bonusOf: { label: "bonus de caractéristique" } });
/** Le Maxi d'un Talent « Nombre de Sorts disponibles dans le Domaine de Magie du Chaos choisi » (`LDB 10 l.704`). */
export const maxiSortsDuDomaine = z.literal('sortsDuDomaine');

/** Les options de la grammaire d'une quantité, dans l'ordre du sélecteur ; `soi` est le schéma
 *  récursif, `avecJet` admet les termes de jet. */
const optionsDeFormule = (soi: z.ZodType<unknown>, avecJet: boolean): z.ZodType<unknown>[] => [
  nommerNoeud(z.number(), { label: 'nombre' }),
  termeBonusDe,
  marquerProduit(nommerChamps(z.strictObject({ charOf: charKeySchema }), { charOf: { label: "valeur de caractéristique" } }), 'optionsDeFormule', 'charOf'),
  ...(avecJet ? [
    marquerProduit(nommerChamps(z.strictObject({ dice: diceSpecSchema }), { dice: { label: "dés" } }), 'optionsDeFormule', 'dice'),
    marquerProduit(nommerChamps(z.strictObject({ rolled: z.literal(true) }), { rolled: { label: "résultat du jet" } }), 'optionsDeFormule', 'rolled'),
  ] : []),
  marquerProduit(nommerChamps(z.strictObject({ indiceOf: z.literal(true) }), { indiceOf: { label: "valeur de l’indice" } }), 'optionsDeFormule', 'indiceOf'),
  marquerProduit(nommerChamps(z.strictObject({ stacks: z.literal('self') }), { stacks: { label: "cumuls" } }), 'optionsDeFormule', 'stacks'),
  marquerProduit(nommerChamps(z.strictObject({ engagedAdvantageGap: z.literal(true) }), { engagedAdvantageGap: { label: "écart d’Avantage au contact" } }), 'optionsDeFormule', 'engagedAdvantageGap'),
  marquerProduit(nommerChamps(z.strictObject({ woundsDealt: z.literal(true) }), { woundsDealt: { label: "Blessures infligées" } }), 'optionsDeFormule', 'woundsDealt'),
  // MDG 15 l.33.
  marquerProduit(nommerChamps(z.strictObject({ blessuresMax: z.literal(true) }), { blessuresMax: { label: "Blessures maximales" } }), 'optionsDeFormule', 'blessuresMax'),
  // MDG 15 l.246.
  marquerProduit(nommerChamps(z.strictObject({ tailleDuNavire: z.literal(true) }), { tailleDuNavire: { label: "Taille du navire" } }), 'optionsDeFormule', 'tailleDuNavire'),
  // MDG 15 l.247.
  marquerProduit(nommerChamps(z.strictObject({ valeurCargaison: z.literal(true) }), { valeurCargaison: { label: "valeur de la cargaison" } }), 'optionsDeFormule', 'valeurCargaison'),
  // LDB 09 l.97.
  ...(avecJet ? [marquerProduit(nommerChamps(z.strictObject({ sl: z.literal(true) }), { sl: { label: "DR" } }), 'optionsDeFormule', 'sl')] : []),
  // MDG 15 l.245.
  ...(avecJet ? [marquerProduit(nommerChamps(z.strictObject({ tire: z.string().min(1), de: soi.optional() }), { tire: { label: "valeur liée", texte: { regime: "technique" } }, de: { label: "tirage" } }), 'optionsDeFormule', 'tire')] : []),
  marquerProduit(nommerChamps(z.strictObject({ rule: refRegleOptionnelle }), { rule: { label: "règle" } }), 'optionsDeFormule', 'rule'),
  marquerProduit(nommerChamps(z.strictObject({ sum: z.array(soi) }), { sum: { label: "somme" } }), 'optionsDeFormule', 'sum'),
  // VDM 05.
  marquerProduit(nommerChamps(z.strictObject({ times: marquerProduit(nommerChamps(z.strictObject({ of: soi, factor: soi }), { of: { label: "contenu" }, factor: { label: "facteur" } }), 'optionsDeFormule', 'times.of') }), { times: { label: "multiplicateur" } }), 'optionsDeFormule', 'times'),
  // AA 07 l.113 ; LDB 18 l.88.
  marquerProduit(nommerChamps(z.strictObject({ minimum: z.number().int().nonnegative(), of: soi }), { minimum: { label: "minimum" }, of: { label: "contenu" } }), 'optionsDeFormule', 'minimum'),
  // LDB 85 l.324.
  marquerProduit(nommerChamps(z.strictObject({ parTranche: z.number().int().positive(), of: soi }), { parTranche: { label: "tranche" }, of: { label: "contenu" } }), 'optionsDeFormule', 'parTranche'),
];

/** `Formula` (`src/engine/ops.ts`) — quantité résolue à l'application (littéral/dés/bonus/Indice/
 *  jet-associé/pions/écart d'Avantage/Blessures infligées/Blessures maximales/Taille du navire/valeur de la
 *  cargaison/valeur liée/somme/facteur/borne basse/tranches). Resserré ici sur `CharKey`
 *  (fidèle à `src/engine/ops.ts`), sans risque pour les datasets (vérifié au parse). */
export const formulaSchema: z.ZodType<Formula> = z.lazy(() => z.union(optionsDeFormule(formulaSchema, true) as [z.ZodType<Formula>, ...z.ZodType<Formula>[]]));

/** `ConsumableDuration` (`src/engine/consumables.ts`) — UNE durée par objet (minutes/heures/jours). */
export const consumableDurationSchema = nommerChamps(z.strictObject({
  minutes: formulaSchema.optional(),
  hours: formulaSchema.optional(),
  days: formulaSchema.optional(),
}), { minutes: { label: 'Minutes' }, hours: { label: 'Heures' }, days: { label: 'Jours' } });

/** `FormuleSansTirage` (`src/engine/ops.ts`, #2817) — quantité LUE AVANT tout jet (portée, cibles, zone
 *  d'un Sort, bonus de DR, modificateur de Test affiché) : la grammaire de `formulaSchema` sans ses
 *  termes de jet, refusés nominativement. */
export const formuleSansTirageSchema: z.ZodType<FormuleSansTirage> = z.lazy(() => z.union(
  optionsDeFormule(formuleSansTirageSchema, false) as [z.ZodType<unknown>, ...z.ZodType<unknown>[]],
  { error: (iss) => messageDeTermeDeJet(iss.input) },
)) as z.ZodType<FormuleSansTirage>;

/** Terme « (Points de Péché) » du porteur du jet — `LDB 40 l.58/62/65/68/73/75`. Substitué à
 *  l'EXPANSION d'une rangée de Colère des dieux (`engine/miscast.ts::resolveJsonFormula`), jamais à
 *  l'application de l'op : le Péché est expié AVANT `applyOps` (`noyau/combatFlow.ts`). */
export const sinPointsSchema = nommerChamps(z.strictObject({ sinPoints: z.literal(true) }), { sinPoints: { label: "Points de Péché" } });

/** `Formula` du dialecte de la Colère des dieux : une formule GÉNÉRALE, le terme de Péché, ou leur
 *  SOMME — la seule composition que le livre imprime (« 1d10 + (Points de Péché) »). */
export const formulaSinSchema = z.union([
  formulaSchema,
  sinPointsSchema,
  nommerChamps(z.strictObject({ sum: z.array(z.union([formulaSchema, sinPointsSchema])) }), { sum: { label: "somme" } }),
]);

/** Le nœud est-il, sous ses seules enveloppes (`optional`, `lazy`…), la grammaire SANS TIRAGE
 *  (`formuleSansTirageSchema`) ? C'est le DIALECTE d'un champ de `Formula` lu sur son schéma, comme
 *  `admetLePeche`. Descente unique `descendre` (`grammaire/descente.ts`). */
export function estSansTirage(noeud: unknown): boolean {
  if (!noeud || typeof noeud !== 'object') return false;
  let sansTirage = false;
  descendre([noeud], ({ noeud: n, path }) => {
    if (path !== '') return 'elaguer';
    if (n !== formuleSansTirageSchema) return;
    sansTirage = true;
    return 'arreter';
  });
  return sansTirage;
}

const PORTE_LE_PECHE = new WeakMap<object, boolean>();

/** Le nœud porte-t-il, à une profondeur quelconque, le terme de Péché (`sinPointsSchema`) ? C'est le
 *  DIALECTE d'un champ de `Formula` lu sur son schéma — un site d'édition le dérive du nœud de son
 *  champ, jamais d'une déclaration à la main. Descente unique `descendre` (`grammaire/descente.ts`) ;
 *  `formulaSchema` n'est pas redescendu, il ne porte pas le terme. */
export function admetLePeche(noeud: unknown): boolean {
  if (!noeud || typeof noeud !== 'object') return false;
  const connu = PORTE_LE_PECHE.get(noeud);
  if (connu !== undefined) return connu;
  let porte = false;
  descendre([noeud], ({ noeud: n }) => {
    if (n === formulaSchema) return 'elaguer';
    if (n !== sinPointsSchema) return;
    porte = true;
    return 'arreter';
  });
  PORTE_LE_PECHE.set(noeud, porte);
  return porte;
}

/** NATURE d'une Influence corruptrice (`LDB 19 l.29`) — clés des Tests de la fiche `influences-corruptrices`
 *  (`TESTS_DE_REGLE`, `engine/ruleRefs.ts`). SOURCE UNIQUE : les deux portes `corruptionExposure.nature`
 *  (op `GameOp`, effet de scène), les sélecteurs de l'atelier, la modale de Corruption et
 *  la couture du slot (`noyau/corruptionFlow.ts`) en dérivent — jamais une deuxième liste. */
export const NATURES_D_INFLUENCE = TESTS_DE_REGLE['influences-corruptrices'];
export type NatureDInfluence = (typeof NATURES_D_INFLUENCE)[number];
export const natureDInfluenceSchema = enumNomme(tableTotale(NATURES_D_INFLUENCE, (n) => n));

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
export const plageSchema = nommerChamps(z.strictObject({ min: z.number(), max: z.number() }), { min: { label: "Minimum" }, max: { label: "Maximum" } });

/**
 * FOURCHETTE À BORNE EXTRÊME OUVERTE — même concept `plage`, une seule divergence : la DERNIÈRE bande
 * n'a pas de plafond, ou la PREMIÈRE pas de plancher, et JSON n'a pas d'Infinity (`max: null`,
 * `min: null` ; c'est le lookup qui ouvre, `tableOuverte`, `src/engine/tables.ts`). Les deux champs
 * de `plageSchema` et leurs métadonnées (`metaDesChamps`), rendus nullables. Les bandes ouvertes de la
 * donnée sont NOMMÉES, une par document, par `src/data/plage-bornes-contrat.test.ts` (volet E). La
 * couverture d'une suite de telles bandes se vérifie par `ecartsDeCouverture(…, 'ouverte')` ci-dessous.
 */
export const plageOuverteSchema = nommerChamps(z.strictObject({ min: z.number().nullable(), max: z.number().nullable() }), metaDesChamps(plageSchema, { exigees: true }));

/**
 * PALIER d'une table à SEUILS — forme CANONIQUE du concept `palier`
 * (`scripts/docs/lib/structures-lexique.mts`) : un seul nombre, le `seuil` à partir duquel la rangée
 * vaut ; l'ordre total des seuils fait les bandes, et la rangée retenue est celle du plus haut seuil
 * atteint. C'est exactement ce que lit `findTierEntry` (`src/engine/tables.ts`), primitive unique de ce
 * lookup. Ni `plageSchema` ni `plageOuverteSchema` : aucune borne haute n'est écrite.
 *
 * La charge utile d'un palier s'ajoute par la SHAPE — `z.strictObject({ ...palierSchema.shape, … })`,
 * comme une fourchette. Un seuil est un ENTIER (DR, minute du jour, effectif) ; la borne de son domaine
 * appartient à la table qui le compose.
 */
export const palierSchema = nommerChamps(z.strictObject({ seuil: z.number().int() }), { seuil: { label: 'Seuil', hint: 'Valeur à partir de laquelle le palier s’applique' } });

/**
 * CIBLE d'un Test ÉTENDU (`LDB 12 l.174`) : le nom UNIQUE de sa cible de DR en donnée. Elle s'ajoute à son
 * porteur par la SHAPE, à côté du `test` (`flowTestSchema`) quand la donnée nomme le sujet, à côté de la
 * seule Difficulté quand le code le fixe.
 */
export const cibleEtendueSchema = nommerChamps(z.strictObject({ drCible: z.number() }), { drCible: { label: 'DR à atteindre' } });
export type CibleEtendue = z.infer<typeof cibleEtendueSchema>;

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
export const bornesSchema = nommerChamps(z
  .strictObject({ min: z.number().optional(), max: z.number().optional(), step: z.number().optional() })
  .superRefine((v, ctx) => {
    const ecart = ecartDeCoPresenceDesBornes(v);
    if (ecart) ctx.addIssue({ code: 'custom', path: [ecart.borne], message: ecart.message });
  }), { min: { label: "minimum" }, max: { label: "maximum" }, step: { label: "pas" } });

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
 * « 71 et + », LDB 07 l.70) ; sinon la borne haute exacte est exigée. `depuis: 'ouverte'` = la
 * première n'a PAS de plancher (`min: null`, « 50 ou moins », MDG 14 l.199) ; sinon la borne basse
 * exacte est exigée.
 */
export function ecartsDeCouverture<F extends { min?: number | null; max?: number | null }>(
  fourchettes: readonly F[],
  depuis: number | 'ouverte',
  jusqua: number | 'ouverte',
  nom: (f: F) => string,
): string[] {
  if (!fourchettes.length) return ['aucune fourchette'];
  const ecarts: string[] = [];
  const plancher = (f: F) => f.min ?? Number.NEGATIVE_INFINITY;
  const triees = [...fourchettes].sort((a, b) => plancher(a) - plancher(b));
  let attendu = depuis === 'ouverte' ? Number.NEGATIVE_INFINITY : depuis;
  for (const [i, f] of triees.entries()) {
    if (i === 0 && depuis === 'ouverte') {
      if (f.min !== null) ecarts.push(`${nom(f)} est la PREMIÈRE et porte un plancher (${f.min}) : sa borne basse reste OUVERTE (\`min: null\`)`);
    } else if (f.min !== attendu) ecarts.push(`${nom(f)} commence à ${f.min} au lieu de ${attendu}`);
    if (i === triees.length - 1 && jusqua === 'ouverte') {
      if (f.max !== null) ecarts.push(`${nom(f)} est la DERNIÈRE et porte un plafond (${f.max}) : sa borne haute reste OUVERTE (\`max: null\`)`);
      return ecarts;
    }
    if (typeof f.max !== 'number') {
      ecarts.push(`${nom(f)} n'a pas de borne haute`);
      return ecarts;
    }
    if (typeof f.min === 'number' && f.max < f.min) ecarts.push(`${nom(f)} finit (${f.max}) avant de commencer (${f.min})`);
    attendu = f.max + 1;
  }
  if (jusqua !== 'ouverte' && attendu !== jusqua + 1) {
    ecarts.push(`la dernière fourchette s'arrête à ${attendu - 1} au lieu de ${jusqua}`);
  }
  return ecarts;
}

/**
 * COUVERTURE DU DÉ d'une table tirée : ses fourchettes couvrent le dé que porte la table
 * (`deDeLaTableTiree`, `src/engine/tables.ts`) d'un seul tenant, de son plus petit total à son plus
 * grand (`facesDuDe`), ouverte en haut quand une fourchette l'est (`max: null`). Un dé illisible rend
 * `[]` : son champ (`deDeTirageSchema`) le refuse déjà, nominativement.
 */
export function ecartsDuDeDeLaTable<F extends { min?: number | null; max?: number | null }>(
  table: PorteurDeDe,
  fourchettes: readonly F[],
  nom: (f: F) => string,
): string[] {
  if (parseDice(table.die) === null) return [];
  const de = deDeLaTableTiree(table);
  return ecartsDeCouverture(fourchettes, totalDuDe(de, de.n), fourchettes.some((f) => f.max === null) ? 'ouverte' : facesDuDe(de), nom);
}

/** Un document d'un fichier de tables tirées : son dé et ses rangées. */
type TableTiree = { readonly id: string; readonly die: string; readonly entries: readonly { min?: number | null; max?: number | null }[] };

/** Le refus nominatif d'un document `t` dont les rangées ne couvrent pas le dé, posé sur `chemin`. */
function refuserLaCouverture<T extends TableTiree>(
  fichier: string, t: T, nom: (r: T['entries'][number], t: T) => string, ctx: z.RefinementCtx, chemin: (string | number)[],
): void {
  const ecarts = ecartsDuDeDeLaTable(t, t.entries, (r) => nom(r, t));
  if (ecarts.length) {
    ctx.addIssue({ code: 'custom', path: chemin, message: `${fichier} › ${t.id} : les rangées ne couvrent pas le ${t.die} d'un seul tenant — ${ecarts.join(' ; ')}.` });
  }
}

/**
 * L'`affinerDataset` d'un fichier de tables tirées : chaque document que `tiree` retient couvre son dé
 * (`ecartsDuDeDeLaTable`), refusé nominativement sur ses `entries`, ses rangées nommées par `nom`.
 */
export function couvertureDuDeParDocument<T extends TableTiree>(
  fichier: string,
  nom: (r: T['entries'][number], t: T) => string,
  tiree: (t: T) => boolean = () => true,
): (dataset: z.ZodType<unknown>) => z.ZodType<unknown> {
  return (dataset) =>
    dataset.superRefine((v, ctx) => {
      for (const [i, t] of (v as T[]).entries()) {
        if (tiree(t)) refuserLaCouverture(fichier, t, nom, ctx, [i, 'entries']);
      }
    });
}

/** L'`affinerDataset` d'un fichier qui EST une table tirée (famille `config`) : même refus que
 *  `couvertureDuDeParDocument`, sur ses `entries`. */
export function couvertureDuDeDuDocument<T extends TableTiree>(
  fichier: string,
  nom: (r: T['entries'][number], t: T) => string,
): (dataset: z.ZodType<unknown>) => z.ZodType<unknown> {
  return (dataset) => dataset.superRefine((v, ctx) => refuserLaCouverture(fichier, v as T, nom, ctx, ['entries']));
}

/**
 * FEUILLE ou VALEUR RÉSERVÉE — un champ qui admet, en plus de sa feuille, un littéral (ou la liste d'un
 * registre) que le moteur lit à part : gabarit d'instance substitué par `withArg` (`engine/flowCore ›
 * INDICE_TEMPLATE`, `ARG_TEMPLATE`), mot réservé interprété à l'application (`engine/ops › SELF_REF`) ou
 * marqueur narratif (`engine/conditions › NARRATIVE_MARKERS`). La réserve est une branche `z.literal`, ou un
 * `enumNomme` quand chaque valeur réservée a son libellé, du MÊME nœud : le parse de mesure n'y pose aucun repère.
 * Une valeur ni feuille ni réservée est refusée par le message de la FEUILLE (celui d'`idDe` nomme
 * l'id absent et son dataset), jamais par l'« Entrée invalide » générique d'une union.
 */
export function ouReserve<F extends z.ZodType, const R extends string>(feuille: F, reserve: R | readonly R[]): z.ZodUnion<readonly [F, z.ZodLiteral<R>]>;
export function ouReserve<F extends z.ZodType, E extends z.ZodEnum<Readonly<Record<string, string>>>>(feuille: F, reserve: E): z.ZodUnion<readonly [F, E]>;
export function ouReserve(feuille: z.ZodType, reserve: string | readonly string[] | z.ZodEnum) {
  const reservee = typeof reserve === 'string' ? z.literal([reserve]) : '_zod' in reserve ? reserve : z.literal(reserve);
  return z.union([feuille, reservee], {
    error: (iss) => {
      const branches = (iss as { errors?: readonly (readonly { message: string }[])[] }).errors;
      return branches?.[0]?.[0]?.message;
    },
  });
}
