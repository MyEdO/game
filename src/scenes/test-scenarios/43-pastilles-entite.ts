import { pregen, PREGEN } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import { flowFromEffects } from '../../state/flow';
import { crewFormationSlots } from '../../state/shipPostes';
import { buildScene } from '../../state/mapSpec';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * PASTILLES D'ENTITÉ (#1411 P2-C, spec HUD combat zone 4) — le banc de recette des gestes qui SORTENT
 * de la console : ils naissent de la CHOSE qui les offre, jamais d'une case de barre.
 *
 * Les trois familles sont réunies AUTOUR DU MÊME HÉROS, adjacentes à sa case d'arrivée — la recette se
 * joue donc sans un pas de déplacement, en un seul tour (anti-grind : le DoD tient en ≤ 2 Rounds) :
 *  • MONTURE (`mount`) — un cheval libre du même camp, à une case ;
 *  • OBJETS AU SOL (`pickup`) — un coffre à DEUX objets : une même entité offre N candidats, donc un
 *    panneau-paramètre né de la pastille (et non une liste) ;
 *  • PIÈCE (`push-engine`) — le bélier ADE II servi par le Soldat (chef de pièce) et son Équipe : la
 *    pastille de l'engin porte « Pousser », et son refus se lit si l'Équipe fond. `man-poste` n'y est
 *    PAS offert : le Soldat sert déjà l'unique pièce du banc (`servablePostes` écarte son propre poste).
 *
 * Le Soldat est CHEF du bélier (`crewIds[0]`) : c'est lui l'actif qui voit les quatre gestes. Les 5
 * servants PNJ (IA) complètent l'Équipe de 6 (ADE II 8 l.233) — sans eux, « Pousser » serait offert
 * mais REFUSÉ (gate `equipage-suffisant`), ce qui est l'autre moitié de la recette.
 */
const RAM_POS = { x: 6, y: 6 };
const RAM_HEADING = 'N' as const;
/** Le Soldat SOLO atterrit une case à l'ouest de `heroStart` (`startCombat`) : (5,6). */
const SOLDAT_POS = { x: 5, y: 6 };
// Ids RÉELS des membres de rencontre : `enemy-<encounterId>-<index>` (`spawnEnemy`) — l'affût est
// l'index 0, la monture l'index 1, les cinq servants les index 2 à 6. Le CHEF est le Soldat (héros).
const RAM_CREW = [
  `pregen-${PREGEN.soldat}`,
  'enemy-enc-pastilles-2', 'enemy-enc-pastilles-3', 'enemy-enc-pastilles-4', 'enemy-enc-pastilles-5', 'enemy-enc-pastilles-6',
];
// Formation rigide autour de l'affût (jamais l'avant, où l'engin frappe) — on écarte la colonne du
// Soldat et les deux cases que la recette réserve à la monture et au coffre.
const RESERVE = [SOLDAT_POS, { x: 5, y: 5 }, { x: 5, y: 7 }];
const SERVANT_SLOTS = crewFormationSlots({ pos: RAM_POS, footprint: 2 }, { crewIds: RAM_CREW }, { heading: RAM_HEADING })
  .filter((p) => !RESERVE.some((r) => r.x === p.x && r.y === p.y));

const scene = buildScene({
  id: 'pastilles-entite',
  label: 'Pastilles d’entité — les gestes vivent sur ce qui les offre',
  desc: 'Une cour de manœuvre : un bélier servi, un cheval libre, un coffre entrouvert.',
  size: [14, 12],
  terrain: 'pave',
  ambiance: 'exterieur',
  ambientLight: 'jour',
  heroStart: [6, 6],
  startMessage:
    'Le Soldat sert le bélier : autour de lui, TROIS choses offrent un geste — le cheval libre (Monter), ' +
    'le coffre à deux objets (Ramasser, panneau borné à ses deux candidats) et l’engin lui-même ' +
    '(Pousser). Chaque geste se clique SUR la chose, jamais dans la barre ; un geste refusé reste ' +
    'visible et dit pourquoi ; Échap referme un panneau sans rien engager.',
  entities: [
    {
      id: 'coffre-de-cour', kind: 'prop', ref: 'coffre', pos: { x: 5, y: 7 }, label: 'Coffre entrouvert',
      usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([
          { type: 'giveTrapping', trappingId: 'dague' },
          { type: 'giveTrapping', custom: 'Fiole d’huile' },
        ]) }] },
    },
  ],
});
setEncounters(scene, [
  {
    id: 'enc-pastilles',
    // Aucune mort n'est requise : la recette porte sur les AFFORDANCES. Le combat reste ouvert le temps
    // de les exercer (`surviveRounds`, évalué sur `battle.round`).
    victoryCondition: { type: 'surviveRounds', rounds: 3 },
    enemies: [
      // L'EMPLACEMENT du bélier — affût inerte 2×2, servi par l'Équipe `RAM_CREW` (le Soldat en tête).
      {
        ref: 'belier-ade2', pos: RAM_POS, facing: RAM_HEADING, side: 'ally',
        postes: [{ item: itemFromTrappingById('belier-ade2')!, crewIds: [...RAM_CREW] }],
      },
      { ref: 'cheval', pos: { x: 5, y: 5 }, mount: true, side: 'ally', label: 'Cheval de manœuvre' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[0], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[1], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[2], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[3], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[4], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'pastilles-entite',
  order: 43,
  category: 'combat',
  icon: 'scenario/siege',
  title: 'Pastilles d’entité — Monter / Ramasser / Pousser',
  tests:
    'Zone 4 de la spec HUD : les gestes d’ENTITÉ (`surface: "pastille-entite"` du registre — `mount`, ' +
    '`pickup`, `push-engine` ; `man-poste` ne s’y offre pas, le Soldat servant DÉJÀ l’unique pièce) ' +
    'naissent de la chose qui les offre et vivent HORS de la ' +
    'console (géométrie immuable). Couvre : une pastille par entité offrante, le panneau-paramètre ' +
    'quand une même entité porte N candidats (coffre à deux objets), le coût affiché, le refus VISIBLE ' +
    'avec sa raison (`equipage-suffisant` si l’Équipe du bélier fond), l’annulation gratuite (Échap, ' +
    're-clic sur « Pousser »), et le picking : cliquer la pastille ne vaut jamais un clic-monde.',
  partyNote: 'Soldat solo, chef de pièce du bélier — cheval et coffre à une case.',
  makeParty: () => [pregen(PREGEN.soldat)],
  scene,
  autoCombat: 'enc-pastilles',
};
