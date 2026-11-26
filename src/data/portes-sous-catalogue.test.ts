/**
 * Les PORTES de la donnée jugent sous le catalogue qu'elles reçoivent (#5070, étape B) : une donnée qui désigne une
 * entrée absente de l'index des ids, présente au catalogue passé, passe chaque porte ; un id mort y est refusé.
 */
import { describe, it, expect } from 'vitest';
import { catalogueAvec } from './catalogueAvec.testkit';
import { BIBLIOTHEQUE } from './_racines-vivantes.generated';
import { validateDataset, validateDocument, validerFormeVivante } from './schemas/validate';
import { lireBlocsAvances } from './schemas/blocsAvances';
import { refs } from './schemas/grammaire/ref';
import { versDisque } from './schemas/grammaire/prose';

const GROUPE = 'groupe-du-catalogue-des-portes';
const MORT = 'id-mort-du-catalogue-des-portes';
const CAT = catalogueAvec({ 'groups.json': [{ id: GROUPE, type: 'groups', label: 'Groupe du catalogue des portes' }] });

/** `gods.json` en forme disque, plus un dieu qui accorde le groupe `groupe`. */
const dieux = (groupe: string) => {
  const livres = versDisque(BIBLIOTHEQUE['gods.json']) as readonly Record<string, unknown>[];
  return [...livres, { ...livres[0], id: 'dieu-du-catalogue-des-portes', label: 'Dieu du catalogue des portes', grantGroups: [groupe] }];
};

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
