/**
 * PREUVE de la table figée de `scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs` (#1887
 * lot 6a-2c), rejouée sur la pré-image : chaque adresse RÉSOUT, CONTIENT la desc (`aligner`), et UN
 * seul bloc du livre la contient, dont l'adresse est la plus petite unité (le bloc ou sa table entière).
 * La pré-image est `regles.json` au PARENT du commit qui ajoute la migration ; tant qu'elle n'est pas
 * committée, c'est `HEAD`.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADRESSES, FICHIER, lieuxDe, migrer, prouver } from '../../scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const MIGRATION = 'scripts/migrations/2026-10-05-1887-regles-adresses-prouvees.mjs';
const git = (...args: string[]) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 26 });

interface Entree { id: string; desc?: string; descRef?: unknown; source: { book: string } }

function preImage(): string {
  const ajout = git('log', '--diff-filter=A', '--format=%H', '--', MIGRATION).trim().split('\n').filter(Boolean).pop();
  return git('show', `${ajout ? `${ajout}^` : 'HEAD'}:${FICHIER}`);
}

const avant = preImage();
const inline = new Map((JSON.parse(avant) as Entree[]).filter((e) => typeof e.desc === 'string').map((e) => [e.id, e]));
const arbre = new Map((JSON.parse(readFileSync(join(RACINE, FICHIER), 'utf8')) as Entree[]).map((e) => [e.id, e]));
const entree = (id: string) => inline.get(id) as Entree & { desc: string };

describe('migration #1887 lot 6a-2c — la table figée est prouvée', () => {
  it.each(Object.keys(ADRESSES))('%s : résout, contient sa desc, UN lieu au livre, adresse écrite = adresse prouvée', (id) => {
    expect(inline.has(id), `${id} n'est pas inline dans la pré-image`).toBe(true);
    const preuve = prouver(entree(id), ADRESSES[id]);
    expect(preuve.erreur).toBeUndefined();
    expect(preuve.preuve?.lieux).toBe(1);
    expect(preuve.preuve?.ecartDeLongueurNormalisee).toBeGreaterThan(0);
    expect(arbre.get(id)?.descRef).toEqual(preuve.ref);
  });

  it('une adresse qui ne contient pas la desc est REFUSÉE, nommément, sans écriture', () => {
    const fausse = { ...ADRESSES, 'main-secondaire': { ...ADRESSES['main-secondaire'], b0: 0, b1: 0 } };
    const r = migrer(avant, fausse);
    expect(r.echecs).toEqual([expect.stringMatching(/main-secondaire .*n'est pas contenue/)]);
    expect(r.texte).toBe(avant);
  });

  it('une adresse qui contient la desc sans être la plus petite unité est REFUSÉE', () => {
    const large = { ...ADRESSES, 'main-secondaire': { ...ADRESSES['main-secondaire'], b0: 0, b1: 1 } };
    const r = migrer(avant, large);
    expect(r.echecs).toEqual([expect.stringMatching(/main-secondaire .*plus petite unité/)]);
    expect(r.texte).toBe(avant);
  });

  it('navigation-progression reste hors table : aucun bloc du livre ne contient sa desc', () => {
    expect(Object.keys(ADRESSES)).not.toContain('navigation-progression');
    const e = entree('navigation-progression');
    expect(lieuxDe(e.source.book, e.desc)).toEqual([]);
  });
});
