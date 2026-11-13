/**
 * #3116 — les pièces de l'ensemble qui habille une chose se résolvent par égalité de `habille` (`{ id, type }`), quel
 * que soit l'id de l'ensemble ; une chose qu'aucun ensemble n'habille n'en porte aucune. Les attendus se lisent au
 * catalogue (`gardeRobe`), jamais recopiés.
 */
import { describe, expect, it } from 'vitest';
import { emplacementDePiece, pieceOuVariante, pieceRacine, piecesDEnsemble } from './gardeRobe';
import { findPieceById, gardeRobe, type LigneDeGardeRobe } from '../../data';

const ensembles = gardeRobe.filter((e): e is LigneDeGardeRobe<'ensemble'> => e.kind === 'ensemble');
const variantes = gardeRobe.filter((e): e is LigneDeGardeRobe<'variante'> => e.kind === 'variante');

describe('piecesDEnsemble (#3116)', () => {
  it('chaque ensemble de la garde-robe rend ses pièces par son `habille`', () => {
    expect(ensembles.length).toBeGreaterThan(0);
    for (const e of ensembles) expect(piecesDEnsemble(e.habille), e.id).toEqual(e.pieces);
  });

  it('la tenue habillée par un ensemble rend les pièces de cet ensemble', () => {
    const tenue = ensembles.find((e) => e.habille.type === 'tenue');
    expect(tenue, 'fixture : aucun ensemble de garde-robe.json n’habille une tenue').toBeDefined();
    expect(piecesDEnsemble(tenue!.habille)).toEqual(tenue!.pieces);
  });

  it('une chose qu’aucun ensemble n’habille ne porte aucune pièce', () => {
    expect(piecesDEnsemble({ id: 'dague', type: 'trapping' })).toEqual([]);
  });
});

describe('pieceRacine, pieceOuVariante (#3446)', () => {
  it('une variante se résout à sa pièce : son libellé, la catégorie et l’emplacement de la pièce', () => {
    expect(variantes.length, 'fixture : aucune variante dans garde-robe.json').toBeGreaterThan(0);
    for (const v of variantes) {
      const piece = findPieceById(v.piece.id)!;
      expect(pieceRacine(v.id), v.id).toBe(piece);
      expect(pieceOuVariante(v.id), v.id).toEqual({ label: v.label, categorie: piece.categorie });
      expect(emplacementDePiece(v.id), v.id).toBe(piece.emplacement?.id);
    }
  });

  it('une pièce est sa propre racine, un id inconnu n’en a aucune', () => {
    const piece = gardeRobe.find((e) => e.kind === 'piece')!;
    expect(pieceRacine(piece.id)).toBe(piece);
    expect(pieceRacine('robe-de-bure')).toBeUndefined();
    expect(pieceOuVariante('robe-de-bure')).toBeUndefined();
  });
});
