/**
 * La façade du noyau pour l'hôte roguelite : la seule entrée que l'interface et la boucle de jeu importent, et que le
 * build compile à part (`dist/noyau.js`). Chaque domaine vit dans son module ; aucun autre module de l'hôte n'importe
 * un module de ce dossier directement.
 */
export type { Combatant, CharKey, ItemInstance } from '../../../../src/engine/types';
export type { RNG } from '../../../../src/engine/dice';
export type { Sexe } from '../../../../src/data/schemas/grammaire/valeurs';
export type { DoctrineId } from '../../../../src/noyau/monde/ai';
export { makeRNG } from '../../../../src/engine/dice';
export { memeSpecialisation, refCouvre } from '../../../../src/data/schemas/grammaire/ref';
export { deElide } from '../../../../src/i18n';
export { parseTable } from '../../../../src/data/schemas/source/decoupe';
export * from './heros';
export * from './combat';
export * from './hameau';
export * from './soins';
export * from './equipement';
export * from './carriere';
export * from './epreuve';
export { poserLesReglesDuRoguelite } from './partie';
