import { describe, it, expect } from 'vitest';
import { parseQuality, splitIndice } from './refFormatLivre';

describe('saisie de qualité — parseQuality (résolution en id STABLE + Indice)', () => {
  it('label exact → `id` du catalogue', () => {
    expect(parseQuality('Précise')).toEqual({ id: 'precise' });
    expect(parseQuality('Perforante')).toEqual({ id: 'perforante' });
  });
  it('casse ignorée → même `id`', () => {
    expect(parseQuality('précise')?.id).toBe('precise');
    expect(parseQuality('À ENROULEMENT')?.id).toBe('a-enroulement');
  });
  it('Indice « X N » et « X (N) » extrait, `id` résolu', () => {
    expect(parseQuality('Solide 3')).toEqual({ id: 'solide', indice: 3 });
    expect(parseQuality('Solide (2)')).toEqual({ id: 'solide', indice: 2 });
    expect(parseQuality('solide 5')).toEqual({ id: 'solide', indice: 5 });
  });
  it('qualité inconnue du registre → null', () => {
    expect(parseQuality('Tournoyante')).toBeNull();
    expect(parseQuality('Bidon 9')).toBeNull();
    expect(parseQuality('')).toBeNull();
  });
  it('robuste : un label non-exact ne matche plus (fin du startsWith fragile)', () => {
    expect(parseQuality('Précise lame')).toBeNull(); // un startsWith aurait faussement matché 'Précise'
    expect(parseQuality('Pré')).toBeNull();
  });
});

describe('saisie de qualité — splitIndice', () => {
  it('sépare l’Indice de fin (« X N » / « X (N) ») et conserve les labels sans Indice', () => {
    expect(splitIndice('Solide 3')).toEqual({ label: 'Solide', indice: 3 });
    expect(splitIndice('Recharge (2)')).toEqual({ label: 'Recharge', indice: 2 });
    expect(splitIndice('Précise')).toEqual({ label: 'Précise' });
    expect(splitIndice('  À Enroulement ')).toEqual({ label: 'À Enroulement' });
  });
});
