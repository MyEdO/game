/**
 * LE CATALOGUE DE LA PARTIE (#5069, #5063) : la partie le possède (`CatalogueDeLaPartie`), son propriétaire le repose
 * au branchement et à chaque écriture au seam tant qu'il est branché, si les documents ou les règles maison ont changé
 * (fossile 5), `recomposer` le remplace.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { creerPartie, etatInitialDuJeu } from './index';
import { ENTREES_DU_BANC } from './banc.testkit';
import { catalogueDuProcessus } from '../data/catalogueDuProcessus';
import { catalogueDeTest, type LivreDeTest } from '../data/schemas/catalogue/catalogueDeTest.testkit';
import { datasetArray, resetData, setDataset } from '../data/overrides';
import { idDeFixture } from '../data/idDeFixture.testkit';

/** Une règle booléenne de fixture, déclarée par la suite. */
const REGLE_DE_FIXTURE: NonNullable<LivreDeTest['reglesOptionnelles.json']>[number] = {
  id: idDeFixture('regleOptionnelle', 'regle-de-fixture-du-catalogue'), type: 'reglesOptionnelles', label: 'Règle de fixture',
  ref: 'LDB 01 l.1', source: { book: idDeFixture('book', 'livre-de-test'), page: 1 }, group: 'Test', kind: 'flag', default: false,
};

afterEach(() => resetData());

/** Une écriture au seam qui ne change aucune entrée. */
const ecrireAuSeam = (): void => setDataset('mutations', [...datasetArray('mutations')]);

describe('le catalogue de la partie', () => {
  it('s’ouvre sur le catalogue du processus, et une écriture au seam le repose', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    try {
      const ouvert = partie.etat().catalogue;
      expect(ouvert).toBe(catalogueDuProcessus());
      ecrireAuSeam();
      expect(partie.etat().catalogue).not.toBe(ouvert);
      expect(partie.etat().catalogue).toBe(catalogueDuProcessus());
    } finally {
      partie.fermer();
    }
  });

  it('`recomposer` remplace le catalogue par celui reçu', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    try {
      const recu = catalogueDeTest({});
      partie.recomposer(recu);
      expect(partie.etat().catalogue).toBe(recu);
    } finally {
      partie.fermer();
    }
  });

  it('après `fermer`, aucune écriture au seam ne le repose', () => {
    const partie = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    const ferme = partie.etat().catalogue;
    partie.fermer();
    ecrireAuSeam();
    expect(partie.etat().catalogue).toBe(ferme);
  });

  it('une partie suspendue garde le sien sous une écriture faite ailleurs, et le reçoit à jour rebranchée', () => {
    const suspendue = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    const garde = suspendue.etat().catalogue;
    let ecritures = 0;
    suspendue.abonner(() => { ecritures++; });
    const branchee = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    try {
      ecrireAuSeam();
      expect(branchee.etat().catalogue).toBe(catalogueDuProcessus());
      expect(ecritures, 'la partie suspendue a reçu une écriture').toBe(0);
      const rebranchee = suspendue.etat().catalogue;
      expect(rebranchee).not.toBe(garde);
      expect(rebranchee).toBe(catalogueDuProcessus());
    } finally {
      branchee.fermer();
      suspendue.fermer();
    }
  });

  it('un abonné qui relit sa partie pendant la repose d’une autre ouverture la relit sans lever', () => {
    const a = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    let une = true;
    a.abonner(() => {
      if (une) {
        une = false;
        a.etat();
      }
    });
    const b = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    try {
      ecrireAuSeam();
      expect(() => a.etat()).not.toThrow();
      expect(() => b.etat()).not.toThrow();
      expect(() => a.etat()).not.toThrow();
    } finally {
      a.fermer();
      b.fermer();
    }
  });

  it('chaque partie garde ses règles maison dans son catalogue, à travers suspension et rebranchement', () => {
    setDataset('reglesOptionnelles', [...datasetArray('reglesOptionnelles'), REGLE_DE_FIXTURE]);
    const regle = REGLE_DE_FIXTURE;
    const valeur = !regle.default;
    const a = creerPartie(etatInitialDuJeu(), { ...ENTREES_DU_BANC, reglesMaison: { [regle.id]: valeur } });
    const b = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    try {
      expect(b.etat().catalogue.regles[regle.id]).toBeUndefined();
      expect(a.etat().catalogue.regles[regle.id]).toBe(valeur);
      expect(b.etat().catalogue.regles[regle.id]).toBeUndefined();
      expect(a.etat().catalogue.regles[regle.id]).toBe(valeur);
    } finally {
      a.fermer();
      b.fermer();
    }
  });

  it('`recomposer` sur une partie suspendue la branche et lui pose le catalogue reçu, l’autre garde le sien', () => {
    const suspendue = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    const autre = creerPartie(etatInitialDuJeu(), ENTREES_DU_BANC);
    try {
      const sien = autre.etat().catalogue;
      const recu = catalogueDeTest({});
      suspendue.recomposer(recu);
      expect(suspendue.etat().catalogue).toBe(recu);
      expect(autre.etat().catalogue).toBe(sien);
    } finally {
      suspendue.fermer();
      autre.fermer();
    }
  });
});
