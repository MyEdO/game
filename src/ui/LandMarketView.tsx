import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { findLandCargoById } from '../engine/landCargo';
import { bulkCarriers, bulkCargoRefs, primaryCargoCarrier, type CarrierStateSlice } from '../state/carriers';
import { carrierFreeEnc } from '../engine/cargo';
import { placeById } from '../state/worldMap';
import { canAfford, toMoney } from '../engine/money';
import { partyMoneyTotal } from '../state/bourseFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { ScreenShell } from './ScreenShell';
import { SpeakerBanner } from './SpeakerBanner';
import { CargoTransferPanel } from './CargoTransferPanel';
import { TradeTable, type TradeGroup } from './TradeTable';
import { GatedAction } from './GatedAction';
import { Grid, Row, spanFull } from './Layout';

/** Raison UNIQUE du refus des gestes de marché à un invité : l'hôte seul engage la bourse du groupe. */
const REFUS_INVITE = 'L’hôte seul engage les dépenses du groupe.';

/**
 * ÉCRAN MARCHÉ TERRESTRE (Mort sur le Reik Compagnon ch.11 « Règles du commerce ») — commerce de cargaison à
 * un Lieu `market` de la carte : acheter les offres de l'étape (disponibilité 2 temps + Marchandage + lot
 * partiel, plafonné à la Contenance du porteur, #327), vendre/brader la cargaison des porteurs, transférer
 * entre porteurs co-localisés. PENDANT terrestre de `PortView` (commerce maritime) : même overlay plein écran
 * (patron `WorldMapView`), sections Acheter/Vendre en `TradeTable` (#371 LOT 3, table marchande étalon),
 * transfert relégué en panneau secondaire replié (`CargoTransferPanel` → `.fold`), français, aucun tuto.
 * INCARNATION (#371) : bandeau d'hôte de halle (`SpeakerBanner` variant `boniment`, réplique en donnée
 * `landMarket.hostLine`) + bande d'ambiance (`ScreenShell` slot `backdrop`, `landMarket.backdrop`) — un
 * visage, une voix et un lieu, jamais un ERP. Corps borné/centré (`body='centered'`) : la halle respire.
 */
type Offer = { cargoId: string; label: string; enc: number; basePrice: number; wine?: boolean; wineTier?: string; wineEvalOk?: boolean };

export function LandMarketView() {
  const market = useGame((s) => s.landMarket);
  const party = useGame((s) => s.party);
  const vessel = useGame((s) => s.vessel);
  const worldMap = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const possessions = useGame((s) => s.possessions);
  const rumours = useGame((s) => s.tradeRumours);
  const close = useGame((s) => s.closeLandMarket);
  const buy = useGame((s) => s.landBuyCargo);
  const sell = useGame((s) => s.landSellCargo);
  const dump = useGame((s) => s.landDumpCargo);
  const move = useGame((s) => s.moveCargo);
  const evalWine = useGame((s) => s.landEvalWine);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const [buyEnc, setBuyEnc] = useState<Record<string, number>>({});
  // Bourse de groupe = somme des bourses personnelles (T-bourse #531) ; recalculée quand le groupe change.
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);

  const slice: CarrierStateSlice = useMemo(() => ({ party, vessel, worldMap, scene, possessions }), [party, vessel, worldMap, scene, possessions]);
  const carriers = useMemo(() => bulkCarriers(slice), [slice]);
  const refs = useMemo(() => bulkCargoRefs(slice), [slice]);
  const target = useMemo(() => primaryCargoCarrier(slice), [slice]);

  if (!market) return null;
  const cargoLabel = (id: string) => findLandCargoById(id)?.label ?? id;

  const offerGroups: TradeGroup<Offer>[] = [{ key: 'offers', rows: market.offers }];
  const sellGroups: TradeGroup<typeof refs[number]>[] = [{ key: 'refs', rows: refs }];

  return (
    <ScreenShell
      title={<>Marché de {market.label}</>}
      onClose={close}
      meta={{ money }}
      backdrop={market.backdrop}
      body="centered"
      tabs={<span className="market-carrier">Porteur : <b>{target ? `${target.label} — libre ${carrierFreeEnc(target)} / ${target.capacity} Enc` : 'aucun'}</b></span>}
    >
        <SpeakerBanner label="Le crieur de la halle" variant="boniment">{market.hostLine}</SpeakerBanner>
        {rumours.length > 0 && (
          <section className="panel port-section">
            <h3>Rumeurs de commerce</h3>
            <ul className="port-hint">
              {rumours.map((r, i) => {
                const here = r.placeId === market.placeId;
                const dest = worldMap ? placeById(worldMap, r.placeId)?.label ?? r.placeId : r.placeId;
                const biens = r.biens.map((id) => cargoLabel(id)).join(', ');
                return (
                  <li key={i}>
                    {biens} se vendent au double à <b>{dest}</b>{here ? ' — c’est ici : vendez ces biens.' : '.'}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <Grid min="md" stackBelow={700} className="port-trade">
          <section className="panel port-section">
            <h3>Acheter — offres de l’étape</h3>
            {!target && <p className="port-hint">Aucun porteur de charge : procurez-vous une bête de somme ou un véhicule pour transporter une cargaison.</p>}
            {market.offers.length === 0 && <p className="port-hint">Aucun marchand n’a de cargaison à céder ici.</p>}
            {market.offers.length > 0 && (
              <TradeTable
                columns={[]}
                groups={offerGroups}
                rowKey={(o) => o.cargoId}
                label={(o) => (
                  <Row as="span" className="trade-offer-name">
                    {/* `Row` : l'action « Évaluer » compose `GatedAction`, dont la boîte est un
                        BLOC dès qu'une raison l'accompagne. */}
                    {o.label}
                    {o.wine && (o.wineTier
                      ? <span className="port-hint"> — {o.wineTier}{o.wineEvalOk ? '' : ' (?)'}</span>
                      : <> <GatedAction
                          id={`market-eval-${o.cargoId}`} label="Évaluer" ariaLabel={`Évaluer ${o.label}`}
                          enabled={!isGuest} reason={REFUS_INVITE}
                          descOfferte="Test d’Évaluation pour révéler la qualité secrète du vin"
                          onClick={() => evalWine(o.cargoId)} primary={false} btnClassName="small ghost"
                        /></>)}
                  </Row>
                )}
                enc={(o) => o.enc}
                encLabel="Dispo"
                priceLabel="Prix/Enc"
                price={(o) => toMoney({ gold: o.basePrice })}
                disabled={(o) => {
                  const free = target ? carrierFreeEnc(target) : 0;
                  const want = buyEnc[o.cargoId] ?? Math.min(o.enc, free || o.enc);
                  const estCost = toMoney({ gold: Math.round(want * o.basePrice) });
                  if (!target) return { reason: 'Aucun porteur' };
                  if (want > free) return { reason: `Contenance dépassée (libre ${free} Enc)` };
                  if (!canAfford(money, estCost)) return { reason: 'Bourse insuffisante' };
                  return false;
                }}
                action={(o) => {
                  const free = target ? carrierFreeEnc(target) : 0;
                  const want = buyEnc[o.cargoId] ?? Math.min(o.enc, free || o.enc);
                  const estCost = toMoney({ gold: Math.round(want * o.basePrice) });
                  const affordable = canAfford(money, estCost);
                  const fits = want <= free;
                  return (
                    <div className={`market-offer-buy ${affordable ? '' : 'unaffordable'}`}>
                      <NumberField
                        variant="nu" label={`Enc à acheter — ${o.label}`}
                        min={1} max={o.enc} value={want}
                        onChange={(n) => setBuyEnc((s) => ({ ...s, [o.cargoId]: n }))}
                      />
                      <span className="market-offer-total">≈ <Coins money={estCost} /></span>
                      <GatedAction
                        id={`market-buy-${o.cargoId}`}
                        label="Acheter"
                        enabled={!isGuest && affordable && !!target && fits}
                        reason={isGuest ? REFUS_INVITE : !target ? 'Aucun porteur pour recevoir ce lot.' : !fits ? `Contenance dépassée (libre ${free} Enc).` : 'Bourse insuffisante.'}
                        descOfferte="Estimation avant Marchandage (+10 % si lot partiel)"
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
            <h3>Vendre — cargaison des porteurs</h3>
            {refs.length === 0 ? <p className="port-hint">Aucune cargaison à vendre.</p> : (
              <TradeTable
                columns={[{ key: 'carrier', label: 'Porteur', render: (r) => r.carrierLabel }]}
                groups={sellGroups}
                rowKey={(r) => `${r.carrierId}-${r.index}`}
                label={(r) => cargoLabel(r.lot.cargoId)}
                enc={(r) => r.lot.enc}
                priceLabel="Prix base/Enc"
                price={(r) => toMoney({ gold: r.lot.basePriceGold })}
                action={(r) => (
                  <div className="port-sell-actions">
                    <GatedAction
                      id={`market-sell-${r.carrierId}-${r.index}`} label="Vendre" enabled={!isGuest} reason={REFUS_INVITE}
                      descOfferte="Trouver un acheteur puis marchander"
                      onClick={() => sell(r.carrierId, r.index)} primary={false} btnClassName="small"
                    />
                    <GatedAction
                      id={`market-dump-${r.carrierId}-${r.index}`} label="Brader" enabled={!isGuest} reason={REFUS_INVITE}
                      descOfferte="Brader à la moitié du prix de base"
                      onClick={() => dump(r.carrierId, r.index)} primary={false} btnClassName="small ghost"
                    />
                  </div>
                )}
              />
            )}
          </section>
          <CargoTransferPanel {...spanFull} carriers={carriers} onMove={move} labelOf={cargoLabel} disabled={isGuest} />
        </Grid>
    </ScreenShell>
  );
}
