/**
 * Fabriques de scène du générateur de l'Arène (`hub.mjs` / `zones1-7.mjs` / `zones8-13.mjs` /
 * `expeditions.mjs`) — déclarations pour les consommateurs TypeScript (le verrou
 * `src/data/prop-foot-migration.test.ts`, qui juge la SOURCE du JSON généré). Patron des
 * `scripts/guards/lib/*.d.mts`.
 */
import type { Scene } from '../../src/noyau/monde/scene';

/** Une fabrique = une scène complète du projet Arène. */
export type AreneSceneFactory = () => Scene;
