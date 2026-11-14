/**
 * ÉCRAN MARCHÉ TERRESTRE / FLUVIAL (Mort sur le Reik Compagnon ch.11 « Règles du commerce ») — le PENDANT
 * TERRESTRE de `portFlow` (commerce maritime, MDG 15). Même SHAPE « acheter bas / transporter / revendre »
 * orchestrée côté noyau contre le moteur PUR `engine/landCargo` (déjà testé) ; SEULES les formules du RAW MSRC
 * diffèrent du maritime (disponibilité en 2 temps, qualité secrète du Vin, Demande/Mise à prix, bradage à ½) →
 * elles vivent dans `landCargo.ts`, ce flux ne fait que les jouer.
 *
 * POURQUOI un flux PARALLÈLE et non une factorisation de `portFlow` : le tronc commun (modèle de lot, tirage
 * saisonnier, prix de base, retrait) est DÉJÀ mutualisé dans `engine/cargo.ts` et réutilisé ici. Le reste de
 * `portFlow` est couplé au NAVIRE de campagne (`state.vessel`, Contenance de coque, PortProfile, sellChance/
 * offerPricePct/dumpingPricePct maritimes) ; la cargaison terrestre vit sur un porteur RÉEL du groupe
 * (`ItemInstance.cargo` d'une bête/véhicule, `bulkCarriers`, #327) et lit `MapPlace.market`
 * (LandMarketProfile). Fusionner
 * les deux imposerait une union `sea|land` et des branches partout → on garde deux flux fins sur le même socle
 * `cargo.ts`. Le Marchandage (Test opposé, ±`bargainPct`) réutilise le MÊME patron que `portFlow`.
 */
import { battleRng } from './battleRng';
import { lieuDuGroupe } from './worldMap';
import { partyAssisted, partyBest, testValue, skillBaseValue } from '../engine/skills';
import { opposedTest, shiftDifficulty, type OpposedResult } from '../engine/tests';
import { bargainPct } from '../engine/bargain';
import { type RNG } from '../engine/dice';
import { ouvrirEtal } from './etalLotFlow';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { chainStep } from './enchainerEtape';
import { openPartyTest, openWorldTest, freeCons } from './rollSeam';
import { t } from '../i18n';
import { actorIn } from './monde/combatants';
import { garanti } from '../lib/garanti';
import { fromBrass, formatMoney, PA_PER_CO, canAfford } from '../engine/money';
import { partyMoneyTotal, payFromGroup, distributeCredit, refusDeGesteSurLeGroupe, totalDesBourses } from './bourseFlow';
import { refuseSi } from './verrousDeFiche';
import {
  type LandMarketProfile, rollFindMerchant, rollCargoQuantity, rollRandomLandCargo, landCargoBasePrice,
  sellDemandTarget, sellOfferPct, landDumpingPct, rollMerchantSkill, partialSurchargePct, minCargoEnc,
  wineEvalDifficulty, wineEvalReveal, rollTradeRumour, gossipRule,
  type TradeRumour, tradeRumourMult,
} from '../engine/landCargo';
import { type CargoLot, type CargoCarrier, findCargoById, loadCargo, carrierCanLoad, carrierFreeEnc, transferCargo } from '../engine/cargo';
import { findLieuServiceById, combatStakeRef } from '../data/index';
import { bulkCarriers, lotDeCargaison, persistCarriersCargo, planDuTransfertDemande, type CarrierStateSlice } from './carriers';
import type { IdDeCargaison, IdDePorteurDeCargaison } from './designations';

import { refuserGeste } from './refusVisible';
import type { Jeu } from './etat';
import { appraiseRefus, APPRAISE_SKILL, remiseMaximaleDeMarchandage } from './merchantFlow';
import { seasonOfMonth } from '../engine/travelStages';
import { toDate, dayIndex } from '../engine/clock';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';

/** Une offre d'achat générée à l'étape (l.36-42) — Enc disponible + prix de base NOTÉ en CO par point d'Enc
 *  (`landCargoBasePrice` ; le Vin fige sa qualité secrète / son prix ICI, l.93-104). `wine` : cargaison à
 *  qualité incertaine. */
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
  /** L'achat en composition (`fenetreChoisir('marcheDeTerre', …)`). */
  achat?: import('./cargaison').BrouillonDAchat;
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().ecrireAuJournal(lines);
};

/** Lieu de commerce terrestre courant (place de la carte dont la scène EST la scène courante + `market`). */
export function currentMarket(get: Get): { placeId: string; label: string; market: LandMarketProfile } | null {
  const place = lieuDuGroupe(get());
  if (!place?.market) return null;
  return { placeId: place.id, label: place.label, market: place.market };
}

/** Génère les offres d'ACHAT à l'arrivée (MSRC 13 l.22-42) : disponibilité en 2 temps — d'abord une CHANCE de
 *  trouver un marchand ((Taille+Richesse)×10 %, `rollFindMerchant`), puis la TAILLE de chaque cargaison
 *  (`rollCargoQuantity`). Un Emplacement « Commerce » ajoute une cargaison ALÉATOIRE de la table saisonnière. */
export function ouvrirLeMarche(get: Get, set: Set): void {
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
    const cargo = findCargoById(cargoId);
    if (!cargo || offers.some((o) => o.cargoId === cargoId)) return;
    phase(`Quantité — ${cargo.label}`);
    const { enc } = rollCargoQuantity(market, rng);
    if (enc <= 0) return;
    phase(`Prix de base — ${cargo.label}`);
    const basePrice = landCargoBasePrice(cargo, season, market, rng);
    offers.push({ cargoId, label: cargo.label, enc, basePrice, wine: !!cargo.wine });
  };
  // Marchandises LOCALES (colonne Produits) : un marqueur de l'Index (`echangeable: false`) n'est pas
  // résolu par `findCargoById`, donc il n'ouvre aucune offre.
  if (find.localFound) for (const id of market.produits.filter((p) => findCargoById(p))) addOffer(id);
  // « Commerce » (l.32-34) : une cargaison ALÉATOIRE de la table saisonnière en plus.
  if (find.randomFound) { phase('Cargaison de Commerce'); addOffer(rollRandomLandCargo(season, rng).id); }
  // Identité de HALLE (#371) : hôte + décor. Défaut partagé au catalogue `marche` (`lieux-services.json`),
  // surchargé PAR LIEU par le profil de marché — la halle a un visage et une voix comme le marchand.
  const marcheDef = findLieuServiceById('marche');
  const hostLine = market.hostLine ?? marcheDef?.hostLine;
  const backdrop = (market.backdrop ?? marcheDef?.backdrop)?.id;
  set({ landMarket: { placeId: cur.placeId, label: cur.label, market: structuredClone(market), offers, hostLine, backdrop } }); // #2097
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
    skill: { id: 'ragot' }, assisted: false,
    actionLabel: 'Rumeur commerciale',
    difficulty: shiftDifficulty(gossipRule.difficulty, gossipRule.mod),
    stake: combatStakeRef(LAND_GOSSIP_KIND),
  }, LAND_GOSSIP_KIND, { placeId: cur.placeId });
}

const LAND_GOSSIP_KIND = 'marche-rumeur';

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
  const biensTxt = rumour.biens.map((id) => findCargoById(id)?.label ?? id).join(', ');
  log(get, set, [t('lm.rumeur', { biens: biensTxt, lieu: target.label })]); // MSRC 13 l.180
}

/** Refus d'évaluer le lot `cargoId` (MSRC 13 l.95) : `refusDeGesteSurLeGroupe`, hors de la halle, offre absente, lot
 *  qui n'est pas du vin, vin déjà évalué, personne qui puisse tenter l'Évaluation (`appraiseRefus`) ; `null` sinon.
 *  Tombe dans `evaluerLeVin`, lu par l'écran du marché. */
export function refusDEvaluerLeVin(s: Pick<Jeu, 'net' | 'landMarket' | 'party'>, cargoId: string): string | null {
  const groupe = refusDeGesteSurLeGroupe(s);
  if (groupe) return groupe;
  if (!s.landMarket) return t('lm.horsDeLaHalle');
  const offre = s.landMarket.offers.find((o) => o.cargoId === cargoId);
  if (!offre) return t('lm.offreAbsente');
  if (!offre.wine) return t('lm.pasDuVin', { label: offre.label });
  if (offre.wineTier) return t('lm.vinEvalue', { label: offre.label });
  return appraiseRefus(s.party);
}

/** ÉVALUATION de la qualité SECRÈTE d'un lot de Vin/Eau-de-vie proposé (l.95) : Test d'Évaluation, difficulté
 *  Intermédiaire (Accessible si le meneur a Résistance à l'alcool ≥ 50). Sur un succès, révèle la vraie qualité ;
 *  sur un échec, une FAUSSE indication décalée du degré d'échec. Un lot ne s'évalue qu'une fois. */
export function evaluerLeVin(get: Get, set: Set, cargoId: string): void {
  const refus = refusDEvaluerLeVin(get(), cargoId);
  if (refus) { refuserGeste(get, set, refus); return; }
  const offer = garanti(get().landMarket?.offers.find((o) => o.cargoId === cargoId), cargoId, 'vin à évaluer');
  const best = partyBest(get().party, { skill: APPRAISE_SKILL.evaluation.skill })!;
  const diff = wineEvalDifficulty(testValue(best.actor, { skill: { id: 'resistance-a-l-alcool' } }));
  // #274 sweep : `rollTest` inline silencieux — migré sur `openRoll`.
  openPartyTest(get, set, {
    skill: { id: 'evaluation' }, assisted: false,
    actionLabel: `Évaluer ${offer.label}`,
    difficulty: diff,
    stake: combatStakeRef(LAND_WINE_EVAL_KIND),
  }, LAND_WINE_EVAL_KIND, { cargoId });
}

const LAND_WINE_EVAL_KIND = 'marche-evaluation-vin';

/** TRANSFERT de cargaison entre deux porteurs CO-LOCALISÉS (#327, décision 8) — route par `transferCargo`
 *  du tronc (jamais une 2ᵉ arithmétique) puis RE-PERSISTE les deux porteurs. Le refus du plan
 *  (`planDuTransfertDemande`) tombe avant toute écriture. */
export function deplacerLaCargaison(get: Get, set: Set, lotId: IdDeCargaison, toId: IdDePorteurDeCargaison, enc: number): void {
  if (refuseSi(get, set, refusDeGesteSurLeGroupe)) return;
  const plan = planDuTransfertDemande(bulkCarriers(get()), lotId, toId, enc);
  if (plan.refus !== null) { refuserGeste(get, set, plan.refus); return; }
  const { from, to, lot } = plan;
  const res = transferCargo(from, to, lotId, plan.enc, get().forgerUnId);
  set(persistCarriersCargo(get(), [{ carrierId: from.id, cargo: res.from.cargo }, { carrierId: to.id, cargo: res.to.cargo }]));
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  log(get, set, [t('lm.transfert', { enc: res.moved, label, de: from.label, vers: to.label })]);
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
    attacker: skillBaseValue(best.actor, { skill: { id: 'marchandage' } }), defender: merchant,
  });
}

/** Pourquoi un lot ne s'achète pas, avant le Marchandage (MSRC 13 l.131 ; EDOC 7) — `invite` :
 *  `refusDeGesteSurLeGroupe`. */
export type RefusDAchatDeCargaison =
  | { motif: 'invite' }
  | { motif: 'offre-absente' }
  | { motif: 'rien' }
  | { motif: 'lot-minimal'; min: number }
  | { motif: 'sans-porteur' }
  | { motif: 'contenance'; porteur: string; libre: number; capacite: number }
  | { motif: 'bourse'; plancher: number };

/** Libellé d'un refus d'achat de cargaison. */
export function raisonDuRefusDAchatDeCargaison(refus: RefusDAchatDeCargaison): string {
  switch (refus.motif) {
    case 'invite': return t('groupe.hoteSeul');
    case 'offre-absente': return t('lm.offreAbsente');
    case 'rien': return t('lm.rienAAcheter');
    case 'lot-minimal': return t('lm.lotMinimal', { min: refus.min });
    case 'sans-porteur': return t('lm.sansPorteur');
    case 'contenance': return t('lm.contenance', { porteur: refus.porteur, libre: refus.libre, capacite: refus.capacite });
    case 'bourse': return t('cargo.bourseSousPlancher', { plancher: formatMoney(fromBrass(refus.plancher * PA_PER_CO)) });
  }
}

/** Prix d'un lot en CO, arrondi au sou : `basePrice` en CO par point d'Enc, `pct` = effet du Marchandage,
 *  `partiel` = lot partiel. MSRC 13 l.127-131 */
export function prixDuLotDeCargaison(enc: number, basePrice: number, partiel: boolean, pct: number): number {
  return Math.max(0, Math.round(enc * basePrice * (1 + (pct + (partiel ? partialSurchargePct() : 0)) / 100) * PA_PER_CO)) / PA_PER_CO;
}

/** Devis d'achat d'un lot : `enc` retenu (défaut : l'offre entière dans la place libre du porteur),
 *  estimation AVANT Marchandage, PLANCHER au meilleur Marchandage possible du groupe
 *  (`remiseMaximaleDeMarchandage`), et refus (`null` : le geste passe au Marchandage). Une bourse sous le
 *  plancher refuse avant le jet ; entre le plancher et le prix, elle se juge après le jet. */
export type DevisDAchatDeCargaison = { enc: number; partiel: boolean; estimationGold: number; plancherGold: number } & (
  | { refus: null; offre: LandOffer; porteur: CargoCarrier }
  | { refus: RefusDAchatDeCargaison; offre?: LandOffer; porteur?: CargoCarrier }
);

/** SOURCE UNIQUE du verdict d'achat de cargaison terrestre : `acheterALaHalle` l'applique, l'écran du marché
 *  le lit. PUR. */
export function devisDAchatDeCargaison(s: CarrierStateSlice & Pick<Jeu, 'landMarket' | 'net'>, porteurId: IdDePorteurDeCargaison, cargoId: string, enc?: number): DevisDAchatDeCargaison {
  const offre = s.landMarket?.offers.find((o) => o.cargoId === cargoId);
  if (!offre) return { enc: 0, partiel: false, estimationGold: 0, plancherGold: 0, refus: { motif: 'offre-absente' } };
  const porteur = bulkCarriers(s).find((c) => c.id === porteurId);
  const libre = porteur ? carrierFreeEnc(porteur) : 0;
  const want = Math.max(0, Math.min(Math.floor(enc ?? Math.min(offre.enc, libre || offre.enc)), offre.enc));
  const partiel = want < offre.enc;
  const plancherGold = prixDuLotDeCargaison(want, offre.basePrice, partiel, -remiseMaximaleDeMarchandage(s.party));
  const base = { enc: want, partiel, estimationGold: prixDuLotDeCargaison(want, offre.basePrice, partiel, 0), plancherGold, offre, porteur };
  if (refusDeGesteSurLeGroupe(s)) return { ...base, refus: { motif: 'invite' } };
  if (want <= 0) return { ...base, refus: { motif: 'rien' } };
  if (want < minCargoEnc()) return { ...base, refus: { motif: 'lot-minimal', min: minCargoEnc() } };
  if (!porteur) return { ...base, refus: { motif: 'sans-porteur' } };
  if (!carrierCanLoad(porteur, want)) return { ...base, refus: { motif: 'contenance', porteur: porteur.label, libre, capacite: porteur.capacity } };
  if (!canAfford(totalDesBourses(s.party), fromBrass(plancherGold * PA_PER_CO))) return { ...base, refus: { motif: 'bourse', plancher: plancherGold } };
  return { ...base, porteur, refus: null };
}

/** ACHAT d'une cargaison (MSRC 13 l.129-131) : refus de `devisDAchatDeCargaison`, puis Marchandage opposé et
 *  prix `prixDuLotDeCargaison`. Débité, CHARGÉ sur le porteur désigné (plafond DUR #327). */
export function acheterALaHalle(get: Get, set: Set, porteurId: IdDePorteurDeCargaison, cargoId: string, enc: number): void {
  const st = garanti(get().landMarket, cargoId, 'halle ouverte à l’achat');
  const devis = devisDAchatDeCargaison(get(), porteurId, cargoId, enc);
  if (devis.refus) { refuserGeste(get, set, raisonDuRefusDAchatDeCargaison(devis.refus)); return; }
  const { offre: offer, porteur: carrier, enc: want, partiel: partial } = devis;
  const rng = battleRng();
  const best = partyAssisted(get().party, { skill: { id: 'marchandage' } });
  const merchant = rollMerchantSkill(rng); // petit marchand : 2d10 + 30 (l.129)
  let pct = 0; // % appliqué au prix (négatif = remise pour l'acheteur)
  let bargainLine = 'Aucun marchandeur dans le groupe — prix plein.';
  if (best) {
    const opp = bargainOpposed(best, merchant, rng);
    const netSL = opp.netSL;
    if (opp.winner === 'attaquant') pct = -bargainPct(true, netSL, hasBargainBonus(best.actor)); // remise à l'acheteur
    else if (opp.winner === 'defenseur') pct = bargainPct(true, netSL, false); // le marchand monte le prix
    bargainLine = `${best.actor.label} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}) : ${pct === 0 ? 'prix inchangé' : pct < 0 ? `remise de ${-pct} %` : `surcoût de ${pct} %`}.`;
  }
  const price = prixDuLotDeCargaison(want, offer.basePrice, partial, pct);
  const cost = fromBrass(price * PA_PER_CO);
  if (!canAfford(partyMoneyTotal(get), cost)) { refuserGeste(get, set, t('cargo.purseShort', { price: formatMoney(cost), label: offer.label, bargain: bargainLine })); return; }
  const lot: CargoLot = { uid: get().forgerUnId('it'), cargoId, enc: want, basePriceGold: offer.basePrice };
  const { carrier: loaded } = loadCargo(carrier, lot);
  // Cargaison de GROUPE (l.129-131) : débit sans bénéficiaire unique → cotisation gloutonne des bourses.
  payFromGroup(get, set, cost, { purpose: 'cargaison terrestre' });
  set({
    ...persistCarriersCargo(get(), [{ carrierId: carrier.id, cargo: loaded.cargo }]),
    landMarket: { ...st, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, enc: o.enc - want } : o).filter((o) => o.enc > 0) },
  });
  log(get, set, [t('lm.charge', { enc: want, label: offer.label, porteur: carrier.label, marchandage: bargainLine, partiel: partial ? t('lm.fragPartiel') : '', prix: formatMoney(cost) })]); // MSRC 13 l.131
}

/**
 * VENTE d'un lot du convoi (MSRC 13 l.133-160) : trouver un acheteur (Demande = Taille×10, +30 si
 * Commerce), Mise à prix (% du prix de base par Richesse), Marchandage opposé. Un échec autorise une
 * 2ᵉ tentative sur la MOITIÉ DU LOT — la Demande visée, elle, ne bouge pas (l.146 verbatim : « ils
 * peuvent proposer la moitié de la cargaison à la place : lancez à nouveau le dé en l'opposant au
 * nombre précédemment obtenu »). Retire le lot vendu, crédite la bourse.
 *
 * Le dé d'acheteur est un dé de MONDE routé par la porte (`openWorldTest`, porteur `WORLD_STEP_OWNER`) — MÊME
 * chemin que son jumeau maritime (`portFlow.openPortSellBuyerStep`) : le siège qui possède le monde
 * le POSE quand l'option « Dés fixés » est active, et le voit passer sinon.
 */
export function vendreALaHalle(get: Get, set: Set, lotId: IdDeCargaison): void {
  if (refuseSi(get, set, refusDeGesteSurLeGroupe)) return;
  const tenu = lotDeCargaison(get(), lotId);
  if (!get().landMarket || !tenu) return;
  openLandSellBuyerStep(get, set, lotId, tenu.lot.enc, true, 1);
}

/** 1. Trouver un acheteur (dé de MONDE, MSRC 13 l.146) : cible = la Demande du Lieu. Échec sur la 1ʳᵉ
 *  tentative → 2ᵉ tentative sur la MOITIÉ du lot, MÊME cible (`attempt:2`). */
function openLandSellBuyerStep(get: Get, set: Set, lotId: IdDeCargaison, sellEnc: number, allowHalfRetry: boolean, attempt: 1 | 2): void {
  const st = get().landMarket;
  if (!st || !lotDeCargaison(get(), lotId)) return;
  openWorldTest(get, set, {
    actionLabel: t('port.buyerSearch'),
    cible: sellDemandTarget(st.market),
    verdict: { reussite: t('seuil.acheteurTrouve'), echec: t('seuil.aucunAcheteur') },
  }, LAND_SELL_BUYER_KIND, { lotId, sellEnc, retryHalf: allowHalfRetry, attempt });
}

const LAND_SELL_BUYER_KIND = 'acheteurATerre';

/** 2-3. Mise à prix (l.148-156) puis Marchandage opposé (l.127), une fois l'acheteur trouvé — retire le
 *  lot (ou la fraction vendue) du porteur et crédite la bourse. `avant` = les lignes déjà dues au
 *  moment de la vente (« la moitié trouve preneur »), journalisées AVANT la ligne de vente comme dans
 *  la résolution synchrone d'origine. */
function finishLandSale(get: Get, set: Set, lotId: IdDeCargaison, sellEnc: number, avant: string[]): void {
  const st = get().landMarket;
  const tenu = lotDeCargaison(get(), lotId);
  if (!st || !tenu) return;
  const { porteur, lot } = tenu;
  const lots = porteur.cargo;
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (avant.length) log(get, set, avant);
  const rng = battleRng();
  const offerPct = sellOfferPct(st.market);
  const best = partyAssisted(get().party, { skill: { id: 'marchandage' } });
  const merchant = rollMerchantSkill(rng);
  let bargainPctVal = 0;
  let bargainLine = 'Aucun marchandeur — mise à prix prise telle quelle.';
  if (best) {
    const opp = bargainOpposed(best, merchant, rng);
    const netSL = opp.netSL;
    if (opp.winner === 'attaquant') bargainPctVal = bargainPct(true, netSL, hasBargainBonus(best.actor)); // le PJ monte le prix
    else if (opp.winner === 'defenseur') bargainPctVal = -bargainPct(true, netSL, false); // l'acheteur le baisse
    bargainLine = `${best.actor.label} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}) : ${bargainPctVal === 0 ? 'sans effet' : bargainPctVal > 0 ? `+${bargainPctVal} %` : `${bargainPctVal} %`}.`;
  }
  // Rumeur commerciale (l.180) : une rumeur du board visant CE Lieu et CE bien le fait vendre au DOUBLE du
  // base. Non consommée (« autant qu'ils le souhaitent ») → elle reste sur le board.
  const rumourMult = tradeRumourMult(get().tradeRumours ?? [], st.placeId, lot.cargoId);
  const rumourHit = rumourMult > 1;
  const gross = Math.max(0, Math.round(sellEnc * lot.basePriceGold * (offerPct / 100) * (1 + bargainPctVal / 100) * rumourMult * PA_PER_CO));
  const newCargo = sellEnc >= lot.enc ? lots.filter((l) => l.uid !== lotId) : lots.map((l) => l.uid === lotId ? { ...l, enc: l.enc - sellEnc } : l);
  // Recette de cargaison de GROUPE (l.133-160) → crédit réparti par tête sur les bourses.
  distributeCredit(get, set, fromBrass(gross));
  set(persistCarriersCargo(get(), [{ carrierId: porteur.id, cargo: newCargo }]));
  log(get, set, [t('lm.vendu', { enc: sellEnc, label, pct: offerPct, marchandage: bargainLine, rumeur: rumourHit ? t('lm.fragRumeur') : '', prix: formatMoney(fromBrass(gross)) })]); // MSRC 13 l.180
}

/** Refus de brader le lot `cargoId` à la halle ouverte : `refusDeGesteSurLeGroupe`, puis lieu sans Commerce en
 *  Produits (`landDumpingPct` nul, MSRC 13 l.160) ; `null` sinon. Tombe dans `jeterALaHalle`, lu par l'écran. */
export function refusDeBradageALaHalle(s: Pick<Jeu, 'net' | 'landMarket'>, cargoId: string): string | null {
  return refusDeGesteSurLeGroupe(s)
    ?? (s.landMarket && landDumpingPct(s.landMarket.market) == null ? t('lm.bradageRefuse', { label: findCargoById(cargoId)?.label ?? cargoId }) : null);
}

/** BRADER un lot invendable (l.160) : la MOITIÉ du prix de base, dans un Lieu ayant le Commerce en Produits —
 *  sinon refus. */
export function jeterALaHalle(get: Get, set: Set, lotId: IdDeCargaison): void {
  const st = get().landMarket;
  const tenu = lotDeCargaison(get(), lotId);
  if (!st || !tenu) return;
  const { porteur, lot } = tenu;
  const refus = refusDeBradageALaHalle(get(), lot.cargoId);
  if (refus) { refuserGeste(get, set, refus); return; }
  const pct = garanti(landDumpingPct(st.market), st.placeId, 'pourcentage de bradage');
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const gross = Math.max(0, Math.round(lot.enc * lot.basePriceGold * (pct / 100) * PA_PER_CO));
  // Bradage de cargaison de GROUPE (l.160) → crédit réparti par tête sur les bourses.
  distributeCredit(get, set, fromBrass(gross));
  set(persistCarriersCargo(get(), [{ carrierId: porteur.id, cargo: porteur.cargo.filter((l) => l.uid !== lotId) }]));
  log(get, set, [t('lm.brade', { enc: lot.enc, label, pct, prix: formatMoney(fromBrass(gross)) })]);
}

export function sortiesDuMarcheTerrestre(_get: Get, set: Set) {
  return { marcheDeTerre: () => set({ landMarket: null }) } satisfies Partial<SortiesDeFenetre>;
}

export function creerActionsDuMarcheTerrestre(get: Get, set: Set) {
  return {
    ouvrirLeMarche: () => ouvrirLeMarche(get, set),
    deplacerLaCargaison: (lotId, toId, enc) => deplacerLaCargaison(get, set, lotId, toId, enc),
    evaluerLeVin: (cargoId) => evaluerLeVin(get, set, cargoId),
  } satisfies FabriqueDuNoyau;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [LAND_GOSSIP_KIND, LAND_WINE_EVAL_KIND, LAND_SELL_BUYER_KIND] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    [LAND_GOSSIP_KIND]: (get, set, step) => {
      if (!step.result?.success) return {};
      generateTradeRumour(get, set, String(step.meta?.placeId ?? ''), battleRng());
      return {};
    },
    [LAND_WINE_EVAL_KIND]: (get, set, step) => {
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
    },
    [LAND_SELL_BUYER_KIND]: (get, set, step) => {
      if (!step.result) return {};
      const lotId = String(step.meta?.lotId ?? '');
      const sellEnc = Number(step.meta?.sellEnc ?? 0);
      const retryHalf = !!step.meta?.retryHalf;
      const attempt = Number(step.meta?.attempt ?? 1);
      const st = get().landMarket;
      const lot = lotDeCargaison(get(), lotId)?.lot;
      if (!st || !lot) return {};
      const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
      if (step.result.success) {
        const demi = attempt === 2 ? [`${label} : pas d’acheteur pour tout le lot — la moitié (${sellEnc} Enc) trouve preneur.`] : [];
        chainStep(get, () => finishLandSale(get, set, lotId, sellEnc, demi));
        return {};
      }
      if (attempt === 1 && retryHalf) {
        chainStep(get, () => openLandSellBuyerStep(get, set, lotId, Math.max(1, Math.floor(lot.enc / 2)), false, 2));
        return {};
      }
      return { consequences: freeCons([`${label} : aucun acheteur intéressé à ${st.label} (Demande ${step.result.target}).`]) };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  generateursDEtal: {
    land: { gen: genererHalle, apres: apresHalle },
  },
} satisfies FragmentDeTables;
