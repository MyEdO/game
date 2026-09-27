import { describe, it, expect } from 'vitest';
import { lireSalveMisfire, TABLE_SALVE_MISFIRE, D10_SALVE_MISFIRE } from './artilleryMisfire';
import { ARTILLERY_MISFIRE } from '../data/artilleryMisfire';

/**
 * Incident de Tir d'Artillerie par Salve — LECTURE PURE d'un d10 déjà tombé (AA 10 l.270-277). Le dé
 * vient de la porte (étape à TABLE `TABLE_SALVE_MISFIRE`, #1508 T3b-4), jamais d'un rng local : ce
 * module ne roule plus rien, il LIT — même patron que `structureCritical.test.ts`.
 */
describe('lireSalveMisfire (AA 10 l.270-277)', () => {
  it('1-4 : Bras principal, 1 hit, pièce détruite', () => {
    const r = lireSalveMisfire(2, 5);
    expect(r.id).toBe('bras-principal');
    expect(r.entry.location).toBe('brasPrincipal');
    expect(r.hits).toBe(1);
    expect(r.destroyed).toBe(true);
  });

  it('5-7 : Localisation aléatoire, 1 hit, pièce détruite', () => {
    const r = lireSalveMisfire(6, 5);
    expect(r.id).toBe('localisation-aleatoire');
    expect(r.entry.location).toBe('random');
    expect(r.hits).toBe(1);
    expect(r.destroyed).toBe(true);
  });

  it('8-9 : « Pour chaque Indice de Salve restant » → hits = salveRemaining, pièce détruite', () => {
    const r = lireSalveMisfire(9, 3);
    expect(r.id).toBe('rafale-par-indice');
    expect(r.hits).toBe(3);
    expect(r.destroyed).toBe(true);
  });

  it('8-9 avec 0 Indice de Salve restant → 0 hit (pas de servant touché), toujours détruite', () => {
    const r = lireSalveMisfire(8, 0);
    expect(r.hits).toBe(0);
    expect(r.destroyed).toBe(true);
  });

  it('10 : Tir perdu — 0 hit direct à l’équipe, pièce NON détruite', () => {
    const r = lireSalveMisfire(10, 4);
    expect(r.id).toBe('tir-perdu');
    expect(r.entry.strayFire).toBe(true);
    expect(r.hits).toBe(0);
    expect(r.destroyed).toBe(false);
    expect(r.note).toContain('Esquive Très Difficile');
  });

  it('le dé lu est rendu tel quel — c’est lui que la fenêtre a montré', () => {
    expect(lireSalveMisfire(7, 2).roll).toBe(7);
  });

  it('table contiguë 1..10, chaque entrée nommée + id + note', () => {
    const e = [...ARTILLERY_MISFIRE].sort((a, b) => a.min - b.min);
    expect(e[0].min).toBe(1);
    expect(e[e.length - 1].max).toBe(10);
    for (let i = 1; i < e.length; i++) expect(e[i].min).toBe(e[i - 1].max + 1);
    for (const x of e) expect(x.id && x.label && x.note).toBeTruthy();
  });

  it('chaque face du d10 DÉCLARÉ tombe sur une entrée de la table', () => {
    expect(D10_SALVE_MISFIRE).toEqual({ n: 1, sides: 10 });
    expect(TABLE_SALVE_MISFIRE).toBe('artillery-salve-misfire');
    for (let roll = 1; roll <= D10_SALVE_MISFIRE.sides; roll++) {
      expect(ARTILLERY_MISFIRE.some((e) => e.id === lireSalveMisfire(roll, 1).id), `dé ${roll}`).toBe(true);
    }
  });
});
