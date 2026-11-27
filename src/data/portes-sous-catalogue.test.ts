/**
 * Les PORTES de la donnée jugent sous le catalogue qu'elles reçoivent (#5070, étape B) : une donnée qui désigne une
 * entrée absente de l'index des ids, présente au catalogue passé, passe chaque porte ; un id mort y est refusé.
 * Fixtures : un Groupe, un livre et un dieu DÉCLARÉS par la suite, seuls au catalogue (`catalogueDeTest`).
 */
import { describe, it, expect } from 'vitest';
import { catalogueDeTest } from './schemas/catalogue/catalogueDeTest.testkit';
import { idDeFixture } from './idDeFixture.testkit';
import { validateDataset, validateDocument, validerFormeVivante } from './schemas/validate';
import { lireBlocsAvances } from './schemas/blocsAvances';
import { refs } from './schemas/grammaire/ref';

const GROUPE = 'groupe-du-catalogue-des-portes';
const MORT = 'id-mort-du-catalogue-des-portes';
const ID_DU_LIVRE = 'livre-du-catalogue-des-portes';
const LIVRE = idDeFixture('book', ID_DU_LIVRE);
const CAT = catalogueDeTest({
  'groups.json': [{ id: GROUPE, type: 'groups', label: 'Groupe du catalogue des portes' }],
  'books.json': [{ id: ID_DU_LIVRE, type: 'books', label: 'Livre du catalogue des portes', abbr: 'LCP', language: null, folder: null }],
});

/** Un `gods.json` d'un seul dieu, qui accorde le groupe `groupe`. */
const dieux = (groupe: string) => [
  { id: 'dieu-du-catalogue-des-portes', type: 'gods', label: 'Dieu du catalogue des portes', blessings: [], miracles: [], grantGroups: [groupe], source: { book: LIVRE, page: 1 } },
];

/** Les blocs « Avancé » d'un déclencheur dont la condition lit le groupe `groupe`. */
const blocs = (groupe: string) => ({
  triggers: [{ id: 'tr', rect: { x: 0, y: 0, w: 1, h: 1 }, when: { kind: 'has', who: 'target', what: 'group', ref: { id: groupe } }, flow: { kind: 'sequence', etapes: [] } }],
});

describe('portes de la donnée — chaque id jugé sous le catalogue passé', () => {
  it('validateDocument', () => {
    expect(validateDocument(refs('groupe'), [GROUPE], CAT)).toBeNull();
    expect(validateDocument(refs('groupe'), [MORT], CAT)?.map((f) => f.message).join('\n')).toContain(MORT);
  });

  it('validerFormeVivante', () => {
    expect(validerFormeVivante(refs('groupe'), [GROUPE], CAT)).toBeNull();
    expect(validerFormeVivante(refs('groupe'), [MORT], CAT)?.fautes.map((f) => f.message).join('\n')).toContain(MORT);
  });

  it('validateDataset', () => {
    expect(validateDataset('gods.json', dieux(GROUPE), CAT)).toBeNull();
    expect(validateDataset('gods.json', dieux(MORT), CAT)).toContain(MORT);
  });

  it('lireBlocsAvances', () => {
    expect(lireBlocsAvances(blocs(GROUPE), CAT)).toMatchObject({ ok: true });
    const refus = lireBlocsAvances(blocs(MORT), CAT);
    expect(refus.ok ? '' : refus.rapport).toContain(MORT);
  });
});
