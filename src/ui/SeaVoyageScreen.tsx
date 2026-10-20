import { useGame } from '../state/store';
import { WindRose } from './WindRose';
import { NotchGauge } from './NotchGauge';
import { MultiRollList } from './MultiRollList';
import { RecapLineList } from './RecapLine';
import { ParchmentCard } from './ParchmentCard';
import { Icon } from './Icon';
import type { Dir8 } from '../noyau/monde/dir8';
import { type SeaWindForceId, windAspect } from '../engine/seaWeather';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { windDirectionSchema } from '../data/schemas/defs-scenes/worldmap';
import { windAspectSchema } from '../data/schemas/defs/sea-weather';
import type { TravelRecapDay } from '../noyau/travelFlow';
import { vesselHullGauge } from './VoyageScreen';
import { Row } from './Layout';
import { t } from '../i18n';

/** Cap de mer (`WindDirection` : nord/sud/est/ouest) → `Dir8` (vocabulaire rose des vents du projet). */
const HEADING_TO_DIR8: Record<string, Dir8> = { nord: 'N', sud: 'S', est: 'E', ouest: 'O' };

/**
 * ÉCRAN DE TRAVERSÉE (mer) — remplace le corps de recap TERRESTRE quand la journée est une journée de
 * MER (route COMMANDÉE) : rose des vents (vent du jour + cap), jauges compactes (coque / moral), le
 * PROCÈS-VERBAL du jour qui DÉFILE (`MultiRollList` — chaque jet de routine auto-résolu y a sa ligne),
 * distance/jours restants, et le bouton « Passer en jour-par-jour » (bascule des ordres). Monté DANS la
 * halte de nuit (registre modal canonique via `RestModal`/`TravelDayBody`) — l'événement, lui, ouvre sa
 * propre modale puis la traversée reprend.
 */
export function SeaVoyageBody({ day }: { day: TravelRecapDay }) {
  const chrome = day.sea!;
  // COQUE : jauge VIVE (source unique `vessel.wounds`, #296) — la journée close n'en porte que son DELTA
  // (`chrome.hullDelta`), jamais un absolu concurrent sous le même libellé.
  const hullGauge = vesselHullGauge(useGame((s) => s.vessel));
  const cadence = useGame((s) => s.travelPlan?.orders?.cadence);
  const setCadence = useGame((s) => s.setVoyageCadence);
  const active = !!useGame((s) => s.travelPlan); // la bascule n'a de sens que tant que la traversée dure
  return (
    <div className="sea-voyage">
      <div className="sea-voyage-head">
        <WindRose dir={HEADING_TO_DIR8[chrome.windFrom] ?? 'N'} force={chrome.windForce as SeaWindForceId} heading={HEADING_TO_DIR8[chrome.heading] ?? 'N'} size="md" />
        <div className="sea-voyage-gauges">
          {hullGauge && (
            <NotchGauge label={t('sv.coque')} icon={<Icon id="scenario/port" size="sm" />} value={hullGauge.current} max={hullGauge.max}
              tone={(v, m) => hullGauge.tone(v, m)} stacked />
          )}
          <NotchGauge label={t('sv.moral')} value={chrome.morale} max={100}
            tone={(v) => (v <= 25 ? 'danger' : v <= 50 ? 'warn' : 'ok')} stacked />
          {chrome.waterLitres != null && (
            <NotchGauge label={t('sv.eauAutonomie')} value={chrome.waterLitres} max={Math.max(chrome.waterLitres, 1)}
              format={(v) => t('sv.litres', { litres: v })} tone={(v) => (v <= 0 ? 'danger' : 'neutral')} stacked />
          )}
        </div>
      </div>
      <Row className="sea-voyage-meta">
        <span className="sv-weather">{chrome.weatherLabel}</span>
        <span className="stat-chip"><span className="sc-label">{t('sv.vent')}</span><span className="sc-value">{libelleDeValeur(windDirectionSchema, chrome.windFrom)}</span></span>
        <span className="stat-chip"><span className="sc-label">{t('sv.cap')}</span><span className="sc-value">{libelleDeValeur(windDirectionSchema, chrome.heading)}</span></span>
        {/* MDG 13 l.262-270 */}
        <span className="stat-chip"><span className="sc-label">{t('sv.ventRelatif')}</span><span className="sc-value">{libelleDeValeur(windAspectSchema, windAspect(chrome.heading, chrome.windFrom))}</span></span>
        <span className="stat-chip"><span className="sc-label">{t('sv.distance')}</span><span className="sc-value">{chrome.daysLeft > 0 ? t('sv.daysLeft', { miles: chrome.milesLeft, days: chrome.daysLeft }) : t('sv.milesLeft', { miles: chrome.milesLeft })}</span></span>
        {chrome.manann !== 0 && <span className="stat-chip"><span className="sc-label">{t('sv.manann')}</span><span className="sc-value">{chrome.manann >= 0 ? `+${chrome.manann}` : chrome.manann}</span></span>}
        {chrome.hullDelta !== 0 && <span className="stat-chip"><span className="sc-label">{t('sv.coque')}</span><span className="sc-value">{chrome.hullDelta > 0 ? `+${chrome.hullDelta}` : chrome.hullDelta}</span></span>}
      </Row>
      {/* Événements de bord RACONTÉS (un récit → une carte-parchemin) — AVANT le procès-verbal, ils
          en sont la cause narrative du jour. */}
      {(day.events?.length ?? 0) > 0 && (
        <div className="sea-voyage-events">
          {day.events!.map((ev, i) => (
            <ParchmentCard key={i} title={ev.title} tone={ev.tone} seal={ev.roll != null ? { label: 'd100', roll: ev.roll } : undefined}>
              <p>{ev.text}</p>
            </ParchmentCard>
          ))}
        </div>
      )}
      {/* Le PV du jour DÉFILE : une ligne par jet de routine auto-résolu (aucun jet silencieux). */}
      {(day.entries?.length ?? 0) > 0
        ? <div className="sea-voyage-log"><MultiRollList entries={day.entries!} /></div>
        : day.lines.length > 0 && <RecapLineList lines={day.lines} />}
      {(day.entries?.length ?? 0) > 0 && day.lines.length > 0 && (
        <div className="sea-voyage-notes"><RecapLineList lines={day.lines} /></div>
      )}
      {active && (
        <div className="sea-voyage-orders">
          {cadence === 'commande'
            ? <button type="button" className="btn small" onClick={() => setCadence('jour-par-jour')} title={t('sv.passerJourParJourTitre')}>{t('sv.passerJourParJour')}</button>
            : <button type="button" className="btn small" onClick={() => setCadence('commande')} title={t('sv.repasserCommandeeTitre')}>{t('sv.repasserCommandee')}</button>}
        </div>
      )}
    </div>
  );
}
