/**
 * FIDÉLITÉ DE LA MIGRATION #1887 — `regles.json` est ce que le script committé
 * `scripts/migrations/2026-09-28-1887-regles-desc-vers-descref.mjs` rend, rejoué sur la pré-image
 * contre le `Source/` de l'arbre : aucune `desc` n'a été retouchée hors du script.
 *
 * Patron : `migration-b2c-fidelite.test.ts` (aller-retour par le VRAI script, rejeu no-op). La
 * pré-image est `regles.json` au PARENT du commit qui ajoute la migration ; tant que la migration
 * n'est pas committée, c'est `HEAD`.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FICHIER, migrer } from '../../scripts/migrations/2026-09-28-1887-regles-desc-vers-descref.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const MIGRATION = 'scripts/migrations/2026-09-28-1887-regles-desc-vers-descref.mjs';
const git = (...args: string[]) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 26 });

function preImage(): string {
  const ajout = git('log', '--diff-filter=A', '--format=%H', '--', MIGRATION).trim().split('\n').filter(Boolean).pop();
  return git('show', `${ajout ? `${ajout}^` : 'HEAD'}:${FICHIER}`);
}

describe('migration #1887 regles — aller-retour et rejeu', () => {
  it('la pré-image migrée rend regles.json de l’arbre, et le rejeu est no-op', () => {
    const arbre = readFileSync(join(RACINE, FICHIER), 'utf8');
    const avant = preImage();
    expect(avant, 'pre-image identique a l’arbre : l’aller-retour ne prouverait rien').not.toBe(arbre);

    const aller = migrer(avant);
    expect(aller.echecs).toEqual([]);
    // Les fiches que la pré-image porte : une fiche AJOUTÉE après la migration n'est pas de son ressort.
    const ids = new Set((JSON.parse(avant) as { id: string }[]).map((e) => e.id));
    expect(JSON.parse(aller.texte)).toEqual((JSON.parse(arbre) as { id: string }[]).filter((e) => ids.has(e.id)));

    const rejeu = migrer(arbre);
    expect(rejeu.echecs).toEqual([]);
    expect(rejeu.gestes).toEqual([]);
    expect(rejeu.texte).toBe(arbre);
  });
});
