/**
 * Garde de `regles.json` — catalogue des procédures / options de jeu (#392), prose du livre ADRESSÉE
 * au `Source/` (`descRef`, #1887) ou inline (`desc`, stock `PROSE_INLINE_TOLEREE`). Le parse (`schema-contract.test.ts`) refuse déjà un `id`, un `label`,
 * une prose (`desc` ou `descRef`) ou une `source.page` absents ; `book-source-integrity.test.ts`, un
 * `source.book` hors `books.json`. Reste ce que l'enveloppe laisse passer : une prose faite de blancs.
 * Le schéma de la famille n'admet que des fragments `blocs` (`fragmentsAdmis`, `schemas/defs/regles.ts`).
 */
import { describe, it, expect } from 'vitest';
import { regles } from './index';
import { schema } from './schemas/defs/regles';
import { readFileSync } from 'node:fs';

describe('regles.json — prose non blanche', () => {
  it('chaque entrée rend une prose qui n’est pas faite que de blancs', () => {
    const blanches = regles.filter((r) => r.desc.trim().length === 0).map((r) => r.id);
    expect(blanches).toEqual([]);
  });
});

describe('regles.json — adresses à fragments `blocs` seuls', () => {
  /** Le fichier tel que sur le disque : l'import JSON le rend matérialisé (`desc` résolue). */
  const reglesJson: unknown = JSON.parse(readFileSync(new URL('./regles.json', import.meta.url), 'utf8'));
  const adressee = (reglesJson as { descRef?: unknown }[]).find((e) => e.descRef !== undefined)!;
  const avec = (parts: unknown[]) => [{ ...adressee, descRef: { ...(adressee.descRef as object), parts } }];

  it('le fichier parse, et une entrée adressée par fragment `blocs` aussi', () => {
    expect(schema.safeParse(reglesJson).success).toBe(true);
    expect(schema.safeParse(avec((adressee.descRef as { parts: unknown[] }).parts)).success).toBe(true);
  });

  it('une entrée adressée par fragment `cellule` est REFUSÉE au parse, à son `kind`', () => {
    const r = schema.safeParse(avec([{ kind: 'cellule', sec: 'difficultes-de-combat', secOcc: 1, row: 'Viser', col: 'Effet', sum: '0123456789abcdef' }]));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.slice(-3).join('.'))).toContain('parts.0.kind');
  });
});
