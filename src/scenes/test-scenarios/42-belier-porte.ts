import { pregenParty, PREGEN } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import { buildScene } from '../../state/mapSpec';
import { crewFormationSlots } from '../../state/shipPostes';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * BÉLIER — PORTE (ADE II 8 « Le théâtre de la guerre » l.233) : consommateur LIVE du modèle ENGIN DE
 * SIÈGE CREWÉ — le bélier n'est PAS une arme portée en solo : c'est un EMPLACEMENT (poste `ShipPoste`,
 * `Combatant.mannedPoste`/`postes`) servi par une ÉQUIPE (Qualité `equipe`, Indice 6), exactement comme les
 * autres machines de guerre. Le SOLDAT (héros, id STABLE `pregen-101`) est le CHEF de pièce (`crewIds[0]`,
 * seul à tirer/manier) ; 5 servants PNJ (`garde-du-village`, IA) complètent l'Équipe de 6. `applyShipPostes`
 * sert le poste au chef au début du combat (aucune action « équiper » ni loadout) — le bélier SERVI est
 * assené contre une VRAIE porte (`porte-de-ville`, structure brèchable) : le jet d'attaque se résout sur la
 * Force du chef (jamais sa CC), seule la porte encaisse des Dégâts (Atout Bélier). L'adjacence d'une pièce
 * de MÊLÉE servie se mesure depuis l'EMPREINTE DE LA COQUE (#210, `meleeWarMachineHullOf`), désormais 2×2
 * (`t.siegeFootprint`) — c'est l'affût qui doit toucher la porte, pas seulement le chef qui le sert.
 *
 * Carte (10×15, pavée) : la formation (chef + bélier 2×2 + 5 servants, `crewFormationSlots`, ADE II 8
 * l.258 : « on pousse par les flancs/l'arrière ») démarre ALIGNÉE en x avec la porte (arête N de (5,4),
 * colonne x=5 comprise dans l'empreinte 2×2 dès le départ), à 3 cases de la porte — DISTANCE À TRAVERSER
 * (Lot 2 #156, MOBILITÉ) : « roues, se déplace sur le champ de bataille » (l.256/258, vitesse non chiffrée
 * → `siege-engine-push-speed`, plafond maison 2 cases/poussée) — EXACTEMENT 2 poussées plein Nord (2 cases
 * puis le reliquat de 1) amènent l'empreinte au contact DIRECT de la porte (dx=0, jamais en diagonale) : la
 * démonstration reste courte, zéro dérive de trajectoire. Un gobelin défend l'autre côté de la porte (5,2).
 * `heroStart` pose le GROUPE (4 héros) en colonne à `x−1` (`startCombat`, combatSlice.ts) → le Soldat (1er
 * du groupe, `makeParty` ci-dessous) atterrit en (3,8), qui EST le flanc gauche de la formation
 * (`crewFormationSlots` en (px−1,py) pour un affût posé en (4,8)) — les 5 servants occupent les autres
 * cases de la formation, aucune sur la colonne des 3 autres héros ((3,9)/(3,10)/(3,11)) ni sur l'affût.
 */
const RAM_CREW = [
  `pregen-${PREGEN.soldat}`, // chef de pièce (crewIds[0]) : un héros, seul à manier le bélier
  'enemy-siege-belier-2', 'enemy-siege-belier-3', 'enemy-siege-belier-4', 'enemy-siege-belier-5', 'enemy-siege-belier-6', // 5 servants PNJ (Équipe 6, ADE II 8 l.233)
];

// Affût posé à (4,8), footprint 2×2 (`t.siegeFootprint`) couvrant les colonnes x=4..5 — la colonne x=5 EST
// celle de la porte (5,4) : pousser plein Nord amène l'empreinte au contact DIRECT (dx=0), jamais en
// diagonale. Pointant vers la porte (heading 'N', l'engin frappe au Nord) — `crewFormationSlots` donne
// l'anneau ORDONNÉ (droite/gauche/angles-arrière/arrière, JAMAIS l'avant où l'engin frappe) autour de cette
// empreinte ; la colonne des 3 autres héros du groupe (x=3, y=9..11, posée par `heroStart`/`startCombat`)
// recouvre le flanc gauche SOUS le Soldat (3,8) — on l'écarte : le Soldat atterrit là par `heroStart`, les
// 5 servants prennent les 5 cases RESTANTES.
const RAM_POS = { x: 4, y: 8 };
const RAM_HEADING = 'N' as const;
const HERO_COLUMN_X = 3; // heroStart=[4,8] → colonne du groupe (partyPos.x−1)
const SERVANT_SLOTS = crewFormationSlots({ pos: RAM_POS, footprint: 2 }, { crewIds: RAM_CREW }, { heading: RAM_HEADING })
  .filter((p) => p.x !== HERO_COLUMN_X); // écarte tout le flanc gauche (colonne des héros, dont le Soldat)

const scene = buildScene({
  id: 'belier-porte',
  label: 'Bélier — porte',
  desc: "Un petit fort de siège : une porte de ville barre le passage, gardée par un gobelin.",
  size: [10, 15],
  terrain: 'pave',
  metresPerTile: 2,
  ambiance: 'exterieur',
  ambientLight: 'jour',
  heroStart: [4, 8], // le Soldat (1er du groupe) atterrit en (3,8) — flanc gauche de la formation, à 3 cases de la porte
  startMessage: "Le Soldat sert le bélier (poste, Équipe de 6) : poussez-le jusqu'à la porte (Action « Pousser », mouvement simple) puis enfoncez-la (Test de Force) — la VICTOIRE se joue sur la porte ABATTUE, pas sur le défenseur qui la garde.",
  walls: [{ x: 5, y: 4, side: 'N', structure: 'porte-de-ville' }],
});
setEncounters(scene, [
  {
    id: 'siege-belier',
    // Objectif de victoire (#197) : la porte ABATTUE, pas la mort du gobelin — `checkBattleOver`
    // consultait exclusivement les ennemis avant #197, ce qui déclarait la victoire dès le gobelin
    // hors d'action alors que la porte tenait toujours (bug du ticket).
    victoryCondition: { type: 'destroyStructure', edge: { x: 5, y: 4, side: 'N' } },
    // Rencontre de SIÈGE déclarée — champ SÉPARÉ de `victoryCondition` : l'objectif ne l'active pas.
    siege: true,
    enemies: [
      { ref: 'gobelin', pos: { x: 5, y: 2 }, facing: 'S' }, // index 0 : défenseur
      // index 1 : l'EMPLACEMENT du bélier — affût INERTE 2×2 (branche siège de `spawnEnemy`, `ref` porte un
      // `siegeRig`), orienté vers la porte (facing 'N'), servi par l'Équipe `RAM_CREW`.
      {
        ref: 'belier-ade2', pos: RAM_POS, facing: RAM_HEADING, side: 'ally',
        postes: [{ item: itemFromTrappingById('belier-ade2')!, crewIds: [...RAM_CREW] }],
      },
      // index 2-6 : les 5 servants PNJ (IA, agissent seuls) qui complètent l'Équipe (le 6e membre = le
      // Soldat, crewIds[0] ci-dessus) — en FORMATION autour de l'affût (`crewFormationSlots`, jamais
      // éparpillés), aucun sur la colonne des 3 autres héros ni sur l'affût.
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[0], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[1], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[2], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[3], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: SERVANT_SLOTS[4], facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'belier-porte',
  order: 42,
  category: 'combat',
  icon: 'scenario/siege',
  title: 'Bélier — porte',
  tests:
    "Bélier ADE II = engin de siège CREWÉ (ch.08 l.233), jamais une arme portée : posé en EMPLACEMENT " +
    "(poste), servi par une Équipe de 6 (le Soldat = chef, 5 servants PNJ) — Équipe incomplète bake −20, " +
    "sous la moitié rend l'affût INUTILISABLE (`firedAttackBlock`). Le chef POUSSE l'engin (Lot 2 #156 : " +
    "mouvement simple, aucun jet, plafonné à la vitesse maison, engin+servants translatent en formation) " +
    "jusqu'à une VRAIE porte (structure brèchable, `Weapon.resolveChar`) puis l'assène : le jet se résout " +
    "sur sa Force, jamais sa CC ; seule la porte encaisse des Dégâts (Atout Bélier).",
  partyNote: 'Le Soldat sert le bélier (chef de pièce) ; 5 servants PNJ complètent l’Équipe requise.',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur),
  scene,
  autoCombat: 'siege-belier',
};
