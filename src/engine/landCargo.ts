/**
 * COMMERCE TERRESTRE & FLUVIAL — couche PURE de Mort sur le Reik Compagnon ch.11 « Règles du commerce »
 * (p.70-78), données verbatim `land-cargo.json` et voie `terre` de `cargoes.json`. PARENT terrestre du commerce maritime (MDG 15) : il
 * réutilise le TRONC COMMUN `cargo.ts` (modèle de lot, tirage saisonnier, prix de base, Marchandage) et
 * n'ajoute QUE ce que le RAW MSRC diffère du maritime :
 *  - Disponibilité en DEUX temps (l.22-38) : d'abord une CHANCE de trouver un marchand ((Taille + Richesse)
 *    × 10 %, doublée pour un Emplacement « Commerce »), PUIS la Taille de la cargaison ((Taille + Richesse)
 *    × [1d100 arrondi à la dizaine sup.] ; centre de Commerce → on inverse le d100 et on garde le plus grand).
 *  - Qualité SECRÈTE du Vin (l.93-104) : d10 → échelon de qualité → prix (Kemperbad : +2 échelons) ; Test
 *    d'Évaluation Intermédiaire (Accessible si Résistance à l'alcool ≥ 50).
 *  - Vente (l.133-160) : Demande = Taille × 10 (+30 si Commerce) ; Mise à prix par Richesse ; bradage à la
 *    MOITIÉ du prix de base (l.160, ≠ quart maritime).
 *  - Rumeurs commerciales (l.176-303) : Test de Ragot Complexe (−10) → Emplacement aléatoire → rumeur → un
 *    bien correspondant s'y vend le DOUBLE de son prix de base.
 */
import { landCargo, type LandCargoData } from '../data';
import { d100, roll, rollDice, type RNG } from './dice';
import { deDeLaTableTiree, findTableEntry, findTableEntryIndex } from './tables';
import type { Difficulty } from './types';
import type { Season } from './travelStages';
import { type CargoDef, type Voie, isTradeHubColumn, rollSeasonalCargo, cargoBasePrice, prixParPointDEnc } from './cargo';

/** La voie du catalogue que porte la table de ce livre (MSRC 13 l.71-78). */
export const VOIE_TERRESTRE: Voie = 'terre';

/** Rangée du Tableau des rumeurs commerciales (l.281-303). */
export type RumourRow = LandCargoData['rumeurs']['entries'][number];

const LAND = landCargo;

export const WINE_QUALITY = LAND.qualiteDuVin.entries;
/** Échelons de Richesse et leur Mise à prix — source UNIQUE des libellés d'authoring de l'éditeur de
 *  marché. Pourcentages de MSRC 13 l.150-156 ; libellés de l'échelle des indices l.52-60 (1 Pauvre …
 *  5 Florissant), que l'exemple l.174 confirme contre la colonne Description de l.150-156, décalée
 *  d'un cran dans le livre — arbitrage NOMMÉ en tête de
 *  `scripts/migrations/2026-09-01-1463-gram-seuils-prix-offre.mjs`. */
export const LAND_RICHESSE_ROWS: readonly LandCargoData['vente']['offreParRichesse'][number][] = LAND.vente.offreParRichesse;

/** Profil COMMERCIAL d'un Lieu terrestre/fluvial (Index géographique, l.183-278) — porté par le LIEU de
 *  la carte du monde (`MapPlace.market`, donnée d'auteur). Reproduit les colonnes de l'Index. */
export interface LandMarketProfile {
  /** Indice de Taille de la communauté (1 Hameau … 4 Grande ville, l.44-50). */
  taille: number;
  /** Indice de Richesse, l.52-60 : 1 Pauvre … 5 Florissant. « Misérable » y porte « - » — il n'a AUCUN
   *  indice, donc rien à authorer sous 1 (le schéma de scène borne la saisie à 1..5,
   *  `src/data/schemas/defs-scenes/worldmap.ts`). */
  richesse: number;
  /** Colonne Produits : ids d'entrées de la voie `terre` de `cargoes.json` — marchandises et/ou MARQUEURS
   *  (`echangeable: false`), le catalogue porte les deux (l.24-28, l.119). */
  produits: string[];
  /** Biens en Demande (facultatif) — informatif / futur ; la Demande RAW dépend surtout de Taille+Commerce. */
  demande?: string[];
  /** Le Lieu tire sa Richesse du COMMERCE (colonne Produits « Commerce ») → centre de commerce : on inverse
   *  le d100 de quantité et on garde le plus grand (l.40-42). Champ AUTHORÉ, distinct de la qualité de
   *  plaque tournante (`isTradeHubColumn`) : l'inversion ne vise que les Lieux qui en TIRENT leur Richesse. */
  commerceRichesse?: boolean;
  /** Régions à Vin/Eau-de-vie supérieurs (Kemperbad, Brandenburg…) : +N échelons de qualité (l.95). */
  wineBonusEchelons?: number;
  /** Réplique de halle (saveur maison, pas de RAW) de l'hôte du marché — surcharge PAR LIEU du défaut
   *  partagé (`lieux-services.json` id `marche`). Résolue par l'UI, jamais lue par une règle. */
  hostLine?: string;
  /** Bande d'ambiance du marché — surcharge PAR LIEU du défaut partagé. Résolue par l'UI (slot
   *  `backdrop` de `ScreenShell`), jamais lue par une règle. */
  backdrop?: { id: string };
}

/** Le Lieu est-il une plaque tournante du Commerce (colonne Produits « Commerce », l.28) ? PUR. */
export function hasCommerce(place: LandMarketProfile): boolean {
  return isTradeHubColumn(place.produits);
}

/** % de CHANCE de trouver un marchand ayant une cargaison à vendre (l.24-26) : (Taille + Richesse) × 10. PUR. */
export function availabilityPct(place: LandMarketProfile): number {
  return (place.taille + place.richesse) * LAND.achat.multiplicateurDeDisponibilite;
}

/** Recherche d'une cargaison à l'ACHAT (l.22-34) : 1d100 ≤ %chance → un marchand est trouvé. Un Emplacement
 *  « Commerce » lance DEUX fois (marchandises locales + une cargaison aléatoire de la table). PUR. */
export function rollFindMerchant(place: LandMarketProfile, rng: RNG): { pct: number; localRoll: number; localFound: boolean; randomRoll?: number; randomFound?: boolean } {
  const pct = availabilityPct(place);
  const localRoll = d100(rng);
  const out = { pct, localRoll, localFound: localRoll <= pct } as { pct: number; localRoll: number; localFound: boolean; randomRoll?: number; randomFound?: boolean };
  if (hasCommerce(place)) {
    const randomRoll = d100(rng);
    out.randomRoll = randomRoll;
    out.randomFound = randomRoll <= pct;
  }
  return out;
}

const roundUpToTens = (n: number): number => Math.ceil(n / 10) * 10;

/** Inverse d'un d100 (36 → 63, l.42) — inversion des deux chiffres ; 100 et « 00 » restent 100. */
function invertD100(v: number): number {
  if (v >= 100) return 100;
  const inv = (v % 10) * 10 + Math.floor(v / 10);
  return inv === 0 ? 100 : inv;
}

/** TAILLE de la cargaison disponible en points d'Encombrement (l.36-42) : (Taille + Richesse) × [1d100
 *  arrondi à la dizaine SUPÉRIEURE]. Centre de Commerce → on inverse aussi le d100 et on garde le plus
 *  grand des deux arrondis (l.40-42). PUR. */
export function rollCargoQuantity(place: LandMarketProfile, rng: RNG): { d100: number; enc: number } {
  const r = d100(rng);
  // L'inversion (l.40-42) ne concerne QUE les Lieux « tirant leur Richesse du Commerce » (`commerceRichesse`),
  // pas tout Lieu ayant « Commerce » en Produits — cf. l'exemple Grünburg (Commerce, mais 46 → 50, sans inversion).
  const tens = place.commerceRichesse ? Math.max(roundUpToTens(r), roundUpToTens(invertD100(r))) : roundUpToTens(r);
  return { d100: r, enc: (place.taille + place.richesse) * tens };
}

/** Cargaison ALÉATOIRE de la saison (Tableau des cargaisons aléatoires, l.71-78) — table TERRESTRE. PUR. */
export function rollRandomLandCargo(season: Season, rng: RNG): CargoDef {
  return rollSeasonalCargo(VOIE_TERRESTRE, season, rng);
}

/** ÉCHELON de qualité SECRÈTE d'une cargaison de Vin/Eau-de-vie : le dé de la table → qualité → prix de base
 *  en CO par point d'Enc (`prixParPointDEnc`). `bonusEchelons` monte le résultat de N crans dans le tableau.
 *  PUR. MSRC 13 l.91-104 */
export function rollWineQuality(rng: RNG, bonusEchelons = 0): { roll: number; label: string; price: number } {
  const { entries } = LAND.qualiteDuVin;
  const tirage = rollDice(deDeLaTableTiree(LAND.qualiteDuVin), rng);
  let idx = findTableEntryIndex(entries, tirage);
  if (idx < 0) idx = 0;
  idx = Math.min(entries.length - 1, idx + Math.max(0, bonusEchelons));
  const tier = entries[idx];
  return { roll: tirage, label: tier.label, price: prixParPointDEnc(tier.price, VOIE_TERRESTRE) };
}

/** Prix de BASE terrestre en CO par point d'Enc : le Vin/Eau-de-vie passe par la table de qualité SECRÈTE
 *  (`rollWineQuality`, + bonus régional du Lieu) ; les autres biens par la colonne saisonnière. PUR. MSRC 13 l.80-104 */
export function landCargoBasePrice(cargo: CargoDef, season: Season, place: LandMarketProfile | undefined, rng: RNG): number {
  if (cargo.wine) return rollWineQuality(rng, place?.wineBonusEchelons ?? 0).price;
  return cargoBasePrice(cargo, season, rng);
}

/** Difficulté du Test d'Évaluation de la qualité du Vin (l.95) : Intermédiaire, ou Accessible si le
 *  personnage a une Compétence Résistance à l'alcool ≥ 50. PUR. */
export function wineEvalDifficulty(alcoholResist: number): Difficulty {
  return alcoholResist >= LAND.achat.seuilResistanceAlcool ? LAND.achat.difficulteEvaluationVinFacile : LAND.achat.difficulteEvaluationVin;
}

/** RÉVÉLATION de la qualité SECRÈTE d'un lot de Vin après le Test d'Évaluation (l.95). La qualité réelle est
 *  déduite du prix de base FIGÉ à l'ouverture, en CO par point d'Enc (`WINE_QUALITY` converti, prix uniques). Succès → la vraie qualité ; échec
 *  → une FAUSSE indication décalée de |DR| échelons (« donnez-lui une fausse indication dont l'inexactitude est
 *  en rapport avec son degré d'échec », l.95 — direction vers le haut, ou vers le bas si plafonnée, pour rester FAUSSE ;
 *  la source ne chiffre ni la direction ni la magnitude du décalage, tranchées ici en donnée). PUR. */
export function wineEvalReveal(basePrice: number, success: boolean, sl: number): { trueLabel: string; shownLabel: string } {
  const last = WINE_QUALITY.length - 1;
  let idx = WINE_QUALITY.findIndex((w) => prixParPointDEnc(w.price, VOIE_TERRESTRE) === basePrice);
  if (idx < 0) idx = 0;
  const trueLabel = WINE_QUALITY[idx].label;
  if (success) return { trueLabel, shownLabel: trueLabel };
  const step = Math.max(1, Math.abs(sl));
  let shown = idx + step;
  if (shown > last) shown = idx - step; // décalage haut plafonné → on dévalue à la place (indication toujours FAUSSE)
  shown = Math.min(last, Math.max(0, shown));
  return { trueLabel, shownLabel: WINE_QUALITY[shown].label };
}

/** Surcoût d'un LOT PARTIEL à l'achat (l.131) : « le prix de base par 10 Points d'Encombrement doit être
 *  augmenté de 10 % ». Les marchands ne vendent pas moins de `encMin` (l.131). */
export const partialSurchargePct = (): number => LAND.achat.pctSurcoutPartiel;
export const minCargoEnc = (): number => LAND.achat.encMin;

/** Compétence Marchandage d'un petit marchand pris au hasard (l.129) : 2d10 + 30 (≈ 32-50). PUR. */
export function rollMerchantSkill(rng: RNG): number {
  return roll(LAND.achat.competenceDuMarchand.d10, 10, rng) + LAND.achat.competenceDuMarchand.plus;
}

/** Nombre visé du d100 « trouver un acheteur » à la VENTE (l.146) : Taille × 10, +30 si le Lieu a le
 *  Commerce en Produits. Un échec autorise une 2ᵉ tentative sur la moitié de la cargaison (couche flux). PUR. */
export function sellDemandTarget(place: LandMarketProfile): number {
  return place.taille * LAND.vente.cibleParTaille + (hasCommerce(place) ? LAND.vente.bonusDeCommerce : 0);
}

/** Mise à prix d'un acheteur (l.148-156) : % du prix de base selon l'Indice de richesse du Lieu. PUR.
 *  Renvoie le POURCENTAGE (ex. 80, 100). Le tableau donne une ligne par indice de 1 à 5 et rien
 *  au-delà : un indice hors de ce domaine est NOMMÉ, jamais rabattu en silence sur une bande. */
export function sellOfferPct(place: LandMarketProfile): number {
  const i = findTableEntryIndex(LAND.vente.offreParRichesse, place.richesse);
  if (i < 0) {
    throw new Error(
      `Mise à prix : Indice de richesse ${place.richesse} hors du tableau (MSRC 13 l.150-156, une ligne par indice de 1 à 5) — aucune ligne d'offre ne le couvre.`,
    );
  }
  return 100 + LAND.vente.offreParRichesse[i].pct;
}

/** BRADER une cargaison invendable (l.160) : « pour la moitié de son prix de base » à tout Lieu ayant le
 *  Commerce en Produits. `null` si le Lieu ne s'y prête pas. PUR. */
export function landDumpingPct(place: LandMarketProfile): number | null {
  return hasCommerce(place) ? LAND.vente.pctDeBradage : null;
}

/** Difficulté du Test de Ragot pour dénicher une rumeur commerciale (l.180) : Ragot Complexe (−10). */
export const gossipRule = LAND.ragot;

/** Tire une RUMEUR commerciale (Tableau des rumeurs, l.281-303) : le dé de la table (l.283) → une rumeur
 *  pointant les biens très demandés à un Emplacement. PUR. */
export function rollTradeRumour(rng: RNG): RumourRow {
  return structuredClone(findTableEntry(LAND.rumeurs.entries, rollDice(deDeLaTableTiree(LAND.rumeurs), rng))); // #2097
}

/** La cargaison `cargoId` correspond-elle à une rumeur (l.180 : « ils peuvent en vendre autant qu'ils le
 *  souhaitent pour le double du prix de base ») → le prix double. PUR. */
export function rumourMatches(rumour: RumourRow, cargoId: string): boolean {
  return rumour.biens.some((b) => b === cargoId);
}

/** Rumeur commerciale PERSISTANTE (MSRC 13 l.180) : à l'Emplacement `placeId` (un AUTRE Lieu, tiré via
 *  l'index géographique = un Lieu à `market` de la carte du monde), les `biens` sont très demandés et s'y
 *  vendent au `mult` du prix de base. Entendue sur un Test de Ragot Complexe (−10) ; le RAW ne lui donne
 *  aucune échéance (« ils peuvent en vendre autant qu'ils le souhaitent ») → non consommée, sans expiration. */
export interface TradeRumour {
  placeId: string;
  biens: string[];
  mult: number;
  /** Libellé de la rumeur (Tableau des rumeurs) — affichage. */
  text: string;
  /** Jour de campagne où la rumeur a été entendue — affichage. */
  heardDay: number;
}

/** Une rumeur du board vise-t-elle la vente de `cargoId` au Lieu `placeId` (l.180) ? PUR. */
export function tradeRumourApplies(r: TradeRumour, placeId: string, cargoId: string): boolean {
  return r.placeId === placeId && r.biens.includes(cargoId);
}

/** Multiplicateur de prix de vente de `cargoId` à `placeId` d'après le board (l.180 : ×2 si une rumeur
 *  correspond, 1 sinon). PUR. */
export function tradeRumourMult(board: readonly TradeRumour[], placeId: string, cargoId: string): number {
  const hit = board.find((r) => tradeRumourApplies(r, placeId, cargoId));
  return hit ? hit.mult : 1;
}
