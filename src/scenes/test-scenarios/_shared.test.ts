import { describe, it, expect } from 'vitest';
import { arena, renforcerCompetence } from './_shared';
import type { Combatant } from '../../engine/types';
import { isWalkable } from '../../noyau/monde/scene';

describe('arena (helper scénarios de test)', () => {
  it('produit une scène dégagée avec un point de départ héros', () => {
    const s = arena({ id: 'arn', label: 'Arène', w: 16, h: 10 });
    expect(s.dimensions).toEqual({ w: 16, h: 10 });
    expect(s.layers[0].tiles.length).toBe(160);
    expect(s.entities.find((e) => e.kind === 'heroStart')).toBeTruthy();
    expect(isWalkable(s, 8, 5)).toBe(true); // herbe = praticable
    expect(s.encounters).toEqual([]);
  });
});

describe('renforcerCompetence (helper scénarios de test)', () => {
  const heros = (): Combatant => ({ skills: [] }) as unknown as Combatant;

  it('pose la Caractéristique de la donnée et renforce l’instance existante', () => {
    const h = heros();
    renforcerCompetence(h, 'perception', 30);
    renforcerCompetence(h, 'perception', 50);
    expect(h.skills).toEqual([{ id: 'perception', characteristic: 'initiative', advances: 50 }]);
  });

  it('une Compétence groupée se possède par spécialisation, désignée par son id (LDB 09 l.40)', () => {
    const h = heros();
    expect(() => renforcerCompetence(h, 'voile', 40)).toThrow(/groupée/);
    expect(() => renforcerCompetence(h, 'voile', 40, 'Cogue')).toThrow(/horsCatalogue/);
    renforcerCompetence(h, 'voile', 40, 'cogue');
    expect(h.skills).toEqual([{ id: 'voile', spec: 'cogue', characteristic: 'agilite', advances: 40 }]);
  });
});
