/** Monnaie des paquets livrés : forme UNIQUE (#1463), dont les tarifs `cost` des dialogues. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { CLASSES_DE_PRICE, SIGNATURES_DE_PRICE, coutsHorsMonnaie, hors, recenserMonnaie } from '../../../src/data/monnaieFormeUnique.testkit';

const RECENSEMENT = recenserMonnaie(cheminsDesProjetsLivres().map((rel) => JSON.parse(readFileSync(rel, 'utf8'))));

describe('monnaie des paquets livrés — forme UNIQUE (#1463)', () => {
  it('aucune dénomination `bronze` ni étalée sur un objet-action', () => {
    expect(RECENSEMENT.bronze).toBe(0);
    expect(RECENSEMENT.etales).toEqual({});
  });

  it('`price` à ses classes et signatures permises ; `cost` ne porte que des montants, tarifs d’arène compris', () => {
    const { classes, signatures } = RECENSEMENT;
    expect(hors(classes.price, CLASSES_DE_PRICE)).toEqual([]);
    expect(hors(signatures.price, SIGNATURES_DE_PRICE)).toEqual([]);
    expect(hors(classes.cost, ['object'])).toEqual([]);
    expect(coutsHorsMonnaie(signatures.cost)).toEqual([]);
    expect(classes.cost.object, 'tarifs d’arène').toBeGreaterThan(0);
  });
});
