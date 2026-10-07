import { nommerChamps } from '../grammaire/meta';
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

/** ZI */
const weaponDamageSpecSchema = z.union([
  nommerChamps(z.strictObject({ literal: z.string() }), { literal: { label: 'Valeur littérale' } }),
  nommerChamps(z.strictObject({ plusBF: z.boolean(), flat: z.number(), bare: z.literal(true).optional() }), {
    plusBF: { label: 'Ajouter le Bonus de Force' },
    flat: { label: 'Valeur fixe' },
    bare: { label: 'Mains nues' },
  }),
]);

/** `WeaponRangeSpec` : mètres fixes, ou Bonus de Force × bf (armes de jet). */
const weaponRangeSpecSchema = z.union([z.number(), nommerChamps(z.strictObject({ bf: z.number() }), { bf: { label: 'Bonus de Force' } })]);

/** `AmmoRangeMod` : fraction de la Portée de l'arme, ou ± mètres. */
const ammoRangeModSchema = z.union([nommerChamps(z.strictObject({ mult: z.number() }), { mult: { label: 'Multiplicateur' } }), nommerChamps(z.strictObject({ add: z.number() }), { add: { label: 'Ajout' } })]);

/** `ItemCapabilities` (`src/data/index.ts`) — sac de drapeaux IRRÉDUCTIBLES, tous optionnels. */
const itemCapabilitiesSchema = nommerChamps(z.strictObject({
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
});

/** LDB 73 */
const weaponSchema = nommerChamps(z.strictObject({
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
  /** LDB 62 l.278 */
  bladed: z.boolean().optional(),
  /** LDB 47 */
  organicProjectile: z.boolean().optional(),
  hands: z.union([z.literal(1), z.literal(2)]).optional(),
}), {
  label: { label: 'Libellé' },
  type: { label: 'Type' },
  damage: { label: 'Dégâts' },
  reach: { label: 'Allonge' },
  range: { label: 'Portée' },
  qualities: { label: 'Qualités' },
  subType: { label: 'Sous-type' },
  weaponGroup: { label: 'Groupe d’armes' },
  soloSimple: { label: 'Simple à manier seul' },
  indirect: { label: 'Tir indirect' },
  bladed: { label: 'Arme à lame' },
  organicProjectile: { label: 'Projectile organique' },
  hands: { label: 'Mains' },
});

/** `ConsumableDuration` (`src/engine/consumables.ts`) — UNE durée par objet (minutes/heures/jours). */
const consumableDurationSchema = nommerChamps(z.strictObject({
  minutes: formulaSchema.optional(),
  hours: formulaSchema.optional(),
  days: formulaSchema.optional(),
}), { minutes: { label: 'Minutes' }, hours: { label: 'Heures' }, days: { label: 'Jours' } });

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
    /** LDB 62 l.28 */
    unarmed: z.literal(true).optional(),
    /** LDB 62 l.31 ; LDB 62 l.135 */
    improvised: z.literal(true).optional(),
    /** LDB 62 l.33-35 ; AA 08 l.156 ; ZI 13 l.911 ; AA 08 l.290 ; ADE II 02 l.613 */
    shield: z.literal(true).optional(),
    indirect: z.boolean().optional(),
    /** LDB 62 l.278 */
    bladed: z.boolean().optional(),
    /** LDB 47 */
    organicProjectile: z.boolean().optional(),
    /** ADE II 8 l.243 */
    onHitEffects: z.array(triggeredEffectSchema).optional(),
    /** ADE II 8 l.251/253 */
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
    /** LDB 73 l.19/23 */
    prosthesisTraining: z
      .array(nommerChamps(z.strictObject({ px: z.number(), label: z.string(), reduces: z.number().optional(), grants: z.enum(['movement', 'all']).optional() }), {
        px: { label: 'Points d’Expérience' },
        label: { label: 'Libellé' },
        reduces: { label: 'Réductions' },
        grants: { label: 'Accorde' },
      }))
      .optional(),
    /** Absent (pas seulement `null`) sur 5 entrées — reflet du contenu réel. */
    enc: z.union([z.number(), z.literal('ND'), z.literal('Variable'), z.null()]).optional(),
    /** ADE II 2 l.706-710 */
    sizeFor: sizeCategorySchema.optional(),
    /** LDB 62 l.28 ; LDB 68 l.11 ; LDB 69 l.9 ; LDB 59 l.15 ; LDB 62 l.31 ; LDB 44 l.113-119 ; MDG 10 l.112 */
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
    container: nommerChamps(z.strictObject({ capacity: z.number() }), { capacity: { label: 'Capacité' } }).optional(),
    /** VDM 02 l.165 */
    niPerGram: z.number().optional(),
    /** VDM 02 l.163-165 */
    niConsumedPerDR: z.number().optional(),
    /** LDB 62 l.28 ; LDB 68 l.11 ; LDB 44 l.113-119 ; MDG 10 l.112 ; MDG 15 l.290 */
    price: z.union([moneySchema, z.literal('ND'), z.null()]),
    derivedWeapon: weaponSchema.optional(),
    capabilities: itemCapabilitiesSchema.optional(),
    passive: z.array(gameOpSchema).optional(),
    /** LDB 66 l.12-14 */
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
    shield: { label: 'Est un bouclier', hint: 'Marque une entrée de bouclier du catalogue — seule lue pour reconnaître un bouclier' },
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
    siegeRig: { label: 'Silhouette de siège', hint: 'Silhouette de l’engin de siège affichée en jeu' },
    siegeFootprint: {
      label: 'Empreinte au sol',
      hint: 'Taille occupée sur la grille par l’engin de siège une fois posé en combat',
    },
    defaultAmmo: {
      label: 'Munition représentative',
      hint: 'Munition affichée par défaut pour cette arme de siège (indication au joueur)',
    },
    shape: { label: 'Forme à l’écran', hint: 'Forme sous laquelle l’objet s’affiche dans l’apparence de son porteur', renduPur: true },
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
  // `categorie` : univers des sources `weaponsMelee`/`weaponsRanged` (`grammaire/sourcesDeSpecs.ts`).
  // `service` : marqueur de la sous-liste `INSTANCIABLE_PAR_ID` (`grammaire/sousListes.ts`).
  { exiges: ['source'], espace: { discriminant: 'categorie', marqueurs: ['service'] } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
