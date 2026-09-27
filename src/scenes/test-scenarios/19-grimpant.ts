import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * GRIMPANT (LDB 85 l.160-162, #504) : une créature porteuse escalade une arête `WallSeg.climb` en
 * combat SANS Test (résolution automatique) et à vitesse de Mouvement PLEINE — le pathing (`reachable`/
 * `pathTo`, `MoveEnv.traverse`) et l'IA (`chooseEnemyAction`, via `EnemyTurnInput.traverse`) exploitent
 * l'arête sans branchement dédié. Plateau (rangées y0-2, h=4 m, refuge du groupe) séparé du sol (y3-9,
 * h=0) par une falaise ; SEULE l'arête N de (5,3) porte une grimpe (`surface`, sans `requiresGrimpeur` —
 * une paroi à prises ordinaire, gravie sans effort par le Trait). Le Chasseur (à distance) attend en
 * haut : l'Araignée géante (Trait Grimpant, `creatures.json`) grimpe d'elle-même pour l'atteindre — la
 * démonstration se joue en 1-2 Rounds (elle arrive au contact, le Chasseur achève au corps-à-corps ou au
 * tir de repli).
 */
function construireScene(): Scene {
  const scene = buildScene({
    id: 'grimpant',
    label: 'Grimpant — l’araignée escalade',
    desc:
      "Un plateau rocheux (4 m) domine une clairière ; une seule paroi praticable (arête sud du plateau) " +
      "y donne accès. Une araignée géante rôde en contrebas.",
    size: [10, 10],
    terrain: 'herbe',
    relief: [{ rect: [0, 0, 9, 2], height: 4 }], // plateau (rangées y=0..2, 4 m) — reste du sol à 0 m
    // Arête grimpable (Trait Grimpant, LDB 85 l.160-162) : SEULE l'arête N de (5,3) (pied du plateau).
    walls: [{ x: 5, y: 3, side: 'N', climb: { kind: 'surface' } }],
    heroStart: [5, 1], // le Chasseur, sur le plateau, hors d'atteinte au sol
    startMessage:
      "Vous tenez le plateau : l'araignée géante, en contrebas, ne peut vous rejoindre qu'en escaladant " +
      "l'unique paroi praticable (Trait Grimpant : elle grimpe sans effort, à pleine vitesse).",
  });
  setEncounters(scene, [
    { id: 'enc-grimpant', enemies: [{ ref: 'araignee-geante', pos: { x: 5, y: 8 }, facing: 'N' }] },
  ]);
  return scene;
}

export const scenario: TestScenario = {
  id: 'grimpant',
  order: 18,
  category: 'creatures',
  icon: 'scenario/bestiary',
  title: 'Grimpant — l’araignée escalade',
  tests:
    "Trait Grimpant (LDB 85 l.160-162) : une créature grimpe une arête `WallSeg.climb` SANS Test et à " +
    "vitesse pleine — pathing (`reachable`/`pathTo`, `MoveEnv.traverse`) et IA (`chooseEnemyAction`) " +
    "exploitent l'arête automatiquement ; le groupe (hors du Talent Grimpeur) reste bloqué en bas.",
  partyNote: 'Chasseur solo, posté sur le plateau (hors d’atteinte au sol).',
  construire: () => ({ party: pregenParty(PREGEN.chasseur), scene: construireScene() }),
  autoCombat: 'enc-grimpant',
};
