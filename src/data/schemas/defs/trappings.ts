/**
 * Schéma de `trappings.json` — vocabulaire UNIFIÉ des objets (armes/armures/munitions/possessions/
 * consommables/véhicules-marqueur). Dérivé de l'interface `TrappingData` EXISTANTE
 * (`src/data/index.ts`, + `QualityRef`/`ItemCapabilities`/`Weapon`/`WeaponDamageSpec`/
 * `WeaponRangeSpec`/`AmmoRangeMod`/`ConsumableDuration`/`Formula`/`Flow`/`EffectOp` co-localisées dans
 * engine) et d'un inventaire EXHAUSTIF par script (histogramme de TOUTES les entrées du dataset).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { availabilitySchema, enumNomme, formulaSchema, moneySchema, reachSchema, sizeCategorySchema } from '../grammaire/valeurs';
import { gameOpSchema, flowSchema, triggeredEffectSchema } from '../grammaire/mecanique';
/** Les Atouts d'un objet passent par la vue COMMUNE `qualityRefSchema` : `quality` n'est PAS un type
 *  de `TYPES` (`grammaire/ref.ts`) — aucune fabrique FK ne le vise, et son ouverture est ancrée
 *  #1615/#1621. La population (438 références, dont 5 à Indice `{id:'taillade', value:1|2}`) est
 *  mesurée par `grammaire/formes-partagees.test.ts` à défaut d'être refinée au parse. */
import { qualityRefSchema } from '../grammaire/reference';


export const file = 'trappings.json';
export const famille = 'entite';

/** CATÉGORIE de catalogue d'une possession — id de logique qui ne s'affiche jamais nu. */
export const trappingCategorieSchema = enumNomme({
  melee: 'Armes de mêlée',
  ranged: 'Armes à distance',
  ammunition: 'Munitions',
  armor: 'Armures',
  trapping: 'Équipement',
});

/** `WeaponDamageSpec` (`src/engine/types.ts`) : `{literal}` OU `{plusBF,flat,bare?}` (`plusBF`
 *  toujours explicite — cf. `filet`/`lance-harpon`/`piege-a-chaines`, ZI). */
const weaponDamageSpecSchema = z.union([
  z.strictObject({ literal: z.string() }),
  z.strictObject({ plusBF: z.boolean(), flat: z.number(), bare: z.literal(true).optional() }),
]);

/** `WeaponRangeSpec` : mètres fixes, ou Bonus de Force × bf (armes de jet). */
const weaponRangeSpecSchema = z.union([z.number(), z.strictObject({ bf: z.number() })]);

/** `AmmoRangeMod` : fraction de la Portée de l'arme, ou ± mètres. */
const ammoRangeModSchema = z.union([z.strictObject({ mult: z.number() }), z.strictObject({ add: z.number() })]);

/** `ItemCapabilities` (`src/data/index.ts`) — sac de drapeaux IRRÉDUCTIBLES, tous optionnels. */
const itemCapabilitiesSchema = z.strictObject({
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
});

/** `Weapon` (`src/engine/types.ts`) — reflet des seuls champs pertinents en DONNÉE `derivedWeapon`
 *  (prothèse-arme, LDB 73 : « le Crochet est considéré comme une Dague »). `Weapon` porte aussi des
 *  champs runtime-only (`uid`, `hand`…) absents de la donnée d'auteur — non repris ici (jamais observés). */
const weaponSchema = z.strictObject({
  label: z.string(),
  type: z.enum(['melee', 'ranged']),
  damage: weaponDamageSpecSchema,
  reach: z.union([reachSchema, z.null()]).optional(),
  range: z.union([weaponRangeSpecSchema, z.null()]).optional(),
  qualities: z.array(qualityRefSchema),
  subType: z.string().optional(),
  weaponGroup: z.string().optional(),
  soloSimple: z.boolean().optional(),
  indirect: z.boolean().optional(),
  /** LDB 62 l.278 — approximation MAISON (le RAW ne liste pas les armes à lame), éditable. */
  bladed: z.boolean().optional(),
  /** LDB 47 — approximation MAISON (matière du projectile, non tabulée par le RAW), éditable. */
  organicProjectile: z.boolean().optional(),
  hands: z.union([z.literal(1), z.literal(2)]).optional(),
});

/** `ConsumableDuration` (`src/engine/consumables.ts`) — UNE durée par objet (minutes/heures/jours). */
const consumableDurationSchema = z.strictObject({
  minutes: formulaSchema.optional(),
  hours: formulaSchema.optional(),
  days: formulaSchema.optional(),
});

const doc = document(
  'trappings',
  famille,
  {
    hands: z.union([z.literal(1), z.literal(2)]).optional(),
    packSize: z.number().optional(),
    /** CATÉGORIE de catalogue — vocabulaire FERMÉ, mesuré sur 440/440 : melee 65, ranged 79,
     *  ammunition 22, armor 17, trapping 257. ≠ `Weapon.type` du moteur (`src/engine/types.ts`,
     *  `'melee' | 'ranged'`, persisté) et ≠ `ItemInstance.kind` : le pont est `kindOf()`
     *  (`src/engine/items.ts`), une TRADUCTION. `vehicle` n'a aucun porteur et n'est plus admis. */
    categorie: trappingCategorieSchema,
    subType: z.union([z.string(), z.null()]),
    weaponGroup: z.string().optional(),
    soloSimple: z.boolean().optional(),
    /** Cette entrée EST l'arme « Mains nues » du catalogue (`LDB 62 l.28`) : la SEULE marque lue par
     *  `isUnarmed`/`isUnarmedTrapping` (engine/items) pour écarter les poings des armes tenues,
     *  choisissables et invocables. */
    unarmed: z.literal(true).optional(),
    /** Cette entrée EST l'« Arme improvisée » du catalogue (`LDB 62 l.31`) — marque lue par
     *  `isImprovisedTrapping` (engine/items). ≠ `weaponDamage.isImprovised`, qui décrit une arme RÉDUITE
     *  à cet état par l'usure (`LDB 62 l.135`). */
    improvised: z.literal(true).optional(),
    indirect: z.boolean().optional(),
    /** LDB 62 l.278 — approximation MAISON (le RAW ne liste pas les armes à lame), éditable. */
    bladed: z.boolean().optional(),
    /** LDB 47 — approximation MAISON (matière du projectile, non tabulée par le RAW), éditable. */
    organicProjectile: z.boolean().optional(),
    /** Effets « à la touche » en DONNÉE (`TriggeredEffect[]`) — Canon à flammes nain (ADE II 8 l.243). */
    onHitEffects: z.array(triggeredEffectSchema).optional(),
    /** PORTÉE MINIMALE de tir (bande) — machines de siège à distance (ADE II 8 l.251/253). */
    minRangeBand: z.enum(['bout-portant', 'courte', 'moyenne', 'longue', 'extreme']).optional(),
    siegeRig: z.string().optional(),
    siegeFootprint: z.number().optional(),
    /** Munition REPRÉSENTATIVE d'une arme de siège (`id` de trapping `categorie:'ammunition'`) — discrimine
     *  pierrier/canon/baliste/mortier là où `subType`='armes-de-siege' seul ne le fait pas (hint joueur,
     *  `ammoFamilyLabel`). */
    defaultAmmo: z.string().optional(),
    shape: z.string().optional(),
    formChoices: z.array(z.string()).optional(),
    requiresMastery: z.boolean().optional(),
    /** Paliers d'entraînement d'une PROTHÈSE (LDB 73 l.19/23), dans l'ordre d'achat — cf.
     *  `TrappingData.prosthesisTraining` : `reduces` = tranche de pénalité rachetée, `grants` = aspect
     *  entièrement levé, `label` = libellé joueur du palier (éditable, aucun texte en dur à l'écran). */
    prosthesisTraining: z
      .array(z.strictObject({ px: z.number(), label: z.string(), reduces: z.number().optional(), grants: z.enum(['movement', 'all']).optional() }))
      .optional(),
    /** Absent (pas seulement `null`) sur 5 entrées — reflet du contenu réel. */
    enc: z.union([z.number(), z.literal('ND'), z.literal('Variable'), z.null()]).optional(),
    /** Taille PRÉVUE (ADE II 2 l.706-710) — version « taille ogre » d'une possession ordinaire. */
    sizeFor: sizeCategorySchema.optional(),
    /** Vocabulaire FERMÉ, validé au CHARGEMENT (fail-fast). Deux formes, telles que le livre les
     *  imprime — mesure sur tout le corpus FR : `\bND\b` y a EXACTEMENT 4 occurrences, toutes en
     *  cellule de tableau, sans aucune légende ni définition (LDB 62 l.28 Prix, l.31 Prix + Disponibilité,
     *  LDB 68 l.11 Prix + Disponibilité, LDB 69 l.9 Enc).
     *  - une des 4 classes (LDB 59 l.15 : « Toutes les Possessions possèdent une Disponibilité :
     *    Commune, Limitée, Rare ou Exotique. ») ;
     *  - `'ND'` — la MARQUE imprimée par le livre (LDB 62 l.31, LDB 68 l.11). Son sigle n'est développé
     *    nulle part dans le corpus FR : son sigle porte sur le COMPORTEMENT seul (champ `maison`), jamais sur
     *    le sens du mot — hors du commerce ordinaire (`isTradable`, engine/disponibilite) ;
     *  - `null` — le livre n'imprime AUCUNE valeur : tiret en Disponibilité (LDB 62 l.28, Mains nues) ou
     *    entrée hors table d'équipement (malepierre LDB 44 l.113-119, sel sacré MDG 10 l.112). */
    availability: z.union([availabilitySchema, z.literal('ND'), z.null()]),
    /** `reach`/`loc`/`pa`/`damage` : portés par les armes/armures — ABSENTS (pas seulement `null`) sur
     *  les consommables/potions sans profil d'arme (`optional()` en plus de `null`, contenu réel). */
    reach: z.union([reachSchema, z.null()]).optional(),
    range: z.union([weaponRangeSpecSchema, z.null()]).optional(),
    ammoRangeMod: z.union([ammoRangeModSchema, z.null()]).optional(),
    loc: z.union([z.string(), z.null()]).optional(),
    pa: z.union([z.number(), z.null()]).optional(),
    damage: z.union([weaponDamageSpecSchema, z.null()]).optional(),
    qualities: z.array(qualityRefSchema),
    consumable: flowSchema.optional(),
    consumableDuration: consumableDurationSchema.optional(),
    container: z.strictObject({ capacity: z.number() }).optional(),
    /** NI d'énergie magique qu'UN GRAMME de cet objet apporte à un Test d'Incantation/Focalisation en
     *  malepierre (`VDM 02 l.165` : « 1 gramme de malepierre équivaut à 20 NI »). Éditable — jamais une
     *  constante de code. Absent = objet non consommable comme réserve de NI. */
    niPerGram: z.number().optional(),
    /** Taux de consommation de la réserve de NI par point de DR bonus accordé (`VDM 02 l.163-165` ne
     *  fixe aucune formule de consommation) — arbitrage documenté par l'entrée elle-même (`maison`
     *  ci-dessous). Éditable. Absent = 1 (défaut). */
    niConsumedPerDR: z.number().optional(),
    /** Vocabulaire FERMÉ, validé au CHARGEMENT (fail-fast). Trois formes, telles que le livre les
     *  imprime en colonne « Prix »/« Coût » — MÊME traitement que `enc`, qui porte déjà ses marques :
     *  - un montant chiffré (`moneySchema`) ;
     *  - `'ND'` — la MARQUE imprimée par le livre (LDB 62 l.28 Mains nues, l.31 Arme improvisée,
     *    LDB 68 l.11 Licence de Guilde). Son sigle n'est développé nulle part dans le corpus FR :
     *    aucune expansion n'est déclarée ici. COMPORTEMENT seul — zéro sou au calcul monétaire
     *    (`priceToMoney`, engine/money), marque rendue telle quelle au Compendium ;
     *  - `null` — le livre n'imprime AUCUNE valeur : entrée hors table d'équipement (malepierre
     *    LDB 44 l.113-119, sel sacré MDG 10 l.112, carte marine MDG 15 l.290). */
    price: z.union([moneySchema, z.literal('ND'), z.null()]),
    derivedWeapon: weaponSchema.optional(),
    capabilities: itemCapabilitiesSchema.optional(),
    passive: z.array(gameOpSchema).optional(),
    /** Tarif de SERVICE (LDB 66 l.12-14 : chambre/écurie) — pas un objet possédable, cf. `TrappingData.service`. */
    service: z.boolean().optional(),
  },
  {
    hands: { label: 'Mains requises', hint: '1 ou 2 mains pour manier l’objet' },
    packSize: { label: 'Taille du lot', hint: 'Nombre d’unités vendues ensemble (munitions groupées)' },
    categorie: {
      label: 'Catégorie',
      hint: 'Catégorie de catalogue : arme de mêlée, arme à distance, munition, armure ou possession',
    },
    subType: { label: 'Sous-type', hint: 'Sous-catégorie au sein de la catégorie' },
    weaponGroup: {
      label: 'Groupe d’armes',
      hint: 'Groupe d’armes régissant cette arme (Qualités communes, Spécialisation de Groupe)',
    },
    soloSimple: {
      label: 'Simple en solo',
      hint: 'Arme d’équipage relativement simple : tirée seule, elle perd le bénéfice des Atouts',
    },
    unarmed: {
      label: 'Est « Mains nues »',
      hint: 'Marque l’entrée « Mains nues » du catalogue — seule lue pour écarter les poings des armes tenues',
    },
    improvised: { label: 'Est l’arme improvisée', hint: 'Marque l’entrée « Arme improvisée » du catalogue' },
    indirect: { label: 'Tir indirect', hint: 'Tir en arc (mortier/catapulte) : vise une case, jamais une cible directe' },
    bladed: {
      label: 'Porte une lame (maison)',
      hint: 'Approximation maison : l’arme a une lame (condition de la Qualité Piège-lame)',
    },
    organicProjectile: {
      label: 'Projectile organique (maison)',
      hint: 'Approximation maison : le projectile est organique (arrêté par le Bouclier anti-flèches)',
    },
    onHitEffects: { label: 'Effets à la touche', hint: 'Effets déclenchés au moment où l’arme touche sa cible' },
    minRangeBand: {
      label: 'Portée minimale de tir',
      hint: 'Bande sous laquelle l’arme de siège ne peut pas tirer (pas de Bout portant)',
    },
    siegeRig: { label: 'Rig de siège', hint: 'Silhouette utilisée pour le rendu visuel de l’engin de siège' },
    siegeFootprint: {
      label: 'Empreinte au sol',
      hint: 'Taille occupée sur la grille par l’engin de siège une fois posé en combat',
    },
    defaultAmmo: {
      label: 'Munition représentative',
      hint: 'Munition affichée par défaut pour cette arme de siège (indication au joueur)',
    },
    shape: { label: 'Forme du rig', hint: 'Forme du rig utilisée pour l’apparence' },
    formChoices: {
      label: 'Formes proposées',
      hint: 'Formes visuelles alternatives que le joueur peut choisir pour cet objet',
    },
    requiresMastery: {
      label: 'Maîtrise requise',
      hint: 'Arme inhabituelle : sans maîtrise acquise, le Test se fait sur la Caractéristique brute',
    },
    prosthesisTraining: {
      label: 'Paliers d’entraînement (prothèse)',
      hint: 'Paliers d’achat qui réduisent ou lèvent la pénalité de la prothèse, dans l’ordre',
    },
    enc: { label: 'Encombrement' },
    sizeFor: {
      label: 'Taille prévue',
      hint: 'Version grande taille d’une possession ordinaire (ex. équipement pour Ogre)',
    },
    availability: { label: 'Disponibilité' },
    reach: { label: 'Allonge', hint: 'Porté par les armes de mêlée ; absent des objets sans profil d’arme' },
    range: { label: 'Portée', hint: 'Mètres fixes, ou Bonus de Force × multiplicateur (armes de jet)' },
    ammoRangeMod: {
      label: 'Modificateur de portée (munition)',
      hint: 'Fraction, ou mètres ajoutés ou retranchés à la Portée de l’arme',
    },
    loc: { label: 'Localisation protégée', hint: 'Zone du corps couverte par l’armure' },
    pa: { label: 'Points d’armure' },
    damage: { label: 'Dégâts' },
    qualities: { label: 'Qualités' },
    consumable: { label: 'Effets à la consommation', hint: 'Effets déclenchés à l’usage de l’objet (potion, remède…)' },
    consumableDuration: {
      label: 'Durée de l’effet consommé',
      hint: 'Durée (minutes/heures/jours) de l’effet une fois l’objet consommé',
    },
    container: { label: 'Capacité de contenant', hint: 'Quantité que l’objet peut ranger' },
    niPerGram: {
      label: 'NI par gramme',
      hint: 'Niveau d’Incantation qu’un gramme de la matière apporte à un Test d’Incantation/Focalisation (malepierre)',
    },
    niConsumedPerDR: { label: 'NI consommé par DR', hint: 'Réserve de NI consommée par point de DR bonus accordé' },
    price: {
      label: 'Prix',
      hint: 'Montant en or / argent / cuivre ; « ND » = hors du commerce ordinaire ; vide = le livre n’imprime rien',
    },
    derivedWeapon: {
      label: 'Arme dérivée',
      hint: 'Profil d’arme d’une prothèse-arme (le membre EST considéré comme telle arme)',
    },
    capabilities: { label: 'Capacités mécaniques (liste fermée)' },
    passive: { label: 'Effets passifs' },
    service: {
      label: 'Objet-service',
      hint: 'Marque un tarif de service (chambre, écurie…), pas un objet possédable',
    },
  },
  {
    codex: { keys: ['trappings', 'siegeEngines'] },
    edit: { dataset: 'trappings' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
