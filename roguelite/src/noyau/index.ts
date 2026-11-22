/**
 * La façade du noyau pour l'hôte roguelite : la seule entrée que l'interface et la boucle de jeu importent, et que le
 * build compile à part (`dist/noyau.js`). Chaque domaine vit dans son module ; aucun autre module de l'hôte n'importe
 * un module de ce dossier directement.
 */
export type { Combatant, CharKey } from '../../../src/engine/types';
export type { RNG } from '../../../src/engine/dice';
export { makeRNG } from '../../../src/engine/dice';
export { generateName } from '../../../src/engine/names';
export * from './heros';
export * from './combat';
export * from './hameau';
export * from './soins';
export * from './equipement';
export * from './carriere';
