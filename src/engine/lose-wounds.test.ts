import { describe, it, expect, afterEach } from 'vitest';
import { loseWounds } from './conditions';
import { setRule, resetRule } from './policy';
import { combattantDeTest, blessuresDeBase } from './combattantDeTest.testkit';

/** « Gunther », héros à 8 PB sur 10 et 3 Avantages. */
const gunther = (pb = 8, avantage = 3) => combattantDeTest({ id: 'gunther', label: 'Gunther', kind: 'heros', wounds: blessuresDeBase(10, pb), advantage: avantage });

describe('loseWounds — les PB perdus et les faits de leurs conséquences (LDB 14 l.219 ; LDB 18 l.15)', () => {
  afterEach(() => resetRule('combat-aa-avantage-groupe'));

  it('perdre des PB : tout l’Avantage perdu, en fait', () => {
    const c = gunther();
    expect(loseWounds(c, 5)).toEqual({ perdues: 5, faits: [{ genre: 'avantage', cible: 'gunther', camp: 'groupe', valeur: -3, total: 0 }] });
    expect(c.wounds.current).toBe(3);
    expect(c.advantage).toBe(0);
  });

  it('tomber à 0 PB : l’Avantage perdu, puis l’État À Terre posé', () => {
    const c = gunther(3, 2);
    expect(loseWounds(c, 5)).toEqual({ perdues: 3, faits: [
      { genre: 'avantage', cible: 'gunther', camp: 'groupe', valeur: -2, total: 0 },
      { genre: 'etat', cible: 'gunther', camp: 'groupe', id: 'a-terre', valeur: 1 },
    ] });
    expect(c.wounds.current).toBe(0);
  });

  it('sans Avantage : aucun fait d’Avantage', () => {
    expect(loseWounds(gunther(8, 0), 2)).toEqual({ perdues: 2, faits: [] });
  });

  it('Avantage de groupe : l’Avantage du porteur ne bouge pas, aucun fait (AA 11 l.5)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const c = gunther();
    expect(loseWounds(c, 2)).toEqual({ perdues: 2, faits: [] });
    expect(c.advantage).toBe(3);
  });

  it('déjà à 0 PB, ou montant nul : rien de perdu, Avantage inchangé', () => {
    const c = gunther(0, 2);
    expect(loseWounds(c, 5)).toEqual({ perdues: 0, faits: [] });
    expect(loseWounds(gunther(5, 2), 0)).toEqual({ perdues: 0, faits: [] });
    expect(c.advantage).toBe(2);
  });
});
