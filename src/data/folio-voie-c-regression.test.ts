/**
 * La VOIE C ne tolère aucune réfutation (#1225) — ce test prouve que sa liste vide est un solde, pas un
 * angle mort. `book-source-integrity.test.ts` ne peut le montrer : il mesure `src/data` tel quel, où
 * plus aucun folio n'est réfutable par le titre ; un détecteur éteint y rendrait exactement la même
 * liste vide. On mesure donc sur une COPIE temporaire d'un dataset réel dont UN folio est remis faux :
 * la voie C doit NOMMER l'entrée, avec le folio du titre mesuré au Source.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditFolios } from '../../scripts/guards/lib/folioIntegrity.mjs';

const DIR = __dirname;
/** Entrée témoin : `qualities.json:leger` — folio réel 292 (`60 - Fabrication.md`), attesté aussi par
 *  l'index du LDB. Son ancien folio faux, 286, sert de mutation. */
const DATASET = 'qualities.json';
const ID = 'leger';
const FOLIO_FAUX = 286;
const FOLIO_REEL = 292;

let bac = '';

beforeAll(() => {
  bac = mkdtempSync(join(tmpdir(), 'folio-voie-c-'));
});

afterAll(() => {
  if (bac) rmSync(bac, { recursive: true, force: true });
});

/** Écrit la copie du dataset dans le bac, `page` de l'entrée témoin forcée, et rend la mesure. */
function auditAvecFolio(page: number): ReturnType<typeof auditFolios> {
  const data = JSON.parse(readFileSync(join(DIR, DATASET), 'utf8')) as { id: string; source: { page: number } }[];
  const entry = data.find((e) => e.id === ID);
  if (!entry) throw new Error(`${DATASET} : entrée ${ID} introuvable`);
  entry.source.page = page;
  writeFileSync(join(bac, DATASET), JSON.stringify(data, null, 2));
  return auditFolios(bac);
}

describe('voie C — une réfutation par le titre est toujours NOMMÉE (#1225)', () => {
  it('témoin : le dataset RÉEL, recopié tel quel, ne rend aucune réfutation par le titre', () => {
    const { titleViolations } = auditAvecFolio(FOLIO_REEL);
    expect(titleViolations.map((v) => v.key)).toEqual([]);
  });

  it('mutation : un folio remis faux est NOMMÉ, avec le folio du titre mesuré', () => {
    const { titleViolations } = auditAvecFolio(FOLIO_FAUX);
    expect(titleViolations.map((v) => v.key)).toEqual([`${DATASET}:${ID}`]);
    const v = titleViolations[0];
    expect(v.page).toBe(FOLIO_FAUX);
    expect(v.proche?.lo).toBe(FOLIO_REEL);
  });
});
