/** Horloge de jeu : l'avance du temps et ce qui la suit hors combat (#668, #T2, #T3). */
import { comptePasDifferes, confierLaSuite, fireScheduledEffects, OPS_DIFFEREES, pushReveal } from './combatEffects';
import { purgeSurAvanceDHorloge } from './upkeep';
import { TIME_COST } from '../engine/timeCost';
import { jouerLEntretienDesRoundsEcoules, reprendreEntretienDesRounds } from './outOfCombatUpkeep';
import { releaseSeatsOfDowned } from './combatFlow';
import { type DeferredUpkeepTest, runDailyUpkeep } from './upkeep';
import { nightBands } from './nightBands';
import * as restFlow from './restFlow';
import { openSequence } from './rollSeam';
import { checkPartyWiped } from './partyWipe';
import type { Get, Set, SetDesClesReservees } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { FragmentDeTables } from './tablesPosees';

/** L'UNIQUE écrivain de l'avance d'horloge (#668, #1599, #2817 D7) : tout chemin qui fait passer le temps
 *  (avancerLeTemps, repos, voyages terrestre, fluvial et en mer, chantier naval) l'appelle. */
export function creerActionsDAvanceeDHorloge(get: Get, set: SetDesClesReservees) {
  return {
    avancerLHorloge: (minutes) => {
      set({ gameTime: get().gameTime + minutes });
      fireScheduledEffects(get, set);
      purgeSurAvanceDHorloge(get, set, minutes);
    },
  } satisfies FabriqueDuNoyau;
}

/** Prépare l'entretien quotidien du pas d'horloge après les Rounds. */
export function preparerLEntretienQuotidien(get: Get, set: Set, minutes: number) {
  if (!get().battle && minutes >= TIME_COST.combatRound) releaseSeatsOfDowned(get, set);
  const deferred: DeferredUpkeepTest[] = [];
  const log = runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) }).map(({ text }) => text);
  return { steps: nightBands(restFlow.deferredUpkeepSteps(get().party, deferred)), log };
}

function reprendreEntretienDeLHorloge(get: Get, set: Set, minutes: number, apresLesRounds?: true): void {
  if (!apresLesRounds && jouerLEntretienDesRoundsEcoules(get, set, minutes) === OPS_DIFFEREES) {
    confierLaSuite(set, [{ verbe: 'reprendreEntretienDeLHorloge', minutes, apresLesRounds: true }]);
    return;
  }
  const { steps, log } = preparerLEntretienQuotidien(get, set, minutes);
  if (get().battle) {
    // #253
    if (log.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: log });
    if (steps.length) set({ deferredUpkeepQueue: [...get().deferredUpkeepQueue, ...steps] });
  } else {
    if (steps.length) openSequence(get, set, { title: 'Entretien quotidien', icon: 'temps/nuit', purpose: 'upkeep', steps, log });
    else if (log.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: log }, { purpose: 'upkeep' });
  }
  checkPartyWiped(get, set);
}

export function creerActionsDHorloge(get: Get, set: Set) {
  return {
    avancerLeTemps: (minutes) => {
      if (minutes <= 0) return;
      const avant = comptePasDifferes(get());
      get().avancerLHorloge(minutes);
      if (comptePasDifferes(get()) > avant) {
        confierLaSuite(set, [{ verbe: 'reprendreEntretienDeLHorloge', minutes }]);
        return;
      }
      reprendreEntretienDeLHorloge(get, set, minutes);
    },
  } satisfies FabriqueDuNoyau;
}

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    /** L'horloge avance APRÈS le Flow de son site — verbe de CLÔTURE (#1508). */
    avancerHorloge: (get, _set, c) => get().avancerLeTemps(c.minutes),
    reprendreEntretienDesRounds: (get, set, { reprise }) => { reprendreEntretienDesRounds(get, set, reprise); },
    reprendreEntretienDeLHorloge: (get, set, { minutes, apresLesRounds }) => reprendreEntretienDeLHorloge(get, set, minutes, apresLesRounds),
  },
} satisfies FragmentDeTables;
