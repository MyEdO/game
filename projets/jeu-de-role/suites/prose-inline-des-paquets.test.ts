/** Les paquets du jeu ne recopient aucune prose d'un livre extrait (#1390) : leurs `desc` l'adressent ou l'adaptent. */
import { describe, expect, it } from 'vitest';
import { mesurerProseInline } from '../../../scripts/guards/lib/proseInline.mjs';

const PAQUETS_DU_JEU = { dossier: 'projets/jeu-de-role', suffixe: '-projet.json', recursif: true } as const;

describe('prose inline des paquets du jeu (#1389 / #1390)', () => {
  it('aucun nœud ne recopie la prose d’un livre extrait', () => {
    expect(Object.values(mesurerProseInline([PAQUETS_DU_JEU])).flatMap((m) => m.noeuds)).toEqual([]);
  });
});
