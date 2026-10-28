import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { findLandCargoById } from '../engine/landCargo';
import { bulkCarriers, bulkCargoRefs, primaryCargoCarrier, type CarrierStateSlice } from '../noyau/carriers';
import { carrierFreeEnc } from '../engine/cargo';
import { placeById } from '../noyau/worldMap';
import { toMoney } from '../engine/money';
import { devisDAchatDeCargaison, raisonDuRefusDAchatDeCargaison, refusDeBradageALaHalle } from '../noyau/landMarketFlow';
import { partyMoneyTotal, refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { ScreenShell } from './ScreenShell';
import { SpeakerBanner } from './SpeakerBanner';
import { CargoTransferPanel } from './CargoTransferPanel';
import { TradeTable, type TradeGroup } from './TradeTable';
import { GatedAction, raisonSi } from './GatedAction';
import { appraiseRefus } from '../noyau/merchantFlow';
import { Grid, Row, spanFull } from './Layout';

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
  const refusEval = appraiseRefus(party);
  const net = useGame((s) => s.net);
  const refusHote = refusDeGesteSurLeGroupe({ net });
  const [buyEnc, setBuyEnc] = useState<Record<string, number>>({});
  // Bourse de groupe = somme des bourses personnelles (T-bourse #531) ; recalculée quand le groupe change.
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);

  const slice: CarrierStateSlice = useMemo(() => ({ party, vessel, worldMap, scene, possessions }), [party, vessel, worldMap, scene, possessions]);
  const carriers = useMemo(() => bulkCarriers(slice), [slice]);
  const refs = useMemo(() => bulkCargoRefs(slice), [slice]);
  const target = useMemo(() => primaryCargoCarrier(slice), [slice]);

  if (!market) return null;
  const devisDe = (cargoId: string) => devisDAchatDeCargaison({ ...slice, landMarket: market, net }, cargoId, buyEnc[cargoId]);
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
                          enabled={!refusHote && !refusEval} {...raisonSi(refusHote ?? refusEval)}
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
                  const refus = devisDe(o.cargoId).refus;
                  return refus ? { reason: raisonDuRefusDAchatDeCargaison(refus) } : false;
                }}
                action={(o) => {
                  const devis = devisDe(o.cargoId);
                  const refus = devis.refus ? raisonDuRefusDAchatDeCargaison(devis.refus) : null;
                  return (
                    <div className={`market-offer-buy ${devis.refus ? 'unaffordable' : ''}`}>
                      <NumberField
                        variant="nu" label={`Enc à acheter — ${o.label}`}
                        min={1} max={o.enc} value={devis.enc}
                        onChange={(n) => setBuyEnc((s) => ({ ...s, [o.cargoId]: n }))}
                      />
                      <span className="market-offer-total">≈ <Coins money={toMoney({ gold: devis.estimationGold })} /></span>
                      <GatedAction
                        id={`market-buy-${o.cargoId}`}
                        label="Acheter"
                        enabled={refus == null}
                        {...raisonSi(refus)}
                        descOfferte="Estimation avant Marchandage"
                        onClick={() => buy(o.cargoId, devis.enc)}
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
                      id={`market-sell-${r.carrierId}-${r.index}`} label="Vendre" enabled={!refusHote} {...raisonSi(refusHote)}
                      descOfferte="Trouver un acheteur puis marchander"
                      onClick={() => sell(r.carrierId, r.index)} primary={false} btnClassName="small"
                    />
                    <GatedAction
                      id={`market-dump-${r.carrierId}-${r.index}`} label="Brader" enabled={refusDeBradageALaHalle({ net, landMarket: market }, r.lot.cargoId) == null} {...raisonSi(refusDeBradageALaHalle({ net, landMarket: market }, r.lot.cargoId))}
                      descOfferte="Brader à la moitié du prix de base"
                      onClick={() => dump(r.carrierId, r.index)} primary={false} btnClassName="small ghost"
                    />
                  </div>
                )}
              />
            )}
          </section>
          <CargoTransferPanel {...spanFull} carriers={carriers} onMove={move} labelOf={cargoLabel} />
        </Grid>
    </ScreenShell>
  );
}
