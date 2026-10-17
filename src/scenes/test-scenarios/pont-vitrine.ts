import { makeShowcaseParty } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import type { Scene, SceneEntity } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * PONT — VITRINE DU RELIEF MÉTRIQUE. Objectif-phare du chantier « relief unifié » : prouver qu'on marche
 * SUR et SOUS un même pont, qu'une montée s'authore en cases de hauteur croissante (rampe auto, AUCUN objet
 * escalier) et qu'un dénivelé > 1 m est une FALAISE infranchissable à pied.
 *
 * Tout est de la DONNÉE, exprimée dans UN `buildScene(MapSpec)` (2 couches ASCII + reliefs métriques),
 * zéro géométrie en dur :
 *  - COUCHE 0 (`z0`) = le sol (herbe, h=0) traversé par un CHEMIN (`route`) nord-sud qui passe SOUS le pont ;
 *  - COUCHE 1 (`z1`) = le TABLIER du pont (`planches`, h=2 m) enjambant le chemin d'est en ouest ; partout
 *    ailleurs la couche 1 est du `vide` (transparent → on voit/marche la couche 0 en dessous) ;
 *  - 2 RAMPES de pierre (h montant 0→1→2 m, ≤1 m/case) rejoignent le tablier là où les hauteurs coïncident
 *    (Δh≤1 m ⇒ le moteur relie les surfaces et fabrique la pente) ;
 *  - un PETIT RELIEF (plateau h=1 m, relié par ses rampes douces de 1 m) ;
 *  - une FALAISE : un rebord d'herbe à h=3 m (rejoint par une rampe 0→1→2→3) dominant un CREUX à h=0 séparé
 *    par un gouffre — Δ3 m ⇒ falaise (on n'y descend PAS à pied : on tombe en sautant le gouffre).
 *
 * Le moteur tire tout cela de `surfaceLink` (|Δh|≤`STEP_MAX_M` ⇒ marchable) : aucune machinerie d'escalier.
 */

// ── COUCHE 0 (sol) : herbe de base, CHEMIN `route` (R), RAMPES de pierre (S), GOUFFRE de la falaise (vide, X) ─
const SOL = String.raw`
.......RR.......
.......RR.......
.......RR.......
.......RR.......
.......RR.......
.......RR.......
...SS..RR..SS...
...SS..RR..SS...
...SS..RR..SS...
.......RR.......
.......RR.......
.......RRSS.....
.......RR.XXXXXX
.......RR.X.....
.......RR.X.....
.......RR.X.....
`;

// ── COUCHE 1 (tablier du pont) : vide partout, PLANCHES (P) sur la travée qui enjambe le chemin ──────────
const TABLIER = String.raw`
................
................
................
................
................
................
.....PPPPPP.....
.....PPPPPP.....
.....PPPPPP.....
................
................
................
................
................
................
................
`;

function construireScene(): Scene {
  // Décor d'extérieur (props purs) : repères visuels des trois reliefs.
  const decor: SceneEntity[] = [
    { id: 'arbre-0', kind: 'prop', ref: 'arbre', pos: { x: 0, y: 2 } },
    { id: 'arbre-1', kind: 'prop', ref: 'arbre', pos: { x: 15, y: 4 } },
    { id: 'arbre-2', kind: 'prop', ref: 'arbre', pos: { x: 0, y: 9 } },
    { id: 'panneau', kind: 'prop', ref: 'panneau', pos: { x: 6, y: 4 } }, // au pied de la rampe ouest
    { id: 'rocher-falaise', kind: 'prop', ref: 'rocher', pos: { x: 13, y: 11 } }, // sur le rebord de la falaise (h=3)
    { id: 'buisson-creux', kind: 'prop', ref: 'buisson', pos: { x: 13, y: 14 } }, // au fond du creux
  ];

  const scene = buildScene({
    id: 'pont-vitrine',
    label: 'Pont — vitrine du relief',
    size: [16, 16],
    desc:
      "Vitrine du relief métrique : un chemin de pierre traverse une clairière en passant SOUS un pont de bois " +
      "(tablier à 2 m, couche 1) que l'on rejoint par deux rampes ; un petit plateau à 1 m ; et un rebord de " +
      "falaise à 3 m dominant un creux. Marchez sous le pont, montez la rampe pour marcher dessus, escaladez le " +
      "plateau — mais la falaise ne se descend pas à pied.",
    ambiance: 'exterieur',
    ambientLight: 'jour',
    levels: { z0: SOL, z1: TABLIER },
    // Char sets DISJOINTS par étage (z0 : R/S/X ; z1 : P) → une légende partagée sans collision.
    legend: { R: 'route', S: 'pierre', X: 'vide', P: 'planches' },
    relief: [
      // Couche 0 — Rampe OUEST du pont : col 3 → 1 m, col 4 → 2 m (rejoint le tablier à 2 m sur la rive ouest).
      { rect: [3, 6, 3, 8], height: 1 }, { rect: [4, 6, 4, 8], height: 2 },
      // Couche 0 — Rampe EST du pont : col 12 → 1 m, col 11 → 2 m (rejoint le tablier à 2 m sur la rive est).
      { rect: [12, 6, 12, 8], height: 1 }, { rect: [11, 6, 11, 8], height: 2 },
      // Couche 0 — Petit relief : plateau à 1 m (rampe douce de 1 m sur tout son pourtour).
      { rect: [1, 12, 4, 14], height: 1 },
      // Couche 0 — Falaise : rampe d'accès (col 9 → 1 m, col 10 → 2 m) puis REBORD à 3 m (rangée 11, cols 11-15).
      { cell: [9, 11], height: 1 }, { cell: [10, 11], height: 2 }, { rect: [11, 11, 15, 11], height: 3 },
      // Couche 1 — le tablier du pont est à 2 m (les rampes de la couche 0 le rejoignent à hauteur égale).
      { rect: [5, 6, 10, 8], height: 2, z: 1 },
    ],
    entities: decor,
    heroStart: [7, 1], // sur le chemin, au nord (couche 0)
    startMessage:
      { texte: "Vous tenez le chemin, au nord. Suivez-le vers le sud : il passe SOUS le pont. Pour marcher DESSUS, prenez " +
      "l'une des deux rampes (est ou ouest). À l'ouest, un plateau se gravit ; au sud-est, un rebord de falaise " +
      "surplombe un creux — infranchissable à pied." },
  });
  return scene;
}

export const scenario: TestScenario = {
  id: 'pont-vitrine',
  order: 50,
  category: 'rendu',
  icon: 'scenario/bridge',
  title: 'Pont — vitrine',
  tests:
    'Relief métrique 100 % données (2 couches + hauteurs parallèles) : on marche SOUS le pont (couche 0, h=0) ' +
    "et DESSUS (couche 1 'planches', h=2 m) ; accès par 2 RAMPES auto-dérivées (hauteurs 0→1→2, AUCUN escalier) ; " +
    'un plateau à 1 m ; une FALAISE (rebord h=3 m / creux h=0) infranchissable à pied (surfaceLink → cliff).',
  partyNote: 'Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — promenade libre, aucun combat.',
  construire: () => ({ party: makeShowcaseParty(), scene: construireScene() }),
};
