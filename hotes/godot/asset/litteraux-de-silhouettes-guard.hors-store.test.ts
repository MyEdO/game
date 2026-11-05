import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { corpusDesSilhouettes, litterauxDe, SOCLE } from '../../../scripts/guards/lib/litterauxDeSilhouettes.mjs';
import { NOMS_DES_SILHOUETTES } from './silhouettes.ts';

/** GARDE « vocabulaire unique des silhouettes » (#3104, `scripts/guards/lib/litterauxDeSilhouettes.mjs`). */
describe('garde — aucun identifiant de silhouette écrit hors du socle', () => {
  const [nom] = NOMS_DES_SILHOUETTES;

  it('le motif mord chaque littéral entre guillemets simples ou doubles, et rien d’autre', () => {
    expect(litterauxDe(`a = '${nom}'\nb = ["${nom}", x]`, NOMS_DES_SILHOUETTES)).toEqual([{ ligne: 1, texte: `'${nom}'` }, { ligne: 2, texte: `"${nom}"` }]);
    for (const ligne of [`gabarit_${nom}`, `'${nom}_x'`, `'${nom}"`, `\`${nom}\``]) expect(litterauxDe(ligne, NOMS_DES_SILHOUETTES), ligne).toEqual([]);
  });

  it('le socle écrit chaque identifiant une fois', () => {
    const ecrits = litterauxDe(readFileSync(new URL('./silhouettes.ts', import.meta.url), 'utf8'), NOMS_DES_SILHOUETTES).map((l) => l.texte.slice(1, -1));
    expect(ecrits.sort()).toEqual([...NOMS_DES_SILHOUETTES].sort());
  });

  it('le corpus porte la construction, le pont, l’évaluateur et l’hôte, sans tests ni socle', () => {
    const rels = corpusDesSilhouettes().map((f) => f.rel);
    for (const rel of ['scripts/personnage-3d/formes.py', 'scripts/personnage-3d/base/humanoide.py', 'scripts/personnage-3d/base/gabarit.mjs',
      'scripts/personnage-3d/base/gabarit.testkit.ts', 'hotes/godot/asset/evaluateur/evaluer.ts', 'hotes/godot/recette.mjs']) expect(rels, rel).toContain(rel);
    expect(rels.filter((rel) => rel === SOCLE || /(?:^|\/)test_[^/]*\.py$|\.test\.[cm]?[jt]s$/.test(rel))).toEqual([]);
  });

  it('hors du socle, aucun littéral', () => {
    const fautes = corpusDesSilhouettes().flatMap(({ rel, text }) => litterauxDe(text, NOMS_DES_SILHOUETTES).map((l) => `${rel}:${l.ligne} ${l.texte}`));
    expect(fautes, 'identifiant de silhouette écrit hors de `hotes/godot/asset/silhouettes.ts` : l’importer, ou le lire par `noms_silhouettes.py`').toEqual([]);
  });
});
