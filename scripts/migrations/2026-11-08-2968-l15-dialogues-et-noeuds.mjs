/**
 * Migration #2968 L15 (#1463) — le dialogue d'une entité et le nœud d'un dialogue désignés par `ref(portee)`
 * (`src/data/schemas/grammaire/ref.ts`, portée locale), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot), dans chaque scène d'un projet de campagne :
 *  - `scenes[].dialogues[].start` et `› scenes[].dialogues[].nodes[].choices[].next` : une entrée de `nodes` du
 *    MÊME dialogue ;
 *  - `scenes[].entities[].dialogueId` : une entrée de `dialogues` de la MÊME scène.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites et lues — les quatre projets de `src/scenes/`, dont chaque dialogue et chaque scène portent
 * le catalogue de leur portée.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { migrerLesIdsNus } from './lib/idNuEnRef.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Porteurs d'une scène de projet : le nœud d'entrée et le nœud suivant d'un dialogue, le dialogue d'une entité. */
const SCENE = {
  'dialogues[].start': { collection: 'nodes', ouvreur: 'dialogues[]' },
  'dialogues[].nodes[].choices[].next': { collection: 'nodes', ouvreur: 'dialogues[]' },
  'entities[].dialogueId': { collection: 'dialogues' },
};

const PROJETS = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/diligence/diligence-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `fc0eb0efc5`. */
const PAR_PORTEUR = {
  'arene-projet.json › scenes[].dialogues[].start': 9,
  'arene-projet.json › scenes[].dialogues[].nodes[].choices[].next': 14,
  'arene-projet.json › scenes[].entities[].dialogueId': 9,
  'loup-et-saumure-projet.json › scenes[].dialogues[].start': 8,
  'loup-et-saumure-projet.json › scenes[].dialogues[].nodes[].choices[].next': 23,
  'loup-et-saumure-projet.json › scenes[].entities[].dialogueId': 8,
};
const CARDINAL = 71;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L15 dialogues et nœuds',
  porteurs: tableTotale(PROJETS, () => ({ collection: 'scenes', cles: SCENE })),
  catalogues: {},
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
