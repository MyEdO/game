import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';

/**
 * Garde STRUCTURELLE : tout `op:'wounds'` d'une DONNÉE déclare sa mitigation.
 *
 * `GameOp` `wounds` ignore par DÉFAUT le Bonus d'Endurance ET les Points d'Armure
 * (`src/engine/ops.ts`, type `wounds`) — l'inverse du défaut RAW, où les Dégâts sont réduits par
 * les deux (LDB 13). Un `wounds` qui n'écrit ni `ignoreTB` ni `ignoreAP` hérite donc SILENCIEUSEMENT
 * de l'exception, jamais de la règle : le silence est indistinguable de l'oubli. On exige les DEUX
 * champs écrits, sur CHAQUE `wounds` de CHAQUE `src/data/*.json` (aucune liste d'exception) — la
 * valeur reste libre, c'est la DÉCLARATION qui est obligatoire, et elle se relit contre la `desc`
 * verbatim.
 *
 * Le balayage est FILE-BASED et exhaustif (même patron que `book-source-integrity.test.ts`) : un
 * dataset créé demain entre dans la garde sans qu'on l'y inscrive. Mesurer un seul dataset ne
 * mesurait que sa couverture — la version `spells.json` seule laissait 16 `wounds` muets dans
 * trappings / miscast / etats / domains / traits / grapple / tables / problemes-vehicule.
 *
 * PÉRIMÈTRE MESURÉ — les `wounds` écrits en DONNÉE (`src/data/*.json`), tous fichiers, toute
 * profondeur. HORS MESURE — les `wounds` construits en TypeScript, qui héritent du même défaut sans
 * qu'aucune assertion ne les touche : `src/engine/structureCritical.ts`, `src/noyau/combatEffects.ts`
 * (deux sites), `src/noyau/massBattleFlow.ts`, `src/noyau/combatFlow.ts` et `src/noyau/combatSlice.ts`
 * (ces deux-là n'écrivent que `ignoreTB`). Les 70 ops de la colonne « Blessures » d'Aux Armes
 * (AA 07 l.40) sont SOUS cette garde : elles vivent en donnée, dans `criticals.json`.
 */

const DIR = __dirname;

type AnyRec = Record<string, unknown>;

/** Tout objet `{op:'wounds'}` atteignable depuis `node`, à profondeur quelconque (Flow, ops
 *  imbriquées `delayed`/`grant`, branches `success`/`fail`…), avec son CHEMIN dans le document. */
function collectWounds(node: unknown, path: string, acc: { path: string; op: AnyRec }[] = []): { path: string; op: AnyRec }[] {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectWounds(n, `${path}[${i}]`, acc));
    return acc;
  }
  if (node && typeof node === 'object') {
    const rec = node as AnyRec;
    if (rec.op === 'wounds') acc.push({ path, op: rec });
    for (const [k, v] of Object.entries(rec)) collectWounds(v, `${path}.${k}`, acc);
  }
  return acc;
}

/** `[fichier, wounds trouvés]` — calculé UNE fois, sert le verdict ET la mesure de couverture. */
const SCAN = listerDossier(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({ file, wounds: collectWounds(JSON.parse(readFileSync(join(DIR, file), 'utf8')) as unknown, '') }))
  .filter((s) => s.wounds.length > 0);

describe('mitigation des Dégâts : tout `wounds` de donnée la DÉCLARE', () => {
  for (const { file, wounds } of SCAN) {
    it(`${file} : aucun \`op:"wounds"\` sans \`ignoreTB\` ET \`ignoreAP\` explicites`, () => {
      const undeclared = wounds
        .filter(({ op }) => !('ignoreTB' in op) || !('ignoreAP' in op))
        .map(({ path, op }) => `${path} : ${(['ignoreTB', 'ignoreAP'] as const).filter((k) => !(k in op)).join('+')} absent(s)`);
      expect(undeclared).toEqual([]);
    });
  }

  it('couvre bien la classe (≥ 8 datasets, ≥ 100 `wounds` mesurés)', () => {
    expect(SCAN.length).toBeGreaterThanOrEqual(8);
    expect(SCAN.reduce((acc, s) => acc + s.wounds.length, 0)).toBeGreaterThanOrEqual(100);
  });
});
