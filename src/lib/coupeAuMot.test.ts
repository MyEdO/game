import { describe, it, expect } from 'vitest';
import { coupeAuMot } from './coupeAuMot.mjs';

describe('coupeAuMot — la coupe tombe à une FRONTIÈRE DE MOT (R-M2)', () => {
  it('le texte qui tient se rend entier', () => {
    expect(coupeAuMot('Arme de poing', 13)).toBe('Arme de poing');
  });

  it('`n` borne le RENDU, ellipse comprise : longueur `n` entière, au-delà coupée en au plus `n`', () => {
    const texte = (longueur: number) => 'mot '.repeat(longueur).slice(0, longueur).replace(/ $/, 'x');
    for (const n of [7, 8, 25, 59, 60, 119, 120, 200]) {
      expect(coupeAuMot(texte(n), n), `longueur ${n}`).toBe(texte(n));
      for (const longueur of [n + 1, n + 2, n + 3, n + 4, n + 5]) {
        const coupe = coupeAuMot(texte(longueur), n);
        expect(coupe.endsWith('…'), `longueur ${longueur} : ${coupe}`).toBe(true);
        expect(coupe.length, `longueur ${longueur} : ${coupe}`).toBeLessThanOrEqual(n);
      }
    }
  });

  it('le plus long préfixe de mots qui tient, sans l’espace, suivi de « … »', () => {
    expect(coupeAuMot('Dégâts +4 · Allonge Moyenne', 20)).toBe('Dégâts +4 · Allonge…');
    expect(coupeAuMot('un deux trois', 8)).toBe('un deux…');
    expect(coupeAuMot('un deux trois', 7)).toBe('un…');
  });

  it('espaces multiples : la coupe ne garde aucune espace avant « … »', () => {
    expect(coupeAuMot('alpha    beta gamma', 8)).toBe('alpha…');
  });

  it('ponctuation : elle reste collée à son mot, le trait d’union ne coupe pas', () => {
    expect(coupeAuMot('Grunni Pierre-de-Feu, nain', 15)).toBe('Grunni…');
    expect(coupeAuMot('Cible : un allié proche', 9)).toBe('Cible :…');
  });

  it('une espace insécable ne coupe pas (U+00A0, U+2007, U+202F)', () => {
    expect(coupeAuMot('Portée\u00A0: Toucher, cible unique', 7)).toBe('Portée\u00A0:…');
    expect(coupeAuMot('un\u2007deux trois', 4)).toBe('un\u2007deux…');
    expect(coupeAuMot('12\u202F500 couronnes', 4)).toBe('12\u202F500…');
  });

  it('un premier mot plus long que `n - 1` se rend entier : seule sortie au-delà de `n`', () => {
    expect(coupeAuMot('Anticonstitutionnellement', 10)).toBe('Anticonstitutionnellement');
    expect(coupeAuMot('Anticonstitutionnellement dit-il', 10)).toBe('Anticonstitutionnellement…');
  });

  it('les blancs de tête ne sont pas un mot : le texte n’est jamais perdu', () => {
    expect(coupeAuMot(' Anticonstitutionnellement dit', 10)).toBe(' Anticonstitutionnellement…');
    expect(coupeAuMot('   abcdefghij klm', 5)).toBe('   abcdefghij…');
    expect(coupeAuMot('  un deux trois', 8)).toBe('  un…');
  });
});
