import { describe, it, expect } from 'vitest';
import { coupeAuMot } from './coupeAuMot';

describe('coupeAuMot — la coupe tombe à une FRONTIÈRE DE MOT (R-M2)', () => {
  it('le texte qui tient se rend entier', () => {
    expect(coupeAuMot('Arme de poing', 13)).toBe('Arme de poing');
  });

  it('le plus long préfixe de mots qui tient, sans l’espace, suivi de « … »', () => {
    expect(coupeAuMot('Dégâts +4 · Allonge Moyenne', 20)).toBe('Dégâts +4 · Allonge…');
    expect(coupeAuMot('un deux trois', 7)).toBe('un deux…');
  });

  it('espaces multiples : la coupe ne garde aucune espace avant « … »', () => {
    expect(coupeAuMot('alpha    beta gamma', 8)).toBe('alpha…');
  });

  it('ponctuation : elle reste collée à son mot, le trait d’union ne coupe pas', () => {
    expect(coupeAuMot('Grunni Pierre-de-Feu, nain', 15)).toBe('Grunni…');
    expect(coupeAuMot('Cible : un allié proche', 9)).toBe('Cible :…');
  });

  it('une espace insécable ne coupe pas', () => {
    expect(coupeAuMot('Portée\u00A0: Toucher, cible unique', 7)).toBe('Portée\u00A0:…');
  });

  it('un premier mot plus long que n se rend entier', () => {
    expect(coupeAuMot('Anticonstitutionnellement', 10)).toBe('Anticonstitutionnellement');
    expect(coupeAuMot('Anticonstitutionnellement dit-il', 10)).toBe('Anticonstitutionnellement…');
  });
});
