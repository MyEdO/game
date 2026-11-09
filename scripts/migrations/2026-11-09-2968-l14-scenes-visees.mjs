/**
 * Migration #2968 L14 (#1463) — une scène du projet désignée par `ref(portee)` (`src/data/schemas/grammaire/ref.ts`,
 * portée locale qu'ouvre la racine du projet), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot), dans chaque projet de campagne : la scène d'un
 * lieu de la carte (`worldMap.places[].scene`), celle de l'embuscade d'une route (`worldMap.routes[].ambush.scene`)
 * et celle de l'effet `transition`, aux trois chemins de Flow que la donnée porte (`onVictory` d'une rencontre,
 * `flow` d'une réponse de dialogue, `flow` d'un déclencheur). La cible est une entrée de `scenes` du MÊME projet.
 * `worldMap.places[].poi[].sceneId` n'a aucune valeur posée. La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites et lues — les quatre projets de `src/scenes/`, dont la racine porte le catalogue de ses scènes.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { migrerLesIdsNus } from './lib/idNuEnRef.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Les scènes du projet, catalogue de la portée qu'ouvre la racine du document. */
const SCENES = { collection: 'scenes' };

/** Porteurs d'un projet : la scène d'un lieu, d'une embuscade et d'une `transition`. */
const PROJET = {
  'worldMap.places[].scene': SCENES,
  'worldMap.routes[].ambush.scene': SCENES,
  'scenes[].encounters[].onVictory.steps[].effect.scene': SCENES,
  'scenes[].dialogues[].nodes[].choices[].flow.steps[].effect.scene': SCENES,
  'scenes[].triggers[].flow.steps[].effect.scene': SCENES,
};

const PROJETS = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/diligence/diligence-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `620bbf2884`. */
const PAR_PORTEUR = {
  'arene-projet.json › worldMap.places[].scene': 4,
  'arene-projet.json › worldMap.routes[].ambush.scene': 4,
  'arene-projet.json › scenes[].encounters[].onVictory.steps[].effect.scene': 13,
  'arene-projet.json › scenes[].dialogues[].nodes[].choices[].flow.steps[].effect.scene': 13,
  'barge-du-sel-projet.json › worldMap.places[].scene': 2,
  'barge-du-sel-projet.json › worldMap.routes[].ambush.scene': 1,
  'diligence-projet.json › worldMap.places[].scene': 4,
  'loup-et-saumure-projet.json › worldMap.places[].scene': 2,
  'loup-et-saumure-projet.json › worldMap.routes[].ambush.scene': 2,
  'loup-et-saumure-projet.json › scenes[].triggers[].flow.steps[].effect.scene': 1,
};
const CARDINAL = 46;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L14 scènes visées',
  porteurs: tableTotale(PROJETS, () => ({ objet: true, cles: PROJET })),
  catalogues: {},
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
