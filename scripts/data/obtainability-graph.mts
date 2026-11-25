/**
 * CLI de la lentille « obtenabilité réelle » (#321 lentille 1) — mécanique dans
 * `scripts/data/lib/obtainabilityGraph.ts` (partagée avec la garde `src/data/obtainability-guard.test.ts`).
 * Sortie : JSON `scripts/data/.out/obtainability-report.json` + résumé console. Lancé via `tsx`, les paquets éprouvés
 * en arguments (chemins relatifs au dépôt), le contenu du commun sans argument (`paquetsDuCommun`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { talents, spells } from '../../src/data/index';
import { computeObtainability } from './lib/obtainabilityGraph';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const paquets = process.argv.slice(2);
const { talentNever, casterInfo, spellNever } = computeObtainability(ROOT, paquets.length ? paquets : undefined);

const report = {
  talents: {
    total: talents.length,
    never: talentNever.map((t) => ({ id: t.id, label: t.label, source: t.source })),
  },
  spells: {
    total: spells.length,
    never: spellNever.map((v) => ({ id: v.id, label: v.label })),
  },
  casterTalents: Object.fromEntries(
    [...casterInfo].map(([id, c]) => [id, { obtainable: c.obtainable, specsCount: c.specs.size, anyUnspecialized: c.anyUnspecialized }]),
  ),
};

console.log(`Talents : ${talents.length} total, ${talentNever.length} JAMAIS-obtenables (aucune source).`);
for (const t of talentNever) console.log(`  - ${t.id} (${t.label}) — source ${t.source?.book ?? '?'} p.${t.source?.page ?? '?'}`);
console.log(`Sorts : ${spells.length} total, ${spellNever.length} JAMAIS-obtenables (aucun Talent de lanceur/Domaine/Culte/scène ne les couvre).`);
for (const v of spellNever) console.log(`  - ${v.id} (${v.label})`);
console.log('\nTalents de lanceur (les 5 racines) :');
for (const [id, c] of casterInfo) console.log(`  ${id} → obtenable=${c.obtainable} specs=${c.specs.size} nonSpécialisé=${c.anyUnspecialized}`);

const outPath = join(ROOT, 'scripts/data/.out/obtainability-report.json');
mkdirSync(join(ROOT, 'scripts/data/.out'), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));
