/**
 * Garde de `regles.json` — catalogue des procédures / options de jeu au texte VERBATIM (#392).
 * Chaque entrée porte un `id` STABLE, un `label`, une `desc` NON VIDE (verbatim Source,
 * routée en tooltip `CodexRef`) et une `source` {book ∈ books.json, page = folio imprimé}.
 */
import { describe, it, expect } from 'vitest';
import { regles, books } from './index';

const BOOK_IDS = new Set(books.map((b) => b.id));

describe('regles.json — procédures de jeu VERBATIM', () => {
  it('chaque entrée a un id, un label, une desc non vide et une source complète', () => {
    for (const r of regles) {
      expect(r.id, `id manquant : ${JSON.stringify(r)}`).toBeTruthy();
      expect(r.label, `label manquant (${r.id})`).toBeTruthy();
      expect(r.desc.trim().length, `desc vide (${r.id})`).toBeGreaterThan(0);
      expect(BOOK_IDS.has(r.source.book), `source.book inconnu (${r.id}) : ${r.source.book}`).toBe(true);
      expect(typeof r.source.page, `source.page absente (${r.id})`).toBe('number');
    }
  });
});
