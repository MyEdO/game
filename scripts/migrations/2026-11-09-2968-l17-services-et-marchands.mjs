/**
 * Migration #2968 L17 (#1463) — un service de lieu et un archétype de marchand désignés par `ref(type)`
 * (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) : l'archétype de marchand qu'ouvre un service
 * (`lieux-services.json › merchantArchetype`) et celui d'un PNJ marchand de scène (`scenes[].entities[].merchant
 * .archetype`), cibles de `merchants.json` ; le service déclaré par un lieu de la carte (`worldMap.places[]
 * .services[].kind`) et celui que vise un point d'intérêt (`worldMap.places[].poi[].serviceKind`), cibles de
 * `lieux-services.json`. La clé garde son rang, les autres clés le leur. Les fonds (`backdrop`) sont déjà des
 * `ref('fond')`.
 *
 * ENTRÉES : écrites — `src/data/lieux-services.json` et les quatre projets de `src/scenes/` ; lues — les catalogues
 * `src/data/merchants.json` et `src/data/lieux-services.json`.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT, FAIL-FAST et FORMATAGE : `lib/idNuEnRef.mjs` ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 */
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Porteurs d'un projet : l'archétype d'un PNJ marchand, les services d'un lieu et la cible d'un point d'intérêt. */
const PROJET = {
  'scenes[].entities[].merchant.archetype': 'merchant',
  'worldMap.places[].services[].kind': 'serviceDeLieu',
  'worldMap.places[].poi[].serviceKind': 'serviceDeLieu',
};

const PROJETS = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/diligence/diligence-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Gestes du premier passage par porteur, mesurés le 2026-11-09 sur `ed802f1a72`. */
const PAR_PORTEUR = {
  'lieux-services.json › merchantArchetype': 1,
  'arene-projet.json › scenes[].entities[].merchant.archetype': 4,
  'loup-et-saumure-projet.json › scenes[].entities[].merchant.archetype': 3,
  'loup-et-saumure-projet.json › worldMap.places[].services[].kind': 6,
  'loup-et-saumure-projet.json › worldMap.places[].poi[].serviceKind': 8,
};
const CARDINAL = 22;

migrerLesIdsNus({
  racine: ROOT,
  lot: '2968 L17 services de lieu et archétypes de marchand',
  porteurs: {
    'src/data/lieux-services.json': { cles: { merchantArchetype: 'merchant' } },
    ...tableTotale(PROJETS, () => ({ objet: true, cles: PROJET })),
  },
  catalogues: {
    merchant: idsDe(ROOT, 'src/data/merchants.json'),
    serviceDeLieu: idsDe(ROOT, 'src/data/lieux-services.json'),
  },
  parPorteur: PAR_PORTEUR,
  cardinal: CARDINAL,
});
