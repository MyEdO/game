import type { BornesDuGabarit, TableDeGabarit } from './manifesteDeBase.ts';

/** Les bornes du gabarit des jouets de test. */
export const BORNES: BornesDuGabarit = { legs: { min: 0.4836, max: 1.456 }, arms: { min: 1, max: 1.6 }, head: { min: 1, max: 1.9 } };

/** La table de gabarit du jouet (`scripts/personnage-3d/base/gabarit.testkit.ts`), sans son squelette : les tests du
 *  domaine la lisent sans charger three. */
export const TABLE_DU_JOUET: TableDeGabarit = { racine: 'root', legs: ['thigh', 'calf'], arms: ['upperarm', 'lowerarm'], head: ['Head'], st: { min: 0.8, max: 1.2 }, bornes: BORNES, osDesSilhouettes: {} };
