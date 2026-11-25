import { describe, it, expect } from 'vitest';
import { entreeDe, ouvertParSaRegle, regle } from './catalogue';
import { catalogueDeTest, type LivreDeTest } from './catalogueDeTest.testkit';
import { idDeFixture } from '../../idDeFixture.testkit';

const LIVRE = idDeFixture('book', 'livre-de-test');
const REGLE = idDeFixture('regleOptionnelle', 'regle-du-livre-de-test');
const GROUPE = 'groupe-du-livre-de-test';

const REGISTRE: LivreDeTest['reglesOptionnelles.json'] = [
  { id: REGLE, type: 'reglesOptionnelles', label: 'Règle du livre de test', ref: 'LDT 01 l.1', source: { book: LIVRE, page: 1 }, group: 'Test', kind: 'flag', default: false },
];

const GROUPES: LivreDeTest['weaponGroups.json'] = [
  {
    id: GROUPE,
    type: 'weaponGroups',
    label: 'Groupe du livre de test',
    kind: 'inventory',
    source: { book: LIVRE, page: 1 },
    variants: [{ when: { rule: REGLE }, source: { book: LIVRE, page: 2 } }],
  },
];

const LIVRE_DE_TEST: LivreDeTest = { 'reglesOptionnelles.json': REGISTRE, 'weaponGroups.json': GROUPES };

describe('entreeDe — lecture par id dans le catalogue passé', () => {
  it('rend l’entrée déclarée, `undefined` pour un id absent ou nul', () => {
    const cat = catalogueDeTest(LIVRE_DE_TEST);
    expect(entreeDe('reglesOptionnelles', REGLE, cat)?.label).toBe('Règle du livre de test');
    expect(entreeDe('reglesOptionnelles', 'absente', cat)).toBeUndefined();
    expect(entreeDe('reglesOptionnelles', undefined, cat)).toBeUndefined();
  });

  it('un document absent se lit comme une collection vide', () => {
    expect(entreeDe('trappings', 'quelconque', catalogueDeTest({}))).toBeUndefined();
  });
});

describe('regle — le choix de la composition, sinon le défaut du registre', () => {
  it('rend le défaut, puis le choix posé', () => {
    expect(regle(REGLE, catalogueDeTest(LIVRE_DE_TEST))).toBe(false);
    expect(regle(REGLE, catalogueDeTest({ ...LIVRE_DE_TEST, regles: { [REGLE]: true } }))).toBe(true);
  });

  it('un id hors du registre du catalogue LÈVE', () => {
    expect(() => regle(REGLE, catalogueDeTest({ regles: { [REGLE]: true } }))).toThrow(/regle-du-livre-de-test/);
  });
});

describe('ouvertParSaRegle — le filtre d’offre lit la règle du catalogue', () => {
  it('ouverte sans `gatedByRule`, fermée puis ouverte selon sa règle', () => {
    const gatee = { gatedByRule: { id: REGLE } };
    expect(ouvertParSaRegle({}, catalogueDeTest({}))).toBe(true);
    expect(ouvertParSaRegle(gatee, catalogueDeTest(LIVRE_DE_TEST))).toBe(false);
    expect(ouvertParSaRegle(gatee, catalogueDeTest({ ...LIVRE_DE_TEST, regles: { [REGLE]: true } }))).toBe(true);
  });
});

describe('composer — les entrées effectives sous les règles de la composition', () => {
  it('la variante réglée est résolue quand sa règle est choisie, et l’entrée reste', () => {
    expect(entreeDe('weaponGroups', GROUPE, catalogueDeTest(LIVRE_DE_TEST))?.source?.page).toBe(1);
    expect(entreeDe('weaponGroups', GROUPE, catalogueDeTest({ ...LIVRE_DE_TEST, regles: { [REGLE]: true } }))?.source?.page).toBe(2);
  });

  it('recomposer rend une valeur neuve, et sa lecture suit la composition neuve sur la même collection', () => {
    const documents = { 'reglesOptionnelles.json': REGISTRE };
    const avant = catalogueDeTest(documents);
    const apres = catalogueDeTest({ ...documents, regles: { [REGLE]: true } });
    expect(apres).not.toBe(avant);
    expect(regle(REGLE, avant)).toBe(false);
    expect(regle(REGLE, apres)).toBe(true);
  });
});
