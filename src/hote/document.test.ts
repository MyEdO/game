import { describe, it, expect } from 'vitest';
import { redigerLeDocument } from './document';

describe('redigerLeDocument (#4574) : la phrase du document remis', () => {
  it('un document d’auteur se rend tel quel', () => {
    expect(redigerLeDocument({ genre: 'auteur', titre: 'Lettre', texte: 'Cher ami,\n\nadieu.' })).toEqual({ titre: 'Lettre', texte: 'Cher ami,\n\nadieu.' });
  });

  it('un naufrage se rédige d’un paragraphe par fait : navire, cargaison, chaque héros, rivage', () => {
    const test = { roll: 40, target: 35, sl: 0, difficulty: 'intermediaire' } as const;
    const { titre, texte } = redigerLeDocument({
      genre: 'naufrage', navire: { nom: 'La Mouette' }, cargaison: { nom: 'Cogue' },
      heros: [
        { id: 'a', nom: 'Anna', issue: 'nage', test },
        { id: 'b', nom: 'Bruno', issue: 'inconscient' },
        { id: 'c', nom: 'Carl', issue: 'noye', test },
      ],
      rivage: { id: 'A', nom: 'Salzenmund' },
    });
    expect(titre).toBe('Naufrage');
    expect(texte.split('\n\n')).toEqual([
      'La Mouette sombre corps et biens.',
      'Cogue et sa cargaison embarquée sombrent avec elle.',
      'Anna — Natation (Intermédiaire (+0)) : rejoint la surface et nage vers la côte.',
      'Bruno — inconscient dans les flots : emporté sans pouvoir nager (noyé).',
      'Carl — Natation (Intermédiaire (+0)) : emporté par les flots (noyé).',
      "Les rescapés (Anna) s'échouent à Salzenmund.",
    ]);
  });
});
