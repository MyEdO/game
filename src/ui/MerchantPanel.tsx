import { useState, useMemo } from 'react';
import { useGame } from '../state/store';
import { findTrappingById, weaponGroupLabel, merchantFamilies, findMerchantArchetypeById } from '../data/index';
import type { Money } from '../engine/money';
import { isRepairable } from '../engine/repair';
import { Row } from './Layout';
import { verdictDeVente } from '../noyau/flowOutcomes';
import { compareEquip } from '../engine/equipCompare';
import { gabaritDObjet, isWeaponActive, type GabaritDObjet } from '../engine/items';
import { MERCHANT_COL_RENDERERS } from '../noyau/colonnesDuMarchand';
import { describeQuality } from '../engine/qualities/describe';
import { QualityChip } from './EntityChip';
import { libelleDeLaRepartition, sellGain, devisDeVente, sellBuyerAvailability, sellRefusal, catalogEntryOf, appraiseRefus, prixDeLigne, remiseDAchatPct, devisDuPanier, refusDAjout, coutDeReparation, refusDeReparation, optionsDeTroc, devisDeTroc, demandeDuTroc, exemplaireCede, BROUILLON_DE_TROC_VIDE, type ContexteDAchat, type ModeDeMarche } from '../noyau/merchantFlow';
import { GatedAction, raisonSi } from './GatedAction';
import { partyMoneyTotal, refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';
import type { Combatant, ItemInstance, QualityInstance } from '../engine/types';
import { resolveQualities } from '../engine/qualities/dispatch';
import type { SceneEntity } from '../noyau/monde/scene';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { Prose, mdToText } from './Prose';
import { CharFrame } from './CharFrame';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { ScreenShell } from './ScreenShell';
import { Tabs } from './composites/Tabs';
import { SpeakerBanner } from './SpeakerBanner';
import { TradeTable, type TradeColumn, type TradeGroup } from './TradeTable';
import { QtyStepper } from './QtyStepper';
import { familleDeLArticle, rangDeRarete } from '../noyau/marchandEnVue';
import { nomDEntite } from '../noyau/monde/sceneNpc';
import { presetPnjById } from '../state/campaignData';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { availabilitySchema } from '../data/schemas/grammaire/valeurs';
import { VOCABULAIRES } from '../data/schemas/grammaire/vocabulaires';

type MerchantState = NonNullable<ReturnType<typeof useGame.getState>['merchant']>;



/** 7 familles de présentation du stock (`merchantFamilies.json`, ordre d'affichage = ordre du fichier).
 *  `unites` (#619 Lot A) = véhicules/créatures-montures d'archétype (`MerchantArchetypeDef.unitKinds`)
 *  — jamais des trappings. */
const FAMILIES: { key: string; label: string }[] = merchantFamilies.map((f) => ({ key: f.id, label: f.label }));
const FAMILY_COLS: Record<string, { label: string; get: (id: string) => string; emph?: boolean }[]> = Object.fromEntries(
  merchantFamilies.map((f) => [f.id, f.columns.map((c, i) => ({ label: VOCABULAIRES.colonnesDuMarchand[c], get: MERCHANT_COL_RENDERERS[c].get, emph: i === 0 ? true : undefined }))]),
);

const TREND_CLASS: Record<string, string> = { up: 'cmp-up', down: 'cmp-down', same: '' };
const TREND_SYM: Record<string, string> = { up: '▲', down: '▼', same: '' };

/** Les onglets de l'échoppe : les deux côtés du marché, la réparation, le troc. */
type OngletDuMarchand = ModeDeMarche | 'reparation' | 'troc';

/** Présentationnel (props) — testable hors store. `initialTab`/`initialDetails`/`initialBuyView` = état de départ (SSR/test). */
export function MerchantPanelView({ merchant, party, money, speakerEnt, speakerName, boniment, onAddToCart, onDecCart, onRemoveCart, onClearCart, onRefuse, onPay, onAssignDist, onConfirmDist, onAddToSellCart, onRemoveSellCart, onClearSellCart, onConfirmSell, onRepair, onBargain, onAppraise, onClose, onSellHalving, troc, onSearchAvailability, refusHote = null, initialTab, initialDetails, initialBuyView, initialSellView }: {
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
  onRefuse: (mode: ModeDeMarche) => void;
  onPay: () => void;
  onAssignDist: (uid: string, heroId: string) => void;
  onConfirmDist: () => void;
  onAddToSellCart: (uid: string) => void;
  onRemoveSellCart: (uid: string) => void;
  onClearSellCart: () => void;
  onConfirmSell: () => void;
  onRepair: (uid: string) => void;
  onBargain: (mode: ModeDeMarche) => void;
  onAppraise: (uid: string) => void;
  onClose: () => void;
  /** « Baisse des prix » à la vente (LDB 59 l.60) — optionnel (rendu sans si absent). */
  onSellHalving?: (uid: string, delta: number) => void;
  /** Troc (LDB 59 l.64-76), composé dans l'état de l'échoppe (`merchant.troc`) — optionnel : l'onglet Troc
   *  n'apparaît que s'il est fourni. */
  troc?: { ceder: (uid: string) => void; recevoir: (id: string) => void; quantite: (n: number) => void; troquer: () => void };
  /** Recherche active de Disponibilité (LDB 59 l.50) — optionnel : le bouton n'apparaît que s'il est fourni. */
  onSearchAvailability?: () => void;
  initialTab?: OngletDuMarchand;
  initialDetails?: string;
  initialBuyView?: 'browse' | 'cart';
  initialSellView?: 'browse' | 'cart';
  /** Refus de dépense du groupe du siège (`refusDeGesteSurLeGroupe`) — absent hors store : aucun. */
  refusHote?: string | null;
}) {
  const [tab, setTab] = useState<OngletDuMarchand>(initialTab ?? 'achat');
  const [buyCat, setBuyCat] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(initialDetails ?? null);
  const [buyView, setBuyView] = useState<'browse' | 'cart'>(initialBuyView ?? 'browse');
  const [sellView, setSellView] = useState<'browse' | 'cart'>(initialSellView ?? 'browse');
  const [sellHero, setSellHero] = useState<string | null>(null); // onglet PJ actif côté Vente
  const toggleDetails = (label: string) => setDetails((d) => (d === label ? null : label));

  const damaged = party.flatMap((h) => (h.items ?? []).filter((it) => isRepairable(it)).map((it) => ({ h, it })));
  const sellable = party.flatMap((h) => (h.items ?? []).map((it) => ({ h, it })));

  // Prix, total et verdicts d'achat : rendus par le noyau (`prixDeLigne`, `devisDuPanier`, `refusDAjout`).
  const prix = (id: string) => prixDeLigne(merchant, id, speakerEnt, party);
  const achat: ContexteDAchat = { ent: speakerEnt, party, bourse: money, refusHote };
  const refusAjout = (id: string) => refusDAjout(merchant, id, achat);
  const buyDiscount = remiseDAchatPct(merchant);
  const sellPriceMoney = (it: ItemInstance): Money => sellGain(it, merchant); // prix de vente = source unique (engine)
  // Panier de VENTE (#22b) : instances résolues chez leur porteur + total (mêmes briques que l'achat).
  const sellCart = merchant.sellCart ?? [];
  const sellInCart = (uid: string) => sellCart.some((c) => c.uid === uid);
  const devisVente = devisDeVente(merchant, party);
  const sellCartItems = devisVente.lignes;
  const sellCartTotal = devisVente.total;

  // Stock groupé par famille puis trié (Disponibilité → nom). Lignes keyées par `trappingId` OU par
  // id d'unité (`catalogEntryOf`, #619 Lot A).
  const labelOf = (id: string) => catalogEntryOf(id)?.label ?? id;
  const inStock = merchant.stock.filter((l) => l.qty > 0);
  const byFamily: Record<string, { id: string; qty: number }[]> = {};
  for (const l of inStock) (byFamily[familleDeLArticle(l.id)] ??= []).push(l);
  for (const k of Object.keys(byFamily)) byFamily[k].sort((a, b) => rangDeRarete(a.id) - rangDeRarete(b.id) || labelOf(a.id).localeCompare(labelOf(b.id)));

  const cart = merchant.cart ?? [];
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const devis = devisDuPanier(merchant, achat);
  const cartTotal = devis.total;
  const sealed = merchant.bargainBuy != null; // a négocié : prix figé, on peut RETIRER mais pas ajouter ni renégocier
  const cartQtyOf = (id: string) => cart.find((c) => c.id === id)?.qty ?? 0;
  const dist = merchant.pendingDistribution ?? null;

  const previews = useMemo(() => {
    const map: Record<string, GabaritDObjet> = {};
    for (const l of inStock) { const it = gabaritDObjet(l.id); if (it) map[l.id] = it; }
    return map;
  }, [inStock.map((l) => l.id).join('|')]);

  // Bloc de comparaison d'un héros (info : la neuve vs l'équipement actuel). Pas de bouton d'équipement (cart).
  const heroCompareBlock = (item: GabaritDObjet, h: Combatant) => {
    const cmp = compareEquip(item, h);
    return (
      <div className="mc-hero" key={h.id}>
        <div className="mc-hero-head">
          <span>{h.label}</span>
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
  const renderDetailCard = (item: GabaritDObjet) => {
    // Qualités : NOM = chip canonique (`EntityRef`, popover Codex → type Atout/Défaut + source) ;
    // la description d'achat reste sous le chip. Atouts d'abord, Défauts ensuite.
    const quals = resolveQualities(item)
      .map((r): QualityInstance => ({ id: r.id, ...(r.indice != null ? { value: r.indice } : {}) }))
      .flatMap((q) => { const info = describeQuality(q); return info ? [{ q, info }] : []; })
      .sort((a, b) => (a.info.polarite === 'defaut' ? 1 : 0) - (b.info.polarite === 'defaut' ? 1 : 0));
    const canCompare = item.kind === 'melee' || item.kind === 'distance' || item.kind === 'armor';
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
    if (merchant.soured) return <span className="bargain-tag soured" title="Le marchand se méfie de votre monnaie"><Icon id="interface/interdit" size="sm" /> Marchand méfiant — fini de marchander</span>;
    if (merchant.bargainLocked) return <span className="bargain-tag locked" title="Vous avez déjà négocié puis quitté sans conclure ; revenez après son réassort"><Icon id="interface/verrou" size="sm" /> Marchandage indisponible jusqu’au réassort</span>;
    if (merchant.bargainBuy == null) return (
      <>
        <button className="btn small" onClick={() => onBargain('achat')}><Icon id="marchand/marchander" size="sm" /> Marchander le panier</button>
        <CodexRef category="skills" id="marchandage" label="Marchandage" className="ab-codex-info"><Icon id="journal/information" size="sm" /></CodexRef>
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
              {libelleDeLaRepartition(d)}
              {'unit' in d && <span className="hint"> (monture/véhicule)</span>}
            </span>
            <Row gap="sm" align="start">
              {party.map((h) => (
                <CharFrame key={h.id} c={h} variant="identity" size="xs" selected={d.heroId === h.id} onClick={() => onAssignDist(d.uid, h.id)} />
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
        <strong><Icon id="marchand/panier" size="sm" /> Panier</strong>
      </div>
      {!cart.length ? (
        <p className="empty">— panier vide —</p>
      ) : (
        <>
          <table className="cart-table">
            <tbody>
              {devis.lignes.map((c) => {
                const u = c.unitaire;
                const sub = c.sousTotal;
                const refusPlus = refusAjout(c.id);
                return (
                  <tr key={c.id}>
                    <td className="cart-name">{labelOf(c.id)}</td>
                    <td>
                      <QtyStepper
                        center={c.qty}
                        onDec={() => onDecCart(c.id)}
                        onInc={() => onAddToCart(c.id)}
                        incDisabled={refusPlus != null}
                        refus={{ id: `panier-${c.id}`, inc: refusPlus ?? undefined }}
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
            <p className="cart-sealed" title="Refuser ou partir sans payer : le marchand ne marchandera plus avant son réassort."><Icon id="marchand/marche-conclu" size="sm" /> Prix arrêté — vous pouvez retirer des articles, puis régler ou refuser.</p>
          )}
          <div className="cart-total">Total : <strong><Coins money={cartTotal} /></strong>{buyDiscount > 0 && <span className="cart-disc"> (marchandé −{buyDiscount} %)</span>}</div>
          <div className="cart-actions">
            {sealed
              ? <button className="btn small danger" onClick={() => { onRefuse('achat'); setBuyView('browse'); }}>Refuser le marché</button>
              : <button className="btn small" onClick={onClearCart}>Vider le panier</button>}
            <GatedAction
              id="merch-cart-pay"
              label={<>Payer <Coins money={cartTotal} /></>}
              ariaLabel="Payer le panier"
              enabled={!devis.refus}
              {...raisonSi(devis.refus)}
              onClick={onPay}
            />
          </div>
          {devis.refus && <p className="cart-warn">{devis.refus} (<Coins money={money} />)</p>}
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
            ? <><span className="cart-info"><Icon id="marchand/panier" size="sm" /> {cartCount} article{cartCount > 1 ? 's' : ''} · <Coins money={cartTotal} /></span><button className="btn small btn-primary" onClick={() => setBuyView('cart')}>Voir le panier →</button></>
            : <span className="cart-info empty"><Icon id="marchand/panier" size="sm" /> Panier vide</span>}
          {onSearchAvailability && (
            <>
              <button className="btn small" onClick={onSearchAvailability}>
                <Icon id="interface/rechercher" size="sm" /> Chercher activement (1 journée)
              </button>
              <CodexRef category="regles" id="ragot-au-marche" label="Ragot au marché (bonus de Disponibilité)" className="ab-codex-info"><Icon id="journal/information" size="sm" /></CodexRef>
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
                  ? (catalogEntryOf(l.id)?.unit?.kind === 'bete' ? 'montures' : 'vehicules')
                  : (findTrappingById(l.id)?.subType?.id ?? 'autres');
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
                  price={(l) => prix(l.id)}
                  disabled={(l) => refusAjout(l.id) != null}
                  open={(l) => details === l.id}
                  detail={(l) => (previews[l.id] ? renderDetailCard(previews[l.id]) : null)}
                  action={(l) => {
                    const refusPlus = refusAjout(l.id);
                    const inCart = cartQtyOf(l.id);
                    return inCart > 0 ? (
                      <QtyStepper
                        center={inCart}
                        onDec={() => onDecCart(l.id)}
                        onInc={() => onAddToCart(l.id)}
                        incDisabled={refusPlus != null}
                        decLabel="Un de moins"
                        incLabel="Un de plus"
                      />
                    ) : (
                      <GatedAction
                        id={`merch-add-${l.id}`}
                        label="+ Ajouter"
                        ariaLabel={`Ajouter ${labelOf(l.id)} au panier`}
                        enabled={refusPlus == null}
                        {...raisonSi(refusPlus)}
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
    const refusEval = appraiseRefus(party);
    const heroItems = sellHeroObj?.items ?? [];
    // « équipé » = armure portée (`equipped`) OU arme tenue dans le set actif (loadout), jamais un flag d'arme.
    const isEquippedForSell = (it: ItemInstance) =>
      it.kind === 'melee' || it.kind === 'distance' ? !!sellHeroObj && isWeaponActive(sellHeroObj, it.uid) : !!it.equipped;
    return (
      <>
        <div className="cart-bar">
          {sellCart.length > 0
            ? <><span className="cart-info"><Icon id="marchand/panier" size="sm" /> {sellCart.length} à vendre · +<Coins money={sellCartTotal} /></span><button className="btn small btn-primary" onClick={() => setSellView('cart')}>Voir le panier →</button></>
            : <span className="cart-info empty"><Icon id="marchand/panier" size="sm" /> Rien à vendre sélectionné</span>}
        </div>
        <Tabs
          tabs={sellHeroes.map((h) => ({ key: h.id, label: h.label, count: (h.items ?? []).length }))}
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
              if ((av === 'commune' || av === null) && h === 0) return null;
              const avBradee = sellBuyerAvailability(it, h);
              return (
                <span className="sell-haggle" title="Baisser le prix de moitié augmente la Disponibilité d'un acheteur d'un cran">
                  <QtyStepper
                    center={<span className="sell-av">acheteur {avBradee && libelleDeValeur(availabilitySchema, avBradee)}{h > 0 ? ` (÷${2 ** h})` : ''}</span>}
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
              <GatedAction
                id={`sell-eval-${it.uid}`}
                label="Évaluer"
                enabled={!refusEval}
                {...raisonSi(refusEval)}
                descOfferte="Test d'Évaluation : révèle les qualités cachées"
                onClick={() => onAppraise(it.uid)}
                primary={false}
                btnClassName="small"
              />
            )}
            {refused
              ? <GatedAction id={`sell-${it.uid}`} label="+ Vendre" enabled={false} reason={refused} onClick={() => {}} primary={false} btnClassName="small" />
              : sellInCart(it.uid)
                ? <button className="btn small" onClick={() => onRemoveSellCart(it.uid)} title="Retirer du panier de vente">✓ au panier</button>
                : <button className="btn small" onClick={() => onAddToSellCart(it.uid)} title="Ajouter au panier de vente">+ Vendre</button>}
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
        <strong><Icon id="marchand/panier" size="sm" /> Vente</strong>
      </div>
      {!sellCartItems.length ? (
        <p className="empty">— panier de vente vide —</p>
      ) : (
        <>
          <table className="cart-table">
            <tbody>
              {sellCartItems.map(({ hero, it, gain, refus }) => (
                <tr key={it.uid}>
                  <td className="cart-name">{it.label}<span className="cart-owner">{hero.label}</span></td>
                  <td className="cart-sub">{refus ? <span className="cart-warn">{refus}</span> : <Coins money={gain} />}</td>
                  <td className="cart-rm"><button className="btn-step" onClick={() => onRemoveSellCart(it.uid)} aria-label="Retirer">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cart-total">Total : <strong>+<Coins money={sellCartTotal} /></strong></div>
          <div className="cart-actions">
            <button className="btn small" onClick={onClearSellCart}>Vider</button>
            <GatedAction
              id="merch-sell-confirm" label={<>Vendre <Coins money={sellCartTotal} /></>} ariaLabel="Vendre le panier"
              enabled={refusHote == null && devisVente.refus == null} {...raisonSi(refusHote ?? devisVente.refus)}
              onClick={() => { onConfirmSell(); setSellView('browse'); }}
            />
          </div>
        </>
      )}
    </>
  );

  // --- Troc (LDB 59 l.64-76) : céder N exemplaires d'un bien contre M du stock, sans argent ---
  const renderBarter = () => {
    if (!troc) return null;
    const brouillon = merchant.troc ?? BROUILLON_DE_TROC_VIDE;
    const giveOpts = optionsDeTroc(party).map((o) => {
      const hero = party.find((h) => h.id === o.heroId)!;
      return { ...o, uid: exemplaireCede(hero, o.trappingId), label: `${findTrappingById(o.trappingId)?.label ?? o.trappingId} ×${o.count} (${hero.label})` };
    });
    const getOpts = inStock.map((l) => ({ id: l.id, label: `${labelOf(l.id)} ×${l.qty}` }));
    const give = giveOpts.find((o) => o.heroId === brouillon.cede?.heroId && o.trappingId === brouillon.cede?.trappingId);
    const demande = demandeDuTroc(merchant);
    const devisTroc = demande ? devisDeTroc(merchant, party, demande) : null;
    const quote = devisTroc?.quote ?? null;
    const refusTroc = refusHote ?? (demande ? devisTroc!.refus : 'Choisissez le bien cédé et l’article acquis.');
    return (
      <div className="merch-tab tavern-block">
        <p className="tavern-detail">Échange sans argent : la Disponibilité des deux biens fixe le ratio.</p>
        {!giveOpts.length ? <p className="empty">— aucun bien chiffré à céder —</p> : (
          <>
            <label className="tavern-amount">Céder
              <select value={give?.uid ?? ''} onChange={(e) => troc.ceder(e.target.value)}>
                {!give && <option value="" disabled>— choisir —</option>}
                {giveOpts.map((o) => <option key={o.uid} value={o.uid} disabled={o.refus !== null} title={o.refus ?? undefined}>{o.label}</option>)}
              </select>
            </label>
            <label className="tavern-amount">Acquérir
              <select value={brouillon.recu ?? ''} onChange={(e) => troc.recevoir(e.target.value)}>
                {!brouillon.recu && <option value="" disabled>— choisir —</option>}
                {getOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="tavern-amount">Quantité acquise
              <NumberField variant="nu" label="Quantité acquise" min={1} max={devisTroc?.max ?? 1} value={brouillon.quantite} onChange={troc.quantite} />
            </label>
            {quote && give && demande && (
              <p className="tavern-detail">
                Ratio {quote.giveAv} <b>{quote.ratio.give}:{quote.ratio.get}</b> {quote.getAv} → céder <b>{quote.giveCount}</b> × {findTrappingById(give.trappingId)?.label} contre <b>{brouillon.quantite}</b> × {labelOf(demande.getStockId)}.
                {devisTroc?.refus && <span className="cart-warn"> {devisTroc.refus}</span>}
              </p>
            )}
            <Row justify="end">
              <GatedAction
                id="merch-barter" label="Échanger" ariaLabel="Échanger"
                enabled={refusTroc == null} {...raisonSi(refusTroc)}
                onClick={troc.troquer}
              />
            </Row>
          </>
        )}
      </div>
    );
  };

  return (
    <ScreenShell
      className="merchant-overlay"
      title={<><Icon id="ressource/bourse" size="sm" /> Marchand</>}
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
            { key: 'achat' as const, label: 'Acheter', count: cartCount || undefined },
            { key: 'vente' as const, label: 'Vendre', count: sellable.length || undefined },
            { key: 'reparation' as const, label: 'Réparer', count: damaged.length || undefined },
            ...(troc ? [{ key: 'troc' as const, label: 'Troc' }] : []),
          ]}
          active={tab}
          onChange={setTab}
        />

        <div className="merchant-body">
          {tab === 'achat' && (dist ? renderDistribution() : buyView === 'cart' ? renderCart() : renderBrowse())}

          {tab === 'vente' && (
            <div className="merch-tab">
              <div className="haggle-bar">
                {merchant.soured ? <span className="bargain-tag soured"><Icon id="interface/interdit" size="sm" /> Marchand méfiant — fini de marchander</span>
                  : merchant.bargainLocked ? <span className="bargain-tag locked" title="Vous avez refusé/renié un marché ; revenez après son réassort"><Icon id="interface/verrou" size="sm" /> Marchandage indisponible jusqu’au réassort</span>
                  : merchant.bargainSell == null ? (
                      <>
                        <button className="btn small" onClick={() => onBargain('vente')}><Icon id="marchand/marchander" size="sm" /> Marchander la vente</button>
                        <CodexRef category="skills" id="marchandage" label="Marchandage" className="ab-codex-info"><Icon id="journal/information" size="sm" /></CodexRef>
                      </>
                    )
                  : <>
                      <span className={`bargain-tag ${merchant.bargainSell.won ? 'won' : ''}`}>{merchant.bargainSell.won ? '✔' : '✘'} {verdictDeVente(merchant.bargainSell)}</span>
                      <button className="btn small danger" onClick={() => onRefuse('vente')} title="Décliner l’offre — le marchand ne marchandera plus (achat ni vente) jusqu’au réassort">Refuser l’offre</button>
                    </>}
              </div>
              {sellView === 'cart' ? renderSellCart() : renderSellBrowse()}
            </div>
          )}

          {tab === 'reparation' && (
            <div className="merch-tab">
              {damaged.map(({ h, it }) => (
                <div className="merch-row repair" key={it.uid}>
                  <span className="merch-name">{it.label} · {h.label}</span>
                  <span className="merch-price"><Coins money={coutDeReparation(it)} /></span>
                  <GatedAction
                    id={`merch-repair-${it.uid}`} label="Réparer" ariaLabel={`Réparer ${it.label}`}
                    enabled={refusDeReparation(h, it, refusHote) == null} {...raisonSi(refusDeReparation(h, it, refusHote))}
                    onClick={() => onRepair(it.uid)} primary={false} btnClassName="small"
                  />
                </div>
              ))}
              {!damaged.length && <p className="empty">— aucun objet à réparer —</p>}
            </div>
          )}

          {tab === 'troc' && renderBarter()}
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
  const refusHote = useGame(refusDeGesteSurLeGroupe);
  const choisir = useGame((s) => s.fenetreChoisir);
  const valider = useGame((s) => s.fenetreValider);
  const evaluerLObjet = useGame((s) => s.evaluerLObjet);
  const fermer = useGame((s) => s.fenetreFermer);
  const quitter = () => fermer('marchand');
  if (!merchant) return null;
  const speakerEnt = scene?.entities.find((e) => e.id === merchant.entityId);
  const arch = findMerchantArchetypeById(merchant.archetype);
  const speakerName = (speakerEnt && nomDEntite(speakerEnt, presetPnjById)) ?? arch?.label;
  return (
    <MerchantPanelView
      merchant={merchant} party={party} money={money} refusHote={refusHote} speakerEnt={speakerEnt} speakerName={speakerName} boniment={arch?.boniment}
      onAddToCart={(id) => choisir('marchand', 'ajouterAuPanier', id)} onDecCart={(id) => choisir('marchand', 'oterDuPanier', id)}
      onRemoveCart={(id) => choisir('marchand', 'retirerDuPanier', id)} onClearCart={() => choisir('marchand', 'viderLePanier', true)} onRefuse={(mode) => choisir('marchand', 'refuser', mode)} onPay={() => choisir('marchand', 'payer', true)}
      onAssignDist={(uid, heroId) => choisir('marchand', 'repartition', uid, heroId)} onConfirmDist={() => valider('marchand')}
      onAddToSellCart={(uid) => choisir('marchand', 'ajouterALaVente', uid)} onRemoveSellCart={(uid) => choisir('marchand', 'retirerDeLaVente', uid)}
      onClearSellCart={() => choisir('marchand', 'viderLaVente', true)} onConfirmSell={() => choisir('marchand', 'vendre', true)}
      onRepair={(uid) => choisir('marchand', 'reparer', uid)} onBargain={(mode) => choisir('marchand', 'marchander', mode)} onAppraise={evaluerLObjet} onClose={quitter}
      onSellHalving={(uid, delta) => choisir('marchand', delta > 0 ? 'baisserLePrix' : 'releverLePrix', uid)} troc={{
        ceder: (uid) => choisir('marchand', 'trocCeder', uid), recevoir: (id) => choisir('marchand', 'trocRecevoir', id),
        quantite: (n) => choisir('marchand', 'trocQuantite', n), troquer: () => choisir('marchand', 'troquer', true),
      }}
      onSearchAvailability={() => choisir('marchand', 'chercher', true)}
    />
  );
}
