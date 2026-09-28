import { useGame } from '../state/store';
import { Modal } from './Modal';
import { MultiRollList } from './MultiRollList';
import { RecapLineSections } from './RecapLine';
import { travelModeLabels, routeDistanceLabel } from '../engine/travel';
import type { TravelRecap } from '../state/travelFlow';
import { GameDate } from './GameDate';
import { SeaVoyageBody } from './SeaVoyageScreen';
import { Icon } from './Icon';

/** Corps PARTAGÉ du rapport d'une journée de route : péripéties/entretien en LIGNES STRUCTURÉES
 *  sectionnées par phase (#349, `RecapLineSections`) + JETS en multijet (MÊME brique que le bilan de
 *  nuit) — utilisé par la halte du soir (RestModal) et le recap de voyage. Une seule présentation des
 *  journées, pas deux. */
export function TravelDayBody({ day }: { day: import('../state/travelFlow').TravelRecapDay }) {
  // MER (route COMMANDÉE) : l'écran de traversée dédié (rose des vents + jauges + PV) remplace le corps
  // de recap terrestre — une seule surface de jour, propre à la mer.
  if (day.sea) return <SeaVoyageBody day={day} />;
  return (
    <>
      <RecapLineSections lines={day.lines} />
      {(day.entries?.length ?? 0) > 0 && <MultiRollList entries={day.entries!} />}
    </>
  );
}

/**
 * Récapitulatif de voyage (audit M4) — la résolution d'un trajet est SYNCHRONE (l'horloge saute
 * en bloc) : cette modale raconte au joueur ce qui vient de se passer, jour par jour (fatigue,
 * marche forcée, péripéties), à l'ARRIVÉE, à l'INTERRUPTION (péripétie → on explique où on est
 * et comment reprendre) et à l'ARRÊT (surcharge). « Continuer le voyage » ré-ouvre la carte
 * (audit M5 — trajets d'étape en étape).
 *
 * `seam` : rendu statique de test (le store SSR sert l'état initial — cf. WorldMapView).
 */
export function TravelRecapModal({ seam }: { seam?: TravelRecap } = {}) {
  const storeRecap = useGame((s) => s.travelRecap);
  const gameTime = useGame((s) => s.gameTime);
  const dismiss = useGame((s) => s.dismissTravelRecap);
  const openWorldMap = useGame((s) => s.openWorldMap);
  const recap = seam ?? storeRecap;
  if (!recap) return null;
  const ambush = !!recap.then; // une embuscade ATTEND : l'acquittement déclenche le combat
  const sea = recap.mode === 'mer'; // route MARITIME : `km` porte des MILLES (cf. `routeDistanceLabel`)
  const title = ambush
    ? <><Icon id="action/attack" size="sm" /> Embuscade en chemin !</>
    : recap.status === 'arrived'
      ? <><Icon id="scenario/travel" size="sm" /> Arrivée à {recap.toLabel}</>
      : recap.status === 'interrupted'
        ? <><Icon id="scenario/travel" size="sm" /> Voyage interrompu !</>
        : <><Icon id="scenario/travel" size="sm" /> Le convoi s'arrête</>;
  const kmLeft = Math.max(0, Math.round(recap.km - recap.kmDone));
  const onContinue = () => { dismiss(); openWorldMap(); };
  return (
    <Modal title={title} onClose={dismiss} backdropClose={!ambush}
      footer={
        <>
          {!ambush && <button className="btn" onClick={dismiss}>Fermer</button>}
          {ambush
            ? <button className="btn btn-primary" onClick={() => dismiss()}><Icon id="action/attack" size="sm" /> Faire face</button>
            : recap.status === 'arrived'
              ? <button className="btn btn-primary" onClick={onContinue}><Icon id="nav/campaign" size="sm" /> Continuer le voyage</button>
              : <button className="btn btn-primary" onClick={onContinue}><Icon id="nav/campaign" size="sm" /> Ouvrir la carte</button>}
        </>
      }
    >
      <p className="travel-recap-route">
        {recap.fromLabel} → <b>{recap.toLabel}</b> · {routeDistanceLabel(recap.km, sea)}, {travelModeLabels()[recap.mode].toLowerCase()}
        {recap.status !== 'arrived' && <> · <b>{kmLeft > 0 ? `${routeDistanceLabel(kmLeft, sea)} restants` : `aux portes de ${recap.toLabel}`}</b></>}
      </p>
      {/* ARRIVÉE amincie (diagnostic fil 4, vague « lisibilité 2/2 ») : un ACCUSÉ (route + durée +
          date), pas le dump jour par jour — il fait doublon avec la halte du soir / la chronique du
          hub. `interrupted`/`stalled` GARDENT le déroulé : seule trace de la raison de l'arrêt. */}
      {recap.status === 'arrived' ? (
        <p className="travel-recap-foot">
          Voyage de {recap.daysTotal ?? recap.days.length} jour{(recap.daysTotal ?? recap.days.length) > 1 ? 's' : ''}.
          {' '}Le groupe arrive le <GameDate time={gameTime} />.
        </p>
      ) : (
        <ol className="travel-recap-days">
          {recap.days.map((d, i) => (
            <li key={i}>
              <span className="travel-recap-day">
                Jour {i + 1} — {routeDistanceLabel(d.kmTo - d.kmFrom, sea)} en {Math.round(d.hours)} h de route
              </span>
              <TravelDayBody day={d} />
            </li>
          ))}
        </ol>
      )}
      {ambush ? (
        <p className="travel-recap-foot">Impossible de poursuivre : il faut faire face. (Le voyage pourra reprendre ensuite depuis la carte <Icon id="nav/campaign" size="sm" />.)</p>
      ) : recap.status === 'interrupted' ? (
        <p className="travel-recap-foot">Le voyage pourra reprendre depuis la carte du monde (<Icon id="nav/campaign" size="sm" />).</p>
      ) : recap.status === 'stalled' ? (
        <p className="travel-recap-foot">Le groupe est trop chargé pour avancer — allégez les sacs, puis reprenez depuis la carte.</p>
      ) : null}
    </Modal>
  );
}
