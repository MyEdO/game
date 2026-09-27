/**
 * Contrat de donnée (Lot 1 — chantier pérennité 10 ans) : garantit que
 * `src/data/*.json` reste conforme à son schéma zod (`src/data/schemas/defs/`), migré INCRÉMENT par
 * INCRÉMENT (comme les registres `gen-registry.mjs`). Trois volets, patron `comment-poison-guard.test.ts` :
 *  (a) chaque document REGISTRÉ des DEUX racines (`DEFS_DE_DOCUMENT` = `src/data` + `src/scenes`)
 *      parse et valide son JSON réel — message actionnable ;
 *  (b) EXHAUSTIVITÉ : tout `src/data/*.json` est soit registré, soit dans `PENDING` (gelé à l'état
 *      initial de la migration — characteristics.json en est sorti, l'EXEMPLAIRE de la convention) ;
 *  (c) CLIQUET : une entrée `PENDING` qui a désormais un schéma doit en SORTIR (sinon la liste ne
 *      fond jamais, cf. le même resserrage sur `no-emoji-affordance.test.ts`) ;
 *  (d) preuve plantée : une clé inconnue est REJETÉE par le schéma `characteristics` (TDD).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { fileURLToPath } from 'node:url';
import { schema as characteristicsSchema } from './schemas/defs/characteristics';
import { DEFS_DE_DOCUMENT, validateDataset } from './schemas/validate';
import type { RacineDocument } from './schemas/types';

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
const SCENES_DIR = fileURLToPath(new URL('../scenes/', import.meta.url));
/** Dossier de chaque racine de documents — `SchemaDef.file` est relatif a SA racine. */
const DIR_DE_RACINE: Record<RacineDocument, string> = { 'src/data': DATA_DIR, 'src/scenes': SCENES_DIR };

/** Les projets livrés (`projetsLivres.mjs`), chemins relatifs a la racine `src/scenes`. */
const projetsDeScene = (): string[] => listerProjetsLivres();

/**
 * Documents sans schéma, DÉSIGNÉS PAR LEUR CHEMIN COMPLET (`src/data/x.json`, `src/scenes/y/z.json`)
 * — VIDE depuis la fin de la migration (les deux racines sont sous contrat) : tout nouveau document
 * doit NAÎTRE avec son def (`schemas/defs/<nom>.ts` ou `schemas/defs-scenes/<nom>.ts` + `npm run gen`),
 * sinon le volet (b) échoue. Une entrée ne s'ajoute ici qu'à titre transitoire assumé, jamais durable.
 */
const PENDING = new Set<string>([]);

describe('contrat de donnée — les documents des deux racines valident leur schéma zod', () => {
  for (const def of DEFS_DE_DOCUMENT) {
    it(`${def.root}/${def.file} valide ${def.schema === characteristicsSchema ? '(schéma characteristics)' : 'son schéma'}`, () => {
      const raw = JSON.parse(readFileSync(`${DIR_DE_RACINE[def.root]}${def.file}`, 'utf8'));
      expect(validateDataset(def.file, raw)).toBeNull();
    });
  }

  it('EXHAUSTIVITÉ : tout document des DEUX racines est registré ou explicitement PENDING', () => {
    const registres = new Set(DEFS_DE_DOCUMENT.map((d) => `${d.root}/${d.file}`));
    const documents = [
      ...listerDossier(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => `src/data/${f}`),
      ...projetsDeScene().map((f) => `src/scenes/${f}`),
    ];
    const orphans = documents.filter((f) => !registres.has(f) && !PENDING.has(f));
    expect(orphans, 'Document(s) ni schématisé(s) ni dans PENDING — ajouter un def (defs/ ou defs-scenes/) ou l\'entrée PENDING').toEqual([]);
  });

  it('CLIQUET : aucune entrée PENDING ne doit avoir déjà un schéma (retirer de PENDING sinon)', () => {
    const registres = new Set(DEFS_DE_DOCUMENT.map((d) => `${d.root}/${d.file}`));
    const staleEntries = [...PENDING].filter((f) => registres.has(f));
    expect(staleEntries, 'Entrée(s) PENDING périmée(s) — un schéma existe déjà : les retirer de PENDING').toEqual([]);
  });

  it('preuve plantée (TDD) : une clé inconnue est REJETÉE par le schéma characteristics', () => {
    const planted = [
      { abr: 'CC', label: 'Capacité de Combat', type: 'roll', desc: 'x', base: { Humain: 20 }, source: { book: 'livre-de-base', page: 33 }, inventedField: 'poison' },
    ];
    const result = characteristicsSchema.safeParse(planted);
    expect(result.success).toBe(false);
  });
});
