import { useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import type { CampaignVessel } from '../state/store';
import type { Combatant } from '../engine/types';
import { findVehicleById } from '../data';
import { findCargoById, findManannFactor, cargoTotalEnc, cargoOverload, overloadMaxEnc } from '../engine/seaVoyage';
import { foulingEffects } from '../engine/seaNavigation';
import { moraleBand, weeklyCrewWageBrass, findMoraleFactor } from '../engine/crewMorale';
import { provisioningManifest } from '../engine/provisions';
import { fromBrass } from '../engine/money';
import { bulkCarriers, type CarrierStateSlice, nomDuNavire } from '../state/carriers';
import { Coins } from './Coins';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { rigSchema } from '../data/schemas/defs/vehicles';
import { Icon } from './Icon';
import { NotchGauge, type GaugeTone } from './NotchGauge';
import { moraleTone, crewRoleLabel } from './shipStatus';
import { ScreenShell } from './ScreenShell';
import { Tabs } from './Tabs';
import { CargoTransferPanel } from './CargoTransferPanel';
import { ShipPreview } from './ShipPreview';
import { Split } from './Layout';

/**
 * DOSSIER DE NAVIRE persistant (#227, attendu C.1) — écran plein-champ du `CampaignVessel` (l'INSTANCE
 * qui survit aux jours et aux combats), ouvert EN et HORS combat depuis le bandeau d'actions. Toutes les
 * données existent déjà sur `vessel` (aucun trou moteur) : c'est l'écran qui les compose avec les
 * primitives partagées (jauges à crans `NotchGauge`, ton de Moral `moraleTone`, résumé d'équipage salarié
 * `ShipCrewWages`). Coquille plein-champ `ScreenShell` + onglets (patron de PortView) ; responsive
 * ≤900/700/560 via `Split`/`Grid`. La coque reste une JAUGE (pas de silhouette à
 * localisations — arbitrage USER). La fiche de combat `PosteSheet` (postes/manœuvre) reste distincte.
 */

/** Humeur de Manann (MDG 15) → ton par SIGNE : favorable = ok, courroucée = danger, neutre = neutral. */
const manannTone = (score: number): GaugeTone => (score > 0 ? 'ok' : score < 0 ? 'danger' : 'neutral');

/** Surcharge de soute (MDG 12 l.70-75) : au-delà de la Contenance = surcharge (danger), proche = warn. */
const cargoTone = (enc: number, cap: number): GaugeTone => {
  const frac = cap > 0 ? enc / cap : 0;
  return frac > 1 ? 'danger' : frac >= 0.8 ? 'warn' : 'ok';
};

/** Coque : fraction de Blessures restantes → ton (basse = danger, entamée = warn). */
const hullTone = (cur: number, max: number): GaugeTone => {
  const frac = max > 0 ? cur / max : 1;
  return frac <= 0.25 ? 'danger' : frac <= 0.5 ? 'warn' : 'ok';
};

type DossierTab = 'apercu' | 'cargaison' | 'equipage';

/** Coquille store-connectée : le dossier lit le navire de campagne PERSISTANT et l'équipage joueur. */
export function ShipDossier({ onClose, initialTab }: { onClose: () => void; initialTab?: DossierTab }) {
  const vessel = useGame((s) => s.vessel);
  const party = useGame((s) => s.party);
  const worldMap = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const possessions = useGame((s) => s.possessions);
  const move = useGame((s) => s.moveCargo);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  // Transfert navire ↔ porteur terrestre CO-LOCALISÉ (au port). `bulkCarriers` réunit cale + bêtes/véhicules.
  const carriers = useMemo(() => bulkCarriers({ party, vessel, worldMap, scene, possessions } as CarrierStateSlice), [party, vessel, worldMap, scene, possessions]);
  if (!vessel) return null;
  const transfer = <CargoTransferPanel carriers={carriers} onMove={move} labelOf={(id) => findCargoById(id)?.label ?? id} disabled={isGuest} />;
  return <ShipDossierView vessel={vessel} party={party} onClose={onClose} initialTab={initialTab} transfer={transfer} />;
}

/** Corps PUR (props) — testable en rendu statique (l'environnement de test est `node`, sans DOM :
 *  les sélecteurs de store ne s'hydratent pas sous `renderToStaticMarkup`, on passe donc les données). */
export function ShipDossierView({ vessel, party, onClose, initialTab = 'apercu', transfer }: { vessel: CampaignVessel; party: Combatant[]; onClose: () => void; initialTab?: DossierTab; transfer?: ReactNode }) {
  const [tab, setTab] = useState<DossierTab>(initialTab);

  const vd = findVehicleById(vessel.vehicleId);
  if (!vd?.ship) return null;

  const name = nomDuNavire(vessel);
  const rig = vd.hull?.rig;
  const woundsMax = vessel.wounds?.max ?? vd.hull?.char.B ?? 0;
  const woundsCur = vessel.wounds?.current ?? woundsMax;
  const missing = woundsMax - woundsCur;

  const capacity = vd.ship.capacity;
  const cargo = vessel.cargo ?? [];
  const cargoEnc = cargoTotalEnc(cargo);
  // Surcharge de la cale (MDG 12 l.70-75) : palier d'assiette + marques de jauge (120/140/150 % de la Contenance).
  const overload = cargoOverload(cargoEnc, capacity);
  const cargoMax = overloadMaxEnc(capacity); // domaine de la jauge = plafond dur (150 %)
  const cargoMarks = [Math.round(capacity), Math.round(capacity * 1.2), Math.round(capacity * 1.4)];

  const manann = vessel.manann;
  const manannScore = manann?.score ?? 0;
  const manannBound = Math.max(20, Math.abs(manannScore) + 5); // domaine centré sur 0, contient toujours la valeur

  const foulLevel = vessel.fouling?.level ?? 0;
  const criticals = vessel.criticals ?? [];

  // POPULATION EMBARQUÉE (#245) : héros + effectif PNJ nominal présent (`ship.crew − crewLost`).
  const crewCount = Math.max(0, (vd.ship.crew ?? 0) - (vessel.crewLost ?? 0));
  // Autonomie en eau (jours) : eau requise/jour de TOUTE la population embarquée — autonomie = eau ÷ besoin.
  const dailyWater = provisioningManifest(party, vessel.waterLitres, 1, { count: crewCount, provisions: vessel.provisions }).eauRequiseLitres;
  const autonomyDays = vessel.waterLitres != null && dailyWater > 0 ? Math.floor(vessel.waterLitres / dailyWater) : null;
  // Autonomie en vivres d'équipage (jours) : rations de cale ÷ effectif PNJ.
  const provisionDays = vessel.provisions != null && crewCount > 0 ? Math.floor(vessel.provisions / crewCount) : null;

  const weeklyWageBrass = weeklyCrewWageBrass(vessel.crew);

  return (
    <ScreenShell
      className="port-overlay ship-dossier"
      title={<>
        <Icon id="travel/sail-ship" size="sm" /> {name}
        <span className="char-sub"> — {vd.label}{rig ? ` · ${libelleDeValeur(rigSchema, rig)}` : ''}</span>
      </>}
      onClose={onClose}
      body="centered"
      tabs={
        <Tabs
          tabs={[
            { key: 'apercu' as const, label: <><Icon id="scenario/naval" size="sm" /> Vue d’ensemble</> },
            { key: 'cargaison' as const, label: <><Icon id="item/misc" size="sm" /> Cargaison</> },
            { key: 'equipage' as const, label: <><Icon id="nav/seat-owner" size="sm" /> Équipage</> },
          ]}
          active={tab}
          onChange={setTab}
        />
      }
    >
        {tab === 'apercu' && (<>
          <section className="panel" data-ship-proue>
            <ShipPreview vehicleId={vessel.vehicleId} sunk={woundsCur <= 0} label={name} />
            <div>
              <h3>{name}</h3>
              <p className="port-hint">{vd.label}{rig ? ` · ${libelleDeValeur(rigSchema, rig)}` : ''}{vd.ship.lengthM ? ` · ${vd.ship.lengthM} m` : ''}</p>
              <p>Coque : <b>{woundsCur}</b> / {woundsMax} Blessure(s){woundsCur <= 0 ? ' — épave, échouée' : missing > 0 ? ' — avariée' : ' — intacte'}</p>
            </div>
          </section>
          <Split aside="md" stackBelow={900} gap="xl" pad="xl" className="screen-scroll port-yard">
            <section className="panel port-section">
              <h3>Jauges</h3>
              <NotchGauge label="Coque" value={woundsCur} max={woundsMax} stacked tone={hullTone} />
              <NotchGauge
                label="Moral"
                value={vessel.morale.score}
                max={100}
                stacked
                tone={moraleTone}
                format={(v) => `${v} — ${moraleBand(v).label}`}
              />
              <NotchGauge
                label="Humeur de Manann"
                value={manannScore}
                min={-manannBound}
                max={manannBound}
                stacked
                tone={manannTone}
                marks={[0]}
                format={(v) => `${v > 0 ? '+' : ''}${v}`}
              />
              <NotchGauge
                label="Soute"
                value={cargoEnc}
                max={cargoMax}
                marks={cargoMarks}
                stacked
                tone={cargoTone}
                format={(v) => `${v} / ${capacity} Enc${overload.palierId ? ` — ${overload.label} (${overload.ratioPct} %)` : ''}`}
              />
            </section>

            <section className="panel port-section">
              <h3>État</h3>
              <p className="port-hint">Salissures : niveau <b>{foulLevel}</b>{vessel.crabs ? ' · crabes boxeurs' : ''}{foulLevel > 0 ? ` — ${foulingEffects(foulLevel).desc}` : ''}</p>
              {missing > 0 && <p className="port-hint">Avarie de coque : <b>{missing}</b> Blessure(s) à réparer au chantier.</p>}
              {criticals.length > 0 && (
                <div>
                  <p className="port-hint">Critiques de coque actifs :</p>
                  <ul className="ship-dossier-list">
                    {criticals.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {vessel.saboteurDR ? <p className="port-hint">Sabotage actif : <b>{vessel.saboteurDR} DR</b> aux Tests d’équipage.</p> : null}
              <p className="port-hint">À bord : <b>{party.filter((h) => !h.dead).length} héros + {crewCount} d’équipage</b>.</p>
              <p className="port-hint">
                Eau douce : <b>{vessel.waterLitres != null ? `${vessel.waterLitres} L` : 'ravitaillement réputé assuré'}</b>
                {autonomyDays != null ? ` · autonomie ~${autonomyDays} jour(s)` : ''}
              </p>
              <p className="port-hint">
                Vivres d’équipage : <b>{vessel.provisions != null ? `${vessel.provisions} jour(s)-homme` : 'ravitaillement réputé assuré'}</b>
                {provisionDays != null ? ` · autonomie ~${provisionDays} jour(s)` : ''}
              </p>
              <p className="port-hint">Dernière traversée : <b>{vessel.lastVoyageMilles != null ? `${vessel.lastVoyageMilles} milles` : 'à quai depuis la mise à l’eau'}</b></p>
            </section>

            <section className="panel port-section">
              <h3>Humeur de Manann</h3>
              <p className="port-hint">Score courant : <b>{manannScore > 0 ? '+' : ''}{manannScore}</b>.</p>
              <details className="ship-dossier-details">
                <summary>Facteurs appliqués ({manann?.applied.length ?? 0})</summary>
                {manann?.applied.length ? (
                  <ul className="ship-dossier-list">
                    {manann.applied.map((id) => <li key={id}>{findManannFactor(id)?.label ?? id}</li>)}
                  </ul>
                ) : <p className="port-hint">Aucun facteur appliqué à ce navire.</p>}
              </details>
            </section>
          </Split>
        </>)}

        {tab === 'cargaison' && (
          <Split aside="md" stackBelow={900} gap="xl" pad="xl" className="screen-scroll port-trade">
            <section className="panel port-section">
              <h3>Cale</h3>
              <NotchGauge label="Soute" value={cargoEnc} max={cargoMax} marks={cargoMarks} stacked tone={cargoTone} format={(v) => `${v} / ${capacity} Enc${overload.palierId ? ` — ${overload.label} (${overload.ratioPct} %)` : ''}`} />
              {overload.palierId && <p className="port-hint">Surcharge : <b>{overload.mMod} M</b>, <b>{overload.manoeuvreDR} DR Manœuvre</b>.{!overload.canSail && ' Impossible de prendre la mer.'}</p>}
              {cargo.length === 0 ? (
                <p className="port-hint">La cale est vide.</p>
              ) : (
                <table className="port-table">
                  <thead><tr><th>Lot</th><th>Enc</th></tr></thead>
                  <tbody>
                    {cargo.map((lot, i) => (
                      <tr key={i}>
                        <td>{findCargoById(lot.cargoId)?.label ?? lot.cargoId}</td>
                        <td>{lot.enc}</td>
                      </tr>
                    ))}
                    <tr><td><b>Total</b></td><td><b>{cargoEnc} / {capacity}</b></td></tr>
                  </tbody>
                </table>
              )}
            </section>
            {transfer}
          </Split>
        )}

        {tab === 'equipage' && (
          <Split aside="md" stackBelow={900} gap="xl" pad="xl" className="screen-scroll port-yard">
            <section className="panel port-section">
              <h3>Équipage salarié</h3>
              {vessel.crew?.length ? (
                <table className="port-table">
                  <thead><tr><th>Rôle</th><th>Nombre</th><th>Salaire / semaine</th></tr></thead>
                  <tbody>
                    {vessel.crew.map((h) => (
                      <tr key={h.roleId}>
                        <td>{crewRoleLabel(h.roleId)}</td>
                        <td>{h.count}</td>
                        <td><b><Coins money={fromBrass(weeklyCrewWageBrass([h]))} /></b></td>
                      </tr>
                    ))}
                    <tr>
                      <td><b>Solde hebdomadaire</b></td>
                      <td />
                      <td><b><Coins money={fromBrass(weeklyWageBrass)} /></b></td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="port-hint">Aucun équipage salarié embauché.</p>
              )}
              {vessel.wagesOwed ? <p className="port-hint">Dette de paie cumulée : <b><Coins money={fromBrass(vessel.wagesOwed)} /></b> (bourse insuffisante à l’entretien).</p> : null}
              <p className="port-hint">Le roster est agrégé par RÔLE (nombre × salaire) — pas d’individus nommés.</p>
            </section>

            <section className="panel port-section">
              <h3>Moral de l’équipage</h3>
              <p className="port-hint">
                Score courant : <b>{vessel.morale.score}</b> — {moraleBand(vessel.morale.score).label}
              </p>
              <p className="port-hint">Facteurs en cours (vers le prochain conseil de bord) :</p>
              {vessel.morale.factors.length ? (
                <ul className="ship-dossier-list">
                  {vessel.morale.factors.map((id) => {
                    const f = findMoraleFactor(id);
                    return <li key={id}>{f?.label ?? id}{f ? ` (${f.effect})` : ''}</li>;
                  })}
                </ul>
              ) : (
                <p className="port-hint">Aucun facteur actif — seule la paie hebdomadaire pèsera au conseil.</p>
              )}
            </section>
          </Split>
        )}
    </ScreenShell>
  );
}
