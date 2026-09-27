/**
 * GARDE — aucune API que `zod` étiquette comme retirée (`node_modules/zod/v4/classic/compat.d.ts:10`)
 * n'est employée sous `src/` ni `scripts/` (#1473 R1, décision 8). La liste des noms se lit dans la
 * déclaration de zod (`apisRetirees`, `scripts/guards/lib/zodRetire.mjs`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { apisRetirees, usagesRetirees } from '../scripts/guards/lib/zodRetire.mjs';

const COMPAT = join(dirname(createRequire(import.meta.url).resolve('zod/package.json')), 'v4/classic/compat.d.ts');
const NOMS = apisRetirees(readFileSync(COMPAT, 'utf8'));

describe('API retirée de zod', () => {
  it('la liste se LIT dans `compat.d.ts` et nomme les deux API que le dépôt employait', () => {
    expect(NOMS).toEqual(expect.arrayContaining(['ZodIssueCode', 'ZodTypeAny', 'setErrorMap', 'ZodFirstPartyTypeKind']));
    expect(NOMS).not.toContain('ZodRawShape');
  });

  it('un nom par balise de retrait de `compat.d.ts` — aucune balise ne tombe hors du motif', () => {
    expect(NOMS).toHaveLength(readFileSync(COMPAT, 'utf8').match(/@deprecated/g)!.length);
  });

  it('témoin : un accès `z.Nom` et un import nommé depuis `zod` sont vus, un commentaire ne l’est pas', () => {
    const texte = [
      `ctx.addIssue({ code: z.${'ZodIssueCode'}.custom });`,
      `import { z, type ${'ZodTypeAny'} } from 'zod';`,
      `// z.${'ZodIssueCode'} en commentaire`,
      `const url = 'https://exemple'; // z.${'ZodTypeAny'}`,
    ].join('\n');
    expect(usagesRetirees([{ rel: 'temoin.ts', text: texte }], NOMS)).toEqual(['temoin.ts:1 ZodIssueCode', 'temoin.ts:2 ZodTypeAny']);
  });

  it('aucun site sous `src/` ni `scripts/`', () => {
    const fichiers = readCorpus(['src', 'scripts'], { exts: ['.ts', '.tsx', '.mts', '.mjs'], tests: true });
    expect(usagesRetirees(fichiers, NOMS)).toEqual([]);
  });
});
