import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

/**
 * « Bataille de masse » (ADE II 08, Le théâtre de la guerre) : vitrine du sous-système de Puissance de
 * Bataille. Deux armées (Puissance 50 vs 55) s'affrontent sur 3 Rounds de bataille.
 *
 * Avant la bataille : jusqu'à 3 Activités pré-combat (Discours, Planification, Repérage, Sabotage…).
 * Chaque Round présente une SITUATION — un SOUS-ENSEMBLE de Scènes du moment (pas tout le catalogue),
 * dont des Scènes ENNEMIES qui s'imposent (Intrus = menace −20 aux autres Scènes ; enchaînements). Scènes
 * MULTI-PJ (ADE II 8 l.116-118) : plusieurs PJ peuvent s'engager dans une Scène de Test/Tenue, résolue
 * en Soutien (LDB 12) ; les combats engagent tout le groupe. Les deltas se cumulent, puis le Test
 * spectaculaire de Puissance résout l'affrontement, et le Rassemblement soigne entre les Rounds.
 */
const scene = buildScene({
  id: 'test-bataille-de-masse',
  label: 'Bataille de masse — le théâtre de la guerre',
  desc: 'Champ de bataille : la plaine devant les remparts.',
  size: [22, 16],
  heroStart: [3, 8],
  startMessage:
    'Deux armées se font face. Un interlude est ouvert : préparez la bataille DEPUIS le menu d\'Activités de ' +
    'l\'interlude (Discours, Planification, Repérage, Sabotage… figurent parmi les Activités par-héros) — chaque ' +
    'préparation puise dans vos Activités « Entre deux aventures » (max 3, budget PARTAGÉ). « Engager la bataille » ' +
    'clôt l\'interlude et lance les Rounds : choisissez vos Scènes de la situation du moment (plusieurs PJ par Scène, ' +
    'en soutien), résolvez le Test spectaculaire de Puissance et rassemblez vos forces. Les Scènes « Pluie de ' +
    'flèches », « Charge », « Tuez la bête ! », « Duel » et « Intrus » vous jettent dans une vraie mêlée.',
  encounters: [
    { id: 'enc-charge', enemies: [
      { ref: 'mutant', pos: { x: 12, y: 6 } },
      { ref: 'mutant', pos: { x: 13, y: 8 } },
      { ref: 'mutant', pos: { x: 12, y: 10 } },
      { ref: 'mutant', pos: { x: 14, y: 8 } },
    ] },
    { id: 'enc-pluie', enemies: [
      { ref: 'mutant', pos: { x: 15, y: 7 } },
      { ref: 'mutant', pos: { x: 16, y: 9 } },
      { ref: 'mutant', pos: { x: 17, y: 8 } },
    ] },
    { id: 'enc-bete', enemies: [
      { ref: 'troll', pos: { x: 14, y: 8 } },
    ] },
    { id: 'enc-duel', enemies: [
      { ref: 'mutant', pos: { x: 13, y: 8 } },
    ] },
    { id: 'enc-intrus', enemies: [
      { ref: 'mutant', pos: { x: 6, y: 7 } },
      { ref: 'mutant', pos: { x: 7, y: 9 } },
    ] },
    { id: 'enc-protection', enemies: [
      { ref: 'mutant', pos: { x: 12, y: 7 } },
      { ref: 'mutant', pos: { x: 13, y: 9 } },
    ] },
    { id: 'enc-percee', enemies: [
      { ref: 'mutant', pos: { x: 12, y: 7 } },
      { ref: 'mutant', pos: { x: 13, y: 9 } },
      { ref: 'mutant', pos: { x: 14, y: 7 } },
    ] },
  ],
  // Ancres AUTHORÉES des Scènes cinématiques sur le plan (S2) : une par entrée de `massBattle.scenes`.
  // Combats posés sur leurs grappes d'ennemis ; `intrus` (menace) sur la percée alliée ~x6-7 ; Scènes de
  // soutien/tenue (motivation, tenez-votre-position, protection…) côté héros ~x4-8. Toutes hors de [3,8].
  stations: [
    { sceneId: 'motivation', pos: { x: 4, y: 12 } },
    { sceneId: 'pluie-de-fleches', pos: { x: 16, y: 8 } },
    { sceneId: 'protection', pos: { x: 12, y: 8 } },
    { sceneId: 'tenez-votre-position', pos: { x: 5, y: 4 } },
    { sceneId: 'compte-a-rebours', pos: { x: 8, y: 3 } },
    { sceneId: 'percee', pos: { x: 13, y: 8 } },
    { sceneId: 'ligne-de-mire', pos: { x: 18, y: 5 } },
    { sceneId: 'tuez-la-bete', pos: { x: 14, y: 8 } },
    { sceneId: 'survol', pos: { x: 17, y: 12 } },
    { sceneId: 'charge', pos: { x: 13, y: 6 } },
    { sceneId: 'duel', pos: { x: 15, y: 11 } },
    { sceneId: 'intrus', pos: { x: 6, y: 8 } },
  ],
});

export const scenario: TestScenario = {
  id: 'bataille-de-masse',
  order: 40,
  category: 'scenarios',
  icon: 'action/attack',
  title: 'Bataille de masse',
  tests:
    'Puissance de Bataille (ADE II 08) : Activités pré-combat, SITUATION par Round (sous-ensemble + menace ' +
    'Intrus qui s\'impose + enchaînements), Scènes MULTI-PJ en Soutien (Test OU combat qui nourrit la Puissance en ' +
    'touches + kills), Rassemblement (Résistance), Test spectaculaire de Puissance (10 + DR, min 5), issue.',
  partyNote: '4 pré-tirés (soldat, chasseur, sorcier, tueur)',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur),
  scene,
  // Interlude de 3 semaines AVANT la bataille : ses Activités (max 3 par héros, LDB 23) sont le budget
  // UNIQUE dans lequel puise la préparation de bataille (ADE II 8 l.65). Sans lui : Round 1 direct.
  interludeWeeks: 3,
  massBattle: {
    enemyName: 'Horde ennemie',
    allyMight: 50,
    enemyMight: 55,
    plannedRounds: 3,
    terrain: 'La plaine boueuse s\'étend devant les remparts ; la horde dévale la pente en hurlant.',
    scenes: [
      'motivation', 'pluie-de-fleches', 'protection', 'tenez-votre-position', 'compte-a-rebours',
      'percee', 'ligne-de-mire', 'tuez-la-bete', 'survol', 'charge', 'duel', 'intrus',
    ],
    situations: [
      ['pluie-de-fleches', 'tenez-votre-position', 'motivation'],
      ['percee', 'compte-a-rebours', 'intrus'],
      ['duel', 'tuez-la-bete', 'survol'],
    ],
    sceneEncounters: {
      'pluie-de-fleches': 'enc-pluie',
      charge: 'enc-charge',
      'tuez-la-bete': 'enc-bete',
      duel: 'enc-duel',
      intrus: 'enc-intrus',
      protection: 'enc-protection',
      percee: 'enc-percee',
    },
  },
};
