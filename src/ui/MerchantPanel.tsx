import { useState, useMemo } from 'react';
import { useGame } from '../state/store';
import { findTrappingById, findVehicleById, weaponGroupLabel, merchantFamilies, type QualityRef } from '../data/index';
import { priceToMoney, fromBrass, toBrass, canAfford, add as moneyAdd, type Money } from '../engine/money';
import { craftPriceFactor } from '../engine/qualities/craftEconomy';
import { isRepairable, itemRepairCostBrass } from '../engine/repair';
import { Row } from './Layout';
import { bargainBuyFactor } from '../engine/bargain';
import { compareEquip } from '../engine/equipCompare';
import { itemFromTrappingById, isWeaponActive, damageString, isShieldTrapping } from '../engine/items';
import { mountProfileForCreature } from '../engine/mountTravel';
import { rangeSpecLabel, ammoRangeModLabel } from './weaponStats';
import type { WeaponDamageSpec, WeaponRangeSpec, AmmoRangeMod } from '../engine/types';
import { describeQuality } from '../engine/qualities/describe';
import { QualityChip } from './EntityChip';
import { sellGain, barterQuote, sellBuyerAvailability, sellRefusal, catalogEntryOf } from '../state/merchantFlow';
import { GatedAction } from './GatedAction';
import { partyMoneyTotal } from '../state/bourseFlow';
import type { Combatant, ItemInstance, QualityInstance } from '../engine/types';
import { resolveQualities } from '../engine/qualities/dispatch';
import type { SceneEntity } from '../state/scene';
import { MERCHANTS } from '../state/merchants';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { Prose, mdToText } from './Prose';
import { CharFrame } from './CharFrame';
import { TeamPortrait } from './TeamPortrait';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { ScreenShell } from './ScreenShell';
import { Tabs } from './Tabs';
import { SpeakerBanner } from './SpeakerBanner';
import { TradeTable, type TradeColumn, type TradeGroup } from './TradeTable';
import { QtyStepper } from './QtyStepper';
import { AVAILABILITIES } from '../engine/types';

type MerchantState = NonNullable<ReturnType<typeof useGame.getState>['merchant']>;

/** Rang de rareté d'une ligne de catalogue = son INDICE dans le canon ordonné ; hors canon (« ND »,
 *  absence) → après le dernier palier. */
function availRank(id: string): number {
  const i = (AVAILABILITIES as readonly string[]).indexOf(catalogEntryOf(id)?.availability ?? '');
  return i < 0 ? AVAILABILITIES.length : i;
}

/** Colonnes de stats par famille (tableau comparatif). `get` prend directement l'`id` de la ligne —
 *  chaque famille fait SON lookup (trapping ou catalogue généralisé), aucune résolution par défaut
 *  qui présumerait un trapping. */
type TrapRow = { damage?: WeaponDamageSpec | null; reach?: string | null; range?: WeaponRangeSpec | null; ammoRangeMod?: AmmoRangeMod | null; pa?: number | null; qualities?: QualityRef[] };
const DASH = '—';
const dmg = (t: TrapRow) => (t.damage ? damageString(t.damage) : DASH);
/** Colonne de trapping — résout la ligne PUIS applique `fn` (DASH si la ligne n'est pas un trapping). */
function trapCol(fn: (t: TrapRow) => string): (id: string) => string {
  return (id) => { const t = findTrappingById(id); return t ? fn(t) : DASH; };
}
/** Capacité de PORT d'une unité (#619 Lot A) — Enc portée EDOC 07 (monture) ou Chargement LDB 70/EDOC 07
 *  (véhicule terrestre) ; DASH si non chiffré (navire — hors Lot A). */
function unitCapacity(id: string): string {
  const unit = catalogEntryOf(id)?.unit;
  if (!unit) return DASH;
  if (unit.nature === 'bete') { const p = mountProfileForCreature(unit.id); return p ? `M ${p.m} / Enc ${p.encPortee}` : DASH; }
  const v = findVehicleById(unit.id);
  return v?.chargement != null ? `Chargement ${v.chargement}` : DASH;
}
/** Registre FIXE des colonnes de stats disponibles pour une famille (`merchantFamilies.json:columns`
 *  y référence par id) — exporté pour la garde de cohérence (`data/merchantFamilies.test.ts`). */
export const MERCHANT_COL_RENDERERS: Record<string, { label: string; get: (id: string) => string }> = {
  damage: { label: 'Dégâts', get: trapCol(dmg) },
  reach: { label: 'Allonge', get: trapCol((t) => t.reach || DASH) },
  // « N m » fixe / « BF×k m » jet ; sinon modificateur de munition (« ×½ »)
  range: { label: 'Portée', get: trapCol((t) => rangeSpecLabel(t.range) ?? (ammoRangeModLabel(t.ammoRangeMod) || DASH)) },
  protection: { label: 'Protection', get: trapCol((t) => { const q = (t.qualities ?? []).find((x) => x.id === 'protectrice'); return q ? `Protectrice ${q.value ?? ''}`.trim() : DASH; }) },
  pa: { label: 'PA', get: trapCol((t) => (t.pa != null ? String(t.pa) : DASH)) },
  availability: { label: 'Disponibilité', get: (id) => catalogEntryOf(id)?.availability ?? DASH },
  capacity: { label: 'Capacité', get: unitCapacity },
};

/** 7 familles de présentation du stock (`merchantFamilies.json`, ordre d'affichage = ordre du fichier).
 *  `unites` (#619 Lot A) = véhicules/créatures-montures d'archétype (`MerchantArchetypeDef.unitKinds`)
 *  — jamais des trappings. */
const FAMILIES: { key: string; label: string }[] = merchantFamilies.map((f) => ({ key: f.id, label: f.label }));
const FAMILY_COLS: Record<string, { label: string; get: (id: string) => string; emph?: boolean }[]> = Object.fromEntries(
  merchantFamilies.map((f) => [f.id, f.columns.map((c, i) => ({ ...MERCHANT_COL_RENDERERS[c], emph: i === 0 ? true : undefined }))]),
);

const UNIT_FAMILY = merchantFamilies.find((f) => f.match.unit)?.id ?? 'divers';
const SHIELD_FAMILY = merchantFamilies.find((f) => f.match.shield)?.id ?? 'divers';
const FALLBACK_FAMILY = merchantFamilies.find((f) => !f.match.categorie && !f.match.shield && !f.match.unit)?.id ?? 'divers';
const FAMILY_BY_TRAPPING_CATEGORIE = new Map(merchantFamilies.filter((f) => f.match.categorie).map((f) => [f.match.categorie as string, f.id]));

/** Famille d'une ligne de stock — `catalogEntryOf` (SOURCE UNIQUE, `state/merchantFlow.ts`) tranche
 *  d'abord si c'est une UNITÉ (#619 Lot A) avant de retomber sur la classification trapping. Priorité
 *  de SPÉCIFICITÉ (dérivée de `merchantFamilies.json:match`) : unit → shield → categorie → fallback. */
function familyOf(id: string): string {
  if (catalogEntryOf(id)?.unit) return UNIT_FAMILY;
  const t = findTrappingById(id);
  if (!t) return FALLBACK_FAMILY;
  if (isShieldTrapping(id)) return SHIELD_FAMILY;
  return FAMILY_BY_TRAPPING_CATEGORIE.get(t.categorie) ?? FALLBACK_FAMILY;
}

/** Coût d'achat unitaire (catalogue × qualité d'artisanat × Marchandage). null si prix non chiffré (« ND »).
 *  `catalogEntryOf` (SOURCE UNIQUE) — trapping OU unité, jamais un lookup présumant l'un ou l'autre. */
function lineCost(id: string, factor: number): Money | null {
  const entry = catalogEntryOf(id);
  if (!entry) return null;
  const brass = toBrass(priceToMoney(entry.price)) * craftPriceFactor({ qualities: entry.qualities as never }) * factor;
  if (!Number.isFinite(brass)) return null;
  return fromBrass(Math.round(brass));
}

/** Coût de réparation d'un objet endommagé — armure (LDB 63 l.64) ou arme (LDB 62 l.135). */
function repairCost(item: ItemInstance): Money {
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const base = t ? toBrass(priceToMoney(t.price)) : 0;
  return fromBrass(itemRepairCostBrass(item, base));
}

const TREND_CLASS: Record<string, string> = { up: 'cmp-up', down: 'cmp-down', same: '' };
const TREND_SYM: Record<string, string> = { up: '▲', down: '▼', same: '' };

/** Présentationnel (props) — testable hors store. `initialTab`/`initialDetails`/`initialBuyView` = état de départ (SSR/test). */
export function MerchantPanelView({ merchant, party, money, speakerEnt, speakerName, boniment, onAddToCart, onDecCart, onRemoveCart, onClearCart, onRefuse, onPay, onAssignDist, onConfirmDist, onAddToSellCart, onRemoveSellCart, onClearSellCart, onConfirmSell, onRepair, onBargain, onAppraise, onClose, onSellHalving, onBarter, onSearchAvailability, initialTab, initialDetails, initialBuyView, initialSellView }: {
  merchant: MerchantState;
  party: Combatant[];
  money: Money;
  /** Entité de scène du marchand (portrait du bandeau) — absente en test hors store. */
  speakerEnt?: SceneEntity;
  /** Nom affiché par le bandeau (label de l'entité, sinon libellé d'archétype). */
  speakerName?: string;
  /** Réplique de boniment de l'archétype (`MerchantArchetypeDef.boniment`), optionnelle. */
  boniment?: string;
  onAddToCart: (id: string) => void;
  onDecCart: (id: string) => void;
  onRemoveCart: (id: string) => void;
  onClearCart: () => void;
  onRefuse: (mode: 'buy' | 'sell') => void;
  onPay: () => void;
  onAssignDist: (index: number, heroId: string) => void;
  onConfirmDist: () => void;
  onAddToSellCart: (uid: string, heroId: string) => void;
  onRemoveSellCart: (uid: string) => void;
  onClearSellCart: () => void;
  onConfirmSell: () => void;
  onRepair: (uid: string, heroId: string) => void;
  onBargain: (mode: 'buy' | 'sell') => void;
  onAppraise: (uid: string, heroId: string) => void;
  onClose: () => void;
  /** « Baisse des prix » à la vente (LDB 59 l.60) — optionnel (rendu sans si absent). */
  onSellHalving?: (uid: string, delta: number) => void;
  /** Troc (LDB 59 l.64-76) — optionnel : l'onglet Troc n'apparaît que s'il est fourni. */
  onBarter?: (opts: { giveHeroId: string; giveTrappingId: string; getStockId: string; getCount?: number }) => void;
  /** Recherche active de Disponibilité (LDB 59 l.50) — optionnel : le bouton n'apparaît que s'il est fourni. */
  onSearchAvailability?: () => void;
  initialTab?: 'buy' | 'sell' | 'repair' | 'barter';
  initialDetails?: string;
  initialBuyView?: 'browse' | 'cart';
  initialSellView?: 'browse' | 'cart';
}) {
  const [tab, setTab] = useState<'buy' | 'sell' | 'repair' | 'barter'>(initialTab ?? 'buy');
  const [buyCat, setBuyCat] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(initialDetails ?? null);
  const [buyView, setBuyView] = useState<'browse' | 'cart'>(initialBuyView ?? 'browse');
  const [sellView, setSellView] = useState<'browse' | 'cart'>(initialSellView ?? 'browse');
  const [sellHero, setSellHero] = useState<string | null>(null); // onglet PJ actif côté Vente
  const [barterGive, setBarterGive] = useState(''); // Troc : « heroId|trappingId » du bien cédé
  const [barterGetId, setBarterGetId] = useState(''); // Troc : id du stock acquis
  const [barterCount, setBarterCount] = useState(1);
  const toggleDetails = (label: string) => setDetails((d) => (d === label ? null : label));

  const damaged = party.flatMap((h) => (h.items ?? []).filter((it) => isRepairable(it)).map((it) => ({ h, it })));
  const sellable = party.flatMap((h) => (h.items ?? []).map((it) => ({ h, it })));

  // Marchandage (LDB 59 l.43) : achat (panier) et vente = négociations distinctes.
  const buyHaggle = merchant.bargainBuy ? bargainBuyFactor(merchant.bargainBuy.won, merchant.bargainBuy.drNet, merchant.bargainBuy.negotiator) : 1;
  const buyFactor = (merchant.buyMarkup ?? 1) * buyHaggle;
  const buyDiscount = Math.round((1 - buyHaggle) * 100);
  const sellPriceMoney = (it: ItemInstance): Money => sellGain(it, merchant); // prix de vente = source unique (engine)
  // Panier de VENTE (#22b) : instances résolues chez leur porteur + total (mêmes briques que l'achat).
  const sellCart = merchant.sellCart ?? [];
  const sellInCart = (uid: string) => sellCart.some((c) => c.uid === uid);
  const sellCartItems = sellCart
    .map((c) => ({ hero: party.find((h) => h.id === c.heroId), it: party.find((h) => h.id === c.heroId)?.items?.find((i) => i.uid === c.uid) }))
    .filter((x): x is { hero: Combatant; it: ItemInstance } => !!x.it && !!x.hero);
  const sellCartTotal = sellCartItems.reduce((acc, x) => moneyAdd(acc, sellPriceMoney(x.it)), fromBrass(0));

  // Stock groupé par famille puis trié (Disponibilité → nom). Lignes keyées par `trappingId` OU par
  // id d'unité (`catalogEntryOf`, #619 Lot A).
  const labelOf = (id: string) => catalogEntryOf(id)?.label ?? id;
  const inStock = merchant.stock.filter((l) => l.qty > 0);
  const byFamily: Record<string, { id: string; qty: number }[]> = {};
  for (const l of inStock) (byFamily[familyOf(l.id)] ??= []).push(l);
  for (const k of Object.keys(byFamily)) byFamily[k].sort((a, b) => availRank(a.id) - availRank(b.id) || labelOf(a.id).localeCompare(labelOf(b.id)));

  const cart = merchant.cart ?? [];
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotalBrass = cart.reduce((s, c) => { const u = lineCost(c.id, buyFactor); return s + (u ? toBrass(u) * c.qty : 0); }, 0);
  const cartTotal = fromBrass(cartTotalBrass);
  const affordCart = toBrass(money) >= cartTotalBrass;
  const sealed = merchant.bargainBuy != null; // a négocié : prix figé, on peut RETIRER mais pas ajouter ni renégocier
  const cartQtyOf = (id: string) => cart.find((c) => c.id === id)?.qty ?? 0;
  const dist = merchant.pendingDistribution ?? null;

  const previews = useMemo(() => {
    const map: Record<string, ItemInstance> = {};
    for (const l of inStock) { const it = itemFromTrappingById(l.id); if (it) map[l.id] = it; }
    return map;
  }, [inStock.map((l) => l.id).join('|')]);

  // Bloc de comparaison d'un héros (info : la neuve vs l'équipement actuel). Pas de bouton d'équipement (cart).
  const heroCompareBlock = (item: ItemInstance, h: Combatant) => {
    const cmp = compareEquip(item, h);
    return (
      <div className="mc-hero" key={h.id}>
        <div className="mc-hero-head" title={h.label}>
          <TeamPortrait combatant={h} size={24} />
          <span className="mc-cur">{cmp.currentName ? `actuel : ${cmp.currentName}` : 'rien d’équipé'}</span>
        </div>
        {cmp.rows.length > 0 && (
          <table className="mc-table">
            <tbody>
              {cmp.rows.map((r) => (
                <tr key={r.label} className={TREND_CLASS[r.trend]}>
                  <th>{r.label}</th>
                  <td className="mc-old">{r.current}</td>
                  <td className="mc-arrow">→</td>
                  <td className="mc-new">{r.next} <span className="mc-trend">{TREND_SYM[r.trend]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  // Fiche de détail (clic sur le nom) : INFORMATIVE — Atouts/Défauts + description + comparaison.
  const renderDetailCard = (item: ItemInstance) => {
    // Qualités : NOM = chip canonique (`EntityRef`, popover Codex → type Atout/Défaut + source) ;
    // la description d'achat reste sous le chip. Atouts d'abord, Défauts ensuite.
    const quals = resolveQualities(item)
      .map((r): QualityInstance => ({ id: r.id, ...(r.indice != null ? { value: r.indice } : {}) }))
      .flatMap((q) => { const info = describeQuality(q); return info ? [{ q, info }] : []; })
      .sort((a, b) => (a.info.polarite === 'defaut' ? 1 : 0) - (b.info.polarite === 'defaut' ? 1 : 0));
    const canCompare = item.kind === 'melee' || item.kind === 'ranged' || item.kind === 'armor';
    return (
      <div className="merch-compare preview" role="region" aria-label={`Détails ${item.label}`}>
        <div className="mc-head">
          <strong>{item.label}</strong>
          <button className="btn small" onClick={() => setDetails(null)}>Fermer</button>
        </div>
        {quals.length > 0 && (
          <div className="mc-quals">
            {quals.map(({ q, info }) => (
              <div className="mc-qual" key={q.id}>
                <QualityChip quality={q} />
                {info.desc && <span className="q-desc">{mdToText(info.desc)}</span>}
              </div>
            ))}
          </div>
        )}
        {item.desc && <div className="mc-desc"><Prose md={item.desc} /></div>}
        {canCompare && party.map((h) => heroCompareBlock(item, h))}
      </div>
    );
  };

  // Contrôle de Marchandage du panier (clair : ce qu'il fait + son effet).
  const buyHaggleControl = () => {
    if (merchant.soured) return <span className="bargain-tag soured" title="Le marchand se méfie de votre monnaie"><Icon id="ui/forbidden" size="sm" /> Marchand méfiant — fini de marchander</span>;
    if (merchant.bargainLocked) return <span className="bargain-tag locked" title="Vous avez déjà négocié puis quitté sans conclure ; revenez après son réassort"><Icon id="ui/lock" size="sm" /> Marchandage indisponible jusqu’au réassort</span>;
    if (merchant.bargainBuy == null) return (
      <>
        <button className="btn small" onClick={() => onBargain('buy')}><Icon id="merchant/haggle" size="sm" /> Marchander le panier</button>
        <CodexRef category="skills" id="marchandage" label="Marchandage" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
      </>
    );
    return merchant.bargainBuy.won
      ? <span className="bargain-tag won">✔ Prix réduits de {buyDiscount} %</span>
      : <span className="bargain-tag">✘ Marchandage raté — prix plein</span>;
  };

  // --- Vue : Répartition (après paiement) ---
  const renderDistribution = () => (
    <div className="merch-tab">
      <div className="dist-head"><strong>Répartition</strong> — qui récupère / possède quoi ?</div>
      <div className="dist-list">
        {(dist ?? []).map((d, i) => (
          <div className="dist-row" key={i}>
            <span className="merch-name">
              {'item' in d ? d.item.label : (catalogEntryOf(d.unit.id)?.label ?? d.unit.id)}
              {'unit' in d && <span className="hint"> (monture/véhicule)</span>}
            </span>
            <Row gap="sm" align="start">
              {party.map((h) => (
                <CharFrame key={h.id} c={h} variant="identity" size="xs" selected={d.heroId === h.id} onClick={() => onAssignDist(i, h.id)} />
              ))}
            </Row>
          </div>
        ))}
      </div>
      <div className="cart-actions">
        <button className="btn btn-primary" onClick={() => { onConfirmDist(); setBuyView('browse'); }}>Confirmer la répartition</button>
      </div>
    </div>
  );

  // --- Vue : Panier ---
  const renderCart = () => (
    <div className="merch-tab">
      <div className="cart-head">
        <GatedAction
          id="merch-cart-back"
          label="← Continuer les achats"
          enabled={!sealed}
          reason="Marché négocié : réglez ou refusez le marché."
          onClick={() => setBuyView('browse')}
          primary={false}
          btnClassName="small"
        />
        <strong><Icon id="merchant/cart" size="sm" /> Panier</strong>
      </div>
      {!cart.length ? (
        <p className="empty">— panier vide —</p>
      ) : (
        <>
          <table className="cart-table">
            <tbody>
              {cart.map((c) => {
                const u = lineCost(c.id, buyFactor);
                const sub = u ? fromBrass(toBrass(u) * c.qty) : null;
                const stockQty = merchant.stock.find((l) => l.id === c.id)?.qty ?? 0;
                return (
                  <tr key={c.id}>
                    <td className="cart-name">{labelOf(c.id)}</td>
                    <td>
                      <QtyStepper
                        center={c.qty}
                        onDec={() => onDecCart(c.id)}
                        onInc={() => onAddToCart(c.id)}
                        incDisabled={c.qty >= stockQty}
                        refus={{ id: `panier-${c.id}`, inc: sealed ? 'Marché négocié — vous ne pouvez plus ajouter' : undefined }}
                        decLabel="Un de moins"
                        incLabel="Un de plus"
                      />
                    </td>
                    <td className="cart-unit">{u ? <Coins money={u} /> : '—'}</td>
                    <td className="cart-sub">{sub ? <Coins money={sub} /> : '—'}</td>
                    <td className="cart-rm"><button className="btn-step" onClick={() => onRemoveCart(c.id)} aria-label="Retirer">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="cart-haggle">{buyHaggleControl()}</div>
          {sealed && (
            <p className="cart-sealed" title="Refuser ou partir sans payer : le marchand ne marchandera plus avant son réassort."><Icon id="merchant/deal" size="sm" /> Prix arrêté — vous pouvez retirer des articles, puis régler ou refuser.</p>
          )}
          <div className="cart-total">Total : <strong><Coins money={cartTotal} /></strong>{buyDiscount > 0 && <span className="cart-disc"> (marchandé −{buyDiscount} %)</span>}</div>
          <div className="cart-actions">
            {sealed
              ? <button className="btn small danger" onClick={() => { onRefuse('buy'); setBuyView('browse'); }}>Refuser le marché</button>
              : <button className="btn small" onClick={onClearCart}>Vider le panier</button>}
            <GatedAction
              id="merch-cart-pay"
              label={<>Payer <Coins money={cartTotal} /></>}
              ariaLabel="Payer le panier"
              enabled={affordCart}
              reason="Bourse insuffisante."
              onClick={onPay}
            />
          </div>
          {!affordCart && <p className="cart-warn">Bourse insuffisante (<Coins money={money} />).</p>}
        </>
      )}
    </div>
  );

  // --- Vue : Parcourir ---
  const renderBrowse = () => {
    const cats = FAMILIES.filter((f) => byFamily[f.key]?.length);
    const activeCat = (buyCat && byFamily[buyCat]?.length ? buyCat : cats[0]?.key) ?? '';
    const rows = byFamily[activeCat] ?? [];
    return (
      <div className="merch-tab">
        <div className="cart-bar">
          {cartCount > 0
            ? <><span className="cart-info"><Icon id="merchant/cart" size="sm" /> {cartCount} article{cartCount > 1 ? 's' : ''} · <Coins money={cartTotal} /></span><button className="btn small btn-primary" onClick={() => setBuyView('cart')}>Voir le panier →</button></>
            : <span className="cart-info empty"><Icon id="merchant/cart" size="sm" /> Panier vide</span>}
          {onSearchAvailability && (
            <>
              <button className="btn small" onClick={onSearchAvailability}>
                <Icon id="ui/search" size="sm" /> Chercher activement (1 journée)
              </button>
              <CodexRef category="regles" id="ragot-au-marche" label="Ragot au marché (bonus de Disponibilité)" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </>
          )}
        </div>
        {!cats.length ? (
          <p className="empty">— rien en stock —</p>
        ) : (
          <>
            <Tabs
              tabs={cats.map((fam) => ({ key: fam.key, label: fam.label, count: byFamily[fam.key].length }))}
              active={activeCat}
              onChange={setBuyCat}
            />
            {(() => {
              const cols = FAMILY_COLS[activeCat] ?? [];
              const isUnitCat = activeCat === 'unites';
              const groups: TradeGroup<{ id: string; qty: number }>[] = [];
              for (const l of rows) {
                // Unités (#619 Lot A) : groupées par NATURE (montures/véhicules), pas par `subType` de
                // trapping (toujours absent d'une ligne unité — `catalogEntryOf`).
                const g = isUnitCat
                  ? (catalogEntryOf(l.id)?.unit?.nature === 'bete' ? 'montures' : 'vehicules')
                  : (findTrappingById(l.id)?.subType ?? 'autres');
                let bucket = groups.find((x) => x.key === g);
                if (!bucket) {
                  const label = isUnitCat ? (g === 'montures' ? 'Montures' : 'Véhicules') : (weaponGroupLabel(g) || 'Autres');
                  bucket = { key: g, label, rows: [] };
                  groups.push(bucket);
                }
                bucket.rows.push(l);
              }
              groups.sort((a, b) => String(a.label).localeCompare(String(b.label)));
              const tradeCols: TradeColumn<{ id: string; qty: number }>[] = cols.map((c) => ({
                key: c.label,
                label: c.label,
                emph: c.emph,
                render: (l) => c.get(l.id),
              }));
              return (
                <TradeTable
                  className="merch-table"
                  columns={tradeCols}
                  groups={groups}
                  rowKey={(l) => l.id}
                  label={(l) => (
                    isUnitCat ? (
                      // Unité (#619 Lot A) : aucune fiche de détail à déplier (pas d'`ItemInstance` de
                      // trapping) — un chevron sans contenu serait une affordance morte.
                      <span className="merch-name">
                        {labelOf(l.id)}
                        <span className="merch-qty" title="En stock">×{l.qty}</span>
                      </span>
                    ) : (
                      <button className="merch-name as-link" onClick={() => toggleDetails(l.id)} aria-expanded={details === l.id} title="Voir les détails de l’objet">
                        {labelOf(l.id)}
                        <span className="merch-qty" title="En stock">×{l.qty}</span>
                      </button>
                    )
                  )}
                  enc={isUnitCat ? undefined : (l) => findTrappingById(l.id)?.enc ?? 0}
                  price={(l) => lineCost(l.id, buyFactor)}
                  disabled={(l) => { const unit = lineCost(l.id, buyFactor); return unit ? !canAfford(money, unit) : true; }}
                  open={(l) => details === l.id}
                  detail={(l) => (previews[l.id] ? renderDetailCard(previews[l.id]) : null)}
                  action={(l) => {
                    const unit = lineCost(l.id, buyFactor);
                    const canAffordOne = unit ? canAfford(money, unit) : false;
                    const inCart = cartQtyOf(l.id);
                    return inCart > 0 ? (
                      <QtyStepper
                        center={inCart}
                        onDec={() => onDecCart(l.id)}
                        onInc={() => onAddToCart(l.id)}
                        incDisabled={sealed || inCart >= l.qty || !canAffordOne}
                        decLabel="Un de moins"
                        incLabel="Un de plus"
                      />
                    ) : (
                      <GatedAction
                        id={`merch-add-${l.id}`}
                        label="+ Ajouter"
                        ariaLabel={`Ajouter ${labelOf(l.id)} au panier`}
                        enabled={!sealed && canAffordOne}
                        reason={sealed ? 'Marché conclu — panier figé.' : 'Bourse insuffisante.'}
                        onClick={() => onAddToCart(l.id)}
                        primary={false}
                        btnClassName="small"
                      />
                    );
                  }}
                />
              );
            })()}
          </>
        )}
      </div>
    );
  };

  // --- Vente : Parcourir (un onglet par PJ) — bouton « + Vendre » qui pousse au panier de vente ---
  const renderSellBrowse = () => {
    const sellHeroes = party.filter((h) => (h.items ?? []).length > 0);
    if (!sellHeroes.length) return <p className="empty">— rien à vendre —</p>;
    const activeSellId = (sellHero && sellHeroes.some((h) => h.id === sellHero) ? sellHero : sellHeroes[0]?.id) ?? '';
    const sellHeroObj = party.find((h) => h.id === activeSellId);
    const heroItems = sellHeroObj?.items ?? [];
    // « équipé » = armure portée (`equipped`) OU arme tenue dans le set actif (loadout), jamais un flag d'arme.
    const isEquippedForSell = (it: ItemInstance) =>
      it.kind === 'melee' || it.kind === 'ranged' ? !!sellHeroObj && isWeaponActive(sellHeroObj, it.uid) : !!it.equipped;
    return (
      <>
        <div className="cart-bar">
          {sellCart.length > 0
            ? <><span className="cart-info"><Icon id="merchant/cart" size="sm" /> {sellCart.length} à vendre · +<Coins money={sellCartTotal} /></span><button className="btn small btn-primary" onClick={() => setSellView('cart')}>Voir le panier →</button></>
            : <span className="cart-info empty"><Icon id="merchant/cart" size="sm" /> Rien à vendre sélectionné</span>}
        </div>
        <Tabs
          tabs={sellHeroes.map((h) => ({ key: h.id, label: <span title={h.label}><TeamPortrait combatant={h} size={24} /></span>, count: (h.items ?? []).length }))}
          active={activeSellId}
          onChange={setSellHero}
        />
        {heroItems.map((it) => {
          // Hors du commerce ordinaire (aucune Disponibilité au catalogue, LDB 59 l.15) : le refus est
          // VISIBLE et porte sa raison (`GatedAction`), jamais un bouton muet ni un prix fantôme.
          const refused = sellRefusal(it);
          return (
          <div className="merch-row sell" key={it.uid}>
            <span className="merch-name">
              {it.label}
              {isEquippedForSell(it) && <span className="equipped-tag" title="Actuellement équipé">✓ équipé</span>}
              {it.identified === false ? ' (non identifié)' : ''}
            </span>
            {!refused && <span className="merch-price"><Coins money={sellPriceMoney(it)} /></span>}
            {/* « Baisse des prix » (LDB 59 l.60) : brader (÷2) monte la Disponibilité d'un acheteur d'un
                cran. Montré pour les biens qu'un acheteur commun ne prend pas d'emblée (Limitée+). */}
            {!refused && onSellHalving && (() => {
              const h = merchant.sellHalvings?.[it.uid] ?? 0;
              const av = sellBuyerAvailability(it, 0);
              if ((av === 'Commune' || av === null) && h === 0) return null;
              return (
                <span className="sell-haggle" title="Baisser le prix de moitié augmente la Disponibilité d'un acheteur d'un cran">
                  <QtyStepper
                    center={<span className="sell-av">acheteur {sellBuyerAvailability(it, h)}{h > 0 ? ` (÷${2 ** h})` : ''}</span>}
                    onDec={() => onSellHalving(it.uid, -1)}
                    onInc={() => onSellHalving(it.uid, 1)}
                    decDisabled={h <= 0}
                    incDisabled={h >= 4}
                    decLabel="Prix plein"
                    incLabel="Brader de moitié"
                    incTitle="Diviser le prix par deux"
                    incContent="÷2"
                  />
                </span>
              );
            })()}
            {it.identified === false && (
              <button className="btn small" onClick={() => onAppraise(it.uid, activeSellId)} title="Test d'Évaluation : révèle les qualités cachées">Évaluer</button>
            )}
            {refused
              ? <GatedAction id={`sell-${it.uid}`} label="+ Vendre" enabled={false} reason={refused} onClick={() => {}} primary={false} btnClassName="small" />
              : sellInCart(it.uid)
                ? <button className="btn small" onClick={() => onRemoveSellCart(it.uid)} title="Retirer du panier de vente">✓ au panier</button>
                : <button className="btn small" onClick={() => onAddToSellCart(it.uid, activeSellId)} title="Ajouter au panier de vente">+ Vendre</button>}
          </div>
          );
        })}
        {!heroItems.length && <p className="empty">— rien à vendre pour ce personnage —</p>}
      </>
    );
  };

  // --- Vente : Panier (parité achat — mêmes briques cart-*) ---
  const renderSellCart = () => (
    <>
      <div className="cart-head">
        <button className="btn small" onClick={() => setSellView('browse')}>← Continuer</button>
        <strong><Icon id="merchant/cart" size="sm" /> Vente</strong>
      </div>
      {!sellCartItems.length ? (
        <p className="empty">— panier de vente vide —</p>
      ) : (
        <>
          <table className="cart-table">
            <tbody>
              {sellCartItems.map(({ hero, it }) => (
                <tr key={it.uid}>
                  <td className="cart-name">{it.label}<span className="cart-owner" title={hero.label}><TeamPortrait combatant={hero} size={18} /></span></td>
                  <td className="cart-sub"><Coins money={sellPriceMoney(it)} /></td>
                  <td className="cart-rm"><button className="btn-step" onClick={() => onRemoveSellCart(it.uid)} aria-label="Retirer">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cart-total">Total : <strong>+<Coins money={sellCartTotal} /></strong></div>
          <div className="cart-actions">
            <button className="btn small" onClick={onClearSellCart}>Vider</button>
            <button className="btn btn-primary" onClick={() => { onConfirmSell(); setSellView('browse'); }}>Vendre <Coins money={sellCartTotal} /></button>
          </div>
        </>
      )}
    </>
  );

  // --- Troc (LDB 59 l.64-76) : céder N exemplaires d'un bien contre M du stock, sans argent ---
  const renderBarter = () => {
    if (!onBarter) return null;
    // Biens cédables : par (héros, trapping) non équipé et à prix chiffré, avec le nombre en stock.
    const giveOpts: { key: string; heroId: string; trappingId: string; label: string; count: number }[] = [];
    for (const h of party) {
      const byTrap = new Map<string, number>();
      for (const it of h.items ?? []) if (it.trappingId && !it.equipped) byTrap.set(it.trappingId, (byTrap.get(it.trappingId) ?? 0) + 1);
      for (const [tid, count] of byTrap) {
        const t = findTrappingById(tid);
        if (t && toBrass(priceToMoney(t.price)) > 0) giveOpts.push({ key: `${h.id}|${tid}`, heroId: h.id, trappingId: tid, label: `${t.label} ×${count} (${h.label})`, count });
      }
    }
    const getOpts = inStock.map((l) => ({ id: l.id, label: `${labelOf(l.id)} ×${l.qty}` }));
    const give = giveOpts.find((o) => o.key === barterGive) ?? giveOpts[0];
    const getId = getOpts.find((o) => o.id === barterGetId)?.id ?? getOpts[0]?.id ?? '';
    const count = Math.max(1, barterCount);
    const quote = give && getId ? barterQuote(give.trappingId, getId, count) : null;
    const getStockQty = inStock.find((l) => l.id === getId)?.qty ?? 0;
    const ok = !!quote && !!give && give.count >= quote.giveCount && getStockQty >= count;
    return (
      <div className="merch-tab tavern-block">
        <p className="tavern-detail">Échange sans argent : la Disponibilité des deux biens fixe le ratio.</p>
        {!giveOpts.length ? <p className="empty">— aucun bien chiffré à céder —</p> : (
          <>
            <label className="tavern-amount">Céder
              <select value={give?.key ?? ''} onChange={(e) => setBarterGive(e.target.value)}>
                {giveOpts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="tavern-amount">Acquérir
              <select value={getId} onChange={(e) => setBarterGetId(e.target.value)}>
                {getOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="tavern-amount">Quantité acquise
              <NumberField variant="nu" label="Quantité acquise" min={1} max={getStockQty || 1} value={count} onChange={setBarterCount} />
            </label>
            {quote && give && (
              <p className="tavern-detail">
                Ratio {quote.giveAv} <b>{quote.ratio.give}:{quote.ratio.get}</b> {quote.getAv} → céder <b>{quote.giveCount}</b> × {findTrappingById(give.trappingId)?.label} contre <b>{count}</b> × {labelOf(getId)}.
                {give.count < quote.giveCount && <span className="cart-warn"> Exemplaires insuffisants ({give.count}/{quote.giveCount}).</span>}
                {getStockQty < count && <span className="cart-warn"> Stock insuffisant.</span>}
              </p>
            )}
            <Row justify="end">
              <button className="btn btn-primary" disabled={!ok} onClick={() => give && onBarter({ giveHeroId: give.heroId, giveTrappingId: give.trappingId, getStockId: getId, getCount: count })}>Échanger</button>
            </Row>
          </>
        )}
      </div>
    );
  };

  return (
    <ScreenShell
      className="merchant-overlay"
      title={<><Icon id="resource/gold-purse" size="sm" /> Marchand</>}
      onClose={onClose}
      meta={{ money }}
      backdrop={merchant.backdrop}
    >
        {speakerName && (
          <SpeakerBanner ent={speakerEnt} label={speakerName} variant="boniment">{boniment}</SpeakerBanner>
        )}
        <Tabs
          className="mp-tabnav"
          tabs={[
            { key: 'buy' as const, label: 'Acheter', count: cartCount || undefined },
            { key: 'sell' as const, label: 'Vendre', count: sellable.length || undefined },
            { key: 'repair' as const, label: 'Réparer', count: damaged.length || undefined },
            ...(onBarter ? [{ key: 'barter' as const, label: 'Troc' }] : []),
          ]}
          active={tab}
          onChange={setTab}
        />

        <div className="merchant-body">
          {tab === 'buy' && (dist ? renderDistribution() : buyView === 'cart' ? renderCart() : renderBrowse())}

          {tab === 'sell' && (
            <div className="merch-tab">
              <div className="haggle-bar">
                {merchant.soured ? <span className="bargain-tag soured"><Icon id="ui/forbidden" size="sm" /> Marchand méfiant — fini de marchander</span>
                  : merchant.bargainLocked ? <span className="bargain-tag locked" title="Vous avez refusé/renié un marché ; revenez après son réassort"><Icon id="ui/lock" size="sm" /> Marchandage indisponible jusqu’au réassort</span>
                  : merchant.bargainSell == null ? (
                      <>
                        <button className="btn small" onClick={() => onBargain('sell')}><Icon id="merchant/haggle" size="sm" /> Marchander la vente</button>
                        <CodexRef category="skills" id="marchandage" label="Marchandage" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
                      </>
                    )
                  : <>
                      <span className={`bargain-tag ${merchant.bargainSell.won ? 'won' : ''}`}>{merchant.bargainSell.won ? '✔ Rachat à ½ du prix' : '✘ Rachat à ¼ du prix'}</span>
                      <button className="btn small danger" onClick={() => onRefuse('sell')} title="Décliner l’offre — le marchand ne marchandera plus (achat ni vente) jusqu’au réassort">Refuser l’offre</button>
                    </>}
              </div>
              {sellView === 'cart' ? renderSellCart() : renderSellBrowse()}
            </div>
          )}

          {tab === 'repair' && (
            <div className="merch-tab">
              {damaged.map(({ h, it }) => (
                <div className="merch-row repair" key={it.uid}>
                  <span className="merch-name" title={h.label}><TeamPortrait combatant={h} size={20} /> {it.label}</span>
                  <span className="merch-price"><Coins money={repairCost(it)} /></span>
                  <button className="btn small" onClick={() => onRepair(it.uid, h.id)}>Réparer</button>
                </div>
              ))}
              {!damaged.length && <p className="empty">— aucun objet à réparer —</p>}
            </div>
          )}

          {tab === 'barter' && renderBarter()}
        </div>
    </ScreenShell>
  );
}

/** Connecté au store. */
export function MerchantPanel() {
  const merchant = useGame((s) => s.merchant);
  const party = useGame((s) => s.party);
  const money = partyMoneyTotal(useGame.getState); // affichage : somme des bourses (réactif via l'abonnement à `party`)
  const scene = useGame((s) => s.scene);
  const addToCart = useGame((s) => s.addToCart);
  const decFromCart = useGame((s) => s.decFromCart);
  const removeFromCart = useGame((s) => s.removeFromCart);
  const clearCart = useGame((s) => s.clearCart);
  const refuseBargain = useGame((s) => s.refuseBargain);
  const payCart = useGame((s) => s.payCart);
  const assignDistribution = useGame((s) => s.assignDistribution);
  const confirmDistribution = useGame((s) => s.confirmDistribution);
  const addToSellCart = useGame((s) => s.addToSellCart);
  const removeFromSellCart = useGame((s) => s.removeFromSellCart);
  const clearSellCart = useGame((s) => s.clearSellCart);
  const confirmSell = useGame((s) => s.confirmSell);
  const repairItem = useGame((s) => s.repairItem);
  const startBargain = useGame((s) => s.startBargain);
  const appraiseItem = useGame((s) => s.appraiseItem);
  const closeMerchant = useGame((s) => s.closeMerchant);
  const setSellHalving = useGame((s) => s.setSellHalving);
  const barterExchange = useGame((s) => s.barterExchange);
  const searchAvailability = useGame((s) => s.searchAvailability);
  if (!merchant) return null;
  const speakerEnt = scene?.entities.find((e) => e.id === merchant.entityId);
  const arch = MERCHANTS[merchant.archetype];
  const speakerName = speakerEnt?.label ?? arch?.label;
  return (
    <MerchantPanelView
      merchant={merchant} party={party} money={money} speakerEnt={speakerEnt} speakerName={speakerName} boniment={arch?.boniment}
      onAddToCart={addToCart} onDecCart={decFromCart} onRemoveCart={removeFromCart} onClearCart={clearCart} onRefuse={refuseBargain} onPay={payCart}
      onAssignDist={assignDistribution} onConfirmDist={confirmDistribution}
      onAddToSellCart={addToSellCart} onRemoveSellCart={removeFromSellCart} onClearSellCart={clearSellCart} onConfirmSell={confirmSell}
      onRepair={repairItem} onBargain={startBargain} onAppraise={appraiseItem} onClose={closeMerchant}
      onSellHalving={setSellHalving} onBarter={barterExchange} onSearchAvailability={searchAvailability}
    />
  );
}
