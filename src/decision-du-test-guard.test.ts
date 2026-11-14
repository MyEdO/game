import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listProdFiles, scanFieldReads, type FieldReadHit } from '../scripts/guards/lib/fieldConsumers.mjs';
import { virtualProgram, VIRTUAL_ROOT } from '../scripts/guards/lib/tsProgram.mjs';
import { CHAMPS_DE_DECISION } from './engine/flowCore';
import { detenteur } from './lib/detenteur.testkit';

/**
 * LA DÉCISION D'UN TEST A UNE SOURCE (#1874) — `resoudreFlowTest` (`src/engine/decisionDuTest.ts`) est le
 * seul lecteur de `difficulty`, `gate`, `difficultyBy` et `easierIf` d'un `FlowTest` qui PEUT porter une
 * décision, Test étendu compris (`TestEtendu`, `defs-scenes/effets.ts`, qui les tient de `FlowTest`). Le champ
 * se lit au VÉRIFICATEUR DE TYPES (`scanFieldReads`) : identité par symbole de la propriété, porteur typé au
 * site (`champsDuPorteur`).
 */
const GARDE = {
  question:
    'Quel site de `src/` lit la Difficulté, le `gate`, les `difficultyBy` ou l’`easierIf` d’un `FlowTest` qui peut '
    + 'porter une décision, hors de `resoudreFlowTest` ? Une lecture à cru ignore la décision que la donnée déclare.',
  primitive: '`scanFieldReads` (`scripts/guards/lib/fieldConsumers.mjs`), Program du dépôt tenu par `detenteur`.',
  perimetre: '`src/` de production (`listProdFiles`, tests exclus)',
  exemption:
    'Au SITE : la ligne de la lecture, ou celle qui la précède, porte `// lecture déclarée : <raison>` (l’éditeur, '
    + 'la fiche Codex et le défaut d’argument lisent la valeur AUTHORÉE). Chaque marqueur doit couvrir une lecture.',
  horsChamp:
    'Un porteur qui ne porte AUCUN champ de décision (`JetFixe`, `NoeudDecideAuPorteur`, `Pick<FlowTest, …>`) : '
    + 'sa Difficulté est celle qu’il déclare.',
  angleMort: [
    'Condition (1) de `fieldConsumers.mjs` : un paramètre annoté d’un littéral de même forme que `FlowTest` ne crédite rien.',
    'Une clé calculée (`ft[k]`) et un spread (`{ ...ft }`) ne lisent aucun champ nommé.',
  ],
  ticket: '#1874',
};

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RESOLUTION = 'src/engine/decisionDuTest.ts';
const FLOW_CORE = 'src/engine/flowCore.ts';
const CIBLE = { type: 'FlowTest', home: FLOW_CORE };
const CHAMPS = ['difficulty', ...CHAMPS_DE_DECISION];
const DECISION = new Set<string>(CHAMPS_DE_DECISION);
const MARQUEUR = /\/\/ lecture déclarée : \S.{10,}/;

/** Les marqueurs d'un texte, par numéro de ligne (1-based). */
function marqueursDe(texte: string): number[] {
  return texte.split('\n').flatMap((l, i) => (MARQUEUR.test(l) ? [i + 1] : []));
}

/** Verdict : lectures fautives, et marqueurs (`fichier relatif → texte` du corpus) qui ne couvrent rien. */
function juger(hits: readonly FieldReadHit[], textes: ReadonlyMap<string, string>, resolution: string) {
  const decidables = hits.filter((h) => h.champsDuPorteur.some((c) => DECISION.has(c)));
  const marques = new Map<string, number[]>([...textes].map(([rel, texte]) => [rel, marqueursDe(texte)]));
  const couverts = new Set<string>();
  const fautes: string[] = [];
  for (const h of decidables) {
    if (h.file === resolution || h.auDeclarant) continue;
    const m = (marques.get(h.file) ?? []).find((n) => n === h.line || n === h.line - 1);
    if (m) { couverts.add(`${h.file}:${m}`); continue; }
    fautes.push(`${h.file}:${h.line} (${h.symbole}) lit \`FlowTest.${h.field}\` — passe par \`resoudreFlowTest\` (${resolution})`);
  }
  const orphelins = [...marques].flatMap(([rel, lignes]) => lignes.filter((n) => !couverts.has(`${rel}:${n}`)).map((n) => `${rel}:${n}`));
  return { fautes, orphelins };
}

const FICHIERS = listProdFiles(join(ROOT, 'src'));
const TEXTES = new Map(FICHIERS.map((abs) => [relative(ROOT, abs).split(sep).join('/'), readFileSync(abs, 'utf8')]));

/** Lectures de la cible sur `src/` : Program du dépôt, payé une fois. */
const lectures = detenteur(() => scanFieldReads(CIBLE, CHAMPS, FICHIERS, ROOT));

describe('decision-du-test-guard', () => {
  it(`${GARDE.perimetre} — aucune lecture de décision d’un \`FlowTest\` hors de \`${RESOLUTION}\``, () => {
    const { fautes, orphelins } = juger(lectures(), TEXTES, RESOLUTION);
    expect(fautes).toEqual([]);
    expect(orphelins, 'marqueur qui ne couvre aucune lecture').toEqual([]);
  }, 150_000);

  it('contrat positif : la résolution lit les quatre champs', () => {
    const lus = new Set(lectures().filter((h) => h.file === RESOLUTION).map((h) => h.field));
    expect([...lus].sort()).toEqual([...CHAMPS].sort());
  }, 150_000);

  /** Contre-épreuve sur fixture : la garde MORD une lecture à cru, celle d'un porteur qui tient sa décision de
   *  `FlowTest` (Test étendu), laisse passer un porteur sans décision, honore un marqueur et refuse un marqueur
   *  orphelin. */
  it('contre-épreuve : morsure, Test étendu, porteur sans décision, marqueur, marqueur orphelin', () => {
    const fixtures: Record<string, string> = {
      'src/engine/flowCore.ts': `export interface FlowTest { difficulty?: string; gate?: boolean; difficultyBy?: string[]; easierIf?: { steps?: number } }
export type JetFixe = Omit<FlowTest, 'gate' | 'difficultyBy' | 'easierIf'>;
`,
      'src/engine/decisionDuTest.ts': `import type { FlowTest } from './flowCore';
export const resoudre = (ft: FlowTest) => ft.gate !== false && ft.difficulty;
`,
      'src/ouvreur.ts': `import type { FlowTest, JetFixe } from './engine/flowCore';
export const aCru = (ft: FlowTest) => ft.difficulty;
export const fixe = (j: JetFixe) => j.difficulty;
// lecture déclarée : l’éditeur montre la valeur authorée
export const editeur = (ft: FlowTest) => ft.easierIf;
// lecture déclarée : marqueur qui ne couvre aucune lecture
export const rien = 1;
type Etendu = { type: 'extendedTest'; drCible: number } & Pick<FlowTest, 'difficulty' | 'gate' | 'difficultyBy' | 'easierIf'>;
export const etendu = (e: Etendu) => e.difficulty;
`,
    };
    const programme = virtualProgram(fixtures);
    try {
      const hits = scanFieldReads(CIBLE, CHAMPS, Object.keys(fixtures).map((rel) => join(VIRTUAL_ROOT, rel)), VIRTUAL_ROOT, new Map(), programme);
      const { fautes, orphelins } = juger(hits, new Map(Object.entries(fixtures)), RESOLUTION);
      expect(fautes.map((f) => f.slice(0, f.indexOf(' ')))).toEqual(['src/ouvreur.ts:2', 'src/ouvreur.ts:9']);
      expect(orphelins).toEqual(['src/ouvreur.ts:6']);
    } finally { programme.dispose(); }
  });
});
