import { describe, it, expect } from 'vitest';
import { marquesDesEtats } from './marquesDesEtats';

describe('marquesDesEtats — la marque de chaque État sur son porteur (#3834)', () => {
  it('son nom, sa valeur au-delà d’un, sa teinte, son visuel et son son en boucle', () => {
    expect(marquesDesEtats([{ id: 'en-flammes', valeur: 1 }, { id: 'hemorragique', valeur: 3 }])).toEqual([
      { id: 'en-flammes', texte: 'En flammes', couleur: '#ff7a2a', visuel: 'feu', son: expect.objectContaining({ id: 'crepitement' }) },
      { id: 'hemorragique', texte: 'Hémorragique 3', couleur: '#d02828', visuel: 'lueur', son: null },
    ]);
  });
});
