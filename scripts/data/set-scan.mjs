// CLI de la lentille « set() bruts des flows » (#321 lentille 3) — mécanique dans
// `scripts/guards/lib/setScan.mjs` (partagée avec la garde `src/noyau/set-scan-guard.test.ts`).
// MESURE seule (aucune correction) : compte par fichier + classification (reset ad hoc de champ
// `pending*`/`STATE_FIELDS` vs écriture métier normale du flow).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSetScan } from '../guards/lib/setScan.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const { totalCalls, totalAdHocResets, files } = runSetScan(ROOT);

console.log(`Fichiers avec au moins un set() (src/state/*.ts, hors store.ts/stateFields.ts) : ${files.length}`);
console.log(`Total set() littéraux détectés : ${totalCalls}`);
console.log(`Total set() touchant un champ STATE_FIELDS (pending*) HORS resetFields(...) : ${totalAdHocResets}`);
console.log('\nPar fichier (setCalls / adHocPendingResets) :');
for (const r of files) console.log(`  ${r.file} : ${r.setCalls} / ${r.adHocPendingResets}`);

const outPath = join(ROOT, 'scripts/data/.out/set-scan-report.json');
mkdirSync(join(ROOT, 'scripts/data/.out'), { recursive: true });
writeFileSync(outPath, JSON.stringify({ totalCalls, totalAdHocResets, files }, null, 2));
