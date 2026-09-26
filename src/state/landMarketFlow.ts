/**
 * ÉCRAN MARCHÉ TERRESTRE / FLUVIAL (Mort sur le Reik Compagnon ch.11 « Règles du commerce ») — le PENDANT
 * TERRESTRE de `portFlow` (commerce maritime, MDG 15). Même SHAPE « acheter bas / transporter / revendre »
 * orchestrée côté state contre le moteur PUR `engine/landCargo` (déjà testé) ; SEULES les formules du RAW MSRC
 * diffèrent du maritime (disponibilité en 2 temps, qualité secrète du Vin, Demande/Mise à prix, bradage à ½) →
 * elles vivent dans `landCargo.ts`, ce flux ne fait que les jouer.
 *
 * POURQUOI un flux PARALLÈLE et non une factorisation de `portFlow` : le tronc commun (modèle de lot, tirage
 * saisonnier, prix de base, retrait) est DÉJÀ mutualisé dans `engine/cargo.ts` et réutilisé ici. Le reste de
 * `portFlow` est couplé au NAVIRE de campagne (`state.vessel`, Contenance de coque, PortProfile, sellChance/
 * offerPricePct/dumpingPricePct maritimes) ; la cargaison terrestre vit sur un porteur RÉEL du groupe
 * (`ItemInstance.cargo` d'une bête/véhicule, `primaryCargoCarrier`, #327) et lit `MapPlace.market`
 * (LandMarketProfile). Fusionner
 * les deux imposerait une union `sea|land` et des branches partout → on garde deux flux fins sur le même socle
 * `cargo.ts`. Le Marchandage (Test opposé ±10 %/±20 %) réutilise le MÊME patron que `portFlow`.
 */
import { battleRng } from './battleRng';
import { placeOfScene } from './worldMap';
import { dayIndex } from './upkeep';
import { partyAssisted, partyBest, testValue, skillBaseValue } from '../engine/skills';
import { opposedTest, SL_ASTOUNDING, shiftDifficulty, type OpposedResult } from '../engine/tests';
import { type RNG } from '../engine/dice';
import { ouvrirEtal, registerEtalGenerateur } from './etalLotFlow';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { registerCascadeApplier, chainStep } from './cascade';
import { openPartyTest, openWorldTest, freeCons } from './rollSeam';
import { actorIn, garanti } from './combatants';
import { toBrass, fromBrass, formatMoney, PA_PER_CO, canAfford, toMoney } from '../engine/money';
import { partyMoneyTotal, payFromGroup, distributeCredit } from './bourseFlow';
import {
  type LandMarketProfile, rollFindMerchant, rollCargoQuantity, rollRandomLandCargo, landCargoBasePrice,
  findLandCargoById, sellDemandTarget, sellOfferPct, landDumpingPct, rollMerchantSkill, partialSurchargePct, minCargoEnc,
  wineEvalDifficulty, wineEvalReveal, rollTradeRumour, gossipRule,
  type TradeRumour, tradeRumourMult,
} from '../engine/landCargo';
import { type CargoLot, loadCargo, carrierCanLoad, carrierFreeEnc, transferCargo } from '../engine/cargo';
import { findLieuServiceById, combatStakeRef } from '../data/index';
import { primaryCargoCarrier, carrierById, persistCarriersCargo } from './carriers';
import { seasonOfMonth } from '../engine/travelStages';
import { toDate } from '../engine/clock';
import type { Get, Set } from './flowTypes';

/** Une offre d'achat générée à l'étape (l.36-42) — Enc disponible + prix de base NOTÉ (le Vin fige sa
 *  qualité secrète / son prix ICI, l.93-104). `wine` : cargaison à qualité incertaine. */
export interface LandOffer {
  cargoId: string;
  label: string;
  enc: number;
  basePrice: number;
  wine: boolean;
  /** Vin ÉVALUÉ (Test d'Évaluation joué, l.95) : la qualité affichée (vraie sur un succès, FAUSSE sur un
   *  échec). Absent tant que le lot n'a pas été évalué (« qualité incertaine »). */
  wineTier?: string;
  /** Le Test d'Évaluation a-t-il RÉUSSI (indication fiable) ? Présent une fois évalué. */
  wineEvalOk?: boolean;
}

/** État MARCHÉ TERRESTRE ouvert (généré une fois à l'arrivée — les d100 de disponibilité ne se re-tirent pas
 *  par rendu, comme l'écran Port). La rumeur commerciale n'est PAS ici : elle vit sur le board persistant
 *  `store.tradeRumours` (MSRC 13 l.180 : elle vise un AUTRE Lieu), consultée dans l'écran Marché. */
export interface LandMarketState {
  placeId: string;
  label: string;
  market: LandMarketProfile;
  offers: LandOffer[];
  /** Réplique de halle de l'hôte (surcharge de lieu `market.hostLine`, sinon défaut partagé du catalogue
   *  `lieux-services.json` id `marche`) — rendue par le bandeau `SpeakerBanner`. */
  hostLine?: string;
  /** Bande d'ambiance (surcharge de lieu `market.backdrop`, sinon défaut du catalogue) — slot `backdrop`
   *  du `ScreenShell`. */
  backdrop?: string;
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().log(lines);
};

/** Lieu de commerce terrestre courant (place de la carte dont la scène EST la scène courante + `market`). */
export function currentMarket(get: Get): { placeId: string; label: string; market: LandMarketProfile } | null {
  const map = get().worldMap;
  const place = map ? placeOfScene(map, get().scene?.id) : undefined;
  if (!place?.market) return null;
  return { placeId: place.id, label: place.label, market: place.market };
}

/** Génère les offres d'ACHAT à l'arrivée (MSRC 13 l.22-42) : disponibilité en 2 temps — d'abord une CHANCE de
 *  trouver un marchand ((Taille+Richesse)×10 %, `rollFindMerchant`), puis la TAILLE de chaque cargaison
 *  (`rollCargoQuantity`). Un Emplacement « Commerce » ajoute une cargaison ALÉATOIRE de la table saisonnière. */
export function openLandMarket(get: Get, set: Set): void {
  const cur = currentMarket(get);
  if (!cur) return;
  ouvrirEtal(get, set, 'land', `Halle — ${cur.label}`);
}

/** Le GÉNÉRATEUR de la halle : tout son aléa vient du `rng` reçu, et chaque dé DIT ce qu'il décide
 *  (`phase`) — c'est ce qui le rend posable dans la fenêtre de lot (#1426), sans rien changer d'autre. */
function genererHalle(get: Get, set: Set, rng: RNG, phase: (label: string) => void): void {
  const cur = currentMarket(get);
  if (!cur) return;
  const season = seasonOfMonth(toDate(get().gameTime).month);
  const { market } = cur;
  phase('Marchand présent');
  const find = rollFindMerchant(market, rng);
  const offers: LandOffer[] = [];
  const addOffer = (cargoId: string) => {
    const cargo = findLandCargoById(cargoId);
    if (!cargo || offers.some((o) => o.cargoId === cargoId)) return;
    phase(`Quantité — ${cargo.label}`);
    const { enc } = rollCargoQuantity(market, rng);
    if (enc <= 0) return;
    phase(`Prix de base — ${cargo.label}`);
    const basePrice = landCargoBasePrice(cargo, season, market, rng);
    offers.push({ cargoId, label: cargo.label, enc, basePrice, wine: !!cargo.wine });
  };
  // Marchandises LOCALES (colonne Produits) : un marqueur de l'Index (`echangeable: false`) n'est pas
  // résolu par `findLandCargoById`, donc il n'ouvre aucune offre.
  if (find.localFound) for (const id of market.produits.filter((p) => findLandCargoById(p))) addOffer(id);
  // « Commerce » (l.32-34) : une cargaison ALÉATOIRE de la table saisonnière en plus.
  if (find.randomFound) { phase('Cargaison de Commerce'); addOffer(rollRandomLandCargo(season, rng).id); }
  // Identité de HALLE (#371) : hôte + décor. Défaut partagé au catalogue `marche` (`lieux-services.json`),
  // surchargé PAR LIEU par le profil de marché — la halle a un visage et une voix comme le marchand.
  const marcheDef = findLieuServiceById('marche');
  const hostLine = market.hostLine ?? marcheDef?.hostLine;
  const backdrop = market.backdrop ?? marcheDef?.backdrop;
  set({ landMarket: { placeId: cur.placeId, label: cur.label, market, offers, hostLine, backdrop } });
}

/** Ce qui SUIT l'étal : le Test de Ragot des rumeurs commerciales. Il ne s'ouvre qu'une fois l'étal
 *  arrêté (sinon sa modale se disputerait la place avec la fenêtre de lot). */
function apresHalle(get: Get, set: Set): void {
  const cur = currentMarket(get);
  if (!cur) return;
  // Rumeurs commerciales (MSRC 13 l.176-180) : Test de Ragot Complexe (−10) au marché ; sur un succès, on
  // tire un AUTRE Emplacement puis une rumeur (Tableau des rumeurs) → les biens visés s'y vendent au DOUBLE
  // du prix de base (l.180). L'« index géographique du Reikland » (l.180) est ici la liste des Lieux de la
  // carte porteurs d'un `market` (aucun catalogue neuf). #274 sweep : ce Test était un `rollTest` inline
  // silencieux (jamais interrogeable/surfacé au MJ) — migré sur la porte `openRoll`.
  openPartyTest(get, set, {
    skill: 'ragot', assisted: false,
    actionLabel: 'Rumeur commerciale',
    difficulty: shiftDifficulty(gossipRule.difficulty, gossipRule.mod),
    stake: combatStakeRef(LAND_GOSSIP_KIND),
  }, LAND_GOSSIP_KIND, { placeId: cur.placeId });
}

registerEtalGenerateur('land', genererHalle, apresHalle);

const LAND_GOSSIP_KIND = 'land-market-gossip';
registerCascadeApplier(LAND_GOSSIP_KIND, (get, set, step) => {
  if (!step.result?.success) return {};
  generateTradeRumour(get, set, String(step.meta?.placeId ?? ''), battleRng());
  return {};
});

/** Génère une RUMEUR CROSS-LIEU (MSRC 13 l.180) : tire un AUTRE Lieu à `market` de la carte, puis une
 *  rumeur (Tableau des rumeurs) désignant les biens qui s'y vendent au double. Ajoutée au board persistant
 *  `store.tradeRumours` (dédupliquée : même Lieu + mêmes biens ne s'empile pas). Le RAW ne donne aucune
 *  échéance ni consommation par vente (« autant qu'ils le souhaitent ») → elle demeure sur le board.
 *  EXPORTÉ : générateur commercial UNIQUE, réutilisé tel quel par le Ragot d'auberge du hub de ville
 *  (#352, `innFlow.ts`) — zéro prose de rumeur dupliquée. */
export function generateTradeRumour(get: Get, set: Set, currentPlaceId: string, rng: import('../engine/dice').RNG): void {
  const map = get().worldMap;
  const targets = (map?.places ?? []).filter((p) => p.market && p.id !== currentPlaceId);
  if (targets.length === 0) return; // pas d'autre Lieu de commerce connu → aucune rumeur à raccrocher
  const target = targets[rng.int(0, targets.length - 1)];
  const row = rollTradeRumour(rng);
  const board = get().tradeRumours ?? [];
  if (board.some((r) => r.placeId === target.id && r.biens.join(',') === row.biens.join(','))) return; // doublon
  const rumour: TradeRumour = {
    placeId: target.id,
    biens: row.biens,
    mult: 2, // l.180 : « le double du prix de base »
    text: row.desc,
    heardDay: dayIndex(get().gameTime),
  };
  set({ tradeRumours: [...board, rumour] });
  const biensTxt = rumour.biens.map((id) => findLandCargoById(id)?.label ?? id).join(', ');
  log(get, set, [`Rumeur au marché : ${biensTxt} se vendraient le double à ${target.label} (MSRC 13 l.180).`]);
}

/** ÉVALUATION de la qualité SECRÈTE d'un lot de Vin/Eau-de-vie proposé (l.95) : Test d'Évaluation, difficulté
 *  Intermédiaire (Accessible si le meneur a Résistance à l'alcool ≥ 50). Sur un succès, révèle la vraie qualité ;
 *  sur un échec, une FAUSSE indication décalée du degré d'échec. Un lot ne s'évalue qu'une fois. */
export function landEvalWine(get: Get, set: Set, cargoId: string): void {
  const st = get().landMarket;
  if (!st) return;
  const offer = st.offers.find((o) => o.cargoId === cargoId);
  if (!offer || !offer.wine || offer.wineTier) return; // pas du vin, ou déjà évalué
  const best = partyBest(get().party, 'evaluation');
  if (!best) { log(get, set, ['Personne dans le groupe ne sait évaluer un vin.']); return; }
  const diff = wineEvalDifficulty(testValue(best.actor, 'resistance-a-l-alcool'));
  // #274 sweep : `rollTest` inline silencieux — migré sur `openRoll`.
  openPartyTest(get, set, {
    skill: 'evaluation', assisted: false,
    actionLabel: `Évaluer ${offer.label}`,
    difficulty: diff,
    stake: combatStakeRef(LAND_WINE_EVAL_KIND),
  }, LAND_WINE_EVAL_KIND, { cargoId });
}

const LAND_WINE_EVAL_KIND = 'land-market-wine-eval';
registerCascadeApplier(LAND_WINE_EVAL_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoId = String(step.meta?.cargoId ?? '');
  const st = get().landMarket;
  const offer = st?.offers.find((o) => o.cargoId === cargoId);
  if (!st || !offer) return {};
  const { success, sl, roll } = step.result;
  const rev = wineEvalReveal(offer.basePrice, success, sl);
  set({ landMarket: { ...st, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, wineTier: rev.shownLabel, wineEvalOk: success } : o) } });
  const actor = step.actorId ? actorIn(get(), step.actorId) : undefined;
  return { consequences: freeCons([`${garanti(actor, step.actorId, 'évaluation du vin').label} — Évaluation du ${offer.label} (${roll}) : qualité jugée « ${rev.shownLabel} »${success ? '.' : ' — jugement peu sûr…'}`]) };
});

export function closeLandMarket(_get: Get, set: Set): void {
  set({ landMarket: null });
}

/** TRANSFERT de cargaison entre deux porteurs CO-LOCALISÉS (#327, décision 8) — route par `transferCargo`
 *  du tronc (jamais une 2ᵉ arithmétique) puis RE-PERSISTE les deux porteurs. Refus silencieux journalisé
 *  si les porteurs ne sont pas au même endroit ou si la cible est pleine (moved = 0). */
export function moveCargo(get: Get, set: Set, fromId: string, toId: string, cargoId: string, enc: number): void {
  const from = carrierById(get(), fromId);
  const to = carrierById(get(), toId);
  if (!from || !to) return;
  const res = transferCargo(from, to, cargoId, enc);
  if (res.moved <= 0) { log(get, set, ['Transfert impossible : porteurs éloignés ou porteur cible plein.']); return; }
  set(persistCarriersCargo(get(), [{ carrierId: fromId, cargo: res.from.cargo }, { carrierId: toId, cargo: res.to.cargo }]));
  const label = findLandCargoById(cargoId)?.label ?? cargoId;
  log(get, set, [`${res.moved} Enc de ${label} transférés de ${from.label} vers ${to.label}.`]);
}

/** Magnitude d'un Marchandage gagné (LDB 60, cité MSRC 13 l.127) : ±10 %, ±20 % si Négociateur ou DR net Stupéfiant. */
function bargainPct(winnerNegotiator: boolean, netSL: number): number {
  return winnerNegotiator || netSL >= SL_ASTOUNDING ? 20 : 10;
}

/** Marchandage OPPOSÉ terrestre (MSRC 13 l.127) : les deux camps jettent, `opposedTest` est le SEUL
 *  juge (LDB 12 l.160) — le meneur y oppose son Niveau de Compétence NU, lu à l'accesseur canon
 *  (`skillBaseValue`, `LDB 09 l.17`) et non reconstitué par soustraction : sa valeur de jet
 *  (`partyAssisted`) porte le Soutien et TOUS les modificateurs de la valeur de Test (États, mutation,
 *  qualité d'objet… — inventaire : `skills.testValueParts`), qui appartiennent à la CIBLE.
 *  SOURCE UNIQUE des deux sites (achat + vente) : plus aucun départage artisanal par `>` au
 *  call-site. */
function bargainOpposed(best: NonNullable<ReturnType<typeof partyAssisted>>, merchant: number, rng: RNG): OpposedResult {
  // Les deux nues passent par le CANAL `bases` d'`opposedTest` (jamais reposées après coup) : le meneur
  // oppose son Niveau de Compétence NU (accesseur canon) et le marchand sa valeur, qui EST nue.
  return opposedTest(best.value, merchant, rng, 'intermediaire', 'intermediaire', {
    attacker: skillBaseValue(best.actor, 'marchandage'), defender: merchant,
  });
}

/** ACHAT d'une cargaison (MSRC 13 l.129-131) : prix = Enc × prix de base, modulé par le Marchandage opposé et
 *  majoré de +10 % si LOT PARTIEL (l.131). Débité, CHARGÉ sur le porteur de défaut du groupe (navire /
 *  véhicule / bête, `primaryCargoCarrier`) dans la limite de sa Contenance (plafond DUR, #327). */
export function landBuyCargo(get: Get, set: Set, cargoId: string, enc: number): void {
  const st = get().landMarket;
  if (!st) return;
  const offer = st.offers.find((o) => o.cargoId === cargoId);
  if (!offer) return;
  const want = Math.max(0, Math.min(Math.floor(enc), offer.enc));
  if (want <= 0) { log(get, set, ['Rien à acheter.']); return; }
  // Lot minimal (l.131) : « Les marchands ne sont pas du tout intéressés par la vente de cargaisons de moins
  // de 10 Points d'Encombrement et orienteront plutôt les Personnages vers un marché. »
  if (want < minCargoEnc) { log(get, set, [`Les marchands ne cèdent pas de lot de moins de ${minCargoEnc} Points d'Encombrement (MSRC 13 l.131).`]); return; }
  // Contenance = plafond RÉEL (#327) : il faut un porteur, et le lot doit tenir dans sa place libre.
  const carrier = primaryCargoCarrier(get());
  if (!carrier) { log(get, set, ['Aucune bête de somme ni véhicule pour transporter une cargaison — procurez-vous un chariot ou une monture de bât (EDOC 7).']); return; }
  if (!carrierCanLoad(carrier, want)) { log(get, set, [`${carrier.label} ne peut plus charger que ${carrierFreeEnc(carrier)} Enc (Contenance ${carrier.capacity}) — réduisez le lot ou ajoutez un porteur.`]); return; }
  const rng = battleRng();
  const best = partyAssisted(get().party, 'marchandage');
  const merchant = rollMerchantSkill(rng); // petit marchand : 2d10 + 30 (l.129)
  let pct = 0; // % appliqué au prix (négatif = remise pour l'acheteur)
  let bargainLine = 'Aucun marchandeur dans le groupe — prix plein.';
  if (best) {
    const opp = bargainOpposed(best, merchant, rng);
    const netSL = opp.netSL;
    if (opp.winner === 'attacker') pct = -bargainPct(hasBargainBonus(best.actor), netSL); // remise à l'acheteur
    else if (opp.winner === 'defender') pct = bargainPct(false, netSL); // le marchand monte le prix
    bargainLine = `${best.actor.label} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}) : ${pct === 0 ? 'prix inchangé' : pct < 0 ? `remise de ${-pct} %` : `surcoût de ${pct} %`}.`;
  }
  // Lot PARTIEL (l.131) : acheter moins que le stock du marchand → +10 % par 10 Enc sur le prix de base.
  const partial = want < offer.enc;
  const surcharge = partial ? partialSurchargePct : 0;
  const price = Math.max(0, Math.round(want * offer.basePrice * (1 + (pct + surcharge) / 100)));
  const cost = toMoney({ gold: price });
  if (!canAfford(partyMoneyTotal(get), cost)) { log(get, set, [`La bourse ne couvre pas ${price} CO de ${offer.label}.`]); return; }
  const lot: CargoLot = { cargoId, enc: want, basePriceGold: offer.basePrice };
  const { carrier: loaded } = loadCargo(carrier, lot);
  // Cargaison de GROUPE (l.129-131) : débit sans bénéficiaire unique → cotisation gloutonne des bourses.
  payFromGroup(get, set, cost, { purpose: 'cargaison terrestre' });
  set({
    ...persistCarriersCargo(get(), [{ carrierId: carrier.id, cargo: loaded.cargo }]),
    landMarket: { ...st, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, enc: o.enc - want } : o).filter((o) => o.enc > 0) },
  });
  log(get, set, [`${want} Enc de ${offer.label} chargés sur ${carrier.label} — ${bargainLine}${partial ? ' Lot partiel : +10 % (l.131).' : ''} Prix payé : ${formatMoney(fromBrass(toBrass(cost)))}.`]);
}

/**
 * VENTE d'un lot du convoi (MSRC 13 l.133-160) : trouver un acheteur (Demande = Taille×10, +30 si
 * Commerce), Mise à prix (% du prix de base par Richesse), Marchandage opposé. Un échec autorise une
 * 2ᵉ tentative sur la MOITIÉ DU LOT — la Demande visée, elle, ne bouge pas (l.146 verbatim : « ils
 * peuvent proposer la moitié de la cargaison à la place : lancez à nouveau le dé en l'opposant au
 * nombre précédemment obtenu »). Retire le lot vendu, crédite la bourse.
 *
 * Le dé d'acheteur est un dé de MONDE routé par la porte (`openWorldTest`, côté `worldSide`) — MÊME
 * chemin que son jumeau maritime (`portFlow.openPortSellBuyerStep`) : le siège qui possède le monde
 * le POSE quand l'option « Dés fixés » est active, et le voit passer sinon.
 */
export function landSellCargo(get: Get, set: Set, carrierId: string, cargoIndex: number): void {
  const carrier = carrierById(get(), carrierId);
  const lot = carrier?.cargo[cargoIndex];
  if (!get().landMarket || !carrier || !lot) return;
  openLandSellBuyerStep(get, set, carrierId, cargoIndex, lot.enc, true, 1);
}

/** 1. Trouver un acheteur (dé de MONDE, l.146) : cible = la Demande du Lieu, posée en `meta.baseValue`
 *  (difficulté Intermédiaire = modificateur nul, la cible passe telle quelle). Échec sur la 1ʳᵉ
 *  tentative → 2ᵉ tentative sur la MOITIÉ du lot, MÊME cible (`attempt:2`) ; le message « la moitié
 *  trouve preneur » ne s'affiche QUE si cette 2ᵉ tentative réussit. */
function openLandSellBuyerStep(get: Get, set: Set, carrierId: string, cargoIndex: number, sellEnc: number, allowHalfRetry: boolean, attempt: 1 | 2): void {
  const st = get().landMarket;
  const carrier = carrierById(get(), carrierId);
  const lot = carrier?.cargo[cargoIndex];
  if (!st || !carrier || !lot) return;
  openWorldTest(get, set, {
    actionLabel: 'Trouver un acheteur',
    difficulty: 'intermediaire',
  }, LAND_SELL_BUYER_KIND, { carrierId, cargoIndex, sellEnc, retryHalf: allowHalfRetry, attempt, baseValue: sellDemandTarget(st.market) });
}

const LAND_SELL_BUYER_KIND = 'land-sell-buyer';
registerCascadeApplier(LAND_SELL_BUYER_KIND, (get, set, step) => {
  if (!step.result) return {};
  const carrierId = String(step.meta?.carrierId ?? '');
  const cargoIndex = Number(step.meta?.cargoIndex ?? -1);
  const sellEnc = Number(step.meta?.sellEnc ?? 0);
  const retryHalf = !!step.meta?.retryHalf;
  const attempt = Number(step.meta?.attempt ?? 1);
  const st = get().landMarket;
  const carrier = carrierById(get(), carrierId);
  const lot = carrier?.cargo[cargoIndex];
  if (!st || !carrier || !lot) return {};
  const label = findLandCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (step.result.success) {
    const demi = attempt === 2 ? [`${label} : pas d’acheteur pour tout le lot — la moitié (${sellEnc} Enc) trouve preneur.`] : [];
    chainStep(get, () => finishLandSale(get, set, carrierId, cargoIndex, sellEnc, demi));
    return {};
  }
  if (attempt === 1 && retryHalf) {
    chainStep(get, () => openLandSellBuyerStep(get, set, carrierId, cargoIndex, Math.max(1, Math.floor(lot.enc / 2)), false, 2));
    return {};
  }
  return { consequences: freeCons([`${label} : aucun acheteur intéressé à ${st.label} (Demande ${step.result.target}).`]) };
});

/** 2-3. Mise à prix (l.148-156) puis Marchandage opposé (l.127), une fois l'acheteur trouvé — retire le
 *  lot (ou la fraction vendue) du porteur et crédite la bourse. `avant` = les lignes déjà dues au
 *  moment de la vente (« la moitié trouve preneur »), journalisées AVANT la ligne de vente comme dans
 *  la résolution synchrone d'origine. */
function finishLandSale(get: Get, set: Set, carrierId: string, cargoIndex: number, sellEnc: number, avant: string[]): void {
  const st = get().landMarket;
  const carrier = carrierById(get(), carrierId);
  const lots = carrier?.cargo ?? [];
  const lot = lots[cargoIndex];
  if (!st || !carrier || !lot) return;
  const label = findLandCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (avant.length) log(get, set, avant);
  const rng = battleRng();
  const offerPct = sellOfferPct(st.market);
  const best = partyAssisted(get().party, 'marchandage');
  const merchant = rollMerchantSkill(rng);
  let bargainPctVal = 0;
  let bargainLine = 'Aucun marchandeur — mise à prix prise telle quelle.';
  if (best) {
    const opp = bargainOpposed(best, merchant, rng);
    const netSL = opp.netSL;
    if (opp.winner === 'attacker') bargainPctVal = bargainPct(hasBargainBonus(best.actor), netSL); // le PJ monte le prix
    else if (opp.winner === 'defender') bargainPctVal = -bargainPct(false, netSL); // l'acheteur le baisse
    bargainLine = `${best.actor.label} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}) : ${bargainPctVal === 0 ? 'sans effet' : bargainPctVal > 0 ? `+${bargainPctVal} %` : `${bargainPctVal} %`}.`;
  }
  // Rumeur commerciale (l.180) : une rumeur du board visant CE Lieu et CE bien le fait vendre au DOUBLE du
  // base. Non consommée (« autant qu'ils le souhaitent ») → elle reste sur le board.
  const rumourMult = tradeRumourMult(get().tradeRumours ?? [], st.placeId, lot.cargoId);
  const rumourHit = rumourMult > 1;
  const gross = Math.max(0, Math.round(sellEnc * lot.basePriceGold * (offerPct / 100) * (1 + bargainPctVal / 100) * rumourMult));
  const newCargo = sellEnc >= lot.enc ? lots.filter((_, i) => i !== cargoIndex) : lots.map((l, i) => i === cargoIndex ? { ...l, enc: l.enc - sellEnc } : l);
  // Recette de cargaison de GROUPE (l.133-160) → crédit réparti par tête sur les bourses.
  distributeCredit(get, set, fromBrass(gross * PA_PER_CO));
  set(persistCarriersCargo(get(), [{ carrierId, cargo: newCargo }]));
  log(get, set, [`${sellEnc} Enc de ${label} vendus (mise à prix ${offerPct} % du base — ${bargainLine}${rumourHit ? ' Rumeur : demande exceptionnelle, prix doublé (l.180) !' : ''}) : ${formatMoney(fromBrass(gross * PA_PER_CO))}.`]);
}

/** BRADER un lot invendable (l.160) : la MOITIÉ du prix de base, dans un Lieu ayant le Commerce en Produits —
 *  sinon refus. */
export function landDumpCargo(get: Get, set: Set, carrierId: string, cargoIndex: number): void {
  const st = get().landMarket;
  if (!st) return;
  const carrier = carrierById(get(), carrierId);
  if (!carrier) return;
  const lots = carrier.cargo;
  const lot = lots[cargoIndex];
  if (!lot) return;
  const pct = landDumpingPct(st.market);
  const label = findLandCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (pct == null) { log(get, set, [`${label} : ce lieu ne brade pas les cargaisons (pas de Commerce en Produits, MSRC 13 l.160).`]); return; }
  const gross = Math.max(0, Math.round(lot.enc * lot.basePriceGold * (pct / 100)));
  // Bradage de cargaison de GROUPE (l.160) → crédit réparti par tête sur les bourses.
  distributeCredit(get, set, fromBrass(gross * PA_PER_CO));
  set(persistCarriersCargo(get(), [{ carrierId, cargo: lots.filter((_, i) => i !== cargoIndex) }]));
  log(get, set, [`${lot.enc} Enc de ${label} bradés (${pct} % du prix de base) : ${formatMoney(fromBrass(gross * PA_PER_CO))}.`]);
}
