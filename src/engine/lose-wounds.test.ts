import { describe, it, expect, afterEach } from 'vitest';
import { applyZeroWounds, loseWounds } from './conditions';
import { setRule, resetRule } from './policy';
import { combattantDeTest, blessuresDeBase } from './combattantDeTest.testkit';
import type { Applique } from './faits';

/** « Gunther », héros à 8 PB sur 10 et 3 Avantages. */
const gunther = (pb = 8, avantage = 3) => combattantDeTest({ id: 'gunther', label: 'Gunther', kind: 'heros', wounds: blessuresDeBase(10, pb), advantage: avantage });
/** « Ilyanwe saignée », 2 Hémorragique, au PB donné. */
const ilyanwe = (pb: number) => combattantDeTest({ id: 'ilyanwe', label: 'Ilyanwe', kind: 'heros', wounds: blessuresDeBase(18, pb), conditions: [{ id: 'hemorragique', value: 2 }] });
const puits = (): Applique => ({ lignes: [], faits: [] });

describe('loseWounds — les PB perdus, versés dans le puits (LDB 14 l.219 ; LDB 18 l.15)', () => {
  afterEach(() => resetRule('combat-aa-avantage-groupe'));

  it('perdre des PB : tout l’Avantage perdu, constaté sans ligne', () => {
    const c = gunther();
    const a = puits();
    expect(loseWounds(c, 5, a)).toBe(5);
    expect(a).toEqual({ lignes: [], faits: [{ genre: 'avantage', cible: 'gunther', camp: 'groupe', valeur: -3, total: 0 }] });
    expect(c.wounds.current).toBe(3);
    expect(c.advantage).toBe(0);
  });

  it('tomber à 0 PB : l’Avantage constaté, l’État À Terre émis avec sa ligne', () => {
    const c = gunther(3, 2);
    const a = puits();
    expect(loseWounds(c, 5, a)).toBe(3);
    expect(a).toEqual({
      lignes: ['Gunther reçoit 1 État À Terre.'],
      faits: [
        { genre: 'avantage', cible: 'gunther', camp: 'groupe', valeur: -2, total: 0 },
        { genre: 'etat', cible: 'gunther', camp: 'groupe', id: 'a-terre', valeur: 1 },
      ],
    });
    expect(c.wounds.current).toBe(0);
  });

  it('porteur d’Hémorragique à 0 PB : une ligne d’À Terre et une d’Inconscient (LDB 16 l.105)', () => {
    const a = puits();
    loseWounds(ilyanwe(3), 10, a);
    expect(a.lignes).toEqual(['Ilyanwe reçoit 1 État À Terre.', 'Ilyanwe reçoit 1 État Inconscient.']);
  });

  it('sans Avantage : aucun fait d’Avantage', () => {
    const a = puits();
    expect(loseWounds(gunther(8, 0), 2, a)).toBe(2);
    expect(a).toEqual({ lignes: [], faits: [] });
  });

  it('Avantage de groupe : l’Avantage du porteur ne bouge pas, aucun fait (AA 11 l.5)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const c = gunther();
    const a = puits();
    expect(loseWounds(c, 2, a)).toBe(2);
    expect(a).toEqual({ lignes: [], faits: [] });
    expect(c.advantage).toBe(3);
  });

  it('déjà à 0 PB, ou montant nul : rien de perdu, Avantage inchangé', () => {
    const c = gunther(0, 2);
    const a = puits();
    expect(loseWounds(c, 5, a)).toBe(0);
    expect(loseWounds(gunther(5, 2), 0, a)).toBe(0);
    expect(a).toEqual({ lignes: [], faits: [] });
    expect(c.advantage).toBe(2);
  });
});

describe('applyZeroWounds — la variation des pions, versée dans le puits (LDB 18 l.15 ; LDB 16 l.115)', () => {
  it('À Terre déjà porté : aucun fait, aucune ligne', () => {
    const c = combattantDeTest({ id: 'gunther', label: 'Gunther', kind: 'heros', wounds: blessuresDeBase(10, 0), conditions: [{ id: 'a-terre', value: 1 }] });
    const a = puits();
    applyZeroWounds(c, a);
    expect(a).toEqual({ lignes: [], faits: [] });
  });

  it('porteur déjà Inconscient : l’État À Terre posé et dit (LDB 18 l.15)', () => {
    const c = combattantDeTest({ id: 'gunther', label: 'Gunther', kind: 'heros', wounds: blessuresDeBase(10, 2), conditions: [{ id: 'inconscient', value: 1 }] });
    const a = puits();
    loseWounds(c, 5, a);
    expect(a.lignes).toEqual(['Gunther reçoit 1 État À Terre.']);
  });

  it('rejoué sur un porteur déjà posé : une seule ligne par État', () => {
    const c = ilyanwe(0);
    const a = puits();
    applyZeroWounds(c, a);
    applyZeroWounds(c, a);
    expect(a.lignes).toEqual(['Ilyanwe reçoit 1 État À Terre.', 'Ilyanwe reçoit 1 État Inconscient.']);
  });
});
