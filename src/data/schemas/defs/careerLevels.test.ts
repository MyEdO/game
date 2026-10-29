/**
 * Le Statut d'un Niveau de Carrière se valide au SCHÉMA par `parseStatus` (`statutSchema`) : un libellé
 * illisible saisi au Compendium est refusé comme toute donnée invalide, si bien que `statutDeDonnee`
 * tient sa garantie sur une donnée chargée. LDB 08 l.9
 */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import careerLevelsJson from '../../careerLevels.json';

type Niveau = { id: string; status: string; [k: string]: unknown };
/** Le document réel, dont le PREMIER Niveau porte le Statut `status`. */
const avecStatut = (status: string): Niveau[] => {
  const doc = structuredClone(careerLevelsJson) as unknown as Niveau[];
  doc[0] = { ...doc[0], status };
  return doc;
};

describe('careerLevels — `status` validé par `parseStatus`', () => {
  it('un Statut lisible passe', () => {
    expect(validateDataset('careerLevels.json', avecStatut('Or 2'))).toBeNull();
  });
  it('un Statut illisible (« Gold 2 ») est refusé, avec sa raison', () => {
    expect(validateDataset('careerLevels.json', avecStatut('Gold 2'))).toContain('Statut illisible');
  });
});
