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
import seaEventsJson from '../data/sea-events.json';
import { t } from '../i18n';
import seaCargoJson from '../data/sea-cargo.json';
import type { SeaCargoData } from '../data/schemas/defs/sea-cargo';
import { deDeLaTableTiree, findTableEntry, findTableEntryIndex, tableOuverte, type BandeOuverte, type DeDeTable } from './tables';
import { memoParVersion } from '../data/versionDataset';
import { d10, rollDice, tirerSigne, type EffetSigne, type QuantiteTiree, type RNG } from './dice';
import { rollTest, type TestResult } from './tests';
import type { Difficulty } from './types';
import type { ShipCritKey } from '../data/shipCriticals';
import type { SeaWeather } from './seaWeather';
import type { Flow, TestExige } from './flowCore';
import type { Season } from './travelStages';
// Tronc commun cargaison (partagé avec le commerce terrestre MSRC, `landCargo.ts`) — modèle de lot,
// tirage saisonnier, prix de base. Re-exporté pour les importeurs historiques de ce module.
import { type CargoDef, type Voie, isTradeHubColumn, marchandisesDe, rollSeasonalCargo } from './cargo';

/** La voie du catalogue que porte la table de ce livre (MDG 15 l.406-418). */
export const VOIE_MARITIME: Voie = 'mer';
export { type CargoDef, type CargoLot, isEchangeable, cargoTotalEnc, removeCargo, spoilCargoByEnc, spoilCargoByPct, cargoBasePrice } from './cargo';

// ── Types de la donnée ───────────────────────────────────────────────────────────────────────────

export interface ManannFactor { id: string; label: string; effect: EffetSigne }

/** Climat imposé par un événement : les seuls axes qu'il fixe. MDG 15 l.189, l.199, l.219, l.226, l.248, l.257 */
type MeteoImposee = Partial<SeaWeather>;
type VerrouMeteo = { days: QuantiteTiree; weather: MeteoImposee };
type CargaisonRepechee = { cargoEnc: QuantiteTiree };
type TirageListe = { roll: QuantiteTiree; contents: string[] };
type IssueDuTriton = { min: number; max: number };
type SansParametre = Record<string, never>;

/** Les paramètres que lit chaque genre d'Événement de bord (MDG 15 l.132-236). */
interface ParametresDeBord {
  triton: { victoryRoll: QuantiteTiree; impressed: IssueDuTriton; wrathful: IssueDuTriton; impressedManann: EffetSigne; wrathfulManann: EffetSigne };
  maelstrom: SansParametre;
  'monstre-puissant': { roll: QuantiteTiree; creatures: string[] };
  ouragan: { testType: string; difficulty: Difficulty; failCrits: number; critLocation: ShipCritKey };
  vortex: SansParametre;
  nemesis: SansParametre;
  'navire-hostile': { ship: string; crew: number; crewRef: string; chefRef?: string; greatGuns?: number };
  culte: { allegianceRoll: QuantiteTiree; initiatesRoll: QuantiteTiree };
  infestation: {
    testType: string; difficulty: Difficulty; targetDR: number; spoilEncPerNight: QuantiteTiree;
    diseaseChancePct: number; ratAttacks: QuantiteTiree; ratCC: number; ratWeapon: number;
  };
  'penurie-nourriture': { spoilPct: number };
  collision: SansParametre;
  'crabes-boxeurs': { mMod: number; manDR: number };
  'choix-vaisseau-fantome': { detourMMod: number; detourDays: number; moral: EffetSigne };
  'calme-plat': VerrouMeteo;
  'vaisseau-pestifere': { cargoCrates: QuantiteTiree; biscuitDays: QuantiteTiree; waterBarrels: QuantiteTiree; co: QuantiteTiree; resistDifficulty: Difficulty };
  'vents-inhabituels': { days: QuantiteTiree };
  bruine: VerrouMeteo;
  rien: SansParametre;
  bouteille: SansParametre;
  'autres-voyageurs': SansParametre;
  'debris-cargaison': CargaisonRepechee;
  'rafale-ghyran': { days: QuantiteTiree; drBonus: number; skills: string[]; specs: Record<string, string> };
  'canot-sauvetage': TirageListe;
  'beau-temps': VerrouMeteo;
  'ile-inconnue': SansParametre;
  'epave-cargaison': CargaisonRepechee;
  'ciel-degage': VerrouMeteo;
  'vents-favorables': { mMod: number };
  marsouin: { days: QuantiteTiree };
  'chance-navigateur': { days: QuantiteTiree; talent: string };
  manne: SansParametre;
}

/** Les paramètres que lit chaque genre d'Événement d'escale (MDG 15 l.243-263). */
interface ParametresDePort {
  embrigadement: { lostCrew: QuantiteTiree; gossipDifficulty: Difficulty; ransomCO: QuantiteTiree; stealthDifficulty: Difficulty; failExtraLostCrew: QuantiteTiree };
  'pretre-manann': { blessingCO: QuantiteTiree; blessingSilverPerSize: number; manann: EffetSigne };
  'controle-a-quai': { taxPct: number; bribeDifficulty: Difficulty; bribeCO: QuantiteTiree };
  tempete: { days: QuantiteTiree; weather: MeteoImposee; escalation: { roll: QuantiteTiree; min: number; weather: MeteoImposee } };
  'port-desert': { maxSize: number; moral: EffetSigne };
  'gangs-des-quais': { lostEnc: QuantiteTiree };
  'tache-noire': SansParametre;
  penuries: SansParametre;
  rien: SansParametre;
  'constructeur-itinerant': { metier: Record<string, number>; daysPerJob: QuantiteTiree };
  'offre-suspecte': { maxEnc: number; discountPct: number };
  'beau-temps': VerrouMeteo;
  'passager-clandestin': { perceptionDifficulty: Difficulty; discoverDays: QuantiteTiree; roll: QuantiteTiree; contents: string[] };
  'rumeurs-commerciales': { gossipDifficulty: Difficulty; demandBonus: number; days: QuantiteTiree };
  'offre-mission': { rewardCO: number };
  'bonne-peche': { rationPriceBronze: number };
  saturation: SansParametre;
}

/** Ce que toute rangée porte. `relache` : la rangée ne se joue qu'avec la relâche à terre accordée
 *  (`resolvePortArrival`). MDG 15 l.245, l.260 */
type Rangee = BandeOuverte & { id: string; label: string; desc: string; relache?: true };
type EvenementDe<P> = { [K in keyof P & string]: Rangee & { kind: K; params: P[K]; consequence?: never } }[keyof P & string];
/** Une rangée en GRAMMAIRE : sa suite mécanique est un `Flow` (`runFlow`), sans genre ; sans `consequence`,
 *  narrative. #1652 */
export type RangeeEnGrammaire = Rangee & { consequence?: Flow; kind?: never; params?: never };
/** Un Événement de bord : son `kind` et les paramètres que CE genre lit, ou sa `consequence`. */
export type EvenementDeBord = EvenementDe<ParametresDeBord> | RangeeEnGrammaire;
/** Un Événement d'escale : son `kind` et les paramètres que CE genre lit, ou sa `consequence`. */
export type EvenementDePort = EvenementDe<ParametresDePort> | RangeeEnGrammaire;
export type SeaEventDef = EvenementDeBord | EvenementDePort;

/** Palier du VOYAGE RAPIDE (l.33-37) : cran du dé de sa table, conséquences en % + Coups Critiques. */
export interface FastVoyagePalier extends BandeOuverte {
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
  boardEvents: { die: string; entries: EvenementDeBord[] };
  portEvents: { die: string; entries: EvenementDePort[] };
  fastVoyage: { die: string; entries: FastVoyagePalier[] };
};

/** Palier de SURCHARGE de la cale (MDG 12 l.70-75) : `fromPct` = seuil strict (>) en % de la Contenance,
 *  `mMod`/`manoeuvreDR` = −M et −DR Manœuvre appliqués au navire. */
type OverloadPalier = SeaCargoData['overload']['paliers'][number];

const CARGO = seaCargoJson as SeaCargoData;

export const MANANN_FACTORS = EVENTS.manann.factors;
export const BOARD_EVENTS = EVENTS.boardEvents.entries;
export const PORT_EVENTS = EVENTS.portEvents.entries;
export const FAST_VOYAGE_PALIERS = EVENTS.fastVoyage.entries;
/** Les tables d'événements et de paliers telles que `findTableEntry` les lit (`tableOuverte`) : leurs
 *  bandes extrêmes sont ouvertes (MDG 15). Mémoïsées sur leur dataset quand le Codex les édite. */
export const evenementsDeBord = memoParVersion('seaBoardEvents', () => tableOuverte(BOARD_EVENTS));
/** Le dé du Tableau des événements de bord, lu à l'appel. */
export const deDesEvenementsDeBord = (): DeDeTable => deDeLaTableTiree(EVENTS.boardEvents);
const evenementsDePort = memoParVersion('seaPortEvents', () => tableOuverte(PORT_EVENTS));
/** Le dé du Tableau des événements d'escale, lu à l'appel. */
export const deDesEvenementsDePort = (): DeDeTable => deDeLaTableTiree(EVENTS.portEvents);
const PALIERS_DE_VOYAGE_RAPIDE = tableOuverte(FAST_VOYAGE_PALIERS);
/** Le dé du tableau du Voyage rapide, lu à l'appel. */
export const deDuVoyageRapide = (): DeDeTable => deDeLaTableTiree(EVENTS.fastVoyage);
/** `test` exige `skill` et `difficulty` au parse (`exigerDuTest`, `defs/sea-cargo.ts`). */
export const OPPORTUNITE = CARGO.opportunite as SeaCargoData['opportunite'] & { test: TestExige<'skill' | 'difficulty'> };
/** La table du Prix d'offre telle que `findTableEntry` la lit (`tableOuverte`, tronc commun — sa
 *  dernière bande est OUVERTE, MDG 15 l.383 « 4 ou plus »). */
const bandesDuPrixDOffre = memoParVersion('seaCargo', () => tableOuverte(CARGO.sell.offerPrice));
export const findManannFactor = (id: string): ManannFactor | undefined => EVENTS.manann.factors.find((f) => f.id === id);

// ── Surcharge de la cale (MDG 12 l.70-75) ──────────────────────────────────────────────────────

/** Plafond DUR de charge (% de la Contenance) : au-delà « Impossible de prendre la mer » (MDG 12 l.75). */
export const overloadHardCapPct = (): number => CARGO.overload.hardCapPct;

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
    label: chosen ? chosen.label : t('cargo.chargeNominale'),
    mMod: chosen?.mMod ?? 0,
    manoeuvreDR: chosen?.manoeuvreDR ?? 0,
    canSail: ratio <= overloadHardCapPct() / 100,
  };
}

/** Enc maximum EMBARQUABLE avant le plafond dur (MDG 12 l.75) — Contenance × 150 %. PUR. */
export function overloadMaxEnc(capacity: number): number {
  return Math.floor(capacity * overloadHardCapPct() / 100);
}

/** Seuils de palier de surcharge en Enc pour une Contenance `capacity` (MDG 12 l.70-75). PUR. */
export function overloadMarks(capacity: number): number[] {
  return CARGO.overload.paliers.map((p) => Math.round(capacity * p.fromPct / 100));
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

/** Événement de bord NOMMÉ (par `id`, sinon par `kind` — plusieurs événements peuvent partager un kind,
 *  ex. `navire-hostile` = Langskip skaeling / Cogue pirate). Pour forcer un tirage en recette (#332). */
export const seaBoardEventById = (idOrKind: string): EvenementDeBord | undefined =>
  BOARD_EVENTS.find((e) => e.id === idOrKind) ?? BOARD_EVENTS.find((e) => e.kind === idOrKind);

type DuGenre<E extends SeaEventDef, K extends NonNullable<E['kind']>> = Extract<E, { kind: K }>;

/** L'événement de bord `id`, de genre `kind` — porté par une étape ou un état qui l'a nommé. */
export function evenementDeBord<K extends NonNullable<EvenementDeBord['kind']>>(id: string, kind: K): DuGenre<EvenementDeBord, K> {
  const e = BOARD_EVENTS.find((x) => x.id === id);
  if (e?.kind !== kind) throw new Error(`sea-events.json › boardEvents : « ${id} » n'est pas un événement de genre « ${kind} »`);
  return e as DuGenre<EvenementDeBord, K>;
}

/** L'UNIQUE événement de la table qui porte ce genre : l'état qui en dure (`vessel.crabs`, le choix du
 *  Prêtre) n'en garde que le genre. */
function seulDuGenre<E extends SeaEventDef, K extends NonNullable<E['kind']>>(table: E[], nom: string, kind: K): DuGenre<E, K> {
  const trouves = table.filter((e) => e.kind === kind);
  if (trouves.length !== 1) throw new Error(`sea-events.json › ${nom} : ${trouves.length} événement(s) de genre « ${kind} », un seul attendu`);
  return trouves[0] as DuGenre<E, K>;
}
export const seulEvenementDeBord = <K extends NonNullable<EvenementDeBord['kind']>>(kind: K) => seulDuGenre(BOARD_EVENTS, 'boardEvents', kind);
export const seulEvenementDePort = <K extends NonNullable<EvenementDePort['kind']>>(kind: K) => seulDuGenre(PORT_EVENTS, 'portEvents', kind);

/** Tire un ÉVÉNEMENT DE PORT à l'accostage (l.127-129) au dé de sa table, ±1 selon le signe de l'Humeur ;
 *  il « se produit dans les 2d10 heures après accostage ». PUR. */
export function rollPortEvent(manannScore: number, rng: RNG): { roll: number; hours: number; event: EvenementDePort } {
  const mod = manannScore < 0 ? -EVENTS.manann.portEventMod : manannScore > 0 ? EVENTS.manann.portEventMod : 0;
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
  return { roll, manannTens, result, palier: findTableEntry(PALIERS_DE_VOYAGE_RAPIDE, result) };
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

/** Cargaison ALÉATOIRE de la saison (l.402-418) : d100 dans la colonne saisonnière (tableau MARITIME). PUR. */
export function rollRandomCargo(season: Season, rng: RNG): CargoDef {
  return rollSeasonalCargo([...marchandisesDe(VOIE_MARITIME)], season, rng);
}

/** Enc DISPONIBLE d'une cargaison à l'achat (l.323-331) : « additionnez la Taille et la Richesse du
 *  Lieu à tout Surplus de cette cargaison et multipliez le résultat par 1d10 × 10. Si le d10 donne
 *  un 1 … aucune cargaison de ce type ». PUR. */
export function rollCargoAvailability(port: PortProfile, cargoId: string, rng: RNG): { d: number; enc: number } {
  const d = d10(rng);
  if (d === 1) return { d, enc: 0 };
  const surplus = port.surplus?.[cargoId] ?? 0;
  return { d, enc: (port.taille + port.richesse + surplus) * d * CARGO.buy.availabilityMultiplier };
}

/** Compétence Marchandage d'un commerçant pris au hasard (l.337 : 3d10+40 ; deux 10+ → Négociateur.
 *  Marienburg/Lothern l.349 : 3d10+55 ; un 10 suffit). PUR. */
export function rollMerchantSkill(cosmopolite: boolean, rng: RNG): { value: number; negotiator: boolean } {
  const spec = cosmopolite ? CARGO.buy.bigPortSkill : CARGO.buy.merchantSkill;
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
  return (partial ? CARGO.buy.partialPurchaseSellerDR : 0) + (surplus ? CARGO.buy.surplusSellerDR : 0);
}

/** Relation d'un port à une cargaison à la VENTE (l.360-372). PUR. */
export type SellRelation = 'no-produce' | 'produces' | 'surplus';
export function sellRelation(port: PortProfile, cargoId: string): SellRelation {
  if ((port.surplus?.[cargoId] ?? 0) > 0) return 'surplus';
  if (port.production.includes(cargoId) && !isTradeHubColumn(port.production)) return 'produces';
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
      target: (port.taille + demand) * CARGO.sell.noProduceTargetPerSize + (isTradeHubColumn(port.production) ? CARGO.sell.commerceBonus : 0),
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
  return isTradeHubColumn(port.production) || (port.demande?.[cargoId] ?? 0) > 0 ? CARGO.sell.dumpingPctOfBase : null;
}

/** Issue du COMMERCE D'OPPORTUNITÉ (Activité en mer, l.276-286) : Test étendu de Marchandage Complexe
 *  (−10), 10 DR en ≤ 3 tentatives — échec de 6 DR → tout perdu ; échec → moitié ; succès → +10 % ;
 *  succès de 6 DR (16+) → +20 %. Renvoie le % de l'investissement récupéré. PUR. */
export function opportunityTradePct(totalDR: number): number {
  const need = CARGO.opportunite.targetDR;
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
