import { describe, it, expect } from 'vitest';
import { malevolentInfluenceSeverity, sorceryMandatoryMiscast } from './magic';
import { domainEnvironmentBonus, isSorceryDomain } from './domainAttributes';

describe('Règle du 8 — Influences malfaisantes (LDB 46 l.89)', () => {
  it('dé des unités = 8 près d’une Corruption → Imparfaite Mineure', () => {
    expect(malevolentInfluenceSeverity(8, false, true, false)).toBe('mineure');
    expect(malevolentInfluenceSeverity(18, false, true, false)).toBe('mineure');
    expect(malevolentInfluenceSeverity(98, false, true, false)).toBe('mineure');
  });
  it('escalade en Majeure si une Mineure a déjà été obtenue au Test (« 88 »)', () => {
    expect(malevolentInfluenceSeverity(88, false, true, true)).toBe('majeure');
  });
  it('rien si pas de Corruption à proximité, ou dé des unités ≠ 8', () => {
    expect(malevolentInfluenceSeverity(8, false, false, false)).toBeNull(); // pas de Corruption
    expect(malevolentInfluenceSeverity(7, false, true, false)).toBeNull(); // unités ≠ 8
    expect(malevolentInfluenceSeverity(80, false, true, false)).toBeNull(); // unités = 0
  });
  it('un Test RÉUSSI dont le dé des unités vaut 8 déclenche quand même (LDB : le lancer, pas l’issue)', () => {
    expect(malevolentInfluenceSeverity(8, true, true, false)).toBe('mineure');
  });
});

describe('Sorcellerie — composant obligatoire (LDB 49)', () => {
  it('Sort de Sorcellerie sans composant → Imparfaite Mineure systématique', () => {
    expect(sorceryMandatoryMiscast(true, false)).toBe(true);
  });
  it('avec composant : pas de lancer systématique', () => {
    expect(sorceryMandatoryMiscast(true, true)).toBe(false);
  });
  it('hors Sorcellerie : jamais de lancer systématique', () => {
    expect(sorceryMandatoryMiscast(false, false)).toBe(false);
  });
});

describe('Attributs de Domaine data-driven (LDB 48/49)', () => {
  it('Vie/Ghyran : +10 en environnement rural ou sauvage (LDB 48 l.690)', () => {
    expect(domainEnvironmentBonus({ domainId: { id: 'vie' } }, 'rural')).toBe(10);
    expect(domainEnvironmentBonus({ domainId: { id: 'vie' } }, 'sauvage')).toBe(10);
    expect(domainEnvironmentBonus({ domainId: { id: 'vie' } }, 'urbain')).toBe(0);
    expect(domainEnvironmentBonus({ domainId: { id: 'vie' } }, undefined)).toBe(0);
  });
  it('un Domaine sans attribut d’environnement → 0', () => {
    expect(domainEnvironmentBonus({ domainId: { id: 'feu' } }, 'rural')).toBe(0);
    expect(domainEnvironmentBonus({}, 'rural')).toBe(0);
  });
  it('Sorcellerie : marqueur DONNÉE reconnu (LDB 49)', () => {
    expect(isSorceryDomain({ domainId: { id: 'sorcellerie' } })).toBe(true);
    expect(isSorceryDomain({ domainId: { id: 'feu' } })).toBe(false);
    expect(isSorceryDomain({})).toBe(false);
  });
});
