/**
 * La façade du noyau pour l'hôte roguelite : la seule entrée que l'interface et la boucle de jeu importent, et que le
 * build compile à part (`dist/noyau.js`). Chaque domaine vit dans son module ; aucun autre module de l'hôte n'importe
 * un module de ce dossier directement.
 */
export type { Combatant, CharKey, ItemInstance } from '../../../../src/engine/types';
export type { RNG } from '../../../../src/engine/dice';
export { type Sexe, memeSpecialisation, refCouvre, parseTable } from '../../../../src/noyau';
export type { DoctrineId } from '../../../../src/noyau/monde/ai';
export { makeRNG } from '../../../../src/engine/dice';
export { purgerEtats, isConditionLocked, isOutOfAction, refusDeDetermination } from '../../../../src/engine/conditions';
export type { Applique } from '../../../../src/engine/faits';
export { deElide } from '../../../../src/i18n';
export * from './heros';
export * from './combat';
export * from './hameau';
export * from './soins';
export * from './equipement';
export * from './carriere';
export * from './epreuve';
export { poserLesReglesDuRoguelite } from './partie';
