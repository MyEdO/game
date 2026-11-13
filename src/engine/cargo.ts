/**
 * TRONC COMMUN du COMMERCE DE CARGAISON — primitives PURES partagées par le commerce MARITIME
 * (Mer des Griffes ch.15, `seaVoyage.ts`) et le commerce TERRESTRE / FLUVIAL (Mort sur le Reik
 * Compagnon ch.11, `landCargo.ts`). Le RAW des deux livres suit la même structure « acheter bas /
 * transporter / revendre » ; SEULES les FORMULES (disponibilité, prix d'offre, bradage) diffèrent → elles
 * vivent dans le module propre à chaque livre. Le CATALOGUE des cargaisons (`cargoes.json`) est UN : la
 * table de chaque livre y est la VOIE de ses entrées. Ces briques-ci (catalogue, modèle de lot, tirage
 * saisonnier, prix de base, Marchandage) NE SONT PAS dupliquées.
 */
import type { FabriqueDId } from './fabriqueDId';
import type { SansMarqueNonAffichable } from '../i18n/playerText';
import cargoesJson from '../data/cargoes.json';
import { memoParVersion } from '../data/versionDataset';
import { cargaisonsAleatoires, landCargo, seaCargo } from '../data';
import { garanti } from '../lib/garanti';
import { rollDice, type DiceSpec, type RNG } from './dice';
import { deDeLaTableTiree, findTableEntry } from './tables';
import type { Season } from './travelStages';
import type { PossessionLocation } from './possession';
import { PA_PER_CO } from './money';

/** La VOIE d'une cargaison : la table du livre qui la porte — maritime (MDG 15), terrestre et fluviale
 *  (MSRC 13). */
export type Voie = 'mer' | 'terre';

/** Un type de cargaison (bien volumineux) : prix du livre par saison, ou un jet de dés (`{dice}`), dans l'unité
 *  de sa voie (`prixParPointDEnc`). MSRC 13 l.80-91, MDG 15 l.420-436 */
export interface CargoDef {
  id: string;
  label: string;
  voie: Voie;
  /** Absent sur une cargaison marchande — présent et `false` sur un MARQUEUR (`CargoMarkerDef`). */
  echangeable?: true;
  price: Record<Season, number> | { dice: DiceSpec };
  /** MSRC 13 l.93-104 */
  wine?: boolean;
}

/** Un MARQUEUR de la colonne Production/Produits de l'Index (« Commerce », « Minimum vital »,
 *  « Subsistance ») : il partage le vocabulaire des cargaisons — une colonne d'Index le cite comme une
 *  marchandise — sans en être une, donc sans disponibilité ni prix. Il vit dans le MÊME catalogue
 *  (`cargoes.json`) pour que son libellé joueur ait une source unique.
 *
 *  Ce qui est PASSÉ EN DONNÉE sur le marqueur : l'EXCLUSION du négoce (`echangeable`), le LIBELLÉ
 *  (`label` + `hint`) et la qualité de PLAQUE TOURNANTE (`tradeHub`, lue par `isTradeHubEntry`). */
export interface CargoMarkerDef {
  id: string;
  label: string;
  voie: Voie;
  echangeable: false;
  /** Qualificatif d'AFFICHAGE du marqueur, ÉDITABLE en donnée : il reprend la forme des verbatims
   *  MSRC 13 — « plaque tournante » (l.28) vs « rien à échanger » (l.119). Deux sens DISTINCTS qu'un
   *  suffixe unique codé en dur écrasait ; l'écran l'affiche entre parenthèses après le `label`. */
  hint?: string;
  /** Le Lieu qui porte ce marqueur est une PLAQUE TOURNANTE du commerce : variété de biens disponibles
   *  (MSRC 13 l.24-28), cargaison aléatoire à l'escale (MDG 15 l.321). Absent = marqueur ordinaire
   *  (« Subsistance » / « Minimum vital »). */
  tradeHub?: true;
}

/** Une entrée de catalogue de cargaison : marchandise ou marqueur. */
export type CargoEntry = CargoDef | CargoMarkerDef;

/** L'entrée est-elle une marchandise (achetable/vendable) ? Lit le CHAMP d'exclusion. PUR. */
export function isEchangeable(entry: CargoEntry): entry is CargoDef {
  return entry.echangeable !== false;
}

/** Le catalogue COMPLET tel qu'il est authoré, marchandises ET marqueurs des deux voies : le dataset
 *  éditable (`src/data/overrides.ts`). */
export const CARGO_ENTRIES: readonly CargoEntry[] = cargoesJson as unknown as CargoEntry[];

/** Résout une entrée QUELCONQUE du catalogue, marqueur compris (libellé d'affichage) : un id y est
 *  unique, quelle que soit sa voie. */
export const findCargoEntryById = (id: string): CargoEntry | undefined => CARGO_ENTRIES.find((c) => c.id === id);

/** Les MARCHANDISES de chaque voie, filtrées À LA SOURCE sur le champ d'exclusion : négoce, éditeur et
 *  Compendium n'y voient jamais un marqueur. */
const marchandisesParVoie = memoParVersion('cargoes', (): Readonly<Record<Voie, readonly CargoDef[]>> => {
  const marchandises = CARGO_ENTRIES.filter(isEchangeable);
  return { mer: marchandises.filter((c) => c.voie === 'mer'), terre: marchandises.filter((c) => c.voie === 'terre') };
});

/** Les marchandises d'une voie, dans l'ordre du catalogue. */
export const marchandisesDe = (voie: Voie): readonly CargoDef[] => marchandisesParVoie()[voie];

/** Résout une MARCHANDISE, quelle que soit sa voie (les marqueurs ne sont ni achetables ni vendables). */
export function findCargoById(id: string): CargoDef | undefined {
  const entree = findCargoEntryById(id);
  return entree && isEchangeable(entree) ? entree : undefined;
}

/** L'entrée désigne-t-elle une PLAQUE TOURNANTE du commerce ? Lit le CHAMP `tradeHub` du marqueur
 *  (MSRC 13 l.24-28, MDG 15 l.321) — SOURCE UNIQUE du concept pour les deux commerces : aucun site ne
 *  teste l'id d'une entrée de la colonne Production/Produits. Une entrée absente du catalogue (id
 *  inconnu) n'en est pas une. PUR. */
export function isTradeHubEntry(entry: CargoEntry | undefined): boolean {
  return !!entry && !isEchangeable(entry) && entry.tradeHub === true;
}

/** La colonne Production/Produits d'un Lieu, terrestre ou maritime, le désigne-t-elle comme plaque
 *  tournante ? PUR. */
export function isTradeHubColumn(produits: readonly string[] | undefined): boolean {
  return (produits ?? []).some((id) => isTradeHubEntry(findCargoEntryById(id)));
}

/** Le document de `cargaisons-aleatoires.json` qui tire la colonne `saison` de la table de `voie`, lu à l'appel.
 *  MDG 15 l.404-418 ; MSRC 13 l.69-78 */
export function tableDesCargaisons(voie: Voie, saison: Season): (typeof cargaisonsAleatoires)[number] {
  return garanti(cargaisonsAleatoires.find((t) => t.voie === voie && t.saison === saison), `${voie} › ${saison}`, 'colonne du Tableau des cargaisons');
}

/** Cargaison ALÉATOIRE de la saison : au dé du document de la colonne (`tableDesCargaisons`), dont les rangées
 *  couvrent ce dé au parse (`defs/cargaisons-aleatoires.ts`). PUR (RNG injecté). MDG 15 l.404 ; MSRC 13 l.69 */
export function rollSeasonalCargo(voie: Voie, saison: Season, rng: RNG): CargoDef {
  const table = tableDesCargaisons(voie, saison);
  const { id } = findTableEntry(table.entries, rollDice(deDeLaTableTiree(table), rng));
  return garanti(findCargoById(id), id, 'marchandise du Tableau des cargaisons');
}

/** L'Encombrement que couvre un prix du livre, par voie : donnée de la configuration de chaque voie. */
const ENC_PAR_PRIX: Readonly<Record<Voie, number>> = {
  mer: seaCargo.prixDuLivre.encParPrix,
  terre: landCargo.prixDuLivre.encParPrix,
};

/** SEULE conversion d'un prix du livre de la voie en CO par point d'Enc, l'unité de `CargoLot.basePriceGold`.
 *  PUR. MSRC 13 l.91, MDG 15 l.436 */
export function prixParPointDEnc(prixDuLivre: number, voie: Voie): number {
  return prixDuLivre / ENC_PAR_PRIX[voie];
}

/** Prix de BASE d'une cargaison pour la saison, en CO par point d'Enc (`prixParPointDEnc`). Prix « à dés » tiré
 *  une fois à l'achat et NOTÉ. PUR (RNG injecté). MSRC 13 l.80-91, MDG 15 l.420-436 */
export function cargoBasePrice(cargo: CargoDef, season: Season, rng: RNG): number {
  return prixParPointDEnc('dice' in cargo.price ? rollDice(cargo.price.dice, rng) : cargo.price[season], cargo.voie);
}

/** Un LOT de cargaison en cale/soute (`basePriceGold` = prix de base NOTÉ à l'achat, CO par point d'Enc —
 *  le Vin fige sa qualité/son 3d10 à ce moment). Modèle commun aux deux commerces. `uid` : son identité, posée à
 *  sa naissance (achat, repêchage, part séparée d'un transfert) ; deux lots du même `cargoId` restent distincts. */
export interface CargoLot {
  uid: string;
  cargoId: string;
  enc: number;
  basePriceGold: number;
}

/** VALEUR de la cargaison au prix de base noté de chaque lot, en sous de cuivre. PUR. MDG 15 l.335, l.436 */
export function valeurDeLaCargaison(lots: CargoLot[]): number {
  return Math.round(lots.reduce((s, l) => s + Math.max(0, l.enc) * l.basePriceGold, 0) * PA_PER_CO);
}

/** Enc TOTAL embarqué (pénalités de Contenance, avaries « gâtent 1d10 Enc »…). PUR. */
export function cargoTotalEnc(lots: CargoLot[]): number {
  return lots.reduce((s, l) => s + Math.max(0, l.enc), 0);
}

/** SÉPARE jusqu'à `enc` points d'une cargaison (au fil des lots de cet id) en deux parts qui conservent
 *  chacune leur `basePriceGold` et leur `uid` : `remaining` (ce qui reste) et `taken` (ce qui a été prélevé,
 *  splitté au besoin sur le dernier lot). PUR (nouvelles listes) — brique commune du retrait et du transfert. */
export function splitCargo(lots: CargoLot[], cargoId: string, enc: number): { remaining: CargoLot[]; taken: CargoLot[] } {
  let left = Math.max(0, enc);
  const remaining: CargoLot[] = [];
  const taken: CargoLot[] = [];
  for (const l of lots) {
    if (l.cargoId !== cargoId || left <= 0) { remaining.push(l); continue; }
    const take = Math.min(l.enc, left);
    left -= take;
    if (take > 0) taken.push({ ...l, enc: take });
    if (l.enc - take > 0) remaining.push({ ...l, enc: l.enc - take });
  }
  return { remaining, taken };
}

/** RETIRE `enc` points d'une cargaison (avarie, vol, vente partielle) — au fil des lots de cet id ; les
 *  lots vidés disparaissent. PUR (nouvelle liste). */
export function removeCargo(lots: CargoLot[], cargoId: string, enc: number): { lots: CargoLot[]; removed: number } {
  const { remaining, taken } = splitCargo(lots, cargoId, enc);
  return { lots: remaining, removed: taken.reduce((s, l) => s + l.enc, 0) };
}

// ── RISQUE sur la marchandise (lot D #327) — avaries, voie d'eau, pillage ─────────────────────────

/** RETIRE un MONTANT d'Enc au fil des lots SANS égard au type de bien (voie d'eau « gâte 1d10 Enc »
 *  MSRC 7 l.101 / MDG ; pillage partiel ; vol gradué) — arrondi à l'entier, lots vidés éliminés.
 *  PUR (nouvelle liste). */
export function spoilCargoByEnc(lots: CargoLot[], enc: number): { lots: CargoLot[]; removed: number } {
  let left = Math.max(0, Math.round(enc));
  const remaining: CargoLot[] = [];
  let removed = 0;
  for (const l of lots) {
    if (left <= 0) { remaining.push(l); continue; }
    const take = Math.min(Math.max(0, l.enc), left);
    left -= take; removed += take;
    if (l.enc - take > 0) remaining.push({ ...l, enc: l.enc - take });
  }
  return { lots: remaining, removed };
}

/** RETIRE un POURCENTAGE de l'Enc TOTAL (pillage/vol gradué) — arrondi à l'entier le plus proche, réparti
 *  au fil des lots (`spoilCargoByEnc`). `pct` borné 0..100. PUR (nouvelle liste). */
export function spoilCargoByPct(lots: CargoLot[], pct: number): { lots: CargoLot[]; removed: number } {
  const p = Math.max(0, Math.min(100, pct));
  return spoilCargoByEnc(lots, Math.round(cargoTotalEnc(lots) * p / 100));
}

/** Issue d'une péripétie dangereuse terrestre pour la cargaison du convoi. https://github.com/MyEdO/game/issues/327#issuecomment-4945245936
 *  Combat gagné = le convoi est sauf ; fuite = perte partielle ; défaite = pillage lourd.
 *  Les taux sont des paramètres MAISON (`vol-terrestre-fuite-pct`/`vol-terrestre-defaite-pct`). */
export type CargoRaidOutcome = 'victoire' | 'fuite' | 'defaite';

/** Pourcentage d'Enc perdu selon l'issue du combat de vol terrestre (victoire = 0 ; fuite = `fleePct` ;
 *  défaite = `lossPct`). Taux bornés 0..100. PUR. */
export function cargoRaidLossPct(outcome: CargoRaidOutcome, fleePct: number, lossPct: number): number {
  if (outcome === 'victoire') return 0;
  return Math.max(0, Math.min(100, outcome === 'fuite' ? fleePct : lossPct));
}

/** Ce qui SITUE un porteur (décision 5) : son id STABLE — id de Combattant, uid de Possession, ou id du
 *  navire de campagne — et sa localisation : avec le groupe, laissé à un Lieu, ou embarqué sur un hôte. */
export interface PorteurLocalise {
  id: string;
  location: PossessionLocation;
}

// ── LE PORTEUR DE CHARGE (« CargoCarrier ») — tronc générique #327 ─────────────────────────────────
// Décision 1 (conception 2026-07-11) : UN concept pour héros, bête de bât, véhicule terrestre, barge et
// navire — ils diffèrent par leur SOURCE de capacité et leur modèle de contenu, pas par leur nature. Ce
// tronc est PUR : il fait l'arithmétique d'Enc + le transfert co-localisé ; la RÉSOLUTION de la capacité
// depuis les objets réels (héros/monture/véhicule/navire) vit dans la couture d'état `noyau/carriers.ts`,
// qui assemble ces structures via les constructeurs ci-dessous.

/** Nature physique d'un porteur → table de surcharge RAW (jambes = LDB 61 l.35-40 ; coque = MDG 12). Portée
 *  par la structure pour que la couche de risque (lot D) DISPATCHE sans flag ad hoc — décision 4. */
export type CarrierHull = 'jambes' | 'coque';

/** Un PORTEUR DE CHARGE générique. `capacity`/`discreteEnc` sont des Enc déjà RÉSOLUS par la couture d'état
 *  (héros : `maxEncumbrance`/`totalEncumbrance` ; bête : `encPortee` ; véhicule : `chargement` ; navire :
 *  `ship.capacity`). L'Enc occupé se DÉRIVE (`carrierUsedEnc`) — jamais un 2ᵉ compteur à maintenir. */
export interface CargoCarrier extends PorteurLocalise {
  label: SansMarqueNonAffichable;
  hull: CarrierHull;
  /** Capacité en Points d'Enc (source de la donnée du maillon). `Infinity` = non plafonné (convoi abstrait
   *  sans véhicule matérialisé : « information, pas plafond », landMarketFlow). */
  capacity: number;
  /** Enc des objets DISCRETS non-vrac déjà portés (héros : `totalEncumbrance` ; sinon 0). */
  discreteEnc: number;
  /** Cargaison en VRAC (cale/convoi/bât) — canal `CargoLot`. Vide, pas absent, pour l'uniformité. */
  cargo: CargoLot[];
}

/** Enc TOTAL occupé par un porteur = objets discrets + cargaison en vrac (décision 2). PUR. */
export function carrierUsedEnc(c: CargoCarrier): number {
  return c.discreteEnc + cargoTotalEnc(c.cargo);
}

/** Enc RESTANT avant le plafond de capacité (jamais négatif ; `Infinity` pour un porteur non plafonné). PUR. */
export function carrierFreeEnc(c: CargoCarrier): number {
  return Math.max(0, c.capacity - carrierUsedEnc(c));
}

/** Peut-on encore charger `enc` points sur ce porteur ? Plafond DUR v1 (arbitrage A5.6) : on REFUSE
 *  au-delà de la capacité — aucun palier Surchargé côté tronc. PUR. */
export function carrierCanLoad(c: CargoCarrier, enc: number): boolean {
  return enc <= carrierFreeEnc(c);
}

/** CHARGE un lot de vrac sur le porteur, dans la limite du plafond dur (v1). Le lot est TRONQUÉ à la place
 *  restante (jamais au-delà) ; `loaded` = Enc effectivement embarqué. PUR (nouveau porteur). */
export function loadCargo(c: CargoCarrier, lot: CargoLot): { carrier: CargoCarrier; loaded: number } {
  const loaded = Math.min(Math.max(0, lot.enc), carrierFreeEnc(c));
  if (loaded <= 0) return { carrier: c, loaded: 0 };
  return { carrier: { ...c, cargo: [...c.cargo, { ...lot, enc: loaded }] }, loaded };
}

/** DÉCHARGE `enc` points d'une cargaison du porteur (au fil des lots de cet id). PUR (nouveau porteur). */
export function unloadCargo(c: CargoCarrier, cargoId: string, enc: number): { carrier: CargoCarrier; removed: number } {
  const { lots, removed } = removeCargo(c.cargo, cargoId, enc);
  return { carrier: { ...c, cargo: lots }, removed };
}

/** Deux porteurs sont-ils CO-LOCALISÉS (décision 5) ? L'un est embarqué sur l'autre, ou ils partagent la
 *  MÊME localisation : avec le groupe, au même Lieu, embarqués sur le même hôte. Un porteur n'est jamais
 *  co-localisé avec lui-même. Verdict UNIQUE du transfert d'objet (`noyau/partyFlow.ts`) et de cargaison
 *  (`transferCargo`). PUR. */
export function carriersColocated(a: PorteurLocalise, b: PorteurLocalise): boolean {
  if (a.id === b.id) return false;
  const la = a.location;
  const lb = b.location;
  if ((la.kind === 'embarquee' && la.hostUid === b.id) || (lb.kind === 'embarquee' && lb.hostUid === a.id)) return true;
  switch (la.kind) {
    case 'avec-le-groupe': return lb.kind === 'avec-le-groupe';
    case 'au-lieu': return lb.kind === 'au-lieu' && lb.placeId === la.placeId;
    case 'embarquee': return lb.kind === 'embarquee' && lb.hostUid === la.hostUid;
  }
}

/** TRANSFÈRE jusqu'à `enc` points du lot `lotId` d'un porteur vers un autre CO-LOCALISÉ (décision 8).
 *  Refuse (moved = 0) si les porteurs ne sont pas au même endroit. Le montant déplacé est plafonné par la
 *  place LIBRE de la cible (plafond dur v1) et par le lot ; son prix est préservé, et la part séparée d'un lot
 *  qui reste chez la source naît avec son propre `uid`. Nouveaux porteurs. */
export function transferCargo(
  from: CargoCarrier, to: CargoCarrier, lotId: string, enc: number, idNeuf: FabriqueDId,
): { from: CargoCarrier; to: CargoCarrier; moved: number } {
  const lot = from.cargo.find((l) => l.uid === lotId);
  if (!lot || !carriersColocated(from, to)) return { from, to, moved: 0 };
  const { remaining, taken } = splitCargo([lot], lot.cargoId, Math.min(Math.max(0, enc), carrierFreeEnc(to)));
  const [part] = taken;
  if (!part) return { from, to, moved: 0 };
  return {
    from: { ...from, cargo: from.cargo.flatMap((l) => (l.uid === lotId ? remaining : [l])) },
    to: { ...to, cargo: [...to.cargo, remaining.length ? { ...part, uid: idNeuf('it') } : part] },
    moved: part.enc,
  };
}
