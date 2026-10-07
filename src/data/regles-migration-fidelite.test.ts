/**
 * FIDÉLITÉ DES MIGRATIONS #1887 — les adresses de `regles.json` sont celles que les scripts committés
 * rendent, rejoués DANS L'ORDRE sur la pré-image contre le `Source/` de l'arbre :
 *  - `scripts/migrations/2026-09-28-1887-regles-desc-vers-descref.mjs` ;
 *  - `scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs` ;
 *  - `scripts/migrations/2026-10-06-1887-regles-navigation-progression.mjs`.
 * L'aller-retour compare ce que les migrations POSSÈDENT, la projection `id → { desc, descRef }` : le
 * reste de l'entrée (`label`, `source`…) se cure hors d'elles. Le rejeu sur l'arbre est no-op, au texte.
 *
 * Patron : `migration-b2c-fidelite.test.ts` (aller-retour par le VRAI script, rejeu no-op). La
 * pré-image est `regles.json` au PARENT du commit qui ajoute la PREMIÈRE migration.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FICHIER, migrer as migrerPremiere } from '../../scripts/migrations/2026-09-28-1887-regles-desc-vers-descref.mjs';
import { migrer as migrerSeconde } from '../../scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs';
import { migrer as migrerTroisieme } from '../../scripts/migrations/2026-10-06-1887-regles-navigation-progression.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const PREMIERE = 'scripts/migrations/2026-09-28-1887-regles-desc-vers-descref.mjs';
const git = (...args: string[]) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 26 });

function preImage(): string {
  const ajout = git('log', '--diff-filter=A', '--format=%H', '--', PREMIERE).trim().split('\n').filter(Boolean).pop();
  return git('show', `${ajout ? `${ajout}^` : 'HEAD'}:${FICHIER}`);
}

/** Ce que les migrations possèdent : `id → { desc, descRef }`, dans l'ordre du fichier. */
const projection = (texte: string) =>
  (JSON.parse(texte) as { id: string; desc?: unknown; descRef?: unknown }[]).map(({ id, desc, descRef }) => ({ id, desc, descRef }));

describe('migrations #1887 regles — aller-retour et rejeu', () => {
  it('la pré-image migrée par les trois scripts rend les adresses de l’arbre, et le rejeu est no-op', () => {
    const arbre = readFileSync(join(RACINE, FICHIER), 'utf8');
    const avant = preImage();
    expect(projection(avant), 'pre-image identique a l’arbre : l’aller-retour ne prouverait rien').not.toEqual(projection(arbre));

    const premiere = migrerPremiere(avant);
    expect(premiere.echecs).toEqual([]);
    const seconde = migrerSeconde(premiere.texte);
    expect(seconde.echecs).toEqual([]);
    const troisieme = migrerTroisieme(seconde.texte);
    expect(troisieme.echecs).toEqual([]);
    expect(projection(troisieme.texte)).toEqual(projection(arbre));

    for (const migrer of [migrerPremiere, migrerSeconde, migrerTroisieme]) {
      const rejeu = migrer(arbre);
      expect(rejeu.echecs).toEqual([]);
      expect(rejeu.gestes).toEqual([]);
      expect(rejeu.texte).toBe(arbre);
    }
  });
});
