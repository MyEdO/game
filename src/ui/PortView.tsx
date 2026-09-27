import { useMemo, useState } from 'react';
import { nomDuNavire } from '../state/carriers';
import { useGame } from '../state/store';
import { partyMoneyTotal } from '../state/bourseFlow';
import { findVehicleById, NAVAL_TRAITS, findNavalPortById, crewRoles, type NavalPortData } from '../data';
import { findCargoById, findCargoEntryById, type PortProfile } from '../engine/seaVoyage';
import { installCost } from '../engine/shipBuild';
import { shipHasNavalTrait, vesselNavalTraits } from '../engine/navalTraits';
import { foulingEffects } from '../engine/seaNavigation';
import { canAfford, toMoney, priceToMoney, formatMoney } from '../engine/money';
import { moraleBand } from '../engine/crewMorale';
import type { CampaignVessel } from '../state/store';
import type { PendingShoreLeave, PendingManannPriest } from '../state/seaVoyageFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { Prose } from './Prose';
import { Icon } from './Icon';
import { NotchGauge } from './NotchGauge';
import { moraleTone, ShipCrewWages } from './shipStatus';
import { ScreenShell } from './ScreenShell';
import { Tabs } from './Tabs';
import { TradeTable, type TradeGroup } from './TradeTable';
import { ShoreLeaveBody } from './ShoreLeaveModal';
import { ManannBody } from './ManannPriestModal';
import { GatedAction } from './GatedAction';
import { Grid, Split } from './Layout';

/** Raison UNIQUE du refus des gestes de port à un invité : l'hôte seul engage la bourse du groupe. */
const REFUS_INVITE = 'L’hôte seul engage les dépenses du groupe.';

/** Libellé d'une entrée de la colonne Production de l'Index — marchandise ou marqueur, même catalogue. */
const cargoLabel = (id: string): string => findCargoEntryById(id)?.label ?? id;
const indiceList = (rec: Record<string, number> | undefined): string =>
  Object.entries(rec ?? {}).map(([id, n]) => `${cargoLabel(id)}${n > 1 ? ` ×${n}` : ''}`).join(', ');

/** En-tête de l'escale-hub (#228) : région + 5 indices de l'Index des ports (MDG 15 l.439-506) + desc
 *  verbatim du catalogue `naval-ports.json` (si le lieu porte une `ref`). PUR (props). */
export function PortHeader({ pp, catalogue }: { pp: PortProfile; catalogue?: NavalPortData }) {
  return (
    <div className="port-head">
      {catalogue?.region && <p className="port-hint port-region">{catalogue.region}{pp.cosmopolite ? ' · port cosmopolite' : ''}</p>}
      <div className="port-indices">
        <span><b>Taille</b> {pp.taille}</span>
        <span><b>Richesse</b> {pp.richesse}</span>
        <span><b>Production</b> {pp.production.length ? pp.production.map(cargoLabel).join(', ') : '—'}</span>
        <span><b>Surplus</b> {indiceList(pp.surplus) || '—'}</span>
        <span><b>Demande</b> {indiceList(pp.demande) || '—'}</span>
      </div>
      {catalogue?.desc && <Prose md={catalogue.desc} porteur={{ type: 'navalPorts', id: catalogue.id, chemin: 'desc' }} />}
    </div>
  );
}

/** Onglet ESCALE (#228) — actions d'escale agrégées : événements d'escale en cours surfacés (Relâche à
 *  terre MDG 15 l.245 / Prêtre de Manann l.246 — le hub COMPOSE `ShoreLeaveBody`/`ManannBody`, déjà
 *  résolvants et branchés au store, aucune 2e prose de décision) et RECRUTEMENT salarié (MDG 14
 *  l.293-302, `crew-roles.json`, PUR sur ce volet — `onHire`/`onDismiss` en props). */
export function EscaleTab({ vessel, isGuest, pendingShoreLeave, pendingManannPriest, onHire, onDismiss }: {
  vessel: CampaignVessel; isGuest: boolean;
  pendingShoreLeave: PendingShoreLeave | null; pendingManannPriest: PendingManannPriest | null;
  onHire: (roleId: string) => void; onDismiss: (roleId: string) => void;
}) {
  const hireable = crewRoles.filter((r) => r.wage?.weekly);
  const countOf = (roleId: string) => vessel.crew?.find((h) => h.roleId === roleId)?.count ?? 0;
  const hasEvent = !!(pendingShoreLeave || pendingManannPriest);
  return (
    <Split aside="md" stackBelow={900} gap="xl" pad="xl" className="screen-scroll port-escale">
      <section className="panel port-section">
        <h3>Vie du port</h3>
        {!hasEvent && <p className="port-hint">Aucun événement d’escale en cours.</p>}
        <ShoreLeaveBody embedded />
        <ManannBody embedded />
      </section>
      <section className="panel port-section">
        <h3>Recruter de l’équipage</h3>
        <p className="port-hint">Embauche de marins salariés : la solde est prélevée à l’entretien hebdomadaire, aucune avance à l’embauche.</p>
        <Grid min="md" stackBelow={700}>
          {hireable.map((role) => {
            const n = countOf(role.id);
            return (
              <div key={role.id} className="port-upgrade">
                <div className="port-upgrade-head">
                  <b>{role.label}{n > 0 ? ` ×${n}` : ''}</b>
                  <span className="port-hint"><Coins money={priceToMoney(role.wage!.weekly)} />/sem.</span>
                </div>
                <div className="port-crew-actions">
                  <GatedAction
                    id={`port-hire-${role.id}`} label="Embaucher" ariaLabel={`Embaucher un ${role.label}`}
                    enabled={!isGuest} reason={REFUS_INVITE}
                    onClick={() => onHire(role.id)} primary={false} btnClassName="small"
                  />
                  <GatedAction
                    id={`port-dismiss-${role.id}`} label="Débarquer" ariaLabel={`Débarquer un ${role.label}`}
                    enabled={!isGuest && n > 0}
                    reason={isGuest ? REFUS_INVITE : `Aucun ${role.label} à bord.`}
                    onClick={() => onDismiss(role.id)} primary={false} btnClassName="small ghost"
                  />
                </div>
              </div>
            );
          })}
        </Grid>
        <ShipCrewWages vessel={vessel} />
        {!vessel.crew?.length && !vessel.wagesOwed && <p className="port-hint">Aucun équipage salarié pour l’instant.</p>}
      </section>
    </Split>
  );
}

/**
 * ESCALE-HUB (#228, MDG 15) — LE point d'entrée de port unifié : en-tête enrichi (`PortHeader` : nom du
 * port, ses 5 indices de l'Index des ports, la desc du catalogue `naval-ports.json` si le lieu porte une
 * `ref`), puis trois onglets. Chantier (Réparer MDG 13 l.643 / Caréner Salissures l.150-159 /
 * Améliorations MDG 12) · Cargaison (commerce maritime l.309-399) · Escale (`EscaleTab` : événements
 * d'escale en cours surfacés + recrutement salarié). Overlay plein écran (patron `WorldMapView`),
 * sections en `Split`/`Grid` (responsive ≤900/700/560), français, aucun texte tuto
 * (les `desc` sont du VERBATIM). `initialTab` : levier de test (rendu statique) ; défaut = Chantier.
 */
export function PortView({ initialTab = 'coque' }: { initialTab?: 'coque' | 'cargaison' | 'escale' } = {}) {
  const port = useGame((s) => s.port);
  const vessel = useGame((s) => s.vessel);
  const money = useGame((s) => partyMoneyTotal(() => s));
  const close = useGame((s) => s.closePort);
  const buy = useGame((s) => s.portBuyCargo);
  const sell = useGame((s) => s.portSellCargo);
  const dump = useGame((s) => s.portDumpCargo);
  const repair = useGame((s) => s.portRepair);
  const careen = useGame((s) => s.portCareen);
  const install = useGame((s) => s.portInstallUpgrade);
  const hire = useGame((s) => s.portHireCrew);
  const dismiss = useGame((s) => s.portDismissCrew);
  const pendingShoreLeave = useGame((s) => s.pendingShoreLeave);
  const pendingManannPriest = useGame((s) => s.pendingManannPriest);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const [tab, setTab] = useState<'coque' | 'cargaison' | 'escale'>(initialTab);
  const [buyEnc, setBuyEnc] = useState<Record<string, number>>({});

  const vd = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const upgrades = useMemo(() => {
    if (!vd?.ship) return [];
    const owned = new Set((vessel?.upgrades ?? []).map((u) => u.id));
    return NAVAL_TRAITS
      .filter((t) => t.kind === 'amelioration' && t.install && !owned.has(t.id))
      .map((t) => ({ def: t, cost: installCost(t.install!, vd.ship!.lengthM, 1) }))
      .filter((u) => u.cost.gold != null);
  }, [vessel?.upgrades, vd?.ship]);

  if (!port || !vessel || !vd?.ship) return null;
  const woundsMax = vessel.wounds?.max ?? vd.hull?.char.B ?? 0;
  const woundsCur = vessel.wounds?.current ?? woundsMax;
  const missing = woundsMax - woundsCur;
  const foulLevel = vessel.fouling?.level ?? 0;
  const traits = vesselNavalTraits(vessel);
  const lissage = shipHasNavalTrait(traits, 'lissage');
  const repairCost = Math.ceil(missing * (lissage ? 1.5 : 1));
  const careenPct = foulingEffects(foulLevel).repairPctOfBase;
  const careenCost = Math.ceil((vd.purchase?.price?.gold ?? 0) * (careenPct / 100));
  const cargo = vessel.cargo ?? [];
  const catalogue = port.ref ? findNavalPortById(port.ref) : undefined;
  const hasEscaleEvent = !!(pendingShoreLeave || pendingManannPriest);

  return (
    <ScreenShell
      className="port-overlay"
      title={<><Icon id="travel/anchor" size="sm" /> Port de {port.label} — {nomDuNavire(vessel)}</>}
      onClose={close}
      meta={{ money }}
      body="centered-wide"
    >
      <PortHeader pp={port.port} catalogue={catalogue} />
      <Tabs
        className="port-tabnav"
        tabs={[
          { key: 'coque' as const, label: <><Icon id="travel/repair" size="sm" /> Chantier</> },
          { key: 'cargaison' as const, label: <><Icon id="item/misc" size="sm" /> Cargaison</> },
          { key: 'escale' as const, label: <><Icon id="travel/anchor" size="sm" /> Escale{hasEscaleEvent ? ' •' : ''}</> },
        ]}
        active={tab}
        onChange={setTab}
      />

        {tab === 'coque' ? (
          <Split aside="md" stackBelow={900} gap="xl" pad="xl" className="screen-scroll port-yard">
            <section className="panel port-section">
              <h3>Coque &amp; entretien</h3>
              <p>Blessures : <b>{woundsCur}/{woundsMax}</b>{vessel.criticals?.length ? ` · ${vessel.criticals.length} Critique(s) noté(s)` : ''}</p>
              <GatedAction
                id="port-repair"
                label={<><Icon id="travel/repair" size="sm" /> Réparer{missing > 0 ? <> — {missing} Blessure(s), <Coins money={toMoney({ gold: repairCost })} /></> : null}</>}
                ariaLabel="Réparer la coque"
                enabled={!isGuest && (missing > 0 || !!vessel.criticals?.length)}
                reason={isGuest ? REFUS_INVITE : 'La coque est intacte.'}
                descOfferte={`1 CO par Blessure restaurée${lissage ? ' · +50 % coque lissée' : ''}`}
                onClick={repair}
                primary={false}
              />
              <NotchGauge
                label="Moral"
                value={vessel.morale.score}
                max={100}
                stacked
                tone={moraleTone}
                format={(v) => `${v} — ${moraleBand(v).label}`}
              />
              <ShipCrewWages vessel={vessel} />
              <p className="port-hint">Salissures : niveau <b>{foulLevel}</b>{vessel.crabs ? ' · crabes boxeurs' : ''}{foulLevel > 0 ? ` — ${foulingEffects(foulLevel).desc}` : ''}</p>
              <GatedAction
                id="port-careen"
                label={<><Icon id="travel/careen" size="sm" /> Caréner{careenCost > 0 ? <> — <Coins money={toMoney({ gold: careenCost })} /></> : null}</>}
                ariaLabel="Caréner la coque"
                enabled={!isGuest && (foulLevel > 0 || !!vessel.crabs)}
                reason={isGuest ? REFUS_INVITE : 'La coque est propre.'}
                descOfferte={`Cale sèche — ${careenPct} % du coût de base`}
                onClick={careen}
                primary={false}
              />
            </section>
            <section className="panel port-section">
              <h3>Améliorations</h3>
              {upgrades.length === 0 && <p className="port-hint">Toutes les Améliorations installables le sont déjà.</p>}
              <Grid min="md" stackBelow={700}>
                {upgrades.map(({ def, cost }) => (
                  <div key={def.id} className="port-upgrade">
                    <div className="port-upgrade-head">
                      <b>{def.label}</b>
                      <GatedAction
                        id={`port-upgrade-${def.id}`}
                        label={<>Installer — <Coins money={toMoney({ gold: cost.gold ?? 0 })} /></>}
                        ariaLabel={`Installer ${def.label}`}
                        enabled={!isGuest && canAfford(money, toMoney({ gold: cost.gold ?? 0 }))}
                        reason={isGuest ? REFUS_INVITE : `Bourse insuffisante (${formatMoney(toMoney({ gold: cost.gold ?? 0 }))}).`}
                        onClick={() => install(def.id, 1)}
                        primary={false}
                        btnClassName="small"
                      />
                    </div>
                    <Prose md={def.desc} porteur={{ type: 'navalTraits', id: def.id, chemin: 'desc' }} />
                  </div>
                ))}
              </Grid>
            </section>
          </Split>
        ) : tab === 'cargaison' ? (
          <Split aside="md" stackBelow={900} gap="xl" pad="xl" className="screen-scroll port-trade">
            <section className="panel port-section">
              <h3>Acheter — offres de l’escale</h3>
              <p className="port-hint">
                Cale libre : <b>{port.freeEnc} Enc</b>
                {port.maxLoadEnc > port.freeEnc && <> · surcharge possible jusqu’à <b>+{port.maxLoadEnc - port.freeEnc} Enc</b> (jusqu’à 150 %)</>}
              </p>
              {port.offers.length === 0 && <p className="port-hint">Aucune cargaison à vendre dans ce port (production « minimum vital » ou stock épuisé).</p>}
              {port.offers.length > 0 && (
                <TradeTable
                  columns={[]}
                  groups={[{ key: 'offers', rows: port.offers }] as TradeGroup<typeof port.offers[number]>[]}
                  rowKey={(o) => o.cargoId}
                  label={(o) => <>{o.label}{o.surplus ? ' (Surplus)' : ''}</>}
                  enc={(o) => o.enc}
                  encLabel="Dispo"
                  priceLabel="Prix/Enc"
                  price={(o) => toMoney({ gold: o.basePrice })}
                  disabled={(o) => {
                    const want = buyEnc[o.cargoId] ?? Math.min(o.enc, Math.max(port.freeEnc, 1));
                    const estCost = toMoney({ gold: Math.round(want * o.basePrice) });
                    return !canAfford(money, estCost) ? { reason: 'Bourse insuffisante' } : false;
                  }}
                  action={(o) => {
                    const want = buyEnc[o.cargoId] ?? Math.min(o.enc, Math.max(port.freeEnc, 1));
                    const estCost = toMoney({ gold: Math.round(want * o.basePrice) });
                    const affordable = canAfford(money, estCost);
                    const wouldOverload = want > port.freeEnc; // achat qui pousse en zone de surcharge (#243)
                    return (
                      <div className={`market-offer-buy ${affordable ? '' : 'unaffordable'}`}>
                        <NumberField
                          variant="nu" label={`Enc à embarquer — ${o.label}`}
                          min={1} max={Math.min(o.enc, port.maxLoadEnc)} value={want}
                          onChange={(n) => setBuyEnc((s) => ({ ...s, [o.cargoId]: n }))}
                        />
                        <span className="market-offer-total">≈ <Coins money={estCost} /></span>
                        <GatedAction
                          id={`port-buy-${o.cargoId}`}
                          label={wouldOverload ? 'Surcharger' : 'Acheter'}
                          enabled={!isGuest && port.maxLoadEnc > 0 && affordable}
                          reason={isGuest ? REFUS_INVITE : port.maxLoadEnc <= 0 ? 'La cale ne peut plus rien recevoir.' : 'Bourse insuffisante.'}
                          descOfferte={wouldOverload ? 'Embarquer en surcharge (pénalités d’assiette)' : 'Estimation avant Marchandage'}
                          onClick={() => buy(o.cargoId, want)}
                          primary={false}
                          btnClassName="small"
                        />
                      </div>
                    );
                  }}
                />
              )}
            </section>
            <section className="panel port-section">
              <h3>Vendre — cale du navire</h3>
              {cargo.length === 0 ? <p className="port-hint">La cale est vide.</p> : (
                <TradeTable
                  columns={[]}
                  groups={[{ key: 'cargo', rows: cargo.map((lot, i) => ({ lot, i })) }]}
                  rowKey={(r) => String(r.i)}
                  label={(r) => findCargoById(r.lot.cargoId)?.label ?? r.lot.cargoId}
                  enc={(r) => r.lot.enc}
                  priceLabel="Prix base/Enc"
                  price={(r) => toMoney({ gold: r.lot.basePriceGold })}
                  action={(r) => (
                    <div className="port-sell-actions">
                      <GatedAction
                        id={`port-sell-${r.i}`} label="Vendre" enabled={!isGuest} reason={REFUS_INVITE}
                        descOfferte="Trouver un acheteur puis marchander"
                        onClick={() => sell(r.i)} primary={false} btnClassName="small"
                      />
                      <GatedAction
                        id={`port-dump-${r.i}`} label="Brader" enabled={!isGuest} reason={REFUS_INVITE}
                        descOfferte="Brader à ¼ du prix de base"
                        onClick={() => dump(r.i)} primary={false} btnClassName="small ghost"
                      />
                    </div>
                  )}
                />
              )}
            </section>
          </Split>
        ) : (
          <EscaleTab
            vessel={vessel} isGuest={isGuest}
            pendingShoreLeave={pendingShoreLeave} pendingManannPriest={pendingManannPriest}
            onHire={(roleId) => hire(roleId, 1)} onDismiss={(roleId) => dismiss(roleId, 1)}
          />
        )}
    </ScreenShell>
  );
}
