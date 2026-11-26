/**
 * La façade du noyau pour l'hôte roguelite : la seule entrée que l'interface et la boucle de jeu importent, et que le
 * build compile à part (`dist/noyau.js`). Chaque domaine vit dans son module ; aucun autre module de l'hôte n'importe
 * un module de ce dossier directement.
 */
export type { Applique, Combatant, CharKey, DoctrineId, ItemInstance, RNG, Sexe } from '../../../../src/noyau';
export {
  memeSpecialisation,
  refCouvre,
  parseTable,
  gesteDeDetermination,
  makeRNG,
  isConditionLocked,
  isOutOfAction,
  refusDeDetermination,
} from '../../../../src/noyau';
export { purgerEtats } from '../../../../src/engine/conditions';
export { deElide } from '../../../../src/i18n';
export * from './heros';
export * from './combat';
export * from './hameau';
export * from './soins';
export * from './equipement';
export * from './carriere';
export * from './epreuve';
export { poserLesReglesDuRoguelite } from './partie';
