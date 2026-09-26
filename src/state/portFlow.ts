/**
 * ÉCRAN PORT (MDG 15 « Longs voyages ») — services au navire de campagne à quai, orchestrés côté
 * state (le moteur PUR vit dans `engine/seaVoyage` + `engine/shipBuild`, déjà testé) :
 *  - RÉPARATION / CARÉNAGE / AMÉLIORATIONS : `portRepairVessel` / `portCareenVessel` /
 *    `portInstallUpgrade` (déjà dans `seaVoyageFlow`, #30) — ré-exportés comme actions de store ;
 *  - COMMERCE MARITIME (l.309-436) : achat (Type/Taille/Marchandage) et vente (Trouver un
 *    acheteur/Prix d'offre/Marchandage) + bradage (l.399), résolus ICI contre le moteur.
 *
 * Marchandage : Test opposé de Marchandage (l.335/385, « décrit en page 291 de WFJDR ») — jet direct
 * du meilleur PJ soutenu (LDB 12) contre le commerçant (`rollMerchantSkill`) ; le vainqueur module le
 * prix de ±10 % (±20 % si Négociateur ou DR net Stupéfiant, l.335). Les +DR de vendeur (`buySellerDR`
 * à l'achat, `sellChance.sellerDR` à la vente) s'ajoutent au DR de LEUR camp.
 *
 * VENTE (`portSellCargo`, dernier reliquat #275/#274) : CASCADE (`state/rollSeam.ts` `openRoll` +
 * `state/cascade.ts`) — Ragot (hero-test), recherche d'acheteur (dé de MONDE par `openWorldTest`,
 * côté `worldSide`), Marchandage opposé (hero-test pour le héros, le marchand roule via
 * `engine/seaVoyage.rollMerchantOpposition`, moteur pur) sont chacun une étape routée par la policy
 * M/V/I (`resolveSurface`) — chaque continuation ENCHAÎNE l'étape suivante depuis l'applier de la
 * précédente (patron `merchantFlow.ts` Ragot→réassort ; défère via `setTimeout` si la cascade est
 * encore EN COURS de commit, patron `seaVoyageFlow.ts` `sea-desertion`). ACHAT (`portBuyCargo`, #266)
 * suit le MÊME patron : le Marchandage d'achat s'ouvre par `openRoll` (hero-test) — SURFACÉ comme la
 * vente, jamais un jet interne silencieux. Seul le BRADAGE (`portDumpCargo`) reste synchrone (¼ du prix,
 * aucun Test de Marchandage au RAW, MDG 15 l.399).
 */
import { battleRng } from './battleRng';
import type { RNG } from '../engine/dice';
import { ouvrirEtal, registerEtalGenerateur } from './etalLotFlow';
import { placeOfScene } from './worldMap';
import { partyAssisted } from '../engine/skills';
import { resolveOpposed, bumpSL, SL_ASTOUNDING, type TestResult } from '../engine/tests';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { toBrass, fromBrass, formatMoney, PA_PER_CO, canAfford, toMoney, priceToMoney } from '../engine/money';
import { partyMoneyTotal, payFromGroup, distributeCredit } from './bourseFlow';
import { findVehicleById, findCrewRoleById, combatStakeRef, refLabel } from '../data';
import { t } from '../i18n';
import { weeklyCrewWageBrass } from '../engine/crewMorale';
import {
  rollCargoAvailability, rollMerchantSkill, rollMerchantOpposition, buySellerDR, cargoBasePrice, rollRandomCargo,
  sellChance, offerPricePct, sellRelation, dumpingPricePct, cargoTotalEnc, findCargoById,
  cargoOverload, overloadMaxEnc, isSeaTradeHub,
  type PortProfile, type CargoLot,
} from '../engine/seaVoyage';
import { seasonOfMonth } from '../engine/travelStages';
import { toDate } from '../engine/clock';
import { registerCascadeApplier, chainStep } from './cascade';
import type { CascadeStep } from './pendings';
import { openPartyTest, openWorldTest, freeCons } from './rollSeam';
import { actorIn, garanti } from './combatants';
import { traceLineOf } from '../engine/traceLine';
import type { Get, Set } from './flowTypes';

/** Une offre d'achat générée à l'escale (l.319-331) — Enc disponible + prix de base NOTÉ (le Vin fige son 3d10). */
export interface PortOffer {
  cargoId: string;
  label: string;
  enc: number;
  basePrice: number;
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
  /** Contenance libre NOMINALE du navire (Enc) — headroom sans surcharge (l.325). */
  freeEnc: number;
  /** Enc embarquable avant le plafond DUR de surcharge (Contenance × 150 %, MDG 12 l.75) — au-delà de
   *  `freeEnc` = zone de surcharge (l'achat avertit, #243). */
  maxLoadEnc: number;
  offers: PortOffer[];
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().log(lines);
};

/** Lieu portuaire courant (place de la carte dont la scène EST la scène courante + `port`). */
export function currentPort(get: Get): { placeId: string; label: string; ref?: string; port: PortProfile; cosmopolite: boolean } | null {
  const map = get().worldMap;
  const place = map ? placeOfScene(map, get().scene?.id) : undefined;
  if (!place?.port) return null;
  return { placeId: place.id, label: place.label, ref: place.port.ref, port: place.port, cosmopolite: !!place.port.cosmopolite };
}

/** Contenance libre NOMINALE du navire (Contenance − cargaison embarquée, min 0) — headroom SANS surcharge. */
export function vesselFreeEnc(get: Get): number {
  const vessel = get().vessel;
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, capacity - cargoTotalEnc(vessel.cargo ?? []));
}

/** Enc EMBARQUABLE avant le plafond DUR de surcharge (MDG 12 l.75 : Contenance × 150 % − cargaison). Au-delà de
 *  la Contenance nominale = zone de SURCHARGE (paliers d'assiette, `cargoOverload`) — l'achat y AVERTIT (#243). */
export function vesselMaxLoadEnc(get: Get): number {
  const vessel = get().vessel;
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, overloadMaxEnc(capacity) - cargoTotalEnc(vessel.cargo ?? []));
}

/** Génère les offres d'ACHAT de l'escale (l.319-331) : Production + Surplus (Enc = (Taille+Richesse+
 *  Surplus)×1d10×10, 1 → rien), et une cargaison aléatoire par « commerce » (3× si cosmopolite, l.347). */
export function openPort(get: Get, set: Set): void {
  const cur = currentPort(get);
  if (!cur || !get().vessel) return;
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
  // « commerce » → cargaison(s) aléatoire(s) (l.321/347).
  if (isSeaTradeHub(port.production)) {
    const draws = cur.cosmopolite ? 3 : 1;
    for (let i = 0; i < draws; i++) { phase(`Cargaison de commerce ${i + 1}`); ids.add(rollRandomCargo(season, rng).id); }
  }
  const offers: PortOffer[] = [];
  for (const cargoId of ids) {
    const cargo = findCargoById(cargoId);
    if (!cargo) continue;
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
  set({ port: { placeId: cur.placeId, label: cur.label, ref: cur.ref, port, freeEnc: vesselFreeEnc(get), maxLoadEnc: vesselMaxLoadEnc(get), offers } });
}

registerEtalGenerateur('port', genererEtalPort);

export function closePort(_get: Get, set: Set): void {
  set({ port: null });
}

/** Magnitude d'un Marchandage gagné (±10 %, ±20 % si Négociateur ou DR net Stupéfiant, MDG 15 l.335/385).
 *  Homonyme `engine/bargain.ts` (LDB 60) : NON convergent, VOLONTAIREMENT — source RAW distincte, #351. */
function bargainPct(winnerNegotiator: boolean, netSL: number): number {
  return winnerNegotiator || netSL >= SL_ASTOUNDING ? 20 : 10;
}

/** DR de camp SIGNÉ pour l'enjeu affiché (`combat-stakes`, achat et vente) : le gabarit dit « compte
 *  {sellerDR} DR », le signe fait partie de la valeur — source UNIQUE des deux Marchandages. */
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
  const price = Math.max(0, Math.round(enc * basePrice * (1 + pct / 100)));
  const cost = toMoney({ gold: price });
  if (!canAfford(partyMoneyTotal(get), cost)) return [t('port.purseShort', { price, label: offer.label, bargain: bargainLine })];
  const cargo: CargoLot = { cargoId, enc, basePriceGold: basePrice };
  const nextCargo = [...(vessel.cargo ?? []), cargo];
  payFromGroup(get, set, cost, { purpose: 'cargaison navire' });
  set({
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, freeEnc: Math.max(0, st.freeEnc - enc), maxLoadEnc: st.maxLoadEnc - enc, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, enc: o.enc - enc } : o).filter((o) => o.enc > 0) },
  });
  const lines = [t('port.loaded', { enc, label: offer.label, bargain: bargainLine, money: formatMoney(fromBrass(toBrass(cost))) })];
  // Surcharge de la cale (MDG 12 l.70-75) : au-delà de la Contenance nominale, avertir du palier d'assiette.
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const over = cargoOverload(cargoTotalEnc(nextCargo), capacity);
  if (over.palierId) lines.push(t('port.overloaded', { pct: over.ratioPct, label: over.label, m: over.mMod, dr: over.manoeuvreDR }));
  return lines;
}

/** ACHAT d'une cargaison (l.319-349) : prix = Enc × prix de base, modulé par le Marchandage OPPOSÉ (#266)
 *  — SURFACÉ par `openRoll` (hero-test « Marchandage — achat ») comme la vente, jamais un jet interne.
 *  Le marchand roule via `rollMerchantOpposition` (moteur pur, appelé par l'applier) ; le vendeur NPC porte
 *  ses +DR de lot partiel/Surplus (l.339-341). Sans marchandeur dans le groupe, l'achat se conclut au prix
 *  plein (aucun jet). Débité, ajouté à la cale plafonnée à 150 % (MDG 12 l.75). */
export function portBuyCargo(get: Get, set: Set, cargoId: string, enc: number): void {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return;
  const offer = st.offers.find((o) => o.cargoId === cargoId);
  if (!offer) return;
  const want = Math.max(0, Math.min(Math.floor(enc), offer.enc, vesselMaxLoadEnc(get)));
  if (want <= 0) { log(get, set, [t('port.holdFull')]); return; }
  const partial = want < offer.enc;
  const best = partyAssisted(get().party, 'marchandage');
  // Toujours tiré (même sans marchandeur) — parité RNG avec la vente (la porte du seam ne touche pas le rng).
  const merchant = rollMerchantSkill(!!st.port.cosmopolite, battleRng());
  if (!best) {
    log(get, set, finalizePortBuy(get, set, cargoId, want, offer.basePrice, 0, t('port.noBargainerBuy')));
    return;
  }
  // DR de camp du vendeur NPC (MDG 15 l.339-341 — écart de camp ouvert en #1140).
  const sellerDR = buySellerDR(partial, offer.surplus);
  openPartyTest(get, set, {
    skill: 'marchandage',
    actionLabel: t('port.actionBuy'),
    difficulty: 'intermediaire',
    stake: combatStakeRef(PORT_BUY_BARGAIN_KIND, { values: { sellerDR: signedDR(sellerDR) } }),
  }, PORT_BUY_BARGAIN_KIND, { cargoId, want, basePrice: offer.basePrice, merchantValue: merchant.value, merchantNegotiator: merchant.negotiator, sellerDR });
}

/** `TestResult` du héros MARCHANDEUR reconstruit depuis son étape de cascade. `step.base` EST déjà le
 *  Niveau de Compétence nu posé par la porte du seam (`rollSeam.buildMonoStep`, `LDB 09 l.17`) — la
 *  grandeur que `resolveOpposed` compare à DR égal (`LDB 12 l.160`) : rien à en défaire ici.
 *  SOURCE UNIQUE des deux appliers de Marchandage portuaire (achat + vente). */
function bargainHeroTR(step: CascadeStep): TestResult {
  const r = step.result!;
  return { roll: r.roll, target: r.target, ...(step.base != null ? { base: step.base } : {}), success: r.success, sl: r.sl, isDouble: false };
}

const PORT_BUY_BARGAIN_KIND = 'port-buy-bargain';
registerCascadeApplier(PORT_BUY_BARGAIN_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoId = String(step.meta?.cargoId ?? '');
  const want = Number(step.meta?.want ?? 0);
  const basePrice = Number(step.meta?.basePrice ?? 0);
  const merchantValue = Number(step.meta?.merchantValue ?? 0);
  const merchantNegotiator = !!step.meta?.merchantNegotiator;
  const sellerDR = Number(step.meta?.sellerDR ?? 0);
  const actor = garanti(step.actorId ? actorIn(get(), step.actorId) : undefined, step.actorId, 'marchandage au port');
  const heroTR: TestResult = bargainHeroTR(step);
  const merchantRoll = rollMerchantOpposition(merchantValue, battleRng());
  // +DR du vendeur NPC (l.339-341) porté AVANT le départage : `resolveOpposed` reste le seul juge.
  const opp = resolveOpposed(heroTR, bumpSL(merchantRoll, sellerDR));
  const netSL = opp.netSL;
  let pct = 0; // % appliqué au prix (négatif = remise pour l'acheteur)
  if (opp.winner === 'attacker') pct = -bargainPct(hasBargainBonus(actor), netSL); // remise à l'acheteur
  else if (opp.winner === 'defender') pct = bargainPct(merchantNegotiator, netSL); // le vendeur monte le prix
  const bargainLine = t('port.bargainLine', { name: actor.label, roll: heroTR.roll, opp: merchantRoll.roll, seller: sellerDR ? t('port.fragSellerDR', { dr: sellerDR }) : '', issue: pct === 0 ? t('port.priceUnchanged') : pct < 0 ? t('port.discount', { pct: -pct }) : t('port.surcharge', { pct }) });
  return { consequences: freeCons(finalizePortBuy(get, set, cargoId, want, basePrice, pct, bargainLine)) };
});


/** Finalise la vente : gross = Enc × prix de base × Prix d'offre % × (1 + Marchandage %), retire le
 *  lot (ou la fraction vendue) de la cale, crédite la bourse. SOURCE UNIQUE du dénouement, partagée
 *  par le chemin SANS marchandeur (prix d'offre pris tel quel) et l'applier `PORT_SELL_BARGAIN_KIND`.
 *  Renvoie la ligne de journal (vide si l'état a changé entre-temps). */
function finalizePortSale(get: Get, set: Set, cargoIndex: number, sellEnc: number, offerPct: number, bargainPctVal: number, bargainLine: string): string {
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return '';
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const gross = Math.max(0, Math.round(sellEnc * lot.basePriceGold * (offerPct / 100) * (1 + bargainPctVal / 100)));
  const nextCargo = sellEnc >= lot.enc ? (vessel.cargo ?? []).filter((_, i) => i !== cargoIndex) : (vessel.cargo ?? []).map((l, i) => i === cargoIndex ? { ...l, enc: l.enc - sellEnc } : l);
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const freed = cargoTotalEnc(nextCargo);
  distributeCredit(get, set, fromBrass(gross * PA_PER_CO));
  set({
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, freeEnc: Math.max(0, capacity - freed), maxLoadEnc: Math.max(0, overloadMaxEnc(capacity) - freed) },
  });
  return t('port.sold', { enc: sellEnc, label, pct: offerPct, bargain: bargainLine, money: formatMoney(fromBrass(gross * PA_PER_CO)) });
}

/** 3. Marchandage opposé (vendeur PJ +DR, l.387-397) — hero-test (`openRoll`) pour le héros ; le
 *  marchand roule via `rollMerchantOpposition` (moteur pur, appelé par l'applier). Sans marchandeur
 *  dans le groupe, la vente se conclut au prix d'offre pris tel quel (aucun jet). */
function openPortSellBargainStep(get: Get, set: Set, cargoIndex: number, sellEnc: number): void {
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return;
  const offerPct = offerPricePct(st.port, lot.cargoId);
  const best = partyAssisted(get().party, 'marchandage');
  // Toujours tiré (même sans marchandeur) — préserve l'ordre des tirages RNG de l'ancienne résolution
  // synchrone (déterminisme seedé conservé, la porte du seam ne touche pas le rng).
  const merchant = rollMerchantSkill(!!st.port.cosmopolite, battleRng());
  if (!best) {
    log(get, set, [finalizePortSale(get, set, cargoIndex, sellEnc, offerPct, 0, t('port.noBargainerSell'))]);
    return;
  }
  const sellerDR = sellChance(st.port, lot.cargoId, vessel.lastVoyageMilles ?? 0).sellerDR;
  openPartyTest(get, set, {
    skill: 'marchandage',
    actionLabel: t('port.actionSell'),
    difficulty: 'intermediaire',
    stake: combatStakeRef(PORT_SELL_BARGAIN_KIND, { values: { sellerDR: signedDR(sellerDR) } }),
  }, PORT_SELL_BARGAIN_KIND, { cargoIndex, sellEnc, offerPct, merchantValue: merchant.value, merchantNegotiator: merchant.negotiator, sellerDR });
}

const PORT_SELL_BARGAIN_KIND = 'port-sell-bargain';
registerCascadeApplier(PORT_SELL_BARGAIN_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoIndex = Number(step.meta?.cargoIndex ?? -1);
  const sellEnc = Number(step.meta?.sellEnc ?? 0);
  const offerPct = Number(step.meta?.offerPct ?? 100);
  const merchantValue = Number(step.meta?.merchantValue ?? 0);
  const merchantNegotiator = !!step.meta?.merchantNegotiator;
  const sellerDR = Number(step.meta?.sellerDR ?? 0);
  const actor = garanti(step.actorId ? actorIn(get(), step.actorId) : undefined, step.actorId, 'marchandage au port');
  const heroTR: TestResult = bargainHeroTR(step);
  const merchantRoll = rollMerchantOpposition(merchantValue, battleRng());
  // +DR du vendeur PJ (l.389-397) porté AVANT le départage : `resolveOpposed` reste le seul juge.
  const opp = resolveOpposed(bumpSL(heroTR, sellerDR), merchantRoll);
  const netSL = opp.netSL;
  let bargainPctVal = 0;
  if (opp.winner === 'attacker') bargainPctVal = bargainPct(hasBargainBonus(actor), netSL); // le PJ monte le prix
  else if (opp.winner === 'defender') bargainPctVal = -bargainPct(merchantNegotiator, netSL); // l'acheteur le baisse
  const bargainLine = t('port.bargainLine', { name: actor.label, roll: heroTR.roll, opp: merchantRoll.roll, seller: sellerDR ? t('port.fragSellerDRSigned', { dr: `${sellerDR > 0 ? '+' : ''}${sellerDR}` }) : '', issue: bargainPctVal === 0 ? t('port.noEffect') : t('port.pctPlain', { pct: `${bargainPctVal > 0 ? '+' : ''}${bargainPctVal}` }) });
  return { consequences: freeCons([finalizePortSale(get, set, cargoIndex, sellEnc, offerPct, bargainPctVal, bargainLine)]) };
});

/** 2. Trouver un acheteur (dé de MONDE par `openWorldTest`, côté `worldSide` — l.362) : cible = `chance.target`
 *  (posé en `meta.baseValue`, difficulté Intermédiaire = modificateur nul, la cible passe telle
 *  quelle). Échec sur la 1ʳᵉ tentative SANS Ragot préalable → 2ᵉ tentative sur la moitié du lot
 *  (`attempt:2`) ; le message « la moitié trouve preneur » ne s'affiche QUE si cette 2ᵉ tentative
 *  réussit (parité stricte avec l'ancienne résolution synchrone). */
function openPortSellBuyerStep(get: Get, set: Set, cargoIndex: number, sellEnc: number, allowHalfRetry: boolean, attempt: 1 | 2): void {
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return;
  const milles = vessel.lastVoyageMilles ?? 0;
  const chance = sellChance(st.port, lot.cargoId, milles);
  openWorldTest(get, set, {
    actionLabel: t('port.buyerSearch'),
    difficulty: 'intermediaire',
  }, PORT_SELL_BUYER_KIND, { cargoIndex, sellEnc, retryHalf: allowHalfRetry, attempt, baseValue: chance.target });
}

const PORT_SELL_BUYER_KIND = 'port-sell-buyer';
registerCascadeApplier(PORT_SELL_BUYER_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoIndex = Number(step.meta?.cargoIndex ?? -1);
  const sellEnc = Number(step.meta?.sellEnc ?? 0);
  const retryHalf = !!step.meta?.retryHalf;
  const attempt = Number(step.meta?.attempt ?? 1);
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return {};
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (step.result.success) {
    chainStep(get, () => openPortSellBargainStep(get, set, cargoIndex, sellEnc));
    return attempt === 2 ? { consequences: freeCons([t('port.halfLot', { label, enc: sellEnc })]) } : {};
  }
  if (attempt === 1 && retryHalf) {
    const half = Math.max(1, Math.floor(lot.enc / 2));
    chainStep(get, () => openPortSellBuyerStep(get, set, cargoIndex, half, false, 2));
    return {};
  }
  return { consequences: freeCons([t('port.noBuyer', { label, port: st.label, target: step.result.target })]) };
});

/** 1. Test de Ragot PRÉALABLE éventuel (port qui produit / Surplus, l.366-372, hero-test). Aucun
 *  candidat au Ragot → même message qu'avant, aucun jet à ouvrir. */
const PORT_SELL_GOSSIP_KIND = 'port-sell-gossip';
registerCascadeApplier(PORT_SELL_GOSSIP_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoIndex = Number(step.meta?.cargoIndex ?? -1);
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return {};
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const actor = garanti(step.actorId ? actorIn(get(), step.actorId) : undefined, step.actorId, 'ragot au port');
  // Le Test de Ragot n'a pas de rangée propre : sa ligne se DÉRIVE (`traceLineOf`), jamais ré-imprimée à la main.
  const gossip = (issue: string) => freeCons([traceLineOf({
    who: actor.label, label: t('port.gossipRow', { skill: refLabel('skills', { id: 'ragot' }), label }),
    roll: step.result!.roll, target: step.result!.target, sl: step.result!.sl, success: step.result!.success, issue,
  })]);
  if (!step.result.success) {
    return { consequences: gossip(t('port.gossipFail', { relation: sellRelation(st.port, lot.cargoId) === 'surplus' ? t('port.hasSurplus') : t('port.produces') })) };
  }
  chainStep(get, () => openPortSellBuyerStep(get, set, cargoIndex, lot.enc, false, 1));
  return { consequences: gossip(t('port.gossipOk')) };
});

/** VENTE d'un lot de cargaison (l.351-397) : trouver un acheteur (relation du port au bien),
 *  Prix d'offre (% du prix de base par Richesse+Taille+Demande), Marchandage opposé (vendeur PJ +DR).
 *  Retire le lot vendu de la cale, crédite la bourse. CASCADE (Ragot → acheteur → Marchandage) —
 *  chaque étape routée par la policy M/V/I (cf. docstring d'en-tête). */
export function portSellCargo(get: Get, set: Set, cargoIndex: number): void {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return;
  const lot = (vessel.cargo ?? [])[cargoIndex];
  if (!lot) return;
  const milles = vessel.lastVoyageMilles ?? 0;
  const chance = sellChance(st.port, lot.cargoId, milles);
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;

  if (chance.gossip) {
    const best = partyAssisted(get().party, 'ragot');
    if (!best) {
      log(get, set, [t('port.noCamelot', { label, relation: sellRelation(st.port, lot.cargoId) === 'surplus' ? t('port.hasSurplus') : t('port.produces') })]);
      return;
    }
    openPartyTest(get, set, {
      skill: 'ragot',
      actionLabel: t('port.buyerSearch'),
      difficulty: chance.gossip.difficulty,
      stake: combatStakeRef(PORT_SELL_GOSSIP_KIND),
    }, PORT_SELL_GOSSIP_KIND, { cargoIndex });
    return;
  }
  openPortSellBuyerStep(get, set, cargoIndex, lot.enc, true, 1);
}

/** BRADER un lot (l.399) : ¼ du prix de base dans un port « commerce » ou en Demande — sinon refus. */
export function portDumpCargo(get: Get, set: Set, cargoIndex: number): void {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return;
  const lot = (vessel.cargo ?? [])[cargoIndex];
  if (!lot) return;
  const pct = dumpingPricePct(st.port, lot.cargoId);
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (pct == null) { log(get, set, [t('port.dumpRefused', { label })]); return; }
  const gross = Math.max(0, Math.round(lot.enc * lot.basePriceGold * (pct / 100)));
  const nextCargo = (vessel.cargo ?? []).filter((_, i) => i !== cargoIndex);
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const freed = cargoTotalEnc(nextCargo);
  distributeCredit(get, set, fromBrass(gross * PA_PER_CO));
  set({
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, freeEnc: Math.max(0, capacity - freed), maxLoadEnc: Math.max(0, overloadMaxEnc(capacity) - freed) },
  });
  log(get, set, [t('port.dumped', { enc: lot.enc, label, pct, money: formatMoney(fromBrass(gross * PA_PER_CO)) })]);
}

/** RECRUTEMENT à quai (#228, escale-hub) : embauche `count` PNJ salariés au rôle `roleId` — fusionné
 *  dans le roster `vessel.crew` (`CrewHire[]`, #216). La solde HEBDOMADAIRE (`crew-roles.json`,
 *  MDG 14 l.293-302) est prélevée à l'entretien (`resolveVesselWeek`) : le moteur ne débite JAMAIS à
 *  l'embauche (aucune avance dans le modèle), la bourse ne bouge pas ici. Un rôle sans barème (`wage`
 *  absent) n'est pas recrutable. Renvoie le journal (ligne de solde totale recalculée). */
export function portHireCrew(get: Get, set: Set, roleId: string, count = 1): string[] {
  const vessel = get().vessel;
  if (!vessel || count <= 0) return [];
  const role = findCrewRoleById(roleId);
  if (!role?.wage) return [];
  const crew = vessel.crew ?? [];
  const next = crew.some((h) => h.roleId === roleId)
    ? crew.map((h) => h.roleId === roleId ? { ...h, count: h.count + count } : h)
    : [...crew, { roleId, count }];
  set({ vessel: { ...vessel, crew: next } });
  const lines = [t('port.hired', { count, role: role.label, wage: formatMoney(priceToMoney(role.wage.weekly)), total: formatMoney(fromBrass(weeklyCrewWageBrass(next))) })];
  log(get, set, lines);
  return lines;
}

/** DÉBARQUEMENT d'un membre salarié à quai (#228) : retire `count` PNJ du rôle `roleId` (poste supprimé
 *  s'il tombe à 0). Aucune indemnité modélisée (le moteur ne débite qu'à la paie). Renvoie le journal. */
export function portDismissCrew(get: Get, set: Set, roleId: string, count = 1): string[] {
  const vessel = get().vessel;
  if (!vessel || count <= 0) return [];
  const crew = vessel.crew ?? [];
  const cur = crew.find((h) => h.roleId === roleId);
  if (!cur) return [];
  const left = cur.count - count;
  const next = left > 0 ? crew.map((h) => h.roleId === roleId ? { ...h, count: left } : h) : crew.filter((h) => h.roleId !== roleId);
  set({ vessel: { ...vessel, crew: next } });
  const role = findCrewRoleById(roleId);
  const lines = [t('port.dismissed', { count: Math.min(count, cur.count), role: role?.label ?? roleId, total: formatMoney(fromBrass(weeklyCrewWageBrass(next))) })];
  log(get, set, lines);
  return lines;
}

// Ré-exports des services de coque (déjà dans seaVoyageFlow) — l'écran Port les appelle par le store.
export { portRepairVessel, portCareenVessel, portInstallUpgrade } from './seaVoyageFlow';
