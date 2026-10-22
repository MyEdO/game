/**
 * Garde-fou RÈGLE 5 : aucune balise HTML dans les datasets app-owned. Les champs de prose (`desc`,
 * `text`…) sont du **Markdown verbatim** de la source, rendus par `<Prose>` — jamais du HTML. Ce test
 * échoue si une string contient une vraie balise HTML (`<br>`, `<b>`, `<div>`…), qu'elle vienne
 * d'une saisie ou d'un copier-coller. Détecte des tags NOMMÉS connus, pas un simple « < »
 * (formules « PV < 5 » non concernées).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
// La balise HTML se DÉFINIT une seule fois, dans le module feuille du `Source/` : le volet E de
// `prose-resolution.test.ts` juge la prose ADRESSÉE avec exactement ce prédicat.
import { HTML_TAG } from './source/normalize.ts';

const DIR = __dirname;
const files = listerDossier(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

/** Chemins de toutes les strings contenant une balise HTML (chemin lisible → string fautive). */
function htmlStrings(value: unknown, path: string, out: string[]): void {
  if (typeof value === 'string') {
    if (HTML_TAG.test(value)) out.push(`${path} : ${JSON.stringify(value.slice(0, 80))}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => htmlStrings(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) htmlStrings(v, path ? `${path}.${k}` : k, out);
  }
}

describe('Règle 5 — prose en Markdown, jamais en HTML', () => {
  for (const f of files) {
    it(`${f} : aucune balise HTML`, () => {
      const data = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      const hits: string[] = [];
      htmlStrings(data, '', hits);
      expect(hits, `Balises HTML trouvées (à convertir en Markdown) :\n${hits.join('\n')}`).toEqual([]);
    });
  }
});
