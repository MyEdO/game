/**
 * Garde-fou RÈGLE 5 : aucune balise HTML dans les datasets app-owned. Les champs de prose (`desc`,
 * `text`…) sont du **Markdown verbatim** de la source, rendus par `<Prose>` — jamais du HTML. Ce test
 * échoue si une string contient une vraie balise HTML (`<br>`, `<b>`, `<div>`…), qu'elle vienne
 * d'une saisie ou d'un copier-coller. Détecte des tags NOMMÉS connus, pas un simple « < »
 * (formules « PV < 5 » non concernées).
 *
 * Même règle, même parcours : aucune string ne porte le caractère de remplacement U+FFFD, trace d'un
 * encodage cassé à la saisie que le `Source/` ne porte pas (#3628, #1831).
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

/** Caractère de remplacement Unicode, laissé par un décodage raté. */
const REMPLACEMENT = /\uFFFD/;

/** Chemins de toutes les strings que `fautive` refuse (chemin lisible → string fautive). */
function stringsFautives(value: unknown, fautive: RegExp, path: string, out: string[]): void {
  if (typeof value === 'string') {
    if (fautive.test(value)) out.push(`${path} : ${JSON.stringify(value.slice(0, 80))}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => stringsFautives(v, fautive, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) stringsFautives(v, fautive, path ? `${path}.${k}` : k, out);
  }
}

function fautes(f: string, fautive: RegExp): string[] {
  const hits: string[] = [];
  stringsFautives(JSON.parse(readFileSync(join(DIR, f), 'utf8')), fautive, '', hits);
  return hits;
}

describe('Règle 5 — prose en Markdown, jamais en HTML', () => {
  for (const f of files) {
    it(`${f} : aucune balise HTML`, () => {
      const hits = fautes(f, HTML_TAG);
      expect(hits, `Balises HTML trouvées (à convertir en Markdown) :\n${hits.join('\n')}`).toEqual([]);
    });
  }
});

describe('Règle 5 — prose verbatim, jamais d’encodage cassé', () => {
  for (const f of files) {
    it(`${f} : aucun caractère U+FFFD`, () => {
      const hits = fautes(f, REMPLACEMENT);
      expect(hits, `U+FFFD trouvés (recoller le passage depuis \`Source/\`) :\n${hits.join('\n')}`).toEqual([]);
    });
  }
});
