import { useMemo, useState } from 'react';
import { nomDuNavire } from '../noyau/carriers';
import { FORMULES_DES_MARCHES, achatDeLOffre } from '../noyau/cargaison';
import { useGame } from '../state/store';
import { partyMoneyTotal, refusDeGesteSurLeGroupe } from '../noyau/bourseFlow';
import { findVehicleById, findNavalTrait, findNavalPortById, refLabel, type NavalPortData } from '../data';
import { rationsDeCale, type VivresDeCale } from '../engine/provisions';
import { type PortProfile } from '../engine/seaVoyage';
import { REPARATION } from '../engine/seaNavigation';
import { humanizeFormula } from '../noyau/codex/humanize';
import { findCargoEntryById } from '../engine/cargo';
import { toMoney, priceToMoney, fromBrass, formatMoney, PA_PER_CO, type Money } from '../engine/money';
import { moraleBand } from '../engine/crewMorale';
import type { CampaignVessel } from '../noyau/etat';
import { devisDAchatEnPort, caleALEscale, refusDeBradageEnPort, rolesRecrutables, refusDEmbauche, refusDeDebarquement, devisDAvitaillement } from '../noyau/portFlow';
import { devisDeChantier, ameliorationsAuChantier, type PendingShoreLeave } from '../noyau/seaVoyageFlow';
import { Coins } from './Coins';
import { NumberField } from './NumberField';
import { Prose } from './Prose';
import { Icon } from './Icon';
import { NotchGauge } from './NotchGauge';
import { moraleTone, SalissuresDeLaCoque, ShipCrewWages } from './shipStatus';
import { ScreenShell } from './ScreenShell';
import { Tabs } from './composites/Tabs';
import { TradeTable, type TradeGroup } from './TradeTable';
import { ShoreLeaveBody } from './ShoreLeaveModal';
import { GatedAction, raisonSi } from './GatedAction';
import { Grid, Split, Stack } from './Layout';


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

/** AVITAILLEMENT de la cale : rations-jour de chaque vivre achetable (`vivresAchetables`) et tonneaux d'eau douce à
 *  embarquer, au devis du noyau (`devisDAvitaillement`) contre la bourse `bourse` du groupe. MDG 14 l.238, l.248-252 ;
 *  MDG 15 l.262 */
function AvitaillementDeLaCale({ vessel, bourse, refusHote, onAvitailler }: {
  vessel: CampaignVessel; bourse: Money; refusHote: string | null;
  onAvitailler: (quantites: VivresDeCale, tonneaux: number) => void;
}) {
  const [quantites, setQuantites] = useState<VivresDeCale>({});
  const [tonneaux, setTonneaux] = useState(0);
  const devis = devisDAvitaillement(vessel, bourse, refusHote, quantites, tonneaux);
  return (
    <section className="panel port-section">
      <h3>Avitailler la cale</h3>
      <p className="port-hint">
        Vivres : <b>{vessel.provisions != null ? rationsDeCale(vessel.provisions) : '—'}</b> ration(s)-jour · Eau douce : <b>{vessel.waterLitres ?? '—'}</b> L
      </p>
      <Stack gap="md">
        {devis.vivres.map(({ id, prix }) => {
          const libelle = refLabel('trappings', { id });
          return (
            <div key={id} className="port-upgrade">
              <div className="port-upgrade-head">
                <b>{libelle}</b>
                <span className="port-hint"><Coins money={prix} /> l’unité</span>
              </div>
              <NumberField variant="nu" label={`${libelle} à embarquer`} min={0} value={quantites[id] ?? 0} disabled={!!refusHote} onChange={(n) => setQuantites({ ...quantites, [id]: n })} />
            </div>
          );
        })}
        <div className="port-upgrade">
          <div className="port-upgrade-head">
            <b>Tonneaux d’eau douce</b>
            <span className="port-hint"><Coins money={devis.tonneau} /> l’unité</span>
          </div>
          <NumberField variant="nu" label="Tonneaux d’eau douce à embarquer" min={0} value={tonneaux} disabled={!!refusHote} onChange={setTonneaux} />
        </div>
      </Stack>
      <GatedAction
        id="port-avitailler"
        label={<>Embarquer — <Coins money={devis.total} /></>}
        ariaLabel="Avitailler la cale"
        enabled={devis.refus === null}
        {...raisonSi(devis.refus)}
        onClick={() => onAvitailler(quantites, tonneaux)}
        primary={false}
      />
    </section>
  );
}

/** Onglet ESCALE (#228) — actions d'escale agrégées : la Relâche à terre en cours surfacée (MDG 15 l.245 —
 *  le hub COMPOSE `ShoreLeaveBody`, déjà résolvant et branché au store, aucune 2e prose de décision),
 *  RECRUTEMENT salarié (MDG 14 l.293-302, `crew-roles.json`) et AVITAILLEMENT de la cale ; PUR sur ces volets,
 *  les gestes en props. */
export function EscaleTab({ vessel, bourse, refusHote, pendingShoreLeave, onHire, onDismiss, onAvitailler }: {
  vessel: CampaignVessel; bourse: Money; refusHote: string | null;
  pendingShoreLeave: PendingShoreLeave | null;
  onHire: (roleId: string) => void; onDismiss: (roleId: string) => void;
  onAvitailler: (quantites: VivresDeCale, tonneaux: number) => void;
}) {
  const hireable = rolesRecrutables();
  const countOf = (roleId: string) => vessel.crew?.find((h) => h.roleId === roleId)?.count ?? 0;
  const hasEvent = !!pendingShoreLeave;
  return (
    <Split aside="md" stackBelow={900} gap="xl" pad="xl">
      <Stack gap="xl">
        <section className="panel port-section">
          <h3>Vie du port</h3>
          {!hasEvent && <p className="port-hint">Aucun événement d’escale en cours.</p>}
          <ShoreLeaveBody embedded />
        </section>
        <AvitaillementDeLaCale vessel={vessel} bourse={bourse} refusHote={refusHote} onAvitailler={onAvitailler} />
      </Stack>
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
                    enabled={refusDEmbauche(vessel, role.id, refusHote) == null} {...raisonSi(refusDEmbauche(vessel, role.id, refusHote))}
                    onClick={() => onHire(role.id)} primary={false} btnClassName="small"
                  />
                  <GatedAction
                    id={`port-dismiss-${role.id}`} label="Débarquer" ariaLabel={`Débarquer un ${role.label}`}
                    enabled={refusDeDebarquement(vessel, role.id, refusHote) == null}
                    {...raisonSi(refusDeDebarquement(vessel, role.id, refusHote))}
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
 * `ref`), puis trois onglets. MDG 13 l.643,150-159 · MDG 12 · MDG 15 l.309-399.
 * Escale (`EscaleTab` : événements
 * d'escale en cours surfacés + recrutement salarié). Overlay plein écran (patron `WorldMapView`),
 * sections en `Split`/`Grid` (responsive ≤900/700/560), français, aucun texte tuto
 * (les `desc` sont du VERBATIM). `initialTab` : levier de test (rendu statique) ; défaut = Chantier.
 */
export function PortView({ initialTab = 'coque' }: { initialTab?: 'coque' | 'cargaison' | 'escale' } = {}) {
  const port = useGame((s) => s.port);
  const vessel = useGame((s) => s.vessel);
  const party = useGame((s) => s.party);
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);
  const fermer = useGame((s) => s.fenetreFermer);
  const close = () => fermer('port');
  const choisir = useGame((s) => s.fenetreChoisir);
  const repair = useGame((s) => s.reparerLeNavire);
  const careen = useGame((s) => s.carenerLeNavire);
  const install = useGame((s) => s.installerLAmelioration);
  const hire = useGame((s) => s.recruterLEquipage);
  const dismiss = useGame((s) => s.renvoyerLEquipage);
  const avitailler = useGame((s) => s.avitaillerLeNavire);
  const pendingShoreLeave = useGame((s) => s.pendingShoreLeave);
  const refusHote = useGame(refusDeGesteSurLeGroupe);
  const [tab, setTab] = useState<'coque' | 'cargaison' | 'escale'>(initialTab);

  const vd = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const upgrades = vessel ? ameliorationsAuChantier(vessel, money, refusHote, port?.ref) : [];
  if (!port || !vessel || !vd?.ship) return null;
  const etat = useGame.getState();
  const devisDe = (cargoId: string) => {
    const achat = achatDeLOffre(etat, FORMULES_DES_MARCHES.port, cargoId);
    return devisDAchatEnPort(etat, achat.porteur, achat.offre, achat.enc);
  };
  // L'achat de l'offre se compose avant d'être réglé ou conclu (`cargaison.ts`).
  const composer = (cargoId: string) => { if (useGame.getState().port?.achat?.offre !== cargoId) choisir('port', 'offre', cargoId); };
  const chantier = devisDeChantier(vessel, money, refusHote);
  const cale = caleALEscale(vessel);
  const { max: woundsMax, current: woundsCur, missing, lissage, reparationGold: repairCost, carenagePct: careenPct, carenageGold: careenCost } = chantier;
  const cargo = vessel.cargo ?? [];
  const catalogue = port.ref ? findNavalPortById(port.ref) : undefined;
  const hasEscaleEvent = !!pendingShoreLeave;

  return (
    <ScreenShell
      title={<><Icon id="voyage/ancre" size="sm" /> Port de {port.label} — {nomDuNavire(vessel)}</>}
      onClose={close}
      meta={{ money }}
      body="centered-wide"
    >
      <PortHeader pp={port.port} catalogue={catalogue} />
      <Tabs
        className="port-tabnav"
        tabs={[
          { key: 'coque' as const, label: <><Icon id="voyage/reparer" size="sm" /> Chantier</> },
          { key: 'cargaison' as const, label: <><Icon id="objet/divers" size="sm" /> Cargaison</> },
          { key: 'escale' as const, label: <><Icon id="voyage/ancre" size="sm" /> Escale{hasEscaleEvent ? ' •' : ''}</> },
        ]}
        active={tab}
        onChange={setTab}
      />

        {tab === 'coque' ? (
          <Split aside="md" stackBelow={900} gap="xl" pad="xl">
            <section className="panel port-section">
              <h3>Coque &amp; entretien</h3>
              <p>Blessures : <b>{woundsCur}/{woundsMax}</b>{vessel.criticals?.length ? ` · ${vessel.criticals.length} Critique(s) noté(s)` : ''}</p>
              <GatedAction
                id="port-repair"
                label={<><Icon id="voyage/reparer" size="sm" /> Réparer{missing > 0 ? <> — {missing} Blessure(s), <Coins money={toMoney({ gold: repairCost })} /></> : null}</>}
                ariaLabel="Réparer la coque"
                enabled={!chantier.refusReparation}
                {...raisonSi(chantier.refusReparation)}
                descOfferte={`${formatMoney(toMoney({ gold: REPARATION.portCostGoldPerWound }))} par Blessure restaurée${lissage ? ` · +${REPARATION.lissageRepairSurcoutPct} % coque lissée` : ''}`}
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
              <SalissuresDeLaCoque vessel={vessel} />
              <GatedAction
                id="port-careen"
                label={<><Icon id="voyage/carener" size="sm" /> Caréner{careenCost > 0 ? <> — <Coins money={toMoney({ gold: careenCost })} /></> : null}</>}
                ariaLabel="Caréner la coque"
                enabled={!chantier.refusCarenage}
                {...raisonSi(chantier.refusCarenage)}
                descOfferte={`Cale sèche — ${careenPct} % du coût de base`}
                onClick={careen}
                primary={false}
              />
            </section>
            <section className="panel port-section">
              <h3>Améliorations</h3>
              {upgrades.length === 0 && <p className="port-hint">Toutes les Améliorations installables le sont déjà.</p>}
              <Grid min="md" stackBelow={700}>
                {upgrades.map((devis) => (
                  <div key={devis.traitId} className="port-upgrade">
                    <div className="port-upgrade-head">
                      <b>{devis.label}</b>
                      <GatedAction
                        id={`port-upgrade-${devis.traitId}`}
                        label={<>Installer — <Coins money={toMoney({ gold: devis.gold ?? 0 })} /></>}
                        ariaLabel={`Installer ${devis.label}`}
                        enabled={devis.refus === null}
                        {...raisonSi(devis.refus)}
                        onClick={() => install(devis.traitId, 1)}
                        primary={false}
                        btnClassName="small"
                      />
                    </div>
                    {devis.duree !== null && <p className="port-hint">Pose : {humanizeFormula(devis.duree)} jour(s)</p>}
                    <Prose md={findNavalTrait(devis.traitId)?.desc ?? ''} porteur={{ type: 'navalTraits', id: devis.traitId, chemin: 'desc' }} />
                  </div>
                ))}
              </Grid>
            </section>
          </Split>
        ) : tab === 'cargaison' ? (
          <Split aside="md" stackBelow={900} gap="xl" pad="xl">
            <section className="panel port-section">
              <h3>Acheter — offres de l’escale</h3>
              <p className="port-hint">
                Cale libre : <b>{cale.libre} Enc</b>
                {cale.embarquable > cale.libre && <> · surcharge possible jusqu’à <b>+{cale.embarquable - cale.libre} Enc</b> (jusqu’à {cale.plafondPct} %)</>}
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
                  price={(o) => fromBrass(o.basePrice * PA_PER_CO)}
                  disabled={(o) => {
                    const refus = devisDe(o.cargoId).refus;
                    return refus ? { reason: refus } : false;
                  }}
                  action={(o) => {
                    const devis = devisDe(o.cargoId);
                    return (
                      <div className={`market-offer-buy ${devis.refus ? 'unaffordable' : ''}`}>
                        <NumberField
                          variant="nu" label={`Enc à embarquer — ${o.label}`}
                          min={1} max={devis.max} value={devis.enc} disabled={!!refusHote}
                          onChange={(n) => { composer(o.cargoId); choisir('port', 'encombrement', n); }}
                        />
                        <span className="market-offer-total">≈ <Coins money={toMoney({ gold: devis.estimationGold })} /></span>
                        <GatedAction
                          id={`port-buy-${o.cargoId}`}
                          label={devis.surcharge ? 'Surcharger' : 'Acheter'}
                          enabled={devis.refus === null}
                          {...raisonSi(devis.refus)}
                          descOfferte={devis.surcharge ? 'Embarquer en surcharge (pénalités d’assiette)' : 'Estimation avant Marchandage'}
                          onClick={() => { composer(o.cargoId); choisir('port', 'acheter', true); }}
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
                  label={(r) => cargoLabel(r.lot.cargoId)}
                  enc={(r) => r.lot.enc}
                  priceLabel="Prix base/Enc"
                  price={(r) => fromBrass(r.lot.basePriceGold * PA_PER_CO)}
                  action={(r) => (
                    <div className="port-sell-actions">
                      <GatedAction
                        id={`port-sell-${r.i}`} label="Vendre" enabled={!refusHote} {...raisonSi(refusHote)}
                        descOfferte="Trouver un acheteur puis marchander"
                        onClick={() => choisir('port', 'vendre', r.lot.uid)} primary={false} btnClassName="small"
                      />
                      <GatedAction
                        id={`port-dump-${r.i}`} label="Brader" enabled={refusDeBradageEnPort(etat, r.lot.cargoId) == null} {...raisonSi(refusDeBradageEnPort(etat, r.lot.cargoId))}
                        descOfferte="Brader à ¼ du prix de base"
                        onClick={() => choisir('port', 'jeter', r.lot.uid)} primary={false} btnClassName="small ghost"
                      />
                    </div>
                  )}
                />
              )}
            </section>
          </Split>
        ) : (
          <EscaleTab
            vessel={vessel} bourse={money} refusHote={refusHote}
            pendingShoreLeave={pendingShoreLeave}
            onHire={(roleId) => hire(roleId, 1)} onDismiss={(roleId) => dismiss(roleId, 1)}
            onAvitailler={avitailler}
          />
        )}
    </ScreenShell>
  );
}
