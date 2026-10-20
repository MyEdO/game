/**
 * `avecLesTables` pose une fixture pour le test COURANT et rend les tables du jeu à sa fin (#2889, D10) :
 * le test suivant, dans le même processus (`isolate: false`), lit les tables du jeu.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { applierDe } from './cascade';
import { avecLesTables } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';
import { tablesPosees } from './tablesPosees';

const SONDE = 'sonde-noyau-testkit';

describe('avecLesTables — la fixture vit le temps d’un test', () => {
  it('pose : la fixture remplace la table qu’elle nomme, les autres restent celles du jeu', () => {
    avecLesTables({ appliers: { [SONDE]: () => undefined } });
    expect(applierDe(SONDE)).toBeDefined();
    expect(applierDe('triggeredBatchTest'), 'la table nommée est REMPLACÉE, pas complétée').toBeUndefined();
    expect(tablesPosees().crochetsDeCombat).toBe(tablesDuJeu().crochetsDeCombat);
    expect(() => avecLesTables({}), 'une seconde pose dans le même test').toThrow(/déjà posée/);
  });

  it('le test suivant lit les tables du jeu', () => {
    expect(tablesPosees()).toBe(tablesDuJeu());
    expect(applierDe(SONDE)).toBeUndefined();
  });
});

describe('avecLesTables — hors d’un test, elle lève et ne pose rien', () => {
  let refus: unknown;
  beforeAll(() => {
    try { avecLesTables({ appliers: { [SONDE]: () => undefined } }); } catch (e) { refus = e; }
  });

  it('la pose en `beforeAll` a levé, et les tables du jeu sont restées posées', () => {
    expect(refus, 'hors d’un test, aucune restauration ne s’enregistre : la pose doit lever').toBeInstanceOf(Error);
    expect(tablesPosees()).toBe(tablesDuJeu());
    expect(applierDe(SONDE)).toBeUndefined();
  });
});
