/** Types partagés du moteur de règles WFRP v4. */
import { t } from '../i18n';
import type { PlayerText } from '../i18n/playerText';
import type { Duration } from './duration';
import type { Money } from './money';
import type { ReachId } from './items';
import type { CodexTarget, ModProvenance } from './ruleRefs';
import type { WallSide as WallSideCanon } from '../data/schemas/defs-scenes/communs';

/** Libellés d'AFFICHAGE de l'axe d'Allonge, PAR id d'axe (`ReachId`, `engine/items.ts` — LDB 62
 *  l.156-164). Toute LOGIQUE d'Allonge passe par `reachIdOf`/`reachRankOf`, jamais par ce libellé. */
export const REACH_LABELS = {
  personnelle: 'Personnelle',
  'tres-courte': 'Très courte',
  courte: 'Courte',
  moyenne: 'Moyenne',
  longue: 'Longue',
  'tres-longue': 'Très longue',
  considerable: 'Considérable',
} as const satisfies Record<ReachId, string>;

/** Allonge de l'Arme improvisée (LDB 62 l.31) : HORS de l'échelle des sept longueurs (l.156-164),
 *  donc sans rang — aucune comparaison de longueur ne peut s'y conclure. */
export const REACH_VARIABLE = 'Variable';

/** Vocabulaire FERMÉ de l'Allonge de mêlée en donnée : un libellé de l'axe, ou « Variable ». */
export type ReachValue = (typeof REACH_LABELS)[ReachId] | typeof REACH_VARIABLE;

/** Les 10 Caractéristiques. id STABLE = slug plein (convention du repo — #311, `CC`/`CT`/… était
 *  l'exception qui invitait l'imitation) : l'affichage (abréviation/libellé) vient de
 *  `characteristics.json`/`CHAR_LABELS`, jamais du littéral de la clé — une clé ne se rend JAMAIS
 *  telle quelle à l'écran. */
export type CharKey =
  | 'capacite-de-combat'
  | 'capacite-de-tir'
  | 'force'
  | 'endurance'
  | 'initiative'
  | 'agilite'
  | 'dexterite'
  | 'intelligence'
  | 'force-mentale'
  | 'sociabilite';

export const CHAR_KEYS: CharKey[] = [
  'capacite-de-combat',
  'capacite-de-tir',
  'force',
  'endurance',
  'initiative',
  'agilite',
  'dexterite',
  'intelligence',
  'force-mentale',
  'sociabilite',
];

// Libellés FR dérivés du catalogue i18n (source unique des textes — plan évacué → #320).
export const CHAR_LABELS: Record<CharKey, string> = {
  'capacite-de-combat': t('char.capacite-de-combat'),
  'capacite-de-tir': t('char.capacite-de-tir'),
  force: t('char.force'),
  endurance: t('char.endurance'),
  initiative: t('char.initiative'),
  agilite: t('char.agilite'),
  dexterite: t('char.dexterite'),
  intelligence: t('char.intelligence'),
  'force-mentale': t('char.force-mentale'),
  sociabilite: t('char.sociabilite'),
};

export type Characteristics = Record<CharKey, number>;

/** Localisations d'impact (Tableau de Localisation, Livre de base p. 159). */
export type HitLocation = 'tete' | 'brasG' | 'brasD' | 'corps' | 'jambeG' | 'jambeD';

export const HIT_LOCATION_LABELS: Record<HitLocation, PlayerText> = {
  tete: t('hitloc.tete'),
  brasG: t('hitloc.brasG'),
  brasD: t('hitloc.brasD'),
  corps: t('hitloc.corps'),
  jambeG: t('hitloc.jambeG'),
  jambeD: t('hitloc.jambeD'),
};

/**
 * Forme du corps d'une créature, pour la LOCALISATION d'impact (LDB « Point d'Impact des Créatures »
 * p.312). Humanoïde/quadrupède/oiseau partagent le Tableau humanoïde (p.159) — seules les ÉTIQUETTES
 * changent (quadrupède : membres antérieurs/postérieurs ; oiseau : ailes) et les Tableaux de Critiques
 * sont les mêmes. Serpent & araignée utilisent les « Localisations Alternatives » (p.312).
 */
export type BodyShape = 'humanoide' | 'quadrupede' | 'oiseau' | 'serpent' | 'araignee' | 'vehicule' | 'structure' | 'engin' | 'army';

/** Côté d'arête de mur — DÉRIVÉ du canon `wallSideSchema` (`data/schemas/defs-scenes/communs.ts`),
 *  import de TYPE seul : le moteur PUR ne dépend ni de l'état ni d'un module zod à l'exécution
 *  (cf. `Combatant.structureEdge`). */
export type WallEdgeSide = WallSideCanon;

/** Étiquettes de localisation propres à une forme (surchargent HIT_LOCATION_LABELS ; LDB 76 l.17-29).
 *  `vehicule` (véhicule/embarcation à coque — EDOC 7, MoR ch.5, MDG 13) : ses localisations
 *  (coque/gréement/roues/avirons…) sont PILOTÉES PAR DONNÉES (table par véhicule) : aucune étiquette en
 *  dur ici, et aucun chemin de résolution ne lit encore ces tables (#673 volet localisations, bloqué
 *  par l'extraction #678). */
export const BODY_SHAPE_LOC_LABELS: Record<BodyShape, Partial<Record<HitLocation, PlayerText>>> = {
  humanoide: {},
  quadrupede: { brasG: t('hitloc.quadrupede.brasG'), brasD: t('hitloc.quadrupede.brasD'), jambeG: t('hitloc.quadrupede.jambeG'), jambeD: t('hitloc.quadrupede.jambeD') },
  oiseau: { brasG: t('hitloc.oiseau.brasG'), brasD: t('hitloc.oiseau.brasD'), jambeG: t('hitloc.oiseau.jambeG'), jambeD: t('hitloc.oiseau.jambeD') },
  serpent: {}, // n'expose que Tête / Corps
  araignee: { jambeD: t('hitloc.araignee.jambeD'), corps: t('hitloc.araignee.corps') }, // n'expose que Tête / Pattes / Abdomen
  vehicule: {}, // localisations data-driven (coque/gréement/…)
  structure: {}, // structure de siège (porte/mur/tour, ADE II 8) — pas de Tableau de Localisation propre
  engin: {}, // engin de siège (affût servi, AA 10 l.136-193) — INERTE, jamais de Localisation (isInanimate)
  army: {}, // armée abstraite (Combat de masse, ADE II 8) : porte-Puissance inerte (wounds), jamais rendue ni localisée
};

/** Étiquette FR d'une localisation pour une forme de corps (LDB 76 l.17-29). Forme inconnue/absente de
 *  la table → libellés humanoïdes (`HIT_LOCATION_LABELS`), comme `hitLocationByShape` retombe sur
 *  `humanoide` — les deux jumeaux tolèrent une forme hors table. Posée ICI (module FEUILLE) et
 *  ré-exportée par `combat.ts` : `trauma.ts` en a besoin, et `combat.ts` importe déjà `trauma.ts`. */
export function locationLabel(loc: HitLocation, shape: BodyShape = 'humanoide'): PlayerText {
  return BODY_SHAPE_LOC_LABELS[shape]?.[loc] ?? HIT_LOCATION_LABELS[loc];
}

/** Paliers de Disponibilité, dans l'ordre IMPRIMÉ par le tableau (LDB 59 « Disponibilité »). Tuple
 *  RUNTIME : les schémas zod le consomment tel quel (`availabilitySchema`, `src/data/schemas/grammaire/valeurs.ts`),
 *  donc la donnée et le type ne peuvent plus diverger d'un palier. L'ORDRE porte l'échelle de rareté
 *  (indice 0 = le plus courant) : le Troc (`LDB 59 l.66-76`) et la « Baisse des prix » (`l.60`) s'y
 *  indexent, l'artisanat y décale d'un cran (`craftEconomy`) — aucune échelle recopiée à côté. */
export const AVAILABILITIES = ['Commune', 'Limitée', 'Rare', 'Exotique'] as const;
/** Disponibilité d'un objet/équipement (LDB 59 « Disponibilité ») — FOYER UNIQUE du concept :
 *  Test de Disponibilité au marché (`disponibilite`), Difficulté d'Artisanat (`activities`),
 *  décalage par qualité (`craftEconomy`). `HarvestRarity` l'étend de `'Unique'` (récolte/trophées). */
export type Availability = (typeof AVAILABILITIES)[number];
/** Les Disponibilités qui se TESTENT au d100 (LDB 59 l.25-30) : Commune est toujours en stock,
 *  Exotique jamais — seules ces deux-là portent un %. Sous-ensemble NOMMÉ dérivé du canon : c'est le
 *  SEUL site qui nomme ce couple, et `unions-canon.test.ts` verrouille son égalité avec le schéma zod
 *  qui le sélectionne (`availabilitySchema.extract([…])`). */
export type TestedAvailability = Extract<Availability, 'Limitée' | 'Rare'>;
/** Les Disponibilités dont l'Évaluation ne rend qu'une FOURCHETTE (LDB 59 l.41) — 2ᵉ et dernier
 *  sous-ensemble MÉTIER du canon, nommé ICI comme le premier : `satisfies` le tuple, donc un palier
 *  renommé ou retiré ne compile plus. Consommé par `engine/appraisal`. */
export const APPRAISED_AVAILABILITIES = ['Rare', 'Exotique'] as const satisfies readonly Availability[];

/** Propulsion d'un véhicule/embarcation — pilote la table de localisation des dégâts (terre : roues/
 *  attelage ; fleuve/mer : voiles/avirons/coque). EDOC 7 (terrestre), MoR ch.5 (fluvial), MDG 13 (maritime). */
export type Propulsion = 'terrestre' | 'fluvial' | 'maritime';

/** Classe de voyage payant d'un véhicule : prix RAW en sous (PA) par km ET par passager (LDB 51 l.180-189). */
export interface VehicleTravelClass { id: string; label: string; brassPerKm: number; }

/**
 * Véhicule / embarcation à coque — FOYER UNIQUE de la donnée (`src/data/vehicles.json`), data-driven.
 * Le même enregistrement porte TROIS facettes indépendantes (fin des doublons transports/trappings) :
 *  - `purchase` : achat (prix + disponibilité), lu par le marché ;
 *  - `travel` : passage payant (Déplacement km/h + classes), lu par `engine/travel` ;
 *  - `hull` : profil type-créature (Endurance + Blessures + forme + propulsion), permettant au véhicule
 *    de devenir un `Combatant` qui encaisse des dégâts (incidents EDOC, Critiques MoR/MDG).
 * Une monture, elle, reste une CRÉATURE (`creatures.json` → `Combatant`) ; ce type ne couvre que les
 * coques inertes (chariots, barges, navires).
 */

/** Référence à un Trait/Amélioration naval du catalogue (`naval-traits.json`) par id STABLE (slug) — JAMAIS
 *  le libellé (principe : référencer par id, pas par nom). `value` = Indice d'un Trait `ranked` (« Renforcé 2 »
 *  → `{ id: 'renforce', value: 2 }`) ; absent = Indice 1. Le libellé verbatim reste dans le catalogue
 *  (résolu pour l'affichage via `findNavalTrait(id)?.label`). Même esprit que `TraitInstance`, registre distinct. */
export interface NavalTraitRef {
  id: string;
  value?: number;
}

export interface VehicleData {
  /** id STABLE (slug) — cible de `TravelMode`/réfs de scène. */
  id: string;
  type: 'vehicles';
  label: string;
  /** `IconId` du pictogramme d'affichage (registre `src/ui/icons/`, famille `travel/*`) — donnée, pas
   *  de ternaire par id en dur. Typé `string` (et non `IconId`) pour NE PAS coupler l'engine pur à
   *  l'UI (règle 3, `src/engine` reste sans dépendance ui) ; les valeurs sont des `IconId` valides
   *  (garde-fou : `src/ui/no-emoji-affordance.test.ts` + `Icon` throw sur id inconnu). */
  icon?: string;
  source?: { book: string; page: number };
  /** Encombrement de l'objet véhicule (LDB 61) — généralement `null` (on ne porte pas une diligence) ;
   *  un coracle se porte (`enc` chiffré). */
  enc?: number | null;
  /** Chargement (EDOC 07 l.233-243) : Points d'Enc que la section bagages contient — véhicules
   *  TERRESTRES uniquement (charrette 25, chariot 30, diligence 80). Capacité de porteur (`CargoCarrier`,
   *  engine/cargo.ts) ; champ parallèle à `ship.capacity` (Contenance navale), même concept. */
  chargement?: number;
  /** Description (LDB) — reprise sur l'`ItemInstance` à l'achat/possession. */
  desc?: string;
  /** Facette ACHAT (marché / possession de carrière). `availability` absent pour les navires (MDG ne
   *  donne pas de Disponibilité). */
  purchase?: { price: Money; availability?: string };
  /** Facette VOYAGE (passage payant, LDB 51 l.178-189). `movement` = Déplacement du véhicule (km/h).
   *  `medium` = milieu du TRAJET PAYÉ — INDÉPENDANT de `hull.propulsion` (un véhicule peut être
   *  bi-milieu : la Barge navigue le fleuve, LDB 51 l.185/197, tout en figurant à la table navale MDG 12
   *  avec `propulsion:'maritime'` — jamais l'un dérivé de l'autre) ; absent = terrestre implicite.
   *  `draft` = ATTELAGE (bêtes qui tirent, réf `montures.json`) — requis pour l'allure forcée EDOC 07
   *  l.229 (« pas de course ») ; `count` = nombre de bêtes (Tests de Résistance sur échec du conducteur). */
  travel?: { movement: number; medium?: Propulsion; draft?: { montureId: string; count: number }; classes: VehicleTravelClass[] };
  /** Facette COQUE (entité à PV). `char.endurance` = Endurance, `char.B` = Blessures. `bodyShape` = 'vehicule'.
   *  `rig` = gréement (avirons/voile/mixte) → colonne de Localisation des Dégâts (MDG 13).
   *  `locationTable`/`criticalTable` = réfs de tables data-driven (branchées aux dalles fluvial/maritime). */
  hull?: {
    char: { endurance: number; B: number };
    bodyShape: 'vehicule';
    propulsion: Propulsion;
    rig?: 'avirons' | 'voile' | 'mixte';
    traits?: { id: string; value?: number; arg?: string }[];
    locationTable?: string | null;
    criticalTable?: string | null;
  };
  /** Facette NAVIRE (profil naval MDG 12) : caractéristiques de navigation/équipage du vaisseau.
   *  `manoeuvre` = modificateur de DR (Man) ; `sail`/`oars` = Mouvement (M) + équipage minimum (É) ;
   *  `lengthM` = Taille (longueur, m) ; `capacity` = Contenance ; `traits` = Traits de construction (réfs par id). */
  ship?: {
    crew: number;
    manoeuvre: number;
    lengthM: number;
    /** EMPREINTE du navire sur la grille (côté N×N), AUTORÉE par navire (≈ sa longueur à l'échelle Mer : ~10 m → 1,
     *  ~20 m → 2, ~30 m → 3, ~40 m+ → 4). Posée sur `c.footprint` par `vehicleCombatant`. DÉCOUPLÉE de la Taille
     *  créature : un navire occupe ses cases (grille + rendu) sans être une créature (aucune Peur de Taille). */
    footprint?: number;
    capacity: number;
    sail?: { m: number; crew: number };
    oars?: { m: number; crew: number };
    traits: NavalTraitRef[];
  };
  /** Facette PONT (couche tactique, §1bis du modèle naval) : plan person-scale du pont, authoré une fois
   *  par TYPE et réutilisé dans tout scénario (jamais redessiné) ; `postes` est lu par `state/shipPostes.ts`. */
  deck?: ShipDeck;
}

/**
 * Structure DESTRUCTIBLE de siège (ADE II 8 « Le théâtre de la guerre », table « Barricades et
 * protections typiques ») — porte / mur / tour visé par les armes de siège. Même patron type-créature à
 * PV que la facette `hull` de `VehicleData` : la structure devient un `Combatant` qui encaisse les Dégâts
 * via la langue UNIQUE `GameOp`/`woundsFromHit` (cf. `engine/structures.ts`). RAW dit lui-même que
 * Structure / Véhicule / Navire suivent le MÊME modèle Endurance/Blessures + table de Critiques (AA 10 l.13/116).
 */
export interface StructureData {
  /** id STABLE (slug) — clé d'instance/lookup. */
  id: string;
  type: 'structures';
  label: string;
  /** Catégorie physique (ADE II 8) : `porte` est seule visable par un Bélier (`ram`) ; `mur` couvre
   *  murs/tours. Découplée des Atouts (une porte peut être Résistante OU Impénétrable). */
  kind: 'porte' | 'mur';
  /** Nature d'AUTHORING (posable sur une arête d'architecture), DÉCOUPLÉE de `kind` (mécanique RAW,
   *  Bélier ne visant QUE les portes, cf. `structures-aa.test.ts`). `undefined` = découle de `kind`.
   *  Redéfinit le choix quand il DIVERGE du `kind` mécanique verrouillé par le RAW — ex. Herse
   *  (`kind:'mur'` mais se pose comme une FERMETURE de passage, #830). */
  edgeKind?: 'porte' | 'mur';
  /** `true` = véhicule (charrette, chariot, barge…) : partage la mécanique de PV « objet destructible »
   *  (AA 10) mais N'EST PAS posable sur une arête — exclu de tout sélecteur de matériau de mur/porte (#830). */
  vehicle?: boolean;
  /** RENDU (pas règle) : `true` = fortification de siège (rempart de PIERRE crénelé + ferré, brèche =
   *  gravats). `false`/absent = cloison ORDINAIRE (mur de maison texturé, sans créneaux). Découplé de
   *  `kind` : une `porte` fortifiée = corps de garde à herse ; un `mur` fortifié = courtine. Route le
   *  rendu du `WallSeg` porteur (`gameIso/walls.ts::structureSeg`) — TOUJOURS destructible/brèchable. */
  fortified?: boolean;
  /** Profil à PV (calqué sur `VehicleData.hull.char`) — `BE` = Bonus d'Endurance (l'Endurance dérivée vaut
   *  `BE × 10`, posée par `structureCombatant`) ; `B` = Blessures (PV de la structure). ADE II donne le BE
   *  verbatim ; AA (« Tableau des Structures Courantes », AA 10 l.26-92) donne l'Endurance BRUTE — `BE`
   *  se dérive alors par troncature à la dizaine (convention Bonus = dizaines de la Caractéristique). */
  char: { BE: number; B: number };
  /** Atouts de structure (Résistant / Impénétrable) — réfs de Trait par id STABLE (JAMAIS le libellé). */
  traits: { id: string; value?: number }[];
  /** ENC de la Structure transportée (AA 10 l.28-52) — `undefined` = N/A (Structure fixe, ne se transporte pas). */
  enc?: number;
  /** Limite d'Encombrement supportée par la Structure elle-même (AA 10 l.28-52) — `undefined` = N/A. */
  encLimit?: number;
  /** Pénalité de Couvert par défaut pour un assaillant qui tire sur une cible réfugiée sur/derrière la
   *  Structure (AA 10 l.23, colonne l.28-51) — `undefined` = N/A (aucun couvert : Herse l.42 et Solide
   *  porte en bois l.50 ; les 5 entrées ADE II, dont la table n'a pas cette colonne, ADE II 8 l.282-288). */
  couvertPenalty?: CouvertDifficulty;
  /** Laisse-t-elle VOIR à travers ? `undefined` = occultante ; seul `false` est écrivable, et il porte
   *  son `maison` (LDB 14 l.86, LDB 85 l.329). Lu par le seul `areteOcculte` (`state/scene.ts`). */
  occulte?: false;
  /** Catégorie de Taille de la Structure — entre dans le compte de son Bonus d'Endurance (`AA 10 l.98`).
   *  Aucune table de source ne l'imprime : c'est une valeur MAISON par entrée, éditable au Codex, dont la
   *  raison vit dans `maison`. */
  taille: import('./size').SizeCategory;
  /** Provenance RAW au FOLIO imprimé (ADE II 89 ; AA 119-120) — même forme que `SourceRef`. */
  source: { book: string; page: number };
  /** Raison MAISON — exigée par le schéma pour `taille` (toujours) et pour `occulte: false`. */
  maison?: string;
  desc?: string;
}

export interface SkillInstance {
  /** id STABLE de la Compétence (langue-indépendant) ; l'affichage résout en libellé via `skillInstanceLabel`. */
  id: string;
  spec?: string;
  characteristic: CharKey;
  advances: number;
}

export interface TalentInstance {
  /** id STABLE du Talent (langue-indépendant) ; la spec est séparée (plus de libellé concret stocké). */
  talentId: string;
  spec?: string;
  times: number;
}

/** Détails supplémentaires d'un héros (LDB 05 étape 6 — cosmétique, aucune règle). */
export interface HeroDetails {
  age?: number;
  /** Taille en cm. */
  height?: number;
  eyes?: string;
  hair?: string;
  /** Ambitions à court / long terme (LDB 05 l.730-736). */
  ambitionShort?: string;
  ambitionLong?: string;
  /** Astrologie (ADE II 3, optionnel) — flavor pur : signe ascendant + demeures célestes
   *  (le signe mécanique du Personnage vit sur `Combatant.star`). `house` = id de `celestialHouses` ;
   *  `sign` = libellé lisible (flavor figé sur la fiche, aucune mécanique n'y référence un signe). */
  ascendant?: string;
  dwellings?: { house: string; sign: string }[];
}

/** Ignorance de PA — descripteur GÉNÉRAL réutilisable (armes enchantées, attributs de Domaine,
 *  Projectiles…). Un NOMBRE = N points ignorés (aucun producteur en donnée actuellement) ; sinon
 *  une catégorie : 'all' (tous), 'metal' (armures métalliques — Chamon/Azyr), 'leather' (cuir —
 *  Ghur), 'nonMagic' (tout le non magique — Ulgu), 'nonMetal' (tout le non-métallique —
 *  Perforante, LDB 62 l.270). Calcul : engine/armourBypass.bypassedAP.
 */
export type ArmourBypass = number | 'all' | 'metal' | 'leather' | 'nonMagic' | 'nonMetal';

/** Spécification STRUCTURÉE des Dégâts d'arme (LDB 62). La présence du token `BF` (Bonus de Force) est
 *  PORTEUSE de sens — exprimée explicitement par `plusBF`, jamais par accident de chaîne. `flat` DÉJÀ
 *  résolu (négatif autorisé : Indice −2). `bare` : « +BF » NU (Tentacule/Piétinement) ≠ « +BF+0 ».
 *  `literal` = escape hatch pour les Dégâts non chiffrables (« Spécial »). Affichage dérivé par
 *  `damageString` ; remplace la chaîne « +BF+4 » re-parsée par regex au runtime. */
export type WeaponDamageSpec =
  | { literal: string }
  | { plusBF: boolean; flat: number; bare?: true };

/** Portée d'arme à distance (LDB 62) : `number` = mètres FIXES (arc/arbalète/arme à feu) ; `{ bf }` =
 *  Bonus de Force × `bf` mètres (armes de JET — javelot/couteau de lancer/bombe…). Résolue À L'USAGE
 *  avec le BF du porteur (`effectiveRange`, MIROIR de `effectiveWeaponDamage` pour les Dégâts) : stockée
 *  telle quelle sur `Weapon`/`ItemInstance`/`TrappingData`, JAMAIS pré-résolue — un changement de Force
 *  en combat met la Portée à jour, exactement comme les Dégâts `+BF`. */
export type WeaponRangeSpec = number | { bf: number };

/** Modificateur de Portée d'une MUNITION sur la Portée de l'arme de tir (LDB 62, colonne « Portée ») :
 *  `{ mult }` = fraction de la Portée de l'arme (« Moitié de l'arme » → `{mult:0.5}`, « Quart » → `0.25`) ;
 *  `{ add }` = ± mètres (« +50 »/« -10 »). Appliqué à l'usage par `applyAmmoMod` quand la munition est
 *  SÉLECTIONNÉE pour le tir. « Comme l'arme » = AUCUN modificateur (absent/null → Portée de l'arme inchangée). */
export type AmmoRangeMod = { mult: number } | { add: number };

/** Bande de portée d'un tir (table des Difficultés de Combat, LDB 14) — id STABLE, du plus proche au plus
 *  loin. SOURCE des seuils = `RANGE_BANDS` (engine/combat). Réutilisé par `Weapon.minRangeBand` (PORTÉE
 *  MINIMALE d'une machine de guerre, ADE II 8 l.251/253). Le libellé affiché se résout via `rangeBandName`. */
export type RangeBandId = 'bout-portant' | 'courte' | 'moyenne' | 'longue' | 'extreme';

/** Atout/Défaut d'arme ou d'armure PORTÉ par un objet/arme au runtime. Forme STRUCTURÉE (id stable du
 *  registre + Indice éventuel) — miroir runtime de `QualityRef` de la donnée, sans l'aplatissement en
 *  chaîne « id value » re-parsée par regex. `value` = Indice (Solide N, Recharge N, Protectrice N) OU
 *  magnitude d'une pénalité de port (`en-discretion` −10). Affichage dérivé par `qualityRefLabel`. */
export interface QualityInstance {
  /** id STABLE du registre de qualités (`QualityData.id` / `QualityRef.id`) — jamais un libellé FR. */
  id: string;
  /** Indice / magnitude éventuelle (Solide 3, Recharge 2, Taillade 1A — `AA 08 l.87` —, « -10% en
   *  Discrétion » → −10). L'UNITÉ d'affichage vit dans le registre (`QualityData.indice.unite`). */
  value?: number;
}

/** Côté de montage d'une pièce d'artillerie sur un navire (MDG 12-13), relatif au cap du bateau —
 *  pilote l'arc de tir. La LOGIQUE d'arc vit en `state/fireArc.ts` (elle dépend du cap Dir8) ; ce TYPE pur
 *  vit ici pour que `Weapon`/`ItemInstance` le portent sans dépendance engine→state. */
export type FireArc = 'proue' | 'tribord' | 'poupe' | 'babord';

export interface Weapon {
  label: string;
  type: 'melee' | 'ranged';
  /** Dégâts d'arme STRUCTURÉS (cf. `WeaponDamageSpec`) — ex. `{plusBF:true,flat:4}` (« +BF+4 »). */
  damage: WeaponDamageSpec;
  /** Allonge de MÊLÉE — vocabulaire FERMÉ `ReachValue`. Le RANG se lit par `reachRankOf`/`meleeReachRank`. */
  reach?: ReachValue | null;
  /** Portée de tir — SPEC non résolue (cf. `WeaponRangeSpec`) : mètres fixes OU `{bf}`. Résolue à
   *  l'usage par `effectiveRange(weapon.range, BF du tireur)` aux sites combat/affichage. */
  range?: WeaponRangeSpec | null;
  qualities: QualityInstance[];
  /** `id` du Groupe d'arme/famille de munition (`WeaponGroupData.id`) — réf, ≠ libellé. Pilote la
   *  Spécialisation de combat (`combatValue`), la famille de munition (`ammoFamily`), le rendu (rig). */
  subType?: string;
  /** Groupe de Projectiles qui OPÈRE une arme de siège (`WeaponGroupData.id` : arbalete/catapulte/ingenierie/
   *  poudre-noire, AA 10 l.178-193) quand `subType` porte la catégorie de catalogue (« armes-de-siege »).
   *  Résolu par `acceptableSpecs` (`weaponGroup ?? subType`) → Spé de tir du chef ET décompte d'équipage
   *  (servants à la bonne Projectiles, AA 10 l.230). Absent = `subType` EST le Groupe (armes normales). */
  weaponGroup?: string;
  /** Bloque la fusion des qualités de FAMILLE du Groupe (`resolveQualities`, `WeaponGroupData.qualities`)
   *  SANS effacer `subType`/`weaponGroup` — la compétence/talent (`combatValue`/`talentDamageBonus`, lus
   *  par `subType`) restent NET-IDENTIQUES. Posé par les profils EXHAUSTIFS (improvisée, Fléau sans Spé,
   *  Groupe dégradé, Retenir ses coups) qui remplacent la liste de qualités par un ensemble volontairement
   *  clos — sans ce drapeau, une qualité de FAMILLE réapparaîtrait (absente de la liste propre). */
  noFamilyQualities?: boolean;
  /** Passifs d'ARME conférés par une ALTÉRATION (op `augmentWeapon.passive`, repliés par `applyEnchants`) —
   *  MÊME vocabulaire que le `passive` d'un Atout/Défaut du registre, lus au MÊME point (`weaponPassiveOps`,
   *  engine/qualities/dispatch). VDM 05 Défaut : « −1 DR à tous les Tests pour attaquer avec elle ». */
  passive?: import('./ops').GameOp[];
  /** Qualités NEUTRALISÉES sur cette arme par id (altération `augmentWeapon.removeQualities`) — retirées
   *  APRÈS la fusion des qualités de FAMILLE (`resolveQualities`), qui sont sur le même plan RAW. */
  removedQualities?: string[];
  /** POLARITÉS de qualité neutralisées (altération `augmentWeapon.removeType`) : la polarité de chaque
   *  qualité est résolue par le REGISTRE (`qualities.json` champ `polarite`) à la fusion — jamais une
   *  liste d'ids en dur. VDM 05 *Défaut* : « Tous les Atouts de l'arme disparaissent ». Le nom du champ
   *  d'op reste `removeType` : il est PERSISTÉ en donnée, son rename appartient à #1468 (L1c). */
  removedTypes?: ('atout' | 'defaut')[];
  /** `id` de munition REPRÉSENTATIVE d'une arme de siège (cf. `TrappingData.defaultAmmo`) — discrimine la
   *  bonne famille de munition (pierrier/canon/baliste/mortier) là où `subType` seul ne le fait pas. Lu par
   *  `ammoFamilyLabel` pour le hint joueur. */
  defaultAmmo?: string;
  /** Pièce d'artillerie « relativement simple » (la baliste, AA 10 l.148) : tirée par UN SEUL servant
   *  valide → l'arme perd TOUS ses Atouts (conserve ses Défauts). Lu par `crewedFireWeapon`. Absent = non. */
  soloSimple?: boolean;
  /** Pièce à TIR INDIRECT (mortier/catapulte — « arc élevé », AA 10 l.169-171) : peut viser une CASE au sol
   *  (pas forcément un combattant) ; son Atout Explosion/Tir de zone frappe le rayon autour de la case. Lu
   *  par `availableAttacks` (ciblage de case vs combattant). Absent = tir DIRECT (canon, baliste, pierrier). */
  indirect?: boolean;
  /** LDB 62 l.278 — approximation MAISON (le RAW ne liste pas les armes à lame), éditable. */
  bladed?: boolean;
  /** LDB 47 — approximation MAISON (matière du projectile, non tabulée par le RAW), éditable. */
  organicProjectile?: boolean;
  /** Nombre de mains requises (1 ou 2). Dérivé de `(2M)` / arc / arbalète. */
  hands?: 1 | 2;
  /** Main qui tient l'arme dans le loadout actif ('off' → pénalité de main secondaire). */
  hand?: 'main' | 'off';
  /** uid de l'ItemInstance source (loadout) — pour matcher un choix d'arme. Absent : Mains nues/Crochet. */
  uid?: string;
  /** id de trapping SOURCE d'une arme « built-in » (Mains nues = 'mains-nues') — marqueur STABLE,
   *  multilangue (≠ test par nom `w.name === 'Mains nues'`). Absent pour les armes manufacturées. */
  builtinId?: string;
  /** `id` du trapping de catalogue dont l'ARME dérive (`TrappingData.id`) — MÊME champ, MÊME sémantique
   *  que `ItemInstance.trappingId`, propagé par `toWeapon`/`mannedPosteWeapon` (engine/items). Identité
   *  STABLE de l'arme, là où `name` n'est qu'un LIBELLÉ d'affichage (#598).
   *  ABSENT = arme sans def de catalogue (invoquée, naturelle, custom/forgée) : la règle est de le
   *  laisser ABSENT et de retomber sur `weaponIdentity` (uid d'instance) — JAMAIS un id re-slugifié
   *  depuis le libellé, qui ré-introduirait la logique-par-label que ce champ existe pour supprimer. */
  trappingId?: string;
  /** Rechargement : Indice DR à cumuler (Test étendu de Projectiles) ; 0 = aucun, tire chaque Round. */
  reload?: number;
  /** Ignorance de PA de l'arme (Épée de justice → 'all', etc.) — fusionnée par `enchantedWeapon`,
   *  lue par `woundsFromHit` (engine/armourBypass). */
  bypass?: ArmourBypass;
  /** Dégâts subis par l'arme (LDB 62 l.135) : réduit les Dégâts de 1/point ; à +0 → improvisée. */
  damageTaken?: number;
  /** Arme détruite (Incident de Tir, LDB 14) : inutilisable. */
  destroyed?: boolean;
  /** SKIN cosmétique (objets uniques/légendaires) : override de palette token→hex appliqué au
   *  rendu de l'arme (ex. { metal:'#caa64a' } → lame dorée). Données opaques côté moteur. */
  skin?: Record<string, string>;
  /** Silhouette de RENDU forcée (libellé d'arme du catalogue, ex. arme invoquée affichée comme
   *  « Bâton de combat » bien que nommée « Arme aethyrique ») — résolue par le rig (weaponFamily).
   *  Donnée opaque côté moteur (un simple libellé). */
  form?: string;
  /** Slug de FORME (`WeaponDef`/`ShieldDef.slug`) — id STABLE de routage de l'art (rig `weaponFamily`/
   *  `shieldPart`), ≠ libellé. Stampé au spawn/à la construction depuis `ItemInstance.shape` ou le trait.
   *  Absent = attaque naturelle / arme générique (repli par Groupe au rendu). */
  shape?: string;
  /** Attaque NATURELLE de corps (morsure/griffes/cornes…) : aucune arme tenue n'est dessinée (le rig
   *  rend le membre). Stampé au spawn depuis `TraitInstance.natural` / la capacité `naturalWeapon`. */
  natural?: boolean;
  /** Taille PRÉVUE pour l'arme (ADE II 2 l.706-710) — propagée depuis `ItemInstance.sizeFor`. Différente
   *  de la Taille du porteur → −20 à tous les Tests avec cette arme (`attackModifiers`). */
  sizeFor?: import('./size').SizeCategory;
  /** Trait « Arme +N » générique SANS objet de catalogue identifié (`creatureEquip.weaponFromTrait`) :
   *  ≠ `natural` (le rendu garde sa silhouette générique, `weaponFamily`) — exempte SEULEMENT du
   *  mismatch de Taille (`attackModifiers`), n'étant pas une POSSESSION manufacturée réelle. */
  sizeless?: boolean;
  /** Effets « à la touche » : repliés depuis l'enchantement de l'arme (op `augmentWeapon` / arme
   *  invoquée) par `recomputeLoadout`, OU portés en DONNÉE par le catalogue (`TrappingData.onHitEffects` —
   *  Canon à flammes nain « 2 + DR En flammes à chaque cible affectée », ADE II 8 l.243) → lus par
   *  `effectsOf` (state/triggeredEffects), dispatchés à la touche (primaire ET zone d'Explosion). */
  onHitEffects?: import('./flowCore').TriggeredEffect[];
  /** PORTÉE MINIMALE : bande de portée la plus BASSE à laquelle l'arme peut tirer (ADE II 8 l.251/253).
   *  Une cible plus proche que cette bande REFUSE le tir (`firedAttackBlock`, `belowMinRangeBand`), ce n'est
   *  PAS un malus. Machines de siège à distance = `'courte'` (pas de Bout Portant, l.253) ; trébuchet/mortier
   *  = `'moyenne'` (« distance inférieure à leur Portée Courte » interdite, l.251). Absent = aucune minimale. */
  minRangeBand?: RangeBandId;
  /** Nature d'attaque NATURELLE (morsure/cornes/caudale/tentacules/pietinement…) STAMPÉE à la
   *  construction de l'arme (depuis le `kind` de la manœuvre/attaque gratuite qui la connaît). Clé de
   *  POSE (même domaine que le retour de `creatureAttackKind`) lue pour l'anim et la Condition Flow
   *  `attackKind` — ≠ name-parse (multilangue-safe). Absent = arme manufacturée (pose générique). */
  attackKind?: string;
  /** Pièce d'artillerie MONTÉE sur un navire : côté de montage (proue/poupe/bâbord/tribord) relatif au
   *  cap → restreint l'arc de tir (lu par la validation de visée via `inFireArc`). Absent = arme non montée. */
  mountSide?: FireArc;
  /** Pénalité PLATE au Test de tir bakée par le sous-effectif d'une Arme d'équipe quand le Défaut ajouté
   *  était DÉJÀ porté (MDG 12 l.460 : −10/Défaut redoublé). Posée par `crewedFireWeapon`, ajoutée aux
   *  modificateurs de touche par `attackModifiers` (comme Précise, mais négative). Absent = aucune. */
  crewedTohitPenalty?: number;
  /** Gantelet verrouillé (AA folio 94) : Round où le porteur a évité de LÂCHER cette arme (anti-lâcher).
   *  Tant que `round ≤ gauntletSavedRound + 1` (période de « 1 Round min »), un SECOND lâcher forcé fait
   *  tomber l'arme ; au-delà, la protection se réarme. Marqueur transitoire posé/lu par `applyBladeTrap`. */
  gauntletSavedRound?: number;
  /** Caractéristique de résolution ALTERNATIVE du Test d'attaque, à la place de CC (mêlée)/CT (distance)
   *  par défaut (ADE II 8 l.233 : « Toutes les machines de guerre... utilisent... Projectiles [Machine
   *  de guerre], à l'exception du bélier, qui utilise Force »). DÉRIVÉ (jamais un id en dur) de la SEULE arme
   *  de mêlée du Groupe `machine-de-guerre` (`warMachineResolveChar`, engine/items.ts) — absent = résolution
   *  normale par `kind` (`combatValue`). Runtime-only : aucun champ JSON correspondant (schéma figé). */
  resolveChar?: CharKey;
  /** Pénalité PLATE au Test de tir/manœuvre d'une machine de guerre ADE II en Équipe INCOMPLÈTE (−20,
   *  ch.08 l.233) — 3ᵉ courbe de sous-effectif, DISTINCTE de `crewedTohitPenalty` (AA, Défaut redoublé).
   *  Bakée par `warMachineFireWeapon` (engine/warMachineCrew.ts), lue par `attackModifiers`. */
  crewTeamPenalty?: number;
  /** Entité SOURCE de cette arme (sort, talent, trait, objet, maladie…) — ancrage de règle GÉNÉRAL,
   *  au-delà du seul cas des sorts (`sourceSpellId`). Absent = source non propagée par le déclencheur :
   *  la pastille s'affiche alors nue (cf. `chipCodex`), régime RÉSIDUEL gardé par
   *  `src/engine/effect-rule-anchor.test.ts`. */
  source?: EffectSource;
  // ── ÉTAT DE CHARGE (par ARME) ─────────────────────────────────────────────────────────────────────
  // Chaque arme choisit sa munition à son propre chargement ; chaque arme à distance possédée gère
  // son propre rechargement et sa propre munition (arbitrage utilisateur 2026-08-16 : « si j ai 2 armes
  // à distance elles gèrent chacune leur propre rechargement et munition »).
  // L'état vit donc sur l'INSTANCE d'arme (`Combatant.weapons[i]`), jamais sur le combattant ; une pièce
  // d'artillerie SERVIE porte le sien sur `ShipPoste`. Source unique de lecture/écriture :
  // `loadRegister`/`loadWeapon`/`unloadWeapon` (engine/items.ts). Préservé au re-dérivage du set
  // (`recomputeLoadout`, par uid).
  /** Munition CHOISIE pour le prochain chargement de CETTE arme (uid d'un ItemInstance `kind 'ammo'`). */
  ammoUid?: string;
  /** Munition CAPTURÉE dans le coup chargé de CETTE arme : posée au chargement, consommée au tir. */
  loadedAmmoUid?: string;
  /** CETTE arme est-elle chargée ? (Recharge 0 : toujours ; Recharge N : faux après un tir.) */
  loaded?: boolean;
  /** DR cumulés du Test étendu de Projectiles de CETTE arme vers son Indice `reload` (pas des Actions). */
  reloadProgress?: number;
  /** À répétition (Indice) (LDB 62 l.229/231) : munitions restantes dans le chargeur de CETTE arme. */
  chambered?: number;
}

/** Enchantement d'ARME (op `augmentWeapon` — B. de Droiture, Marteau ardent, Épée de justice ;
 *  arme invoquée — Épée ardente de Rhuin). PORTÉ PAR L'OBJET (`ItemInstance.enchants`, source de
 *  vérité) et replié dans l'arme dérivée par `recomputeLoadout` (`applyEnchants`). `id` : identité
 *  pour le retrait ciblé à l'expiration (un `ActiveEffect.enchantRef` le temporise). */
export interface WeaponEnchant {
  id: string;
  /** Atouts ajoutés en ids STABLES de qualité (`QualityRef.id` — « magique » → touche l'Éthéré ;
   *  « percutante »…). Repliés tels quels dans `Weapon.qualities` (eux-mêmes des ids) par `applyEnchants`. */
  addQualities?: string[];
  /** Dégâts supplémentaires (Marteau ardent : +BSoc ; Épée ardente : +6) — déjà résolu. */
  damageBonus?: number;
  /** Ignorance de PA conférée (Épée de justice → 'all') — descripteur général ArmourBypass. */
  bypass?: ArmourBypass;
  /** Effets DÉCLENCHÉS « à la touche » — forme `TriggeredEffect` (Marteau ardent → En flammes/À Terre). */
  onHitEffects?: import('./flowCore').TriggeredEffect[];
  /** Qualités RETIRÉES par id STABLE (VDM 05 — Arme enchantée « retirer 1 Défaut »). */
  removeQualities?: string[];
  /** Retire toutes les qualités de ce TYPE, lu dans le registre (VDM 05 Défaut « Tous les Atouts […] disparaissent »). */
  removeType?: 'atout' | 'defaut';
  /** Neutralise les AUTRES enchantements de l'arme (VDM 05 Défaut, clause gatée à +4 DR). */
  suppressEnchants?: boolean;
  /** Passifs d'ARME conférés — MÊME vocabulaire que le `passive` d'un Atout/Défaut du registre, lu au MÊME
   *  point (`weaponPassiveOps`). VDM 05 Défaut : « −1 DR à tous les Tests pour attaquer avec elle ». */
  passive?: import('./ops').GameOp[];
}

/** Points d'Armure par localisation. */
export type ArmourPoints = Record<HitLocation, number>;

/** id d'un État — slug d'`etats.json`. OUVERT (string) : les États sont de la DONNÉE éditable au Codex,
 *  on peut en CRÉER. Les 12 États canoniques (LDB 16) à comportement moteur sont référencés par le moteur
 *  via la constante `COND` (engine/conditions) — pas d'union fermée qui interdirait la création. Le libellé
 *  affiché se résout via `conditionLabel`/`findConditionById`. */
export type ConditionId = string;

export interface ConditionInstance {
  /** id de l'État (slug d'etats.json) — ≠ libellé (résolu à l'affichage via `conditionLabel`). */
  id: ConditionId;
  value: number; // certains États s'empilent (ex. Hémorragique)
  /** Source de l'État (id du Combatant) — pour le Test opposé de « se libérer » d'un Empêtré (LDB 16 l.66). */
  sourceId?: string;
  /** Force d'évasion FIGÉE d'un État à Test opposé (Empêtré « se libérer » — LDB 16 l.66) : posée par
   *  l'op `condition.escapeStrength` (ex. Force Mentale du lanceur d'un Enchevêtrement). Si présente, le
   *  flux de récupération l'oppose AU LIEU de la Force de la source vivante — vaut même lanceur absent. */
  escapeStrength?: number;
  /** Seuil de DR FIGÉ d'un État à Test NON opposé (Empêtré « se libérer » — Filets, Zoo Impérial p.29 :
   *  « Test de Force Intermédiaire (+0) et obtenir un nombre de DR égal à l'Indice du filet ») : posé par
   *  l'op `condition.escapeThreshold`. Si présent, le flux de récupération exige DR ≥ ce seuil (au lieu
   *  d'opposer une Force) — prioritaire sur `escapeStrength`. */
  escapeThreshold?: number;
  /** Aggravation FIGÉE sur ÉCHEC du Test de récupération (Filets, Zoo Impérial p.29 : « si la cible ne
   *  parvient pas à se dépêtrer, elle gagne un État Empêtré supplémentaire ») — posée par l'op
   *  `condition.entangleOnFail`. Absente (défaut LDB, Immobilisante générique) : un échec ne fait qu'échouer. */
  entangleOnFail?: boolean;
  /** Dégâts FIGÉS ignorant l'armure, infligés à CHAQUE tentative de libération (réussie ou ratée) — Filets
   *  BARBELÉS (ZI 2 l.178 : « infligent automatiquement des Dégâts qui ignorent l'armure à toute
   *  cible qui se débat »). Posés par l'op `condition.struggleDamage`. ZI 2 l.178 ne chiffre pas ce montant :
   *  le moteur ne fixe AUCUNE valeur — c'est un champ de DONNÉE éditable (qualité `filet-barbele`,
   *  `qualities.json`), à régler par qui autorise le contenu, jamais codé en dur ici. */
  struggleDamage?: number;
  /** Durée en Rounds d'un État posé par un SORT (« 1 État Sonné qui dure 1d10 Rounds ») —
   *  décrémenté en fin de Round, l'État se dissipe à 0. Un ajout NON temporisé du même État
   *  efface la durée (l'État redevient régi par ses règles normales — on n'écourte jamais). */
  roundsLeft?: number;
  /** Échéance d'HORLOGE (minute `gameTime`) d'un État à durée en heures/minutes (Belladone : sommeil
   *  « 1d10 + 4 heures », LDB 72 l.18) — posée par `addClockCondition` (op `condition.durationHours`),
   *  purgée par `purgeClockEffects` (upkeep, à chaque avance d'horloge). Exclusif de `roundsLeft`. */
  untilTime?: number;
  /** VERROU conditionnel (LDB 18 : Blessures critiques) : un État posé par un Critique ne peut être RETIRÉ
   *  que lorsque cette Condition (algèbre flowCore) est VRAIE. Ex. « Aveuglé qui ne peut pas être retiré
   *  tant que tous les États Hémorragique n'ont pas été éliminés » (Tête 46-50) ⇒ `compare {condition:
   *  'hemorragique'} == 0`. Tant que le verrou tient, `removeCondition` (dont l'auto-dissipation) est INERTE
   *  sur cet État. Évalué par `isConditionLocked`. */
  lockedUntil?: import('./flowCore').Condition;
  /** VERROU d'ACTE de soin (LDB 18) : un État posé par un Critique « ne peut être retiré que par [acte] »
   *  (Aveuglé/Sonné/Inconscient « par Aide Médicale », Hémorragique « par Chirurgie »). Porté sur l'INSTANCE
   *  (aucun trauma porteur), levé par l'acte NOMMÉ via `releaseConditionLocks` (qui RETIRE alors l'État —
   *  l'acte est ce qui le « soigne »). Tant qu'il est posé, `removeCondition` (récupération naturelle,
   *  auto-dissipation) est INERTE sur cet État. Évalué par `isConditionLocked`. */
  unlockBy?: ConditionUnlock;
  /** MARQUAGE d'un État DÉRIVÉ d'un canal PASSIF (op `condition` dans `passive`/`passiveBySeverity` —
   *  LDB 20 l.170 Fièvre (Grave) → Inconscient, l.188 Malaise → Exténué) : combien des `value` pions de
   *  cette instance ont été posés par la réconciliation (`stacks`), et QUI les porte (`src`, l'entité
   *  émettrice en ids stables — elle NOMME la ligne de journal). Écrit et lu par `syncDerivedConditions`
   *  (engine/conditions), SEUL propriétaire : ces pions-là partent quand le fait source cesse, et une
   *  instance SANS ce champ (KO natif à 0 PB, Sonné d'un coup) n'est jamais touchée par la réconciliation. */
  derivedFrom?: { stacks: number; src?: CodexTarget };
}

/** Les DEUX verrous de retrait d'un `ConditionInstance`, groupés — argument unique d'`addCondition`
 *  (prédicat d'état `LDB 18`, acte de soin `LDB 18`). */
export interface ConditionLocks {
  lockedUntil?: import('./flowCore').Condition;
  unlockBy?: ConditionUnlock;
}

/** Acte de soin qui LÈVE un verrou d'État de Critique (LDB 18). `medicalAid` = une des 3 formes d'Aide
 *  Médicale (Guérison réussie / bandage-cataplasme / sort-prière de soin) ; `surgery` = acte de Chirurgie ;
 *  `magic` = soin magique (qui compte AUSSI comme Aide Médicale, LDB 18 l.311 → lève aussi `medicalAid`). */
export type ConditionUnlock = 'medicalAid' | 'surgery' | 'magic';

/**
 * NOTIFICATION qu'une LIGNE DE JOURNAL vient d'être écrite en NOMMANT un État (#1330) : lequel
 * (`stateId`, jamais son libellé), dans quel sens elle le nomme, sur qui. Le moteur NOTIFIE — il
 * n'écrit rien et ne compose aucun texte : la ligne FR reste seule maîtresse du journal, l'id voyage
 * À CÔTÉ d'elle. Appariement 1:1 avec la ligne poussée au même instant (l'émetteur les pose ensemble).
 *
 * ATTENTION : c'est un appariement LIGNE↔ID, PAS un delta d'état : n'en dérivez aucun compteur d'États portés.
 * Contre-exemple qui le prouve — une op `condition` à `perRound` notifie à l'ANNONCE (« X subit 1 État
 * Y par Round ») alors qu'AUCUN État n'est encore posé : les poses réelles tomberont à chaque fin de
 * Round et notifieront chacune la leur. Un consommateur qui compterait les `gain` double-compterait.
 */
export interface ConditionChange {
  stateId: string;
  change: 'gain' | 'loss';
  targetId: string;
}

/** Récepteur de `ConditionChange` — branché par la couche state ; absent en moteur pur/tests (les ops
 *  sont alors strictement inchangées, lignes comprises). */
export type ConditionEmit = (e: ConditionChange) => void;

/** Pénalité/blocage d'incantation temporisé (contrecoups des tables d'Imparfaites /
 *  Colère des dieux — LDB 46 l.61-136, LDB 40 l.55-89). Une seule des deux durées :
 *  `roundsLeft` (échelle tactique) ou `untilTime` (minutes d'horloge `gameTime`). */
/** SENTINELLE de portée d'une `CastPenalty` RUNTIME : toute magie (Prière + Langue + Focalisation).
 *  C'est la projection de l'op `castPenalty` SANS référence de Compétence (`src/engine/ops.ts`). */
export const ALL_MAGIC = 'all';

export interface CastPenalty {
  label: string;
  /** Compétence visée (id stable skills.json), ou `ALL_MAGIC`. */
  skill: string;
  /** Modificateur (négatif) à la valeur de Test (« Langue maladroite −10 »). */
  mod?: number;
  /** Tests interdits (« Vous abusez de ma patience », « Propos ésotériques »…). */
  blocked?: boolean;
  /** « Pensez à vos actes » : tout Test de Prière réussi est plafonné à 0 DR. */
  maxZeroDR?: boolean;
  roundsLeft?: number;
  untilTime?: number;
}

/** Nature de l'ENTITÉ qui a produit un effet — vocabulaire fermé, chaque valeur adossée à une
 *  catégorie du Codex (table `CATEGORY_BY_SOURCE_KIND` ci-dessous). */
export type EffectSourceKind =
  | 'spell' | 'prayer' | 'talent' | 'trait' | 'trapping' | 'quality' | 'disease' | 'symptom'
  | 'mutation' | 'condition' | 'psychology' | 'maneuver' | 'creature' | 'activity' | 'rule'
  | 'tavernGame'
  // Une RANGÉE tirée d'un tableau d'Incantation Imparfaite / de Colère des dieux (`LDB 46`, `LDB 40`) :
  // l'entité source des effets d'un contrecoup est la LIGNE, dont la fiche Codex vit dans la catégorie
  // que SA table déclare (`MiscastTableDef.codexCategory`). Le `kind` porte donc le NOM de cette
  // catégorie, et `miscastRowSource` (`engine/miscast.ts`) est le seul à le fabriquer, depuis la donnée.
  | 'miscastMinor' | 'miscastMajor' | 'miscastWrath';

/** Catégorie Codex de CHAQUE nature de source — table TOTALE, SOURCE UNIQUE des deux consommateurs :
 *  le routage d'affichage d'une pastille (`chipCodex`, `src/gameIso/effectIcons.ts`) ET la descente de
 *  l'ENJEU d'un jet à l'entité qui l'exige (`src/state`, #1117). Elle vit ICI, à côté du vocabulaire
 *  qu'elle indexe, parce qu'`src/state` ne peut pas dépendre de `src/gameIso` : une copie côté state
 *  aurait fait DEUX vérités pour une seule question. */
export const CATEGORY_BY_SOURCE_KIND: Record<EffectSourceKind, string> = {
  spell: 'spells', prayer: 'spells', talent: 'talents', trait: 'traits', trapping: 'trappings',
  quality: 'qualities', disease: 'maladies', symptom: 'symptoms', mutation: 'mutations',
  condition: 'etats', psychology: 'psychologies', maneuver: 'maneuvers', creature: 'creatures',
  activity: 'activities', rule: 'regles', tavernGame: 'tavernGames',
  miscastMinor: 'miscastMinor', miscastMajor: 'miscastMajor', miscastWrath: 'miscastWrath',
};

/**
 * Famille d'un modificateur de jet (`ModLine.famille`) — la taxonomie du contrat d'affichage,
 * #1153 L3b. Elle vit ICI, avec `effectRef`, pour être lisible des collecteurs (`conditions`,
 * `trauma`) comme du moteur de combat sans cycle d'import.
 *  - `circonstance` : modificateur SITUATIONNEL du Test (terrain, position, geste, état ou trait de
 *    l'adversaire) — `LDB 14` (chapeau l.48, exemple plafonné l.96).
 *  - `jet` : ressource ou état PROPRE du jeteur (Avantage, SES États, Soutien) — `LDB 12 l.189`,
 *    `LDB 16 l.11`.
 * POSÉE À L'ÉMISSION, jamais dérivée à l'affichage.
 */
export type ModFamille = 'circonstance' | 'jet';

/**
 * UN modificateur ÉTIQUETÉ d'un jet (« Courte portée +20 », « −30 Brisé ») — FORME UNIQUE de tout
 * modificateur nommé du jeu : composantes de pénalité d'État, bonus à l'attaquant, lignes montées
 * par le seam, pénalité d'un Test d'entretien différé. Définie ICI (module socle) pour que les
 * collecteurs l'émettent sans dépendre du moteur de combat, qui la ré-exporte pour ses lecteurs.
 */
export interface ModLine {
  label: string;
  /** Famille du modificateur, posée à l'ÉMISSION (jamais dérivée à l'affichage) — `LDB 14 l.48`. */
  famille: ModFamille;
  value: number;
  /** La RÈGLE qui octroie ce modificateur, en ids STABLES (`RULE_REF`, ou une entité : État,
   *  Domaine, qualité d'arme). L'affichage en fait une chip liée au Codex (`ui/RollLine.tsx`) ;
   *  le moteur ne la lit jamais. */
  ref?: CodexTarget;
  /** Qui octroie ce modificateur, en STRUCTURE (les soutiens d'un Test de groupe) — jamais du
   *  texte composé dans `label`. Rendu en micro-chips à côté de la chip de la règle. */
  by?: ModProvenance[];
}

/** Renvoi Codex d'un effet actif : son entité SOURCE (`EffectSource`, table TOTALE
 *  `CATEGORY_BY_SOURCE_KIND` ci-dessus), sinon le sort qui l'a posé. Absent = effet dont le
 *  déclencheur n'a pas propagé la source (seul cas structurellement non liable, cf.
 *  `test-value-parts.test.ts`). COUTURE UNIQUE effet→fiche pour les `ModLine` : elle vit ICI, à côté
 *  de la table qu'elle indexe, pour être lisible des DEUX collecteurs (`conditions`, `trauma`) sans
 *  cycle d'import entre eux. */
export function effectRef(e: ActiveEffect): CodexTarget | undefined {
  if (e.source) return { category: CATEGORY_BY_SOURCE_KIND[e.source.kind], id: e.source.id };
  return e.sourceSpellId ? { category: 'spells', id: e.sourceSpellId } : undefined;
}

/** IDENTITÉ de ce qui a produit un effet — « les GameOps sont rattachés à quelque chose » (arbitrage
 *  user 2026-07-18). Portée par l'`OpsCtx` du déclencheur et stampée par `applyOps` sur tout
 *  `ActiveEffect` posé : c'est ELLE qui relie une pastille à sa règle, par id STABLE (jamais le label). */
export interface EffectSource {
  kind: EffectSourceKind;
  /** id STABLE de l'entité source, tel qu'il vit dans son catalogue (`src/data/*.json`). */
  id: string;
}

/**
 * Effet magique actif et temporisé (Bénédiction, Sort de bonus…).
 * Les bonus ne se cumulent pas : le meilleur l'emporte par caractéristique
 * (Livre de base p.238 / p.220).
 */
export interface ActiveEffect {
  label: string;
  /** Entité SOURCE de cet effet (sort, talent, trait, objet, maladie…) — ancrage de règle GÉNÉRAL,
   *  au-delà du seul cas des sorts (`sourceSpellId`). Absent = source non propagée par le déclencheur :
   *  la pastille s'affiche alors nue (cf. `chipCodex`), régime RÉSIDUEL gardé par
   *  `src/engine/effect-rule-anchor.test.ts`. */
  source?: EffectSource;
  /** id STABLE de l'effet (langue-indépendant) pour les effets que le moteur reconnaît par identité
   *  (« Exposition (froid) » → 'exposition-froid') plutôt que par libellé. Le `label` reste l'affichage. */
  effectId?: string;
  /** Caractéristique modifiée, le cas échéant. */
  char?: CharKey;
  /** Valeur du bonus (ex. +10). */
  bonus: number;
  /** Durée de l'effet (échelle Rounds, horloge `gameTime`, ou permanent) — représentation UNIQUE
   *  (cf. `engine/duration.ts`), sans compteur ni sentinelle parallèles : un buff en Rounds =
   *  `{scale:'rounds'}`, en heures = `{scale:'clock'}` (purgé
   *  par l'horloge), sans durée = `{scale:'permanent'}`. */
  duration: Duration;
  /** POLITIQUE DE DURÉE déclarée à la pose : cet effet `permanent` reçoit une ÉCHÉANCE d'horloge dès que
   *  le porteur passe un répit à l'abri de la cause (pénalités d'Exposition, `expireOnRespite`).
   *  Le délai est le MÊME pour tous les répits — la règle éditable `exposure-expire-hours` (défaut 24 h),
   *  lue par l'appelant (camp `restFlow`, jour de mer `seaVoyageFlow`). Absent = l'effet ne connaît pas
   *  cette dissipation (le répit ne le touche pas). */
  expiresOnRespite?: true;
  /** SORT SOURCE de cet effet actif (posé à l'incantation via `OpsCtx.sourceSpell`) : identité + NI, pour
   *  la DISSIPATION (LDB 46 l.158-162 : Test étendu de Langue (Magick) jusqu'au NI → retrait de TOUS les
   *  effets de ce sort). Absent = effet non-magique ou sort instantané (rien à dissiper). */
  spell?: { spellId: string; ni: number; casterId: string; label: string };
  /** id STABLE du sort/prière SOURCE de cet effet actif (posé à l'incantation via `OpsCtx.sourceSpellId`),
   *  posé pour TOUT effet durable issu d'un lancement — Prières COMPRISES (contrairement à `spell`, réservé
   *  aux Sorts dissipables). Ne porte AUCUNE sémantique de dissipation : sert l'IDENTITÉ du sort (anti-spam
   *  de buff côté IA : « cet allié porte déjà CE buff »). */
  sourceSpellId?: string;
  /** GELÉ en attente de l'offre de prolongation (LDB 47 l.311, Durée « + ») : posé par `tickDurations`
   *  quand la Durée atteint 0 pour un effet dont le SORT source porte `plus:true` — au lieu d'expirer,
   *  l'effet est figé (aucun décompte supplémentaire) jusqu'à `resolvePlusExtension` (Test de Force
   *  Mentale réussi → +1 Round ; refusé/raté → expiration normale). Absent = pas d'offre en cours. */
  awaitingExtension?: true;
  /** CRANS d'atténuation d'Influence corruptrice conférés par cet effet (op `corruptionExposure`
   *  `easeSteps` — VDM 05 Bouclier en acier doré : « réduit de 2 crans une Influence corruptrice »).
   *  Sommés par `corruptionEaseSteps`, consommés à la POSE de toute exposition. */
  corruptionEase?: number;
  /** Ops RÉCURRENTES re-jouées à CHAQUE fin de Round tant que l'effet dure (op `perRound` — sorts
   *  multi-Rounds : 1 État X par Round, 1 Ration par Round de « Récolte de Rhya », etc.). Les valeurs
   *  sont déjà résolues à l'incantation (littérales) — `endOfRound` les ré-applique via `applyOps`
   *  sans avoir besoin du lanceur. La durée (donc le nombre de répétitions) suit `duration`, qui
   *  intègre la Surincantation de Durée (LDB 47). */
  opsPerRound?: import('./ops').GameOp[];
  /** Ops PASSIVES PORTÉES par cet effet, émises par `passiveMods` tant qu'il dure (#1695) — une op
   *  `condition` y devient un pion DÉRIVÉ (`derivedFrom`, réconcilié par `syncDerivedConditions`) :
   *  LDB 48 l.495, « qui persistent tous pour la durée du Sort ». L'effet EST la durée et le verrou du
   *  pion ; il part avec lui (expiration, Dissipation, purge). Canal UNIQUE des passifs d'effet : tout
   *  ce qu'un effet émet passe par ici, avec sa source (`effectRef`) et son libellé. */
  passive?: import('./ops').GameOp[];
  /** PA temporisés à TOUTES les localisations (Armure Aethyrique : « +1 PA à toutes les
   *  Localisations ») — lus par effectiveArmourAt à la mitigation des Dégâts. */
  apAll?: number;
  /** PA temporisés à une Localisation précise (op `ap` avec `loc`) — lus par effectiveArmourAt. */
  apAt?: Partial<Record<HitLocation, number>>;
  /** Modificateur TEMPORAIRE de Standing (op `statusMod` — LDB 23 l.228-234 « Réputation » : +1/+2/−1
   *  « pour la prochaine aventure »). Composé par `heroStatus` (interludeFlow.ts). `duration` porte
   *  presque toujours `{scale:'adventure'}` (purgé à l'interlude SUIVANT). */
  statusMod?: number;
  /** Jeton d'INVERSION de Test CONSOMMABLE « pour votre prochaine aventure » (op `grantReverseToken` —
   *  LDB 23 l.209 « Entraînement au Combat »/l.218 « Observer une cible ») : une UTILISATION, retirée à
   *  la consommation (`consumeReverseToken`) — sinon expire à l'interlude suivant comme `statusMod`
   *  (MÊME canal `duration:{scale:'adventure'}`, `purgeAdventureEffects`). `skill` absent = tout Test
   *  (scope « concernant votre cible », l.218 — le lot données/UI arbitre le filtrage par cible). */
  reverseToken?: { skill?: string; spec?: string };
  /** Ce PA (apAll/apAt) ne peut pas servir à la Déviation Critique (op ap avec noDeviation — LDB 63 l.30 + EDO App.2 l.196). Le PA de sort (couche magique) n'entre de toute façon pas dans le PA déviatable. */
  noDeviation?: boolean;
  /** Trait de créature ACCORDÉ par cet effet (op `grantTrait` — Envol, Effrayant…) : le
   *  `TraitInstance` exact posé dans `c.traits`, retiré (une instance) à l'expiration (engine/grantedTraits). */
  grantedTrait?: import('./statEntry').TraitInstance;
  /** Mutation TEMPORISÉE accordée par cet effet (op `rollMutation` à durée — Allure démoniaque, EDOC 13
   *  l.276-277) : la `Mutation` exacte posée dans `c.mutations`, DÉTACHÉE à l'expiration
   *  (`dropExpiredGrantedMutations`, engine/corruption). Une mutation de CORRUPTION (permanente) n'a pas
   *  d'effet porteur — elle vit seule dans `c.mutations`, jamais détachée. */
  grantedMutation?: import('./corruption').Mutation;
  /** Apparence de REMPLACEMENT le temps de l'effet (op `polymorph`) : id de créature dont la couche rig
   *  rend l'apparence (`combatantAppearance` via `liveMorphRef`). Le moteur ne porte QUE l'id (pureté —
   *  aucune dépendance au rig) ; l'override est auto-restitué à l'expiration (effet retiré → plus de morphRef). */
  morphRef?: string;
  /** Arme INVOQUÉE temporaire (op `grantWeapon` — Arme aethyrique, Faux de Shyish, Épée ardente) :
   *  l'objet `conjured` est posé dans un SET d'armes DÉDIÉ (réutilise le système de loadouts) rendu
   *  actif. À l'expiration, `dropExpiredGrantedWeapons` retire l'objet ET le set, et réactive le set
   *  d'origine (`restoreLoadoutId`). Pas d'arme synthétique ni d'injection parallèle. */
  conjuredSet?: { itemUid: string; loadoutId: string; restoreLoadoutId?: string };
  /** Arme NATURELLE accordée par un Sort (Dent et griffe : Morsure/Arme ; Incarnation de Wyssan) —
   *  attaque ADDITIONNELLE injectée dans `c.weapons` par recomputeLoadout (même patron que Tentacule/
   *  Cornes), retirée à l'expiration. Dégâts SB-relatifs (« +BF+N ») et Atouts portés par l'arme. */
  naturalWeapon?: Weapon;
  /** Talent ACCORDÉ TEMPORAIREMENT par cet effet (op `grantTalent` à durée — Flambeau de Vertu : Sans
   *  peur…) : réf par `talentId` STABLE (+ `spec` éventuel), lu tant que l'effet dure par
   *  `combatFeatures/dispatch.featuresOf` (capacités de combat) et par `effectGrantedTalents` →
   *  `effectiveTalents` (POSSESSION : fiche, chips, `hasTalent`). JAMAIS posé dans `c.talents` :
   *  l'acquisition et l'avancement restent hors de portée d'un octroi qui expire. Un octroi SANS
   *  échéance ne passe pas par ici — il est structurel (`engine/ops.ts`, op `grantTalent`). Résolu en
   *  libellé concret (clé du registre) par `talentConcrete`. */
  grantedTalent?: { talentId: string; spec?: string };
  /** DURÉE d'un enchantement d'arme (op `augmentWeapon`) : l'enchant vit sur l'OBJET
   *  (`ItemInstance.enchants`, replié dans l'arme par `recomputeLoadout`) ; cet effet ne porte que sa
   *  durée + la réf de l'enchant à retirer à l'expiration (`dropExpiredGrantedWeapons`). Calqué sur
   *  `conjuredSet`. (L'arme invoquée n'en a pas : son objet est retiré en bloc.) */
  enchantRef?: { itemUid: string; enchantId: string };
  /** « Peut relancer le prochain Test auquel elle échoue » (Bénédiction de Chance, LDB 41) —
   *  consommé à l'usage au point de relance des flux de jet (engine/activeFlags). */
  freeReroll?: boolean;
  /** « Deux lancers, choisissez le meilleur » quand le PORTEUR inflige une Blessure Critique
   *  (Bénédiction de Sauvagerie, LDB 41) — lu par `resolveCritique` via l'attaquant. */
  critRollTwice?: boolean;
  /** « Ne subit aucune pénalité causée par les États » (Endurance de l'anachorète, LDB 42) —
   *  lu par combatTestPenalty/testStatePenalty. */
  ignoreStatePenalties?: boolean;
  /** N'ignore que les N PIRES pénalités d'État (op `ignoreStatePenalties{count}` — « Les dames de
   *  L'Anguille » : « peut ignorer un État », MDG 09 l.244). Lu par combatTestPenalty/testStatePenalty. */
  ignoreStatesCount?: number;
  /** +DR temporisés (ops `skillDRBonus`/`charDRBonus` exécutées — chansons de marin, MDG 09) : par
   *  Compétence (`skill`+`spec`) OU par Caractéristique (`char`), `bonus` déjà résolu numérique.
   *  Lus par `skillDRBonus`/`charDRBonusOf` (engine/ops) sur un Test RÉUSSI. */
  drBonus?: { skill?: string; spec?: string; char?: CharKey; bonus: number }[];
  /** Modificateur aux Tests INDIVIDUELS d'un Test d'équipage (op `crewTestMod` — « Naviguons tous
   *  ensemble », MDG 09 l.224 : +10). Lu par `crewRoleValue` (engine/crewMorale). */
  crewTestMod?: number;
  /** Détermination (LDB 17 l.59) : immunité PSYCHOLOGIQUE temporaire (la source est IGNORÉE, pas vaincue).
   *  Durée portée par `duration` (Rounds) → décrémentée/expirée par le système de Durée unifié. */
  psychImmune?: boolean;
  /** Détermination (LDB 17 l.60) : ignore les modificateurs de Blessure critique (traumatismes), 1 Round.
   *  Durée portée par `duration` → expirée par le système de Durée unifié (jamais un flag round-scopé). */
  ignoreCritMods?: boolean;
  /** Traits psychologiques SUSPENDUS par l'effet (Baume pour un esprit blessé, LDB 42 : « Tous les
   *  Traits Psychologiques sont retirés pour la durée ») — restitués à l'expiration (rounds OU horloge). */
  suppressedPsych?: import('./psychology').PsychTrait[];
  /** Aura « N'écoutez point la Sorcière » (LDB 42) : tout SORT (Langue (Magick)) ciblant quelqu'un
   *  à `radiusMeters` du porteur subit −20 au Test d'incantation. */
  castWard?: { radiusMeters: number };
  /** Le porteur SUFFOQUE (Noyade et Suffocation, LDB 18 l.346 — Ombres étrangleuses,
   *  Transmutation de Chamon) : −1 PB/Round, 0 PB → Inconscient, mort après BE Rounds. */
  suffocates?: boolean;
  /** « N'a pas besoin de respirer et ignore les règles de suffocation » (B. de Souffle, LDB 41). */
  noBreath?: boolean;
  /** « N'a pas besoin de manger ou de boire » (Graisse de la terre, LDB 48) : exempte de la Faim —
   *  `dailyFoodUpkeep` saute la consommation de ration et l'aggravation tant que l'effet dure. */
  noHunger?: boolean;
  /** Détermination : « ignorer les modificateurs négatifs de l'ivresse jusqu'à la fin du prochain
   *  Round » (LDB 09 l.487) — lu par `passiveMods` (les pénalités d'Ivresse ne sont pas émises). */
  drunkIgnore?: boolean;
  /** « Vous êtes mon meilleur ami ! » (Ivresse 3-4, LDB 09 l.480) : ignore Préjugés et Animosités
   *  existants tant que l'effet dure. */
  ignoreAnimosity?: boolean;
  /** Modificateur GLOBAL à TOUS les Tests du porteur (Malédiction de malchance : −10 ; bénédictions
   *  futures : +N) — STACKE par-dessus la pénalité d'État (≠ État, donc non soumis au non-cumul ni à
   *  `ignoreStatePenalties`). Lu par `combatTestPenalty`/`testStatePenalty` (engine/conditions). */
  testMod?: number;
  /** QUALIFIE `testMod` par Caractéristique (op `testMod{char}` exécutée — Mystracine « +10 aux Tests
   *  d'Endurance et de FM, −10 Ag/I/Int », LDB 71 l.33) : le mod ne s'applique qu'aux Tests de cette
   *  carac, lu par `testValue` (engine/skills) ; EXCLU des `testMod` GLOBAUX (`effectGlobalTestMod`). */
  testModChar?: CharKey;
  /** RESTREINT un `testModChar:'CC'` à l'arme tenue dans CETTE main (op `testMod.weaponHand`, #193 —
   *  Épaule luxée « Tests effectués avec ce bras », LDB 18/AA) : lu par `combatValue`/`defenseValue`
   *  (parade), jamais l'autre main. Absent = les deux mains (comportement historique). */
  testModHand?: 'main' | 'off';
  /** RESTREINT `testMod`/`testModChar` aux Tests classés « déplacement » (op `testMod.movementOnly`,
   *  #193 — Genou démis « Tests impliquant cette jambe », LDB 18/AA) — MÊME catégorie `SkillData.movement`
   *  que l'État À Terre/Empêtré (engine/conditions `isMovementSkill`). Lu par `testValue`/`defenseValue`
   *  (Esquive). Absent = tous les Tests de la carac visée. */
  testModMovementOnly?: boolean;
  /** Modif. d'ATTRIBUT SECONDAIRE posé par l'op `attrMod` exécutée (Bonnet de fou « +4 Blessures »,
   *  LDB 71 l.20) — résolu numérique à l'application. `wounds` lu par `effectiveMaxWounds` ;
   *  `fortune`/`resolve` par `fortuneMax`/`resolveMax` (talentEffects). */
  attrMods?: Partial<Record<'wounds' | 'fortune' | 'resolve', number>>;
  /** Bonus aux Tests LIÉS À UNE MALADIE (op `diseaseTestMod` — Fleur de lune +30 vs Peste noire,
   *  Tonique digestif +20…) : sommé par `activeDiseaseTestMod` (engine/disease) aux Tests de
   *  contraction/cycle quotidien/fin de maladie. `diseases` absent = toutes. */
  diseaseTestMod?: { diseases?: string[]; amount: number };
  /** SOURCE passive SUSPENDUE (identité Codex) : tout ce qu'elle émet est ignoré tant que l'effet dure
   *  — mécanisme général `engine/suspension.ts` (`sourceSuspended`/`suspendSource`), lu par le
   *  collecteur `passiveMods` et par les cycles de maladie (`symptomSuppressed`). Porteurs : op
   *  `suppressSymptom` (Racine de terre, LDB 72 l.28) et fenêtre de Détermination (LDB 17 l.61). */
  suppressedSource?: CodexTarget;
  /** RESTREINT la suspension ci-dessus au SEUL État nommé (#1695) : « Retirez un État » (LDB 17 l.61)
   *  n'écarte qu'UN pion, même quand la source en porte plusieurs (Transmutation de Chamon : Aveuglé,
   *  Assourdi, Sonné). Absent = la source entière est suspendue (Racine de terre, LDB 72 l.28). */
  suppressedCondition?: string;
  /** Symptôme ATTÉNUÉ d'un échelon (op `attenuateSymptom` — LDB 20 l.159, « pendant une journée ») :
   *  sa sévérité EFFECTIVE redescend tant que l'effet dure (`severiteEffective`), l'instance de
   *  symptôme n'est jamais mutée. Miroir de `suppressedSource`, nommé par instance de MALADIE. */
  attenuatedSymptom?: { disease: string; symptomId: string };
  /** GATE d'action par Round (op `actGate` — Racine de mandragore, LDB 71 l.35) : au début du tour du
   *  porteur en combat, un Test de `char` décide s'il garde Action ET Mouvement (réussite) ou UN seul
   *  au choix (échec). Résolu cadence-aware par `resolveActGates` (state/combatFlow). */
  actGate?: { char: CharKey };
  /** Immunité à l'EXPOSITION météo (froid/pluie/neige/tempête — Peau de loup d'hiver d'Ulric,
   *  Protection contre la pluie) : `exposureNight` est sauté tant que l'effet dure. */
  weatherImmune?: boolean;
  /** Bouclier anti-flèches (LDB 47 — L11) : les projectiles ORGANIQUES (flèches, carreaux,
   *  javelots) entrant dans la zone de `radiusMeters` autour du porteur sont détruits. */
  arrowWard?: { radiusMeters: number };
  /** Dôme (LDB 47 l.410) : quiconque dans la zone gagne le TRAIT `ward` contre les attaques magiques
   *  ou à distance provenant de l'EXTÉRIEUR du dôme. Le Trait et son Indice viennent de la DONNÉE du
   *  sort (op `domeWard`) — aucun seuil n'est écrit dans le code. */
  domeWard?: { radiusMeters: number; ward: import('./statEntry').TraitInstance };
  /** Bénédiction de Protection (LDB 41 — L13) : « Les ennemis doivent effectuer un Test de FM
   *  Accessible (+20) pour attaquer votre cible. Sur un échec, ils doivent choisir une cible ou
   *  une Action différente. » — Test joué à la DÉCLARATION d'attaque (rien n'est consommé). */
  attackWardFM?: boolean;
  /** Martyr (LDB 42 — L13) : « Vous recevez tous les Dégâts subis en principe par vos cibles »
   *  — id du PRÊTRE qui encaisse à la place du porteur (BE doublé pour ces Dégâts). */
  martyrGuard?: string;
  /** Points de Chance ACCORDÉS temporairement par un Sort (op `gainResource` — Signes d'Amul,
   *  Maître du Destin) : les points NON dépensés sont retirés à l'expiration de l'effet (rounds OU
   *  horloge), via `dropExpiredGrantedResources` (engine/grantedResources). */
  grantedFortune?: number;
  /** Points de Destin ACCORDÉS temporairement par un Sort (op `gainResource` — Troisième Signe d'Amul) :
   *  retirés à l'expiration s'ils n'ont pas été dépensés (cf. `grantedFortune`). */
  grantedFate?: number;
  /** Lumière émise par un SORT pendant sa durée (op `light` — Lumière, LDB 241) : `radiusM` = le rayon
   *  en MÈTRES, recopié de l'op, lu par `combatantLights` (vision) au MÊME point que la lumière d'un
   *  objet porté — c'est là qu'il devient des cases (`rayonEnCases`). `tone` (#1245, L4) : id
   *  d'un `lightTones`, APPARENCE seule, recopié de l'op et résolu au bord du rendu ; absent = `flamme`. */
  light?: { radiusM: number; tone?: string };
}

/** Traumatisme (LDB 18-Traumatisme) — conséquence persistante d'une Blessure critique ou d'une
 *  Maladresse. Seuls les effets EN-COMBAT quantifiés sont modélisés (movementHalved, charPenalty) ;
 *  le reste (−10 Tests de Localisation, membre inutilisable, amputation, guérison) est journalisé
 *  dans `note` (→ Jalon 5). Persisté entre combats (cf. engine/persistence.ts). */
export interface Trauma {
  label: string;
  /** id STABLE d'une séquelle SYNTHÉTIQUE agrégée que le moteur reconnaît par identité
   *  (Dents perdues → 'dents-perdues', Cécité → 'cecite', Surdité → 'surdite') — ≠ libellé d'affichage.
   *  Posé par `consolidateAmputations` pour la déduplication langue-indépendante. */
  traumaId?: string;
  location: HitLocation;
  /** Effets PASSIFS de la séquelle — vocabulaire PARTAGÉ `GameOp`. Lus EN DIRECT par les helpers de
   *  trauma (`traumaCharPenalties`/`traumaSkillPenalty`/`traumaDodgePenalty`/`traumaMovementHalved`/
   *  `cannotWieldTwoHanded`) avec annulation par prothèse : `charMod` (carac), `skillMod` (Esquive,
   *  Langue/Chevaucher/Perception…), `moveScale` (Mouvement), `maxWeaponHands` (mains d'arme),
   *  `senseLoss` (sens perdu). Éditables dans le Codex (GameOpEditor). */
  ops?: import('./ops').GameOp[];
  /** Texte canon LDB 18 VERBATIM (DISPLAY-ONLY) — jamais parsé pour de la mécanique (≠ `ops`). Provient
   *  de la fiche `traumas.json` ou d'une séquelle synthétique (fracture mal ressoudée). */
  desc?: string;
  /** Jours de convalescence restants (LDB 18 : déchirure 30−BE, fracture 30+1d10…). Décompté au repos ;
   *  à 0 le trauma (et ses pénalités) disparaît. Absent = trauma legacy/permanent (pas de décompte). */
  recoveryDays?: number;
  /** Durée totale de convalescence (à la création) — seuils : mi-durée d'une déchirure majeure (downgrade
   *  −20→−10, l.231), fenêtre de pose d'une semaine d'une fracture (l.204). */
  recoveryTotal?: number;
  /** Type / sévérité, pour la convalescence à étapes (déchirure : Guérison accélère ; fracture : Test de fin). */
  kind?: 'dechirure' | 'fracture';
  severity?: 'mineur' | 'majeur';
  /** La Compétence Guérison a déjà été EMPLOYÉE sur ce trauma — succès (l.222 : −1 j −1/DR, une
   *  seule fois) comme échec : le jet est consommé, on ne relance pas jusqu'au succès. */
  healAccelerated?: boolean;
  /** Fracture « réduite » : bandée par un Test de Guérison dans la semaine (l.204) → pas de Test de Résistance de fin. */
  fractureSet?: boolean;
  /** Trauma exigeant de la CHIRURGIE pour guérir (amputation, fracture majeure « fort peu probable qu'il se soigne correctement sans
   *  intervention médicale », LDB 18 l.208/239) — traité par le Talent Chirurgie, pas par le simple repos. */
  needsSurgery?: boolean;
  /** Prothèses (LDB 73) qui annulent la séquelle permanente d'une amputation TANT QUE l'objet est porté
   *  (dans `items`). Réf par `trappingId` STABLE (`crochet`/`fausse-jambe`/`merveille-d-ingenierie`/
   *  `nez-dore`/`cache-oeil`/`oeil-de-verre`/`dents-en-bois`) — matchée contre `ItemInstance.trappingId`.
   *  `cancels: 'all'` annule toute la pénalité (Merveille d'ingénierie : « ignorer complètement la
   *  perte… d'une jambe » ; Nez doré ; Œil de verre…) ; `'movement'` rétablit le déplacement seul
   *  (Fausse jambe : « ignorer 1 Point de Mouvement perdu »). L'Esquive se réapprend SÉPARÉMENT pour 200 PX
   *  (LDB 73) : `ItemInstance.prosthesisTrained` (posé par `trainProsthesis`, state/partyFlow.ts) élève l'effet
   *  de CETTE prothèse à `'all'` pour `prosthesisCancels` (trauma.ts), sans changer `cancels` en donnée. */
  prosthesis?: { trappingId: string; cancels: 'all' | 'movement' }[];
  /** Nombre d'éléments perdus pour une séquelle CUMULATIVE par comptage (LDB 18) : doigts (−5/doigt, 4+ →
   *  règle de la main, l.251/263) ou dents (−1 Soc/paire, l.247). Fusionné à chaque nouvelle perte. */
  count?: number;
  /** En attente d'Aide Médicale (LDB 18 l.307-312 : Guérison réussie / bandage-cataplasme / sort-prière de
   *  soin) — levé par le PREMIER acte de soin des 3 formes (`receiveMedicalAid`). Tant qu'il est posé, la
   *  séquelle S'AGGRAVE : escalade « 1 doigt de plus par Round » de « Main ouverte » (AA 07 l.127 / LDB). */
  awaitingMedicalAid?: boolean;
  /** Escalade PÉRIODIQUE de la plaie (« Main ouverte », AA 07 l.127 / LDB) : à chaque fin de Round de combat
   *  SANS Aide Médicale (`awaitingMedicalAid`), `unites` unité(s) de la séquelle `versTraumaId` sont ajoutées
   *  (`tickTraumaEscalation`). Elle s'éteint quand le cumul de cette séquelle a franchi SON seuil d'escalade. */
  perRound?: { versTraumaId: string; unites?: number };
  /** « Pied écrasé » (AA 07 l.180 / LDB) : jours restants avant la perte définitive du membre (`amputateSequel`)
   *  si la Chirurgie de la plaie (`needsSurgery`) n'intervient pas à temps (1d10 jours). Décompté à l'entretien
   *  (`tickTraumaRecovery`) ; l'opération réussie retire la plaie AVANT l'échéance → membre sauvé. */
  amputateAfterDays?: number;
  /** id STABLE de la fiche de séquelle (`traumas.json`) posée si `amputateAfterDays` expire sans Chirurgie. */
  amputateSequel?: string;
  /** « Épaule luxée » (AA 07 l.125 / LDB 18 l.120) / « Genou démis » (AA 07 l.179 / LDB 18 l.179) : membre DÉSACTIVÉ
   *  (les `ops` passives — bras `maxWeaponHands:1` / jambe `moveScale` — tiennent tant que la séquelle vit).
   *  Après Aide Médicale (`awaitingMedicalAid` levé), un Test ÉTENDU de Guérison Accessible (+20) de
   *  `restoreDR` DR (acte « Guérison » de l'Infirmerie, `medicFlow`) rend l'usage : la séquelle est retirée et
   *  `recoveryPenalty` posé à la cible (durée d'horloge partagée = 1d10 jours). */
  restoreDR?: number;
  /** Ops posées à la cible quand `restoreDR` est atteint (charMod −10 / `moveScale` jambe) — appliquées avec
   *  une durée d'horloge partagée (1d10 jours) par l'acte « Guérison » (`medicFlow`). */
  recoveryPenalty?: import('./ops').GameOp[];
  /** « Réouverture » (LDB 18 l.101/118/143/145/148/175 ; AA 07 l.119/147/149/152/175) : plaie non recousue.
   *  Chaque nouveau Dégât à la MÊME `location` octroie `bleedOnReinjury` État Hémorragique (`reinjuryBleed`,
   *  au point d'application des Dégâts localisés). Séquelle chirurgicale (`needsSurgery`) : la Chirurgie la retire. */
  bleedOnReinjury?: number;
  /** Déclencheur d'escalade posé par un critique (« Commotion cérébrale », LDB 18 l.74) : tant que le
   *  personnage porte l'État `whileCondition`, tout critique SUBSÉQUENT à `location` (ou toute Localisation si
   *  absente) impose le nœud `test` de sauvegarde (la branche empruntée porte ses ops). Stampé par
   *  `stampCriticalEscalation`, lu par `fireCritTriggers` au point unique de résolution des critiques. */
  critTrigger?: { location?: HitLocation; whileCondition: string; test: import('../data/criticals').CritTestNode };
  /** Amputation DIFFÉRÉE à la fin de la rencontre (LDB 18, « Coupure à l'orteil » l.171 : « Une fois la
   *  rencontre terminée… ») : le/les Test(s) FABRIQUÉS par `resolveCritique` pour un
   *  `amputation.timing === 'postEncounter'`, ENJEU POSÉ — ARMÉS ici (même patron de nœud persisté que
   *  `critTrigger`), CONSOMMÉS par `prendreAmputationsDifferees` au foyer de fin de combat et ouverts par
   *  la porte canonique (`routeTriggeredTest`). Le moteur ne les roule jamais. */
  pendingAmputation?: import('./flowCore').Flow;
  /** Séquelle POST-guérison (LDB 18 l.61/72 : « Une fois que la blessure est guérie… ») : marqueur de la
   *  Blessure critique EN COURS DE GUÉRISON. Le critique est GUÉRI quand tous les États `whenClear` sont
   *  retirés (LDB 18 « Guérir les Blessures critiques » : « pas guéries tant que tous les États associés
   *  n'ont pas été retirés ») → `settleHealedCriticals` retire ce marqueur, décompte la Blessure critique et
   *  octroie la cicatrice `scar` (fiche `traumas.json`). Stampé par `stampCriticalEscalation`. */
  onHealGrant?: { scar: string; whenClear: string[] };
  /** Séquelle COSMÉTIQUE (cicatrice) : sequelle permanente qui n'EST PAS une Blessure critique comptée — la
   *  Blessure d'origine est déjà guérie (`criticalWounds` décompté à l'octroi). La Chirurgie qui la retire
   *  (`needsSurgery`, nez cassé LDB 18 l.72) ne re-décompte donc AUCUNE Blessure critique. */
  cosmetic?: boolean;
  /** Surcharge du `kind` passif de la séquelle (défaut : dérivé du type d'op par `traumaOpKind`). Une cicatrice
   *  est un TRAIT DE CORPS permanent (`intrinseque` : additif, non annulable) et non une douleur — c'est ce qui
   *  fait sommer son `skillMod` social (+/−) par `passiveSkillSum`, hors du pool non-cumul des pénalités de crit. */
  passiveKind?: import('./ops').PassiveKind;
}

export type ItemKind = 'melee' | 'ranged' | 'armor' | 'ammo' | 'misc';

/** Instance d'objet portée par un personnage (dérivée d'un trapping à stats). */
export interface ItemInstance {
  uid: string;
  // ── ÉTAT DE CHARGE de CET objet-arme : chaque arme à distance possédée gère son propre
  // rechargement et sa propre munition (arbitrage utilisateur 2026-08-16 : « si j ai 2 armes à distance
  // elles gèrent chacune leur propre rechargement et munition ») —
  // l'OBJET possédé est le porteur qui SURVIT au re-dérivage du set actif (`recomputeLoadout`
  // reconstruit les `Weapon`, jamais les items) — changer de set ne téléporte donc aucun coup
  // chargé. Registre résolu par `loadRegister` (engine/weaponLoad) ; seuls
  // `loadWeapon`/`unloadWeapon` (engine/items) posent et effacent.
  /** Munition CHOISIE pour le prochain chargement de CETTE arme (uid d'un ItemInstance `kind 'ammo'`). */
  ammoUid?: string;
  /** Munition CAPTURÉE dans le coup chargé de CETTE arme : posée au chargement, consommée au tir. */
  loadedAmmoUid?: string;
  /** CETTE arme est-elle chargée ? (Recharge 0 : toujours ; Recharge N : faux après un tir.) */
  loaded?: boolean;
  /** DR cumulés du Test étendu de Projectiles de CETTE arme vers son Indice `reload` (LDB 62 l.335). */
  reloadProgress?: number;
  /** À répétition (Indice) (LDB 62 l.229/231) : munitions restantes dans le chargeur de CETTE arme. */
  chambered?: number;
  /** `id` du trapping de catalogue dont l'objet dérive (`TrappingData.id`) — réf STABLE posée par
   *  `itemFromTrappingById`. ABSENT = objet CUSTOM (hors-base : `customTrapping`, pièces de monstre…).
   *  Source de re-dérivation (arme dérivée de prothèse, prix de revente, réparation) — ≠ name-match. */
  trappingId?: string;
  /** Spécialisation de CETTE possession, telle que le livre l'imprime entre parenthèses — `LDB 08`
   *  l.1130 « outils de la profession (Maréchal-ferrant) ». DONNÉE, pas affichage : elle vit sur
   *  l'OBJET parce que deux « Outils professionnels » du même sac doivent rester DISCERNABLES (le
   *  catalogue, lui, ne connaît que « Outils professionnels »). Posée par `itemFromTrappingRef`
   *  depuis la `TrappingRef` résolue ; rendue par `itemLabel` via `refLabel`. */
  spec?: string;
  label: string;
  kind: ItemKind;
  damage?: WeaponDamageSpec; // armes
  /** Allonge de MÊLÉE — cf. `Weapon.reach` (même vocabulaire `ReachValue`, même lecture de rang). */
  reach?: ReachValue | null;
  range?: WeaponRangeSpec | null; // SPEC de Portée non résolue (mètres fixes ou {bf}) — cf. WeaponRangeSpec
  /** MUNITION : modificateur de la Portée de l'arme de tir (cf. `AmmoRangeMod`) — lu par `effectiveWeaponRange`
   *  quand cette munition est sélectionnée. Copié du trapping ; absent sur une arme/objet non-munition. */
  ammoRangeMod?: AmmoRangeMod | null;
  qualities: QualityInstance[];
  /** Enchantements actifs portés par l'ARME (op `augmentWeapon` / arme invoquée) — SOURCE DE VÉRITÉ,
   *  repliés dans l'arme dérivée par `recomputeLoadout` (`applyEnchants`). Temporisés via `ActiveEffect.enchantRef`. */
  enchants?: WeaponEnchant[];
  /** Pièce d'artillerie MONTÉE sur un navire : côté de montage (FireArc) — propagé à `Weapon.mountSide`
   *  par `recomputeLoadout` (restreint l'arc de tir). Posé au spawn depuis le poste (`ShipPoste.side`). */
  mountSide?: FireArc;
  pa?: number; // armures : Points d'Armure
  locs?: HitLocation[]; // armures : localisations couvertes
  enc: number; // encombrement
  /** Monnaie PERSONNELLE portée par cette instance (LDB 05/61 — la Bourse, `trappingId==='bourse'`) :
   *  la bourse de groupe devient une bourse PAR HÉROS (SOCLE POSSESSIONS §8, #531). Absent sur tout
   *  objet non-bourse. Compte de pièces (pas la valeur en sous) : `totalEncumbrance` en dérive l'Enc
   *  (1 Enc / 200 pièces, LDB 61 l.29). Manipulé par les primitives `state/bourseFlow.ts`. */
  money?: import('./money').Money;
  /** Taille PRÉVUE pour l'objet (ADE II 2 l.706-710 : « la version ogre de la plupart des possessions
   *  vaut deux fois l'Encombrement classique ») — copiée du catalogue (`TrappingData.sizeFor`), propagée
   *  à `Weapon.sizeFor`. Absent = taille Moyenne (le standard implicite, `effectiveSize`). Plus grande que
   *  Moyenne → Enc effectif ×2 (`totalEncumbrance`) ; manié/porté par un combattant d'une AUTRE taille →
   *  −20 à tous les Tests avec cet objet (l.710, `attackModifiers`). */
  sizeFor?: import('./size').SizeCategory;
  equipped: boolean;
  desc?: string;
  /** Effet d'un CONSOMMABLE (potion/drogue/bandage) en **Flow** (noyau `engine/flowCore`, feuilles
   *  EffectOp) — copié du trapping (`TrappingData.consumable`). Un Test « au boire » (Brise-cœur,
   *  Belladone…) est un nœud `{kind:'test'}` du Flow, résolu cadence-aware par le runner state
   *  (`runConsumable`) — jamais un jet silencieux. `isConsumable` = Flow non vide. */
  consumable?: import('./flowCore').Flow;
  /** Durée d'HORLOGE des effets durables du consommable (LDB 71/72 « Durée : … ») — copiée du trapping,
   *  résolue AU BOIRE (`consumableUntilTime`) → `ctx.defaultUntilTime` des ops appliquées. */
  consumableDuration?: import('./consumables').ConsumableDuration;
  /** `id` du Groupe/famille (`WeaponGroupData.id`) — munition : famille compatible (arc/arbalete/
   *  poudre-noire) ; armure : type (plate/mailles/cuir-souple…). Correspond à `Weapon.subType`. */
  subType?: string;
  /** Groupe de Projectiles d'une arme de siège (cf. `Weapon.weaponGroup`) — propagé à l'arme dérivée. */
  weaponGroup?: string;
  /** Munition REPRÉSENTATIVE d'une arme de siège (cf. `Weapon.defaultAmmo`) — propagé à l'arme dérivée. */
  defaultAmmo?: string;
  /** Pièce « relativement simple » (baliste, cf. `Weapon.soloSimple`) — propagé à l'arme dérivée. */
  soloSimple?: boolean;
  /** Pièce à TIR INDIRECT (mortier/catapulte, cf. `Weapon.indirect`) — propagé à l'arme dérivée. */
  indirect?: boolean;
  /** LDB 62 l.278 — approximation MAISON, propagé à l'arme dérivée (cf. `Weapon.bladed`). */
  bladed?: boolean;
  /** LDB 47 — approximation MAISON, propagé à l'arme dérivée (cf. `Weapon.organicProjectile`). */
  organicProjectile?: boolean;
  /** Effets « à la touche » portés en DONNÉE par le catalogue (`TrappingData.onHitEffects`) — propagés à
   *  l'arme dérivée (`Weapon.onHitEffects`). Ex. Canon à flammes nain (ADE II 8 l.243). */
  onHitEffects?: import('./flowCore').TriggeredEffect[];
  /** PORTÉE MINIMALE de tir (bande, cf. `Weapon.minRangeBand`) — propagée à l'arme dérivée. Machines de
   *  siège à distance (ADE II 8 l.251/253). */
  minRangeBand?: RangeBandId;
  /** Slug de FORME (`WeaponDef`/`ShieldDef.slug`) — id STABLE de routage de l'art (rig), ≠ libellé.
   *  Copié du catalogue (`TrappingData.shape`) par `itemFromTrappingById` ; propagé à `Weapon.shape`. */
  shape?: string;
  /** Nombre de mains requises (1 ou 2), posé à la création par itemFromTrapping (marqueur `(2M)`). */
  hands?: 1 | 2;
  /** Quantité (paquet de munitions, ex. « (12) » → 12). */
  qty?: number;
  /** Arme INHABITUELLE (ACE 12 l.17-21) : exige la maîtrise (`Combatant.masteredWeapons`) pour
   *  être maniée avec la Compétence du Groupe — copié du catalogue (`TrappingData.requiresMastery`). */
  requiresMastery?: boolean;
  /** Dégâts subis par l'arme (LDB 62 l.135), persistés sur le trapping ; propagé au Weapon actif. */
  damageTaken?: number;
  /** Arme détruite (Incident de Tir) : non équipable. */
  destroyed?: boolean;
  /** Réserve de NI d'énergie magique RESTANTE sur CET objet (`VDM 02 l.165` : « garder une trace du
   *  nombre de NI qu'un morceau de malepierre peut apporter avant qu'il ne soit entièrement consommé »).
   *  Grandeur INDÉPENDANTE de `qty` (nombre d'exemplaires) — jamais confondue avec un compte d'objets.
   *  ABSENT tant que la réserve reste INTACTE (`itemFromTrappingById` ne l'initialise
   *  PAS ; lue à défaut sur `TrappingData.niPerGram` du catalogue, `engine/magic.ts:malepierreReserveOf`) ;
   *  décrémentée AU CONFIRM par `consumeMalepierre` (`engine/magic.ts`, seul point d'ÉCRITURE du
   *  delta — jamais au Test lui-même). Absent = objet sans réserve entamée (tout objet hors malepierre,
   *  ou malepierre encore à sa réserve pleine).
   */
  niReserve?: number;
  /** SKIN cosmétique (objet unique/légendaire) : override de palette token→hex, propagé au
   *  `Weapon.skin` actif par `recomputeLoadout` → l'arme se rend recolorée. */
  skin?: Record<string, string>;
  /** Objet NON identifié (objet magique/légendaire trouvé) : ses qualités sont MASQUÉES à l'affichage
   *  (elles restent ACTIVES mécaniquement) tant qu'une Évaluation ne l'a pas révélé. Absent/true = identifié. */
  identified?: boolean;
  /** Aura magique DÉTECTÉE (Talent Détection d'artefact, LDB 10 l.336 : « vous sentez que
   *  l'objet est magique ») — s'affiche « magique » même tant que ses règles restent non identifiées. */
  magicKnown?: boolean;
  /** Détection d'artefact déjà tentée sur cet objet (LDB 10 l.336 : « En principe, vous ne pouvez
   *  tenter ce Test qu'une seule fois par artefact touché »). */
  detectTried?: boolean;
  /** Jour de jeu de la dernière Évaluation RATÉE : pas de re-tentative le même jour (anti-spam —
   *  LDB 12 l.94 : seul un résultat marginal offre un nouvel essai ; ADE II : re-tenter coûte du temps). */
  appraiseTriedDay?: number;
  /** FAUSSES Particularités soupçonnées (ADE II 4 : échec Impressionnant/Stupéfiant de
   *  l'identification — « soupçonne que l'objet possède une Particularité qu'il n'a pas
   *  réellement »). Affichées « soupçonné : … » tant que l'objet n'est pas identifié ; purgées
   *  par une vraie révélation. AUCUN effet mécanique. */
  suspectedQualities?: string[];
  /** Prothèse ENTRAÎNÉE par dépense de PX (LDB 73) : une Fausse jambe « réapprise » (200 PX, second palier
   *  après `prosthesisMoveTrained`) annule AUSSI l'Esquive (sa séquelle passe de `'movement'` à `'all'`),
   *  pas seulement le déplacement. */
  prosthesisTrained?: boolean;
  /** Fausse jambe entraînée au MOUVEMENT (100 PX, LDB 73 : « pour 100 PX, vous pouvez récupérer le dernier
   *  Point de Mouvement perdu ») — premier palier, lève le ÷2 de la séquelle de jambe (`prosthesisCancels`,
   *  trauma.ts) SANS lever l'Esquive (second palier, `prosthesisTrained`). Le simple PORT (gratuit, sans
   *  aucun des deux paliers) n'ignore que 1 PM, restauré POST-halving par `effectiveMovement`. */
  prosthesisMoveTrained?: boolean;
  /** Points de pénalité RACHETÉS sur cette prothèse par les paliers gradués déjà achetés (LDB 73 l.19,
   *  Crochet : « 100 PX pour chaque tranche de 5, soustraite de la pénalité ») — cumul des `reduces`
   *  des paliers acquis (`TrappingData.prosthesisTraining`), lu par `amputationCombatPenalty`. */
  prosthesisReduced?: number;
  /** Arme INVOQUÉE temporaire (op `grantWeapon`) : objet ordinaire mais TENU d'office (injecté en
   *  tête de `c.weapons` par recomputeLoadout) et retiré à l'expiration du Sort. */
  conjured?: boolean;
  /** Silhouette de RENDU forcée (libellé d'arme du catalogue) — propagée à `Weapon.form`. */
  form?: string;
  /** Valeur de marché PRÉ-CALCULÉE (butin récolté : pièces de monstre, Précieuses Entrailles ZI) —
   *  rareté × dangerosité × Taille × Conservation déjà nettes. Revendu en DIRECT (sans le taux de
   *  revente catalogue), cf. `merchantFlow.sellGain`. Absent pour un objet ordinaire (prix = catalogue). */
  price?: import('./money').Money;
  // Les capacités FONCTIONNELLES de catégorie (weatherProtection/isShelter/isRations/isGrimoire/
  // preventForcedDrop) ne sont PAS propagées sur l'instance : elles sont lues DEPUIS le catalogue par
  // `trappingId` (canal `TrappingData.capabilities`), via `engine/capabilities` — comme `passive`.
  /** Contenant (sac/sac à dos, LDB 64) : capacité de rangement en Enc (« Contenu »). Propagé de TrappingData.container. */
  container?: { capacity: number };
  /** Rangé DANS un contenant (uid de l'ItemInstance porteur d'un `container`) : son Enc est absorbé par le
   *  contenant (LDB 64 l.5) → ne compte pas au total porté. Absent = en vrac / porté / tenu. */
  inside?: string;
  /** Entité SOURCE de cet objet (sort, talent, trait, objet, maladie…) — ancrage de règle GÉNÉRAL,
   *  au-delà du seul cas des sorts (`sourceSpellId`). Absent = source non propagée par le déclencheur :
   *  la pastille s'affiche alors nue (cf. `chipCodex`), régime RÉSIDUEL gardé par
   *  `src/engine/effect-rule-anchor.test.ts`. */
  source?: EffectSource;
}

/** Niveau de COUVERT gradué d'un poste de pont (Sabord/Plat-bord/Murs blindés) — les classes de couvert
 *  du combat AU-DESSUS de `none` : `moyenne` (−20, tir Difficile, Plat-bord) < `totale` (−30, tir Très
 *  Difficile, Sabord/Murs blindés). L'inclusion `DeckCoverClass ⊂ CoverClass` est STRUCTURELLE (ci-dessous). */
export type DeckCoverClass = 'imparfaite' | 'moyenne' | 'totale';

/** Classe de COUVERT d'une cible de tir — les trois étalons que la table de difficulté du combat imprime
 *  (`LDB 14 l.72/81/86`) plus l'absence de couvert. Barème et fusion : `engine/cover.ts`. */
export type CoverClass = 'none' | DeckCoverClass;

/** Pièce d'artillerie MONTÉE — forme AUTHORÉE/STOCKÉE (donnée de scène, #222). La base (Dégâts/Qualités/Enc/
 *  Portée…) n'est PLUS matérialisée : elle est HYDRATÉE au spawn depuis `trappingId` par `hydratePoste`
 *  (`itemFromTrappingById`/`buildWeapon`, coutures UNIQUES). Ne persiste QUE la réf catalogue + l'état propre
 *  au poste (uid, côté, équipage, recharge, munitions, dérogations). L'ancienne forme (`item` complet) est
 *  MIGRÉE au spawn (`item?` toléré en entrée d'hydratation, extrait `item.trappingId`). */
export interface AuthoredShipPoste {
  /** Réf catalogue de la pièce (SOURCE de la base — hydratée en `item` au spawn). Requise en forme neuve ;
   *  absente en forme ANCIENNE (dérivée de `item.trappingId` à la migration). */
  trappingId?: string;
  /** ANCIENNE forme (pré-#222) : l'arme copiée en entier. Jamais authorée en neuf ; MIGRÉE par `hydratePoste`
   *  (extrait `trappingId`/`uid`/`enchants`/usure, jette la base copiée). Absente en forme neuve. */
  item?: ItemInstance;
  /** uid d'instance STABLE (liens hotbar/log/persistance) ; généré à l'hydratation si absent. */
  uid?: string;
  /** Dérogations d'INSTANCE : enchants ajoutés à CETTE pièce (magie/qualité hors catalogue), repliés sur
   *  l'arme dérivée par `mannedPosteWeapon` (`applyEnchants`). Hors base catalogue → persistés à part. */
  enchants?: WeaponEnchant[];
  /** Côté de montage relatif au cap → arc de tir (`inFireArc`). NAVAL : toujours authoré (bordée).
   *  EMPLACEMENT AU SOL (siège) : ABSENT = pivot libre (tir omni, aucune contrainte d'arc) ; présent =
   *  arc relatif à l'orientation-monde DU CHEF de pièce (pas d'une coque). */
  side?: FireArc;
  /** COUVERT du servant à ce poste (`DeckCoverClass`) : gun-port (Sabord) → `totale`, Plat-bord → `moyenne`,
   *  Murs blindés → `totale` ; absent = tir depuis le pont, à découvert. Stampé par `effectiveDeckPostes`
   *  depuis les Améliorations de la coque (ou authoré pour un poste structurellement couvert). */
  cover?: DeckCoverClass;
  /** Équipage servant la pièce ; `crewIds[0]` = chef de pièce (nominé pour le Test, Arme d'équipe). */
  crewIds?: string[];
  /** À répétition (Indice) (LDB 62 l.229/231) / Salve : munitions restantes dans le chargeur de LA PIÈCE
   *  — même cycle que toute arme (elle remplit et vide son chargeur), écrit par `loadWeapon`/
   *  `spendChamberedRound`/`unloadWeapon`. Absent = pas de chargeur, ou chargeur vide. */
  chambered?: number;
  /** Recharge (MDG 12 / LDB 62 l.333) — Test ÉTENDU de Projectiles, PAS d'auto-rechargement passif.
   *  `loaded === false` = la pièce a tiré et reste muette tant que l'équipage n'a pas complété le Test
   *  (absent / `true` = prête à tirer). */
  loaded?: boolean;
  /** DR cumulés du Test étendu de recharge (vers `reloadDRTarget` = Recharge N, ×2 si sous-effectif).
   *  Remis à 0 si la recharge est INTERROMPUE (servants réassignés avant la fin, LDB 62 l.335). */
  reloadProgress?: number;
  /** STOCK DE MUNITIONS du poste (MDG 12 l.410-424, « Munitions pour pièces d'artillerie ») — le coffre
   *  à boulets DE LA PIÈCE (boulet/mitraille pour un canon, carreau pour une baliste, bombe pour un
   *  mortier…), des `ItemInstance` `kind:'ammo'` avec leur `qty`. AUTHORÉ avec le poste et PERSISTANT
   *  (la coque vit dans la scène/sauvegarde). Fondu au pool du chef par `compatibleAmmo` (source unique) ;
   *  consommé au tir (individuel comme bordée). */
  ammo?: ItemInstance[];
  /** Munition SÉLECTIONNÉE du poste (uid dans `ammo` — « boulet ou mitraille ? ») : le choix PERSISTANT de
   *  la pièce (fiche du navire), sous le choix ponctuel du héros-chef (`Combatant.ammoUid`, hotbar). */
  ammoUid?: string;
  /** Munition CAPTURÉE dans le coup chargé de la pièce (uid dans `ammo`) : posée à l'achèvement du Test
   *  étendu de recharge, consommée au tir. La munition se fixe AU CHARGEMENT : changer la sélection
   *  d'une pièce chargée la DÉCHARGE (arbitrage utilisateur 2026-08-16, AskUserQuestion). */
  loadedAmmoUid?: string;
  /** Ancre spatiale optionnelle de la pièce dans l'espace de la scène (authorable). Absente → dérivée
   *  (emplacement au sol = pos de l'entité ; coque = empreinte décalée par l'arc). Index-only, aucun effet combat. */
  anchor?: { x: number; y: number; z?: number };
}

/** Pièce d'artillerie MONTÉE — forme VIVANTE (runtime, sur le Combattant-coque). Étend `AuthoredShipPoste`
 *  avec l'arme HYDRATÉE (`item`, base résolue de `trappingId` au spawn par `hydratePoste`). Au spawn, le chef
 *  de pièce (`crewIds[0]`) la SERT via `Combatant.mannedPoste`. La LOGIQUE (arc, placement, support) vit en
 *  `state/shipPostes.ts` ; ce TYPE pur vit ici pour que `Combatant` le porte sans dépendance engine→state. */
export interface ShipPoste extends Omit<AuthoredShipPoste, 'item'> {
  /** L'arme HYDRATÉE (instance complète — base via `trappingId` + `qualities`/`enchants` propres). Jamais
   *  persistée : re-résolue à chaque spawn depuis la réf, cf. `hydratePoste`. */
  item: ItemInstance;
}

/** Emplacement de POSTE sur un gabarit de pont (`ShipDeck`) — un MOUNT POINT authoré (pos + arc), PAS une
 *  contrainte de règle : le placement des pièces reste LIBRE (par bord + poids vs Contenance, cf.
 *  `state/shipPostes.ts`). Sert au RENDU / à l'aide d'authoring (où dessiner une pièce montée sur ce bord,
 *  où poster son servant), réutilisé tel quel à la composition du Pont à l'abordage. */
export interface DeckPosteSlot {
  /** Case du pont (coord de la grille `ascii`) où la pièce se rend et où se tient son servant. */
  pos: { x: number; y: number };
  /** Côté de montage relatif au cap → arc de bordée (`inFireArc`). */
  side: FireArc;
  /** COUVERT de l'emplacement (`DeckCoverClass`) — gun-port authoré (`totale`) ou stampé par les Améliorations
   *  de la coque via `effectiveDeckPostes` ; absent = tir depuis le pont, à découvert. */
  cover?: DeckCoverClass;
}

/** Facette PONT (couche tactique, §1bis du modèle naval) : le plan PERSON-SCALE du pont d'un TYPE de navire,
 *  AUTHORÉ une seule fois et réutilisé tel quel dans tout scénario (jamais redessiné). À l'abordage, le pont
 *  est instancié + cousu depuis ce gabarit. Le plan suit `parseWalledAscii` (authoring canon du projet :
 *  tuiles + murs d'arête, `:` = écoutille) ; les `postes` sont des emplacements de RENDU (cf. `DeckPosteSlot`).
 *  TYPE PUR (engine) — seul `postes` est lu à ce jour (`state/shipPostes.ts`) ; le plan `ascii` est du gabarit
 *  authorable, sans lecteur de production depuis #1789. */
export interface ShipDeck {
  /** Plan du pont en box-drawing → tuiles + murs via `parseWalledAscii` ; la tuile de base est celle du
   *  défaut de compilation (`defauts-de-compilation.json › pont`). */
  ascii: string[];
  /** Emplacements de postes d'artillerie (mount points authorés PAR TYPE — généralisent `AuthoredEnemy.postes`). */
  postes?: DeckPosteSlot[];
}

/** Set d'armes nommé (les 2 mains). `off` ignoré si l'arme `main` est à 2 mains. uids → ItemInstance. */
export interface WeaponLoadout {
  id: string;
  main?: string;
  off?: string;
}

/** Les trois zones ADRESSABLES de la console, nommées par leur FONCTION : la donnée du porteur ne
 *  dépend d'aucune mise en page (arsenal = les gestes de son set, accès rapide = son nécessaire,
 *  capacités = son grimoire posé). */
export type ZoneBarre = 'arsenal' | 'accesRapide' | 'capacites';

/** UNE case posée : l'action du registre (`src/data/actions.json`) et la CLÉ DÉCLARÉE de la case,
 *  qui distingue les N alvéoles d'une même action (`sort-<spellId>`, `advantage-<skillId>`,
 *  `q-objet-<trappingId>`, `attaque-<attackId>`, `self-<maneuverId>`, ou `ActionDef.keys[0]`).
 *  Cette clé est une identité de MODÈLE, déclarée au site de la case — jamais un uid d'INSTANCE
 *  (boire une potion changerait l'uid et tuerait l'adresse), jamais un libellé. */
export interface EntreeBarre {
  actionId: string;
  cle: string;
}

/** CE QUE LE PORTEUR A POSÉ sur les cases de sa console, PAR ADRESSE : une `EntreeBarre` au rang N
 *  d'une zone. `null` = case volontairement vidée (elle reste dessinée à sa place) ; rang ABSENT du
 *  Record = laissé au pré-remplissage déduit. Objet creux, jamais un tableau à trous : le snapshot de
 *  partie sérialise en JSON, où un trou deviendrait `null` — donc « vidée ».
 *  UN modèle pour les trois zones — le set au poing n'est qu'une dimension de l'adresse de l'arsenal.
 *  Lecture/écriture : `src/state/dispositionConsole.ts` (validateur `poserDansBarre`). */
export interface DispositionConsole {
  /** Arsenal, par `WeaponLoadout.id` : commuter le set affiche SA disposition. */
  arsenal?: Record<string, Record<number, EntreeBarre | null>>;
  accesRapide?: Record<number, EntreeBarre | null>;
  capacites?: Record<number, EntreeBarre | null>;
}

/** UNE exposition à une maladie (op `exposeDisease`) — consommée par le bilan de fin de combat
 *  (Test de Contraction, LDB 20 l.25/51). Les modulateurs viennent de la SOURCE de l'exposition :
 *  Contagieux (Type), EDO App.2 l.228-230 → `difficultyShift: -2` (« 2 niveaux plus difficile »,
 *  sens `easeDifficulty` : négatif = plus difficile) + `instant` (« incubation “Instantanée” »). */
export interface DiseaseExposure {
  /** id de la maladie (`maladies.json`). */
  disease: string;
  /** Crans de difficulté du Test de Contraction (sens `easeDifficulty` : négatif = plus difficile). */
  difficultyShift?: number;
  /** Si contractée, l'incubation devient « Instantanée » (symptômes immédiats). */
  instant?: boolean;
}

export interface Combatant {
  id: string;
  label: string;
  kind: 'hero' | 'enemy' | 'npc';
  /** Ce combattant suit-il les règles de PERSONNAGE (#143) — axe DISTINCT du camp (`kind`, ci-dessus)
   *  ET du contrôle (`pilotedByHuman`/`controlsCombatant`, netOwnership.ts) : gouverne des mécaniques
   *  écrites au Personnage dans la source (jamais étendues aux créatures génériques) — Corruption
   *  (LDB 19, tout le chapitre s'adresse à « vous » ; damné → « devient un PNJ », l.89), composant
   *  d'incantation (LDB 46 l.107-111, une possession/dépense de personnage), Tests de fin de combat
   *  Maladie/Corruption (LDB 18 l.5 « la plupart des Personnages » ; LDB 20 l.14/206 « Personnage »).
   *  Un HÉROS (`kind:'hero'`) l'est TOUJOURS implicitement (ne pas le redéclarer) ; une créature
   *  générique du bestiaire ne l'est PAS par défaut ; un PNJ humain hostile MODÉLISÉ (statbloc d'auteur)
   *  peut l'être explicitement — data-driven, éditable (`CustomStatblock.followsCharacterRules`,
   *  propagé au spawn par `statblockToCombatant`). Prédicat unique : `followsCharacterRules` (engine/relations.ts). */
  followsCharacterRules?: boolean;
  /** `id` STABLE de la fiche dont ce combattant est une instance (posé au spawn) : une créature du
   *  bestiaire (`state/spawn.ts`), ou la réf d'un objet inanimé (`inanimateCombatant`) —
   *  clé de résolution du rig/apparence (« plus de label » : on ne re-résout plus par `name`). */
  creatureId?: string;
  /** Le porteur de fiche dont ce combattant a été spawné (`state/spawn.spawnEnemy`, #1882) — ce qui le
   *  re-spawne à l'identique (`scheduleRespawn ref:'self'`). Absent : un héros, né de sa création. */
  porteurDeFiche?: import('./statblock').PorteurDeFiche;
  /** Coque/navire (`bodyShape:'vehicule'`) : `id`s des Combattants d'ÉQUIPAGE exposés à bord (MDG 14).
   *  Un Critique « Équipage » et les Éclats reviennent à ces marins (Critiques de personnage / Dégâts). */
  crewIds?: string[];
  /** Pièces d'artillerie MONTÉES sur ce Combattant-coque (source de vérité, MDG 12-13). Au spawn, chaque
   *  poste pose son arme sur le chef de pièce via `mannedPoste`. */
  postes?: ShipPoste[];
  /** SABOTAGE des Tests d'équipage de cette coque (MDG 14 l.45-47 : un saboteur à bord « n'effectue pas
   *  ce Test… le MJ pourra imposer de -1 à -5 DR sur le Test d'équipage ») — AUTHORÉ par le scénario sur le
   *  Combattant-coque (le contenu est de la donnée, pas du code) ; lu CLAMPÉ à [-5, 0] par `shipSaboteurDR`
   *  et appliqué au total du Test d'équipage EN COMBAT (`combatSlice.openCrewTestPending`) comme du Test
   *  d'équipage de VOYAGE (Progression, Orientation… `seaVoyageFlow.buildVoyageCrewStep`, #214) — en
   *  voyage, la valeur vient de `CampaignVessel.saboteurDR`, recopiée sur la coque de trajet (`voyageShip`). */
  saboteurDR?: number;
  /** Coque/navire : Encombrement de la CARGAISON en cale (MDG 12 l.68-75) — recopié de `CampaignVessel.cargo`
   *  sur la coque de trajet/combat, source de la SURCHARGE (−M/−DR Manœuvre par palier, `cargoOverload`).
   *  Absent = cale vide (aucune surcharge). #243. */
  cargoEnc?: number;
  /** Coque : QUART du dernier chant de marin (index `gameTime ÷ 4 h`) — « Une seule chanson de marin peut
   *  être chantée lors de chaque quart » (MDG 09 l.40). Posé par `battleSingShanty`. */
  lastShantyQuart?: number;
  /** Le combattant CHANTE une chanson de marin (MDG 09 l.38) — identité de l'effet posé sur l'équipage
   *  (retrait ciblé) : « Si le Personnage subit des Dégâts …, sa Chanson de marin prend fin. » */
  singingShanty?: { shantyId: string; label: string };
  /** Coque/navire : **Améliorations d'INSTANCE** (MDG 12 — Sabord, Bélier, Blindage, Lissage…), réfs par id
   *  STABLE (ex. `{ id: 'blindage-fer' }`), JAMAIS le libellé. S'ajoutent aux Traits du TYPE (`ship.traits`) ;
   *  lues par `engine/navalTraits.ts`. Blindage est appliqué au spawn (PA de coque) ; Lissage/Peu maniable au
   *  calcul de manœuvre ; Sabord au rendu du Pont. Comme un `ItemInstance` porte qualités/enchants. */
  upgrades?: NavalTraitRef[];
  /** Poste que CE combattant SERT (chef de pièce) → `recomputeLoadout` en dérive l'arme active taguée
   *  `mountSide` (comme une morsure/un tentacule : dans `weapons`, HORS inventaire). Le canon reste la pièce
   *  du navire (vérité = la coque) ; ceci n'est que le lien « je suis à cette pièce ». KIND-AGNOSTIQUE. */
  mannedPoste?: ShipPoste;
  /** Commandant d'équipe (AA 13 l.29-35) : `id` du commandant (Talent Commandant d'équipe) qui a RÉUSSI
   *  à diriger CE chef de pièce. Tant que ce commandant reste vivant ET à portée de voix, l'équipe tire au
   *  score de Projectiles du commandant (substitution re-validée à CHAQUE tir — `state/commandTeam`). */
  teamCommanderId?: string;
  species?: string;
  career?: string;
  /** Carrières JAMAIS PERDUES (LDB « Carrières » — un changement de Carrière n'efface pas les
   *  précédentes) : ids CUMULÉS de toute Carrière un jour PORTÉE (courante comprise), sans doublon —
   *  distingue « appartenez » (LDB 23 l.197, Classe COURANTE) de « n'a jamais appartenu » (AA 12 l.5,
   *  Classe historique). Écrit par `engine/advancement.ts` `changeCareer` ; absent = `[career]`
   *  (`everBelongedClasses`, `engine/activities.ts`). */
  careerHistory?: string[];
  /** Drapeau POSITIONNEL dérivé « hors de son terrain d'élection » (op passive `offTerrainMod` — Créature
   *  marine/Aquatique : la case occupée n'est pas `eau`) : posé par `placeCombatant` à CHAQUE placement,
   *  lu par les consommateurs purs `offTerrainMoveCap`/`offTerrainTestDR` (trauma.ts). Re-dérivé au
   *  placement suivant (jamais une vérité à maintenir à la main). */
  offTerrain?: boolean;
  /** Catégorie de Taille (LDB 85). Optionnel ; défaut Moyenne au point de lecture (`effectiveSize`). */
  size?: import('./size').SizeCategory;
  /** EMPREINTE de grille (côté N×N), DÉCOUPLÉE de la Taille créature `size` (lue par `footprintN`). Pour les
   *  objets qui occupent des cases SANS être une créature menaçante — un NAVIRE (MDG 12) : il a une empreinte
   *  mais aucune `size`, donc aucune Peur de Taille / Piétinement / ×Dégâts. Absent → empreinte dérivée de `size`. */
  footprint?: number;
  /** Forme du corps (LDB 76 l.17-29) : choisit le Tableau de Localisation. Défaut `humanoide` au point de lecture. */
  bodyShape?: BodyShape;
  /** Structure de siège (`bodyShape:'structure'`) : l'ARÊTE de mur que cette structure occupe (`scene.walls`).
   *  Sert à poser la BRÈCHE (`setStructureDown`) à sa destruction. `side` redéclare `state/scene` WallSide ici
   *  (même union) pour ne pas faire dépendre le moteur PUR de l'état. */
  structureEdge?: { x: number; y: number; side: WallEdgeSide; z?: number };
  /** Objet INERTE explicite (ni structure de siège, ni véhicule-coque) : une pièce SERVIE inanimée — affût
   *  d'artillerie d'un emplacement (AA/MDG 12) — qui se REND par son espèce (engin) mais n'a NI réaction de
   *  combat (Parade/Esquive/Localisation/Engagement, via `isInanimate`) NI tour propre (hors `order`). Son seul
   *  rôle actif est d'être SERVIE (`postes`) par un équipage. */
  inert?: boolean;
  /** PNJ allié piloté par l'IA (≠ héros du groupe, manuel). Un combattant du camp des héros (`kind:'hero'`)
   *  qui AGIT SEUL via la machinerie d'IA (`aiDriven`), sans affordance joueur — pour les défenseurs PNJ
   *  (archers, équipage d'une pièce de rempart) que le joueur ne doit pas micro-gérer. */
  aiControlled?: boolean;
  /** Psychologie (LDB 21) : Indice de Peur/Terreur INSPIRÉ (statbloc) ; Immunité Psychologie (85 l.143-144). */
  causesPeur?: number;
  causesTerreur?: number;
  psychImmune?: boolean;
  /** Afflictions psychologiques ACTIVES en combat (Peur en cours, etc.). */
  /** États psychologiques portés (LDB 21) — Peur/Terreur/Animosité/Haine ET **Frénésie** (`type:'frenesie'`,
   *  posée à l'entrée, lue par `isFrenzied` ; +1 BF / immunité psy / sortie en DONNÉES `psychology.json`). */
  psychState?: import('./psychology').PsychAffliction[];
  /** (Détermination : l'immunité psy temporaire + l'ignorance des modifs de Critique sont désormais
   *  portées par des `ActiveEffect` à `duration` Rounds — `psychImmune`/`ignoreCritMods` — expirées par
   *  le système de Durée unifié, plus de compteur/flag round-scopé ad hoc.) */
  /** Groupes d'appartenance + traits psy possédés (matching des Cibles — utilisés en P3). */
  groups?: string[];
  /** DOCTRINE TACTIQUE forcée en DONNÉE (id de `DOCTRINES` dans `state/ai.ts` : `meute`/`soldats`/
   *  `tirailleurs`/`artillerie`/`horde`/`racaille`/`embuscade`/`standard`). Si présent et valide, l'IA
   *  l'utilise TELLE QUELLE (la sélection automatique par signaux est court-circuitée) — c'est le levier
   *  « forcer une doctrine » du Codex/éditeur. Absent ⇒ doctrine déduite des traits/Intelligence/groups/
   *  sorts/État Surpris du camp adverse (cf. `pickDoctrine`, ce dernier signal sélectionne `embuscade`
   *  quand l'ennemi ouvre le combat depuis une embuscade réussie). Ne touche QUE les poids du cœur
   *  discrétionnaire de l'IA : aucune garde RAW (fuite Bestial, Frénésie, Brisé…) n'en dépend. */
  aiDoctrine?: string;
  psychTraits?: import('./psychology').PsychTrait[];
  /** Phobie du noir (ADE II Annexe I, règle facultative `psych-acquisition-optional`) : total cumulé
   *  d'États *Brisé* subis À CAUSE d'une *Terreur* ; à ≥ Bonus de FM → une *Phobie* est acquise et le
   *  compteur remis à zéro (cf. `gainPhobieIfThreshold`). DONNÉE persistée (survit au writeback de combat). */
  briseFromTerreur?: number;
  /** Traits de créature (STRUCTURÉS — `TraitInstance` : id/value/arg/count/range) → attaques
   *  naturelles gratuites & règles dérivées (Morsure, Attaque caudale, Souffle… cf.
   *  engine/creatureAttacks). Lus sans aucun parsing (`resolveTraits`/`hasTraitKey`). Conservés au spawn. */
  traits?: import('./statEntry').TraitList;
  /** Traits dont les modificateurs de PROFIL (charMods/Mouvement, LDB 85 : Élite/Coriace/Brutal/Rapide…)
   *  s'appliquent en DIRECT par le collecteur passif (kind `intrinseque`) plutôt que d'être cuits dans
   *  `characteristics`/`movement` : facultatifs d'un profil bestiaire FINAL, traits d'un statbloc d'éditeur,
   *  traits ACCORDÉS en jeu (`grantTrait`). Absent ⇒ aucun (profil déjà final / héros sans trait créature).
   *  `characteristics` reste la BASE pure ; `effectiveChar` ajoute ces traits (cf. `baseWithTraits`). */
  liveTraits?: import('./statEntry').TraitList;
  /** Trait Nuée (LDB 85 l.251-253) — posé au spawn (`applySwarmBuild`), lu par le combat, la fin de
   *  Round et le désengagement. */
  swarm?: boolean;
  /** Combat monté (LDB 14 l.175-187). `mountId` = la monture que CE combattant chevauche (→ il est
   *  cavalier) ; `riderId` = le cavalier porté (→ il est monture). Appairage DYNAMIQUE (Monter/Descendre).
   *  Le couple partage la position et l'empreinte de la MONTURE. */
  mountId?: string;
  riderId?: string;
  /** Ce combattant est une MONTURE rideable (peut être enfourché par un allié à pied — LDB 14). */
  mountable?: boolean;
  /** Rôle de marche PERSISTANT (`id` d'Activité de voyage EDOC 8) — « les mêmes tiennent toujours le
   *  même poste ». Attaché au personnage (toutes parties de voyage) ; l'assignation d'un trajet en est
   *  initialisée. Absent ⇒ inféré des compétences (`defaultTravelRole`). Le joueur l'épingle/le change. */
  travelRole?: string;
  /** Rôle d'ÉQUIPAGE naval ÉPINGLÉ (`id` de `crew-roles.json` : timonier/artilleur/mousse…) — le poste que ce membre
   *  tient lors des Tests d'équipage du navire (MDG 14). ABSENT ⇒ le Test décide : `shipDefaultRoles`
   *  (`state/shipCrew`) affecte l'équipage au moment du jet, selon le TYPE de Test joué. Aucune surface
   *  n'affiche d'affectation devinée ; le joueur l'épingle/le change au roster (`ShipRolesPanel`, dont
   *  la ligne « Repos » pose la valeur `BENCHED`). Distinct de `travelRole` (voyage). */
  shipRole?: string;
  /** STATION à bord ÉPINGLÉE (`id` de `ship-stations.json` : pont/gréement/nid-de-pie/avirons/cale) — où
   *  ce membre se TROUVE quand un Critique de coque frappe une présence (`MDG 13 l.680/l.714/l.730/
   *  l.751`, `MSRC 07 l.78/l.82/l.94`). AUCUN défaut : sans épinglage, ce membre n'est visé par aucune
   *  présence. Jamais inféré d'un rôle ni d'une Compétence ; le joueur l'épingle (`setShipStation`).
   *  Jumeau de `shipRole`, orthogonal à lui. */
  shipStation?: string;
  /** File transitoire d'attaques gratuites de créature restant à résoudre ce tour (kinds :
   *  morsure/caudale/pietinement) — pilotée par aiCreatureFreeAttacks à travers la modale de défense. */
  pendingFreeAttacks?: string[];
  /** A chargé ce tour → ouvre une Attaque gratuite de Cornes (LDB 85) si la créature a le trait. */
  chargedThisTurn?: boolean;
  /** Déplacements COMPLETS (départ→arrivée) accomplis ce tour, EN ATTENTE du déclencheur d'approche
   *  (LDB 21 l.27) : l'événement s'évalue à l'IRRÉVOCABILITÉ du déplacement — Action prise
   *  (`markActed`) ou fin de tour (`advanceTurn`). Un déplacement DÉFAIT les purge. */
  approachMoves?: { from: { x: number; y: number }; to: { x: number; y: number } }[];
  /** Règle optionnelle « se fatiguer » (LDB 16 l.97) : Rounds d'effort soutenu accumulés ; à BE Rounds,
   *  Test de Résistance → échec = Exténué. Inerte tant que la règle `combat-se-fatiguer` est inactive. */
  effortRounds?: number;
  /** Attaques GRATUITES de manœuvre déjà jouées ce TOUR, COMPTÉES par type (LDB 85 : « pendant son tour,
   *  la créature peut effectuer UNE Attaque gratuite » → plafond 1/tour ; exception « une Attaque par
   *  tentacule » → `count`/tour). Compte par type, jamais un booléen ; remis à zéro en début de tour. */
  freeAttacksThisTurn?: Partial<Record<string, number>>;
  /** Dissipation (LDB 46 l.156 : « un seul Sort chaque Round ») — Contre-sort déjà tenté ce Round. */
  dispelledThisRound?: boolean;
  characteristics: Characteristics;
  /** Points de Blessure. `base` = Blessures à vide (snapshot/surcharge au spawn) ; `max` dynamique
   *  = base + delta des buffs F/E/FM × Taille (cf. effectiveMaxWounds) ; `current` = PB restants. */
  wounds: { current: number; max: number; base?: number };
  advantage: number;
  conditions: ConditionInstance[];
  /** Armes/armure ACTIVES (dérivées de l'équipement) — utilisées en combat. */
  weapons: Weapon[];
  armour: ArmourPoints;
  /** Inventaire complet à stats (porté, équipé ou non) — héros. */
  items?: ItemInstance[];
  /** Encombrement total porté (dérivé). */
  encumbrance?: number;
  skills: SkillInstance[];
  talents: TalentInstance[];
  /** Sets d'armes du héros (les ennemis n'en ont pas — leurs armes viennent du statbloc, posées à l'instanciation via spawn.ts). */
  loadouts?: WeaponLoadout[];
  activeLoadoutId?: string;
  /** DISPOSITION de la console de combat, PAR ADRESSE de case (spec HUD zone 6 : la barre est
   *  éditable, la déduction ne fait que pré-remplir). Donnée du PORTEUR : elle voyage avec lui
   *  (save, roster, coop) sans table annexe ni clé de partie. Porte unique d'écriture :
   *  `poserDansBarre` (`src/state/dispositionConsole.ts`). */
  barre?: DispositionConsole;
  /** Sorts/prières connus — `id` de `src/data/spells.json`, résolus par `findSpellById`. */
  spells?: string[];
  /** Composants d'incantation possédés (LDB 46 l.107-113) — `id` des Sorts d'Arcane/Domaine pour
   *  lesquels le héros a acheté un composant (coût = NI pistoles d'argent, « acheté pour un Sort
   *  spécifique »). Sous la règle optionnelle `magic-composant`, le composant absorbe les pires
   *  effets du contrecoup : Imparfaite Majeure → Mineure, Mineure → annulée ; consommé à l'incantation
   *  (succès OU échec, Imparfaite OU PAS). Persisté entre combats. */
  componentSpells?: string[];
  /** Points de Péché (LDB 40 l.30-36) — Bienheureux ayant violé les commandements de
   *  son dieu. Octroyés par le MJ/l'auteur (Effet `giveSin`), jamais inventés ; pas de
   *  maximum ; chaque jet de Colère des dieux en retire 1 (l.53). Persisté entre combats. */
  sinPoints?: number;
  /** Armes INHABITUELLES maîtrisées (ids de trapping, `TrappingData.id`) — ACE 12 l.17
   *  « Entraînement avec une arme inhabituelle ». Tant qu'une arme `requiresMastery` n'est pas
   *  maîtrisée, son porteur est traité comme SANS la Compétence du Groupe (carac brute, LDB 09
   *  l.44 ; Défauts contextuels du Groupe — cf. `weaponUnmastered`). */
  masteredWeapons?: string[];
  /** Effets magiques actifs et temporisés (buffs de Bénédiction/Sort). */
  activeEffects?: ActiveEffect[];
  /** Pénalités/blocages d'incantation temporisés (contrecoups des tables d'Imparfaites/Colère,
   *  LDB 46/40) : « Langue maladroite −10 », « pas de Test de Prière N Rounds », « DR de Prière
   *  plafonné à 0 une semaine »… `roundsLeft` décrémenté en fin de Round (combat + entretien hors
   *  combat) ; `untilTime` purgé par l'horloge (advanceTime). Persisté. */
  castPenalties?: CastPenalty[];
  /** Accumulateur de Focalisation : DR cumulé pour un sort d'Arcane/Domaine. */
  focus?: { spell: string; dr: number };
  /** Accumulateur de DISSIPATION permanente (LDB 46 l.158-162) : Test étendu de Langue (Magick) en cours,
   *  DR cumulé vers la NI d'UN sort durable (identifié par sort + lanceur). Persiste entre Rounds de combat
   *  (une Action/Round) ; effacé à la dissipation (DR ≥ NI) ou à la fin du combat. Cf. `caster.focus`. */
  dispel?: { spellId: string; spellCasterId: string; total: number };
  /** Artisanat en cours (« Tout travail inachevé peut être conservé », LDB 23 l.102) — DONNÉE
   *  PERSISTÉE AU HÉROS (survit à la clôture d'un interlude — `InterludeState.perHero` est
   *  reconstruit à neuf à CHAQUE ouverture, `startInterlude`). `trappingId` = id de l'objet
   *  fabriqué ; `atouts`/`defauts` = ids de qualité (runtime). */
  craft?: { trappingId: string; tier: import('./activities').PriceTier; avail: Availability; atouts: string[]; defauts: string[]; drDone: number; drTarget: number; difficulty: Difficulty };
  /** Rituel en cours de Focalisation (Activité « Accomplir un Rituel », `VDM 02 l.777`) — DONNÉE
   *  PERSISTÉE AU HÉROS (même raison que `craft` ci-dessus). DR cumulé par Round, un Round par
   *  Activité, jusqu'à `drTarget` (NI réduit de moitié, arrondi sup., l.777). Composants/Conditions/
   *  Sacrifices/Conséquences (`SpellData['ritual']`, `VDM 02 l.377-393`) restent en PROSE non
   *  structurée — non consommés/appliqués par ce mécanisme. */
  ritual?: { spellId: string; drDone: number; drTarget: number };
  /** Mouvement (cases par tour, dérivé de la table de Mouvement). */
  movement: number;
  // Destin / Résilience (LDB 17 l.9)
  fate?: number;
  fortune?: number;
  resilience?: number;
  resolve?: number;
  /** Talent Résistance (Menace), LDB 10 l.1016-1020 : specs (normalisées) dont l'auto-succès « premier
   *  Test pour résister à la menace » a DÉJÀ servi cette séance de jeu. Remis à zéro par la couture de
   *  début de séance (`restoreFortune`, LDB 17 l.41). Persisté (party + writeback de combat). */
  resistanceUsed?: string[];
  motivation?: string;
  /** Signe astral (« Naissance sous les Étoiles », ADE II) — `id` STABLE du signe (≠ libellé —
   *  multilangue-safe) ; résolu à l'affichage par `findStarById`. */
  star?: string;
  /** Détails supplémentaires (âge, taille, yeux, cheveux, ambitions — LDB 05 étape 6). */
  details?: HeroDetails;
  // Traumatisme (LDB 18) — modèle de mort
  /** Nombre de Blessures critiques cumulées (mort si > Bonus d'Endurance + Inconscient + 0 PB). */
  criticalWounds?: number;
  /** A subi ≥1 Blessure critique DANS le combat courant (transitoire) — déclenche en fin de combat le Test
   *  de Résistance Très Facile (+60) « ou Infection Mineure » (LDB 20 l.90). Remis à zéro au prochain combat. */
  tookCriticalThisFight?: boolean;
  /** Historique des ENTRÉES de Blessure critique subies (ids STABLES de `criticals.json`),
   *  appendé à chaque résolution (`applyCriticalToTarget`). PERSISTE à vie (jamais réinitialisé au combat) :
   *  sert les escalades conditionnées à l'occurrence (« Si vous tombez une seconde fois sur cette blessure… »,
   *  Blessure majeure à l'oreille, LDB 18 l.71) — lu par `resolveCritique` (`escalation.onRepeat`). */
  critEntriesSuffered?: string[];
  /** La blessure a été PANSÉE (matériel stérile / pansement) DANS le combat courant — un soin de Guérison
   *  réussi ou un bandage suffit : « aucune Infection ne se développera suite à la blessure »
   *  (LDB 09 l.260 ; cataplasme de guérison LDB 72 l.20). Empêche la contraction d'Infection Mineure
   *  en fin de combat. Transitoire (par rencontre). */
  woundDressed?: boolean;
  /** Traumatismes subis (LDB 18) — persistants ; effets en-combat lus par effectiveChar/effectiveMovement. */
  traumas?: Trauma[];
  /** Mains « ensanglantées » par un Critique Main ensanglantée (AA 07 l.117, op `handGate`) : chaque main
   *  gatée impose un Test de Dextérité (+20) AVANT toute Action employant l'arme qu'elle tient
   *  (`attackHandGate`) ; sur un Échec, l'objet glisse (op `disarm`). Le gate tient TANT QUE l'État
   *  Hémorragique tient — `removeCondition` purge ce marqueur dès que l'Hémorragique tombe à 0. */
  handGates?: ('main' | 'off')[];
  /** Points de Corruption (LDB 19) — dérive de l'âme vers le Chaos. Gagnés par expositions/
   *  Sombres Pactes/contrecoups magiques ; au-delà de BFM+BE, chaque gain impose un Test de
   *  Résistance ou MUTATION. Persisté. */
  corruption?: number;
  /** Mutations subies (LDB 19, Tableaux p.184-185) — DONNÉE persistée ; les effets (caracs
   *  permanentes, Mouvement, PA naturels, mods de Tests, Traits) sont lus à la volée. */
  mutations?: import('./corruption').Mutation[];
  /** Damné (LDB 19 l.87) : plus de mutations physiques que BE ou mentales que BFM — l'âme
   *  appartient aux Dieux Sombres. Hors-jeu définitif (traité comme mort, affiché « Damné »). */
  damned?: boolean;
  /** Trauma psychologique « Cauchemars » (LDB 21 l.95) : chaque nuit, Test de Calme Facile (+40) ou
   *  Exténué. Posé par l'Effet d'éditeur `inflictNightmares` (assigné par l'auteur, jamais inventé). */
  nightmares?: boolean;
  /** Maladies et infections en cours (LDB 20) — incubation/durée décomptées au repos ; symptômes =
   *  donnée (`symptoms.json`) lus par `diseasePassiveOps` (fièvre…) / `rest.ts` (Malaise→Exténué, Blessé). */
  diseases?: import('./disease').Disease[];
  /** Faim (LDB 18 l.337-343) : jours sans manger, Tests tentés (−10 cumulatif), échecs (malus de
   *  caracs lus par `hungerCharPenalties`). Absent = nourri. Entretien quotidien : `dailyFoodUpkeep`. */
  hunger?: import('./provisions').HungerState;
  /** Soif (LDB 18 l.340) : jours sans eau, Tests tentés (−10 cumulatif), échecs (malus de caracs lus
   *  par `thirstCharPenalties`). Absent = désaltéré. Entretien quotidien : `dailyWaterUpkeep`. */
  thirst?: import('./provisions').ThirstState;
  /** Ivresse (LDB 09 l.471-487) : échecs de Résistance à l'alcool (−10/échec aux CC/CT/Ag/Dex/Int, lus
   *  par `drunkCharPenalties`) + seuil d'Ivresse + résultat du Tableau. Absent = sobre. */
  drunk?: import('./drunkenness').DrunkState;
  /** Immunités acquises (Vérole Urticante guérie — LDB 20 l.127-129) : maladies inattrapables à nouveau. */
  diseaseImmunities?: string[];
  /** Pénalité RÉSIDUELLE (magnitude ≥ 0) aux Tests de Résistance-aux-maladies APRÈS la fin d'une maladie
   *  à `infectionPassive` (Vers du Reik : « Cette pénalité est réduite de 1 point par jour après la mort
   *  du ver », MSRC 16 l.138) — décroît de 1 par jour (`tickDisease`) jusqu'à 0. Lue par `activeDiseaseTestMod`. */
  residualDiseaseTestMod?: number;
  /** Maladies auxquelles ce combattant a été EXPOSÉ pendant le combat (blessé par une source porteuse :
   *  Infecté → 'blessure-purulente', Maladie (Type) → l'`arg` (ex. 'fievre-du-rongeur' des rats),
   *  munition Infecté ; touché par Contagieux (Type) — EDO App.2 l.228-230 : Test 2 niveaux plus
   *  difficile + incubation « Instantanée ») → Tests de Contraction post-combat (LDB 85 l.187/225 /
   *  LDB 20 l.25/51). SOURCE UNIQUE (op `exposeDisease`). */
  diseaseExposure?: DiseaseExposure[];
  // Maladresse (LDB 14 — Tableau des Oups !) : effets reportés au prochain Round.
  /** Pénalité (positive) à l'Action au prochain Round (Oups! 41-60). Consommée au prochain Test d'attaque. */
  nextActionPenalty?: number;
  /** Perd sa prochaine Action (Oups! 71-80). */
  loseNextAction?: boolean;
  /** Perd son prochain Mouvement (Oups! 61-70). */
  loseNextMovement?: boolean;
  /** Agira en dernier au prochain Round (Oups! 21-40). */
  actLastNextRound?: boolean;
  /** Rounds consécutifs passés à 0 PB sans soin (→ Inconscient après BE rounds). */
  roundsAtZero?: number;
  /** Suffocation (LDB 18 l.346) : Rounds restants avant la MORT une fois Inconscient à 0 PB
   *  en suffoquant (posé à BE, décrémenté par Round de suffocation continue ; 0 → mort). */
  suffocationCountdown?: number;
  /** Rétention de souffle (LDB 18 l.346) : « si vous êtes suffisamment préparé, vous pouvez retenir
   *  votre souffle pendant un nombre de secondes égal à votre Bonus d'Endurance x 10 sans avoir à
   *  effectuer un Test ». SECONDES de souffle restantes, posées par `prepareBreathHold` quand la
   *  privation d'air est ANTICIPÉE (plongée volontaire) : tant que > 0, la suffocation ne fait perdre
   *  aucune Blessure. Absent/0 = privé d'air BRUTALEMENT → suffocation immédiate (l.344). */
  breathHoldSeconds?: number;
  /** Contre-mesure MAISON à la suffocation « hors terrain » (Créature marine, MDG 16 l.19 : « elles
   *  doivent être régulièrement aspergées d'eau, sinon elles se mettent à suffoquer » — le RAW nomme le
   *  geste sans en chiffrer la mécanique). Posé par l'Action de combat « Asperger d'eau » (#497,
   *  `battleWater`) sur une cible adjacente, immunise le Round courant, puis consommé par
   *  `suffocationTick` (`engine/suffocation.ts`) : à reposer chaque Round pour rester immunisé. */
  wateredThisRound?: boolean;
  /** Attribut de Shyish (LDB 48 l.501) : « Une cible ne peut avoir qu'un seul État Exténué gagné
   *  de cette façon à la fois » — marqueur posé au premier Exténué d'un Sort de la Mort. */
  shyishExhausted?: boolean;
  /** A déjà bénéficié d'un soin de Blessures (Guérison) cette rencontre (LDB 09 l.260).
   *  Réinitialisé au début de chaque combat (startCombat). N'affecte PAS l'arrêt d'Hémorragie. */
  soinRencontreUtilise?: boolean;
  /** Mort (résultat létal ou mort lente). Hors de combat définitif. */
  dead?: boolean;
  /** Le déclencheur `onSlain` a déjà été émis pour ce combattant (mise hors de combat) — garde-fou
   *  d'unicité : `onSlain` peut être atteint par plusieurs chemins de mort, on ne le tire qu'UNE fois. */
  slainNotified?: boolean;
  /** PNJ important : utilise le système complet de critiques au lieu de la Mort Subite. */
  important?: boolean;
  /** « Meurs un autre jour » (Destin) : éjecté de la rencontre — vivant mais hors de combat. */
  outOfRencontre?: boolean;
  /** MOTIF de sortie de rencontre (#237/#215/#471), pose le langage visuel de fin : `reddition` (seuil
   *  de dommage franchi), `prise` (coque amenée à l'abordage) → lus « rendu » (pavillon amené) ;
   *  `destin` (Meurs un autre jour), `naufrage` (passé par-dessus bord), `firstBlood` (Duel judiciaire,
   *  premier sang, NADJ 06 l.175-177) → lus « hors-combat ». Absent = sortie générique (hors-combat).
   *  Seul champ distinguant `rendu` de `hors-combat`. */
  exitReason?: 'reddition' | 'prise' | 'destin' | 'naufrage' | 'firstBlood';
  /** Combattant INVOQUÉ par un Sort (champ `SpellSpec.summon` — Nécromancie, Hurlement du loup,
   *  Manifestation de démon…) : `byId` = le lanceur ; `expiresAtRound` = la créature se dissipe au
   *  franchissement de Round une fois ce numéro dépassé ; `despawnIfSummonerDown` = elle s'effondre
   *  si le lanceur est hors de combat (minions de Nécromancie liés au sorcier). Géré par state/summonFlow. */
  summon?: { byId: string; expiresAtRound?: number; despawnIfSummonerDown?: boolean; label?: string; spellId?: string };
  // L'ÉTAT DE CHARGE (munition choisie/capturée, `loaded`, progression, chargeur) vit sur l'INSTANCE
  // D'ARME (`Weapon`) : chaque arme à distance possédée gère son propre rechargement et sa propre
  // munition (arbitrage utilisateur 2026-08-16 : « si j ai 2 armes à distance elles gèrent chacune leur
  // propre rechargement et munition »). Aucun de ces champs ne vit sur le COMBATTANT.
  /** Salve (Aux Armes p.126) : nombre de tirs DÉJÀ effectués ce tour (réinit. au changement de tour) ;
   *  chaque tir suivant d'une arme à Salve subit −10 cumulatif (lu par `attackModifiers`). */
  shotsThisTurn?: number;
  /** Perturbante (LDB 62 l.272-274) : mode « Repousser » armé — la prochaine attaque réussie repousse
   *  d'1 m par DR au lieu de causer des Dégâts. Consommé par l'attaque (héros uniquement). */
  pushbackMode?: boolean;
  /** `passive` des AURAS de combat à portée desquelles ce combattant se trouve (Perturbant :
   *  −20 aux Tests, LDB 85 l.262) — recalculé chaque Round par le hook `recompute-auras` à partir des
   *  `TraitData.aura` voisines, lu par `combatTestPenaltyParts` (pool non-cumul des pénalités de Test,
   *  LDB 16 l.13) et par `skillDRBonus`/`charDRBonusOf`. Générique (toute aura). Chaque op voyage
   *  emballée en `PassiveMod` : son `src` porte le TRAIT émetteur, ce qui NOMME la chip du jet. */
  auraMods?: import('./ops').PassiveMod[];
  // Avancement par Points d'Expérience (héros uniquement, LDB Carrières)
  /** PX disponibles à dépenser. */
  xp?: number;
  /** Augmentations de Caractéristique DÉJÀ achetées par caractéristique (≠ valeur courante :
   *  sert au coût de la prochaine Augmentation, qui dépend du nombre déjà acheté, l.69). */
  charAdvances?: Partial<Record<CharKey, number>>;
  /** Niveau de Carrière courant (défaut 1) — détermine le schéma in-carrière pour le coût. */
  careerLevel?: number;
  /** Désignations des emplacements « (Au choix) » des carrières (LDB 09 l.38 : la Spécialisation
   *  se choisit à l'allocation). Par carrière : slotKey → libellé concret (« Sens aiguisé (Ouïe) »).
   *  Deux slots d'une même carrière ne désignent jamais le même libellé ; les désignations sont
   *  PAR carrière (un changement de carrière rouvre les choix). Cf. engine/careerSlots.ts. */
  careerSlotChoices?: Record<string, Record<string, string>>;
  // Combat tactique (grille)
  /** Case occupée. `z` = étage (cf. `SceneEntity.z` / `path.ts:Pt`) ; ABSENT = sol (z=0). `h` = hauteur
   *  RÉELLE de la surface sous le combattant, en MÈTRES (relief, `scene.heightAt`) — STAMPÉE au spawn et
   *  RAFRAÎCHIE à chaque déplacement (`placeCombatant`), pour que la distance de combat (composante
   *  verticale métrique) et le −10 « en contrebas » restent justes après tout mouvement. Absent = 0 m. */
  pos?: { x: number; y: number; z?: number; h?: number };
  initiative?: number;
  /** A gagné de l'Avantage durant le Round courant (upkeep de fin de Round, LDB Dépl. l.40). */
  gainedAdvThisRound?: boolean;
  /** Réaction de Porte-Bouclier (variante AA 13 l.84) déjà employée ce Round : « une fois par Round ».
   *  Posé par `applyShieldReaction`, purgé au franchissement de Round. */
  usedShieldReactionRound?: boolean;
  /** Distraire (LDB 10 l.364 / AA 13 l.51) : distrait par un adversaire → ne peut gagner AUCUN Avantage
   *  (mode groupe : sa réserve) jusqu'à la FIN de ce Round de bataille. Compteur de Rounds restants
   *  décrémenté au franchissement de Round (2 = « jusqu'à la fin du PROCHAIN Round » quand posé en cours
   *  de Round courant). `campGain` refuse tout gain tant qu'il est > 0. */
  distractedRounds?: number;
  /** « Sur la défensive » : +20 à tous les Tests de défense jusqu'au début du prochain tour (LDB Combat l.118). */
  defensiveStance?: boolean;
  /** Maniement de deux armes (LDB 10 l.767-773) : −10 à TOUTES ses défenses jusqu'au début de son prochain Tour. */
  dualStrikeDefensePenalty?: boolean;
  /** Action Viser engagée : +20 (Accessible) au PROCHAIN tir tant que la dernière action reste « viser »
   *  (LDB table des Difficultés, `14 - _GoBack.md` l.90 ; « pas de Test exigé pour viser »). */
  aiming?: boolean;
  /** Météo du JOUR sous laquelle ce combattant agit (EDOC 8 l.82, #341) : posée à l'ouverture d'un combat
   *  survenant un jour de voyage (`activeDayWeather`). SEULE source du canal « Tests physiques » (`weatherTestMods`,
   *  lu par attack/defenseModifiers) — jamais recâblée par surface. Transitoire (non persistée hors combat). */
  envWeather?: import('./travelStages').Weather;
  /** Adversaires avec qui ce combattant est Engagé en mêlée (LDB 13 l.169-171).
   *  Relationnel et symétrique ; purgé par paire en fin de Round si aucune attaque échangée. */
  engagedWith?: string[];
  /** IDs avec qui une attaque de mêlée a été échangée CE Round (upkeep de fin de Round,
   *  parallèle à gainedAdvThisRound) → sert à purger l'Engagement périmé (l.175). */
  meleeThisRound?: string[];
  /** IDs que ce combattant a ATTAQUÉS ce Round, quel que soit le mode (mêlée, tir, manœuvre de créature,
   *  Projectile magique) — trace ORIENTÉE attaquant→cible, posée par `markAttacked` aux sites de
   *  résolution, purgée avec `meleeThisRound` (`decayEngagement`). Lue par `agressifEnvers` : hors mêlée
   *  aucun texte ne rend la victime agressive en retour, d'où l'absence de réciprocité. */
  attackedThisRound?: string[];
  /** « Au contact » (LDB 62 l.176, Option « Longueur d'arme ») : adversaires dans la longueur d'arme
   *  desquels ce combattant est entré. Relationnel et symétrique (comme `engagedWith`) ; SOUS-ENSEMBLE
   *  de l'Engagement (purgé par paire dès que l'Engagement A↔B tombe). Toute arme plus longue que Courte
   *  vaut alors une Arme improvisée (cf. `effectiveWeapon` / `WeaponContext.auContact`). */
  contactWith?: string[];
  /** « Empoignés » (LDB 14 l.159, Option « Empoignade ») : adversaires avec qui ce combattant est en
   *  Empoignade. Relationnel et symétrique (comme `engagedWith`/`contactWith`), posé par paire ; l'État
   *  *Empêtré* de l'Empoigné est une DONNÉE distincte (addCondition). Purgé sur sortie de combat par
   *  `clearEngagementOf` (qui lève engagement + contact + Empoignade d'un coup). */
  grapplingWith?: string[];
  /** Apparence visuelle RÉSOLUE (cosmétique, ignorée par le moteur ; lue directement par le rendu pour
   *  un PJ rendu depuis son propre inventaire). Référence de TYPE seulement → élidée à la compilation. */
  appearance?: import('../gameIso/rig/appearance').Appearance;
  /** Override d'apparence d'AUTHORING BRUT (cosmétique) porté depuis la scène au spawn (#187) : figé
   *  PARESSEUSEMENT par le rig (`enemyRigProfile`) au premier rendu, jamais dans `state`. */
  appearanceOverride?: import('./authoringAppearance').EntityAppearance;
}

/** Niveau de difficulté d'un Test (Livre de base, Tests). */
// Tableau de Difficulté du Livre de base (12 - Tests.md), vérifié par audit de
// fidélité : « Accessible +20 », « Complexe −10 », « Difficile −20 » — pas de
// palier « Moyen » ni « Épique ».
export type Difficulty =
  | 'tresFacile' // +60
  | 'facile' // +40
  | 'accessible' // +20
  | 'intermediaire' // +0
  | 'complexe' // -10
  | 'difficile' // -20
  | 'tresDifficile' // -30
  // Difficultés extrêmes de L'Ennemi dans l'Ombre (EDO App.2 l.156-165, « MAIS C'EST IMPOSSIBLE ! »).
  | 'presqueImpossible' // -40
  | 'impossible'; // -50

/** Les QUATRE Difficultés que la colonne « Pénalité de Couvert » d'une Structure peut porter
 *  (`AA 10 l.28-51`), dans l'ordre croissant de protection. Canon UNIQUE : `couvertDifficultySchema`
 *  (`schemas/grammaire/valeurs.ts`) en dérive, `CoverClass` leur répond un pour un (`engine/cover.ts`). */
export const COUVERT_DIFFICULTES = ['intermediaire', 'complexe', 'difficile', 'tresDifficile'] as const satisfies readonly Difficulty[];
export type CouvertDifficulty = (typeof COUVERT_DIFFICULTES)[number];

export const DIFFICULTY_MODIFIERS: Record<Difficulty, number> = {
  tresFacile: 60,
  facile: 40,
  accessible: 20,
  intermediaire: 0,
  complexe: -10,
  difficile: -20,
  tresDifficile: -30,
  presqueImpossible: -40,
  impossible: -50,
};

/** VOCABULAIRE FERMÉ des étapes de la cascade de NUIT (#1117 point 5) — les 16 `kind` réellement
 *  émis : 7 par les Tests d'entretien DIFFÉRÉS (`UpkeepDeferTest`), 8 construits par le flux de nuit,
 *  1 par l'entretien de MER (`sea-exposition` — MÊME règle d'Exposition, AUTRE route, donc autre kind :
 *  les ORDRES d'une traversée ne commandent que le sien, cf. `voyageCadence.SEA_KINDS_SOUS_ORDRES`).
 *  Union au TYPE = premier rideau : un kind inventé ne compile pas ; le résolveur d'enjeu jette en
 *  second rideau. Ajouter une étape de nuit = l'ajouter ICI et lui authorer son entrée d'enjeu. */
export const NIGHT_TEST_KINDS = [
  'faim', 'soif', 'recovery', 'nightmare', 'shelter', 'exposure', 'sea-exposition', 'exposure-heat-drop',
  'forcedMarch', 'traumaFracture', 'diseaseTick', 'diseaseGangrene', 'diseasePersist',
  'contagion', 'dessoulage', 'dessoulageHangover',
] as const;
/** `kind` d'une étape de la cascade de nuit — union FERMÉE dérivée de `NIGHT_TEST_KINDS`. */
export type NightTestKind = (typeof NIGHT_TEST_KINDS)[number];
/** Garde de vocabulaire — DÉCLARE le tri (une étape de nuit hors vocabulaire, révélation ou pas de
 *  météo, n'a pas d'enjeu de nuit à porter) au lieu de le faire en silence par un repli vide. */
export function isNightTestKind(k: string): k is NightTestKind {
  return (NIGHT_TEST_KINDS as readonly string[]).includes(k);
}

/** FORME DÉCLARÉE d'un texte d'ENJEU (#1117) : `verbatim` = contigu au Source, bloc par bloc ;
 *  `descripteur` = assemblage mécanique assumé, qui doit alors nommer son foyer de règle. Tuple
 *  RUNTIME posé ICI (module FEUILLE que `src/data` importe déjà) : les 6 schémas zod d'enjeu le
 *  consomment tel quel (`stakeFormSchema`, `src/data/schemas/grammaire/valeurs.ts`) et les déclarations TS
 *  référencent `StakeForm` — un palier de plus ne peut plus atterrir d'un seul côté. */
export const STAKE_FORMS = ['verbatim', 'descripteur'] as const;
/** Forme déclarée d'un enjeu — union FERMÉE dérivée de `STAKE_FORMS`. */
export type StakeForm = (typeof STAKE_FORMS)[number];

/** Ids de ce qui est TESTÉ — ce qu'un producteur NOMME pour que la porte en tire la valeur
 *  (`rollLine` → `testValue`) au lieu de la calculer chez lui. Union FAIL-CLOSED : au moins un id,
 *  jamais `{}` (qui ferait jouer la porte sur une valeur de 0, auto-échec muet — #1657 B3-3). Une
 *  Compétence PEUT nommer la Caractéristique sur laquelle elle se joue (Venin : Résistance sur
 *  Endurance) ; une Caractéristique NUE se déclare seule (ver de carie, `MSRC 16 l.90`). */
export type TestIds =
  | { skill: string; char?: CharKey; spec?: string }
  | { char: CharKey; skill?: undefined; spec?: undefined };

/** Spec d'un Test de Résistance d'entretien DIFFÉRÉ (cascade de nuit influençable) : le moteur le
 *  COLLECTE au lieu de le rouler (`state/upkeep` calcule la cible et en fait une étape de cascade,
 *  résolue par l'applicateur de `kind`). Garde l'invariante « si y'a un jet, y'a une étape ». */
export type UpkeepDeferTest = (spec: {
  kind: NightTestKind;
  label: string;
  difficulty: Difficulty;
  /** Modificateurs NOMMÉS du Test : chacun voyage AVEC son étiquette et sa règle, depuis le producteur
   *  qui l'applique (`engine/provisions` pour la Faim/Soif, `engine/disease` pour les bonus d'effet
   *  scopés à la maladie). Couture GÉNÉRIQUE (16 `kind`) : rien n'y est codé en dur, un `kind` futur
   *  apporte SES règles ou n'affiche aucune chip. */
  mods?: ModLine[];
  meta?: Record<string, unknown>; // p.ex. { diseaseName, onFail: GameOp[] } — porté tel quel par l'étape de cascade
} & (
  /** Le producteur NOMME les ids de son Test : la valeur est celle de la PORTE (`rollLine` →
   *  `testValue` : États, Encombrement, séquelles, passifs), décomposée en Niveau de Compétence NU +
   *  composantes NOMMÉES. `base` reste possible quand le producteur la calcule DÉJÀ par `testValue`
   *  (Faim/Soif/Dessoûlage) — elle doit alors se reconstruire, `rollLine` le vérifie. */
  | { test: TestIds; base?: number }
  /** Aucun id : la valeur vient d'une autre formule, DÉCLARÉE étrangère (aucune composante à deviner). */
  | { base: number; test?: never }
)) => void;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  tresFacile: t('difficulty.tresFacile'),
  facile: t('difficulty.facile'),
  accessible: t('difficulty.accessible'),
  intermediaire: t('difficulty.intermediaire'),
  complexe: t('difficulty.complexe'),
  difficile: t('difficulty.difficile'),
  tresDifficile: t('difficulty.tresDifficile'),
  presqueImpossible: t('difficulty.presqueImpossible'),
  impossible: t('difficulty.impossible'),
};

