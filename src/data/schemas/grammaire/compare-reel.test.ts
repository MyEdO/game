/**
 * `kind: 'compare'` — la grammaire parse la POPULATION RÉELLE des deux racines (#1466 T3-a).
 *
 * `compareValueSchema` (`mecanique.ts`) est une union : un membre trop étroit rend rouge une
 * Condition authorée, un membre trop large (un `z.any()` de confort) rend le schéma inerte sans
 * qu'aucun test de forme ne le voie. On mesure donc la population entière : chaque `compare`
 * réellement authoré sous `src/data` et `src/scenes` est reparsé par `conditionSchema` (la branche
 * `compare` de l'union `Condition` — la porte publique par laquelle cette valeur est atteinte). Le
 * parcours est confronté à une mesure INDÉPENDANTE, le texte des fichiers : aucun compte figé (#2995).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { listerArbre } from '../../../../scripts/guards/lib/lister.mjs';
import { conditionSchema } from './mecanique';

const fichiersJson = (racine: string): string[] =>
  listerArbre(racine, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => `${racine}/${rel}`);

/** Toutes les valeurs `{ kind: 'compare', … }` d'un document, à toute profondeur, avec leur chemin. */
const comparesDe = (valeur: unknown, chemin: string, dans: { chemin: string; noeud: unknown }[]): void => {
  if (Array.isArray(valeur)) {
    valeur.forEach((v, i) => comparesDe(v, `${chemin}[${i}]`, dans));
    return;
  }
  if (!valeur || typeof valeur !== 'object') return;
  const obj = valeur as Record<string, unknown>;
  if (obj.kind === 'compare') dans.push({ chemin, noeud: obj });
  for (const [k, v] of Object.entries(obj)) comparesDe(v, `${chemin}.${k}`, dans);
};

/** Les fichiers des deux racines : `src/scenes` n'en porte aucun aujourd'hui, la première Condition authorée EN
 *  SCÈNE entre par ici. */
const FICHIERS = ['src/data', 'src/scenes'].flatMap(fichiersJson);

const POPULATION = (() => {
  const trouves: { chemin: string; noeud: unknown }[] = [];
  for (const f of FICHIERS) comparesDe(JSON.parse(readFileSync(f, 'utf8')), f, trouves);
  return trouves;
})();

/** Les `"kind": "compare"` du TEXTE des mêmes fichiers, mesurés sans le parcours. */
const DANS_LE_TEXTE = FICHIERS.reduce((n, f) => n + (readFileSync(f, 'utf8').match(/"kind":\s*"compare"/g)?.length ?? 0), 0);

describe('grammaire — les `compare` RÉELLEMENT authorés parsent contre la grammaire', () => {
  it('le parcours trouve chaque `compare` que porte le texte des deux racines (le scan mord)', () => {
    expect(DANS_LE_TEXTE).toBeGreaterThan(0);
    expect(POPULATION.length).toBe(DANS_LE_TEXTE);
  });

  it('chacun parse contre `conditionSchema` — aucun rouge, chemin nommé sinon', () => {
    const rouges = POPULATION.flatMap(({ chemin, noeud }) => {
      const res = conditionSchema.safeParse(noeud);
      return res.success ? [] : [`${chemin} :: ${res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ')}`];
    });
    expect(rouges).toEqual([]);
  });
});
