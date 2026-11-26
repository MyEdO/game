/** Horloge de jeu : l'avance du temps et ce qui la suit hors combat (#668, #T2, #T3). */
import { comptePorteursDeSuite, confierLaSuite, fireScheduledEffects, MAIN_RENDUE, pushReveal } from './combatEffects';
import { purgeSurAvanceDHorloge } from './upkeep';
import { TIME_COST } from '../engine/timeCost';
import { jouerLEntretienDesRoundsEcoules, reprendreEntretienDesRounds } from './outOfCombatUpkeep';
import { releaseSeatsOfDowned } from './combatFlow';
import { type DeferredUpkeepTest, runDailyUpkeep } from './upkeep';
import { nightBands } from './nightBands';
import * as restFlow from './restFlow';
import { openSequence } from './rollSeam';
import { checkPartyWiped } from './partyWipe';
import { surfaceTientLaMain } from './modalArbiter';
import { refuserGeste } from './refusVisible';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { GesteFermable } from './actionsDuNoyau';
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
  if (!apresLesRounds && jouerLEntretienDesRoundsEcoules(get, set, minutes) === MAIN_RENDUE) {
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

/** Refus du verbe `laisserPasserLeTemps` : en combat (le temps s'y compte en Rounds), sous une fenêtre qui tient la
 *  main (`surfaceTientLaMain`), ou une durée qui n'est pas un nombre entier de minutes, au moins une ; `null` : le
 *  temps passe. Verdict UNIQUE du verbe et de son offre (`gesteDeLaisserPasserLeTemps`). PUR. */
function refusDeLaisserPasserLeTemps(s: Jeu, minutes: number): string | null {
  if (s.battle) return t('temps.refus.enCombat');
  if (surfaceTientLaMain(s)) return t('temps.refus.mainTenue');
  return Number.isInteger(minutes) && minutes > 0 ? null : t('temps.refus.duree');
}

/** L'offre de laisser passer `minutes` minutes (`laisserPasserLeTemps`) : son refus, `refusDeLaisserPasserLeTemps`. PUR. */
export function gesteDeLaisserPasserLeTemps(s: Jeu, minutes: number): GesteFermable {
  return { geste: { verbe: 'laisserPasserLeTemps', args: [minutes] }, refus: refusDeLaisserPasserLeTemps(s, minutes) };
}

export function creerActionsDHorloge(get: Get, set: Set) {
  return {
    laisserPasserLeTemps: (minutes) => {
      const refus = refusDeLaisserPasserLeTemps(get(), minutes);
      if (refus) return void refuserGeste(get, set, refus);
      get().avancerLeTemps(minutes);
    },
    avancerLeTemps: (minutes) => {
      if (minutes <= 0) return;
      const avant = comptePorteursDeSuite(get());
      get().avancerLHorloge(minutes);
      if (comptePorteursDeSuite(get()) > avant) {
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
