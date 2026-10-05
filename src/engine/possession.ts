/**
 * SOCLE POSSESSIONS — moteur PUR (#614).
 *
 * « Un héros, un mercenaire, une mule : le MÊME portage » — une Possession PORTE des `ItemInstance[]`
 * avec exactement les sémantiques du héros (equipped/inside/contenants). Tronc commun minimal + union
 * discriminée par `nature` (§4.1 « pas de God-object » — arbitrage user 2026-07-19).
 */
import type { ItemInstance, Characteristics, NavalTraitRef } from './types';
import type { CargoLot } from './cargo';
import { cargoTotalEnc } from './cargo';
import { itemsEncumbrance } from './items';
import { mountProfileForCreature } from './mountTravel';
import type { MountInjury } from './mountTravel';
import { mountIncidentEffects } from './travelTables';
import type { CrewHire, ShipMoraleState } from './crewMorale';
import type { ManannMood } from './seaVoyage';
import type { CustomStatblock } from './statblock';
import { findVehicleById, findCreatureById, tailleDuProfil } from '../data';
import { SIZE_SHIPBOARD_ENC, type SizeCategory } from './size';

export type PossessionLocation =
  | { kind: 'avec-le-groupe' }
  | { kind: 'au-lieu'; placeId: string }
  | { kind: 'embarquee'; hostUid: string };

/** Réf du VIVANT — la même dualité que le spawn (spawnEnemy ref|statblock, spawn.ts:347). */
export type LivingRef =
  | { creatureId: string } // bestiaire (édition Codex vivante)
  | { custom: CustomStatblock }; // PNJ/bête custom de l'éditeur — le snapshot EST son identité

/** TRONC — toute possession : une identité possédée, localisée, qui PORTE. */
interface PossessionCommon {
  uid: string; // pos-N, anti-collision par scan du registre (jamais un compteur module)
  ownerId: string; // héros propriétaire — OBLIGATOIRE à l'acquisition ; succession si mort/retiré
  label?: string; // nom d'instance (« Marguerite »), affichage pur
  location: PossessionLocation;
  items: ItemInstance[]; // LE système de sac unique — equipped/inside/contenants, primitives du héros
  cargo?: CargoLot[]; // vrac (tronc CargoCarrier)
  destroyed?: boolean; // perdue/morte — journal, filtrée partout
}

/** Champs d'INSTANCE navals (miroir de `CampaignVessel`, store.ts:1340 — T2/#267 y migre le singleton) — vehicleId/label/wounds/upgrades/cargo
 *  restent au tronc `Possession`/variante `navire` (mêmes champs que les autres natures) ; `crew` reste
 *  un champ propre de la variante `navire` (individuation marins nommés #250, T2). */
export interface NavalPossessionState {
  morale: ShipMoraleState;
  fouling?: { level: number; lastWeek: number };
  manann?: ManannMood;
  saboteurDR?: number;
  criticals?: string[];
  crabs?: boolean;
  waterLitres?: number;
  provisions?: number;
  lastVoyageMilles?: number;
  crewLost?: number;
  wagesOwed?: number;
}

/** CORPS — union discriminée : zéro champ étranger à sa nature. */
export type Possession = PossessionCommon &
  (
    | {
        nature: 'bete';
        ref: LivingRef;
        charsRolled?: Characteristics; // LDB 77 l.108 — tiré UNE fois, seedé sur l'UID, FIGÉ
        appearanceSeed?: string;
        wounds?: { current: number; max: number }; // max re-dérivé à chaque projection (clamp)
        mountInjury?: MountInjury; // EDOC 07 Incidents de Monte
        learnedTraits?: string[]; // dresse-* appris (LDB 23 → LDB 85)
      }
    | {
        // T3 (LDB 75 + AA 09, #453 prérequis)
        nature: 'serviteur';
        ref: LivingRef; // dont statblocs GÉNÉRÉS carrière+espèce (le générateur produit un CustomStatblock)
        charsRolled?: Characteristics;
        appearanceSeed?: string;
        wounds?: { current: number; max: number };
      }
    | {
        nature: 'vehicule';
        vehicleId: string; // vehicles.json (catalogue UNIFIÉ post T0-a)
        wounds?: { current: number; max: number };
      }
    | {
        // T2 (#267/#250)
        nature: 'navire';
        vehicleId: string;
        wounds?: { current: number; max: number };
        upgrades?: NavalTraitRef[]; // MDG 12, MSRC 12
        crew?: CrewHire[]; // marins nommés #250 (individuation)
        naval: NavalPossessionState; // cf. CampaignVessel (T2/#267)
      }
    | {
        // T4 (#356) — location contrainte à au-lieu (fixe)
        nature: 'immeuble';
        buildingId: string;
      }
  );

/** Distribution GÉNÉRIQUE (`U` = type param NU, seule forme que TS distribue réellement sur une union
 *  — `Possession extends unknown ? … : …` sans paramètre générique NE distribue PAS, cf. incident
 *  #617/#618 Lot 1 : les literals `{vehicleId}`/`{ref}` échouaient le typecheck, collapsés vers
 *  l'intersection des clés communes). */
type Distribute<U> = U extends unknown ? Omit<U, 'uid'> : never;
/** `Omit` DISTRIBUTIF sur l'union discriminée `Possession` — `Omit<Possession,'uid'>` nu perdrait les
 *  champs propres à chaque `nature` (keyof d'une union = intersection des clés communes seulement).
 *  SOURCE UNIQUE (#617/#618 Lot 1) — `state/possessionsFlow.ts` la ré-exporte pour ses appelants. */
export type PossessionInput = Distribute<Possession>;

/** Capacité de PORT (Contenu bête / chargement véhicule / Contenance navire, EDOC 07/LDB 70/MDG 12) —
 *  `undefined` = source de capacité INEXISTANTE (statbloc custom sans profil de monture, serviteur qui
 *  ne porte que son propre sac, immeuble T4 sans catalogue). PUR. */
export function possessionCapacity(p: Possession): number | undefined {
  switch (p.nature) {
    case 'bete':
      return 'creatureId' in p.ref ? mountProfileForCreature(p.ref.creatureId)?.encPortee : undefined;
    case 'serviteur':
      return undefined; // porte son sac (ItemInstance) comme un héros — pas de bât dédié (LDB 75)
    case 'vehicule':
      return findVehicleById(p.vehicleId)?.chargement;
    case 'navire':
      return findVehicleById(p.vehicleId)?.ship?.capacity;
    case 'immeuble':
      return undefined; // pas de capacité de bât (T4, #356)
  }
}

/** Cette bête peut-elle être montée ? Non détruite, sans séquelle d'Incident de monte DÉCLARÉE
 *  bloquante (`preventsMount` — « Boiteux » : « ni monté, ni porter ou tirer de charge », EDOC 07
 *  l.159 ; « Patte brisée » : « demeure immobile », l.161). Seule la nature `bete` est montable
 *  (véhicule/navire se conduisent, ne se chevauchent pas). PUR. */
export function possessionRideable(p: Possession): boolean {
  if (p.nature !== 'bete') return false;
  if (p.destroyed) return false;
  return !mountIncidentEffects(p.mountInjury)?.preventsMount;
}

/** Traits (innés + appris) d'une bête-possession. */
function beteTraitIds(p: Possession & { nature: 'bete' }): string[] {
  const innate = 'creatureId' in p.ref ? (findCreatureById(p.ref.creatureId)?.traits ?? []) : (p.ref.custom.traits ?? []);
  return [...innate.map((t) => t.id), ...(p.learnedTraits ?? [])];
}

/** Cette bête accepte-t-elle un cavalier EN COMBAT ? (LDB 339 : ¬Belliqueux OU Dressé Monture),
 *  et encore montable (`possessionRideable`, Incidents de monte EDOC 07). PUR. */
export function possessionCombatRideable(p: Possession): boolean {
  if (!possessionRideable(p) || p.nature !== 'bete') return false;
  const t = beteTraitIds(p);
  return !t.includes('belliqueux') || t.includes('dresse-monture');
}

/** Libellé affiché : `label` d'instance (« Marguerite ») sinon le libellé du catalogue de sa nature
 *  (doctrine id/label, CLAUDE.md règle stricte). PUR. */
export function possessionLabel(p: Possession): string {
  if (p.label) return p.label;
  switch (p.nature) {
    case 'bete':
    case 'serviteur':
      return 'creatureId' in p.ref ? (findCreatureById(p.ref.creatureId)?.label ?? p.ref.creatureId) : p.ref.custom.label;
    case 'vehicule':
    case 'navire':
      return findVehicleById(p.vehicleId)?.label ?? p.vehicleId;
    case 'immeuble':
      return p.buildingId; // catalogue immeuble = T4 (#356), pas encore de label
  }
}

/** Taille effective d'un VIVANT (bête/serviteur) — la Taille de son profil (`tailleDuProfil`, `size`
 *  explicite d'un statbloc custom compris, comme au spawn) ; défaut Moyenne (LDB 85, standard implicite des espèces sans Trait). */
function livingSize(ref: LivingRef): SizeCategory {
  return tailleDuProfil(('custom' in ref ? ref.custom : findCreatureById(ref.creatureId)) ?? {});
}

/** Poids PROPRE d'une possession (hors items/cargo/embarquées) — véhicule/navire : `enc` du catalogue
 *  (`vehicles.json`, LDB 70/MDG 12) ; bête/serviteur : Enc qu'occupe un ÊTRE selon sa Taille à bord
 *  (`SIZE_SHIPBOARD_ENC`, MDG 12 l.25-33) ; immeuble : 0 (jamais transporté comme fret). */
function ownEnc(p: Possession): number {
  switch (p.nature) {
    case 'vehicule':
    case 'navire':
      return findVehicleById(p.vehicleId)?.enc ?? 0;
    case 'bete':
    case 'serviteur':
      return SIZE_SHIPBOARD_ENC[livingSize(p.ref)];
    case 'immeuble':
      return 0;
  }
}

/** Natures pouvant ACCUEILLIR une embarquée (§5 : « bête/véhicule sur navire : oui ; navire sur
 *  navire : non ») — seul un navire a la coque pour porter une AUTRE possession entière comme fret. */
const EMBARK_HOST_NATURES: ReadonlySet<Possession['nature']> = new Set(['navire']);

/** Natures pouvant ÊTRE embarquées — un navire ne se charge pas comme du fret (trop gros), un
 *  immeuble ne bouge jamais (`location` toujours `au-lieu`, T4 #356). */
const EMBARK_CHILD_NATURES: ReadonlySet<Possession['nature']> = new Set(['bete', 'serviteur', 'vehicule']);

/** Une possession peut-elle embarquer sur cet hôte ? Borne de chaîne par NATURE (§5) — la capacité
 *  libre se vérifie séparément, à l'appel (`state/possessionsFlow.ts` `embark`). PUR. */
export function canEmbark(child: Possession, host: Possession): boolean {
  if (child.uid === host.uid) return false;
  return EMBARK_HOST_NATURES.has(host.nature) && EMBARK_CHILD_NATURES.has(child.nature);
}

/** Enc DÉJÀ embarqué sur un hôte (Σ `possessionTotalEnc` des possessions `embarquee` sur lui) —
 *  brique commune de `embark()` (state/possessionsFlow.ts) ET de la gate d'écran (PossessionsScreen,
 *  #620 Lot 2) : SOURCE UNIQUE de ce calcul, jamais une 2e sommation parallèle. PUR. */
export function embarkedEnc(hostUid: string, all: Possession[]): number {
  return all
    .filter((p) => !p.destroyed && p.location.kind === 'embarquee' && p.location.hostUid === hostUid)
    .reduce((s, p) => s + possessionTotalEnc(p, all), 0);
}

/** `child` peut-elle embarquer sur `host` MAINTENANT (nature ET capacité libre, §5) ? Anticipe le
 *  refus que `embark()` journalise sinon en no-op silencieux à l'écran — un bouton actif dont le
 *  clic « ne fait rien » de visible est un défaut de gate, pas une garde applicative. PUR. */
export function canEmbarkNow(child: Possession, host: Possession, all: Possession[]): boolean {
  if (!canEmbark(child, host)) return false;
  const capacity = possessionCapacity(host);
  if (capacity == null) return true;
  return embarkedEnc(host.uid, all) + possessionTotalEnc(child, all) <= capacity;
}

/** Charge PORTÉE par une possession — items + cargaison + embarquées (Σ `possessionTotalEnc` pleine
 *  des enfants), EXCLUT son propre poids (`ownEnc`, le corps). C'est la contenance de BÂT réelle
 *  (LDB 70/EDOC 07/MDG 12) : ce qu'une bête/un véhicule PORTENT, jamais leur propre corps — une bête
 *  VIDE affiche 0 (pas son poids propre, #620 Lot 2 : bug utilisateur « Cheval de trait Grande 18/20
 *  à vide » — le corps ne compte QUE quand la bête est elle-même embarquée sur un navire, cf.
 *  `embarkedEnc`/`possessionTotalEnc`, INCHANGÉS). Même garde-fou anti-cycle que `possessionTotalEnc`
 *  (les deux partagent `visited` — brique commune, pas de 3e sommation). PUR. */
export function possessionLoadEnc(p: Possession, all: Possession[], visited: Set<string> = new Set()): number {
  visited.add(p.uid);
  const childrenEnc = all
    .filter((c) => !c.destroyed && c.location.kind === 'embarquee' && c.location.hostUid === p.uid)
    .reduce((s, child) => s + possessionTotalEnc(child, all, visited), 0);
  return itemsEncumbrance(p.items) + cargoTotalEnc(p.cargo ?? []) + childrenEnc;
}

/** Enc TOTAL transitif (propre + charge portée, `possessionLoadEnc`), replié dans la capacité de
 *  l'hôte pour chaque embarquée (§5 de la spec). `visited` = garde-fou ANTI-CYCLE (un registre bien
 *  formé n'en a pas — l'embarquement le valide via `canEmbark`+capacité — mais la sommation ne doit
 *  jamais boucler sur un registre corrompu) : un uid déjà visité n'est pas re-descendu, sa part n'est
 *  pas recomptée. Raffinement RAW différé (T2) : MDG 12 l.35 module la sommation navale des objets
 *  portés — NON implémenté ici (cette sommation compte `itemsEncumbrance` plein pour tout porteur). */
export function possessionTotalEnc(p: Possession, all: Possession[], visited: Set<string> = new Set()): number {
  if (visited.has(p.uid)) return 0;
  visited.add(p.uid);
  return ownEnc(p) + possessionLoadEnc(p, all, visited);
}
