/**
 * Actions MARCHAND (#2, LDB 59/60) — module à part du store, même patron
 * `(get, set)` que combatFlow : ouverture/réassort, panier, achat/vente/réparation, Marchandage
 * (Test opposé), Évaluation.
 */
import type { GameState } from './store';
import { toRecapLines } from './recapLine';
import { Combatant, ItemInstance, type CharKey } from '../engine/types';
import { recomputeLoadout, itemFromTrappingById, addItemToHero, autoStowNewItem } from '../engine/items';
import { isRepairable, itemRepairCostBrass } from '../engine/repair';
import { bargainBuyFactor, bargainSellFactor } from '../engine/bargain';
import { SL_ASTOUNDING } from '../engine/tests';
import { craftPriceFactor, shiftAvailability } from '../engine/qualities/craftEconomy';
import { rule, type RuleValue } from '../engine/policy';
import type { SceneEntity } from './scene';
import { partyAssisted, skillBaseValue, type SupportDetail } from '../engine/skills';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { appraiseEstimate } from '../engine/appraisal';
import { makeRNG } from '../engine/dice';
import { rollStock, fullStock, availabilitySearchBonus, barterRatio, availabilityAfterHalvings, priceAfterHalvings, isTradable, outOfTradeReason, type Settlement, type CatalogItem, type StockLine } from '../engine/disponibilite';
import type { Availability } from '../engine/types';
import { t, t as msg } from '../i18n'; // `msg` : alias local — `t` est aussi le nom d'un trapping résolu dans ce flux
import { priceToMoney, add as moneyAdd, canAfford, fromBrass, toBrass, formatMoney, statusBudgetBrass, type StatusTier, type Money } from '../engine/money';
import { bourseOf, payWithAllocation, payFromGroup, soloPayer, creditBourse } from './bourseFlow';
import { actorStatus } from '../engine/social';
import { MINUTES_PER_DAY } from '../engine/clock';
import { findTrappingById, trappings, findVehicleById, findCreatureById, vehicles, creatures, combatStakeRef, type TrappingData } from '../data/index';
import { slugId } from '../data/slug';
import { MERCHANTS } from './merchants/index';
import { FLOWS } from './rollFlowSpecs';
import { registerCascadeApplier, startCascade } from './cascade';
import { freeCons, openPartyTest } from './rollSeam';
import { actorIn, garanti } from './combatants';
import type { CascadeStep } from './pendings';
import { addPossession } from './possessionsFlow';
import { traceLineOf } from '../engine/traceLine';

import type { Get, Set } from './flowTypes';
import { dataLabel, refLabel } from '../data';
import { stepDetail } from './rollSeam';

/** Issue d'un Marchandage conclu (achat OU vente) — module les prix de la visite. */
export interface BargainOutcome {
  won: boolean;
  drNet: number;
  negotiator: boolean;
}

/** Boutique OUVERTE (état de la visite en cours). Le stock persistant vit dans `merchantStocks`. */
export interface MerchantState {
  entityId: string;
  archetype: string;
  settlement: Settlement;
  resaleRate: number;
  buyMarkup?: number;
  /** Bande d'ambiance de l'écran (id du registre `src/ui/backdrops`) — provient de la donnée du service
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
   *  (`confirmSell`) — parité avec le panier d'achat. Une instance est unique (pas de quantité). */
  sellCart?: { uid: string; heroId: string }[];
  /** « Baisse des prix » (LDB 59 l.60) : par instance vendue, nombre de fois où le vendeur divise son
   *  prix par deux pour trouver un acheteur (chaque division monte la Disponibilité d'un cran). */
  sellHalvings?: Record<string, number>;
  /** Répartition post-achat (#760) : objet de sac (`item`) OU unité (véhicule/navire/bête, `unit`) —
   *  discrimination par la présence du champ, jamais un `kind` redondant. */
  pendingDistribution?: (
    | { item: ItemInstance; heroId: string }
    | { unit: { nature: 'vehicule' | 'navire' | 'bete'; id: string }; heroId: string }
  )[] | null;
  bargainLocked: boolean;
  bargainPaid?: boolean;
  bargainSellUsed?: boolean;
}

/** Stock PERSISTANT par marchand (la déplétion survit aux visites ; réassort par l'horloge, #T3). */
export type MerchantStocks = Record<string, { stock: { id: string; qty: number }[]; rolledAt: number; bargainLocked?: boolean }>;

/** Prix listé d'un objet en sous de cuivre (catalogue × qualité d'artisanat) — la référence du seuil
 *  « Tenir les comptes » ET du Troc (avant majoration/Marchandage). null (0) si prix non chiffré. */
function listedBrassOf(t: { price: Partial<Money> | 'ND' | null; qualities?: unknown[] }): number {
  const b = toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities as never });
  return Number.isFinite(b) ? Math.round(b) : 0;
}

/** Ligne de catalogue GÉNÉRALISÉE (#619 Lot A) — trapping OU UNITÉ vendue par archétype (`unitKinds`,
 *  véhicule `vehicles.json` / créature-monture `creatures.json`, facette `purchase`).
 *  SOURCE UNIQUE du triplet label/prix/Disponibilité, réutilisée par le STOCK (`computeFreshStockLines`)
 *  ET le PAIEMENT (`buyItem`/`payCart`) — jamais un lookup de prix dupliqué par site. `unit` absent =
 *  trapping ordinaire (achat → objet de sac) ; présent = achat → POSSESSION (`nature`/id du catalogue).
 *  `unit.nature` porte la nature de `Possession` CIBLE : `vehicule`/`navire` (coque, `veh.ship`) ou
 *  `bete` (créature) — jamais un `'vehicule'` générique qui confondrait chariot et navire.
 *  EXPORTÉE : `MerchantPanel` (UI) résout AUSSI label/prix/Dispo/famille d'une ligne de stock par cette
 *  SOURCE UNIQUE — jamais un `findTrappingById` nu qui présumerait une ligne trapping. */
export interface CatalogEntry {
  label: string;
  price: Partial<Money> | null;
  availability: Availability | null;
  qualities?: unknown[];
  unit?: { nature: 'vehicule' | 'navire' | 'bete'; id: string };
}

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
  if (veh?.purchase) return { label: veh.label, price: veh.purchase.price, availability: classOf(veh.purchase.availability), unit: { nature: veh.ship ? 'navire' : 'vehicule', id } };
  const cre = findCreatureById(id);
  if (cre?.purchase) return { label: cre.label, price: cre.purchase.price, availability: classOf(cre.purchase.availability), unit: { nature: 'bete', id } };
  return undefined;
}

/** Ids de catalogue vendus pour UNE catégorie d'unité (#619 Lot A) — DÉRIVÉS du dataset (`purchase`
 *  chiffré), jamais une liste en dur : une monture/un véhicule neuf à facette `purchase` apparaît
 *  AUTOMATIQUEMENT chez tout archétype portant sa catégorie. SOURCE UNIQUE de cette dérivation. */
function unitIdsOfKind(kind: 'bete' | 'vehicule-terrestre'): string[] {
  if (kind === 'bete') return creatures.filter((c) => c.purchase).map((c) => c.id);
  return vehicles.filter((v) => v.purchase && !v.ship).map((v) => v.id); // vehicule-terrestre (navire non vendu -> #748)
}

/** Meilleur seuil « Tenir les comptes » du groupe (LDB 59 l.9-11) : le plus haut budget de Statut
 *  (Bronze N = N sous / Argent N = N pistoles / Or N = N couronnes) parmi les héros — le membre le plus
 *  huppé couvre les achats courants. Consomme `statusBudgetBrass` (engine/money). */
function partyStatusBudgetBrass(party: Combatant[]): number {
  let best = 0;
  for (const h of party) {
    const st = actorStatus(h);
    best = Math.max(best, statusBudgetBrass(st.tier.toLowerCase() as StatusTier, st.standing));
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
  const ruleId = key === 'guild' ? 'market-guild' : key === 'marketMode' ? 'market-mode' : 'market-tenir-comptes';
  return rule(ruleId);
}

/** « Tenir les comptes » (LDB 59 l.9-11, option `market-tenir-comptes`) : un objet dont le prix listé
 *  est ≤ au niveau de Statut du groupe s'achète « autant de fois que nécessaire », sans débit. */
function comptesFree(ent: SceneEntity | undefined, party: Combatant[], listedBrass: number): boolean {
  return !!marketRule(ent, 'tenirComptes') && listedBrass > 0 && listedBrass <= partyStatusBudgetBrass(party);
}

/** Bonus de recherche de Disponibilité du groupe (LDB 59 l.50) : +10 si un héros a une Carrière
 *  cohérente (« Marchand ou Receleur », l.50) ; +10 de plus si le groupe a passé une journée entière à
 *  chercher activement (Test de Ragot réussi, `gossipDay`). Le RAW plafonne à +20 %
 *  (`availabilitySearchBonus`). Renvoie le % à ajouter aux Tests de Disponibilité du stock. */
/** Carrières « cohérentes » pour la recherche de Disponibilité (LDB 59 l.50) — ids STABLES, pas des
 *  libellés (`Combatant.career` porte l'id de la Carrière). */
const COHERENT_AVAILABILITY_CAREERS = new Set(['marchand', 'receleur']);
function partyAvailabilityBonus(party: Combatant[], gossipDay = false): number {
  const coherent = party.some((h) => COHERENT_AVAILABILITY_CAREERS.has(h.career ?? ''));
  return availabilitySearchBonus({ coherentCareer: coherent, gossipDay });
}

/** Ligne de journal d'un tirage de Disponibilité (LDB 59 l.50) — le dé n'a AUCUNE rangée : le journal
 *  est sa seule surface, la ligne se DÉRIVE (`traceLineOf`) comme toutes les autres. Source unique du
 *  pré-tirage affiché (`openStockRevealCascade`) ET de la conséquence de l'étape. Le tirage n'est pas
 *  un Test de Compétence : c'est l'ARTICLE qui nomme la ligne, avec la nature du dé. */
function stockTraceLine(l: StockLine): string {
  return traceLineOf({ label: stepDetail(dataLabel(l.label), t('mf.dispoTrace')), roll: l.test!.roll, target: l.test!.target, success: true, issue: t('mf.dispoQty', { qty: l.qty }) });
}
/** Instantané de stock FRAIS d'un archétype à un instant `now`, avec un bonus de Disponibilité (Carrière
 *  cohérente + éventuelle recherche active, LDB 59 l.50). PUR (aucun `set`/`log`) — SOURCE UNIQUE de calcul,
 *  seedée déterministe pour un `(entityId, période, gossipDay)` donné : le siège qui la lance (local inline
 *  ou MJ via cascade, #273 dernier volet) ne change JAMAIS ces valeurs, seule leur SURFACE varie. */
function computeFreshStockLines(
  get: Get,
  ent: SceneEntity | undefined, arch: (typeof MERCHANTS)[string], entityId: string, settlement: Settlement, now: number, restockPeriod: number, gossipDay: boolean,
): { stock: { id: string; qty: number }[]; tested: StockLine[] } {
  const guild = !!marketRule(ent, 'guild');
  const marketMode = marketRule(ent, 'marketMode') as string;
  const cat: CatalogItem[] = trappings
    .filter((t) => !t.service) // tarif de service (chambre/écurie, LDB 66 l.12-14) : jamais en stock, pas un objet
    .filter((t) => (!arch.category.categories || arch.category.categories.includes(t.categorie)) && (!arch.category.subTypes || (t.subType != null && arch.category.subTypes.includes(t.subType))))
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
 *  par l'ouverture (`openMerchant`) et la recherche active (`searchAvailability`). Retourne le stock tiré. */
function rollFreshStock(
  get: Get, set: Set,
  entityId: string, ent: SceneEntity | undefined, arch: (typeof MERCHANTS)[string], settlement: Settlement, now: number, restockPeriod: number, gossipDay: boolean,
): { id: string; qty: number }[] {
  const { stock, tested } = computeFreshStockLines(get, ent, arch, entityId, settlement, now, restockPeriod, gossipDay);
  if (tested.length) get().log(t('mf.marketRoll', { settlement, lignes: tested.map((l) => t('mf.stockLine', { label: l.label, qty: l.qty })).join(', ') }));
  persistStock(set, entityId, stock, now);
  return stock;
}

/** Kind d'étape de cascade du réassort marchand (#273 dernier volet) — SOURCE UNIQUE de visibilité MJ du
 *  tirage de stock (`rollStock`/`fullStock`, RNG SEEDÉ déterministe, `computeFreshStockLines`). Siège MJ
 *  présent → étape VISIBLE (jamais un tirage silencieux) : « Continuer » l'applique. Recalcule les MÊMES
 *  lignes depuis les primitives sérialisables du `meta` (le rng seedé n'est jamais transporté lui-même —
 *  seuls ses PARAMÈTRES le sont, cf. `CascadeStepMeta`) ; ouvre le panneau marchand (`openMerchant`) ou
 *  rafraîchit son stock si `merchant` porte déjà cette entité (`searchAvailability`), au choix de
 *  `s.merchant?.entityId === entityId` — un seul applier pour les deux appelants. */
const MERCHANT_STOCK_KIND = 'merchant-stock';
registerCascadeApplier(MERCHANT_STOCK_KIND, (get, set, step) => {
  const meta = step.meta ?? {};
  const entityId = String(meta.entityId ?? '');
  const archetype = String(meta.archetype ?? '');
  const ent = get().scene?.entities.find((e) => e.id === entityId);
  const arch = MERCHANTS[archetype];
  // `arch` (`meta.archetype`, sérialisé à l'ouverture) SUFFIT — un marchand de LIEU (#369, `openPlaceMerchant`)
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
});

/** Ouvre l'étape de cascade VISIBLE-LANÇABLE au siège MJ (#273 dernier volet) — jamais un tirage
 *  silencieux : le `meta` porte les PARAMÈTRES sérialisables du tirage (le rng seedé reste calculé par
 *  `computeFreshStockLines`, jamais transporté). Le call-site n'assemble plus rien d'autre. */
function openStockRevealCascade(
  get: Get, set: Set,
  entityId: string, archetype: string, settlement: Settlement, now: number, restockPeriod: number, gossipDay: boolean, resaleRate: number, buyMarkup: number, backdrop?: string,
): void {
  const arch = MERCHANTS[archetype];
  // #331 réserve A-bis : PRÉ-POSE le tirage article par article dans `outcome` AVANT validation — la
  // modale d'affichage ne montrait QUE l'en-tête + « Terminer ». Le tirage est SEEDÉ déterministe
  // (`computeFreshStockLines`), donc ces lignes affichées == celles que l'applier recompose/persiste.
  // `ent` n'existe pas pour un marchand de LIEU (#369, `openPlaceMerchant`) — le pretirage se calcule
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
  startCascade(get, set, { title: t('mf.restockTitle'), purpose: 'test', steps: [step] });
}

/** Ouverture PARTAGÉE d'une visite marchande (#369) — `ent` est l'override d'ENTITÉ de scène (PNJ posé
 *  dans une scène) quand il existe ; un marchand de LIEU (`openPlaceMerchant`, catalogue `lieux-services.json`)
 *  n'en porte aucun et joue les défauts d'archétype nus. SOURCE UNIQUE du calcul d'ouverture, réutilisée
 *  par les deux entrées — aucune n'est un fork de l'autre. */
function openMerchantByArchetype(get: Get, set: Set, entityId: string, archetype: string, ent?: SceneEntity, backdrop?: string): void {
  const arch = MERCHANTS[archetype];
  if (!arch) { get().log(t('mf.archetypeUnknown', { archetype })); return; }
  const settlement: Settlement = ent?.merchant?.settlement ?? arch.settlement;
  const resaleRate = ent?.merchant?.resaleRate ?? arch.resaleRate;
  const buyMarkup = ent?.merchant?.buyMarkup ?? arch.buyMarkup ?? 1; // majoration d’achat (1 = prix listé ; >1 = vend plus cher)
  const restockPeriod = (ent?.merchant?.restockDays ?? arch.restockDays ?? 1) * MINUTES_PER_DAY; // réassort (#T3)
  const now = get().gameTime;
  const prev = get().merchantStocks[entityId];
  // Re-stock dans le temps (#T3) : on conserve le stock DÉPLÉTÉ entre visites ; on ne re-tire un stock
  // FRAIS (nouvelle Disponibilité) que si `restockPeriod` s'est écoulé depuis le dernier tirage.
  // Règles optionnelles « Marché » (LDB 59/60) : Guildes d'Artisans (Atouts/Défauts inversent la
  // Disponibilité) ; système simplifié (pas de Test de Disponibilité) ; cf. `market-guild`/`market-mode`.
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

export function openMerchant(get: Get, set: Set, entityId: string): void {
  const ent = get().scene?.entities.find((e) => e.id === entityId);
  if (!ent?.merchant) return;
  openMerchantByArchetype(get, set, entityId, ent.merchant.archetype, ent);
}

/** Marchand de LIEU (#369) — ouvre le système marchand EXISTANT pour un service de catalogue sans
 *  `SceneEntity` (forgeron du hub de ville…) : même `openMerchantByArchetype`, keyé sur l'id virtuel
 *  `placeServiceMerchantId` (stock persistant propre au lieu+service). Extension du général, pas un fork. */
export function openPlaceMerchant(get: Get, set: Set, entityId: string, archetype: string, backdrop?: string): void {
  openMerchantByArchetype(get, set, entityId, archetype, undefined, backdrop);
}

/** Kind d'étape de cascade du Test de Ragot de recherche active (#273) : le jet passe par la porte
 *  canonique `openPartyTest` (side `partyBest`) — la surface se dérive des PORTEURS réels du jet, la
 *  fenêtre est influençable (Chance/Résilience) et le siège MJ la voit ; la continuation (avance de la
 *  journée + réassort visible/inline) vit ICI, keyée par `kind`. */
const MERCHANT_RAGOT_KIND = 'merchant-ragot';
registerCascadeApplier(MERCHANT_RAGOT_KIND, (get, set, step) => {
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
      actor ? dataLabel(actor.label) : t('eff.party'),
      t(gossipDay ? 'mf.searchOk' : 'mf.searchKo', { roll: step.result.roll }),
    )]),
  };
});

/** Continuation PARTAGÉE (jet réussi/raté OU absence de candidat au Ragot) : avance la journée (« journée
 *  entière », LDB 59 l.50), puis même porte que l'ouverture (#273) — siège MJ → tirage VISIBLE ; sinon
 *  → inline. */
function finalizeSearchAvailability(get: Get, set: Set, entityId: string, restockPeriod: number, gossipDay: boolean): void {
  get().advanceTime(MINUTES_PER_DAY); // « journée entière » — l'horloge cascade normalement (#T3)
  const now = get().gameTime;
  const m = get().merchant;
  if (!m || m.entityId !== entityId) return;
  const ent = get().scene?.entities.find((e) => e.id === entityId);
  const arch = MERCHANTS[m.archetype];
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
export function searchAvailability(get: Get, set: Set): void {
  const m = get().merchant;
  if (!m) return;
  const ent = get().scene?.entities.find((e) => e.id === m.entityId);
  const marketMode = marketRule(ent, 'marketMode') as string;
  if (marketMode === 'sans-disponibilite' || marketMode === 'simplifie') return; // pas de Test de Disponibilité → rien à améliorer
  const arch = MERCHANTS[m.archetype];
  if (!arch) return;
  const restockPeriod = (ent?.merchant?.restockDays ?? arch.restockDays ?? 1) * MINUTES_PER_DAY;
  // Test de Ragot du groupe (Soutien LDB 12) — Intermédiaire (+0), le RAW ne chiffre pas la difficulté.
  const best = partyAssisted(get().party, 'ragot', 'sociabilite');
  if (!best) {
    get().log(t('mf.noGossip'));
    finalizeSearchAvailability(get, set, m.entityId, restockPeriod, false);
    return;
  }
  openPartyTest(get, set, {
    skill: 'ragot', char: 'sociabilite', // Soutien LDB 12 — même valeur que `partyAssisted`
    actionLabel: t('mf.rechercheActive'),
    difficulty: 'intermediaire',
    stake: combatStakeRef(MERCHANT_RAGOT_KIND),
  }, MERCHANT_RAGOT_KIND, { entityId: m.entityId, restockPeriod });
}

export function closeMerchant(get: Get, set: Set): void {
  const m = get().merchant;
  // Négocié mais NON honoré (achat non payé, OU vente sans rien vendre) → verrou partagé jusqu'au réassort.
  const renege = !!m && ((m.bargainBuy != null && !m.bargainPaid) || (m.bargainSell != null && !m.bargainSellUsed));
  if (m && renege) {
    set((s) => ({ merchantStocks: { ...s.merchantStocks, [m.entityId]: { ...s.merchantStocks[m.entityId], bargainLocked: true } } }));
    get().log(t('mf.renege'));
  }
  get().confirmDistribution(); // ne pas perdre les objets payés non répartis
  set({ merchant: null });
}

export function buyItem(get: Get, set: Set, id: string, heroId?: string): void {
  const m = get().merchant; if (!m) return;
  const line = m.stock.find((l) => l.id === id); if (!line || line.qty <= 0) return;
  const entry = catalogEntryOf(id); if (!entry) return;
  const factor = m.bargainBuy ? bargainBuyFactor(m.bargainBuy.won, m.bargainBuy.drNet, m.bargainBuy.negotiator) : 1;
  // « Tenir les comptes » (LDB 59 l.9-11) : objet ≤ Statut du groupe → acquis sans compter les pièces.
  const ent = get().scene?.entities.find((e) => e.id === m.entityId);
  const free = comptesFree(ent, get().party, listedBrassOf(entry));
  const cost = free ? fromBrass(0) : fromBrass(Math.round(toBrass(priceToMoney(entry.price)) * craftPriceFactor({ qualities: entry.qualities as never }) * (m.buyMarkup ?? 1) * factor));
  const dest = heroId ?? get().party[0]?.id;
  const destHero = get().party.find((h) => h.id === dest);
  if (!free && (!destHero || !canAfford(bourseOf(destHero), cost))) { get().log(t('mf.purseKo', { label: entry.label })); return; }
  if (!entry.unit && !itemFromTrappingById(id)) return; // objet de sac introuvable → abandon (parité comportement)
  if (!free) payWithAllocation(get, set, { debits: soloPayer(dest!, cost), recipient: dest, purpose: 'achat' });
  const decr = (st: { id: string; qty: number }[]) => st.map((l) => (l.id === id ? { ...l, qty: l.qty - 1 } : l));
  if (entry.unit && dest) {
    // Achat d'une UNITÉ (#619 Lot A) : possession, pas un objet de sac. Propriétaire = l'acheteur —
    // le picker de choix (lot suivant) reste hors périmètre ici.
    addPossession(get, set, entry.unit.nature === 'vehicule'
      ? { nature: 'vehicule', vehicleId: entry.unit.id, ownerId: dest, location: { kind: 'avec-le-groupe' }, items: [] }
      : { nature: 'bete', ref: { creatureId: entry.unit.id }, ownerId: dest, location: { kind: 'avec-le-groupe' }, items: [] });
  }
  set((s) => {
    const newStock = decr(s.merchant!.stock);
    const eid = s.merchant!.entityId;
    const persisted = s.merchantStocks[eid];
    return {
      party: entry.unit ? s.party : s.party.map((h) => (h.id === dest ? addItemToHero(h, id) : h)), // flux objet→héros mutualisé
      merchant: { ...s.merchant!, stock: newStock },
      // Déplétion PERSISTANTE (#T3) : la quantité reste réduite entre visites (rolledAt inchangé).
      merchantStocks: { ...s.merchantStocks, [eid]: { stock: newStock, rolledAt: persisted?.rolledAt ?? s.gameTime } },
    };
  });
  get().log(t(free ? 'mf.buyFree' : 'mf.buy', { label: entry.label }));
}

export function addToCart(_get: Get, set: Set, id: string): void {
  set((s) => {
    const m = s.merchant; if (!m || m.bargainBuy != null) return {}; // marché conclu → panier scellé
    const stockQty = m.stock.find((l) => l.id === id)?.qty ?? 0;
    const cart = m.cart ?? [];
    const cur = cart.find((c) => c.id === id)?.qty ?? 0;
    if (cur >= stockQty) return {}; // jamais plus que le stock disponible
    const next = cart.some((c) => c.id === id)
      ? cart.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c))
      : [...cart, { id, qty: 1 }];
    return { merchant: { ...m, cart: next } };
  });
}

// Retrait TOUJOURS permis (même après Marchandage : « j'en prends un de moins car je n'ai que 5€ »).
export function decFromCart(_get: Get, set: Set, id: string): void {
  set((s) => {
    const m = s.merchant; if (!m) return {};
    const next = (m.cart ?? []).map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0);
    return { merchant: { ...m, cart: next } };
  });
}

export function removeFromCart(_get: Get, set: Set, id: string): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, cart: (s.merchant.cart ?? []).filter((c) => c.id !== id) } } : {}));
}

export function clearCart(_get: Get, set: Set): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, cart: [] } } : {}));
}

export function refuseBargain(get: Get, set: Set, mode: 'buy' | 'sell'): void {
  const m = get().merchant; if (!m || (mode === 'buy' ? m.bargainBuy : m.bargainSell) == null) return;
  // Refuser une négociation → annule ce côté + VERROU PARTAGÉ (plus de marchandage achat NI vente jusqu'au réassort).
  const patch = mode === 'buy' ? { cart: [], bargainBuy: null } : { bargainSell: null };
  set((s) => ({
    merchant: { ...s.merchant!, ...patch, bargainLocked: true },
    merchantStocks: { ...s.merchantStocks, [m.entityId]: { ...s.merchantStocks[m.entityId], bargainLocked: true } },
  }));
  get().log(t('mf.bargainRefused'));
}

export function payCart(get: Get, set: Set): void {
  const m = get().merchant; if (!m) return;
  const cart = m.cart ?? []; if (!cart.length) return;
  const factor = m.bargainBuy ? bargainBuyFactor(m.bargainBuy.won, m.bargainBuy.drNet, m.bargainBuy.negotiator) : 1;
  const party = get().party;
  const ent = get().scene?.entities.find((e) => e.id === m.entityId);
  // « Tenir les comptes » (LDB 59 l.9-11) : une ligne ≤ Statut du groupe n'est pas comptée (0 sc).
  const unitBrass = (id: string) => {
    const entry = catalogEntryOf(id); if (!entry) return 0;
    if (comptesFree(ent, party, listedBrassOf(entry))) return 0;
    return Math.round(toBrass(priceToMoney(entry.price)) * craftPriceFactor({ qualities: entry.qualities as never }) * (m.buyMarkup ?? 1) * factor);
  };
  let totalBrass = 0;
  for (const c of cart) totalBrass += unitBrass(c.id) * c.qty;
  const total = fromBrass(totalBrass);
  if (!payFromGroup(get, set, total, { purpose: 'panier marchand' })) { get().log(t('mf.cartPurseKo')); return; }
  // Crée les objets achetés (par UNITÉ) en attente de répartition + déplète le stock. Une ligne
  // UNITÉ (véhicule/créature-monture, #760) rejoint elle aussi `pendingDistribution` — le joueur
  // choisit le héros PROPRIÉTAIRE via le même écran de répartition que les objets de sac ;
  // `dest` (= party[0]) est l'affectation PAR DÉFAUT, réassignable.
  const dest = get().party[0]?.id ?? '';
  const staged: NonNullable<MerchantState['pendingDistribution']> = [];
  let newStock = m.stock;
  for (const c of cart) {
    const entry = catalogEntryOf(c.id);
    if (entry?.unit) {
      for (let i = 0; i < c.qty; i++) staged.push({ unit: { nature: entry.unit.nature, id: entry.unit.id }, heroId: dest });
    } else {
      for (let i = 0; i < c.qty; i++) { const it = itemFromTrappingById(c.id); if (it) staged.push({ item: it, heroId: dest }); }
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
  get().log(t('mf.paid', { total: formatMoney(total), count, s: count > 1 ? 's' : '' }));
}

export function assignDistribution(_get: Get, set: Set, index: number, heroId: string): void {
  set((s) => {
    const m = s.merchant; if (!m?.pendingDistribution) return {};
    const pd = m.pendingDistribution.map((d, i) => (i === index ? { ...d, heroId } : d));
    return { merchant: { ...m, pendingDistribution: pd } };
  });
}

export function confirmDistribution(get: Get, set: Set): void {
  const m = get().merchant; const dist = m?.pendingDistribution;
  if (!m || !dist || !dist.length) return;
  const unitEntries = dist.filter((d): d is { unit: { nature: 'vehicule' | 'navire' | 'bete'; id: string }; heroId: string } => 'unit' in d);
  set((s) => {
    const mm = s.merchant; if (!mm) return {};
    const byHero: Record<string, ItemInstance[]> = {};
    for (const d of dist) { if ('item' in d) (byHero[d.heroId] ??= []).push(d.item); }
    const party = s.party.map((h) => {
      const add = byHero[h.id]; if (!add) return h;
      const clone: Combatant = structuredClone(h);
      const added = add.map((it) => ({ ...it, equipped: false }));
      clone.items = [...(clone.items ?? []), ...added];
      for (const it of added) autoStowNewItem(clone, it); // #204 : rangement par défaut
      recomputeLoadout(clone);
      return clone;
    });
    return { party, merchant: { ...mm, pendingDistribution: null } };
  });
  for (const u of unitEntries) {
    addPossession(get, set, u.unit.nature === 'bete'
      ? { nature: 'bete', ref: { creatureId: u.unit.id }, ownerId: u.heroId, location: { kind: 'avec-le-groupe' }, items: [] }
      : { nature: 'vehicule', vehicleId: u.unit.id, ownerId: u.heroId, location: { kind: 'avec-le-groupe' }, items: [] });
  }
}

/** Gain de revente d'un objet (catalogue × qualité × resaleRate × facteur de Marchandage). SOURCE UNIQUE
 *  du prix de vente — partagée par `confirmSell` ET l'aperçu UI (pas de formule dupliquée).
 *  Option 2 (LDB 59 l.54) : ¼ par défaut (resaleRate/2) ; ½ si le Marchandage de vente est GAGNÉ. */
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

/** « Baisse des prix » (LDB 59 l.60) : (dé)crémente le nombre de divisions par deux consenties pour
 *  l'instance `uid` (0..4). Améliore la Disponibilité de l'acheteur, réduit le gain (via `sellGain`). */
export function setSellHalving(get: Get, set: Set, uid: string, delta: number): void {
  const m = get().merchant; if (!m) return;
  const cur = m.sellHalvings?.[uid] ?? 0;
  const next = Math.max(0, Math.min(4, cur + delta));
  set({ merchant: { ...m, sellHalvings: { ...(m.sellHalvings ?? {}), [uid]: next } } });
}

// ── Troc (LDB 59 l.64-76) ───────────────────────────────────────────────────────────────────────
/** Refus de TROC d'un trapping, avec sa RAISON (null = trocable). LDB 59 l.66 : « comparez la
 *  Disponibilité des objets échangés avec celle des objets en cours d'acquisition » — sans Disponibilité,
 *  la comparaison n'a pas de terme et le RATIO n'existe pas. */
function barterRefusal(id: string): string | null {
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

/** Exécute un Troc (LDB 59 l.64) : le héros `giveHeroId` cède `giveCount` exemplaires du trapping
 *  `giveTrappingId` (SANS argent) contre `getCount` exemplaires du stock `getStockId`. Refuse si le
 *  héros n'a pas les exemplaires ou si le stock est insuffisant. Réutilise les flux objet existants. */
export function barterExchange(get: Get, set: Set, opts: { giveHeroId: string; giveTrappingId: string; getStockId: string; getCount?: number }): void {
  const m = get().merchant; if (!m) return;
  const getCount = Math.max(1, Math.floor(opts.getCount ?? 1));
  const refused = barterRefusal(opts.giveTrappingId) ?? barterRefusal(opts.getStockId);
  if (refused) { get().log(t('trade.barterRefused', { reason: refused })); return; }
  const quote = barterQuote(opts.giveTrappingId, opts.getStockId, getCount);
  if (!quote) { get().log(t('mf.barterNoPrice')); return; }
  const donne = garanti(findTrappingById(opts.giveTrappingId), opts.giveTrappingId, 'troc — objet cédé').label;
  const recu = garanti(findTrappingById(opts.getStockId), opts.getStockId, 'troc — objet reçu').label;
  const hero = get().party.find((h) => h.id === opts.giveHeroId);
  const stockLine = m.stock.find((l) => l.id === opts.getStockId);
  if (!hero || !stockLine) return;
  // Exemplaires cédés : instances NON équipées du même trapping chez ce héros.
  const givable = (hero.items ?? []).filter((i) => i.trappingId === opts.giveTrappingId && !i.equipped);
  if (givable.length < quote.giveCount) { get().log(t('mf.barterNeed', { n: quote.giveCount, label: donne, dispo: givable.length })); return; }
  if (stockLine.qty < getCount) { get().log(t('mf.barterNoStock')); return; }
  const soldUids = givable.slice(0, quote.giveCount).map((i) => i.uid);
  const newStock = m.stock.map((l) => (l.id === opts.getStockId ? { ...l, qty: l.qty - getCount } : l));
  set((s) => {
    const eid = s.merchant!.entityId;
    const persisted = s.merchantStocks[eid];
    return {
      party: s.party.map((h) => {
        if (h.id !== opts.giveHeroId) return h;
        let clone: Combatant = structuredClone(h);
        clone.items = (clone.items ?? []).filter((i) => !soldUids.includes(i.uid)); // biens cédés
        for (let i = 0; i < getCount; i++) clone = addItemToHero(clone, opts.getStockId); // biens acquis
        return clone;
      }),
      merchant: { ...s.merchant!, stock: newStock },
      merchantStocks: { ...s.merchantStocks, [eid]: { stock: newStock, rolledAt: persisted?.rolledAt ?? s.gameTime } },
    };
  });
  get().log(t('mf.barterDone', {
    giveCount: quote.giveCount, giveLabel: donne,
    getCount, getLabel: recu,
    giveAv: quote.giveAv, ratio: `${quote.ratio.give}:${quote.ratio.get}`, getAv: quote.getAv,
  }));
}

/** Retire de `party` (clone + recompute) les instances `entries` (uid+heroId) et renvoie la nouvelle liste. */
function removeSold(party: Combatant[], entries: { uid: string; heroId: string }[]): Combatant[] {
  return party.map((h) => {
    const uids = entries.filter((e) => e.heroId === h.id).map((e) => e.uid);
    if (!uids.length) return h;
    const clone: Combatant = structuredClone(h);
    clone.items = (clone.items ?? []).filter((i) => !uids.includes(i.uid));
    recomputeLoadout(clone);
    return clone;
  });
}

/** Ajoute une instance au panier de vente. Un objet HORS COMMERCE (sans Disponibilité catalogue) est
 *  REFUSÉ ici avec sa raison — il n'entre jamais au panier en silence (`sellRefusal`). */
export function addToSellCart(get: Get, set: Set, uid: string, heroId: string): void {
  const item = get().party.find((h) => h.id === heroId)?.items?.find((i) => i.uid === uid);
  const refused = item ? sellRefusal(item) : null;
  if (refused) { get().log(t('trade.sellRefused', { reason: refused })); return; }
  set((s) => {
    const m = s.merchant; if (!m) return {};
    const cart = m.sellCart ?? [];
    if (cart.some((c) => c.uid === uid)) return {}; // instance unique : déjà au panier
    return { merchant: { ...m, sellCart: [...cart, { uid, heroId }] } };
  });
}

export function removeFromSellCart(_get: Get, set: Set, uid: string): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, sellCart: (s.merchant.sellCart ?? []).filter((c) => c.uid !== uid) } } : {}));
}

export function clearSellCart(_get: Get, set: Set): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, sellCart: [] } } : {}));
}

/** Conclut la vente du panier (parité achat/`payCart`) : crédite la somme des `sellGain`, retire les
 *  objets de leurs porteurs, honore la négociation de vente. Réutilise `sellGain`/`removeSold`. */
export function confirmSell(get: Get, set: Set): void {
  const m = get().merchant; if (!m) return;
  const cart = m.sellCart ?? []; if (!cart.length) return;
  const gainByHero: Record<string, Money> = {}; // crédit PERSONNEL : chaque gain revient au PORTEUR de l'objet vendu (#531 §8)
  let total = fromBrass(0);
  const names: string[] = [];
  const sold: { uid: string; heroId: string }[] = [];
  for (const c of cart) {
    const item = get().party.find((h) => h.id === c.heroId)?.items?.find((i) => i.uid === c.uid);
    if (!item) continue;
    const refused = sellRefusal(item); // dernier verrou : le panier peut précéder un changement de donnée
    if (refused) { get().log(t('trade.sellRefused', { reason: refused })); continue; }
    const g = sellGain(item, m);
    gainByHero[c.heroId] = moneyAdd(gainByHero[c.heroId] ?? fromBrass(0), g);
    total = moneyAdd(total, g);
    names.push(item.label);
    sold.push(c);
  }
  if (!names.length) return;
  set((s) => ({
    merchant: s.merchant ? { ...s.merchant, sellCart: [], bargainSellUsed: true } : s.merchant,
    party: removeSold(s.party, sold),
  }));
  for (const [heroId, g] of Object.entries(gainByHero)) creditBourse(get, set, heroId, g);
  get().log(`Vente : ${names.join(', ')} (+${formatMoney(total)}).`);
}

/** Réparation d'un objet chez un artisan — armure (LDB 63 l.64) OU arme (LDB 62 l.135), coût unifié
 *  par `itemRepairCostBrass`. Une arme réduite à l'état improvisé est irréparable (isRepairable). */
export function repairItem(get: Get, set: Set, uid: string, heroId: string): void {
  const m = get().merchant; if (!m) return;
  const hero = get().party.find((h) => h.id === heroId);
  const item = hero?.items?.find((i) => i.uid === uid);
  if (!item || !isRepairable(item)) return;
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const base = t ? toBrass(priceToMoney(t.price)) : 0;
  const cost = fromBrass(itemRepairCostBrass(item, base));
  if (!hero || !canAfford(bourseOf(hero), cost)) { get().log(msg('mf.repairPurseKo', { label: item.label })); return; }
  payWithAllocation(get, set, { debits: soloPayer(heroId, cost), recipient: heroId, purpose: 'réparation' });
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const it = clone.items?.find((i) => i.uid === uid); if (it) it.damageTaken = 0;
      recomputeLoadout(clone);
      return clone;
    }),
  }));
  get().log(msg('mf.repairDone', { label: item.label }));
}

export function startBargain(get: Get, set: Set, mode: 'buy' | 'sell'): void {
  const m = get().merchant; if (!m) return;
  const ent = get().scene?.entities.find((e) => e.id === m.entityId);
  const mkt = marketRule(ent, 'marketMode') as string;
  if (mkt === 'sans-marchandage' || mkt === 'simplifie') return; // Marchandage désactivé (règle optionnelle LDB 59 l.15)
  if (m.soured) return; // botch antérieur : le marchand se méfie, plus de marchandage (LDB 59 l.43)
  if (m.bargainLocked) return; // VERROU PARTAGÉ : a refusé/renié un marché (achat OU vente) → plus de négociation jusqu'au réassort
  if (mode === 'buy' ? m.bargainBuy : m.bargainSell) return; // 1 marchandage par MODE et par visite (achat ≠ vente)
  // L'ouverture refuse un archétype inconnu (`openMerchantByArchetype`) : ouvert, il est garanti.
  const arch = garanti(MERCHANTS[m.archetype], m.archetype, 'marchandage');
  const best = partyAssisted(get().party, 'marchandage', 'sociabilite'); if (!best) return; // Soutien (LDB 12) : conseillers du groupe
  const negotiator = hasBargainBonus(best.actor); // Négociateur → registre de talents (jamais un name-match)
  set({ pendingBargain: {
    playerId: best.actor.id, playerName: best.actor.label,
    merchantName: arch.label, merchantValue: arch.bargainSkill,
    playerSkill: best.value, support: best.support,
    // Grandeur du départage à DR égal (`LDB 12 l.160`) : le Niveau de Compétence NU, à l'accesseur
    // canon — `best.value` est la valeur de TEST, qui porte en plus le Soutien et TOUT modificateur du
    // Marchandage (États, mutation Visage inversé, objet Laid… — cf. `skills.testValueParts`).
    playerBase: skillBaseValue(best.actor, 'marchandage', undefined, 'sociabilite'),
    mode, negotiator, roll: null, merchantRoll: null, result: null,
  } });
}

/** « Conclure » le Marchandage : fige l'issue sur la visite (prix modulés) — LDB 59 l.43. */
export function bargainConfirm(get: Get, set: Set): void {
  const pb = get().pendingBargain;
  if (!pb || !pb.result) return; // pas d'acquittement avant le jet
  const won = pb.result.attackerWins; // le joueur est l'attaquant
  const drNet = pb.result.netSL;
  // « Rater de beaucoup » (LDB 59 l.43) = perdre l'opposé par un net DR ≥ 6 (symétrique du Succès Stupéfiant
  // +6 qui donne −20 %) → le marchand se méfie de votre monnaie : plus aucun marchandage cette visite.
  const botch = !won && drNet >= SL_ASTOUNDING;
  const outcome = { won, drNet, negotiator: pb.negotiator };
  const patch = pb.mode === 'buy' ? { bargainBuy: outcome } : { bargainSell: outcome };
  // ACQUITTEMENT par le goulot (`FLOWS.bargain.apply`) : le verdict est déclaré AU FLUX (`spec.issue`),
  // journalisé là — ici on acquitte, avant de fermer le pending qui le porte.
  FLOWS.bargain.apply(get);
  set((s) => ({
    pendingBargain: null,
    merchant: s.merchant ? { ...s.merchant, ...patch, soured: s.merchant.soured || botch } : s.merchant,
  }));
}

/** Talent « Détection d'artefact » (LDB 10 l.336) : Test d'Intuition au toucher — succès =
 *  l'objet est senti magique, chaque DR apprend une règle spéciale ; UNE tentative par artefact. */
export const DETECT_TALENT = "Détection d'artefact";

/** Compétence testée par CHAQUE mode de la fenêtre Évaluation/Détection, par id STABLE — SOURCE
 *  UNIQUE lue par l'ouverture du jet (`bestDetector`/`openAppraise`) ET par la modale qui décompose
 *  la valeur affichée (`AppraiseModal`, #1178). Détection : Talent « Détection d'artefact »
 *  (`LDB 10 l.336`). Les Caractéristiques associées sont celles de `skills.json`. */
export const APPRAISE_SKILL = {
  evaluate: { skill: 'evaluation', characteristic: 'intelligence' },
  detect: { skill: 'intuition', characteristic: 'initiative' },
} as const satisfies Record<'evaluate' | 'detect', { skill: string; characteristic: CharKey }>;

/** Meilleur détecteur du groupe : meilleure Intuition PARMI les porteurs du Talent (c'est LUI qui
 *  touche l'objet — pas un partyBest global comme l'Évaluation). null si personne ne l'a. */
export function bestDetector(party: Combatant[]): { actor: Combatant; value: number; support: SupportDetail } | null {
  const holders = party.filter((h) => !h.dead && h.talents.some((t) => t.talentId === slugId(DETECT_TALENT) && (t.times ?? 1) >= 1));
  if (!holders.length) return null;
  const best = partyAssisted(holders, APPRAISE_SKILL.detect.skill, APPRAISE_SKILL.detect.characteristic); // Soutien (LDB 12)
  return best ? { actor: best.actor, value: best.value, support: best.support } : null;
}

/** Démarreur PARTAGÉ Évaluation/Détection — sur un objet d'inventaire (`itemUid`) OU une ligne de
 *  butin encore en fenêtre (`gear`). Une seule modale, un seul flux de jet (rollFlows.appraise). */
function openAppraise(
  get: Get, set: Set,
  target: { itemUid?: string; gear?: { scope: 'loot' | 'victory'; index: number } },
  itemName: string, mode: 'evaluate' | 'detect', trappingId?: string,
): void {
  const best = mode === 'detect' ? bestDetector(get().party) : partyAssisted(get().party, APPRAISE_SKILL.evaluate.skill, APPRAISE_SKILL.evaluate.characteristic); // Soutien (LDB 12)
  if (!best) return;
  const t = trappingId ? findTrappingById(trappingId) : undefined;
  set({ pendingAppraise: {
    actorId: best.actor.id, actorName: best.actor.label, ...target, itemName,
    // Le libellé de la Compétence vient du REGISTRE, par id stable — jamais un nom écrit au call-site.
    mode, skillLabel: refLabel('skills', { id: APPRAISE_SKILL[mode].skill }),
    truePriceBrass: t ? toBrass(priceToMoney(t.price)) : 0,
    availability: (t?.availability as string | undefined) ?? null,
    skillValue: best.value, support: best.support, difficulty: 'intermediaire', target: best.value, roll: null, success: false, sl: 0,
  } });
}

/** Jour de jeu courant (verrou « pas de re-tentative d'Évaluation le même jour »). */
export function gameDay(get: Get): number {
  return Math.floor(get().gameTime / MINUTES_PER_DAY);
}

export function appraiseItem(get: Get, set: Set, uid: string, heroId: string, mode: 'evaluate' | 'detect' = 'evaluate'): void {
  const hero = get().party.find((h) => h.id === heroId);
  const item = hero?.items?.find((i) => i.uid === uid); if (!item) return;
  if (mode === 'detect' && item.detectTried) return; // une seule tentative par artefact (LDB 10 l.336)
  if (mode === 'evaluate' && item.appraiseTriedDay === gameDay(get)) {
    get().log(t('mf.appraiseSameDay', { label: item.label }));
    return;
  }
  openAppraise(get, set, { itemUid: uid }, item.label, mode, item.trappingId);
}

/** Évaluation/Détection d'une ligne de butin ENCORE en fenêtre (loot ou victoire) — révéler AVANT
 *  de choisir qui l'emporte (demande utilisateur). */
export function appraiseGear(get: Get, set: Set, scope: 'loot' | 'victory', index: number, mode: 'evaluate' | 'detect' = 'evaluate'): void {
  const bucket = scope === 'loot' ? get().pendingLoot : get().pendingVictory;
  const line = bucket?.gear?.[index]; if (!line) return;
  if (mode === 'detect' && line.effect.detectTried) return;
  if (mode === 'evaluate' && line.effect.appraiseTriedDay === gameDay(get)) return;
  openAppraise(get, set, { gear: { scope, index } }, line.label, mode, line.effect.trappingId);
}

/** Patch la cible de l'Évaluation/Détection — objet porté (party) ou ligne de butin en fenêtre. */
function patchAppraiseTarget(_get: Get, set: Set, pa: { itemUid?: string; gear?: { scope: 'loot' | 'victory'; index: number } },
  patch: { identified?: boolean; magicKnown?: boolean; detectTried?: boolean; appraiseTriedDay?: number }): void {
  if (pa.gear) {
    const key = pa.gear.scope === 'loot' ? 'pendingLoot' : 'pendingVictory';
    const idx = pa.gear.index;
    set((s) => {
      const bucket = s[key];
      if (!bucket?.gear?.[idx]) return {};
      const gear = bucket.gear.map((g, i) => {
        if (i !== idx) return g;
        const effect = { ...g.effect, ...patch };
        if (patch.identified) delete (effect as { identified?: boolean }).identified; // identifié = champ absent
        return { ...g, magic: g.magic || !!patch.magicKnown, effect };
      });
      return { [key]: { ...bucket, gear } } as Partial<GameState>;
    });
    return;
  }
  set((s) => ({
    party: s.party.map((h) => {
      if (!(h.items ?? []).some((i) => i.uid === pa.itemUid)) return h; // clone uniquement le porteur de l'objet
      const clone: Combatant = structuredClone(h);
      const it = clone.items?.find((i) => i.uid === pa.itemUid);
      if (it) {
        Object.assign(it, patch);
        if (patch.identified) delete it.suspectedQualities; // la vraie révélation dissipe les fausses certitudes
      }
      return clone;
    }),
  }));
}

/** Acquitte l'Évaluation (révèle `identified` + estimation, LDB 59 l.41) ou la Détection d'artefact
 *  (aura sentie + règles apprises par DR, LDB 10 l.336 ; tentative unique). */
export function resolveAppraise(get: Get, set: Set): void {
  const pa = get().pendingAppraise;
  if (!pa || pa.roll == null) return; // pas d'acquittement avant le jet
  set({ pendingAppraise: null });
  if (pa.mode === 'detect') {
    // Qualités MAGIQUES de la cible : sur une ligne de butin on les connaît (effet) ; sur un objet
    // porté, l'ajout est fondu dans `qualities` → on compte 1 règle (cas du butin du jeu).
    const line = pa.gear ? (pa.gear.scope === 'loot' ? get().pendingLoot : get().pendingVictory)?.gear?.[pa.gear.index] : undefined;
    const item = pa.itemUid ? get().party.flatMap((h) => h.items ?? []).find((i) => i.uid === pa.itemUid) : undefined;
    const isMagic = line ? line.magic : !!item && (item.identified === false || !!item.magicKnown);
    const rules = line ? (line.effect.qualities?.length ?? (line.effect.identified === false ? 1 : 0)) : 1;
    if (!pa.success) {
      patchAppraiseTarget(get, set, pa, { detectTried: true });
      get().log(t('mf.detectNothing', { actor: pa.actorName, item: pa.itemName }));
      return;
    }
    if (!isMagic) {
      patchAppraiseTarget(get, set, pa, { detectTried: true });
      get().log(t('mf.detectNotMagic', { actor: pa.actorName, item: pa.itemName }));
      return;
    }
    // Succès : aura sentie ; chaque DR apprend une règle → tout révélé quand DR couvre les règles.
    const allKnown = pa.sl >= Math.max(1, rules);
    patchAppraiseTarget(get, set, pa, { detectTried: true, magicKnown: true, ...(allKnown ? { identified: true } : {}) });
    get().log(t(allKnown ? 'mf.detectAll' : 'mf.detectPartial', { actor: pa.actorName, item: pa.itemName, dr: pa.sl }));
    return;
  }
  if (!pa.success) {
    // Échec NET : pas de re-tentative le même jour (LDB 12 l.94 — seul un résultat marginal
    // « permet de faire un nouvel essai » ; ADE II : re-tenter une identification coûte du temps).
    patchAppraiseTarget(get, set, pa, { appraiseTriedDay: gameDay(get) });
    get().log(t('mf.appraiseFail', { item: pa.itemName }));
    return;
  }
  patchAppraiseTarget(get, set, pa, { identified: true });
  if (pa.truePriceBrass <= 0) { get().log(t('mf.appraiseUnique', { item: pa.itemName })); return; }
  const est = appraiseEstimate(pa.availability as Parameters<typeof appraiseEstimate>[0], pa.truePriceBrass);
  const range = est.min === est.max
    ? formatMoney(fromBrass(est.min))
    : t('mf.estimateRange', { min: formatMoney(fromBrass(est.min)), max: formatMoney(fromBrass(est.max)) });
  get().log(t('mf.appraiseValue', { item: pa.itemName, range }));
}
