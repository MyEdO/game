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
 *  - Événements de port (l.127-129) : à l'accostage, au dé de sa table (« dans les 2d10 heures ») ; Humeur
 *    négative → −1 au jet, positive → +1.
 *  - Commerce maritime (l.309-399) : achat (Production/Surplus, taille du lot = (Taille + Richesse +
 *    Surplus) × 1d10 × 10, 1 sur le d10 = rien) ; vente (nombre visé selon la relation du port au
 *    bien, Prix d'offre par Richesse+Taille+Demande) ; brader à 25 % du prix de base (l.399).
 *  - Cargaisons (l.402-436) : type au d100 PAR SAISON, prix de base par saison (Vin : 3d10 CO).
 */
import { t } from '../i18n';
import { seaCargo, seaEvents, type SeaCargoData, type SeaEventsData } from '../data';
import { deDeLaTableTiree, findTableEntry, findTableEntryIndex, tableOuverte, type DeDeTable } from './tables';
import { memoParVersion } from '../data/versionDataset';
import { d10, rollDice, tirerSigne, type RNG } from './dice';
import { rollTest, type TestResult } from './tests';
import type { Difficulty } from './types';
import type { SeaWeather } from './seaWeather';
import type { AggravationMeteo } from './ops';
import type { Season } from './travelStages';
// Tronc commun cargaison (partagé avec le commerce terrestre MSRC, `landCargo.ts`) — modèle de lot,
// tirage saisonnier, prix de base. Re-exporté pour les importeurs historiques de ce module.
import { type CargoDef, type Voie, findCargoById, isTradeHubColumn, rollSeasonalCargo } from './cargo';
import { tableTotale } from '../lib/tableTotale';

/** La voie du catalogue que porte la table de ce livre (MDG 15 l.406-418). */
export const VOIE_MARITIME: Voie = 'mer';
export { type CargoDef, type CargoLot, isEchangeable, cargoTotalEnc, removeCargo, spoilCargoByEnc, spoilCargoByPct, cargoBasePrice } from './cargo';

// ── Types de la donnée ───────────────────────────────────────────────────────────────────────────

/** Un facteur d'Humeur de Manann (MDG 15 l.83-129). */
export type ManannFactor = SeaEventsData['manann']['factors'][number];

/** Climat imposé par un événement : les seuls axes qu'il fixe. MDG 15 l.189, l.199, l.219, l.226, l.248, l.257 */
type MeteoImposee = Partial<SeaWeather>;

/** Modificateur du navire posé par l'op `navireMod` : levé au carénage (`carenage`), au prochain événement de
 *  bord (`evenementDeBord`) ou à son échéance d'horloge (minute `gameTime`). `evite` : les périls que le navire
 *  ne heurte pas. MDG 15 l.184-185, l.187-188, l.228, l.229 */
export interface ModificateurDuNavire { label: string; m?: number; manDR?: number; evite?: string[]; jusqua: 'carenage' | 'evenementDeBord' | number }
/** Météo imposée au navire par l'op `meteoImposee`, jusqu'à son échéance d'horloge (minute `gameTime`).
 *  MDG 15 l.189, l.196-197, l.199, l.219, l.226-227, l.248, l.257 */
export interface MeteoImposeeDuNavire { label: string; jusqua: number; meteo?: MeteoImposee; ventInverse?: true; aggravation?: AggravationMeteo }

/** Les modificateurs encore actifs à la minute `now`. PUR. */
export const modificateursActifs = (mods: readonly ModificateurDuNavire[] | undefined, now: number): ModificateurDuNavire[] =>
  (mods ?? []).filter((m) => typeof m.jusqua !== 'number' || m.jusqua > now);
/** Les modificateurs qui survivent à un événement de bord : il lève ceux qui tiennent « jusqu'au prochain ». PUR. */
export const modificateursApresUnEvenement = (mods: readonly ModificateurDuNavire[] | undefined): ModificateurDuNavire[] =>
  (mods ?? []).filter((m) => m.jusqua !== 'evenementDeBord');
/** Le modificateur actif à la minute `now` qui fait éviter le péril `perilId`, s'il y en a un. PUR. */
export const evitementDuPeril = (mods: readonly ModificateurDuNavire[] | undefined, now: number, perilId: string): ModificateurDuNavire | undefined =>
  modificateursActifs(mods, now).find((m) => m.evite?.includes(perilId));
/** Les modificateurs levés au carénage (« jusqu'à ce que la coque soit raclée », MDG 15 l.185). PUR. */
export const modificateursAuCarenage = (mods: readonly ModificateurDuNavire[] | undefined): ModificateurDuNavire[] =>
  (mods ?? []).filter((m) => m.jusqua === 'carenage');
/** Somme d'un axe (`m`, `manDR`) des modificateurs actifs à la minute `now`. PUR. */
export const sommeDesModificateurs = (mods: readonly ModificateurDuNavire[] | undefined, now: number, axe: 'm' | 'manDR'): number =>
  modificateursActifs(mods, now).reduce((s, m) => s + (m[axe] ?? 0), 0);
/** Les météos imposées encore actives à la minute `now`, dans leur ordre de pose. PUR. */
export const meteosActives = (meteos: readonly MeteoImposeeDuNavire[] | undefined, now: number): MeteoImposeeDuNavire[] =>
  (meteos ?? []).filter((m) => m.jusqua > now);

/** Un Événement de bord ou d'escale (MDG 15 l.134, l.243), joué par `runFlow` (`consequence`). */
export type SeaEventDef = SeaEventsData['boardEvents']['entries'][number];

/** Palier du VOYAGE RAPIDE (MDG 15 l.33-37), joué par `runFlow` (`consequence`). */
export type FastVoyagePalier = SeaEventsData['fastVoyage']['entries'][number];

/** Palier de SURCHARGE de la cale (MDG 12 l.70-75) : `pctDepuis` = seuil strict (>) en % de la Contenance,
 *  `mMod`/`drDeManoeuvre` = −M et −DR Manœuvre appliqués au navire. */
type OverloadPalier = SeaCargoData['surcharge']['paliers'][number];

const CARGO = seaCargo;

export const MANANN_FACTORS = seaEvents.manann.factors;
export const BOARD_EVENTS = seaEvents.boardEvents.entries;
export const PORT_EVENTS = seaEvents.portEvents.entries;
export const FAST_VOYAGE_PALIERS = seaEvents.fastVoyage.entries;
/** Les tables d'événements et de paliers telles que `findTableEntry` les lit (`tableOuverte`) : leurs
 *  bandes extrêmes sont ouvertes (MDG 15). Mémoïsées sur leur dataset quand le Codex les édite. */
export const evenementsDeBord = memoParVersion('seaBoardEvents', () => tableOuverte(BOARD_EVENTS));
/** Le dé du Tableau des événements de bord, lu à l'appel. */
export const deDesEvenementsDeBord = (): DeDeTable => deDeLaTableTiree(seaEvents.boardEvents);
const evenementsDePort = memoParVersion('seaPortEvents', () => tableOuverte(PORT_EVENTS));
/** Le dé du Tableau des événements d'escale, lu à l'appel. */
export const deDesEvenementsDePort = (): DeDeTable => deDeLaTableTiree(seaEvents.portEvents);
const paliersDeVoyageRapide = memoParVersion('seaFastVoyage', () => tableOuverte(FAST_VOYAGE_PALIERS));
/** Le dé du tableau du Voyage rapide, lu à l'appel. */
export const deDuVoyageRapide = (): DeDeTable => deDeLaTableTiree(seaEvents.fastVoyage);
export const OPPORTUNITE = CARGO.opportunite;
/** La table du Prix d'offre telle que `findTableEntry` la lit (`tableOuverte`, tronc commun — sa
 *  dernière bande est OUVERTE, MDG 15 l.383 « 4 ou plus »). */
const bandesDuPrixDOffre = memoParVersion('seaCargo', () => tableOuverte(CARGO.vente.prixDOffre));
export const findManannFactor = (id: string): ManannFactor | undefined => seaEvents.manann.factors.find((f) => f.id === id);

// ── Surcharge de la cale (MDG 12 l.70-75) ──────────────────────────────────────────────────────

/** Plafond DUR de charge (% de la Contenance) : au-delà « Impossible de prendre la mer » (MDG 12 l.75). */
export const overloadHardCapPct = (): number => CARGO.surcharge.pctPlafond;

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
  drDeManoeuvre: number;
  /** `false` au-delà du plafond dur (> 150 % — MDG 12 l.75 : impossible de prendre la mer). */
  canSail: boolean;
}

/** Palier de surcharge d'une cale chargée à `enc` Enc pour une Contenance `capacity` (MDG 12 l.70-75).
 *  Seuils STRICTS (fraction non arrondie pour éviter le faux palier aux bornes). PUR. */
export function cargoOverload(enc: number, capacity: number): CargoOverload {
  const ratio = capacity > 0 ? enc / capacity : 0;
  let chosen: OverloadPalier | null = null;
  for (const p of CARGO.surcharge.paliers) if (ratio > p.pctDepuis / 100) chosen = p; // paliers croissants → dernier franchi
  return {
    ratioPct: Math.round(ratio * 100),
    palierId: chosen?.id ?? null,
    label: chosen ? chosen.label : t('cargo.chargeNominale'),
    mMod: chosen?.mMod ?? 0,
    drDeManoeuvre: chosen?.drDeManoeuvre ?? 0,
    canSail: ratio <= overloadHardCapPct() / 100,
  };
}

/** Enc maximum EMBARQUABLE avant le plafond dur (MDG 12 l.75) — Contenance × 150 %. PUR. */
export function overloadMaxEnc(capacity: number): number {
  return Math.floor(capacity * overloadHardCapPct() / 100);
}

/** Seuils de palier de surcharge en Enc pour une Contenance `capacity` (MDG 12 l.70-75). PUR. */
export function overloadMarks(capacity: number): number[] {
  return CARGO.surcharge.paliers.map((p) => Math.round(capacity * p.pctDepuis / 100));
}

// ── Humeur de Manann (l.83-125) ──────────────────────────────────────────────────────────────────

/** Humeur de Manann PERSISTANTE d'un navire (l.85 : « Ce nombre s'applique au navire lui-même »). */
export interface ManannMood {
  score: number;
  /** Facteurs DÉJÀ appliqués (l.85 : chaque modificateur une seule fois, sacrifices non cumulatifs). */
  applied: string[];
}

/** Humeur de Manann d'un registre NEUF, sa base lue à l'appel. */
export const manannBase = (): ManannMood => ({ score: seaEvents.manann.base, applied: [] });

/** Applique un facteur d'Humeur (id du tableau EFFET SUR L'HUMEUR DE MANANN) : roule ses dés signés,
 *  UNE seule fois par navire (l.85) — déjà appliqué → no-op. PUR (nouvel état). */
export function applyManannFactor(mood: ManannMood, factorId: string, rng: RNG): { mood: ManannMood; delta: number; label?: string } {
  const f = findManannFactor(factorId);
  if (!f || mood.applied.includes(factorId)) return { mood, delta: 0 };
  const delta = tirerSigne(f.effect, rng);
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
export function rollDaysToNextEvent(rng: RNG): number {
  return d10(rng);
}

/** Événement de bord NOMMÉ par son `id`. Pour forcer un tirage en recette (#332). */
export const seaBoardEventById = (id: string): SeaEventDef | undefined => BOARD_EVENTS.find((e) => e.id === id);

/** Tire un ÉVÉNEMENT DE PORT à l'accostage (l.127-129) au dé de sa table, ±1 selon le signe de l'Humeur ;
 *  il « se produit dans les 2d10 heures après accostage ». PUR. */
export function rollPortEvent(manannScore: number, rng: RNG): { roll: number; hours: number; event: SeaEventDef } {
  const mod = manannScore < 0 ? -seaEvents.manann.portEventMod : manannScore > 0 ? seaEvents.manann.portEventMod : 0;
  const roll = rollDice(deDesEvenementsDePort(), rng) + mod;
  return { roll, hours: d10(rng) + d10(rng), event: findTableEntry(evenementsDePort(), roll) };
}

// ── Longs voyages TRÈS RAPIDES (l.21-37) ─────────────────────────────────────────────────────────

/** VOYAGE RAPIDE (l.21-37) : un trajet résolu en UN Test. « Lancez le dé dans le tableau … en
 *  soustrayant 1 au résultat par semaine passée en mer, puis en ajoutant ou retirant la dizaine de
 *  l'Humeur de Manann et les DR du Test d'équipage de Rude épreuve » (l.28) → palier `[min,max]`
 *  (`findTableEntry`). `manannScore` : Humeur de Manann du navire (sa dizaine SIGNÉE est le mod, l.26).
 *  PUR (RNG injecté). */
export function resolveFastVoyage(
  crewDR: number, manannScore: number, weeksAtSea: number, rng: RNG,
): { roll: number; manannTens: number; result: number; palier: FastVoyagePalier } {
  const roll = rollDice(deDuVoyageRapide(), rng);
  const manannTens = Math.trunc(manannScore / 10); // « la dizaine de l'Humeur de Manann » (l.26/l.28)
  const result = roll - Math.max(0, weeksAtSea) + manannTens + crewDR;
  return { roll, manannTens, result, palier: findTableEntry(paliersDeVoyageRapide(), result) };
}

// ── Commerce maritime (l.309-436) ────────────────────────────────────────────────────────────────

/** Profil COMMERCIAL d'un port (Index des ports, l.439-506) — porté par le LIEU de la carte du monde
 *  (`MapPlace.port`, donnée d'auteur). `production` : ids de cargaison, ou `'commerce-mer'`/`'minimum-vital'`. */
export interface PortProfile {
  /** Taille du Lieu (1-4). */
  taille: number;
  /** Richesse du Lieu. */
  richesse: number;
  /** Colonne Production : ids de cargaison de la voie `mer`, marqueurs compris (`commerce-mer`, `minimum-vital`). */
  production: string[];
  /** Colonne Surplus : id → indice (+1, +2). */
  surplus?: Record<string, number>;
  /** Colonne Demande : id → indice. */
  demande?: Record<string, number>;
  /** Grand port cosmopolite (Marienburg/Lothern, l.343-349) : 3 cargaisons « commerce », marchands à 3d10+55. */
  cosmopolite?: boolean;
}

/** ALTÉRATION du marché du port `placeId` posée par l'op `marcheDuPort`, jusqu'au départ du navire (`escale`)
 *  ou à son échéance d'horloge (minute `gameTime`) : bascule des colonnes de l'Index (`colonnes`),
 *  Demande accrue d'une cargaison (`demande`), ou lot offert à l'achat sous son prix de base (`offre`).
 *  MDG 15 l.253, l.256, l.259, l.263 */
export type AlterationDuMarche = { placeId: string; jusqua: 'escale' | number } & (
  | { colonnes: 'penurie' | 'saturation'; demande?: never; offre?: never }
  | { demande: { cargoId: string; delta: number }; colonnes?: never; offre?: never }
  | { offre: { cargoId: string; enc: number; remisePct: number }; colonnes?: never; demande?: never }
);

/** Les altérations du port `placeId` encore actives à la minute `now`, dans leur ordre de pose. PUR. */
export const alterationsDuPort = (alterations: readonly AlterationDuMarche[], placeId: string, now: number): AlterationDuMarche[] =>
  alterations.filter((a) => a.placeId === placeId && (a.jusqua === 'escale' || a.jusqua > now));

/** Le profil de marché du port sous ses altérations, dans leur ordre de pose. Pénurie (l.253) : les marchandises
 *  de la Production ne sont plus disponibles, celles du Surplus passent en Production. Saturation (l.263) : les
 *  marchandises de la Production passent en Surplus à +1, le Surplus double. Les marqueurs de la colonne
 *  Production (`commerce-mer`, `minimum-vital`) restent. Demande (l.259) : l'indice de la cargaison croît. PUR. */
export function profilDuMarche(port: PortProfile, alterations: readonly AlterationDuMarche[]): PortProfile {
  return alterations.reduce<PortProfile>((p, a) => {
    if (a.demande) return { ...p, demande: { ...p.demande, [a.demande.cargoId]: (p.demande?.[a.demande.cargoId] ?? 0) + a.demande.delta } };
    if (!a.colonnes) return p;
    const marqueurs = p.production.filter((id) => !findCargoById(id));
    const marchandises = p.production.filter((id) => findCargoById(id));
    const surplus = p.surplus ?? {};
    if (a.colonnes === 'penurie') return { ...p, production: [...marqueurs, ...Object.keys(surplus).filter((id) => !marqueurs.includes(id))], surplus: {} };
    return {
      ...p,
      production: marqueurs,
      surplus: { ...tableTotale(marchandises, () => 1), ...Object.fromEntries(Object.entries(surplus).map(([id, n]) => [id, n * 2])) },
    };
  }, port);
}

/** Cargaison ALÉATOIRE de la saison (l.402-418) : d100 dans la colonne saisonnière (tableau MARITIME). PUR. */
export function rollRandomCargo(season: Season, rng: RNG): CargoDef {
  return rollSeasonalCargo(VOIE_MARITIME, season, rng);
}

/** Enc DISPONIBLE d'une cargaison à l'achat (l.323-331) : « additionnez la Taille et la Richesse du
 *  Lieu à tout Surplus de cette cargaison et multipliez le résultat par 1d10 × 10. Si le d10 donne
 *  un 1 … aucune cargaison de ce type ». PUR. */
export function rollCargoAvailability(port: PortProfile, cargoId: string, rng: RNG): { d: number; enc: number } {
  const d = d10(rng);
  if (d === 1) return { d, enc: 0 };
  const surplus = port.surplus?.[cargoId] ?? 0;
  return { d, enc: (port.taille + port.richesse + surplus) * d * CARGO.achat.multiplicateurDeDisponibilite };
}

/** Compétence Marchandage d'un commerçant pris au hasard (l.337 : 3d10+40 ; deux 10+ → Négociateur.
 *  Marienburg/Lothern l.349 : 3d10+55 ; un 10 suffit). PUR. */
export function rollMerchantSkill(cosmopolite: boolean, rng: RNG): { value: number; negotiator: boolean } {
  const spec = cosmopolite ? CARGO.achat.competenceGrandPort : CARGO.achat.competenceDuMarchand;
  const dice = Array.from({ length: spec.d10 }, () => d10(rng));
  const tens = dice.filter((d) => d >= 10).length;
  return { value: dice.reduce((a, b) => a + b, 0) + spec.plus, negotiator: cosmopolite ? tens >= 1 : tens >= 2 };
}

/** Jet du marchand NPC pour un Marchandage opposé (Intermédiaire, RAW) — le héros roule via la porte
 *  du seam de jet (`noyau/rollSeam.ts`, `openRoll`), le marchand roule ICI (moteur PUR, reçoit `rng`,
 *  ne décide jamais du surfaçage — whitelist `src/engine/**` du garde #274). `merchantValue` est la
 *  valeur NUE du marchand (archétype tiré par `rollMerchantSkill`, aucun modificateur) : elle se pose
 *  telle quelle en grandeur de départage à DR égal (LDB 12 l.160). */
export function rollMerchantOpposition(merchantValue: number, rng: RNG): TestResult {
  return { ...rollTest(merchantValue, 'intermediaire', rng), base: merchantValue };
}

/** DR de camp du Marchandage d'ACHAT (MDG 15 l.335-341). PUR — écart de camp ouvert en #1140. */
export function buySellerDR(partial: boolean, surplus: boolean): number {
  return (partial ? CARGO.achat.drVendeurAchatPartiel : 0) + (surplus ? CARGO.achat.drVendeurSurplus : 0);
}

/** Relation d'un port à une cargaison à la VENTE (l.360-372). PUR. */
export type SellRelation = 'sansProduction' | 'production' | 'surplus';
export function sellRelation(port: PortProfile, cargoId: string): SellRelation {
  if ((port.surplus?.[cargoId] ?? 0) > 0) return 'surplus';
  if (port.production.includes(cargoId) && !isTradeHubColumn(port.production)) return 'production';
  return 'sansProduction';
}

export interface SellChance {
  /** Test de Ragot PRÉALABLE requis (ports qui produisent le bien) — `null` = pas de Test. */
  ragot: { difficulty: Difficulty } | null;
  /** Nombre visé du d100 « trouver un acheteur » (après le Ragot éventuel). */
  cible: number;
  /** ±DR du vendeur aux Tests de Marchandage de la vente (l.387-397). */
  drDuVendeur: number;
}

/** Chances de TROUVER UN ACHETEUR + DR de Marchandage à la vente (l.355-397). `milles` = distance
 *  parcourue par le bateau (l.366 : « plus de 100 milles » requis pour vendre à un port producteur —
 *  sinon traité comme un port en Surplus, l.368). PUR. */
export function sellChance(port: PortProfile, cargoId: string, milles: number): SellChance {
  let rel = sellRelation(port, cargoId);
  if (rel === 'production' && milles < CARGO.vente.ragotSiProduction.millesMin) rel = 'surplus'; // l.368
  const demand = port.demande?.[cargoId] ?? 0;
  if (rel === 'sansProduction') {
    return {
      ragot: null,
      cible: (port.taille + demand) * CARGO.vente.cibleParTailleSansProduction + (isTradeHubColumn(port.production) ? CARGO.vente.bonusDeCommerce : 0),
      drDuVendeur: CARGO.vente.drDuVendeur.sansProduction + (demand > 0 ? CARGO.vente.drDuVendeur.demande : 0),
    };
  }
  if (rel === 'production') {
    return { ragot: { difficulty: CARGO.vente.ragotSiProduction.difficulty }, cible: port.taille * CARGO.vente.ragotSiProduction.cibleParTaille, drDuVendeur: CARGO.vente.drDuVendeur.production };
  }
  return { ragot: { difficulty: CARGO.vente.ragotSiSurplus.difficulty }, cible: port.taille * CARGO.vente.ragotSiSurplus.cibleParTaille, drDuVendeur: CARGO.vente.drDuVendeur.surplus };
}

/** PRIX D'OFFRE d'un acheteur trouvé (l.374-383) : % du prix de base selon Richesse + Taille + Demande. PUR.
 *  La table commence à 1 et sa dernière bande est ouverte : une somme SOUS la table ne peut venir que
 *  d'un profil hors des indices imprimés (`defs-scenes/worldmap.ts` borne la saisie à 1..4 / 1..5). On
 *  la NOMME plutôt que de la laisser tomber sur une bande : le repli de `findTableEntry` offrirait le
 *  prix de base plein à un lieu que la table ne couvre pas. */
export function offerPricePct(port: PortProfile, cargoId: string): number {
  const sum = port.richesse + port.taille + (port.demande?.[cargoId] ?? 0);
  const bandes = bandesDuPrixDOffre();
  const i = findTableEntryIndex(bandes, sum);
  if (i < 0) {
    throw new Error(
      `Prix d'offre : Richesse (${port.richesse}) + Taille (${port.taille}) + Demande (${port.demande?.[cargoId] ?? 0}) = ${sum}, hors du tableau (MDG 15 l.378-383, bandes 1 à « 4 ou plus ») — cargaison ${cargoId}.`,
    );
  }
  return 100 + bandes[i].pct;
}

/** BRADER une cargaison invendable (l.399) : « pour un quart de son prix de base dans n'importe quel
 *  Lieu … "commerce" … ou … Demande pour ce bien ». `null` si le port ne s'y prête pas. PUR. */
export function dumpingPricePct(port: PortProfile, cargoId: string): number | null {
  return isTradeHubColumn(port.production) || (port.demande?.[cargoId] ?? 0) > 0 ? CARGO.vente.pctDeBradage : null;
}

/** Issue du COMMERCE D'OPPORTUNITÉ (Activité en mer, l.276-286) : Test étendu de Marchandage Complexe
 *  (−10), 10 DR en ≤ 3 tentatives — échec de 6 DR → tout perdu ; échec → moitié ; succès → +10 % ;
 *  succès de 6 DR (16+) → +20 %. Renvoie le % de l'investissement récupéré. PUR. */
export function opportunityTradePct(totalDR: number): number {
  const need = CARGO.opportunite.drCible;
  for (const o of CARGO.opportunite.outcomes) {
    if (o.on === 'echec' && o.manquantMin != null && totalDR <= need - o.manquantMin) return 100 + o.pct;
  }
  if (totalDR < need) return 100 + (CARGO.opportunite.outcomes.find((o) => o.on === 'echec' && o.manquantMin == null)?.pct ?? -50);
  for (const o of CARGO.opportunite.outcomes) {
    if (o.on === 'reussite' && o.drSupplementaireMin != null && totalDR >= need + o.drSupplementaireMin) return 100 + o.pct;
  }
  return 100 + (CARGO.opportunite.outcomes.find((o) => o.on === 'reussite' && o.drSupplementaireMin == null)?.pct ?? 10);
}

// La cargaison EMBARQUÉE (CargoLot, cargoTotalEnc, removeCargo) est désormais le tronc commun de
// `cargo.ts`, re-exporté en tête de ce module (partagé avec le commerce terrestre MSRC).
