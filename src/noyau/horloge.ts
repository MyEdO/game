/** Horloge de jeu : l'avance du temps et ce qui la suit hors combat (#668, #T2, #T3). */
import { pushReveal } from './combatEffects';
import { fireScheduledEffects } from './combatEffects';
import { purgeSurAvanceDHorloge } from './upkeep';
import { TIME_COST } from '../engine/timeCost';
import { outOfCombatUpkeep } from './outOfCombatUpkeep';
import { battleRng } from './battleRng';
import { releaseSeatsOfDowned } from './combatFlow';
import { type DeferredUpkeepTest, runDailyUpkeep } from './upkeep';
import { nightBands } from './nightBands';
import * as restFlow from './restFlow';
import { openSequence } from './rollSeam';
import { checkPartyWiped } from './partyWipe';
import type { Get, Set, SetDesClesReservees } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { FragmentDeTables } from './tablesPosees';

/** L'UNIQUE écrivain de l'avance d'horloge (#668, #1599, #2817 D7) : tout chemin qui fait passer le temps
 *  (advanceTime, repos, voyages terrestre, fluvial et en mer, chantier naval) l'appelle. */
export function creerActionsDAvanceeDHorloge(get: Get, set: SetDesClesReservees) {
  return {
    avancerLHorloge: (minutes) => {
      set({ gameTime: get().gameTime + minutes });
      fireScheduledEffects(get, set);
      purgeSurAvanceDHorloge(get, set);
    },
  } satisfies Partial<ActionsDuNoyau>;
}

export function creerActionsDHorloge(get: Get, set: Set) {
  return {
    advanceTime: (minutes) => {
      if (minutes <= 0) return;
      get().avancerLHorloge(minutes);

      // HORS COMBAT : faire progresser les États qui tickent (Hémorragique/Poison/Flammes) et l'agonie au
      // prorata du temps écoulé (1 Round ≈ TIME_COST.combatRound min). En combat, la frontière de Round le fait.
      if (!get().battle) {
        const rounds = Math.floor(minutes / TIME_COST.combatRound);
        if (rounds > 0) {
          const party = get().party;
          const log = outOfCombatUpkeep(party, rounds, battleRng());
          if (log.length) { set({ party: [...party] }); get().log(log); }
          // L'agonie hors combat est la SEULE voie par laquelle un corps assis s'éteint sans combat :
          // la couture unique de libération y est appelée (no-op si personne n'est assis).
          releaseSeatsOfDowned(get, set);
        }
      }
      // Entretien quotidien (#T2/#T3 — rations/faim, maladies, convalescence) + purge des effets à
      // durée d'horloge (contrecoups LDB 46/40) : traite les éventuels franchissements de jour.
      // VISIBLE (le journal seul ne suffit pas). HORS COMBAT, tout Test de Résistance d'entretien est
      // DIFFÉRÉ dans la MÊME cascade influençable que le repos (LDB 17 : Chance sur tout Test raté ; « aucun
      // jet silencieux ») via `deferredUpkeepSteps` ; les lignes SANS jet (rations, dissipations…) restent
      // le témoin groupé. En combat, le slot de cascade appartient à l'arène → jets roulés (témoin pré-résolu).
      if (get().battle) {
        // EN COMBAT (#253) : le slot de cascade appartient à l'arène → les Tests de Résistance d'entretien ne
        // s'ouvrent pas ici. On les DIFFÈRE dans `pendingUpkeepSteps` (consommé par `openCombatEndCascade` à la
        // fin du combat) au lieu de les rouler en SILENCE ; les lignes SANS jet (rations, dissipations) restent
        // le témoin. `lastUpkeepDay` (posé par `runDailyUpkeep`) garde l'anti-double-résolution.
        const deferred: DeferredUpkeepTest[] = [];
        const upkeepLines = runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
        if (upkeepLines.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: upkeepLines, severity: 'minor' });
        // La file porte des BANDES comme tout le reste de la nuit (#1117 L3) : la fenêtre est formée
        // ICI, à l'émission — `openCombatEndCascade` a seulement à trier ses rangées par pilote.
        const steps = nightBands(restFlow.deferredUpkeepSteps(get().party, deferred));
        if (steps.length) set({ deferredUpkeepQueue: [...get().deferredUpkeepQueue, ...steps] });
      } else {
        const deferred: DeferredUpkeepTest[] = [];
        const upkeepLines = runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
        // 2ᵉ des TROIS bâtisseurs à passer par la fabrique de bandes (#1117 L3).
        const steps = nightBands(restFlow.deferredUpkeepSteps(get().party, deferred));
        if (steps.length) openSequence(get, set, { title: 'Entretien quotidien', icon: 'time/night', purpose: 'upkeep', steps, log: upkeepLines });
        // Même `purpose:'upkeep'` que la branche à jets ci-dessus : les deux issues du MÊME entretien
        // quotidien ouvrent la MÊME séquence (le témoin groupé est le cas « zéro jet à influencer »).
        else if (upkeepLines.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: upkeepLines, severity: 'minor' }, { purpose: 'upkeep' });
      }
      checkPartyWiped(get, set); // faim/agonie/maladie a-t-elle anéanti tout le groupe hors combat ? → défaite (recheck à la clôture de cascade)
    },
  } satisfies Partial<ActionsDuNoyau>;
}

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    /** L'horloge avance APRÈS le Flow de son site — verbe de CLÔTURE (#1508). */
    avancerHorloge: (get, _set, c) => get().advanceTime(c.minutes),
  },
} satisfies FragmentDeTables;
