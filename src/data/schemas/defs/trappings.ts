import { libelleDeValeur, metaDesChamps, nommerChamps, nommerNoeud } from '../grammaire/meta';
import { tableTotale } from '../../../lib/tableTotale';
/**
 * Schéma de `trappings.json` — vocabulaire UNIFIÉ des objets (armes/armures/munitions/possessions/
 * consommables/véhicules-marqueur). Dérivé de l'interface `TrappingData` EXISTANTE
 * (`src/data/index.ts`, + `QualityRef`/`ItemCapabilities`/`Weapon`/`WeaponDamageSpec`/
 * `WeaponRangeSpec`/`AmmoRangeMod`/`ConsumableDuration`/`Formula`/`Flow`/`EffectOp` co-localisées dans
 * engine) et d'un inventaire EXHAUSTIF par script (histogramme de TOUTES les entrées du dataset).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import {
  ammoRangeModSchema,
  availabilitySchema,
  consumableDurationSchema,
  contenantSchema,
  entrainementDeProtheseSchema,
  enumNomme,
  itemCapabilitiesSchema,
  moneySchema,
  reachSchema,
  sizeCategorySchema,
  weaponDamageSpecSchema,
  weaponRangeSpecSchema,
} from '../grammaire/valeurs';
import { RANGEES_DE_REGLE } from '../../../engine/ruleRefs';
import { flowSchema, passifsDe, triggeredEffectSchema } from '../grammaire/mecanique';
import { manieAussiSchema, perteSansEquipeSchema, qualiteDObjetRefSchema, weaponSchema, type QualiteDObjetRef } from '../grammaire/reference';
import { idDe, porteLeMarqueur, ref, refs, refusDeLEntree } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR, RACINE_D_APPARENCE } from '../grammaire/sousListes';


export const file = 'trappings.json';
export const famille = 'entite';
export const VARIANT_RESOLVED_FIELDS = ['source', 'alsoIn', 'descRef', 'qualities', 'availability', 'damage', 'price', 'manieAussi', 'qualitesAuChoix'] as const;

export const apparenceDObjetSchema = nommerChamps(z.looseObject({
  shape: ref('apparence', undefined, RACINE_D_APPARENCE).optional(),
  formChoices: refs('apparence', { sousListe: RACINE_D_APPARENCE }).optional(),
}), {
  shape: { label: 'Forme racine', hint: 'Forme par défaut de l’objet, fixée sur l’instance à sa naissance' },
  formChoices: { label: 'Formes proposées', hint: 'Formes racines parmi lesquelles l’apparence de l’objet peut être choisie' },
});

/** Une armure porte son TYPE d'armure : `subType` désigne une entrée de la sous-liste `armour` des Groupes
 *  (`weaponGroups.json?kind=armour`). Matière que le dessin et les exemptions de matériau
 *  (`matiereDuGroupe`, `src/data/index.ts`) lisent. Jugé par le refus de la sous-liste
 *  (`refusDeLEntree`, celui de `idDe('weaponGroup', 'armour')`) : une feuille `idDe` exécutée hors de l'arbre
 *  du schéma échappe à la marche du parse de mesure (`grammaire/parse-de-mesure.test.ts`, COUVERTURE). */
const refusDuTypeDArmure = (subType: { id: string } | null): string | null =>
  subType === null ? 'aucun type d’armure' : refusDeLEntree('weaponGroup', 'armour', subType);

export const categorieDArmeSchema = enumNomme({
  melee: 'Armes de mêlée',
  distance: 'Armes à distance',
});

/** CATÉGORIE de catalogue d'une possession — id de logique qui ne s'affiche jamais nu. */
export const trappingCategorieSchema = enumNomme({
  ...tableTotale(categorieDArmeSchema.options, (id) => libelleDeValeur(categorieDArmeSchema, id)),
  ammunition: 'Munitions',
  armor: 'Armures',
  trapping: 'Équipement',
});

type Categorie = z.infer<typeof trappingCategorieSchema>;

const chargeParDiscriminant = {
  melee: ['qualitesAuChoix'],
  distance: ['qualitesAuChoix'],
  ammunition: [],
  armor: [],
  trapping: [],
} as const satisfies Record<Categorie, readonly string[]>;

export const estGroupeDeSiege = porteLeMarqueur('weaponGroup', 'siege');

export const profilDArmeDeCatalogueSchema = nommerChamps(z.strictObject({
  hands: z.union([z.literal(1), z.literal(2)]).optional(),
  weaponGroup: ref('weaponGroup').optional(),
  /** #3771 */
  rendu: ref('rendu').optional(),
  /** AA 10 l.169-171. */
  indirect: z.boolean().optional(),
  /** ADE II 08 l.251-253. */
  minRangeBand: z.enum(RANGEES_DE_REGLE['portee-d-une-arme']).optional(),
  perteSansEquipe: perteSansEquipeSchema.optional(),
  onHitEffects: z.array(triggeredEffectSchema).optional(),
  /** AA 08 l.482, l.517 ; AA 10 l.150, l.198-221 ; MDG 12 l.410-424 ; ADE II 02 l.665 */
  munitions: refs('trapping', { sousListe: 'ammunition' }).optional(),
  reach: reachSchema.nullable().optional(),
  range: weaponRangeSpecSchema.nullable().optional(),
  damage: weaponDamageSpecSchema.nullable().optional(),
  qualities: z.array(qualiteDObjetRefSchema),
}), {
  hands: { label: 'Mains requises', hint: '1 ou 2 mains pour manier l’objet' },
  weaponGroup: {
    label: 'Groupe d’armes',
    hint: 'Groupe d’armes régissant cette arme (Qualités communes, Spécialisation de Groupe)',
  },
  rendu: { label: 'Rendu du coup', hint: 'Rendu visuel et sonore de l’arme à la place de celui de son Groupe' },
  indirect: { label: 'Tir indirect', hint: 'Tir en arc qui vise une case' },
  minRangeBand: { label: 'Portée minimale de tir', hint: 'Bande sous laquelle l’arme ne peut pas tirer' },
  perteSansEquipe: {
    label: 'Perte sans équipe',
    hint: 'Qualités que l’arme perd quand son tireur n’a ni servant ni allié adjacent',
  },
  onHitEffects: { label: 'Effets à la touche', hint: 'Effets déclenchés au moment où l’arme touche sa cible' },
  munitions: {
    label: 'Munitions',
    hint: 'Seules munitions que charge cette arme, la représentative en tête ; vide : celles de sa famille qu’aucune arme ne nomme',
  },
  reach: { label: 'Allonge', hint: 'Porté par les armes de mêlée ; absent des objets sans profil d’arme' },
  range: { label: 'Portée', hint: 'Mètres fixes, ou Bonus de Force × multiplicateur (armes de jet)' },
  damage: { label: 'Dégâts' },
  qualities: { label: 'Qualités' },
});

type QualitesDuProfil = {
  qualities: readonly QualiteDObjetRef[];
  qualitesAuChoix?: readonly string[];
};

type EntreeDePossessionAAffiner = QualitesDuProfil & {
  id: string;
  categorie: Categorie;
  subType: { id: string } | null;
  shape?: { id: string };
  variants?: readonly Partial<QualitesDuProfil>[];
};

function affinerLesQualites(
  { id, categorie }: EntreeDePossessionAAffiner,
  { qualities, qualitesAuChoix }: QualitesDuProfil,
  ctx: z.RefinementCtx,
  chemin: (string | number)[] = [],
): void {
  if (categorie !== 'ammunition') {
    qualities.forEach((q, i) => {
      if ('majoration' in q) ctx.addIssue({ code: 'custom', path: [...chemin, 'qualities', i, 'majoration'], message: `${id} : seule une munition majore une qualité de l'arme (« +${q.majoration} »)` });
    });
  }
  if (qualitesAuChoix === undefined) return;
  const cheminDuChoix = [...chemin, 'qualitesAuChoix'];
  const charge: readonly string[] = chargeParDiscriminant[categorie];
  if (chemin.length && !charge.includes('qualitesAuChoix')) {
    ctx.addIssue({ code: 'custom', path: cheminDuChoix, message: `${id} : seuls les profils d'arme portent des Atouts au choix` });
  }
  const imprimees = new Set<string>(qualities.map((q) => q.id));
  const vues = new Set<string>();
  for (const [i, choix] of qualitesAuChoix.entries()) {
    if (!imprimees.has(choix)) {
      ctx.addIssue({ code: 'custom', path: [...cheminDuChoix, i], message: `${id} : l’Atout au choix « ${choix} » doit figurer parmi les Qualités de ce profil` });
    }
    if (vues.has(choix)) {
      ctx.addIssue({ code: 'custom', path: [...cheminDuChoix, i], message: `${id} : l’Atout au choix « ${choix} » est répété` });
    }
    vues.add(choix);
  }
}

const doc = document(
  'trappings',
  famille,
  {
    ...profilDArmeDeCatalogueSchema.shape,
    /** AA 08 l.67-77 */
    qualitesAuChoix: z.array(idDe('quality')).min(2).optional(),
    packSize: z.number().optional(),
    /** CATÉGORIE de catalogue — vocabulaire FERMÉ de `trappingCategorieSchema`, obligatoire sur toute
     *  entrée. ≠ `Weapon.type` du moteur (`src/engine/types.ts`, `'melee' | 'distance'`, persisté) et
     *  ≠ `ItemInstance.kind` : le pont est `kindOf()` (`src/engine/items.ts`), une TRADUCTION. */
    categorie: trappingCategorieSchema,
    subType: ref('weaponGroup').nullable(),
    /** ZI 13 l.193 */
    bouclierDEquipe: ref('trapping').optional(),
    /** LDB 62 l.28 */
    unarmed: z.literal(true).optional(),
    /** LDB 62 l.31 ; LDB 62 l.135 */
    improvised: z.literal(true).optional(),
    /** LDB 62 l.33-35 ; AA 08 l.156 ; ZI 13 l.911 ; AA 08 l.290 ; ADE II 02 l.613 */
    shield: z.literal(true).optional(),
    /** LDB 62 l.278 */
    bladed: z.boolean().optional(),
    /** LDB 47 */
    organicProjectile: z.boolean().optional(),
    /** The Horned Rat Companion 03 l.23-31 ; #4202 */
    effects: z.array(triggeredEffectSchema).optional(),
    /** ZI 13 l.199 */
    passifDArme: passifsDe().optional(),
    ...apparenceDObjetSchema.shape,
    /** #3086 D6(c), #3116 */
    rangement: ref('gardeRobe', undefined, 'emplacement').optional(),
    requiresMastery: z.boolean().optional(),
    /** AA 08 l.188 ; AA 08 l.190 ; AA 08 l.314 ; AA 08 l.343 */
    manieAussi: manieAussiSchema.optional(),
    /** LDB 73 l.19/23 */
    prosthesisTraining: z.array(entrainementDeProtheseSchema).optional(),
    /** LDB 61 l.5 */
    enc: z.union([z.number(), z.literal('ND'), z.literal('Variable')]).nullable().optional(),
    /** ADE II 2 l.706-710 */
    sizeFor: sizeCategorySchema.optional(),
    /** Arbitrage #4110 (2026-11-16) */
    reserveeA: ref('groupe', undefined, DECLARABLE_PAR_UN_PORTEUR).optional(),
    /** LDB 62 l.28 ; LDB 68 l.11 ; LDB 69 l.9 ; LDB 59 l.15 ; LDB 62 l.31 ; LDB 44 l.113-119 ; MDG 10 l.112 */
    availability: z.union([availabilitySchema, z.literal('ND')]).nullable(),
    ammoRangeMod: ammoRangeModSchema.nullable().optional(),
    loc: z.string().nullable().optional(),
    pa: z.number().nullable().optional(),
    consumable: flowSchema.optional(),
    consumableDuration: consumableDurationSchema.optional(),
    container: contenantSchema.optional(),
    /** VDM 02 l.165 */
    niPerGram: z.number().optional(),
    /** VDM 02 l.163-165 */
    niConsumedPerDR: z.number().optional(),
    /** LDB 62 l.28 ; LDB 68 l.11 ; LDB 44 l.113-119 ; MDG 10 l.112 ; MDG 15 l.290 */
    price: z.union([moneySchema, nommerNoeud(z.literal('ND'), { label: 'non disponible' })]).nullable(),
    derivedWeapon: weaponSchema.optional(),
    capabilities: itemCapabilitiesSchema.optional(),
    passive: passifsDe().optional(),
    /** LDB 66 l.12-14 */
    service: z.boolean().optional(),
  },
  {
    ...metaDesChamps(profilDArmeDeCatalogueSchema, { exigees: true }),
    qualitesAuChoix: { label: 'Atouts au choix', hint: 'Qualités du profil qui s’excluent. La première s’applique en l’absence de choix.' },
    rangement: { label: 'Rangement', hint: 'Emplacement du corps où l’objet porté se range hors des mains' },
    packSize: { label: 'Taille du lot', hint: 'Nombre d’unités vendues ensemble (munitions groupées)' },
    categorie: {
      label: 'Catégorie',
      hint: 'Catégorie de catalogue : arme de mêlée, arme à distance, munition, armure ou possession',
    },
    subType: { label: 'Sous-type', hint: 'Sous-catégorie au sein de la catégorie' },
    bouclierDEquipe: {
      label: 'Bouclier d’équipe',
      hint: 'Bouclier que tient l’allié au contact du tireur : Protectrice de ce bouclier aux deux, ni Course ni Fuite',
    },
    unarmed: {
      label: 'Est « Mains nues »',
      hint: 'Marque l’entrée « Mains nues » du catalogue — seule lue pour écarter les poings des armes tenues',
    },
    improvised: { label: 'Est l’arme improvisée', hint: 'Marque l’entrée « Arme improvisée » du catalogue' },
    shield: { label: 'Est un bouclier', hint: 'Marque une entrée de bouclier du catalogue — seule lue pour reconnaître un bouclier' },
    bladed: {
      label: 'Porte une lame (maison)',
      hint: 'Approximation maison : l’arme a une lame (condition de la Qualité Piège-lame)',
    },
    organicProjectile: {
      label: 'Projectile organique (maison)',
      hint: 'Approximation maison : le projectile est organique (arrêté par le Bouclier anti-flèches)',
    },
    effects: { label: 'Effets déclenchés', hint: 'Effets déclenchés tant que l’objet est porté ou tenu' },
    passifDArme: { label: 'Effets passifs de l’arme', hint: 'Effets continus de l’arme elle-même lors de ses attaques, distincts de ceux du porteur' },
    ...metaDesChamps(apparenceDObjetSchema, { exigees: true }),
    requiresMastery: {
      label: 'Maîtrise requise',
      hint: 'Arme inhabituelle : sans maîtrise acquise, le Test se fait sur la Caractéristique brute',
    },
    manieAussi: {
      label: 'Aussi maniée en',
      hint: 'Par Groupe de Corps à corps qui manie aussi l’arme : ses Atouts et Défauts, ses mains, à pied seulement',
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
    reserveeA: { label: 'Réservée à', hint: 'Groupe seul à qui une arme au choix de carrière l’offre' },
    availability: { label: 'Disponibilité' },
    ammoRangeMod: {
      label: 'Modificateur de portée (munition)',
      hint: 'Fraction, ou mètres ajoutés ou retranchés à la Portée de l’arme',
    },
    loc: { label: 'Localisation protégée', hint: 'Zone du corps couverte par l’armure' },
    pa: { label: 'Points d’armure' },
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
    codex: { keys: ['trappings'] },
    edit: { dataset: 'trappings' },
  },
  // `categorie` : univers des sources `weaponsMelee`/`weaponsRanged` (`grammaire/sourcesDeSpecs.ts`).
  // `service` : marqueur de la sous-liste `INSTANCIABLE_PAR_ID` (`grammaire/sousListes.ts`).
  {
    exiges: ['source'],
    variantes: VARIANT_RESOLVED_FIELDS,
    espace: {
      discriminant: ['categorie', 'subType'],
      champDeCharge: 'categorie',
      chargeParDiscriminant,
      requisesParDiscriminant: { melee: [], distance: [] },
      marqueurs: ['service'],
    },
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as EntreeDePossessionAAffiner;
        if (e.subType && estGroupeDeSiege(e.subType.id)) {
          ctx.addIssue({ code: 'custom', path: ['subType', 'id'], message: `${e.id} : un engin de siège a son propre catalogue` });
        }
        affinerLesQualites(e, e, ctx);
        e.variants?.forEach((variante, i) => affinerLesQualites(e, {
          qualities: variante.qualities ?? e.qualities,
          qualitesAuChoix: variante.qualitesAuChoix ?? e.qualitesAuChoix,
        }, ctx, ['variants', i]));
        if (e.categorie !== 'armor') return;
        const refus = refusDuTypeDArmure(e.subType);
        if (refus !== null) ctx.addIssue({ code: 'custom', path: ['subType'], message: `${e.id} : une armure porte un type d'armure — ${refus}` });
        // Le TYPE est la matière ; la SILHOUETTE est sa forme, racine du catalogue des apparences (#2948).
        if (e.shape === undefined) ctx.addIssue({ code: 'custom', path: ['shape'], message: `${e.id} : une armure porte sa forme (\`shape\`, racine de apparences.json)` });
      }),
  },
);

export const schema = doc.schema;
/** L'entrée scellée d'une possession, également composée par les objets du narratif. */
export const entree = doc.entree;
export const meta = doc.meta;

export const exposition = doc.exposition;
export const cles = doc.cles;
