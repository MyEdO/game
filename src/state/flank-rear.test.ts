import { describe, it, expect } from 'vitest';
import { isFlankOrRear } from '../noyau/monde/combatGeometry';

// Flanc/dos (LDB 14 l.62) : front = orientation du défenseur ±45° (3 dir. avant) ; flanc/dos = les 5 autres.
describe('isFlankOrRear — attaque dans le dos ou sur les côtés (LDB 14 l.62)', () => {
  it('défenseur face au N : attaque depuis le N (front) → NON', () => {
    expect(isFlankOrRear('N', 'N')).toBe(false);
  });
  it('défenseur face au N : attaque depuis NE/NO (avant ±45°) → NON', () => {
    expect(isFlankOrRear('N', 'NE')).toBe(false);
    expect(isFlankOrRear('N', 'NO')).toBe(false);
  });
  it('défenseur face au N : attaque depuis E/O (flanc, écart 2) → OUI', () => {
    expect(isFlankOrRear('N', 'E')).toBe(true);
    expect(isFlankOrRear('N', 'O')).toBe(true);
  });
  it('défenseur face au N : attaque depuis S/SE/SO (dos) → OUI', () => {
    expect(isFlankOrRear('N', 'S')).toBe(true);
    expect(isFlankOrRear('N', 'SE')).toBe(true);
    expect(isFlankOrRear('N', 'SO')).toBe(true);
  });
  it('symétrique sur une autre orientation (E)', () => {
    expect(isFlankOrRear('E', 'E')).toBe(false); // front
    expect(isFlankOrRear('E', 'NE')).toBe(false); // avant
    expect(isFlankOrRear('E', 'N')).toBe(true); // flanc
    expect(isFlankOrRear('E', 'O')).toBe(true); // dos
  });
});
