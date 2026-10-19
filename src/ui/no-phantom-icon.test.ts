import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { iconRefsIn } from '../../scripts/guards/lib/iconRefs.mjs';
import { ICON_DEFS } from './icons';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou anti-icône-fantôme (#269) : une réf d'icône `icon: '...'`/`"icon": "..."` posée en
 * DONNÉE (`src/state/**`, `src/scenes/**`, `src/data/*.json`) porte le type large `IconIdInput`
 * (`src/ui/icons/types.ts`) — pas l'union `IconId` GÉNÉRÉE qui verrouille `src/ui/**` à la
 * compilation. Une réf inconnue n'y throw QU'AU RENDU (DEV), absorbée en silence par
 * `SceneErrorBoundary` — c'est ce trou que ce test de BUILD ferme : toute réf littérale hors du
 * registre (`src/ui/icons/_registry.generated.ts`, régénéré par `npm run gen`) fait échouer la suite.
 * Mécanique d'extraction (regex `icon:`/`"icon":`, dédup, ligne de 1ʳᵉ occurrence) :
 * `scripts/guards/lib/iconRefs.mjs` (module .mjs pur).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // racine du projet (src/ui/ → ../../)
const SCAN_DIRS = ['src/state', 'src/noyau', 'src/scenes'];

/** `*.test.*` exclus : les tests portent parfois des ids de fixture forgés (pas rendus à
 *  l'utilisateur, pas des affordances réelles). */
const EXCLUDED = (rel: string) => estFichierVitest(rel);

/** Les SOURCES des deux racines de donnée (tests compris — `EXCLUDED` les écarte au site), plus les
 *  datasets PLATS de `src/data`, chacun avec son texte. */
function scanFiles(): { rel: string; text: string }[] {
  const data = join(ROOT, 'src/data');
  return [
    ...readCorpus(SCAN_DIRS, { tests: true }).map(({ rel, text }) => ({ rel, text })),
    ...listerDossier(data)
      .filter((e) => e.endsWith('.json'))
      .map((e) => ({ rel: `src/data/${e}`, text: readFileSync(join(data, e), 'utf8') })),
  ];
}

describe('garde-fou anti-icône-fantôme (réfs de donnée → registre d’icônes)', () => {
  it('toute réf `icon:`/`"icon":` de src/state, src/scenes et src/data/*.json résout dans le registre', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const { rel, text } of scanFiles()) {
      if (EXCLUDED(rel)) continue;
      for (const { id, line } of iconRefsIn(text)) {
        scanned++;
        if (!ICON_DEFS[id]) offenders.push(`${rel}:${line} → icône inconnue « ${id} »`);
      }
    }
    expect(scanned, 'la garde doit scanner AU MOINS un id — sinon elle est morte').toBeGreaterThan(0);
    expect(
      offenders,
      'Icône fantôme détectée — déposer une def dans src/ui/icons/defs/ puis `npm run gen`',
    ).toEqual([]);
  });
});
