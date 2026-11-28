/**
 * LE VOCABULAIRE DES MODÈLES 3D (#5187) : ce que le noyau sert à la validation d'un manifeste de modèle (clé d'élément,
 * emplacements de la garde-robe, arcs de tir, matières de décor, saisons, emprises des cases d'un navire, maniements et rôles d'animation), sans le reste
 * du noyau. Seconde porte d'un hôte (`SURFACES_DU_NOYAU`, `scripts/guards/lib/couches.mjs`), que la surface du noyau
 * (`./index.ts`) réexporte. Chaque nom vient du module qui le déclare.
 */
export { ecartsDeCleDElement, type CodeDEcartDeCle } from './apparence/cleDElement';
export { emplacementDePiece, estEmplacement } from './apparence/gardeRobe';
export { FIRE_ARCS, type FireArc } from '../engine/types';
export type { Season } from '../engine/travelStages';
export { saisonSchema, type Maniement } from '../data/schemas/grammaire/valeurs';
export { matieresDeDecor } from './monde/volume/matieres';
export type { EmprisesDesCases } from './planDeNavire';
export { MANIEMENTS, ROLES_D_ANIMATION, type RoleDAnimation } from './animation';
