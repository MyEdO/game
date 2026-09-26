import { pregen, PREGEN } from '../../data/pregens';
import type { Combatant } from '../../engine/types';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { Dialogue } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * Le combat « complet » de référence (exploration → dialogue → 5 mutants, ch.2). Son groupe absorbe les
 * anciens micro-tests Critiques/Mort, Destin/Résilience et Guérison : dans une vraie bagarre dangereuse,
 * chacun de ces mécanismes se déclenche naturellement — pas besoin d'un scénario dédié par mécanique.
 *  - Sigmund (Soldat) garde Destin + Résilience → sauvetage par le Destin / réussite garantie.
 *  - Klein (Voleur Halfling, peu de Blessures) n'a plus aucun Destin → 0 PB mène vraiment à
 *    À Terre → Inconscient → mort (cascade de Traumatisme).
 *  - Frère Anselm (Prêtre) sait Guérison → Action Soigner / arrêt d'Hémorragie sur un allié qui tombe.
 */
function groupe(): Combatant[] {
  const sigmund = pregen(PREGEN.soldat); // Destin/Résilience intacts (sauvetage in extremis)
  const grunni = pregen(PREGEN.tueur);
  const anselm = pregen(PREGEN.pretre);
  if (!anselm.skills.some((s) => s.id === 'guerison')) {
    anselm.skills.push({ id: 'guerison', characteristic: 'intelligence', advances: 25 }); // sinon pas d'Action Soigner
  }
  const klein = pregen(PREGEN.voleur); // Halfling fragile
  klein.fate = 0;
  klein.fortune = 0;
  klein.resilience = 0;
  klein.resolve = 0;
  return [sigmund, grunni, anselm, klein];
}

/**
 * SCÈNE « Du Sang sur la Route » (fidèle à `public/ambush.html`), migrée sur `buildScene(MapSpec)`.
 *
 * Une diligence éventrée en travers d'une route forestière ; ses passagers gisent, dépecés. Des MUTANTS de
 * morphologies variées (charognard quadrupède, homme-chien hurlant, tête-ogive, pattes-de-chèvre) se
 * repaissent des cadavres — composés par le rig (parts monstrueuses) et animés en CSS (feed/howl/wrap…).
 * L'approche déclenche un DIALOGUE ; sa fin lance le COMBAT. Le décor (épave, corps, sang) reste visible.
 *
 * Terrain EXPLICITE case-à-case (légende {R:route, B:bois}) : grand-route est-ouest (rangées 6-7),
 * forêt dense qui enferme la route au nord (rangées 0-2) et au sud (rangées 11-13), plus des îlots de bois.
 */
const dialogues: Dialogue[] = [
  {
    id: 'dlg-ambush',
    start: 'a1',
    nodes: [
      {
        id: 'a1',
        desc:
          "La forêt se referme sur la route. Plus loin, une diligence gît renversée, l'attelage " +
          "éventré, les bagages crevés et répandus dans la boue. Penchées sur les corps des voyageurs, " +
          "des silhouettes difformes s'en repaissent à pleines dents — l'une, à quatre pattes, fouille " +
          "un ventre ouvert ; une autre, museau dressé, hurle vers la canopée. Une gueule ensanglantée " +
          "se tourne lentement vers vous.",
        choices: [
          {
            label: 'Fondre sur les charognards avant qu’ils ne se ruent.',
            flow: flowFromEffects([
              { type: 'journal', desc: "Vous chargez — l'acier contre la chair corrompue." },
              { type: 'endDialogue' },
              { type: 'startCombat', encounter: 'enc-mutants' },
            ]),
          },
          { label: 'Reculer sans bruit vers le couvert…', next: 'a2' },
        ],
      },
      {
        id: 'a2',
        desc:
          'Une branche craque sous votre botte. Aussitôt les créatures relèvent la tête, naseaux ' +
          'frémissants — elles ont flairé le sang neuf. Elles abandonnent leur festin et bondissent ' +
          'vers vous en hurlant, gueules béantes.',
        choices: [
          {
            label: 'Au combat !',
            flow: flowFromEffects([
              { type: 'endDialogue' },
              { type: 'startCombat', encounter: 'enc-mutants' },
            ]),
          },
        ],
      },
    ],
  },
];

const scene = buildScene({
  id: 'ambush-test',
  label: 'Du Sang sur la Route — scène de test',
  desc:
    'Route forestière. Une diligence éventrée, ses passagers dépecés, des mutants de toutes ' +
    "formes qui s'en repaissent. L'approche déclenche un dialogue, dont la fin lance le combat.",
  ambiance: 'exterieur',
  size: [20, 14],
  terrain: 'herbe',
  legend: { R: 'route', B: 'bois' },
  // Grand-route est-ouest (rangées 6-7), forêt qui enferme la route (nord 0-2, sud 11-13) + îlots.
  levels: {
    z0: [
      'BBBBBBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBBBBBB',
      'B.B.B.B.B.B.B.B.B.B.',
      '....B....B....B.....',
      '....................',
      '....................',
      'RRRRRRRRRRRRRRRRRRRR',
      'RRRRRRRRRRRRRRRRRRRR',
      '....................',
      '.............B......',
      '...B....B.........B.',
      'B..B..B..B..B..B..B.',
      'BBBBBBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBBBBBB',
    ].join('\n'),
  },
  heroStart: [2, 7],
  startMessage:
    'Au détour des arbres, une diligence renversée, des corps éparpillés… et des formes difformes ' +
    'penchées dessus, qui se relèvent en grognant.',
  // — Carnage : la diligence, l'attelage, les voyageurs, le sang (props visibles, décor de combat) —
  entities: [
    { id: 'epave', kind: 'prop', pos: { x: 15, y: 6 }, ref: 'epave-carrosse', label: 'Diligence éventrée' },
    { id: 'cheval', kind: 'prop', pos: { x: 12, y: 6 }, ref: 'cheval-mort', label: 'Attelage éventré' },
    { id: 'corps1', kind: 'prop', pos: { x: 11, y: 7 }, ref: 'cadavre', label: 'Voyageur dépecé' },
    { id: 'corps2', kind: 'prop', pos: { x: 14, y: 8 }, ref: 'cadavre', label: 'Voyageur dépecé' },
    { id: 'corps3', kind: 'prop', pos: { x: 17, y: 7 }, ref: 'cadavre', label: 'Voyageur dépecé' },
    { id: 'sang1', kind: 'prop', pos: { x: 13, y: 7 }, ref: 'mare-sang' },
    { id: 'sang2', kind: 'prop', pos: { x: 15, y: 7 }, ref: 'mare-sang' },
    { id: 'sang3', kind: 'prop', pos: { x: 16, y: 8 }, ref: 'mare-sang' },
    { id: 'sang4', kind: 'prop', pos: { x: 12, y: 8 }, ref: 'mare-sang' },
  ],
  dialogues,
  triggers: [
    {
      id: 'approche',
      rect: { x: 8, y: 6, w: 3, h: 2 },
      once: true,
      flow: flowFromEffects([{ type: 'startDialogue', dialogue: 'dlg-ambush' }]),
    },
  ],
  // VISIBLE (hidden par défaut = false) : les mutants qu'on voit se repaître SONT les combattants. L'entité
  // enrôlée porte TOUT — rig 'mutant' + mutation visible + arme + anim d'ambiance + statbloc ch.2. Statblocs
  // CUSTOM fidèles à L'ennemi dans l'Ombre ch.2 (stats VF vérifiées). `ref:'mutant'` = base rig en exploration.
  encounters: [
    {
      id: 'enc-mutants',
      // Embuscade : le groupe est pris par SURPRISE (LDB 13) → la doctrine IA « embuscade » s'auto-sélectionne
      // (#127, signal État Surpris) et l'Avantage de Surprise remplit la réserve ennemie (AA 11 l.63).
      surprise: 'party',
      // Les mutants surgissent du COUVERT des arbres (AA 11 l.64, Terrain léger) → Avantage initial ennemi (#115).
      terrain: { camp: 'enemies' },
      enemies: [
        {
          // Chef : reste en retrait, tire à l'arbalète (À distance dans le Trait — le Trait dérive déjà
          // l'arme de RENDU via `weaponFromTrapping`, plus de `weapon:` d'authoring redondant, #145).
          pos: { x: 17, y: 6 }, ref: 'mutant', appearance: { species: 'humains-reiklander', monster: { tete: 'lezard' } }, anim: 'standing',
          label: 'Knud Cratinx',
          statblock: { type: 'statblock',
            label: 'Knud Cratinx',
            char: { M: 4, 'capacite-de-combat': 36, 'capacite-de-tir': 43, force: 39, endurance: 32, initiative: 35, agilite: 33, dexterite: 29, intelligence: 33, 'force-mentale': 35, sociabilite: 30, B: 12 },
            traits: [{ id: 'a-distance', value: 9, arg: 'arbalete', range: 60 }, { id: 'arme', value: 7, arg: 'arme-simple' }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'ecailles-epineuses' }],
          },
        },
        {
          pos: { x: 17, y: 7 }, ref: 'mutant', appearance: { species: 'humains-reiklander', monster: { tete: 'chien' } }, anim: 'howl',
          label: 'Mikael',
          statblock: { type: 'statblock', label: 'Mikael', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 1 }, traits: [{ id: 'arme', value: 7, arg: 'massue' }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'tete-bestiale-chien' }] },
        },
        {
          pos: { x: 14, y: 8 }, ref: 'mutant', appearance: { species: 'humains-reiklander', monster: { jambes: 'chevre' } }, anim: 'feeding',
          label: 'Erik',
          statblock: { type: 'statblock', label: 'Erik', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 2 }, traits: [{ id: 'arme', value: 7, arg: 'couteau' }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'pattes-chevre' }] },
        },
        {
          pos: { x: 14, y: 7 }, ref: 'mutant', appearance: { species: 'humains-reiklander', monster: { tete: 'ogive' } }, anim: 'standing',
          label: 'Johann',
          statblock: { type: 'statblock', label: 'Johann', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 4 }, traits: [{ id: 'arme', value: 7, arg: 'dague' }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'tete-pointue' }] },
        },
        {
          // « Mutile l'attelage à la hache » → arme dans le Trait (type Grande hache, libellé catalogué → shape).
          pos: { x: 12, y: 7 }, ref: 'mutant', appearance: { species: 'humains-reiklander', monster: { tete: 'minuscule' } }, anim: 'standing',
          label: 'Terenz',
          statblock: { type: 'statblock', label: 'Terenz', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 3 }, traits: [{ id: 'arme', value: 7, arg: 'grande-hache' }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'cretin' }] },
        },
      ],
      // Butin représentatif (#377) : la fouille des mutants tombés donne PX/or (récapitulatif jamais
      // creux) et l'arbalète de Knud Cratinx en équipement ATTRIBUABLE (giveTrapping SANS heroId,
      // cf. `gearFromEffects`) — la scène sert de photo de recette pour « victoire avec butin ».
      onVictory: flowFromEffects([
        { type: 'setFlag', flag: 'embuscade_nettoyee' },
        { type: 'journal', desc: 'La bande de Knud Cratinx gît à son tour. La route, enfin, se tait.' },
        { type: 'giveXp', amount: 100 },
        { type: 'giveMoney', montant: { silver: 15 } },
        { type: 'giveTrapping', trappingId: 'arbalete', identified: true },
      ]),
    },
  ],
});

export const scenario: TestScenario = {
  id: 'embuscade',
  order: 2,
  category: 'combat',
  icon: 'scenario/ambush',
  title: "L'Embuscade",
  tests:
    'Combat complet exploration → dialogue → combat (5 mutants, ch.2). Y surviennent : Critiques & mort ' +
    '(Klein, Destin 0 → cascade À Terre/Inconscient/mort), sauvetage par le Destin & Résilience (Sigmund), ' +
    "Action Soigner & arrêt d'Hémorragie (Frère Anselm) sur un allié qui tombe.",
  partyNote: 'Sigmund (Destin) · Tueur nain · Frère Anselm (soigneur) · Klein le Voleur (fragile, Destin 0)',
  makeParty: groupe,
  scene,
  // pas d'autoCombat : on entre en exploration, le trigger lance le dialogue puis le combat.
};
