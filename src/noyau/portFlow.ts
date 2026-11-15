/**
 * ÉCRAN PORT (MDG 15 « Longs voyages ») — services au navire de campagne à quai, orchestrés côté
 * state (le moteur PUR vit dans `engine/seaVoyage` + `engine/shipBuild`, déjà testé) :
 *  - RÉPARATION / CARÉNAGE / AMÉLIORATIONS : `portRepairVessel` / `portCareenVessel` /
 *    `installerLAmelioration` (`seaVoyageFlow`, #30), actions du store ;
 *  - COMMERCE MARITIME (l.309-436) : achat (Type/Taille/Marchandage) et vente (Trouver un
 *    acheteur/Prix d'offre/Marchandage) + bradage (l.399), résolus ICI contre le moteur.
 *
 * Marchandage : Test opposé de Marchandage (l.335/385, « décrit en page 291 de WFJDR ») — jet direct
 * du meilleur PJ soutenu (LDB 12) contre le commerçant (`rollMerchantSkill`) ; le vainqueur module le
 * prix de ±`bargainPct` (`engine/bargain`). Les +DR de vendeur (`buySellerDR`
 * à l'achat, `sellChance.drDuVendeur` à la vente) s'ajoutent au DR de LEUR camp.
 *
 * VENTE (`vendreAuPort`, dernier reliquat #275/#274) : CASCADE (`noyau/rollSeam.ts` `openRoll` +
 * `noyau/cascade.ts`) — Ragot (jet de héros), recherche d'acheteur (dé de MONDE par `openWorldTest`,
 * porteur `WORLD_STEP_OWNER`), Marchandage opposé (jet de héros pour le héros, le marchand roule via
 * `engine/seaVoyage.rollMerchantOpposition`, moteur pur) sont chacun une étape routée par la policy
 * M/V/I (`surfaceDeLEtape`) — chaque continuation ENCHAÎNE l'étape suivante depuis l'applier de la
 * précédente (patron `merchantFlow.ts` Ragot→réassort ; défère via `setTimeout` si la cascade est
 * encore EN COURS de commit, patron `seaVoyageFlow.ts` `merDesertion`). ACHAT (`acheterAuPort`, #266)
 * suit le MÊME patron : le Marchandage d'achat s'ouvre par `openRoll` (jet de héros) — SURFACÉ comme la
 * vente, jamais un jet interne silencieux. Seul le BRADAGE (`jeterAuPort`) reste synchrone (¼ du prix,
 * aucun Test de Marchandage au RAW, MDG 15 l.399).
 */
import { nomDe } from '../engine/nom';
import { battleRng } from './battleRng';
import type { RNG } from '../engine/dice';
import { ouvrirEtal } from './etalLotFlow';
import { lieuDuGroupe, placeById, type MapPlace } from './worldMap';
import { partyAssisted } from '../engine/skills';
import { resolveOpposed, bumpSL, estJete, type TestResult } from '../engine/tests';
import { bargainPct } from '../engine/bargain';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { toBrass, fromBrass, formatMoney, PA_PER_CO, canAfford, toMoney, priceToMoney, type Money } from '../engine/money';
import { partyMoneyTotal, payFromGroup, distributeCredit, refusDeGesteSurLeGroupe, totalDesBourses } from './bourseFlow';
import { refuseSi } from './verrousDeFiche';
import { remiseMaximaleDeMarchandage } from './merchantFlow';
import { refuserGeste } from './refusVisible';
import { findVehicleById, findCrewRoleById, findTrappingById, crewRoles, combatStakeRef, refLabel, type CrewRoleData } from '../data';
import { VIVRES_DE_CALE } from '../engine/seaNavigation';
import { ajouterDeLEau, ajouterDesRations } from './navireOps';
import { t } from '../i18n';
import { ajouterAuRoster, weeklyCrewWageBrass } from '../engine/crewMorale';
import {
  rollCargoAvailability, rollMerchantSkill, rollMerchantOpposition, buySellerDR, cargoBasePrice, rollRandomCargo,
  sellChance, offerPricePct, sellRelation, dumpingPricePct, cargoTotalEnc,
  cargoOverload, overloadMaxEnc, overloadHardCapPct, alterationsDuPort, profilDuMarche,
  type PortProfile, type CargoLot, type AlterationDuMarche,
} from '../engine/seaVoyage';
import type { Formula, GameOp } from '../engine/ops';
import { findCargoById, isTradeHubColumn } from '../engine/cargo';
import { seasonOfMonth } from '../engine/travelStages';
import { MINUTES_PER_DAY, toDate } from '../engine/clock';
import { chainStep } from './enchainerEtape';
import type { CascadeStep, CascadeRoll } from './pendings';
import { openPartyTest, openWorldTest, freeCons } from './rollSeam';
import { actorIn } from './monde/combatants';
import { garanti } from '../lib/garanti';
import { traceLineOf } from '../engine/traceLine';
import type { Get, Set } from './flowTypes';
import type { CampaignVessel, Jeu } from './etat';
import { vivrePerissable, type QuantitesDeVivres } from '../engine/provisions';
import type { Id } from '../data/schemas/grammaire/ref';
import type { IdDeCargaison, IdDePorteurDeCargaison } from './designations';
import { CAMPAIGN_VESSEL_CARRIER_ID } from './carriers';

import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';

/** Une offre d'achat générée à l'escale (l.319-331) — Enc disponible + prix de base NOTÉ (le Vin fige son 3d10). */
export interface PortOffer {
  cargoId: string;
  label: string;
  enc: number;
  basePrice: number;
  /** Remise du vendeur sur le prix de base (op `marcheDuPort`, `offre`) : le prix demandé, pas le prix de base du lot
   *  embarqué. MDG 15 l.256 */
  remisePct?: number;
  /** Cargaison en Surplus du port (MDG 15 l.341 — écart de camp ouvert en #1140). */
  surplus: boolean;
}

/** État PORT ouvert (généré une fois à l'escale — le d10 de disponibilité ne se re-tire pas par rendu). */
export interface PortState {
  placeId: string;
  label: string;
  /** id `naval-ports.json` du lieu-port (#217, `MapPlace.port.ref`) — source de la desc/région du
   *  catalogue pour l'en-tête du hub. Absent = port authoré sans référence de catalogue. */
  ref?: string;
  port: PortProfile;
  offers: PortOffer[];
  /** L'achat en composition (`fenetreChoisir('port', …)`). */
  achat?: import('./cargaison').BrouillonDAchat;
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().ecrireAuJournal(lines);
};

/** Lieu portuaire courant (place de la carte dont la scène EST la scène courante + `port`), son profil de marché
 *  sous les altérations actives (`profilDuMarche`). */
export function currentPort(get: Get): { placeId: string; label: string; ref?: string; port: PortProfile; cosmopolite: boolean } | null {
  const place = lieuDuGroupe(get());
  if (!place?.port) return null;
  const port = profilDuMarche(place.port, alterationsDuPort(get().alterationsDuMarche, place.id, get().gameTime));
  return { placeId: place.id, label: place.label, ref: place.port.ref, port, cosmopolite: !!place.port.cosmopolite };
}

/** Un port de la carte tiré au hasard, hors le lieu de l'escale (`vessel.escale`) ; `undefined` sans autre port.
 *  MDG 15 l.259, l.261 */
export function autrePortAuHasard(get: Get, rng: RNG): MapPlace | undefined {
  const escale = get().vessel?.escale;
  const ports = (get().worldMap?.places ?? []).filter((p) => p.port && p.id !== escale);
  return ports.length ? ports[rng.int(0, ports.length - 1)] : undefined;
}

/** Résout l'op `marcheDuPort` sous la source `label`, ses quantités tirées par `quantite` ; rend les lignes du journal.
 *  Le port de l'escale est le lieu où le navire est à quai (`vessel.escale`) ; la Demande vise un autre port de la
 *  carte tiré au hasard. MDG 15 l.253, l.256, l.259, l.263 */
export function alterLeMarche(get: Get, set: Set, o: Extract<GameOp, { op: 'marcheDuPort' }>, label: string, quantite: (f: Formula) => number, rng: RNG): string[] {
  const now = get().gameTime;
  const season = seasonOfMonth(toDate(now).month);
  const escale = get().vessel?.escale;
  const ici = escale && get().worldMap ? placeById(get().worldMap!, escale) : undefined;
  const poser = (a: AlterationDuMarche): void => set({ alterationsDuMarche: [...get().alterationsDuMarche.filter((x) => x.jusqua === 'escale' || x.jusqua > now), a] });
  if (o.demande !== undefined) {
    const port = autrePortAuHasard(get, rng);
    if (!port) return [t('eff.marcheSansAutrePort', { label })];
    const cargo = rollRandomCargo(season, rng);
    const jours = quantite(o.jours);
    poser({ placeId: port.id, jusqua: now + jours * MINUTES_PER_DAY, demande: { cargoId: cargo.id, delta: o.demande } });
    return [t('eff.marcheDemande', { label, cargo: cargo.label, port: port.label, delta: `${o.demande >= 0 ? '+' : '−'}${Math.abs(o.demande)}`, n: jours })];
  }
  if (!ici?.port) return [t('eff.marcheHorsPort', { label })];
  if (o.colonnes !== undefined) {
    poser({ placeId: ici.id, jusqua: 'escale', colonnes: o.colonnes });
    return [t(o.colonnes === 'penurie' ? 'eff.marchePenurie' : 'eff.marcheSaturation', { label, port: ici.label })];
  }
  const cargo = rollRandomCargo(season, rng);
  const enc = quantite(o.offre.enc);
  poser({ placeId: ici.id, jusqua: 'escale', offre: { cargoId: cargo.id, enc, remisePct: o.offre.remisePct } });
  return [t('eff.marcheOffre', { label, enc, cargo: cargo.label, pct: o.offre.remisePct })];
}


/** Contenance libre NOMINALE du navire (Contenance − cargaison embarquée, min 0) — headroom SANS surcharge. PUR. */
export function encLibreNominale(vessel: Jeu['vessel']): number {
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, capacity - cargoTotalEnc(vessel.cargo ?? []));
}

function encEmbarquable(vessel: Jeu['vessel']): number {
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, overloadMaxEnc(capacity) - cargoTotalEnc(vessel.cargo ?? []));
}

/** Enc EMBARQUABLE avant le plafond DUR de surcharge (MDG 12 l.75 : Contenance × 150 % − cargaison). Au-delà de
 *  la Contenance nominale = zone de SURCHARGE (paliers d'assiette, `cargoOverload`) — l'achat y AVERTIT (#243). */
export function vesselMaxLoadEnc(get: Get): number {
  return encEmbarquable(get().vessel);
}

/** Prix d'un lot de l'offre `offre` en CO (MDG 15 l.319-349, l.256) : sa remise, puis `pct`, l'effet du Marchandage. */
function prixDuLotEnPort(enc: number, offre: Pick<PortOffer, 'basePrice' | 'remisePct'>, pct: number): number {
  return Math.max(0, Math.round(enc * offre.basePrice * (1 - (offre.remisePct ?? 0) / 100) * (1 + pct / 100)));
}

/** Cale du navire à l'escale : place libre nominale, Enc embarquable jusqu'au plafond dur, et ce plafond en %
 *  de la Contenance (MDG 12 l.70-75, donnée `hardCapPct`). Lue par l'écran du port. PUR. */
export function caleALEscale(vessel: Jeu['vessel']): { libre: number; embarquable: number; plafondPct: number } {
  return { libre: encLibreNominale(vessel), embarquable: encEmbarquable(vessel), plafondPct: overloadHardCapPct() };
}

/** Devis d'achat d'une cargaison à l'escale, AVANT Marchandage : Enc retenu (défaut : l'offre dans la place
 *  libre nominale, au moins 1) et sa borne `max` (l'offre ∩ le plafond dur, MDG 12 l.75), estimation, PLANCHER
 *  au meilleur Marchandage possible du groupe (`remiseMaximaleDeMarchandage`), entrée en surcharge
 *  (MDG 12 l.70-75), refus (`null` : le geste passe au Marchandage). Une bourse sous le plancher refuse avant
 *  le jet ; entre le plancher et le prix, elle se juge après le jet (`finalizePortBuy`). SOURCE UNIQUE de
 *  `acheterAuPort` et de l'écran du port. PUR. */
export type DevisDAchatEnPort = { enc: number; max: number; estimationGold: number; plancherGold: number; surcharge: boolean } & (
  | { refus: null; offre: PortOffer }
  | { refus: string; offre?: PortOffer }
);

export function devisDAchatEnPort(s: Pick<Jeu, 'port' | 'vessel' | 'net' | 'party'>, porteurId: IdDePorteurDeCargaison, cargoId: string, enc?: number): DevisDAchatEnPort {
  const offre = s.port?.offers.find((o) => o.cargoId === cargoId);
  const libre = encLibreNominale(s.vessel);
  const max = offre ? Math.min(offre.enc, encEmbarquable(s.vessel)) : 0;
  const voulu = enc ?? (offre ? Math.min(offre.enc, Math.max(libre, 1)) : 0);
  const want = Math.max(0, Math.min(Math.floor(voulu), max));
  const plancherGold = offre ? prixDuLotEnPort(want, offre, -remiseMaximaleDeMarchandage(s.party)) : 0;
  const base = { enc: want, max, estimationGold: offre ? prixDuLotEnPort(want, offre, 0) : 0, plancherGold, surcharge: want > libre, offre };
  const refus = refusDeGesteSurLeGroupe(s) ?? (!offre || !s.vessel ? t('port.offreAbsente')
    : porteurId !== CAMPAIGN_VESSEL_CARRIER_ID ? t('port.horsDuNavire') : want <= 0 ? t('port.holdFull')
    : !canAfford(totalDesBourses(s.party), toMoney({ gold: plancherGold })) ? t('cargo.bourseSousPlancher', { plancher: formatMoney(toMoney({ gold: plancherGold })) })
    : null);
  return refus === null && offre ? { ...base, offre, refus } : { ...base, refus: refus ?? t('port.offreAbsente') };
}

/** Refus de tout geste sur le navire de campagne au port : sans navire, ou navire qui n'est pas à quai (`vessel.escale`)
 *  au lieu du groupe ; `null` sinon. SOURCE UNIQUE de la présence du navire au port, lue par l'entrée au port
 *  (`ouvrirLePort`, hub du lieu) et par `refusDeGesteAQuai`. MDG 15 l.319 */
export function refusAQuai(s: Pick<Jeu, 'vessel' | 'lieu' | 'worldMap'>): string | null {
  if (!s.vessel) return t('port.sansNavire');
  return s.vessel.escale !== undefined && s.vessel.escale === lieuDuGroupe(s)?.id ? null : t('port.pasAQuai');
}

/** Refus d'un geste à quai sur le navire ou la bourse du groupe (chantier, équipage, avitaillement) : siège invité
 *  (`refusDeGesteSurLeGroupe`), puis `refusAQuai` ; `null` sinon. Le refus que lisent leurs devis. */
export function refusDeGesteAQuai(s: Pick<Jeu, 'vessel' | 'lieu' | 'worldMap' | 'net'>): string | null {
  return refusDeGesteSurLeGroupe(s) ?? refusAQuai(s);
}

/** Génère les offres d'ACHAT de l'escale (l.319-331) : Production + Surplus (Enc = (Taille+Richesse+
 *  Surplus)×1d10×10, 1 → rien), et une cargaison aléatoire par « commerce » (3× si cosmopolite, l.347). */
export function ouvrirLePort(get: Get, set: Set): void {
  const cur = currentPort(get);
  if (!cur) return;
  const refus = refusAQuai(get());
  if (refus) { refuserGeste(get, set, refus); return; }
  ouvrirEtal(get, set, 'port', `Port — ${cur.label}`);
}

/** Le GÉNÉRATEUR de l'étal portuaire : même contrat que la halle (aléa injecté, dés nommés). */
function genererEtalPort(get: Get, set: Set, rng: RNG, phase: (label: string) => void): void {
  const cur = currentPort(get);
  if (!cur || !get().vessel) return;
  const season = seasonOfMonth(toDate(get().gameTime).month);
  const { port } = cur;
  const ids = new Set<string>();
  // Seules les MARCHANDISES de la colonne Production entrent au négoce : un marqueur de l'Index
  // (`echangeable: false`) n'est pas résolu par `findCargoById` et ne produit donc aucune offre.
  for (const p of port.production) if (findCargoById(p)) ids.add(p);
  for (const s of Object.keys(port.surplus ?? {})) ids.add(s);
  const alterations = alterationsDuPort(get().alterationsDuMarche, cur.placeId, get().gameTime);
  // « commerce » → cargaison(s) aléatoire(s) (l.321/347), qu'une Pénurie retire avec la Production (l.253).
  if (isTradeHubColumn(port.production) && !alterations.some((a) => a.colonnes === 'penurie')) {
    const draws = cur.cosmopolite ? 3 : 1;
    for (let i = 0; i < draws; i++) { phase(`Cargaison de commerce ${i + 1}`); ids.add(rollRandomCargo(season, rng).id); }
  }
  // Une offre par cargaison à l'étal : le lot remisé tient la place de l'offre ordinaire tant qu'il en reste.
  const offres = alterations.flatMap((a) => (a.offre && a.offre.enc > 0 ? [a.offre] : []));
  const offers: PortOffer[] = [];
  for (const cargoId of ids) {
    const cargo = findCargoById(cargoId);
    if (!cargo || offres.some((o) => o.cargoId === cargoId)) continue;
    phase(`Disponibilité — ${cargo.label}`);
    const avail = rollCargoAvailability(port, cargoId, rng);
    if (avail.enc <= 0) continue; // 1 sur le d10 → aucune de ce type (l.327)
    phase(`Prix de base — ${cargo.label}`);
    offers.push({
      cargoId, label: cargo.label, enc: avail.enc,
      basePrice: cargoBasePrice(cargo, season, rng), // le Vin fige son 3d10 ici (l.436)
      surplus: (port.surplus?.[cargoId] ?? 0) > 0,
    });
  }
  // MDG 15 l.256
  for (const o of offres) {
    const cargo = garanti(findCargoById(o.cargoId), o.cargoId, 'cargaison offerte');
    phase(`Prix de base — ${cargo.label}`);
    offers.push({
      cargoId: o.cargoId, label: t('port.offreRemisee', { label: cargo.label, pct: o.remisePct }), enc: o.enc,
      basePrice: cargoBasePrice(cargo, season, rng), remisePct: o.remisePct, surplus: false,
    });
  }
  set({ port: { placeId: cur.placeId, label: cur.label, ref: cur.ref, port: structuredClone(port), offers } }); // #2097
}

/** DR de camp SIGNÉ pour l'enjeu affiché (`stakes.json`, achat et vente) : le gabarit dit « compte
 *  {drDuVendeur} DR », le signe fait partie de la valeur — source UNIQUE des deux Marchandages. */
const signedDR = (dr: number) => (dr >= 0 ? `+${dr}` : String(dr));

/** Finalise l'ACHAT une fois le Marchandage résolu (pct connu) : prix = Enc × prix de base × (1 + pct %),
 *  débité, cargaison ajoutée à la cale (Enc re-clampé au plafond DUR de surcharge, MDG 12 l.75), offre
 *  rafraîchie. SOURCE UNIQUE du dénouement, partagée par le chemin SANS marchandeur (prix plein, pct 0)
 *  et l'applier `PORT_BUY_BARGAIN_KIND`. Renvoie les lignes de journal (refus si bourse insuffisante ou
 *  état changé ; ligne d'avertissement de surcharge, MDG 12 l.70-75, ajoutée le cas échéant). */
function finalizePortBuy(get: Get, set: Set, cargoId: string, want: number, basePrice: number, pct: number, bargainLine: string): string[] {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return [];
  const offer = st.offers.find((o) => o.cargoId === cargoId);
  if (!offer) return [];
  const enc = Math.max(0, Math.min(want, offer.enc, vesselMaxLoadEnc(get)));
  if (enc <= 0) return [t('port.holdFull')];
  const price = prixDuLotEnPort(enc, { basePrice, remisePct: offer.remisePct }, pct);
  const cost = toMoney({ gold: price });
  if (!canAfford(partyMoneyTotal(get), cost)) return [t('cargo.purseShort', { price: formatMoney(cost), label: offer.label, bargain: bargainLine })];
  const cargo: CargoLot = { uid: get().forgerUnId('it'), cargoId, enc, basePriceGold: basePrice };
  const nextCargo = [...(vessel.cargo ?? []), cargo];
  payFromGroup(get, set, cost, { purpose: 'cargaison navire' });
  set({
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, enc: o.enc - enc } : o).filter((o) => o.enc > 0) },
    // Le lot d'une offre d'escale s'épuise aussi dans son altération : l'étal regénéré ne le remet pas.
    alterationsDuMarche: get().alterationsDuMarche.map((a): AlterationDuMarche => (a.placeId === st.placeId && a.offre?.cargoId === cargoId
      ? { placeId: a.placeId, jusqua: a.jusqua, offre: { ...a.offre, enc: a.offre.enc - enc } } : a)),
  });
  const lines = [t('port.loaded', { enc, label: offer.label, bargain: bargainLine, money: formatMoney(fromBrass(toBrass(cost))) })];
  // Surcharge de la cale (MDG 12 l.70-75) : au-delà de la Contenance nominale, avertir du palier d'assiette.
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const over = cargoOverload(cargoTotalEnc(nextCargo), capacity);
  if (over.palierId) lines.push(t('port.overloaded', { pct: over.ratioPct, label: over.label, m: over.mMod, dr: over.drDeManoeuvre }));
  return lines;
}

/** ACHAT d'une cargaison (l.319-349) : prix = Enc × prix de base, modulé par le Marchandage OPPOSÉ (#266)
 *  — SURFACÉ par `openRoll` (jet de héros « Marchandage — achat ») comme la vente, jamais un jet interne.
 *  Le marchand roule via `rollMerchantOpposition` (moteur pur, appelé par l'applier) ; le vendeur NPC porte
 *  ses +DR de lot partiel/Surplus (l.339-341). Sans marchandeur dans le groupe, l'achat se conclut au prix
 *  plein (aucun jet). Débité, ajouté à la cale plafonnée à 150 % (MDG 12 l.75). */
export function acheterAuPort(get: Get, set: Set, porteurId: IdDePorteurDeCargaison, cargoId: string, enc: number): void {
  const st = garanti(get().port, cargoId, 'port ouvert à l’achat');
  const devis = devisDAchatEnPort(get(), porteurId, cargoId, enc);
  if (devis.refus !== null) { refuserGeste(get, set, devis.refus); return; }
  const { offre: offer, enc: want } = devis;
  const partial = want < offer.enc;
  const best = partyAssisted(get().party, { skill: { id: 'marchandage' } });
  // Toujours tiré (même sans marchandeur) — parité RNG avec la vente (la porte du seam ne touche pas le rng).
  const merchant = rollMerchantSkill(!!st.port.cosmopolite, battleRng());
  if (!best) {
    log(get, set, finalizePortBuy(get, set, cargoId, want, offer.basePrice, 0, t('port.noBargainerBuy')));
    return;
  }
  // DR de camp du vendeur NPC (MDG 15 l.339-341 — écart de camp ouvert en #1140).
  const sellerDR = buySellerDR(partial, offer.surplus);
  openPartyTest(get, set, {
    skill: { id: 'marchandage' },
    actionLabel: t('port.actionBuy'),
    difficulty: 'intermediaire',
    stake: combatStakeRef(PORT_BUY_BARGAIN_KIND, { values: { drDuVendeur: signedDR(sellerDR) } }),
  }, PORT_BUY_BARGAIN_KIND, { cargoId, want, basePrice: offer.basePrice, merchantValue: merchant.value, merchantNegotiator: merchant.negotiator, drDuVendeur: sellerDR });
}

/** `TestResult` du héros MARCHANDEUR reconstruit depuis son étape de cascade. `step.base` EST déjà le
 *  Niveau de Compétence nu posé par la porte du seam (`rollSeam.buildMonoStep`, `LDB 09 l.17`) — la
 *  grandeur que `resolveOpposed` compare à DR égal (`LDB 12 l.160`) : rien à en défaire ici.
 *  SOURCE UNIQUE des deux appliers de Marchandage portuaire (achat + vente). */
function bargainHeroTR(step: CascadeStep, r: CascadeRoll): TestResult {
  return { roll: r.roll, target: r.target, ...(step.base != null ? { base: step.base } : {}), success: r.success, sl: r.sl, isDouble: false };
}

const PORT_BUY_BARGAIN_KIND = 'port-achat-marchandage';


/** Le lot `lotId` de la cale du navire, et le navire, au port ouvert. */
function lotALaCale(get: Get, lotId: IdDeCargaison) {
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.find((l) => l.uid === lotId);
  return st && vessel && lot ? { st, vessel, lot } : null;
}

/** Finalise la vente : gross = Enc × prix de base × Prix d'offre % × (1 + Marchandage %), retire le
 *  lot (ou la fraction vendue) de la cale, crédite la bourse. SOURCE UNIQUE du dénouement, partagée
 *  par le chemin SANS marchandeur (prix d'offre pris tel quel) et l'applier `PORT_SELL_BARGAIN_KIND`.
 *  Renvoie la ligne de journal (vide si l'état a changé entre-temps). */
function finalizePortSale(get: Get, set: Set, lotId: IdDeCargaison, sellEnc: number, offerPct: number, bargainPctVal: number, bargainLine: string): string {
  const cale = lotALaCale(get, lotId);
  if (!cale) return '';
  const { vessel, lot } = cale;
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const gross = Math.max(0, Math.round(sellEnc * lot.basePriceGold * (offerPct / 100) * (1 + bargainPctVal / 100)));
  const nextCargo = sellEnc >= lot.enc ? (vessel.cargo ?? []).filter((l) => l.uid !== lotId) : (vessel.cargo ?? []).map((l) => l.uid === lotId ? { ...l, enc: l.enc - sellEnc } : l);
  distributeCredit(get, set, fromBrass(gross * PA_PER_CO));
  set({ vessel: { ...vessel, cargo: nextCargo } });
  return t('port.sold', { enc: sellEnc, label, pct: offerPct, bargain: bargainLine, money: formatMoney(fromBrass(gross * PA_PER_CO)) });
}

/** 3. Marchandage opposé (vendeur PJ +DR, l.387-397) — jet de héros (`openRoll`) pour le héros ; le
 *  marchand roule via `rollMerchantOpposition` (moteur pur, appelé par l'applier). Sans marchandeur
 *  dans le groupe, la vente se conclut au prix d'offre pris tel quel (aucun jet). */
function openPortSellBargainStep(get: Get, set: Set, lotId: IdDeCargaison, sellEnc: number): void {
  const cale = lotALaCale(get, lotId);
  if (!cale) return;
  const { st, vessel, lot } = cale;
  const offerPct = offerPricePct(st.port, lot.cargoId);
  const best = partyAssisted(get().party, { skill: { id: 'marchandage' } });
  // Toujours tiré (même sans marchandeur) — préserve l'ordre des tirages RNG de l'ancienne résolution
  // synchrone (déterminisme seedé conservé, la porte du seam ne touche pas le rng).
  const merchant = rollMerchantSkill(!!st.port.cosmopolite, battleRng());
  if (!best) {
    log(get, set, [finalizePortSale(get, set, lotId, sellEnc, offerPct, 0, t('port.noBargainerSell'))]);
    return;
  }
  const sellerDR = sellChance(st.port, lot.cargoId, vessel.lastVoyageMilles ?? 0).drDuVendeur;
  openPartyTest(get, set, {
    skill: { id: 'marchandage' },
    actionLabel: t('port.actionSell'),
    difficulty: 'intermediaire',
    stake: combatStakeRef(PORT_SELL_BARGAIN_KIND, { values: { drDuVendeur: signedDR(sellerDR) } }),
  }, PORT_SELL_BARGAIN_KIND, { lotId, sellEnc, offerPct, merchantValue: merchant.value, merchantNegotiator: merchant.negotiator, drDuVendeur: sellerDR });
}

const PORT_SELL_BARGAIN_KIND = 'port-vente-marchandage';

/** 2. Trouver un acheteur (dé de MONDE par `openWorldTest`, MDG 15 l.362) : cible = `chance.cible`.
 *  Échec sur la 1ʳᵉ tentative SANS Ragot préalable → 2ᵉ tentative sur la moitié du lot (`attempt:2`). */
function openPortSellBuyerStep(get: Get, set: Set, lotId: IdDeCargaison, sellEnc: number, allowHalfRetry: boolean, attempt: 1 | 2): void {
  const cale = lotALaCale(get, lotId);
  if (!cale) return;
  const { st, vessel, lot } = cale;
  const milles = vessel.lastVoyageMilles ?? 0;
  const chance = sellChance(st.port, lot.cargoId, milles);
  openWorldTest(get, set, {
    actionLabel: t('port.buyerSearch'),
    cible: chance.cible,
    verdict: { reussite: t('seuil.acheteurTrouve'), echec: t('seuil.aucunAcheteur') },
  }, PORT_SELL_BUYER_KIND, { lotId, sellEnc, retryHalf: allowHalfRetry, attempt });
}

const PORT_SELL_BUYER_KIND = 'acheteurAuPort';

/** 1. Test de Ragot PRÉALABLE éventuel (port qui produit / Surplus, l.366-372, jet de héros). Aucun
 *  candidat au Ragot → même message qu'avant, aucun jet à ouvrir. */
const PORT_SELL_GOSSIP_KIND = 'port-vente-ragot';

/** VENTE d'un lot de cargaison (l.351-397) : trouver un acheteur (relation du port au bien),
 *  Prix d'offre (% du prix de base par Richesse+Taille+Demande), Marchandage opposé (vendeur PJ +DR).
 *  Retire le lot vendu de la cale, crédite la bourse. CASCADE (Ragot → acheteur → Marchandage) —
 *  chaque étape routée par la policy M/V/I (cf. docstring d'en-tête). */
export function vendreAuPort(get: Get, set: Set, lotId: IdDeCargaison): void {
  if (refuseSi(get, set, refusDeGesteSurLeGroupe)) return;
  if (!get().port || !get().vessel) return;
  const cale = lotALaCale(get, lotId);
  if (!cale) { refuserGeste(get, set, t('port.horsDuNavire')); return; }
  if (decharger(get, set, lotId)) return;
  const { st, vessel, lot } = garanti(lotALaCale(get, lotId), lotId, 'lot vendu');
  const milles = vessel.lastVoyageMilles ?? 0;
  const chance = sellChance(st.port, lot.cargoId, milles);
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;

  if (chance.ragot) {
    const best = partyAssisted(get().party, { skill: { id: 'ragot' } });
    if (!best) {
      log(get, set, [t('port.noCamelot', { label, relation: sellRelation(st.port, lot.cargoId) === 'surplus' ? t('port.hasSurplus') : t('port.produces') })]);
      return;
    }
    openPartyTest(get, set, {
      skill: { id: 'ragot' },
      actionLabel: t('port.buyerSearch'),
      difficulty: chance.ragot.difficulty,
      stake: combatStakeRef(PORT_SELL_GOSSIP_KIND),
    }, PORT_SELL_GOSSIP_KIND, { lotId });
    return;
  }
  openPortSellBuyerStep(get, set, lotId, lot.enc, true, 1);
}

/** Décharge le lot `lotId` (`dechargerLeLot`) ; `true` quand la perte l'a vidé : il n'y a plus rien à vendre. */
function decharger(get: Get, set: Set, lotId: IdDeCargaison): boolean {
  const lignes = dechargerLeLot(get, set, lotId);
  if (lignes.length) log(get, set, lignes);
  return !lotALaCale(get, lotId);
}

/** Au DÉCHARGEMENT du lot `uid` dans le port de l'escale : la perte en attente (`perteAuDechargement`) le
 *  frappe, puis est levée ; rend le journal. MDG 15 l.250 */
function dechargerLeLot(get: Get, set: Set, uid: string): string[] {
  const vessel = get().vessel;
  const perte = vessel?.perteAuDechargement;
  if (!vessel || perte === undefined) return [];
  const lot = garanti((vessel.cargo ?? []).find((l) => l.uid === uid), uid, 'lot déchargé');
  const perdus = Math.min(perte, lot.enc);
  const cargo = (vessel.cargo ?? []).flatMap((l) => (l.uid !== uid ? [l] : l.enc > perdus ? [{ ...l, enc: l.enc - perdus }] : []));
  const { perteAuDechargement: _p, ...reste } = vessel;
  set({ vessel: { ...reste, cargo } });
  return [t('eff.perteDechargee', { enc: perdus, cargo: findCargoById(lot.cargoId)?.label ?? lot.cargoId })];
}

/** Refus de brader le lot `cargoId` au port ouvert : `refusDeGesteSurLeGroupe`, puis port qui ne rachète pas ce
 *  lot (`dumpingPricePct` nul, MDG 15 l.399) ; `null` sinon. Tombe dans `jeterAuPort`, lu par l'écran. */
export function refusDeBradageEnPort(s: Pick<Jeu, 'net' | 'port'>, cargoId: string): string | null {
  return refusDeGesteSurLeGroupe(s)
    ?? (s.port && dumpingPricePct(s.port.port, cargoId) == null ? t('port.dumpRefused', { label: findCargoById(cargoId)?.label ?? cargoId }) : null);
}

/** BRADER un lot (l.399) : ¼ du prix de base dans un port « commerce » ou en Demande — sinon refus. */
export function jeterAuPort(get: Get, set: Set, lotId: IdDeCargaison): void {
  if (!get().port || !get().vessel) return;
  const cale = lotALaCale(get, lotId);
  if (!cale) { refuserGeste(get, set, t('port.horsDuNavire')); return; }
  const refus = refusDeBradageEnPort(get(), cale.lot.cargoId);
  if (refus) { refuserGeste(get, set, refus); return; }
  if (decharger(get, set, lotId)) return;
  const { st, vessel, lot } = garanti(lotALaCale(get, lotId), lotId, 'lot bradé');
  const pct = garanti(dumpingPricePct(st.port, lot.cargoId), lot.cargoId, 'pourcentage de bradage');
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const gross = Math.max(0, Math.round(lot.enc * lot.basePriceGold * (pct / 100)));
  const nextCargo = (vessel.cargo ?? []).filter((l) => l.uid !== lotId);
  distributeCredit(get, set, fromBrass(gross * PA_PER_CO));
  set({ vessel: { ...vessel, cargo: nextCargo } });
  log(get, set, [t('port.dumped', { enc: lot.enc, label, pct, money: formatMoney(fromBrass(gross * PA_PER_CO)) })]);
}

/** Rôles recrutables à quai : ceux qui portent un barème de solde (MDG 14 l.293-302, `crew-roles.json`). */
export function rolesRecrutables(): CrewRoleData[] {
  return crewRoles.filter((r) => r.wage?.weekly);
}

/** Refus d'embaucher au rôle `roleId` : `refusDuQuai` (`refusDeGesteAQuai`), ou rôle sans barème ; `null` sinon.
 *  Tombe dans `recruterLEquipage`, lu par l'écran d'escale. */
export function refusDEmbauche(roleId: string, refusDuQuai: string | null): string | null {
  return refusDuQuai ?? (findCrewRoleById(roleId)?.wage?.weekly ? null : t('port.roleSansSolde', { role: findCrewRoleById(roleId)?.label ?? roleId }));
}

/** Refus de débarquer un membre du rôle `roleId` : `refusDuQuai` (`refusDeGesteAQuai`), ou aucun membre de ce rôle
 *  à bord ; `null` sinon. Tombe dans `renvoyerLEquipage`, lu par l'écran d'escale. */
export function refusDeDebarquement(vessel: Jeu['vessel'], roleId: string, refusDuQuai: string | null): string | null {
  return refusDuQuai ?? (vessel?.crew?.some((h) => h.roleId === roleId && h.count > 0) ? null : t('port.aucunABord', { role: findCrewRoleById(roleId)?.label ?? roleId }));
}

/** RECRUTEMENT à quai (#228, escale-hub) : embauche `count` PNJ salariés au rôle `roleId` — fusionné
 *  dans le roster `vessel.crew` (`CrewHire[]`, #216). La solde HEBDOMADAIRE (`crew-roles.json`,
 *  MDG 14 l.293-302) est prélevée à l'entretien (`resolveVesselWeek`) : le moteur ne débite JAMAIS à
 *  l'embauche (aucune avance dans le modèle), la bourse ne bouge pas ici. Un rôle sans barème (`wage`
 *  absent) n'est pas recrutable. Renvoie le journal (ligne de solde totale recalculée). */
export function recruterLEquipage(get: Get, set: Set, roleId: string, count = 1): string[] {
  const refus = refusDEmbauche(roleId, refusDeGesteAQuai(get()));
  if (refus) { refuserGeste(get, set, refus); return []; }
  const vessel = garanti(get().vessel, 'vessel', 'navire de l’embauche');
  const role = garanti(findCrewRoleById(roleId), roleId, 'rôle d’équipage');
  if (count <= 0 || !role.wage) return [];
  const next = ajouterAuRoster(vessel.crew, roleId, count);
  set({ vessel: { ...vessel, crew: next } });
  const lines = [t('port.hired', { count, role: role.label, wage: formatMoney(priceToMoney(role.wage.weekly)), total: formatMoney(fromBrass(weeklyCrewWageBrass(next))) })];
  log(get, set, lines);
  return lines;
}

/** DÉBARQUEMENT d'un membre salarié à quai (#228) : retire `count` PNJ du rôle `roleId` (poste supprimé
 *  s'il tombe à 0). Aucune indemnité modélisée (le moteur ne débite qu'à la paie). Renvoie le journal. */
export function renvoyerLEquipage(get: Get, set: Set, roleId: string, count = 1): string[] {
  const refus = refusDeDebarquement(get().vessel, roleId, refusDeGesteAQuai(get()));
  if (refus) { refuserGeste(get, set, refus); return []; }
  const vessel = garanti(get().vessel, 'vessel', 'navire du débarquement');
  const crew = vessel.crew ?? [];
  const cur = garanti(crew.find((h) => h.roleId === roleId), roleId, 'poste à débarquer');
  if (count <= 0) return [];
  const left = cur.count - count;
  const next = left > 0 ? crew.map((h) => h.roleId === roleId ? { ...h, count: left } : h) : crew.filter((h) => h.roleId !== roleId);
  set({ vessel: { ...vessel, crew: next } });
  const role = findCrewRoleById(roleId);
  const lines = [t('port.dismissed', { count: Math.min(count, cur.count), role: role?.label ?? roleId, total: formatMoney(fromBrass(weeklyCrewWageBrass(next))) })];
  log(get, set, lines);
  return lines;
}

/** Les vivres de la cale qui s'achètent à quai, au prix de l'unité (ration-jour) : ceux que le catalogue fait tenir
 *  en mer (`isRations`) au prix du catalogue, les autres au prix de l'escale s'il est posé (`vessel.rationsDEscale`).
 *  MDG 14 l.238, l.248-252 ; MDG 15 l.262 */
export function vivresAchetables(vessel: CampaignVessel): { id: Id<'trapping'>; prix: Money }[] {
  return VIVRES_DE_CALE.vivres.flatMap((id) => {
    const objet = garanti(findTrappingById(id), id, 'vivre de la cale');
    if (!vivrePerissable(id)) return [{ id, prix: priceToMoney(objet.price ?? null) }];
    return vessel.rationsDEscale !== undefined ? [{ id, prix: fromBrass(vessel.rationsDEscale) }] : [];
  });
}

/** Devis d'AVITAILLEMENT de la cale à quai : `quantites` rations-jour par vivre (`vivresAchetables`) et `tonneaux`
 *  tonneaux d'eau douce (`VIVRES_DE_CALE.tonneau`) au prix du catalogue ; `refus` est `null` quand l'achat passe.
 *  SOURCE UNIQUE d'`avitaillerLeNavire` et de l'écran d'escale. PUR. MDG 14 l.238, l.248-252 ; MDG 15 l.262 */
export interface DevisDAvitaillement { vivres: { id: Id<'trapping'>; prix: Money }[]; tonneau: Money; total: Money; refus: string | null }

export function devisDAvitaillement(vessel: Jeu['vessel'], bourse: Money, refusDuQuai: string | null, quantites: QuantitesDeVivres, tonneaux: number): DevisDAvitaillement {
  const tonneau = priceToMoney(garanti(findTrappingById(VIVRES_DE_CALE.tonneau), VIVRES_DE_CALE.tonneau, 'objet de cale').price ?? null);
  const vivres = vessel ? vivresAchetables(vessel) : [];
  const demandes = Object.entries(quantites) as [Id<'trapping'>, number][];
  const rations = demandes.reduce((s, [, n]) => s + n, 0);
  const prixDe = (id: Id<'trapping'>) => vivres.find((v) => v.id === id)?.prix;
  const horsVente = demandes.find(([id, n]) => n > 0 && prixDe(id) === undefined)?.[0];
  const total = fromBrass(demandes.reduce((s, [id, n]) => { const prix = prixDe(id); return prix ? s + n * toBrass(prix) : s; }, 0) + tonneaux * toBrass(tonneau));
  const refus = refusDuQuai ?? (!vessel ? t('port.sansNavire')
    : [tonneaux, ...demandes.map(([, n]) => n)].some((n) => !Number.isInteger(n) || n < 0) || rations + tonneaux === 0 ? t('port.avitaillementVide')
    : horsVente !== undefined ? t('port.vivreHorsVente', { vivre: refLabel('trappings', { id: horsVente }) })
    : rations > 0 && vessel.provisions == null ? t('port.vivresSansSuivi')
    : tonneaux > 0 && vessel.waterLitres == null ? t('port.eauSansSuivi')
    : !canAfford(bourse, total) ? t('port.avitaillementTropCher', { cost: formatMoney(total) })
    : null);
  return { vivres, tonneau, total, refus };
}

/** AVITAILLEMENT de la cale à quai : le groupe paie le devis (`devisDAvitaillement`), chaque vivre va à sa part des
 *  vivres de la cale, les tonneaux à son eau douce. Renvoie le journal. MDG 14 l.238-252 ; MDG 15 l.262 */
export function avitaillerLeNavire(get: Get, set: Set, quantites: QuantitesDeVivres, tonneaux: number): string[] {
  const devis = devisDAvitaillement(get().vessel, partyMoneyTotal(get), refusDeGesteAQuai(get()), quantites, tonneaux);
  if (devis.refus) { refuserGeste(get, set, devis.refus); return []; }
  payFromGroup(get, set, devis.total, { purpose: 'avitaillement navire' });
  const achats = (Object.entries(quantites) as [Id<'trapping'>, number][]).filter(([, n]) => n > 0);
  const lines = [
    t('port.avitaille', { rations: achats.reduce((s, [, n]) => s + n, 0), tonneaux, cost: formatMoney(devis.total) }),
    ...achats.flatMap(([id, n]) => ajouterDesRations(get, set, n, id)),
    ...(tonneaux > 0 ? ajouterDeLEau(get, set, tonneaux) : []),
  ];
  log(get, set, lines);
  return lines;
}

export function sortiesDuPort(_get: Get, set: Set) {
  return { port: () => set({ port: null }) } satisfies Partial<SortiesDeFenetre>;
}

export function creerActionsDuPort(get: Get, set: Set) {
  return {
    ouvrirLePort: () => ouvrirLePort(get, set),
    recruterLEquipage: (roleId, count) => recruterLEquipage(get, set, roleId, count),
    renvoyerLEquipage: (roleId, count) => renvoyerLEquipage(get, set, roleId, count),
    avitaillerLeNavire: (quantites, tonneaux) => avitaillerLeNavire(get, set, quantites, tonneaux),
  } satisfies FabriqueDuNoyau;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [
  PORT_BUY_BARGAIN_KIND, PORT_SELL_BARGAIN_KIND, PORT_SELL_BUYER_KIND, PORT_SELL_GOSSIP_KIND,
] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    [PORT_BUY_BARGAIN_KIND]: (get, set, step) => {
      if (!estJete(step.result)) return {};
      const cargoId = String(step.meta?.cargoId ?? '');
      const want = Number(step.meta?.want ?? 0);
      const basePrice = Number(step.meta?.basePrice ?? 0);
      const merchantValue = Number(step.meta?.merchantValue ?? 0);
      const merchantNegotiator = !!step.meta?.merchantNegotiator;
      const sellerDR = Number(step.meta?.drDuVendeur ?? 0);
      const actor = garanti(step.actorId ? actorIn(get(), step.actorId) : undefined, step.actorId, 'marchandage au port');
      const heroTR: TestResult = bargainHeroTR(step, step.result);
      const merchantRoll = rollMerchantOpposition(merchantValue, battleRng());
      // +DR du vendeur NPC (l.339-341) porté AVANT le départage : `resolveOpposed` reste le seul juge.
      const opp = resolveOpposed(heroTR, bumpSL(merchantRoll, sellerDR));
      const netSL = opp.netSL;
      let pct = 0; // % appliqué au prix (négatif = remise pour l'acheteur)
      if (opp.winner === 'attaquant') pct = -bargainPct(true, netSL, hasBargainBonus(actor)); // remise à l'acheteur
      else if (opp.winner === 'defenseur') pct = bargainPct(true, netSL, merchantNegotiator); // le vendeur monte le prix
      const bargainLine = t('port.bargainLine', { name: actor.label, roll: heroTR.roll, opp: merchantRoll.roll, seller: sellerDR ? t('port.fragSellerDR', { dr: sellerDR }) : '', issue: pct === 0 ? t('port.priceUnchanged') : pct < 0 ? t('port.discount', { pct: -pct }) : t('port.surcharge', { pct }) });
      return { consequences: freeCons(finalizePortBuy(get, set, cargoId, want, basePrice, pct, bargainLine)) };
    },
    [PORT_SELL_BARGAIN_KIND]: (get, set, step) => {
      if (!estJete(step.result)) return {};
      const lotId = String(step.meta?.lotId ?? '');
      const sellEnc = Number(step.meta?.sellEnc ?? 0);
      const offerPct = Number(step.meta?.offerPct ?? 100);
      const merchantValue = Number(step.meta?.merchantValue ?? 0);
      const merchantNegotiator = !!step.meta?.merchantNegotiator;
      const sellerDR = Number(step.meta?.drDuVendeur ?? 0);
      const actor = garanti(step.actorId ? actorIn(get(), step.actorId) : undefined, step.actorId, 'marchandage au port');
      const heroTR: TestResult = bargainHeroTR(step, step.result);
      const merchantRoll = rollMerchantOpposition(merchantValue, battleRng());
      // +DR du vendeur PJ (l.389-397) porté AVANT le départage : `resolveOpposed` reste le seul juge.
      const opp = resolveOpposed(bumpSL(heroTR, sellerDR), merchantRoll);
      const netSL = opp.netSL;
      let bargainPctVal = 0;
      if (opp.winner === 'attaquant') bargainPctVal = bargainPct(true, netSL, hasBargainBonus(actor)); // le PJ monte le prix
      else if (opp.winner === 'defenseur') bargainPctVal = -bargainPct(true, netSL, merchantNegotiator); // l'acheteur le baisse
      const bargainLine = t('port.bargainLine', { name: actor.label, roll: heroTR.roll, opp: merchantRoll.roll, seller: sellerDR ? t('port.fragSellerDRSigned', { dr: `${sellerDR > 0 ? '+' : ''}${sellerDR}` }) : '', issue: bargainPctVal === 0 ? t('port.noEffect') : t('port.pctPlain', { pct: `${bargainPctVal > 0 ? '+' : ''}${bargainPctVal}` }) });
      return { consequences: freeCons([finalizePortSale(get, set, lotId, sellEnc, offerPct, bargainPctVal, bargainLine)]) };
    },
    [PORT_SELL_BUYER_KIND]: (get, set, step) => {
      if (!estJete(step.result)) return {};
      const lotId = String(step.meta?.lotId ?? '');
      const sellEnc = Number(step.meta?.sellEnc ?? 0);
      const retryHalf = !!step.meta?.retryHalf;
      const attempt = Number(step.meta?.attempt ?? 1);
      const cale = lotALaCale(get, lotId);
      if (!cale) return {};
      const { st, lot } = cale;
      const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
      if (step.result.success) {
        chainStep(get, () => openPortSellBargainStep(get, set, lotId, sellEnc));
        return attempt === 2 ? { consequences: freeCons([t('port.halfLot', { label, enc: sellEnc })]) } : {};
      }
      if (attempt === 1 && retryHalf) {
        const half = Math.max(1, Math.floor(lot.enc / 2));
        chainStep(get, () => openPortSellBuyerStep(get, set, lotId, half, false, 2));
        return {};
      }
      return { consequences: freeCons([t('port.noBuyer', { label, port: st.label, target: step.result.target })]) };
    },
    [PORT_SELL_GOSSIP_KIND]: (get, set, step) => {
      const jet = step.result;
      if (!jet) return {};
      const lotId = String(step.meta?.lotId ?? '');
      const cale = lotALaCale(get, lotId);
      if (!cale) return {};
      const { st, lot } = cale;
      const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
      const actor = garanti(step.actorId ? actorIn(get(), step.actorId) : undefined, step.actorId, 'ragot au port');
      // Le Test de Ragot n'a pas de rangée propre : sa ligne se DÉRIVE (`traceLineOf`), jamais ré-imprimée à la main.
      // Né sans jet (LDB 09 l.30 ; #2588 Q1), il n'a ni dé ni cible à tracer : l'échec se dit sans eux.
      const gossip = (issue: string) => freeCons([estJete(jet) ? traceLineOf({
        who: nomDe(actor), label: t('port.gossipRow', { skill: refLabel('skills', { id: 'ragot' }), label }),
        roll: jet.roll, target: jet.target, sl: jet.sl, success: jet.success, issue,
      }) : t('port.gossipSansJet', { name: actor.label, issue })]);
      if (!jet.success) {
        return { consequences: gossip(t('port.gossipFail', { relation: sellRelation(st.port, lot.cargoId) === 'surplus' ? t('port.hasSurplus') : t('port.produces') })) };
      }
      chainStep(get, () => openPortSellBuyerStep(get, set, lotId, lot.enc, false, 1));
      return { consequences: gossip(t('port.gossipOk')) };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  generateursDEtal: {
    port: { gen: genererEtalPort },
  },
} satisfies FragmentDeTables;
