/**
 * LONGS VOYAGES — couche PURE de MDG 15 (l.3-436), données verbatim `sea-events.json` /
 * `sea-cargo.json`. Le rythme du voyage (milles/jour, Progression) vit dans `seaNavigation.ts` ; ici
 * l'HUMEUR DE MANANN, les ÉVÉNEMENTS de bord/de port et le COMMERCE MARITIME.
 *
 * RAW :
 *  - Humeur de Manann (l.83-125) : total cumulé PAR NAVIRE ; « Vous ne pouvez obtenir chaque
 *    modificateur qu'une seule fois et les sacrifices ne sont pas cumulatifs » (l.85) → chaque
 *    facteur appliqué UNE fois (registre `applied`).
 *  - Événements de bord (l.89) : « Tous les 1d10 jours … Les lancers dans ce tableau sont modifiés
 *    par le score actuel d'Humeur de Manann ».
 *  - Événements de port (l.127-129) : à l'accostage, 2d10 (« dans les 2d10 heures ») ; Humeur
 *    négative → −1 au 2d10, positive → +1.
 *  - Commerce maritime (l.309-399) : achat (Production/Surplus, taille du lot = (Taille + Richesse +
 *    Surplus) × 1d10 × 10, 1 sur le d10 = rien) ; vente (nombre visé selon la relation du port au
 *    bien, Prix d'offre par Richesse+Taille+Demande) ; brader à 25 % du prix de base (l.399).
 *  - Cargaisons (l.402-436) : type au d100 PAR SAISON, prix de base par saison (Vin : 3d10 CO).
 */
import seaEventsJson from '../data/sea-events.json';
import seaCargoJson from '../data/sea-cargo.json';
import { findTableEntry, findTableEntryIndex, tableOuverte, type BandeOuverte } from './tables';
import { d10, roll as rollDice, type RNG, defaultRNG } from './dice';
import { rollTest, type TestResult } from './tests';
import type { Difficulty } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { Season } from './travelStages';
// Tronc commun cargaison (partagé avec le commerce terrestre MSRC, `landCargo.ts`) — modèle de lot,
// tirage saisonnier, prix de base. Re-exporté pour les importeurs historiques de ce module.
import { type CargoDef, type CargoEntry, isEchangeable, isTradeHubColumn, rollSeasonalCargo } from './cargo';
export { type CargoDef, type CargoEntry, type CargoLot, isEchangeable, cargoTotalEnc, removeCargo, spoilCargoByEnc, spoilCargoByPct, cargoBasePrice } from './cargo';

// ── Types de la donnée ───────────────────────────────────────────────────────────────────────────

export interface ManannFactor { id: string; label: string; effect: { sign: 1 | -1; flat: number; d10: number } }

export interface SeaEventDef {
  min: number;
  max: number;
  id: string;
  label: string;
  desc: string;
  kind: string;
  params?: Record<string, unknown>;
}

/** Palier du VOYAGE RAPIDE (l.33-37) : cran du d10, conséquences en % + Coups Critiques. */
export interface FastVoyagePalier {
  min: number;
  max: number;
  id: string;
  label: string;
  desc: string;
  crewLostPct: number;
  cargoLostPct: number;
  hullLostPct: number;
  criticals: number;
}

const EVENTS = seaEventsJson as unknown as {
  manann: { base: number; portEventMod: number; factors: ManannFactor[] };
  boardEvents: SeaEventDef[];
  portEvents: SeaEventDef[];
  fastVoyage: { paliers: FastVoyagePalier[] };
};

/** Palier de SURCHARGE de la cale (MDG 12 l.70-75) : `fromPct` = seuil strict (>) en % de la Contenance,
 *  `mMod`/`manoeuvreDR` = −M et −DR Manœuvre appliqués au navire. */
export interface OverloadPalier { id: string; fromPct: number; label: string; mMod: number; manoeuvreDR: number }

/** Bande du tableau du Prix d'offre (l.378-383) : fourchette de Richesse + Taille + Demande
 *  (`BandeOuverte`, tronc commun) et son % du prix de base. */
interface OfferPriceBand extends BandeOuverte { pct: number }

const CARGO = seaCargoJson as unknown as {
  cargoes: CargoEntry[];
  overload: { hardCapPct: number; paliers: OverloadPalier[] };
  buy: { availabilityMultiplier: number; merchantSkill: { d10: number; plus: number }; bigPortSkill: { d10: number; plus: number }; partialPurchaseSellerDR: number; surplusSellerDR: number };
  sell: {
    offerPrice: OfferPriceBand[];
    noProduceTargetPerSize: number; commerceBonus: number;
    producesGossip: { difficulty: Difficulty; targetPerSize: number; minMilles: number };
    surplusGossip: { difficulty: Difficulty; targetPerSize: number };
    sellerDR: { noProduce: number; demand: number; produces: number; surplus: number };
    dumpingPctOfBase: number;
  };
  opportunite: {
    investMaxEnc: boolean;
    test: { skill: RefDesignee; difficulty: Difficulty; totalDR: number; maxAttempts: number };
    outcomes: { on: 'success' | 'failure'; minMissing?: number; minExtraDR?: number; pct: number }[];
  };
};

export const MANANN_FACTORS = EVENTS.manann.factors;
export const BOARD_EVENTS = EVENTS.boardEvents;
export const PORT_EVENTS = EVENTS.portEvents;
export const FAST_VOYAGE_PALIERS = EVENTS.fastVoyage.paliers;
/** Le catalogue COMPLET tel qu'il est authoré : marchandises ET marqueurs de l'Index (MDG 15 l.321) —
 *  vocabulaire de la colonne Production. À n'employer que pour NOMMER une entrée de cette colonne. */
export const CARGO_ENTRIES: readonly CargoEntry[] = CARGO.cargoes;
/** Catalogue ÉCHANGEABLE : filtré À LA SOURCE sur le champ d'exclusion, pour que négoce, table de
 *  cargaison aléatoire, éditeur et Compendium ne voient jamais un marqueur. */
export const CARGOES: readonly CargoDef[] = CARGO.cargoes.filter(isEchangeable);
export const OPPORTUNITE = CARGO.opportunite;
/** La table du Prix d'offre telle que `findTableEntry` la lit (`tableOuverte`, tronc commun — sa
 *  dernière bande est OUVERTE, MDG 15 l.383 « 4 ou plus »). */
const OFFER_PRICE_LOOKUP = tableOuverte(CARGO.sell.offerPrice);
/** Résout une MARCHANDISE (les marqueurs ne sont ni achetables ni vendables). */
export const findCargoById = (id: string): CargoDef | undefined => CARGOES.find((c) => c.id === id);
/** Résout une entrée QUELCONQUE de la colonne Production, marqueur compris (libellé d'affichage). */
export const findCargoEntryById = (id: string): CargoEntry | undefined => CARGO_ENTRIES.find((c) => c.id === id);
/** La colonne Production d'un PORT le désigne-t-elle comme plaque tournante (l.321) ? Lit le champ
 *  `tradeHub` de l'entrée marqueur du catalogue maritime (SSOT `isTradeHubEntry`). PUR. */
export const isSeaTradeHub = (production: readonly string[] | undefined): boolean =>
  isTradeHubColumn(production, findCargoEntryById);
export const findManannFactor = (id: string): ManannFactor | undefined => EVENTS.manann.factors.find((f) => f.id === id);

// ── Surcharge de la cale (MDG 12 l.70-75) ──────────────────────────────────────────────────────

/** Plafond DUR de charge (% de la Contenance) : au-delà « Impossible de prendre la mer » (MDG 12 l.75). */
export const OVERLOAD_HARD_CAP_PCT: number = CARGO.overload.hardCapPct;

/** État de SURCHARGE d'une cale : palier RAW atteint + effets, et `canSail` = false au-delà du plafond dur. */
export interface CargoOverload {
  /** Charge en % de la Contenance (affichage). */
  ratioPct: number;
  /** id du palier atteint (`null` = charge ≤ Contenance, aucun effet). */
  palierId: string | null;
  label: string;
  /** −M appliqué au navire (MDG 12 l.72-74). */
  mMod: number;
  /** −DR Manœuvre appliqué au navire (MDG 12 l.72-74). */
  manoeuvreDR: number;
  /** `false` au-delà du plafond dur (> 150 % — MDG 12 l.75 : impossible de prendre la mer). */
  canSail: boolean;
}

/** Palier de surcharge d'une cale chargée à `enc` Enc pour une Contenance `capacity` (MDG 12 l.70-75).
 *  Seuils STRICTS (fraction non arrondie pour éviter le faux palier aux bornes). PUR. */
export function cargoOverload(enc: number, capacity: number): CargoOverload {
  const ratio = capacity > 0 ? enc / capacity : 0;
  let chosen: OverloadPalier | null = null;
  for (const p of CARGO.overload.paliers) if (ratio > p.fromPct / 100) chosen = p; // paliers croissants → dernier franchi
  return {
    ratioPct: Math.round(ratio * 100),
    palierId: chosen?.id ?? null,
    label: chosen?.label ?? 'Charge nominale',
    mMod: chosen?.mMod ?? 0,
    manoeuvreDR: chosen?.manoeuvreDR ?? 0,
    canSail: ratio <= OVERLOAD_HARD_CAP_PCT / 100,
  };
}

/** Enc maximum EMBARQUABLE avant le plafond dur (MDG 12 l.75) — Contenance × 150 %. PUR. */
export function overloadMaxEnc(capacity: number): number {
  return Math.floor(capacity * OVERLOAD_HARD_CAP_PCT / 100);
}

// ── Humeur de Manann (l.83-125) ──────────────────────────────────────────────────────────────────

/** Humeur de Manann PERSISTANTE d'un navire (l.85 : « Ce nombre s'applique au navire lui-même »). */
export interface ManannMood {
  score: number;
  /** Facteurs DÉJÀ appliqués (l.85 : chaque modificateur une seule fois, sacrifices non cumulatifs). */
  applied: string[];
}

export const MANANN_BASE: ManannMood = { score: EVENTS.manann.base, applied: [] };

/** Applique un facteur d'Humeur (id du tableau EFFET SUR L'HUMEUR DE MANANN) : roule ses dés signés,
 *  UNE seule fois par navire (l.85) — déjà appliqué → no-op. PUR (nouvel état). */
export function applyManannFactor(mood: ManannMood, factorId: string, rng: RNG = defaultRNG): { mood: ManannMood; delta: number; label?: string } {
  const f = findManannFactor(factorId);
  if (!f || mood.applied.includes(factorId)) return { mood, delta: 0 };
  const delta = f.effect.sign * (f.effect.flat + (f.effect.d10 > 0 ? rollDice(f.effect.d10, 10, rng) : 0));
  return { mood: { score: mood.score + delta, applied: [...mood.applied, factorId] }, delta, label: f.label };
}

/** Delta LIBRE d'Humeur (événements : « ajoutez 2d10 à son Humeur », Fête de Manann…) — pas un facteur
 *  du tableau, donc hors registre `applied`. PUR. */
export function addManann(mood: ManannMood, delta: number): ManannMood {
  return { ...mood, score: mood.score + delta };
}

// ── Événements (l.89 + l.127-129) ────────────────────────────────────────────────────────────────

/** Nombre de jours en mer avant le PROCHAIN événement de bord : « Tous les 1d10 jours » (l.89, l.15 —
 *  les jours ne doivent pas être consécutifs : le compteur se suspend au port, l.19). PUR. */
export function rollDaysToNextEvent(rng: RNG = defaultRNG): number {
  return d10(rng);
}

/** Événement de bord NOMMÉ (par `id`, sinon par `kind` — plusieurs événements peuvent partager un kind,
 *  ex. `navire-hostile` = Langskip skaeling / Cogue pirate). Pour forcer un tirage en recette (#332). */
export const seaBoardEventById = (idOrKind: string): SeaEventDef | undefined =>
  EVENTS.boardEvents.find((e) => e.id === idOrKind) ?? EVENTS.boardEvents.find((e) => e.kind === idOrKind);

/** Tire un ÉVÉNEMENT DE PORT à l'accostage (l.127-129) : 2d10, ±1 selon le signe de l'Humeur ;
 *  il « se produit dans les 2d10 heures après accostage ». PUR. */
export function rollPortEvent(manannScore: number, rng: RNG = defaultRNG): { roll: number; hours: number; event: SeaEventDef } {
  const mod = manannScore < 0 ? -EVENTS.manann.portEventMod : manannScore > 0 ? EVENTS.manann.portEventMod : 0;
  const roll = d10(rng) + d10(rng) + mod;
  return { roll, hours: d10(rng) + d10(rng), event: findTableEntry(EVENTS.portEvents, roll) };
}

// ── Longs voyages TRÈS RAPIDES (l.21-37) ─────────────────────────────────────────────────────────

/** VOYAGE RAPIDE (l.21-37) : un trajet résolu en UN Test. « Lancez le dé dans le tableau … en
 *  soustrayant 1 au résultat par semaine passée en mer, puis en ajoutant ou retirant la dizaine de
 *  l'Humeur de Manann et les DR du Test d'équipage de Rude épreuve » (l.28) → palier `[min,max]`
 *  (`findTableEntry`). `manannScore` : Humeur de Manann du navire (sa dizaine SIGNÉE est le mod, l.26).
 *  PUR (RNG injecté). */
export function resolveFastVoyage(
  crewDR: number, manannScore: number, weeksAtSea: number, rng: RNG = defaultRNG,
): { roll: number; manannTens: number; result: number; palier: FastVoyagePalier } {
  const roll = d10(rng);
  const manannTens = Math.trunc(manannScore / 10); // « la dizaine de l'Humeur de Manann » (l.26/l.28)
  const result = roll - Math.max(0, weeksAtSea) + manannTens + crewDR;
  return { roll, manannTens, result, palier: findTableEntry(EVENTS.fastVoyage.paliers, result) };
}

// ── Commerce maritime (l.309-436) ────────────────────────────────────────────────────────────────

/** Profil COMMERCIAL d'un port (Index des ports, l.439-506) — porté par le LIEU de la carte du monde
 *  (`MapPlace.port`, donnée d'auteur). `production` : ids de cargaison, ou `'commerce'`/`'minimum-vital'`. */
export interface PortProfile {
  /** Taille du Lieu (1-4). */
  taille: number;
  /** Richesse du Lieu. */
  richesse: number;
  /** Colonne Production : ids de cargaison + éventuellement 'commerce' / 'minimum-vital'. */
  production: string[];
  /** Colonne Surplus : id → indice (+1, +2). */
  surplus?: Record<string, number>;
  /** Colonne Demande : id → indice. */
  demande?: Record<string, number>;
  /** Grand port cosmopolite (Marienburg/Lothern, l.343-349) : 3 cargaisons « commerce », marchands à 3d10+55. */
  cosmopolite?: boolean;
}

/** Cargaison ALÉATOIRE de la saison (l.402-418) : d100 dans la colonne saisonnière (tableau MARITIME). PUR. */
export function rollRandomCargo(season: Season, rng: RNG = defaultRNG): CargoDef {
  return rollSeasonalCargo([...CARGOES], season, rng);
}

/** Enc DISPONIBLE d'une cargaison à l'achat (l.323-331) : « additionnez la Taille et la Richesse du
 *  Lieu à tout Surplus de cette cargaison et multipliez le résultat par 1d10 × 10. Si le d10 donne
 *  un 1 … aucune cargaison de ce type ». PUR. */
export function rollCargoAvailability(port: PortProfile, cargoId: string, rng: RNG = defaultRNG): { d: number; enc: number } {
  const d = d10(rng);
  if (d === 1) return { d, enc: 0 };
  const surplus = port.surplus?.[cargoId] ?? 0;
  return { d, enc: (port.taille + port.richesse + surplus) * d * CARGO.buy.availabilityMultiplier };
}

/** Compétence Marchandage d'un commerçant pris au hasard (l.337 : 3d10+40 ; deux 10+ → Négociateur.
 *  Marienburg/Lothern l.349 : 3d10+55 ; un 10 suffit). PUR. */
export function rollMerchantSkill(cosmopolite: boolean, rng: RNG = defaultRNG): { value: number; negotiator: boolean } {
  const spec = cosmopolite ? CARGO.buy.bigPortSkill : CARGO.buy.merchantSkill;
  const dice = Array.from({ length: spec.d10 }, () => d10(rng));
  const tens = dice.filter((d) => d >= 10).length;
  return { value: dice.reduce((a, b) => a + b, 0) + spec.plus, negotiator: cosmopolite ? tens >= 1 : tens >= 2 };
}

/** Jet du marchand NPC pour un Marchandage opposé (Intermédiaire, RAW) — le héros roule via la porte
 *  du seam de jet (`state/rollSeam.ts`, `openRoll`), le marchand roule ICI (moteur PUR, reçoit `rng`,
 *  ne décide jamais du surfaçage — whitelist `src/engine/**` du garde #274). `merchantValue` est la
 *  valeur NUE du marchand (archétype tiré par `rollMerchantSkill`, aucun modificateur) : elle se pose
 *  telle quelle en grandeur de départage à DR égal (LDB 12 l.160). */
export function rollMerchantOpposition(merchantValue: number, rng: RNG = defaultRNG): TestResult {
  return { ...rollTest(merchantValue, 'intermediaire', rng), base: merchantValue };
}

/** DR de camp du Marchandage d'ACHAT (MDG 15 l.335-341). PUR — écart de camp ouvert en #1140. */
export function buySellerDR(partial: boolean, surplus: boolean): number {
  return (partial ? CARGO.buy.partialPurchaseSellerDR : 0) + (surplus ? CARGO.buy.surplusSellerDR : 0);
}

/** Relation d'un port à une cargaison à la VENTE (l.360-372). PUR. */
export type SellRelation = 'no-produce' | 'produces' | 'surplus';
export function sellRelation(port: PortProfile, cargoId: string): SellRelation {
  if ((port.surplus?.[cargoId] ?? 0) > 0) return 'surplus';
  if (port.production.includes(cargoId) && !isSeaTradeHub(port.production)) return 'produces';
  return 'no-produce';
}

export interface SellChance {
  /** Test de Ragot PRÉALABLE requis (ports qui produisent le bien) — `null` = pas de Test. */
  gossip: { difficulty: Difficulty } | null;
  /** Nombre visé du d100 « trouver un acheteur » (après le Ragot éventuel). */
  target: number;
  /** ±DR du vendeur aux Tests de Marchandage de la vente (l.387-397). */
  sellerDR: number;
}

/** Chances de TROUVER UN ACHETEUR + DR de Marchandage à la vente (l.355-397). `milles` = distance
 *  parcourue par le bateau (l.366 : « plus de 100 milles » requis pour vendre à un port producteur —
 *  sinon traité comme un port en Surplus, l.368). PUR. */
export function sellChance(port: PortProfile, cargoId: string, milles: number): SellChance {
  let rel = sellRelation(port, cargoId);
  if (rel === 'produces' && milles < CARGO.sell.producesGossip.minMilles) rel = 'surplus'; // l.368
  const demand = port.demande?.[cargoId] ?? 0;
  if (rel === 'no-produce') {
    return {
      gossip: null,
      target: (port.taille + demand) * CARGO.sell.noProduceTargetPerSize + (isSeaTradeHub(port.production) ? CARGO.sell.commerceBonus : 0),
      sellerDR: CARGO.sell.sellerDR.noProduce + (demand > 0 ? CARGO.sell.sellerDR.demand : 0),
    };
  }
  if (rel === 'produces') {
    return { gossip: { difficulty: CARGO.sell.producesGossip.difficulty }, target: port.taille * CARGO.sell.producesGossip.targetPerSize, sellerDR: CARGO.sell.sellerDR.produces };
  }
  return { gossip: { difficulty: CARGO.sell.surplusGossip.difficulty }, target: port.taille * CARGO.sell.surplusGossip.targetPerSize, sellerDR: CARGO.sell.sellerDR.surplus };
}

/** PRIX D'OFFRE d'un acheteur trouvé (l.374-383) : % du prix de base selon Richesse + Taille + Demande. PUR.
 *  La table commence à 1 et sa dernière bande est ouverte : une somme SOUS la table ne peut venir que
 *  d'un profil hors des indices imprimés (`defs-scenes/worldmap.ts` borne la saisie à 1..4 / 1..5). On
 *  la NOMME plutôt que de la laisser tomber sur une bande : le repli de `findTableEntry` offrirait le
 *  prix de base plein à un lieu que la table ne couvre pas. */
export function offerPricePct(port: PortProfile, cargoId: string): number {
  const sum = port.richesse + port.taille + (port.demande?.[cargoId] ?? 0);
  const i = findTableEntryIndex(OFFER_PRICE_LOOKUP, sum);
  if (i < 0) {
    throw new Error(
      `Prix d'offre : Richesse (${port.richesse}) + Taille (${port.taille}) + Demande (${port.demande?.[cargoId] ?? 0}) = ${sum}, hors du tableau (MDG 15 l.378-383, bandes 1 à « 4 ou plus ») — cargaison ${cargoId}.`,
    );
  }
  return 100 + OFFER_PRICE_LOOKUP[i].pct;
}

/** BRADER une cargaison invendable (l.399) : « pour un quart de son prix de base dans n'importe quel
 *  Lieu … "commerce" … ou … Demande pour ce bien ». `null` si le port ne s'y prête pas. PUR. */
export function dumpingPricePct(port: PortProfile, cargoId: string): number | null {
  return isSeaTradeHub(port.production) || (port.demande?.[cargoId] ?? 0) > 0 ? CARGO.sell.dumpingPctOfBase : null;
}

/** Issue du COMMERCE D'OPPORTUNITÉ (Activité en mer, l.276-286) : Test étendu de Marchandage Complexe
 *  (−10), 10 DR en ≤ 3 tentatives — échec de 6 DR → tout perdu ; échec → moitié ; succès → +10 % ;
 *  succès de 6 DR (16+) → +20 %. Renvoie le % de l'investissement récupéré. PUR. */
export function opportunityTradePct(totalDR: number): number {
  const need = CARGO.opportunite.test.totalDR;
  for (const o of CARGO.opportunite.outcomes) {
    if (o.on === 'failure' && o.minMissing != null && totalDR <= need - o.minMissing) return 100 + o.pct;
  }
  if (totalDR < need) return 100 + (CARGO.opportunite.outcomes.find((o) => o.on === 'failure' && o.minMissing == null)?.pct ?? -50);
  for (const o of CARGO.opportunite.outcomes) {
    if (o.on === 'success' && o.minExtraDR != null && totalDR >= need + o.minExtraDR) return 100 + o.pct;
  }
  return 100 + (CARGO.opportunite.outcomes.find((o) => o.on === 'success' && o.minExtraDR == null)?.pct ?? 10);
}

// La cargaison EMBARQUÉE (CargoLot, cargoTotalEnc, removeCargo) est désormais le tronc commun de
// `cargo.ts`, re-exporté en tête de ce module (partagé avec le commerce terrestre MSRC).
