import { useMemo } from 'react';
import { useGame } from '../state/store';
import { findCargoEntryById } from '../engine/cargo';
import { bulkCarriers, bulkCargoRefs, primaryCargoCarrier, type CarrierStateSlice } from '../noyau/carriers';
import { carrierFreeEnc } from '../engine/cargo';
import { placeById } from '../noyau/worldMap';
import { fromBrass, PA_PER_CO } from '../engine/money';
import { refusDEvaluerLeVin } from '../noyau/landMarketFlow';
import { FORMULES_DES_MARCHES, achatDeLOffre, devisDeLAchat } from '../noyau/cargaison';
import { partyMoneyTotal, refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { ScreenShell } from './ScreenShell';
import { SpeakerBanner } from './SpeakerBanner';
import { CargoTransferPanel } from './CargoTransferPanel';
import { TradeTable, type TradeGroup } from './TradeTable';
import { GatedAction, raisonSi } from './GatedAction';
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
  const possessions = useGame((s) => s.possessions);
  const rumours = useGame((s) => s.tradeRumours);
  const fermer = useGame((s) => s.fenetreFermer);
  const close = () => fermer('marcheDeTerre');
  const choisir = useGame((s) => s.fenetreChoisir);
  const move = useGame((s) => s.deplacerLaCargaison);
  const evalWine = useGame((s) => s.evaluerLeVin);
  const net = useGame((s) => s.net);
  const refusHote = refusDeGesteSurLeGroupe({ net });
  // Bourse de groupe = somme des bourses personnelles (T-bourse #531) ; recalculée quand le groupe change.
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);

  const slice: CarrierStateSlice = useMemo(() => ({ party, vessel, possessions }), [party, vessel, possessions]);
  const carriers = useMemo(() => bulkCarriers(slice), [slice]);
  const refs = useMemo(() => bulkCargoRefs(slice), [slice]);
  const target = useMemo(() => primaryCargoCarrier(slice), [slice]);

  if (!market) return null;
  const etat = useGame.getState();
  const halle = FORMULES_DES_MARCHES.marcheDeTerre;
  const devisDe = (cargoId: string) => devisDeLAchat(etat, halle, achatDeLOffre(etat, halle, cargoId));
  // L'achat de l'offre se compose avant d'être réglé ou conclu (`cargaison.ts`).
  const composer = (cargoId: string) => { if (useGame.getState().landMarket?.achat?.offre !== cargoId) choisir('marcheDeTerre', 'offre', cargoId); };
  const cargoLabel = (id: string) => findCargoEntryById(id)?.label ?? id;

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
                          enabled={refusDEvaluerLeVin(etat, o.cargoId) === null} {...raisonSi(refusDEvaluerLeVin(etat, o.cargoId))}
                          descOfferte="Test d’Évaluation pour révéler la qualité secrète du vin"
                          onClick={() => evalWine(o.cargoId)} primary={false} btnClassName="small ghost"
                        /></>)}
                  </Row>
                )}
                enc={(o) => o.enc}
                encLabel="Dispo"
                priceLabel="Prix/Enc"
                price={(o) => fromBrass(o.basePrice * PA_PER_CO)}
                disabled={(o) => {
                  const refus = devisDe(o.cargoId).refus;
                  return refus ? { reason: refus } : false;
                }}
                action={(o) => {
                  const devis = devisDe(o.cargoId);
                  const refus = devis.refus;
                  return (
                    <div className={`market-offer-buy ${devis.refus ? 'unaffordable' : ''}`}>
                      <NumberField
                        variant="nu" label={`Enc à acheter — ${o.label}`}
                        min={1} max={devis.max} value={devis.enc} disabled={!!refusHote}
                        onChange={(n) => { composer(o.cargoId); choisir('marcheDeTerre', 'encombrement', n); }}
                      />
                      <span className="market-offer-total">≈ <Coins money={fromBrass(devis.estimationGold * PA_PER_CO)} /></span>
                      <GatedAction
                        id={`market-buy-${o.cargoId}`}
                        label="Acheter"
                        enabled={refus == null}
                        {...raisonSi(refus)}
                        descOfferte="Estimation avant Marchandage"
                        onClick={() => { composer(o.cargoId); choisir('marcheDeTerre', 'acheter', true); }}
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
                rowKey={(r) => r.lot.uid}
                label={(r) => cargoLabel(r.lot.cargoId)}
                enc={(r) => r.lot.enc}
                priceLabel="Prix base/Enc"
                price={(r) => fromBrass(r.lot.basePriceGold * PA_PER_CO)}
                action={(r) => (
                  <div className="port-sell-actions">
                    <GatedAction
                      id={`market-sell-${r.lot.uid}`} label="Vendre" enabled={!refusHote} {...raisonSi(refusHote)}
                      descOfferte="Trouver un acheteur puis marchander"
                      onClick={() => choisir('marcheDeTerre', 'vendre', r.lot.uid)} primary={false} btnClassName="small"
                    />
                    <GatedAction
                      id={`market-dump-${r.lot.uid}`} label="Brader" enabled={halle.refusDeBradage(etat, r.lot.cargoId) == null} {...raisonSi(halle.refusDeBradage(etat, r.lot.cargoId))}
                      descOfferte="Brader à la moitié du prix de base"
                      onClick={() => choisir('marcheDeTerre', 'jeter', r.lot.uid)} primary={false} btnClassName="small ghost"
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
