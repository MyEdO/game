/**
 * Garde de `regles.json` — catalogue des procédures / options de jeu (#392), prose du livre ADRESSÉE
 * au `Source/` (`descRef`, #1887) ou inline (`desc`, stock `PROSE_INLINE_TOLEREE`). Le parse (`schema-contract.test.ts`) refuse déjà un `id`, un `label`,
 * une prose (`desc` ou `descRef`) ou une `source.page` absents ; `book-source-integrity.test.ts`, un
 * `source.book` hors `books.json`. Reste ce que l'enveloppe laisse passer : une prose faite de blancs.
 */
import { describe, it, expect } from 'vitest';
import { regles } from './index';

describe('regles.json — prose non blanche', () => {
  it('chaque entrée rend une prose qui n’est pas faite que de blancs', () => {
    const blanches = regles.filter((r) => r.desc.trim().length === 0).map((r) => r.id);
    expect(blanches).toEqual([]);
  });
});
