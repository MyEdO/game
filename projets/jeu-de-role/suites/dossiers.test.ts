/** Les fiches de dossier de chapitre du jeu de rôle (#2290) : chaque fiche commitée de `dossiers/` passe le chargeur
 *  (`chargerDossiers`, `scripts/raw/lib/dossiers.mjs`), son `<ABBR>` est un sigle de `src/data/books.json` et son
 *  chapitre a un fichier (`chapterFile`), ses `id` sont uniques et au format `ID_D_ENTREE`. */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chargerDossiers } from '../../../scripts/raw/lib/dossiers.mjs';
// @ts-expect-error - module ESM JS (pas de types)
import { chapterFile, livreDuSigle } from '../../../scripts/raw/_lib.mjs';
import { ID_D_ENTREE } from '../../../src/data/source/dossier';

const DOSSIERS = chargerDossiers(fileURLToPath(new URL('../dossiers', import.meta.url)));

describe('les fiches de dossier de chapitre du jeu de rôle', () => {
  it('le dossier porte des fiches', () => {
    expect(DOSSIERS.length).toBeGreaterThan(0);
  });

  it('chaque fiche commitée est au schéma, sigle et chapitre résolus', () => {
    const fautes = DOSSIERS.flatMap(({ chemin, abbr, nn }) => [
      livreDuSigle(abbr) ? null : `${chemin} : « ${abbr} » n'est le sigle d'aucun livre de src/data/books.json`,
      livreDuSigle(abbr) && !chapterFile(abbr, nn) ? `${chemin} : ${abbr} ${nn} n'a aucun fichier chapitre (chapterFile)` : null,
    ]).filter(Boolean);
    expect(fautes).toEqual([]);
  });

  it('ids globaux uniques par fiche, au format `<ABBR>-<NN>#<id>`', () => {
    for (const { chemin, ids } of DOSSIERS) {
      expect(new Set(ids).size, `${chemin} : id en double`).toBe(ids.length);
      for (const id of ids) expect(id, chemin).toMatch(ID_D_ENTREE);
    }
  });
});
