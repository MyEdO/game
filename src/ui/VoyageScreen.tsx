import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import type { CampaignVessel, PendingRest } from '../state/store';
import type { TravelPlan, TravelRecapDay } from '../state/travelFlow';
import { currentTravelDayWeather } from '../state/travelFlow';
import type { PendingCascade } from '../state/pendings';
import { DAY_PHASE_CATALOG } from '../state/recapLine';
import type { Combatant } from '../engine/types';
import type { Possession } from '../engine/possession';
import { placeById } from '../state/worldMap';
import { routeDistanceLabel, travelModeLabels } from '../engine/travel';
import { allureLabel, partyMounts } from '../engine/mountTravel';
import { windForceLabel, precipitationDef, temperatureDef, visibilityDef } from '../engine/seaWeather';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { windDirectionSchema } from '../data/schemas/defs-scenes/worldmap';
import { riverForceLabel, riverDirLabel } from '../engine/riverNavigation';
import { cargoTotalEnc } from '../engine/seaVoyage';
import { partyItemsCargoEnc, partyLandCapacity } from '../state/carriers';
import { moraleBand } from '../engine/crewMorale';
import { seasonOfMonth, weatherCondition } from '../engine/travelStages';
import { toDate } from '../engine/clock';
import { findVehicleById, seasonLabel, libelleOuAbsence } from '../data';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { NotchGauge, type GaugeTone } from './NotchGauge';
import { CascadeBody } from './CascadeModal';
import { RestBody } from './RestModal';
import { ShoreLeaveBody } from './ShoreLeaveModal';
import { TravelDayBody } from './TravelRecapModal';
import { ShipDossier } from './ShipDossier';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';

/**
 * ÉCRAN-HUB DE VOYAGE (#333) — UN écran paramétré par MODE (mer / terre / fleuve), trois habillages.
 * On PILOTE un voyage, on ne le SUBIT pas : coquille plein-champ (`ScreenShell`), en-tête départ→arrivée
 * + progression/ETA, TUILES permanentes de l'état du mode (état PRÉVISIBLE — coque/moral/provisions/cale
 * se VOIENT venir), et `MasterDetail` — GAUCHE la chronique-parchemin du voyage (gabarit #257 du temps
 * raconté : une carte par jour passé), CENTRE le jour sélectionné OU l'étape EN COURS incrustée
 * (`CascadeBody embedded` : le MÊME rendu que `CascadeModal`, sans la modale flottante — geste
 * anti-tunnel). Assemblage PUR de primitives existantes ; zéro composant neuf de fond.
 *
 * Hub de CONSULTATION : le Dossier navire (et, par les tuiles, les écrans de lecture) reste ouvrable
 * PAR-DESSUS pendant qu'une étape attend (la suspension #275 garantit la reprise).
 */

/** Une TUILE d'état du mode (patron `PosteSheet` paramétré) : chip + valeur, éventuellement une jauge à
 *  crans (`NotchGauge`), cliquable vers l'écran de consultation quand il en existe un. */
export interface VoyageTile {
  key: string;
  icon: IconIdInput;
  label: string;
  value: ReactNode;
  gauge?: { value: number; max: number; min?: number; marks?: number[]; tone?: GaugeTone | ((v: number, m: number) => GaugeTone); format?: (v: number) => string };
  onClick?: () => void;
  title?: string;
}

/** Une carte de la CHRONIQUE (gabarit #257) : un jour/Étape passé, ou le jour EN COURS. */
export interface VoyageDayCard {
  key: string;
  seal: string;
  dayLabel: string;
  summary: string;
  current?: boolean;
  /** AGENDA DE PHASES (arbitrage user verbatim, vague « lisibilité 2/2 ») : sous-catégories du jour EN
   *  COURS (fait ✓ / en cours ● / à venir ○), pour le jour `current` seulement. */
  agenda?: DayAgendaItem[];
}

/** Une PHASE de l'agenda du jour, DÉRIVÉE de l'état réel (pas une liste codée en dur par mode). */
export interface DayAgendaItem {
  key: string;
  label: string;
  state: 'done' | 'current' | 'pending';
  /** Nombre de JETS DE DÉ réels de la phase (batch = N rangées, jet = 1, agrégat/affichage = 0) — pour
   *  « Activités (N jets) ». Absent/0 → non affiché. */
  jets?: number;
}

/** Catalogue des PHASES reconnues d'une cascade de jour (`purpose:'travelDay'`) — SOURCE UNIQUE
 *  `state/recapLine.DAY_PHASE_CATALOG` (#349), partagée avec le sectionnement des jours CLOS
 *  (`RecapLine.phase`, `ui/RecapLine.RecapLineSections`). Ne PAS redéfinir localement. */

/** AGENDA DE PHASES du jour EN COURS (arbitrage user verbatim : « qu'on mette des sous-catégories …
 *  histoire qu'on sache ce qui se passe à l'écran et ce qui va se passer ») — DÉRIVÉ de l'état réel :
 *  les étapes de la cascade `travelDay` PAR KIND (`DAY_PHASE_CATALOG`, une phase absente ce jour-là
 *  n'apparaît pas), puis la Nuit (halte en cours ou à venir). Météo = CONTEXTE de la carte, pas une
 *  phase (arbitrage user 2026-07-11) — jamais listée ici. */
export function dayAgenda(pendingCascade: PendingCascade | null | undefined, pendingRest: PendingRest | null | undefined): DayAgendaItem[] {
  const items: DayAgendaItem[] = [];
  if (pendingCascade && pendingCascade.purpose === 'travelDay') {
    // Jets DE DÉ réels d'un pas (batch = N rangées, jet = 1, agrégat/affichage/météo = 0) — même compte
    // que `CascadeModal.diceOf` (« jet N/M »).
    const diceOf = (s: PendingCascade['participants'][number]) => (s.participants ? s.participants.length : (s.target != null || s.jet ? 1 : 0));
    for (const phase of DAY_PHASE_CATALOG) {
      const idxs = pendingCascade.participants
        .map((s, i) => (phase.match(s.kind) ? i : -1))
        .filter((i) => i >= 0);
      if (!idxs.length) continue; // phase absente ce jour (pas d'Activité assignée, pas de péripétie…)
      const state: DayAgendaItem['state'] = idxs.every((i) => i < pendingCascade.cursor) ? 'done'
        : idxs.includes(pendingCascade.cursor) ? 'current' : 'pending';
      const jets = idxs.reduce((n, i) => n + diceOf(pendingCascade.participants[i]), 0);
      items.push({ key: phase.key, label: phase.label, state, jets });
    }
    items.push({ key: 'nuit', label: 'Nuit', state: 'pending' });
  } else if (pendingRest) {
    // La cascade du jour a déjà clos (Route/Activités/Rencontre faites) — la halte de nuit est la phase active.
    items.push({ key: 'route', label: 'Route', state: 'done' });
    items.push({ key: 'nuit', label: 'Nuit', state: 'current' });
  }
  return items;
}

/** Coque + ton (fraction de Blessures restantes). */
const hullTone: (cur: number, max: number) => GaugeTone = (cur, max) => {
  const frac = max > 0 ? cur / max : 1;
  return frac <= 0.25 ? 'danger' : frac <= 0.5 ? 'warn' : 'ok';
};

/** COQUE VIVE du navire de campagne (source unique `vessel.wounds`, #296) — jauge partagée par la tuile
 *  de la carte de voyage ET par l'écran de traversée : une seule surface pour un seul état. `null` si
 *  aucun navire. */
export function vesselHullGauge(vessel: CampaignVessel | null | undefined): { current: number; max: number; tone: (cur: number, max: number) => GaugeTone } | null {
  if (!vessel) return null;
  const max = vessel.wounds?.max ?? findVehicleById(vessel.vehicleId)?.hull?.char.B ?? 0;
  return { current: vessel.wounds?.current ?? max, max, tone: hullTone };
}
const moraleGaugeTone: (v: number) => GaugeTone = (v) => (v <= 25 ? 'danger' : v <= 50 ? 'warn' : 'ok');
const cargoGaugeTone: (enc: number, cap: number) => GaugeTone = (enc, cap) => {
  const frac = cap > 0 ? enc / cap : 0;
  return frac > 1 ? 'danger' : frac >= 0.8 ? 'warn' : 'ok';
};

/** Tuile CHARGEMENT terre/fleuve (#327) : vrac porté par les bêtes/véhicules du convoi (porteurs RÉELS,
 *  `partyItemsCargoEnc` / `partyLandCapacity`). Omise si le groupe n'a aucun porteur de charge. */
function pushCargoTile(tiles: VoyageTile[], party: Combatant[], possessions: Possession[]): void {
  const cap = partyLandCapacity(party, possessions);
  if (cap <= 0) return;
  const enc = partyItemsCargoEnc(party, possessions);
  tiles.push({ key: 'cale', icon: 'item/misc', label: 'Chargement', value: `${enc} / ${cap} Enc`, gauge: { value: enc, max: Math.max(cap, 1), tone: cargoGaugeTone } });
}

/** Glyphe d'état d'une phase de l'agenda (même convention que `ready-chip`, RestBody). */
const AGENDA_GLYPH: Record<DayAgendaItem['state'], string> = { done: '✓', current: '●', pending: '○' };

/** Sous-mode de l'habillage, dérivé du plan (SOURCE UNIQUE). Un voyage JOUÉ (résolution jour par jour,
 *  `plan.sea`/`plan.river`) prime ; à défaut (transport PAYANT — un passeur, pas de descente/traversée
 *  jouée), le milieu réel du VÉHICULE (`plan.mode`, `vehicles.json`) tranche — jamais un repli « terre »
 *  deviné pour une embarcation affrétée (#333 correctif). `travel.medium` (facette VOYAGE, LDB 51 l.178-189)
 *  est la donnée du TRAJET PAYÉ elle-même — prioritaire, un véhicule pouvant être bi-milieu (la Barge
 *  navigue le fleuve, LDB 51 l.185-187, tout en figurant à la table navale MDG 12 avec
 *  `hull.propulsion:'maritime'` — les deux facettes sont INDÉPENDANTES). Repli sur `hull.propulsion` si
 *  `travel.medium` est absent. Aucun id de véhicule nommé ici. */
export function voyageMode(plan: TravelPlan): 'mer' | 'fleuve' | 'terre' {
  if (plan.sea) return 'mer';
  if (plan.river) return 'fleuve';
  const vehicle = findVehicleById(plan.mode);
  const medium = vehicle?.travel?.medium ?? vehicle?.hull?.propulsion;
  if (medium === 'maritime') return 'mer';
  if (medium === 'fluvial') return 'fleuve';
  return 'terre';
}

/** Résumé de carte de chronique d'un jour clos (première ligne signifiante, sinon libellé neutre). */
function dayCardSummary(day: TravelRecapDay, sub: 'mer' | 'fleuve' | 'terre'): string {
  const first = day.lines.find((l) => l.text && !l.text.startsWith('—')) ?? day.lines[0];
  if (first) return first.text;
  const km = Math.round(day.kmTo - day.kmFrom);
  return sub === 'mer' ? `${km} milles parcourus` : `${km} km parcourus`;
}

/** TUILES du MODE (mer/terre/fleuve) — état PERMANENT rendu PRÉVISIBLE. Mer/fleuve exposent la coque,
 *  le moral et la cale ; terre l'allure, les bêtes, la saison. `onDossier` : ouvre l'écran de
 *  consultation du porteur (Dossier navire) depuis les tuiles-navire. */
export function voyageTiles(
  sub: 'mer' | 'fleuve' | 'terre',
  plan: TravelPlan,
  vessel: CampaignVessel | null,
  party: Combatant[],
  possessions: Possession[],
  gameTime: number,
  onDossier?: () => void,
  /** Météo du jour EN COURS (`currentTravelDayWeather`) — terre / fleuve NON joué (transport payant
   *  sans navigation) seulement : mer et fleuve JOUÉ ont leur propre système météo (tuiles dédiées). */
  dayWeather?: TravelRecapDay['weather'],
): VoyageTile[] {
  const tiles: VoyageTile[] = [];
  if (sub === 'mer' && plan.sea) {
    const sea = plan.sea;
    // Vent (direction + force) — la tuile Météo (ci-dessous) porte les 3 AUTRES aspects MDG du jour.
    tiles.push({ key: 'vent', icon: 'nautical/wind', label: 'Vent', value: `${windForceLabel(sea.weather.vent)} — vent de ${libelleDeValeur(windDirectionSchema, sea.windFrom)}` });
    // Météo du jour (MDG 13 l.164) : Précipitations/Température/Visibilité — 4e aspect (Vent) déjà sa tuile.
    tiles.push({
      key: 'meteo',
      icon: 'rest/rain',
      label: 'Météo',
      value: `${precipitationDef(sea.weather.precipitations).label} · ${temperatureDef(sea.weather.temperature).label} · ${visibilityDef(sea.weather.visibilite).label}`,
    });
    if (vessel) {
      const vd = findVehicleById(vessel.vehicleId);
      const hullGauge = vesselHullGauge(vessel)!;
      const capacity = vd?.ship?.capacity ?? 0;
      const cargoEnc = cargoTotalEnc(vessel.cargo ?? []);
      tiles.push({ key: 'coque', icon: 'scenario/port', label: 'Coque', value: `${hullGauge.current} / ${hullGauge.max}`, gauge: { value: hullGauge.current, max: hullGauge.max, tone: hullGauge.tone }, onClick: onDossier, title: 'Dossier du navire' });
      tiles.push({ key: 'moral', icon: 'nav/seat-owner', label: 'Moral', value: `${vessel.morale.score} — ${moraleBand(vessel.morale.score).label}`, gauge: { value: vessel.morale.score, max: 100, tone: moraleGaugeTone }, onClick: onDossier });
      if (vessel.provisions != null) tiles.push({ key: 'provisions', icon: 'item/misc', label: 'Provisions', value: `${vessel.provisions} j-homme` });
      tiles.push({ key: 'cale', icon: 'item/misc', label: 'Cale', value: `${cargoEnc} / ${capacity} Enc`, gauge: { value: cargoEnc, max: Math.max(capacity, 1), tone: cargoGaugeTone }, onClick: onDossier });
    }
    return tiles;
  }
  if (sub === 'fleuve' && plan.river) {
    const river = plan.river;
    tiles.push({ key: 'vent', icon: 'nautical/wind', label: 'Vent du jour', value: `${riverForceLabel(river.windForce)} · ${riverDirLabel(river.windDir)}` });
    const hull = plan.vehicle;
    if (hull) tiles.push({ key: 'coque', icon: 'scenario/port', label: 'Coque de la barge', value: `${hull.wounds.current} / ${hull.wounds.max}`, gauge: { value: hull.wounds.current, max: hull.wounds.max, tone: hullTone }, onClick: onDossier });
    if (vessel?.provisions != null) tiles.push({ key: 'provisions', icon: 'item/misc', label: 'Provisions', value: `${vessel.provisions} j-homme` });
    pushCargoTile(tiles, party, possessions); // chargement porté par les bêtes/véhicules embarqués (#327)
    return tiles;
  }
  // TERRE, ou transport PAYANT non JOUÉ (mer/fleuve dérivés du véhicule mais sans état de descente/
  // traversée — un passeur) : la tuile NOMME le mode réel du plan (Barge/Diligence/…), jamais un
  // repli « À pied » deviné (#333 correctif).
  const allureBased = plan.mode === 'monture' || !!plan.allure;
  tiles.push({
    key: 'allure',
    icon: 'travel/foot',
    label: allureBased ? 'Allure' : 'Transport',
    value: plan.allure ? allureLabel(plan.allure)
      : plan.mode === 'monture' ? 'En selle'
        : plan.mode === 'pied' ? 'À pied'
          : travelModeLabels()[plan.mode] ?? plan.mode,
  });
  // Météo du jour EN COURS (règle `travel-etapes`, EDOC 8) — absente si la règle est éteinte ou
  // qu'aucun jour n'est encore engagé.
  if (dayWeather) tiles.push({ key: 'meteo', icon: 'rest/rain', label: 'Météo', value: weatherCondition(dayWeather.id).label });
  const mounts = partyMounts(party, possessions);
  if (mounts.length) {
    const hurt = mounts.filter((m) => m.possession.mountInjury).length;
    tiles.push({ key: 'betes', icon: 'travel/mount', label: 'Bêtes', value: `${mounts.length}${hurt ? ` · ${hurt} blessée${hurt > 1 ? 's' : ''}` : ''}` });
  }
  pushCargoTile(tiles, party, possessions); // chargement porté par les bêtes/véhicules du convoi (#327)
  const season = seasonOfMonth(toDate(gameTime).month);
  tiles.push({ key: 'saison', icon: 'rest/cold', label: 'Saison', value: seasonLabel(season) });
  return tiles;
}

/** CHRONIQUE (gabarit #257) : une carte par jour CLOS (`plan.log`) + le jour EN COURS (`current`).
 *  `stepWord` = « Jour » (mer/fleuve) ou « Étape » (terre) ; `pendingActive` = une étape attend ;
 *  `agenda` = ses sous-phases (fait/en cours/à venir, cf. `dayAgenda`) — carte `current` seulement.
 *  `pendingDay` (vague « lisibilité du voyage » 2/2) : le jour tout juste CLOS d'une halte de nuit
 *  EN COURS (`pendingRest.travelDay`) — le BILAN sort du panneau de nuit (la DÉCISION seule y reste) :
 *  ce jour devient une carte SÉLECTIONNABLE comme un jour passé, et `current` bascule sur la Nuit elle-même. */
export function voyageDayCards(
  plan: TravelPlan, sub: 'mer' | 'fleuve' | 'terre', stepWord: string, pendingActive: boolean,
  agenda: DayAgendaItem[] = [], pendingDay?: TravelRecapDay,
): VoyageDayCard[] {
  const log = plan.log ?? [];
  const cards: VoyageDayCard[] = log.map((d, i) => ({ key: `d${i}`, seal: String(i + 1), dayLabel: `${stepWord} ${i + 1}`, summary: dayCardSummary(d, sub) }));
  if (pendingDay) cards.push({ key: `d${log.length}`, seal: String(log.length + 1), dayLabel: `${stepWord} ${log.length + 1}`, summary: dayCardSummary(pendingDay, sub) });
  cards.push({
    key: 'current',
    seal: pendingDay ? '•' : String(log.length + 1),
    dayLabel: pendingDay ? 'Nuit' : `${stepWord} ${log.length + 1}`,
    summary: pendingActive ? 'EN COURS…' : 'La traversée suit son cours.',
    current: true,
    agenda,
  });
  return cards;
}

/** Coquille store-connectée : lit le voyage en cours, dérive les tuiles/chronique et incruste la cascade
 *  du jour en son centre. `onClose` = minimiser le hub (rendu par `CampaignView`). */
export function VoyageScreen({ onClose }: { onClose: () => void }) {
  const plan = useGame((s) => s.travelPlan);
  const worldMap = useGame((s) => s.worldMap);
  const vessel = useGame((s) => s.vessel);
  const party = useGame((s) => s.party);
  const possessions = useGame((s) => s.possessions);
  const gameTime = useGame((s) => s.gameTime);
  const pendingCascade = useGame((s) => s.pendingCascade);
  const pendingRest = useGame((s) => s.pendingRest);
  const pendingShoreLeave = useGame((s) => s.pendingShoreLeave);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [selDay, setSelDay] = useState<number | null>(null); // index dans le log ; null = jour EN COURS
  if (!plan) return null;

  const sub = voyageMode(plan);
  const sea = sub === 'mer';
  const fromLabel = libelleOuAbsence(worldMap ? placeById(worldMap, plan.fromPlaceId) : undefined, 'lieu', plan.fromPlaceId);
  const toLabel = libelleOuAbsence(worldMap ? placeById(worldMap, plan.toPlaceId) : undefined, 'lieu', plan.toPlaceId);
  const log = plan.log ?? [];
  const dayNum = log.length + 1;
  const stepWord = sub === 'terre' ? 'Étape' : 'Jour';
  const kmLeft = Math.max(0, plan.km - plan.kmDone);
  // ETA = distance restante ÷ ALLURE RÉELLE du mode (dernier jour clos parcouru) — mode-agnostique, tiré
  // du flux (aucune vitesse inventée). Sans jour clos encore, l'estimation est omise.
  const lastDay = log[log.length - 1];
  const rate = lastDay ? lastDay.kmTo - lastDay.kmFrom : 0;
  const etaDays = rate > 0.5 ? Math.ceil(kmLeft / rate) : null;

  const dossier = vessel ? () => setDossierOpen(true) : undefined;
  const dayWeather = currentTravelDayWeather(plan, pendingRest);
  const tiles = voyageTiles(sub, plan, vessel, party, possessions, gameTime, dossier, dayWeather);

  const agenda = dayAgenda(pendingCascade, pendingRest);
  const days = voyageDayCards(plan, sub, stepWord, !!pendingCascade || !!pendingRest, agenda, pendingRest?.travelDay);
  const selectedKey = selDay == null ? 'current' : `d${selDay}`;
  // Clic d'une SOUS-RANGÉE de phase (jour EN COURS) : phase COURANTE → centre live (relâche/nuit/cascade) ;
  // phase CLOSE d'une nuit de halte → le jour tout juste clos (`pendingRest.travelDay`, dernier index) ;
  // sinon (cascade en vol) → le centre live où les phases faites sont des rangées-témoins.
  const closedDayIdx = pendingRest?.travelDay ? log.length : null;
  const onPhase = (a: DayAgendaItem) => {
    if (a.state === 'done' && a.key !== 'nuit' && closedDayIdx != null) setSelDay(closedDayIdx);
    else setSelDay(null);
  };
  // Jour tout juste CLOS (halte de nuit ouverte) : lookup ÉTENDU du log — le bilan ne vit plus dans le
  // panneau de nuit (vague « lisibilité du voyage » 2/2), il se consulte comme n'importe quel jour passé.
  const fullDays = pendingRest?.travelDay ? [...log, pendingRest.travelDay] : log;

  // Priorité de rendu du centre : une SÉLECTION EXPLICITE (peek d'un jour passé, y compris celui qui
  // vient de clore) prime ; sinon l'ÉTAPE qui attend (repos > cascade) ; sinon le point courant.
  let center: ReactNode;
  if (selDay != null && fullDays[selDay]) {
    center = <TravelDayBody day={fullDays[selDay]} />;
  } else if (pendingShoreLeave) {
    center = <ShoreLeaveBody embedded />; // accostage : la relâche à terre vit dans le journal de voyage (arbitrage user 2026-07-11)
  } else if (pendingRest) {
    center = <RestBody embedded />; // nuit de halte incrustée (MÊME rendu que la modale, #333 correctif) — DÉCISION seule
  } else if (pendingCascade) {
    center = <CascadeBody embedded />; // étape du jour incrustée (MÊME rendu que la modale)
  } else {
    center = <p className="voyage-hint">La traversée suit son cours — la prochaine étape s’ouvrira ici.</p>;
  }

  return (
    <>
      <ScreenShell
        className="voyage-screen"
        title={<>
          <Icon id={sea ? 'travel/sail-ship' : sub === 'fleuve' ? 'travel/sail-ship' : 'travel/mount'} size="sm" />
          {' '}{sub === 'mer' ? 'Traversée' : sub === 'fleuve' ? 'Descente' : 'Route'} — {fromLabel} → <b>{toLabel}</b>
        </>}
        onClose={onClose}
        closeLabel="Réduire"
        meta={{ time: gameTime }}
        actions={dossier && <button type="button" className="btn small" onClick={dossier}>Dossier navire</button>}
      >
        <div className="voyage-body">
          <div className="voyage-head">
            <span className="voyage-step">{stepWord} {dayNum}</span>
            {etaDays != null && <span className="voyage-eta"> · ~{etaDays} {sub === 'terre' ? 'jour(s)' : 'jour(s)'} restant{etaDays > 1 ? 's' : ''}</span>}
            <span className="voyage-dist"> · {Math.round(plan.kmDone)} / {routeDistanceLabel(plan.km, sea)}</span>
            <div className="voyage-progress" aria-hidden><div className="voyage-progress-fill" style={{ width: `${plan.km > 0 ? Math.min(100, Math.round((plan.kmDone / plan.km) * 100)) : 0}%` }} /></div>
          </div>
          <div className="voyage-tiles">
            {tiles.map((t) => {
              const inner = <>
                <span className="voyage-tile-label"><Icon id={t.icon} size="sm" /> {t.label}</span>
                <span className="voyage-tile-value">{t.value}</span>
                {t.gauge && <NotchGauge label={t.label} value={t.gauge.value} max={t.gauge.max} min={t.gauge.min} marks={t.gauge.marks} tone={t.gauge.tone} format={t.gauge.format} stacked />}
              </>;
              return t.onClick
                ? <button key={t.key} type="button" className="voyage-tile clickable" onClick={t.onClick} title={t.title}>{inner}</button>
                : <div key={t.key} className="voyage-tile">{inner}</div>;
            })}
          </div>
          <MasterDetail
            className="voyage-master"
            listLabel="Journal de voyage"
            list={
              <div className="voyage-chronicle">
                {days.map((c) => {
                  const active = selectedKey === c.key;
                  // Carte SANS phases (jour clos, ou point courant sans étape) : bouton simple → sélection.
                  if (!c.agenda?.length) {
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className={`voyage-day-card tx-parchment${active ? ' active' : ''}${c.current ? ' current' : ''}`}
                        onClick={() => setSelDay(c.current ? null : Number(c.key.slice(1)))}
                      >
                        <span className="voyage-seal" aria-hidden>{c.seal}</span>
                        <span className="voyage-day-body">
                          <span className="voyage-day-title">{c.dayLabel}</span>
                          <span className="voyage-day-summary">{c.summary}</span>
                        </span>
                      </button>
                    );
                  }
                  // Carte EN COURS (arbitrage user verbatim : « sous-catégories en dessous, plus que du
                  // texte concaténé ») : titre-carte + SOUS-RANGÉES de phases, chacune son glyphe d'état,
                  // CLIQUABLE quand son contenu existe (courante → centre live ; close → jour clos).
                  return (
                    <div key={c.key} className={`voyage-day-card tx-parchment current has-phases${active ? ' active' : ''}`}>
                      <button type="button" className="voyage-day-head" onClick={() => setSelDay(null)}>
                        <span className="voyage-seal" aria-hidden>{c.seal}</span>
                        <span className="voyage-day-title">{c.dayLabel} — EN COURS</span>
                      </button>
                      <div className="voyage-phase-list">
                        {c.agenda.map((a) => {
                          const inner = <>
                            <span className="voyage-phase-glyph" aria-hidden>{AGENDA_GLYPH[a.state]}</span>
                            <span className="voyage-phase-label">{a.label}{a.jets ? ` (${a.jets} jet${a.jets > 1 ? 's' : ''})` : ''}</span>
                          </>;
                          return a.state === 'pending'
                            ? <span key={a.key} className="voyage-phase-row pending">{inner}</span>
                            : <button key={a.key} type="button" className={`voyage-phase-row ${a.state}`} onClick={() => onPhase(a)}>{inner}</button>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
            detail={<div className="voyage-detail">{center}</div>}
          />
        </div>
      </ScreenShell>
      {dossierOpen && vessel && <ShipDossier onClose={() => setDossierOpen(false)} />}
    </>
  );
}
