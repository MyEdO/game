/**
 * Le Statut d'un Niveau de Carrière est un objet d'ids (`statutSchema`) : un Échelon parmi `ECHELONS_DE_STATUT` et
 * un Standing entier de 0 sans borne haute. Un libellé, un Échelon hors vocabulaire ou un Standing négatif ou
 * fractionnaire saisis au Compendium sont refusés comme toute donnée invalide. LDB 08 l.9, l.101
 */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import careerLevelsJson from '../../careerLevels.json';
import { CHAR_KEYS } from '../../../engine/types';

type Niveau = { id: string; status: unknown; [k: string]: unknown };
/** Le document réel, dont le PREMIER Niveau porte le Statut `status`. */
const avecStatut = (status: unknown): Niveau[] => {
  const doc = structuredClone(careerLevelsJson) as unknown as Niveau[];
  doc[0] = { ...doc[0], status };
  return doc;
};

describe('careerLevels — `status` est un Statut en ids (`statutSchema`)', () => {
  it('un Statut en ids passe, Standing 0 et Standing au-delà de 5 compris (LDB 08 l.9, l.101)', () => {
    expect(validateDataset('careerLevels.json', avecStatut({ tier: 'or', standing: 2 }))).toBeNull();
    expect(validateDataset('careerLevels.json', avecStatut({ tier: 'bronze', standing: 0 }))).toBeNull();
    expect(validateDataset('careerLevels.json', avecStatut({ tier: 'or', standing: 7 }))).toBeNull();
  });
  it.each([
    ['un libellé', 'Or 2'],
    ['un Échelon en libellé', { tier: 'Or', standing: 2 }],
    ['un Échelon hors vocabulaire', { tier: 'gold', standing: 2 }],
    ['un Standing négatif', { tier: 'or', standing: -1 }],
    ['un Standing fractionnaire', { tier: 'or', standing: 1.5 }],
    ['un Standing absent', { tier: 'or' }],
  ])('%s est refusé', (_cas, status) => {
    expect(validateDataset('careerLevels.json', avecStatut(status))).not.toBeNull();
  });
});

const reel = () => structuredClone(careerLevelsJson);

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
