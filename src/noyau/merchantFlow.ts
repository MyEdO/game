/**
 * Actions MARCHAND (#2, LDB 59/60) — module à part du store, même patron
 * `(get, set)` que combatFlow : ouverture/réassort, panier, achat/vente/réparation, Marchandage
 * (Test opposé), Évaluation.
 */
import type { Jeu } from './etat';
import { toRecapLines } from './recapLine';
import { Combatant, ItemInstance, type TestIds } from '../engine/types';
import { recomputeLoadout, contexteDeNaissanceDObjet, itemFromTrappingById, avecObjet } from '../engine/items';
import { isRepairable, itemRepairCostBrass } from '../engine/repair';
import { bargainBuyFactor, bargainSellFactor, bargainPct, type BargainOutcome } from '../engine/bargain';
import { SL_ASTOUNDING, cibleMesuree, estJete } from '../engine/tests';
import { craftPriceFactor, shiftAvailability } from '../engine/qualities/craftEconomy';
import { rule, type RuleValue } from '../engine/policy';
import type { SceneEntity } from './monde/scene';
import { partyAssisted, skillBaseValue, refusPersonneNePeutTenter, type SupportDetail } from '../engine/skills';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { appraiseEstimate } from '../engine/appraisal';
import { makeRNG } from '../engine/dice';
import { hasTalent } from '../engine/magic';
import {
  rollStock,
  fullStock,
  availabilitySearchBonus,
  barterRatio,
  availabilityAfterHalvings,
  priceAfterHalvings,
  isTradable,
  outOfTradeReason,
  type CatalogItem,
  type StockLine,
} from '../engine/disponibilite';
import type { Settlement } from '../data/schemas/grammaire/valeurs';
import type { Availability } from '../engine/types';
import { t, t as msg } from '../i18n'; // `msg` : alias local — `t` est aussi le nom d'un trapping résolu dans ce flux
import { priceToMoney, add as moneyAdd, canAfford, fromBrass, toBrass, formatMoney, statusBudgetBrass, type Money } from '../engine/money';
import { payWithAllocation, payFromGroup, soloPayer, creditBourse, totalDesBourses, refusDeBourse, refusDeGesteSurLeGroupe } from './bourseFlow';
import { actorStatus } from '../engine/social';
import { MINUTES_PER_DAY } from '../engine/clock';
import {
  findTrappingById,
  trappingsInstanciables,
  findVehicleById,
  findCreatureById,
  vehicles,
  creatures,
  combatStakeRef,
  findMerchantArchetypeById,
  type QualityRef,
  type TrappingData,
} from '../data/index';
import type { MerchantArchetypeDef } from '../data/merchants.types';
import type { UniteAchetable } from '../data/merchants.types';
import { FLOWS, type CloturesDuJet } from './rollFlowSpecs';
import { startCascade } from './cascade';
import { freeCons, openPartyTest } from './rollSeam';
import { rollLine } from './ligneDeJet';
import { actorIn, ecrireActeur } from './monde/combatants';
import { garanti } from '../lib/garanti';
import { nomEnVue } from './visionDuGroupe';
import type { CascadeStep, ContrepartieDeMarchandage, OpposantDeMarchandage } from './pendings';
import { sceneNpc } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { cleDeBillet, lieuDuGroupe, placeServiceMerchantId, placeServices, type ResolvedPlaceService } from './worldMap';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { ajouterLaPossession } from './possessionsFlow';
import { traceLineOf } from '../engine/traceLine';
import { refuserGeste } from './refusVisible';

import type { Get, PatchDeFlux, Set } from './flowTypes';
import { dataLabel, refLabel } from '../data';
import { stepDetail } from './rollSeam';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { IdDArticle, IdDeHeros, IdDeLigneDeButin, IdDeLigneDeRepartition, IdDObjet } from './designations';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';
import { refusDInventaire, refuseSi } from './verrousDeFiche';
import { porteurDeLObjet, refusDuHerosPorteur } from './monde/carrier';

/** Boutique OUVERTE (état de la visite en cours). Le stock persistant vit dans `merchantStocks`. */
export interface MerchantState {
  entityId: string;
  archetype: string;
  settlement: Settlement;
  resaleRate: number;
  buyMarkup?: number;
  /** Bande d'ambiance de l'écran (id du registre des fonds de l'hôte) — provient de la donnée du service
   *  de lieu qui ouvre la visite (`lieux-services.json`, ex. `forge` pour le forgeron, #369) ; absente
   *  pour un marchand de scène sans décor seedé. Rendue dans le slot `backdrop` du `ScreenShell`. */
  backdrop?: string;
  /** Stock & panier keyés par `trappingId` (`TrappingData.id`) — le libellé est résolu à l'affichage. */
  stock: { id: string; qty: number }[];
  bargainBuy?: BargainOutcome | null;
  bargainSell?: BargainOutcome | null;
  /** Botch (« rater de beaucoup », LDB 59 l.43) : le marchand se méfie — plus de marchandage cette visite. */
  soured?: boolean;
  cart: { id: string; qty: number }[];
  /** Panier de VENTE (#22b) : instances d'objets sélectionnées chez leur porteur, vendues d'un coup
   *  (`vendreLeLot`) — parité avec le panier d'achat. Une instance est unique (pas de quantité). */
  sellCart?: { uid: string; heroId: string }[];
  /** « Baisse des prix » (LDB 59 l.60) : par instance vendue, nombre de fois où le vendeur divise son
   *  prix par deux pour trouver un acheteur (chaque division monte la Disponibilité d'un cran). */
  sellHalvings?: Record<string, number>;
  /** Répartition post-achat (#760) : objet de sac (`item`) OU unité achetable (`unit`) —
   *  discrimination par la présence du champ, jamais un `kind` redondant. */
  pendingDistribution?: LigneDeRepartition[] | null;
  bargainLocked: boolean;
  bargainPaid?: boolean;
  bargainSellUsed?: boolean;
  /** Le Troc en composition (LDB 59 l.64-76), conclu par le choix `marchand.troquer`. */
  troc?: BrouillonDeTroc | null;
}

/** Le côté d'un marché négocié : l'achat ou la vente (LDB 59 l.43). */
export type ModeDeMarche = 'achat' | 'vente';
export const MODES_DE_MARCHE = ['achat', 'vente'] as const satisfies readonly ModeDeMarche[];

/** Le Troc vide : rien de cédé, rien de reçu. */
export const BROUILLON_DE_TROC_VIDE: BrouillonDeTroc = Object.freeze({ cede: null, recu: null, quantite: 1 });

/** Un Troc en composition : le bien cédé (son porteur et son objet du catalogue), l'article acquis et sa quantité. */
export interface BrouillonDeTroc {
  cede: { heroId: IdDeHeros; trappingId: string } | null;
  recu: IdDArticle | null;
  quantite: number;
}

/** Une ligne de la répartition des achats payés, désignée par son `uid`. */
export type LigneDeRepartition = { uid: IdDeLigneDeRepartition; heroId: IdDeHeros } & ({ item: ItemInstance } | { unit: UniteVendue });

/** Le nom d'une ligne de la répartition : son objet, ou l'unité de son catalogue. */
export const libelleDeLaRepartition = (d: LigneDeRepartition): string => ('item' in d ? d.item.label : catalogEntryOf(d.unit.id)?.label ?? d.unit.id);

/** Stock PERSISTANT par marchand (la déplétion survit aux visites ; réassort par l'horloge, #T3). */
export type MerchantStocks = Record<string, { stock: { id: string; qty: number }[]; rolledAt: number; bargainLocked?: boolean }>;

/** Prix listé d'un objet en sous de cuivre (catalogue × qualité d'artisanat) — la référence du seuil
 *  « Tenir les comptes » ET du Troc (avant majoration/Marchandage). null (0) si prix non chiffré. */
function listedBrassOf(t: { price: Partial<Money> | 'ND' | null; qualities?: QualityRef[] }): number {
  const b = toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities ?? [] });
  return Number.isFinite(b) ? Math.round(b) : 0;
}

/** Ligne de catalogue GÉNÉRALISÉE (#619 Lot A) — trapping OU UNITÉ vendue par archétype (`unitKinds`,
 *  véhicule `vehicles.json` / créature-monture `creatures.json`, facette `purchase`).
 *  SOURCE UNIQUE du triplet label/prix/Disponibilité, réutilisée par le STOCK (`computeFreshStockLines`)
 *  ET le PAIEMENT (`payerLesAchats`) — jamais un lookup de prix dupliqué par site. `unit` absent =
 *  trapping ordinaire (achat → objet de sac) ; présent = achat → POSSESSION (`kind`/id du catalogue).
 *  EXPORTÉE : `MerchantPanel` (UI) résout AUSSI label/prix/Dispo/famille d'une ligne de stock par cette
 *  SOURCE UNIQUE — jamais un `findTrappingById` nu qui présumerait une ligne trapping. */
export interface CatalogEntry {
  label: string;
  price: Partial<Money> | null;
  availability: Availability | null;
  qualities?: QualityRef[];
  unit?: UniteVendue;
}

/** Unité vendue : sa catégorie ACHETABLE (`unitKinds`) et son id de catalogue. */
export interface UniteVendue { kind: UniteAchetable; id: string }

export function catalogEntryOf(id: string): CatalogEntry | undefined {
  // La donnée porte AUSSI les marques du livre hors des 4 classes (`'ND'`) : `isTradable` est la SEULE
  // conversion vers la classe jouable — jamais un `as Availability` qui ferait passer une marque pour
  // une classe. Non-classe → `null` : le stock l'exclut (sauf `curated`), le commerce la refuse.
  const classOf = (av: unknown): Availability | null => (isTradable(av) ? av : null);
  // Même couture pour le PRIX : la colonne Prix porte aussi une marque (`'ND'`, LDB 62 l.28/l.31,
  // LDB 68 l.11) — elle n'est pas un montant, donc elle n'entre pas dans une ligne de commerce.
  const moneyOf = (p: TrappingData['price']): CatalogEntry['price'] => (typeof p === 'object' ? p : null);
  const t = findTrappingById(id);
  if (t) return { label: t.label, price: moneyOf(t.price), availability: classOf(t.availability), qualities: t.qualities };
  const veh = findVehicleById(id);
  if (veh?.purchase && !veh.ship) return { label: veh.label, price: veh.purchase.price, availability: classOf(veh.purchase.availability), unit: { kind: 'vehicule-terrestre', id } };
  const cre = findCreatureById(id);
  if (cre?.purchase) return { label: cre.label, price: cre.purchase.price, availability: classOf(cre.purchase.availability), unit: { kind: 'bete', id } };
  return undefined;
}

/** Ids de catalogue vendus pour UNE catégorie d'unité (#619 Lot A) — DÉRIVÉS du dataset (`purchase`
 *  chiffré), jamais une liste en dur : une monture/un véhicule neuf à facette `purchase` apparaît
 *  AUTOMATIQUEMENT chez tout archétype portant sa catégorie. SOURCE UNIQUE de cette dérivation. */
function unitIdsOfKind(kind: UniteAchetable): string[] {
  if (kind === 'bete') return creatures.filter((c) => c.purchase).map((c) => c.id);
  // `vehicule-terrestre` = sans coque (`!v.ship`, #748).
  return vehicles.filter((v) => v.purchase && !v.ship).map((v) => v.id);
}

/** Meilleur seuil « Tenir les comptes » du groupe (LDB 59 l.9-11) : le plus haut budget de Statut
 *  (Bronze N = N sous / Argent N = N pistoles / Or N = N couronnes) parmi les héros — le membre le plus
 *  huppé couvre les achats courants. Consomme `statusBudgetBrass` (engine/money). */
function partyStatusBudgetBrass(party: Combatant[]): number {
  let best = 0;
  for (const h of party) {
    const st = actorStatus(h);
    best = Math.max(best, statusBudgetBrass(st.tier, st.standing));
  }
  return best;
}

/** Valeur EFFECTIVE d'un des 3 flags Marché (LDB 59/60) POUR UNE ENTITÉ marchande (#93) : l'OVERRIDE
 *  d'entité (`SceneEntity.merchant.{guild,marketMode,tenirComptes}`) PRIME sur la règle maison globale
 *  (`engine/policy` `rule('market-*')`) ; absent = héritage du global, JAMAIS un 3ᵉ état ambigu. Couture
 *  UNIQUE : tout call-site qui lisait `rule('market-*')` directement lit CETTE fonction. */
function marketRule(ent: SceneEntity | undefined, key: 'guild' | 'marketMode' | 'tenirComptes'): RuleValue {
  const override = ent?.merchant?.[key];
  if (override !== undefined) return override;
  const ruleId = key === 'guild' ? 'marche-guildes' : key === 'marketMode' ? 'marche-mode' : 'marche-tenir-comptes';
  return rule(ruleId);
}

/** « Tenir les comptes » (LDB 59 l.9-11, option `marche-tenir-comptes`) : un objet dont le prix listé
 *  est ≤ au niveau de Statut du groupe s'achète « autant de fois que nécessaire », sans débit. */
function comptesFree(ent: SceneEntity | undefined, party: Combatant[], listedBrass: number): boolean {
  return !!marketRule(ent, 'tenirComptes') && listedBrass > 0 && listedBrass <= partyStatusBudgetBrass(party);
}

/** Entité de scène du marchand ouvert (porteuse de ses surcharges de Marché, #93). */
function entiteDuMarchand(s: Jeu, m: MerchantState): SceneEntity | undefined {
  return s.scene?.entities.find((e) => e.id === m.entityId);
}

/** Ce que juge un verdict d'achat : l'entité du marchand, le groupe, sa bourse et le refus de dépense du
 *  siège (`refusDeGesteSurLeGroupe`). Le geste le dresse sur l'état (`contexteDAchat`), l'écran sur ses props. */
export interface ContexteDAchat { ent: SceneEntity | undefined; party: Combatant[]; bourse: Money; refusHote: string | null }

export function contexteDAchat(s: Jeu, m: MerchantState): ContexteDAchat {
  return { ent: entiteDuMarchand(s, m), party: s.party, bourse: totalDesBourses(s.party), refusHote: refusDeGesteSurLeGroupe(s) };
}

/** Remise MAXIMALE qu'un Marchandage d'achat peut obtenir au meilleur négociateur du groupe, en % :
 *  Succès Stupéfiant et Négociateur compris (LDB 59 l.43 ; LDB 10 l.818 ; `bargainPct`). 0 sans
 *  négociateur. Plancher des devis de cargaison avant le jet (MSRC 13 l.127 ; MDG 15 l.335). */
export function remiseMaximaleDeMarchandage(party: Combatant[]): number {
  const best = partyAssisted(party, { skill: { id: 'marchandage' } });
  return best ? bargainPct(true, SL_ASTOUNDING, hasBargainBonus(best.actor)) : 0;
}

/** Remise d'achat obtenue au Marchandage de la visite, en % (LDB 59 l.43) : 0 sans Marchandage. */
export function remiseDAchatPct(m: MerchantState): number {
  return m.bargainBuy ? bargainPct(m.bargainBuy.won, m.bargainBuy.drNet, m.bargainBuy.negotiator) : 0;
}

/** Prix d'achat UNITAIRE d'une ligne de stock (LDB 59 l.9-11 ; LDB 59 l.43). SOURCE UNIQUE lue par
 *  `payerLesAchats`, `refusDAjout` et l'écran du marchand. `null` : ligne hors catalogue ou prix « ND »
 *  (LDB 62 l.28). */
export function prixDeLigne(m: MerchantState, id: string, ent: SceneEntity | undefined, party: Combatant[]): Money | null {
  const entry = catalogEntryOf(id);
  if (!entry?.price) return null;
  if (comptesFree(ent, party, listedBrassOf(entry))) return fromBrass(0);
  const haggle = m.bargainBuy ? bargainBuyFactor(m.bargainBuy.won, m.bargainBuy.drNet, m.bargainBuy.negotiator) : 1;
  const brass = toBrass(priceToMoney(entry.price)) * craftPriceFactor({ qualities: entry.qualities ?? [] }) * (m.buyMarkup ?? 1) * haggle;
  return Number.isFinite(brass) ? fromBrass(Math.round(brass)) : null;
}

/** Une ligne du panier d'achat chiffrée par `prixDeLigne`. */
export interface LigneDuPanier { id: string; qty: number; unitaire: Money | null; sousTotal: Money | null }
/** `refus` : la raison affichée, ou `null`. */
export interface DevisDuPanier { lignes: LigneDuPanier[]; total: Money; refus: string | null }

/** Devis du panier d'achat contre la bourse `bourse` du groupe — SOURCE UNIQUE du total payé par
 *  `payerLesAchats` et affiché par l'écran. */
export function devisDuPanier(m: MerchantState, { ent, party, bourse, refusHote }: ContexteDAchat): DevisDuPanier {
  const lignes = (m.cart ?? []).map((c): LigneDuPanier => {
    const unitaire = prixDeLigne(m, c.id, ent, party);
    return { id: c.id, qty: c.qty, unitaire, sousTotal: unitaire ? fromBrass(toBrass(unitaire) * c.qty) : null };
  });
  const total = fromBrass(lignes.reduce((s, l) => s + (l.sousTotal ? toBrass(l.sousTotal) : 0), 0));
  return { lignes, total, refus: refusHote ?? (!lignes.length ? t('mf.panierVide') : !canAfford(bourse, total) ? t('mf.bourseInsuffisantePourLePanier') : null) };
}

/** Refus d'ajout d'une unité de la ligne `id` au panier, contre la bourse `bourse` du groupe que le panier
 *  déjà composé entame : la raison affichée, ou `null`. Ferme l'article au choix `marchand.ajouterAuPanier`, lu par
 *  l'écran. */
export function refusDAjout(m: MerchantState, id: string, contexte: ContexteDAchat): string | null {
  const { ent, party, bourse } = contexte;
  const stockQty = m.stock.find((l) => l.id === id)?.qty ?? 0;
  const enPanier = (m.cart ?? []).find((c) => c.id === id)?.qty ?? 0;
  const unitaire = prixDeLigne(m, id, ent, party);
  const label = catalogEntryOf(id)?.label ?? id;
  return m.bargainBuy != null ? t('mf.panierFige')
    : enPanier >= stockQty ? t('mf.stockEpuise', { label })
    : !unitaire ? t('mf.sansPrix', { label })
    : !canAfford(bourse, moneyAdd(devisDuPanier(m, contexte).total, unitaire)) ? t('mf.bourseInsuffisante', { label })
    : null;
}

/** Carrières « cohérentes » pour la recherche de Disponibilité (LDB 59 l.50) — ids STABLES, pas des
 *  libellés (`Combatant.career` porte l'id de la Carrière). */
const COHERENT_AVAILABILITY_CAREERS = new Set(['marchand', 'receleur']);
/** Bonus de recherche de Disponibilité du groupe (LDB 59 l.50) : Carrière cohérente et journée de recherche
 *  active (`gossipDay`), plafonné par `availabilitySearchBonus`. Renvoie le % à ajouter aux Tests de
 *  Disponibilité du stock. */
function partyAvailabilityBonus(party: Combatant[], gossipDay = false): number {
  const coherent = party.some((h) => COHERENT_AVAILABILITY_CAREERS.has(h.career ?? ''));
  return availabilitySearchBonus({ coherentCareer: coherent, gossipDay });
}

/** Ligne de journal d'un tirage de Disponibilité (LDB 59 l.50) — le dé n'a AUCUNE rangée : le journal
 *  est sa seule surface, la ligne se DÉRIVE (`traceLineOf`) comme toutes les autres. Source unique du
 *  pré-tirage affiché (`openStockRevealCascade`) ET de la conséquence de l'étape. Le tirage n'est pas
 *  un Test de Compétence : c'est l'ARTICLE qui nomme la ligne, avec la nature du dé. */
function stockTraceLine(l: StockLine): string {
  return traceLineOf({ label: stepDetail(dataLabel(l.label), t('mf.traceDeDisponibilite')), roll: l.test!.roll, target: l.test!.target, success: true, issue: t('mf.quantiteDisponible', { qty: l.qty }) });
}
/** Instantané de stock FRAIS d'un archétype à un instant `now`, avec un bonus de Disponibilité (Carrière
 *  cohérente + éventuelle recherche active, LDB 59 l.50). PUR (aucun `set`/`ecrireAuJournal`) — SOURCE UNIQUE de calcul,
 *  seedée déterministe pour un `(entityId, période, gossipDay)` donné : le siège qui la lance (local inline
 *  ou MJ via cascade, #273 dernier volet) ne change JAMAIS ces valeurs, seule leur SURFACE varie. */
function computeFreshStockLines(
  get: Get,
  ent: SceneEntity | undefined, arch: MerchantArchetypeDef, entityId: string, settlement: Settlement, now: number, restockPeriod: number, gossipDay: boolean,
): { stock: { id: string; qty: number }[]; tested: StockLine[] } {
  const guild = !!marketRule(ent, 'guild');
  const marketMode = marketRule(ent, 'marketMode') as string;
  const cat: CatalogItem[] = trappingsInstanciables()
    .filter((t) => (!arch.category.categories || arch.category.categories.includes(t.categorie)) && (!arch.category.subTypes || (t.subType !== null && arch.category.subTypes.some((id) => id === t.subType?.id))))
    .map((t) => {
      const base: CatalogItem['availability'] = isTradable(t.availability) ? t.availability : null;
      const av = guild && base ? shiftAvailability(base, { qualities: t.qualities }, { guild: true }) : base;
      return { id: t.id, label: t.label, availability: av };
    });
  // Unités vendues (#619 Lot A) — DÉRIVÉES des catégories `arch.unitKinds` (`unitIdsOfKind`, jamais une
  // liste d'ids en dur), MÊME catalogue/tirage que les trappings (aucune 2e sommation de stock) ; la
  // Guilde (crafting) ne les concerne pas.
  const unitCat: CatalogItem[] = (arch.unitKinds ?? []).flatMap((kind) => unitIdsOfKind(kind)).flatMap((id) => {
    const entry = catalogEntryOf(id);
    if (!entry?.unit) return [];
    return [{ id, label: entry.label, availability: entry.availability }];
  });
  const fullCat = [...cat, ...unitCat];
  // Seed dérivé de l'entité, de la PÉRIODE de réassort ET du bonus de recherche → une recherche active qui
  // ré-ouvre un stock déjà tiré à la même période obtient un tirage DIFFÉRENT (l'effort change le résultat).
  const period = Math.floor(now / restockPeriod);
  const seed = [...`${entityId}:${period}:${gossipDay ? 'g' : ''}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;
  const dispoBonus = partyAvailabilityBonus(get().party, gossipDay);
  const lines = marketMode === 'sans-disponibilite' || marketMode === 'simplifie'
    ? fullStock(fullCat, settlement, makeRNG(seed), arch.curated)
    : rollStock(fullCat, settlement, makeRNG(seed), arch.curated, dispoBonus);
  return { stock: lines.map((l) => ({ id: l.id, qty: l.qty })), tested: lines.filter((l) => l.test) };
}

/** Persiste un stock FRAIS DÉJÀ CALCULÉ (`merchantStocks`) — réassort → on peut de nouveau marchander. */
function persistStock(set: Set, entityId: string, stock: { id: string; qty: number }[], now: number): void {
  set((s) => ({ merchantStocks: { ...s.merchantStocks, [entityId]: { stock, rolledAt: now, bargainLocked: false } } }));
}

/** Réassort INLINE (local sans MJ, #273 dernier volet) : calcule + persiste + journalise en UNE fois —
 *  zéro friction pour le joueur solo/local (comportement inchangé). SOURCE UNIQUE de ce chemin, partagée
 *  par l'ouverture (`ouvrirLeMarchand`) et la recherche active (`chercherLaDisponibilite`). Retourne le stock tiré. */
function rollFreshStock(
  get: Get, set: Set,
  entityId: string, ent: SceneEntity | undefined, arch: MerchantArchetypeDef, settlement: Settlement, now: number, restockPeriod: number, gossipDay: boolean,
): { id: string; qty: number }[] {
  const { stock, tested } = computeFreshStockLines(get, ent, arch, entityId, settlement, now, restockPeriod, gossipDay);
  if (tested.length) get().ecrireAuJournal(t('mf.tirageDuMarche', { settlement, lignes: tested.map((l) => t('mf.ligneDeStock', { label: l.label, qty: l.qty })).join(', ') }));
  persistStock(set, entityId, stock, now);
  return stock;
}

/** Kind d'étape de cascade du réassort marchand (#273 dernier volet) — SOURCE UNIQUE de visibilité MJ du
 *  tirage de stock (`rollStock`/`fullStock`, RNG SEEDÉ déterministe, `computeFreshStockLines`). Siège MJ
 *  présent → étape VISIBLE (jamais un tirage silencieux) : « Continuer » l'applique. Recalcule les MÊMES
 *  lignes depuis les primitives sérialisables du `meta` (le rng seedé n'est jamais transporté lui-même —
 *  seuls ses PARAMÈTRES le sont, cf. `CascadeStepMeta`) ; ouvre le panneau marchand (`ouvrirLeMarchand`) ou
 *  rafraîchit son stock si `merchant` porte déjà cette entité (`chercherLaDisponibilite`), au choix de
 *  `s.merchant?.entityId === entityId` — un seul applier pour les deux appelants. */
const MERCHANT_STOCK_KIND = 'stockDuMarchand';

/** Ouvre l'étape de cascade VISIBLE-LANÇABLE au siège MJ (#273 dernier volet) — jamais un tirage
 *  silencieux : le `meta` porte les PARAMÈTRES sérialisables du tirage (le rng seedé reste calculé par
 *  `computeFreshStockLines`, jamais transporté). Le call-site n'assemble plus rien d'autre. */
function openStockRevealCascade(
  get: Get, set: Set,
  entityId: string, archetype: string, settlement: Settlement, now: number, restockPeriod: number, gossipDay: boolean, resaleRate: number, buyMarkup: number, backdrop?: string,
): void {
  const arch = findMerchantArchetypeById(archetype);
  // #331 réserve A-bis : PRÉ-POSE le tirage article par article dans `outcome` AVANT validation — la
  // modale d'affichage ne montrait QUE l'en-tête + « Terminer ». Le tirage est SEEDÉ déterministe
  // (`computeFreshStockLines`), donc ces lignes affichées == celles que l'applier recompose/persiste.
  // `ent` n'existe pas pour un marchand de LIEU (#369, `ouvrirLaBoutique`) — le pretirage se calcule
  // quand même, `computeFreshStockLines` tolère `ent` absent (overrides d'entité simplement absents).
  const ent = get().scene?.entities.find((e) => e.id === entityId);
  const outcome = arch
    ? computeFreshStockLines(get, ent, arch, entityId, settlement, now, restockPeriod, gossipDay)
        .tested.map(stockTraceLine)
    : undefined;
  const step: CascadeStep = {
    id: `${MERCHANT_STOCK_KIND}:${entityId}:${now}`,
    kind: MERCHANT_STOCK_KIND,
    label: stepDetail(t('step.reassort'), dataLabel(arch?.label, archetype)),
    ...(outcome?.length ? { outcome: toRecapLines(outcome) } : {}),
    meta: { entityId, archetype, settlement, now, restockPeriod, gossipDay, resaleRate, buyMarkup, ...(backdrop != null ? { backdrop } : {}) },
  };
  startCascade(get, set, { title: t('mf.titreDeReassort'), purpose: 'test', steps: [step] });
}

/** Ouverture PARTAGÉE d'une visite marchande (#369) — `ent` est l'override d'ENTITÉ de scène (PNJ posé
 *  dans une scène) quand il existe ; un marchand de LIEU (`ouvrirLaBoutique`, catalogue `lieux-services.json`)
 *  n'en porte aucun et joue les défauts d'archétype nus. SOURCE UNIQUE du calcul d'ouverture, réutilisée
 *  par les deux entrées — aucune n'est un fork de l'autre. */
function openMerchantByArchetype(get: Get, set: Set, entityId: string, archetype: string, ent?: SceneEntity, backdrop?: string): void {
  const arch = findMerchantArchetypeById(archetype);
  if (!arch) { get().ecrireAuJournal(t('mf.archetypeInconnu', { archetype })); return; }
  const settlement: Settlement = ent?.merchant?.settlement ?? arch.settlement;
  const resaleRate = ent?.merchant?.resaleRate ?? arch.resaleRate;
  const buyMarkup = ent?.merchant?.buyMarkup ?? arch.buyMarkup ?? 1; // majoration d’achat (1 = prix listé ; >1 = vend plus cher)
  const restockPeriod = (ent?.merchant?.restockDays ?? arch.restockDays ?? 1) * MINUTES_PER_DAY; // réassort (#T3)
  const now = get().gameTime;
  const prev = get().merchantStocks[entityId];
  // Re-stock dans le temps (#T3) : on conserve le stock DÉPLÉTÉ entre visites ; on ne re-tire un stock
  // FRAIS (nouvelle Disponibilité) que si `restockPeriod` s'est écoulé depuis le dernier tirage.
  // Règles optionnelles « Marché » (LDB 59/60) : Guildes d'Artisans (Atouts/Défauts inversent la
  // Disponibilité) ; système simplifié (pas de Test de Disponibilité) ; cf. `marche-guildes`/`marche-mode`.
  if (!prev || now - prev.rolledAt >= restockPeriod) {
    // #273 dernier volet — porte : siège MJ présent → tirage VISIBLE-LANÇABLE (jamais silencieux) ;
    // sinon → inline INCHANGÉ (zéro friction locale).
    if (get().net.gmSeat != null) {
      openStockRevealCascade(get, set, entityId, archetype, settlement, now, restockPeriod, false, resaleRate, buyMarkup, backdrop);
      return;
    }
    const stock = rollFreshStock(get, set, entityId, ent, arch, settlement, now, restockPeriod, false);
    set({ merchant: { entityId, archetype, settlement, resaleRate, buyMarkup, backdrop, stock, cart: [], bargainLocked: get().merchantStocks[entityId]?.bargainLocked ?? false } });
    return;
  }
  set({ merchant: { entityId, archetype, settlement, resaleRate, buyMarkup, backdrop, stock: prev.stock, cart: [], bargainLocked: prev.bargainLocked ?? false } });
}

export function ouvrirLeMarchand(get: Get, set: Set, entityId: string): void {
  const ent = get().scene?.entities.find((e) => e.id === entityId);
  if (!ent?.merchant) return;
  openMerchantByArchetype(get, set, entityId, ent.merchant.archetype.id, ent);
}

/** Les services à échoppe (`merchantArchetype`) du lieu où se tient le groupe (`lieuDuGroupe`). */
export function echoppesDuLieu(s: Jeu): ResolvedPlaceService[] {
  const ici = lieuDuGroupe(s);
  return ici ? placeServices(ici, sceneDuRegistre(ici.scene.id)).filter((svc) => svc.merchantArchetype) : [];
}

/** Marchand de LIEU (#369) — ouvre le système marchand EXISTANT pour l'échoppe `serviceId` du lieu du groupe
 *  (`echoppesDuLieu`, forgeron du hub de ville…) : même `openMerchantByArchetype`, keyé sur l'id virtuel
 *  `placeServiceMerchantId` (stock persistant propre au lieu+service). Extension du général, pas un fork. */
export function ouvrirLaBoutique(get: Get, set: Set, serviceId: string): void {
  const ici = lieuDuGroupe(get());
  const svc = echoppesDuLieu(get()).find((x) => x.id === serviceId);
  if (!ici) return void refuserGeste(get, set, t('mf.boutiqueSansLieu'));
  if (!svc?.merchantArchetype) return void refuserGeste(get, set, t('mf.boutiqueInconnue', { service: serviceId }));
  openMerchantByArchetype(get, set, placeServiceMerchantId(ici.id, svc.id), svc.merchantArchetype, undefined, svc.backdrop);
}

/** Kind d'étape de cascade du Test de Ragot de recherche active (#273) : le jet passe par la porte
 *  canonique `openPartyTest` (side `partyBest`) — la surface se dérive des PORTEURS réels du jet, la
 *  fenêtre est influençable (Chance/Résilience) et le siège MJ la voit ; la continuation (avance de la
 *  journée + réassort visible/inline) vit ICI, keyée par `kind`. */
const MERCHANT_RAGOT_KIND = 'marchand-ragot';

/** Continuation PARTAGÉE (jet réussi/raté OU absence de candidat au Ragot) : avance la journée (« journée
 *  entière », LDB 59 l.50), puis même porte que l'ouverture (#273) — siège MJ → tirage VISIBLE ; sinon
 *  → inline. */
function finalizeSearchAvailability(get: Get, set: Set, entityId: string, restockPeriod: number, gossipDay: boolean): void {
  get().avancerLeTemps(MINUTES_PER_DAY); // « journée entière » — l'horloge cascade normalement (#T3)
  const now = get().gameTime;
  const m = get().merchant;
  if (!m || m.entityId !== entityId) return;
  const ent = get().scene?.entities.find((e) => e.id === entityId);
  const arch = findMerchantArchetypeById(m.archetype);
  if (!arch) return;
  if (get().net.gmSeat != null) {
    openStockRevealCascade(get, set, entityId, m.archetype, m.settlement, now, restockPeriod, gossipDay, m.resaleRate, m.buyMarkup ?? 1, m.backdrop);
    return;
  }
  rollFreshStock(get, set, entityId, ent, arch, m.settlement, now, restockPeriod, gossipDay);
  set((s) => (s.merchant ? { merchant: { ...s.merchant, stock: s.merchantStocks[entityId]?.stock ?? s.merchant.stock, cart: [], bargainBuy: null, bargainSell: null, bargainLocked: false } } : {}));
}

/** Recherche active de Disponibilité (LDB 59 l.50) : « passe une journée entière à effectuer des achats et
 *  des Tests de Ragot ». Le groupe consacre UNE JOURNÉE (avance l'horloge) et jette un Test de Ragot ; sur
 *  un succès, un RÉASSORT FRAIS est tiré avec +10 % (cumulable avec la Carrière cohérente jusqu'au plafond
 *  +20 % du RAW). Sur un échec, la journée est perdue (réassort normal, sans le bonus de recherche). */
function chercherLaDisponibilite(get: Get, set: Set): void {
  const m = garanti(get().merchant, 'marchand', 'échoppe ouverte');
  const ent = get().scene?.entities.find((e) => e.id === m.entityId);
  // L'ouverture refuse un archétype inconnu (`openMerchantByArchetype`) : ouvert, il est garanti.
  const arch = garanti(findMerchantArchetypeById(m.archetype), m.archetype, 'recherche de Disponibilité');
  const restockPeriod = (ent?.merchant?.restockDays ?? arch.restockDays ?? 1) * MINUTES_PER_DAY;
  // Test de Ragot du groupe (Soutien LDB 12) — Intermédiaire (+0), le RAW ne chiffre pas la difficulté.
  const best = partyAssisted(get().party, { skill: { id: 'ragot' }, characteristic: 'sociabilite' });
  if (!best) {
    get().ecrireAuJournal(t('mf.sansRagot'));
    finalizeSearchAvailability(get, set, m.entityId, restockPeriod, false);
    return;
  }
  openPartyTest(get, set, {
    skill: { id: 'ragot' }, characteristic: 'sociabilite', // Soutien LDB 12 — même valeur que `partyAssisted`
    actionLabel: t('mf.rechercheActive'),
    difficulty: 'intermediaire',
    stake: combatStakeRef(MERCHANT_RAGOT_KIND),
  }, MERCHANT_RAGOT_KIND, { entityId: m.entityId, restockPeriod });
}

/** Ce qui refuse la recherche active de Disponibilité dans l'échoppe `m` : un marché sans Test de Disponibilité
 *  (LDB 59 l.15) ; `null` : elle se tente. */
export function refusDeRecherche(s: Pick<Jeu, 'scene'>, m: MerchantState): string | null {
  const marketMode = marketRule(s.scene?.entities.find((e) => e.id === m.entityId), 'marketMode') as string;
  return marketMode === 'sans-disponibilite' || marketMode === 'simplifie' ? t('mf.rechercheSansDisponibilite') : null;
}

/** Quitte le marchand : un marché négocié non honoré verrouille la négociation jusqu'au réassort. */
function quitterLeMarchand(get: Get, set: Set): void {
  const m = get().merchant;
  // Négocié mais NON honoré (achat non payé, OU vente sans rien vendre) → verrou partagé jusqu'au réassort.
  const renege = !!m && ((m.bargainBuy != null && !m.bargainPaid) || (m.bargainSell != null && !m.bargainSellUsed));
  if (m && renege) {
    set((s) => ({ merchantStocks: { ...s.merchantStocks, [m.entityId]: { ...s.merchantStocks[m.entityId], bargainLocked: true } } }));
    get().ecrireAuJournal(t('mf.marcheRenie'));
  }
  repartirLesAchats(get, set); // ne pas perdre les objets payés non répartis
  set({ merchant: null });
}

/** La Possession d'une UNITÉ achetée (#619, #760), au propriétaire `ownerId`, avec le groupe. */
function possessionDUnite(unit: UniteVendue, ownerId: string): Parameters<typeof ajouterLaPossession>[2] {
  return unit.kind === 'bete'
    ? { nature: 'bete', ref: { id: unit.id }, ownerId, location: { kind: 'avec-le-groupe' }, items: [] }
    : { nature: 'vehicule', vehicleId: unit.id, ownerId, location: { kind: 'avec-le-groupe' }, items: [] };
}

/** Ce qui refuse de refuser le marché `mode` de l'échoppe `m` : aucun marché négocié de ce côté ; `null` : il se
 *  refuse. */
export function refusDeRefusDuMarche(m: MerchantState, mode: ModeDeMarche): string | null {
  return (mode === 'achat' ? m.bargainBuy : m.bargainSell) == null ? t('mf.rienARefuser') : null;
}

function refuserLeMarche(get: Get, set: Set, mode: ModeDeMarche): void {
  const m = garanti(get().merchant, 'marchand', 'échoppe ouverte');
  // Refuser une négociation → annule ce côté + VERROU PARTAGÉ (plus de marchandage achat NI vente jusqu'au réassort).
  const patch = mode === 'achat' ? { cart: [], bargainBuy: null } : { bargainSell: null };
  set((s) => ({
    merchant: { ...s.merchant!, ...patch, bargainLocked: true },
    merchantStocks: { ...s.merchantStocks, [m.entityId]: { ...s.merchantStocks[m.entityId], bargainLocked: true } },
  }));
  get().ecrireAuJournal(t('mf.marcheRefuse'));
}

function payerLesAchats(get: Get, set: Set): void {
  const m = garanti(get().merchant, 'marchand', 'échoppe ouverte');
  const cart = m.cart ?? [];
  const devis = devisDuPanier(m, contexteDAchat(get(), m));
  const total = devis.total;
  if (devis.refus || !payFromGroup(get, set, total, { purpose: 'panier marchand' })) { refuserGeste(get, set, devis.refus ?? t('mf.bourseInsuffisantePourLePanier')); return; }
  // Crée les objets achetés (par UNITÉ) en attente de répartition + déplète le stock. Une ligne
  // UNITÉ (véhicule/créature-monture, #760) rejoint elle aussi `pendingDistribution` — le joueur
  // choisit le héros PROPRIÉTAIRE via le même écran de répartition que les objets de sac ;
  // `dest` (= party[0]) est l'affectation PAR DÉFAUT, réassignable.
  const dest = get().party[0]?.id ?? '';
  const staged: LigneDeRepartition[] = [];
  let newStock = m.stock;
  for (const c of cart) {
    const entry = catalogEntryOf(c.id);
    if (entry?.unit) {
      for (let i = 0; i < c.qty; i++) staged.push({ uid: get().forgerUnId('it'), unit: entry.unit, heroId: dest });
    } else {
      for (let i = 0; i < c.qty; i++) { const it = itemFromTrappingById(c.id, get().forgerUnId); if (it) staged.push({ uid: get().forgerUnId('it'), item: it, heroId: dest }); }
    }
    newStock = newStock.map((l) => (l.id === c.id ? { ...l, qty: Math.max(0, l.qty - c.qty) } : l));
  }
  const count = cart.reduce((a, c) => a + c.qty, 0);
  set((s) => {
    const eid = s.merchant!.entityId;
    const persisted = s.merchantStocks[eid];
    return {
      // bargainPaid : le marché est SCELLÉ (payé) → pas de blocage du Marchandage au départ.
      merchant: { ...s.merchant!, stock: newStock, cart: [], pendingDistribution: staged.length ? staged : null, bargainPaid: true },
      merchantStocks: { ...s.merchantStocks, [eid]: { ...persisted, stock: newStock, rolledAt: persisted?.rolledAt ?? s.gameTime } },
    };
  });
  get().ecrireAuJournal(t('mf.paye', { total: formatMoney(total), count, s: count > 1 ? 's' : '' }));
}

/** Range chaque achat payé chez le héros que lui donne la répartition (`marchand.repartition`) : corps de la validation
 *  de l'échoppe (`fenetreValider('marchand')`), et du départ de l'échoppe, qui ne perd aucun achat payé. */
function repartirLesAchats(get: Get, set: Set): void {
  const m = get().merchant; const dist = m?.pendingDistribution;
  if (!m || !dist || !dist.length) return;
  const unitEntries = dist.flatMap((d) => ('unit' in d ? [d] : []));
  set((s) => {
    const mm = s.merchant; if (!mm) return {};
    const byHero: Record<string, ItemInstance[]> = {};
    for (const d of dist) { if ('item' in d) (byHero[d.heroId] ??= []).push(d.item); }
    const ecrit = ecrireActeur(s, Object.keys(byHero), (h) =>
      byHero[h.id]!.reduce((porteur, it) => avecObjet(porteur, { ...it, equipped: false }), h)); // #204 : rangement par défaut
    return { ...ecrit, merchant: { ...mm, pendingDistribution: null } };
  });
  for (const u of unitEntries) ajouterLaPossession(get, set, possessionDUnite(u.unit, u.heroId));
}

/** Gain de revente d'un objet (catalogue × qualité × resaleRate × facteur de Marchandage). SOURCE UNIQUE
 *  du prix de vente — partagée par `vendreLeLot` ET l'aperçu UI (pas de formule dupliquée).
 *  Facteur : `bargainSellFactor` (LDB 59 l.54) ; sans Marchandage de vente, 0,5. */
export function sellGain(item: ItemInstance, m: MerchantState): ReturnType<typeof fromBrass> {
  const sellFactor = m.bargainSell ? bargainSellFactor(m.bargainSell.won, m.bargainSell.drNet, m.bargainSell.negotiator) : 0.5;
  // « Baisse des prix » (LDB 59 l.60) : chaque division du prix par deux monte la Disponibilité d'un
  // acheteur d'un cran — appliquée au gain FINAL (le vendeur accepte moins pour écouler un objet rare).
  const halve = (b: number) => priceAfterHalvings(b, m.sellHalvings?.[item.uid] ?? 0);
  // Objet PRÉ-VALUÉ (pièces de monstre récoltées, ZI Précieuses Entrailles) : sa valeur de marché est
  // déjà nette (rareté × dangerosité × Taille × Conservation) → revendu en DIRECT, sans le taux de revente
  // catalogue. Le Marchandage de vente joue quand même (sellFactor/0.5 : ×1 par défaut, ×plus si gagné).
  if (item.price) return fromBrass(halve(Math.round(toBrass(item.price) * (sellFactor / 0.5))));
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const base = t ? toBrass(priceToMoney(t.price)) * craftPriceFactor(item) : 0;
  return fromBrass(halve(Math.round(base * m.resaleRate * sellFactor)));
}

/** Refus de VENTE d'une instance, avec sa RAISON (null = vendable). LDB 59 l.54 : « Vous vérifiez
 *  d'abord la Disponibilité pour un acheteur de la même façon que vous vérifiez un stock » — sans
 *  Disponibilité au catalogue, cette vérification n'a pas d'entrée et l'objet est hors commerce
 *  (`isTradable`). Deux cas restent vendables : l'objet CUSTOM (hors catalogue, il n'a pas de ligne à
 *  consulter) et l'instance PRÉ-VALUÉE (`item.price` : pièces de monstre récoltées ZI, Carte marine
 *  MDG 15 l.290 « une carte qui peut être reproduite et vendue ») — elle porte sa propre valeur. */
export function sellRefusal(item: ItemInstance): string | null {
  if (item.price) return null;
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  if (!t || isTradable(t.availability)) return null;
  return outOfTradeReason(t.label);
}

/** Disponibilité d'un ACHETEUR pour un objet vendu (LDB 59 l.52-62) : sa Disponibilité catalogue montée
 *  d'un cran par baisse de prix consentie (`halvings`). Sert d'affichage au vendeur (plus le cran est
 *  bon, plus un acheteur se trouve vite). `null` = objet sans Disponibilité : aucun cran à afficher,
 *  aucune classe inventée — le refus se lit par `sellRefusal`. */
export function sellBuyerAvailability(item: ItemInstance, halvings: number): Availability | null {
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const av = t?.availability;
  if (!isTradable(av)) return null;
  return availabilityAfterHalvings(av, halvings);
}

/** Le plus de divisions par deux du prix de vente d'une instance (LDB 59 l.60). */
export const BAISSES_DE_PRIX_MAX = 4;

// ── Troc (LDB 59 l.64-76) ───────────────────────────────────────────────────────────────────────
/** Refus de TROC d'un trapping, avec sa RAISON (null = trocable). LDB 59 l.66 : « comparez la
 *  Disponibilité des objets échangés avec celle des objets en cours d'acquisition » — sans Disponibilité,
 *  la comparaison n'a pas de terme et le RATIO n'existe pas. */
export function barterRefusal(id: string): string | null {
  const t = findTrappingById(id);
  if (!t) return null;
  return isTradable(t.availability) ? null : outOfTradeReason(t.label);
}

export interface BarterQuote {
  ratio: { give: number; get: number };
  giveAv: Availability;
  getAv: Availability;
  /** Unités du bien DONNÉ requises pour acquérir `getCount` unités du bien acquis (lots de valeur ~égale
   *  × premium de rareté du ratio, LDB 59 l.66-76). */
  giveCount: number;
}

/** Devis de Troc (LDB 59 l.64-76) : combien d'unités du bien DONNÉ (`giveId`) contre `getCount` unités
 *  du bien ACQUIS (`getId`). Constitue « deux lots de valeur approximativement équivalente » (prix
 *  listés, l.66) puis applique le RATIO de rareté (`barterRatio`). null si un prix manque OU si l'un des
 *  deux biens est hors du commerce ordinaire (`barterRefusal`). */
export function barterQuote(giveId: string, getId: string, getCount = 1): BarterQuote | null {
  const giveT = findTrappingById(giveId), getT = findTrappingById(getId);
  if (!giveT || !getT) return null;
  const givePrice = listedBrassOf(giveT), getPrice = listedBrassOf(getT);
  if (givePrice <= 0 || getPrice <= 0) return null;
  const giveAv = giveT.availability, getAv = getT.availability;
  if (!isTradable(giveAv) || !isTradable(getAv)) return null;
  const ratio = barterRatio(giveAv, getAv);
  // Lots de valeur équivalente (l.66) puis premium de rareté : valeur à donner = valeur acquise × give/get.
  const giveValue = getCount * getPrice * (ratio.give / ratio.get);
  return { ratio, giveAv, getAv, giveCount: Math.max(1, Math.ceil(giveValue / givePrice)) };
}

/** Exemplaires CÉDABLES au Troc d'un trapping chez un héros : instances NON équipées. */
function exemplairesCedables(hero: Combatant, trappingId: string): ItemInstance[] {
  return (hero.items ?? []).filter((i) => i.trappingId === trappingId && !i.equipped);
}

/** L'exemplaire du bien `trappingId` que `hero` cède au Troc (choix `marchand.trocCeder`) : le premier des
 *  cédables. */
export function exemplaireCede(hero: Combatant, trappingId: string): IdDObjet {
  return garanti(exemplairesCedables(hero, trappingId)[0], trappingId, 'exemplaire cédable').uid;
}

/** Un bien cédable au Troc : un trapping chez un héros, avec ses exemplaires, et ce qui refuse de le céder (hors du
 *  commerce ordinaire, ou sans prix listé chiffré). */
export interface OptionDeTroc { heroId: string; trappingId: string; count: number; refus: string | null }

/** Biens cédables au Troc (LDB 59 l.64-76) par (héros, trapping) — SOURCE UNIQUE de l'écran de Troc et du choix
 *  `marchand.trocCeder`. */
export function optionsDeTroc(party: readonly Combatant[]): OptionDeTroc[] {
  const out: OptionDeTroc[] = [];
  for (const h of party) {
    const ids = new Set((h.items ?? []).flatMap((it) => (it.trappingId && !it.equipped ? [it.trappingId] : [])));
    for (const trappingId of ids) {
      const trapping = findTrappingById(trappingId);
      if (!trapping) continue;
      const horsCommerce = barterRefusal(trappingId);
      const refus = horsCommerce ? t('trade.barterRefused', { reason: horsCommerce }) : listedBrassOf(trapping) > 0 ? null : t('mf.trocSansPrix');
      out.push({ heroId: h.id, trappingId, count: exemplairesCedables(h, trappingId).length, refus });
    }
  }
  return out;
}

export type DemandeDeTroc = { giveHeroId: string; giveTrappingId: string; getStockId: string; getCount?: number };
/** Devis d'un Troc : `refus` = la raison affichée, `null` quand le devis existe et que le Troc passe. */
export type DevisDeTroc = ({ refus: null; quote: BarterQuote } | { refus: string; quote: BarterQuote | null }) & { getCount: number; max: number };

/** Devis d'un Troc (LDB 59 l.64-76) — son refus tombe dans `troquerLesObjets`, lu par l'écran. */
export function devisDeTroc(m: MerchantState, party: Combatant[], opts: DemandeDeTroc): DevisDeTroc {
  const getCount = Math.max(1, Math.floor(opts.getCount ?? 1));
  const refused = barterRefusal(opts.giveTrappingId) ?? barterRefusal(opts.getStockId);
  const quote = refused ? null : barterQuote(opts.giveTrappingId, opts.getStockId, getCount);
  const hero = party.find((h) => h.id === opts.giveHeroId);
  const stockQty = m.stock.find((l) => l.id === opts.getStockId)?.qty ?? 0;
  const dispo = hero ? exemplairesCedables(hero, opts.giveTrappingId).length : 0;
  const label = findTrappingById(opts.giveTrappingId)?.label ?? opts.giveTrappingId;
  const refus = refused ? t('trade.barterRefused', { reason: refused })
    : !quote ? t('mf.trocSansPrix')
    : dispo < quote.giveCount ? t('mf.trocExige', { n: quote.giveCount, label, dispo })
    : stockQty < getCount ? t('mf.trocSansStock')
    : null;
  const max = Math.max(1, stockQty); // borne de la quantité acquise : le stock du marchand, plancher 1
  return refus == null && quote ? { refus: null, quote, getCount, max } : { refus: refus ?? t('mf.trocSansPrix'), quote, getCount, max };
}

/** La demande du Troc composé dans l'échoppe `m` ; `null` : le bien cédé ou l'article acquis manque. */
export function demandeDuTroc(m: MerchantState): DemandeDeTroc | null {
  const b = m.troc;
  return b?.cede && b.recu ? { giveHeroId: b.cede.heroId, giveTrappingId: b.cede.trappingId, getStockId: b.recu, getCount: b.quantite } : null;
}

/** Exécute le Troc composé (LDB 59 l.64) : le héros cédant donne les exemplaires du devis (`devisDeTroc`), SANS argent,
 *  contre les exemplaires acquis du stock, puis le brouillon se vide. Le choix `marchand.troquer` n'est admis que sur un
 *  devis sans refus. */
function troquerLesObjets(get: Get, set: Set): void {
  const m = garanti(get().merchant, 'marchand', 'échoppe ouverte');
  const opts = garanti(demandeDuTroc(m), m.entityId, 'troc composé');
  const v = devisDeTroc(m, get().party, opts);
  const quote = garanti(v.quote, opts.getStockId, 'devis du troc');
  const { getCount } = v;
  const donne = garanti(findTrappingById(opts.giveTrappingId), opts.giveTrappingId, 'troc — objet cédé').label;
  const recu = garanti(findTrappingById(opts.getStockId), opts.getStockId, 'troc — objet reçu').label;
  const hero = garanti(get().party.find((h) => h.id === opts.giveHeroId), opts.giveHeroId, 'troc — héros cédant');
  const givable = exemplairesCedables(hero, opts.giveTrappingId);
  const soldUids = givable.slice(0, quote.giveCount).map((i) => i.uid);
  const acquis = Array.from({ length: getCount }, () => itemFromTrappingById(opts.getStockId, get().forgerUnId, undefined, contexteDeNaissanceDObjet(hero))).filter((i) => i !== null);
  const newStock = m.stock.map((l) => (l.id === opts.getStockId ? { ...l, qty: l.qty - getCount } : l));
  set((s) => {
    const eid = s.merchant!.entityId;
    const persisted = s.merchantStocks[eid];
    return {
      ...ecrireActeur(s, opts.giveHeroId, (h) => {
        const clone: Combatant = structuredClone(h);
        clone.items = (clone.items ?? []).filter((i) => !soldUids.includes(i.uid)); // biens cédés
        return acquis.reduce(avecObjet, clone); // biens acquis
      }),
      merchant: { ...s.merchant!, stock: newStock, troc: null },
      merchantStocks: { ...s.merchantStocks, [eid]: { stock: newStock, rolledAt: persisted?.rolledAt ?? s.gameTime } },
    };
  });
  get().ecrireAuJournal(t('mf.trocConclu', {
    giveCount: quote.giveCount, giveLabel: donne,
    getCount, getLabel: recu,
    giveAv: quote.giveAv, ratio: `${quote.ratio.give}:${quote.ratio.get}`, getAv: quote.getAv,
  }));
}

/** Retire de leurs porteurs (clone + recompute) les instances `entries` (uid+heroId) : patch `ecrireActeur`. */
function removeSold(s: Jeu, entries: { uid: string; heroId: string }[]): ReturnType<typeof ecrireActeur> {
  return ecrireActeur(s, entries.map((e) => e.heroId), (h) => {
    const uids = entries.filter((e) => e.heroId === h.id).map((e) => e.uid);
    const clone: Combatant = structuredClone(h);
    clone.items = (clone.items ?? []).filter((i) => !uids.includes(i.uid));
    recomputeLoadout(clone);
    return clone;
  });
}

/** Une instance du panier de vente chez son porteur, avec son gain (`sellGain`) et son refus (`sellRefusal`). */
export interface LigneDeVente { hero: Combatant; it: ItemInstance; gain: Money; refus: string | null }

/** Devis du panier de VENTE — SOURCE UNIQUE du total crédité par `vendreLeLot` et affiché par l'écran ;
 *  `total` ne compte que les lignes sans refus, `refus` dit qu'aucune ne se vend. */
export function devisDeVente(m: MerchantState, party: Combatant[]): { lignes: LigneDeVente[]; total: Money; refus: string | null } {
  const lignes = (m.sellCart ?? []).flatMap((c): LigneDeVente[] => {
    const hero = party.find((h) => h.id === c.heroId);
    const it = hero?.items?.find((i) => i.uid === c.uid);
    return hero && it ? [{ hero, it, gain: sellGain(it, m), refus: sellRefusal(it) }] : [];
  });
  return {
    lignes,
    total: lignes.reduce((acc, l) => (l.refus ? acc : moneyAdd(acc, l.gain)), fromBrass(0)),
    refus: lignes.some((l) => !l.refus) ? null : t('mf.rienAVendre'),
  };
}

/** Conclut la vente du panier (parité achat/`payerLesAchats`) : crédite le devis `devisDeVente`, retire les
 *  objets de leurs porteurs, honore la négociation de vente. */
function vendreLeLot(get: Get, set: Set): void {
  const m = garanti(get().merchant, 'marchand', 'échoppe ouverte');
  const devis = devisDeVente(m, get().party);
  for (const l of devis.lignes) if (l.refus) get().ecrireAuJournal(t('trade.sellRefused', { reason: l.refus }));
  const vendues = devis.lignes.filter((l) => !l.refus);
  const gainByHero: Record<string, Money> = {}; // crédit PERSONNEL : chaque gain revient au PORTEUR de l'objet vendu (#531 §8)
  for (const l of vendues) gainByHero[l.hero.id] = moneyAdd(gainByHero[l.hero.id] ?? fromBrass(0), l.gain);
  const total = devis.total;
  const names = vendues.map((l) => l.it.label);
  const sold = vendues.map((l) => ({ uid: l.it.uid, heroId: l.hero.id }));
  set((s) => ({
    merchant: s.merchant ? { ...s.merchant, sellCart: [], bargainSellUsed: true } : s.merchant,
    ...removeSold(s, sold),
  }));
  for (const [heroId, g] of Object.entries(gainByHero)) creditBourse(get, set, heroId, g);
  get().ecrireAuJournal(`Vente : ${names.join(', ')} (+${formatMoney(total)}).`);
}

/** Coût de réparation d'un objet endommagé (LDB 63 l.64 ; LDB 62 l.135) — SOURCE UNIQUE lue par
 *  `reparerLObjet` et l'écran du marchand. */
export function coutDeReparation(item: ItemInstance): Money {
  const trapping = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  return fromBrass(itemRepairCostBrass(item, trapping ? toBrass(priceToMoney(trapping.price)) : 0));
}

/** Refus de réparer `item` aux frais de son porteur `hero` : la raison affichée, ou `null`. Tombe dans
 *  `reparerLObjet`, lu par l'écran. */
export function refusDeReparation(hero: Combatant, item: ItemInstance, refusHote: string | null): string | null {
  return refusHote ?? refusDeBourse(hero, coutDeReparation(item), 'mf.bourseInsuffisantePourLaReparation', { label: item.label });
}

/** Chaque objet abîmé d'un héros du groupe, avec ce qui refuse de le réparer : une arme réduite à l'état improvisé
 *  (`isRepairable`), puis la bourse de son porteur (`refusDeReparation`). */
export function objetsAReparer(party: readonly Combatant[]): { hero: Combatant; item: ItemInstance; refus: string | null }[] {
  return party.flatMap((hero) => (hero.items ?? []).filter((item) => (item.damageTaken ?? 0) > 0).map((item) => ({
    hero, item, refus: isRepairable(item) ? refusDeReparation(hero, item, null) : t('mf.irreparable', { label: item.label }),
  })));
}

/** Réparation d'un objet chez un artisan — armure (LDB 63 l.64) OU arme (LDB 62 l.135), au coût
 *  `coutDeReparation`, aux frais de son porteur (`porteurDeLObjet`). Le choix `marchand.reparer` ne l'admet que parmi
 *  `objetsAReparer`, sans refus. */
function reparerLObjet(get: Get, set: Set, uid: string): void {
  const heroId = garanti(porteurDeLObjet(get(), uid), uid, 'porteur de l’objet réparé');
  const item = garanti(get().party.find((h) => h.id === heroId)?.items?.find((i) => i.uid === uid), uid, 'objet réparé');
  const cost = coutDeReparation(item);
  payWithAllocation(get, set, { debits: soloPayer(heroId, cost), recipient: heroId, purpose: 'réparation' });
  set((s) => ecrireActeur(s, heroId, (h) => {
    const clone: Combatant = structuredClone(h);
    const it = clone.items?.find((i) => i.uid === uid); if (it) it.damageTaken = 0;
    recomputeLoadout(clone);
    return clone;
  }));
  get().ecrireAuJournal(msg('mf.reparationFaite', { label: item.label }));
}

/** Ouvre le Marchandage du meilleur négociateur du groupe (Soutien, LDB 12) contre `opposant`, pour
 *  `contrepartie` — porte UNIQUE des deux contreparties (marchand, billet). */
export function ouvrirMarchandage(get: Get, set: Set, contrepartie: ContrepartieDeMarchandage, opposant: OpposantDeMarchandage): void {
  const best = partyAssisted(get().party, { skill: { id: 'marchandage' }, characteristic: 'sociabilite' }); if (!best) return; // Soutien (LDB 12) : conseillers du groupe
  set({ pendingBargain: {
    playerId: best.actor.id, playerName: best.actor.label,
    contrepartie, opposant,
    playerSkill: best.value, support: best.support,
    // Grandeur du départage à DR égal (`LDB 12 l.160`) : le Niveau de Compétence NU, à l'accesseur
    // canon — `best.value` est la valeur de TEST, qui porte en plus le Soutien et TOUT modificateur du
    // Marchandage (États, mutation Visage inversé, objet Laid… — cf. `skills.testValueParts`).
    playerBase: skillBaseValue(best.actor, { skill: { id: 'marchandage' }, characteristic: 'sociabilite' }),
    negotiator: hasBargainBonus(best.actor), // Négociateur → registre de talents (jamais un name-match)
    roll: null, merchantRoll: null, result: null,
  } });
}

/** Ce qui refuse le Marchandage `mode` dans l'échoppe `m` : la règle optionnelle qui l'ôte (LDB 59 l.15), le marchand
 *  qui se méfie après un échec retentissant (LDB 59 l.43), le verrou d'un marché refusé ou renié, une négociation déjà
 *  menée de ce côté cette visite, ou personne dans le groupe pour la mener ; `null` : il se tente. */
export function refusDeMarchandage(s: Pick<Jeu, 'scene' | 'party'>, m: MerchantState, mode: ModeDeMarche): string | null {
  const mkt = marketRule(s.scene?.entities.find((e) => e.id === m.entityId), 'marketMode') as string;
  if (mkt === 'sans-marchandage' || mkt === 'simplifie') return t('mf.marchandageOte');
  if (m.soured) return t('mf.marchandMefiant');
  if (m.bargainLocked) return t('mf.marchandageVerrouille');
  if (mode === 'achat' ? m.bargainBuy : m.bargainSell) return t('mf.dejaMarchande');
  return partyAssisted(s.party, { skill: { id: 'marchandage' }, characteristic: 'sociabilite' }) ? null : t('mf.sansNegociateur');
}

function marchanderLePrix(get: Get, set: Set, mode: ModeDeMarche): void {
  const m = garanti(get().merchant, 'marchand', 'échoppe ouverte');
  // L'ouverture refuse un archétype inconnu (`openMerchantByArchetype`) : ouvert, il est garanti.
  const arch = garanti(findMerchantArchetypeById(m.archetype), m.archetype, 'marchandage');
  // Le marchand est un PNJ de scène : sa fiche porte le portrait de la ligne adverse.
  ouvrirMarchandage(get, set, { kind: 'marchand', mode, titre: msg(mode === 'achat' ? 'out.bargainTitreAchat' : 'out.bargainTitreVente') }, { label: arch.label, valeur: arch.bargainSkill, portrait: sceneNpc(get().scene, m.entityId, presetDuNarratif(get().campaignNarratif)) });
}

/** « Conclure » le Marchandage : fige l'issue sur sa contrepartie — les prix de la visite du marchand
 *  (LDB 59 l.43), ou le billet (`marchandagesDeBillet`, EDO 01 l.142). */
function acquitterLeMarchandage(get: Get, set: Set): void {
  const pb = get().pendingBargain;
  if (!pb) return;
  const res = garanti(pb.result, pb.playerId, 'jet du Marchandage');
  const won = res.attackerWins; // le joueur est l'attaquant
  const drNet = res.netSL;
  const outcome = { won, drNet, negotiator: pb.negotiator };
  // ACQUITTEMENT par le goulot (`FLOWS.marchandage.apply`) : le verdict est déclaré AU FLUX (`spec.issue`),
  // journalisé là — ici on acquitte, avant de fermer le pending qui le porte.
  FLOWS.marchandage.apply(get);
  const c = pb.contrepartie;
  // « Rater de beaucoup » (LDB 59 l.43) = perdre l'opposé par un net DR ≥ 6 (symétrique du Succès Stupéfiant
  // +6) → le marchand se méfie de votre monnaie : plus aucun marchandage cette visite.
  const botch = !won && drNet >= SL_ASTOUNDING;
  set((s) => ({
    pendingBargain: null,
    ...(c.kind === 'billet'
      ? { marchandagesDeBillet: { ...s.marchandagesDeBillet, [cleDeBillet(c.routeId, c.vehicule, c.depuis)]: outcome } }
      : { merchant: s.merchant ? { ...s.merchant, ...(c.mode === 'achat' ? { bargainBuy: outcome } : { bargainSell: outcome }), soured: s.merchant.soured || botch } : s.merchant }),
  }));
}

/** Talent « Détection d'artefact », id stable — LDB 10 l.336. */
const DETECT_TALENT = 'detection-d-artefact';

/** Compétence testée par CHAQUE mode de la fenêtre Évaluation/Détection, par id STABLE — SOURCE
 *  UNIQUE du meneur (`bestDetector`/`appraiseLeader`), de la ligne figée à l'ouverture (`openAppraise`) et du
 *  libellé (`libelleDEvaluation`). Détection : Talent « Détection d'artefact »
 *  (`LDB 10 l.336`). Les Caractéristiques associées sont celles de `skills.json`. */
export const APPRAISE_SKILL = {
  evaluation: { skill: { id: 'evaluation' }, characteristic: 'intelligence' },
  detection: { skill: { id: 'intuition' }, characteristic: 'initiative' },
} as const satisfies Record<string, TestIds>;

/** Un mode de l'évaluation (`APPRAISE_SKILL`) : l'Évaluation (LDB 59 l.41) ou la Détection d'artefact (LDB 10 l.336). */
export type ModeDEvaluation = keyof typeof APPRAISE_SKILL;
/** Le mode d'`evaluerLObjet` appelé sans mode. */
export const MODE_D_EVALUATION_PAR_DEFAUT = 'evaluation' satisfies ModeDEvaluation;

/** Meilleur détecteur du groupe : meilleure Intuition PARMI les porteurs du Talent (c'est LUI qui
 *  touche l'objet — pas un partyBest global comme l'Évaluation). null si personne ne l'a. */
function bestDetector(party: Combatant[]): { actor: Combatant; value: number; support: SupportDetail } | null {
  const holders = party.filter((h) => hasTalent(h, DETECT_TALENT));
  const best = partyAssisted(holders, APPRAISE_SKILL.detection); // Soutien (LDB 12)
  return best ? { actor: best.actor, value: best.value, support: best.support } : null;
}

/** Les héros sans tentative de la Détection de `cible`. LDB 10 l.336 */
const sansDetection = (party: Combatant[], cible: CibleDeDetection): Combatant[] => party.filter((h) => !cible.detectTriedBy?.includes(h.id));

/** Meneur de l'Évaluation (Soutien LDB 12) ou de la Détection de `cible` (`bestDetector`, parmi ceux qui ne l'ont pas
 *  tentée) ; `null` = personne qui puisse tenter. */
function appraiseLeader(party: Combatant[], mode: ModeDEvaluation, cible: CibleDeDetection = {}): { actor: Combatant; value: number; support: SupportDetail } | null {
  return mode === 'detection' ? bestDetector(sansDetection(party, cible)) : partyAssisted(party, APPRAISE_SKILL.evaluation);
}

/** Ce que la Détection lit de sa cible (objet porté ou ligne de butin) : qui l'a déjà tentée. */
interface CibleDeDetection { label?: string; detectTriedBy?: readonly string[] }

/** Détection : le refus nomme le Talent, pas la Compétence — LDB 10 l.336. */
const appraiseNobody = (mode: ModeDEvaluation): string => refusPersonneNePeutTenter(
  mode === 'detection' ? { action: refLabel('talents', { id: DETECT_TALENT }) } : { skill: APPRAISE_SKILL[mode].skill },
);

/** Refus NOMMÉ d'une Évaluation que personne ne peut tenter (LDB 09 l.30) ; `null` sinon. Le geste de l'UI en dérive. */
export function appraiseRefus(party: Combatant[]): string | null {
  return appraiseLeader(party, 'evaluation') ? null : appraiseNobody('evaluation');
}

/** Refus de la Détection d'artefact de `cible` : personne n'a le Talent, ou chacun de ses porteurs l'a déjà tentée
 *  sur elle ; `null` sinon. LDB 10 l.336 */
export function refusDeDetection(party: Combatant[], cible: CibleDeDetection & { label: string }): string | null {
  if (!bestDetector(party)) return appraiseNobody('detection');
  return appraiseLeader(party, 'detection', cible) ? null : t('mf.detectionDejaTentee', { label: cible.label });
}

/** Démarreur PARTAGÉ Évaluation/Détection — sur un objet d'inventaire (`itemUid`) OU une ligne de
 *  butin encore en fenêtre (`gear`). Une seule modale, un seul flux de jet (`FLOWS.evaluation`, `rollFlowSpecs.ts`). */
function openAppraise(
  get: Get, set: Set,
  target: { itemUid?: string; gear?: { scope: 'butin' | 'victoire'; uid: IdDeLigneDeButin } },
  itemName: string, mode: ModeDEvaluation, trappingId?: string, cible: CibleDeDetection = {},
): void {
  const best = garanti(appraiseLeader(get().party, mode, cible), itemName, 'meneur de l’évaluation (`refusDEvaluation`)');
  const t = trappingId ? findTrappingById(trappingId) : undefined;
  const ligne = rollLine({ actor: best.actor, test: APPRAISE_SKILL[mode], difficulty: 'intermediaire', valeur: best.value, ...(best.support.bonus > 0 ? { soutien: best.support } : {}) });
  set({ pendingAppraise: {
    actorId: best.actor.id, ...target, itemName,
    // Le libellé de la Compétence vient du REGISTRE, par id stable — jamais un nom écrit au call-site.
    mode, skillLabel: refLabel('skills', APPRAISE_SKILL[mode].skill),
    truePriceBrass: t ? toBrass(priceToMoney(t.price)) : 0,
    availability: t?.availability ?? null,
    ligne, ...cibleMesuree(ligne), roll: null, success: false, sl: 0,
  } });
}

/** Jour de jeu courant (verrou « pas de re-tentative d'Évaluation le même jour »). */
export function gameDay(s: Pick<Jeu, 'gameTime'>): number {
  return Math.floor(s.gameTime / MINUTES_PER_DAY);
}

/** Ce qu'évalue `evaluerLObjet` : l'objet qu'un héros du groupe porte, sinon la ligne d'un butin encore en fenêtre
 *  (`butin` puis `victoire`) ; sa cible ouverte (`openAppraise`) et ce que lisent ses refus. `null` : l'uid ne désigne ni
 *  l'un ni l'autre. */
function cibleAEvaluer(s: Jeu, uid: string): { target: Parameters<typeof openAppraise>[2]; cible: CibleDEvaluation; trappingId?: string } | null {
  const item = s.party.find((h) => h.id === porteurDeLObjet(s, uid))?.items?.find((i) => i.uid === uid);
  if (item) return { target: { itemUid: uid }, cible: item, trappingId: item.trappingId };
  for (const scope of ['butin', 'victoire'] as const) {
    const ligne = ligneDuButin(s, scope, uid);
    if (ligne) return { target: { gear: { scope, uid } }, cible: { ...ligne.effect, label: ligne.label }, trappingId: ligne.effect.trappingId };
  }
  return null;
}

/** Ce que lit le refus d'une Évaluation : le nom de la cible, la Détection déjà tentée et le jour de l'Évaluation
 *  manquée. */
type CibleDEvaluation = CibleDeDetection & { label: string; appraiseTriedDay?: number };

/** Les jours qui restent, au jour `jour`, avant de retenter l'Évaluation manquée de `cible` (règle maison
 *  `marche-evaluation-delai-jours`) ; 0 : elle se retente. */
const joursAvantDeRetenter = (cible: CibleDEvaluation, jour: number): number =>
  (cible.appraiseTriedDay === undefined ? 0 : Math.max(0, cible.appraiseTriedDay + Number(rule('marche-evaluation-delai-jours')) - jour));

/** Refus de l'Évaluation (`evaluation`) ou de la Détection d'artefact (`detection`) de `cible` au jour `jour` : manquée trop
 *  récemment (règle maison `marche-evaluation-delai-jours`), personne ne peut la tenter (LDB 09 l.30), ou chaque
 *  détecteur l'a déjà tentée (LDB 10 l.336) ; `null` sinon. Le verbe et la fenêtre du butin le lisent. */
export function refusDEvaluation(party: Combatant[], cible: CibleDEvaluation, mode: ModeDEvaluation, jour: number): string | null {
  if (mode === 'detection') return refusDeDetection(party, cible);
  const jours = joursAvantDeRetenter(cible, jour);
  return jours > 0 ? t('mf.evaluationARetenter', { label: cible.label, jours }) : appraiseRefus(party);
}

/** Évaluation (LDB 59 l.41) ou Détection d'artefact (LDB 10 l.336) d'un objet porté par un héros, ou d'une ligne de
 *  butin ENCORE en fenêtre, révélée avant de choisir qui l'emporte. Chaque refus est dit. */
export function evaluerLObjet(get: Get, set: Set, aEvaluer: IdDObjet | IdDeLigneDeButin, mode: ModeDEvaluation = MODE_D_EVALUATION_PAR_DEFAUT): void {
  if (porteurDeLObjet(get(), aEvaluer) && (refuseSi(get, set, refusDInventaire) || refuseSi(get, set, (s) => refusDuHerosPorteur(s, aEvaluer)))) return;
  const cible = cibleAEvaluer(get(), aEvaluer);
  if (!cible) return void refuserGeste(get, set, t('pf.objetSansPorteur'));
  if (refuseSi(get, set, (s) => refusDEvaluation(s.party, cible.cible, mode, gameDay(s)))) return;
  openAppraise(get, set, cible.target, cible.cible.label, mode, cible.trappingId, cible.cible);
}

/** La ligne `uid` du butin `scope` encore en fenêtre. */
const ligneDuButin = (s: Jeu, scope: 'butin' | 'victoire', uid: string) => (scope === 'butin' ? s.pendingLoot : s.pendingVictory)?.gear?.find((g) => g.uid === uid);

/** Patch la cible de l'Évaluation/Détection — objet porté (party) ou ligne de butin en fenêtre. */
function patchAppraiseTarget(get: Get, set: Set, pa: { itemUid?: string; gear?: { scope: 'butin' | 'victoire'; uid: IdDeLigneDeButin } },
  { detecteur, ...patch }: { identified?: boolean; magicKnown?: boolean; detecteur?: string; appraiseTriedDay?: number }): void {
  /** La Détection tentée par `detecteur` s'ajoute à la liste de sa cible. LDB 10 l.336 */
  const avecDetecteur = (cible: { detectTriedBy?: string[] }) => (detecteur ? { detectTriedBy: [...(cible.detectTriedBy ?? []), detecteur] } : {});
  if (pa.gear) {
    const key = pa.gear.scope === 'butin' ? 'pendingLoot' : 'pendingVictory';
    const { uid } = pa.gear;
    set((s) => {
      const bucket = s[key];
      if (!bucket?.gear?.some((g) => g.uid === uid)) return {};
      const gear = bucket.gear.map((g) => {
        if (g.uid !== uid) return g;
        const effect = { ...g.effect, ...patch, ...avecDetecteur(g.effect) };
        if (patch.identified) delete (effect as { identified?: boolean }).identified; // identifié = champ absent
        return { ...g, magic: g.magic || !!patch.magicKnown, effect };
      });
      return { [key]: { ...bucket, gear } } as PatchDeFlux;
    });
    return;
  }
  const porteur = get().party.map((h) => actorIn(get(), h.id) ?? h).find((h) => (h.items ?? []).some((i) => i.uid === pa.itemUid));
  if (!porteur) return;
  set((s) => ecrireActeur(s, porteur.id, (h) => {
    const clone: Combatant = structuredClone(h);
    const it = clone.items?.find((i) => i.uid === pa.itemUid);
    if (it) {
      Object.assign(it, patch, avecDetecteur(it));
      if (patch.identified) delete it.suspectedQualities; // la vraie révélation dissipe les fausses certitudes
    }
    return clone;
  }));
}

/** Acquitte l'Évaluation (révèle `identified` + estimation, LDB 59 l.41) ou la Détection d'artefact
 *  (LDB 10 l.336). */
function acquitterLEvaluation(get: Get, set: Set): void {
  const pa = get().pendingAppraise;
  if (!pa) return;
  set({ pendingAppraise: null });
  if (pa.mode === 'detection') {
    // Qualités MAGIQUES de la cible : sur une ligne de butin on les connaît (effet) ; sur un objet
    // porté, l'ajout est fondu dans `qualities` → on compte 1 règle (cas du butin du jeu).
    const line = pa.gear ? ligneDuButin(get(), pa.gear.scope, pa.gear.uid) : undefined;
    const item = pa.itemUid ? get().party.flatMap((h) => h.items ?? []).find((i) => i.uid === pa.itemUid) : undefined;
    const isMagic = line ? line.magic : !!item && (item.identified === false || !!item.magicKnown);
    const rules = line ? (line.effect.qualities?.length ?? (line.effect.identified === false ? 1 : 0)) : 1;
    const actor = garanti(nomEnVue(get(), pa.actorId), pa.actorId, 'détecteur de la Détection');
    if (!pa.success) {
      patchAppraiseTarget(get, set, pa, { detecteur: pa.actorId });
      get().ecrireAuJournal(t('mf.detectionVaine', { actor, item: pa.itemName }));
      return;
    }
    if (!isMagic) {
      patchAppraiseTarget(get, set, pa, { detecteur: pa.actorId });
      get().ecrireAuJournal(t('mf.detectionSansAura', { actor, item: pa.itemName }));
      return;
    }
    // Succès : aura sentie ; chaque DR apprend une règle → tout révélé quand DR couvre les règles.
    const allKnown = pa.sl >= Math.max(1, rules);
    patchAppraiseTarget(get, set, pa, { detecteur: pa.actorId, magicKnown: true, ...(allKnown ? { identified: true } : {}) });
    get().ecrireAuJournal(t(allKnown ? 'mf.detectionComplete' : 'mf.detectionPartielle', { actor, item: pa.itemName, dr: pa.sl }));
    return;
  }
  if (!pa.success) {
    // Un échec à DR 0 offre un nouvel essai (LDB 12 l.94) ; à DR négatif, le délai de la règle maison
    // `marche-evaluation-delai-jours` court.
    if (pa.sl < 0) patchAppraiseTarget(get, set, pa, { appraiseTriedDay: gameDay(get()) });
    get().ecrireAuJournal(t('mf.evaluationRatee', { item: pa.itemName }));
    return;
  }
  patchAppraiseTarget(get, set, pa, { identified: true });
  if (pa.truePriceBrass <= 0) { get().ecrireAuJournal(t('mf.evaluationPieceUnique', { item: pa.itemName })); return; }
  const est = appraiseEstimate(pa.availability as Parameters<typeof appraiseEstimate>[0], pa.truePriceBrass);
  const range = est.min === est.max
    ? formatMoney(fromBrass(est.min))
    : t('mf.fourchetteDEstimation', { min: formatMoney(fromBrass(est.min)), max: formatMoney(fromBrass(est.max)) });
  get().ecrireAuJournal(t('mf.evaluationValeur', { item: pa.itemName, range }));
}

export function creerActionsDuMarchand(get: Get, set: Set) {
  return {
    ouvrirLeMarchand: (entityId) => ouvrirLeMarchand(get, set, entityId),
    ouvrirLaBoutique: (serviceId) => ouvrirLaBoutique(get, set, serviceId),
    evaluerLObjet: (aEvaluer, mode) => evaluerLObjet(get, set, aEvaluer, mode),
  } satisfies FabriqueDuNoyau;
}

/** Les choix de l'échoppe (`CorpsDesChoix`) : `fenetreChoisir` les joue, parmi les valeurs que l'état ouvre
 *  (`OUVERTS_DU_CHOIX`). */
export function choixDuMarchand(get: Get, set: Set) {
  const ecrire = (patch: (m: MerchantState) => Partial<MerchantState>) => {
    const m = garanti(get().merchant, 'marchand', 'échoppe ouverte');
    set({ merchant: { ...m, ...patch(m) } });
  };
  const baisses = (uid: string, delta: number) => ecrire((m) => ({ sellHalvings: { ...m.sellHalvings, [uid]: (m.sellHalvings?.[uid] ?? 0) + delta } }));
  const troc = (patch: (b: BrouillonDeTroc) => Partial<BrouillonDeTroc>) => ecrire((m) => {
    const b = m.troc ?? BROUILLON_DE_TROC_VIDE;
    return { troc: { ...b, ...patch(b) } };
  });
  return {
    marchand: {
      ajouterAuPanier: (id) => ecrire((m) => ({ cart: m.cart.some((c) => c.id === id) ? m.cart.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c)) : [...m.cart, { id, qty: 1 }] })),
      oterDuPanier: (id) => ecrire((m) => ({ cart: m.cart.map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0) })),
      retirerDuPanier: (id) => ecrire((m) => ({ cart: m.cart.filter((c) => c.id !== id) })),
      viderLePanier: () => ecrire(() => ({ cart: [] })),
      ajouterALaVente: (uid) => ecrire((m) => ({ sellCart: [...(m.sellCart ?? []), { uid, heroId: garanti(porteurDeLObjet(get(), uid), uid, 'porteur de l’objet vendu') }] })),
      retirerDeLaVente: (uid) => ecrire((m) => ({ sellCart: (m.sellCart ?? []).filter((c) => c.uid !== uid) })),
      viderLaVente: () => ecrire(() => ({ sellCart: [] })),
      baisserLePrix: (uid) => baisses(uid, 1),
      releverLePrix: (uid) => baisses(uid, -1),
      repartition: (uid, heroId) => ecrire((m) => ({ pendingDistribution: (m.pendingDistribution ?? []).map((d) => (d.uid === uid ? { ...d, heroId } : d)) })),
      payer: () => payerLesAchats(get, set),
      vendre: () => vendreLeLot(get, set),
      refuser: (mode) => refuserLeMarche(get, set, mode),
      marchander: (mode) => marchanderLePrix(get, set, mode),
      chercher: () => chercherLaDisponibilite(get, set),
      reparer: (uid) => reparerLObjet(get, set, uid),
      trocCeder: (uid) => {
        const heroId = garanti(porteurDeLObjet(get(), uid), uid, 'porteur du bien cédé');
        const trappingId = garanti(get().party.find((h) => h.id === heroId)?.items?.find((i) => i.uid === uid)?.trappingId, uid, 'bien cédé du catalogue');
        troc(() => ({ cede: { heroId, trappingId } }));
      },
      trocRecevoir: (id) => troc(() => ({ recu: id, quantite: 1 })),
      trocQuantite: (n) => troc(() => ({ quantite: n })),
      troquer: () => troquerLesObjets(get, set),
    },
  } satisfies Partial<CorpsDesChoix>;
}


export function sortiesDuMarchand(get: Get, set: Set) {
  return { marchand: () => quitterLeMarchand(get, set) } satisfies Partial<SortiesDeFenetre>;
}

export function validationsDuMarchand(get: Get, set: Set) {
  return { marchand: () => repartirLesAchats(get, set) } satisfies Partial<ValidationsDeFenetre>;
}

export function cloturesDuMarchand(get: Get, set: Set) {
  return {
    marchandage: () => acquitterLeMarchandage(get, set),
    evaluation: () => acquitterLEvaluation(get, set),
  } satisfies Partial<CloturesDuJet>;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [MERCHANT_STOCK_KIND, MERCHANT_RAGOT_KIND] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    [MERCHANT_STOCK_KIND]: (get, set, step) => {
      const meta = step.meta ?? {};
      const entityId = String(meta.entityId ?? '');
      const archetype = String(meta.archetype ?? '');
      const ent = get().scene?.entities.find((e) => e.id === entityId);
      const arch = findMerchantArchetypeById(archetype);
      // `arch` (`meta.archetype`, sérialisé à l'ouverture) SUFFIT — un marchand de LIEU (#369, `ouvrirLaBoutique`)
      // n'a aucune `SceneEntity` de scène, `ent` reste alors `undefined` (overrides d'entité simplement absents).
      if (!arch) return {};
      const settlement = String(meta.settlement ?? arch.settlement) as Settlement;
      const now = Number(meta.now ?? get().gameTime);
      const restockPeriod = Number(meta.restockPeriod ?? MINUTES_PER_DAY);
      const gossipDay = !!meta.gossipDay;
      const { stock, tested } = computeFreshStockLines(get, ent, arch, entityId, settlement, now, restockPeriod, gossipDay);
      persistStock(set, entityId, stock, now);
      set((s) => {
        if (s.merchant?.entityId === entityId) {
          // Rafraîchi PENDANT une visite en cours (recherche active) — même reset que le chemin inline.
          return { merchant: { ...s.merchant, stock, cart: [], bargainBuy: null, bargainSell: null, bargainLocked: false } };
        }
        const resaleRate = Number(meta.resaleRate ?? arch.resaleRate);
        const buyMarkup = Number(meta.buyMarkup ?? arch.buyMarkup ?? 1);
        const backdrop = meta.backdrop != null ? String(meta.backdrop) : undefined;
        const persisted = s.merchantStocks[entityId];
        return { merchant: { entityId, archetype, settlement, resaleRate, buyMarkup, backdrop, stock, cart: [], bargainLocked: persisted?.bargainLocked ?? false } };
      });
      return {
        consequences: freeCons(tested.map(stockTraceLine)),
      };
    },
    [MERCHANT_RAGOT_KIND]: (get, set, step) => {
      if (!step.result) return {};
      const meta = step.meta ?? {};
      const entityId = String(meta.entityId ?? '');
      const m = get().merchant;
      if (!m || m.entityId !== entityId) return {}; // visite fermée entre-temps
      const gossipDay = step.result.success;
      const actor = step.actorId ? actorIn(get(), step.actorId) : undefined;
      finalizeSearchAvailability(get, set, entityId, Number(meta.restockPeriod ?? MINUTES_PER_DAY), gossipDay);
      return {
        consequences: freeCons([stepDetail(
          actor ? dataLabel(actor.label) : t('eff.groupe'),
          // LDB 59 l.50
          estJete(step.result) ? t(gossipDay ? 'mf.rechercheReussie' : 'mf.rechercheRatee') : t('mf.rechercheSansJet'),
        )]),
      };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
} satisfies FragmentDeTables;
