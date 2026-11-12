/**
 * Le Statut d'un Niveau de Carrière se valide au SCHÉMA par `parseStatus` (`statutSchema`) : un libellé
 * illisible saisi au Compendium est refusé comme toute donnée invalide, si bien que `statutDeDonnee`
 * tient sa garantie sur une donnée chargée. LDB 08 l.9
 */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import careerLevelsJson from '../../careerLevels.json';
import { CHAR_KEYS } from '../../../engine/types';

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

type NiveauDeCarriere = { id: string; career: { id: string }; level: number; characteristics: string[]; [k: string]: unknown };
const reel = (): NiveauDeCarriere[] => structuredClone(careerLevelsJson) as unknown as NiveauDeCarriere[];

describe('careerLevels — identité `<career>-<level>`, quatre Niveaux, Schéma de Progression 3/1/1/1 (LDB 07 l.26 ; LDB 07 l.41-43)', () => {
  it('la donnée réelle passe', () => {
    expect(validateDataset('careerLevels.json', reel())).toBeNull();
  });
  it('un id désaccordé de sa paire est refusé, nommé', () => {
    const doc = reel();
    doc[0] = { ...doc[0], id: `${doc[0].career.id}-9` };
    expect(validateDataset('careerLevels.json', doc)).toContain(`l’id « ${doc[0].career.id}-9 » est désaccordé de la paire carrière+niveau qui le compose — attendu « ${doc[0].career.id}-1 »`);
  });
  it('un Niveau en double dans une carrière est refusé, nommé', () => {
    const doc = reel();
    const dernier = doc[doc.length - 1];
    const clone = { ...structuredClone(dernier), id: `${dernier.career.id}-${dernier.level}-bis`, level: dernier.level };
    const faute = validateDataset('careerLevels.json', [...doc, clone]);
    expect(faute).toContain(`la carrière « ${dernier.career.id} » doit porter les niveaux 1, 2, 3 et 4 une fois chacun`);
    expect(faute).toContain(clone.id);
  });
  it('un Niveau qui ouvre une caractéristique de trop est refusé, nommé', () => {
    const doc = reel();
    const i = doc.findIndex((n) => n.level === 2);
    const marquees = doc.filter((n) => n.career.id === doc[i].career.id).flatMap((n) => n.characteristics);
    const libre = CHAR_KEYS.find((k) => !marquees.includes(k))!;
    doc[i] = { ...doc[i], characteristics: [...doc[i].characteristics, libre] };
    expect(validateDataset('careerLevels.json', doc)).toContain(`« ${doc[i].id} » ouvre 2 caractéristique(s) — le Schéma de Progression en ouvre 1 au niveau 2`);
  });
  it('une caractéristique marquée à deux Niveaux d’une carrière est refusée, nommée', () => {
    const doc = reel();
    const n1 = doc.find((n) => n.level === 1)!;
    const i = doc.findIndex((n) => n.career.id === n1.career.id && n.level === 2);
    doc[i] = { ...doc[i], characteristics: [n1.characteristics[0]] };
    expect(validateDataset('careerLevels.json', doc)).toContain(`la carrière « ${n1.career.id} » ouvre deux fois [${n1.characteristics[0]}]`);
  });
});
