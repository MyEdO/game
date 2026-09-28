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

  it('quand les blancs de tête et le premier mot dépassent ensemble `n - 1`, ils se rendent entiers (suivis de « … » si du texte les suit) : seule sortie au-delà de `n`', () => {
    expect(coupeAuMot('Anticonstitutionnellement', 10)).toBe('Anticonstitutionnellement');
    expect(coupeAuMot('Anticonstitutionnellement dit-il', 10)).toBe('Anticonstitutionnellement…');
    expect(coupeAuMot('   abc def', 5)).toBe('   abc…');
  });

  it('balayage à graine fixe : entier s’il tient, sinon un préfixe du texte, non vide, d’au plus `n` caractères hors la seule sortie', () => {
    let graine = 42;
    const alea = () => (graine = (graine * 1103515245 + 12345) >>> 0) / 2 ** 32;
    const alphabet = ['a', 'b', 'c', 'é', ' ', ' ', '\u00A0', '\n', '  '];
    const secable = /[^\S\u00A0\u2007\u202F]/;
    const fautes: string[] = [];
    for (let i = 0; i < 20000 && fautes.length < 5; i++) {
      let s = '';
      for (let k = Math.floor(alea() * 30); k > 0; k--) s += alphabet[Math.floor(alea() * alphabet.length)];
      const n = 1 + Math.floor(alea() * 20);
      const rendu = coupeAuMot(s, n);
      const cas = `${JSON.stringify(s)} ${n} -> ${JSON.stringify(rendu)}`;
      if (s.length <= n) {
        if (rendu !== s) fautes.push(`entier attendu : ${cas}`);
        continue;
      }
      const debut = Math.max(0, s.search(/\S/));
      const mot = s.slice(debut).search(secable);
      const teteEtMot = debut + (mot < 0 ? s.length - debut : mot);
      if (rendu.length > n && teteEtMot <= n - 1) fautes.push(`au-delà de n : ${cas}`);
      const base = rendu.replace(/…$/, '');
      if (!s.startsWith(base)) fautes.push(`pas un préfixe : ${cas}`);
      if (base.trim() === '' && s.trim() !== '') fautes.push(`texte perdu : ${cas}`);
    }
    expect(fautes).toEqual([]);
  }, 5000);

  it('les blancs de tête ne sont pas un mot : le texte n’est jamais perdu', () => {
    expect(coupeAuMot(' Anticonstitutionnellement dit', 10)).toBe(' Anticonstitutionnellement…');
    expect(coupeAuMot('   abcdefghij klm', 5)).toBe('   abcdefghij…');
    expect(coupeAuMot('  un deux trois', 8)).toBe('  un…');
  });
});
