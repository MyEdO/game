import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';
import { GALERIES } from '../scripts/gen-galleries.mjs';

/**
 * Garde des galeries QC (#1522, #3058) : chaque page publique est l'octet exact du `build()` de son générateur,
 * nommé par le registre du lanceur (`GALERIES`, `scripts/gen-galleries.mjs`). Les galeries rendent l'hôte web
 * (`src/ui`, `src/gameIso`) : leur garde vit à la racine de `src`, zone de la coque web.
 */
const LANCEUR = join(__dirname, '../scripts/gen-galleries.mjs');
/** Le dossier des pages publiques, racine de leur lecture. */
const PUBLIC = join(__dirname, '../public');

describe('galeries QC — chaque page publique est l’octet exact de son build()', () => {
  it('le registre du lanceur couvre des galeries', () => {
    expect(GALERIES.length).toBeGreaterThan(0);
  });

  it.each(GALERIES)('$module : build() reproduit la page publique à chaque appel', async ({ module }) => {
    const url = new URL(module, pathToFileURL(LANCEUR));
    const galerie = await import(url.href) as { build: () => string; OUT: string };
    expect(typeof galerie.build).toBe('function');
    expect(typeof galerie.OUT).toBe('string');
    expect(dirname(galerie.OUT), `${module} : sa page publique vit sous public/`).toBe(PUBLIC);
    const attendu = readFileSync(join(PUBLIC, basename(galerie.OUT)), 'utf8');
    expect(galerie.build(), `${module} : régénérer la page publique par son CLI`).toBe(attendu);
    expect(galerie.build(), `${module} : build() dépend de ses appels précédents`).toBe(attendu);
  });
});
