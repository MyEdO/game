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

/** Chaque `compare` du parcours (`POPULATION`) et les `"kind": "compare"` du TEXTE des mêmes fichiers, mesurés
 *  sans le parcours (`DANS_LE_TEXTE`). `src/scenes` n'en porte aucun aujourd'hui : la première Condition
 *  authorée EN SCÈNE entre par ici. */
const { POPULATION, DANS_LE_TEXTE } = (() => {
  const trouves: { chemin: string; noeud: unknown }[] = [];
  let texte = 0;
  for (const racine of ['src/data', 'src/scenes']) {
    for (const f of fichiersJson(racine)) {
      const brut = readFileSync(f, 'utf8');
      texte += brut.match(/"kind":\s*"compare"/g)?.length ?? 0;
      comparesDe(JSON.parse(brut), f, trouves);
    }
  }
  return { POPULATION: trouves, DANS_LE_TEXTE: texte };
})();

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
