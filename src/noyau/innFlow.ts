/**
 * RUMEURS D'AUBERGE (#352) — action de collecte HORS voyage, au hub de ville (`CityHubScreen`, panneau
 * « auberge »). PAS un jet neuf : c'est l'Activité de voyage CANONIQUE `recueillir-informations`
 * (`src/data/activities.json`, Compétence `ragot`, EDOC 8 l.151-153, `stageOutcome: gatherInfo`)
 * étendue au contexte `auberge` (`ActivityContext`, `engine/activities.ts`) et jouée ICI comme un Test
 * INDÉPENDANT (hors cascade de jour) via le seam UNIQUE `openRoll` (`rollSeam.ts`) — même patron que le
 * Ragot commercial / l'Évaluation du Vin de `landMarketFlow.ts` (#274).
 *
 * Succès → rumeur commerciale via le générateur EXISTANT `generateTradeRumour` (`landMarketFlow.ts`,
 * MSRC 13 l.180), affichée par le panneau « Rumeurs déjà glanées » (déjà câblé sur `store.tradeRumours`)
 * — zéro prose de rumeur inventée ici. Échec → Exténué (EDOC 8 l.133, `ActivityDef.failExtenue`),
 * comme la version voyage (`travelPostes.ts`). Durée en POLICY maison (`auberge-recueillir-informations-minutes`,
 * `engine/policy.ts`) : l'horloge de campagne avance quelle que soit l'issue — « tout est horodaté ».
 */
import { battleRng } from './battleRng';
import { activityStakeRef } from '../data';
import { activityById } from '../engine/activities';
import { DIFFICULTE_PAR_DEFAUT } from '../engine/types';
import { applyOps, type GameOp } from '../engine/ops';
import { openPartyTest, freeCons } from './rollSeam';
import { generateTradeRumour } from './landMarketFlow';
import { rule } from '../engine/policy';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';

const ACTIVITY_ID = 'recueillir-informations';
const INN_GOSSIP_KIND = 'rumeurDAuberge';

/** Durée (minutes) de l'Activité jouée à l'auberge — `rule('auberge-recueillir-informations-minutes')`, maison éditable. */
export function innGatherInfoMinutes(): number {
  return Number(rule('auberge-recueillir-informations-minutes'));
}

/** Ouvre le Test de Ragot de l'auberge (activité `recueillir-informations`, contexte `auberge`). Silence
 *  attendu si aucun héros n'a la Compétence (`openRoll` : garde `partyBest` sans candidat, D3). */
export function recueillirLesRumeurs(get: Get, set: Set): void {
  const def = activityById(ACTIVITY_ID);
  const test = def?.tests?.[0];
  if (!def || !test?.skill) return;
  openPartyTest(get, set, {
    skill: test.skill, assisted: false,
    actionLabel: def.label,
    difficulty: test.difficulty ?? DIFFICULTE_PAR_DEFAUT,
    stake: activityStakeRef(ACTIVITY_ID),
  }, INN_GOSSIP_KIND, {});
}

export function creerActionsDeLAuberge(get: Get, set: Set) {
  return {
    recueillirLesRumeurs: () => recueillirLesRumeurs(get, set),
  } satisfies FabriqueDuNoyau;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [INN_GOSSIP_KIND] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    [INN_GOSSIP_KIND]: (get, set, step, hero) => {
      get().avancerLeTemps(innGatherInfoMinutes()); // « tout est horodaté » : quelle que soit l'issue
      if (step.result?.success) {
        const placeId = get().lieu ?? '';
        generateTradeRumour(get, set, placeId, battleRng());
        return {};
      }
      const def = activityById(ACTIVITY_ID);
      // EDOC 8 l.153 : aucune rumeur récoltée — branche d'ÉCHEC (#349, dette 1 : ton dérivé, pas une chaîne muette).
      const cons = freeCons([{ text: 'Personne ne semble savoir grand-chose ce soir-là.', tone: 'echec' }]);
      if (def?.failExtenue && hero) {
        const op: GameOp = { op: 'condition', id: { id: 'extenue' }, value: 1 }; // EDOC 8 l.133
        applyOps(hero, [op], { idNeuf: get().forgerUnId, rng: battleRng(), source: { kind: 'activite', id: ACTIVITY_ID } });
        set({ party: [...get().party] });
        cons.push({ ops: [op] });
      }
      return { consequences: cons };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
} satisfies FragmentDeTables;
