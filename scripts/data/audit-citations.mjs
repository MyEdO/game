#!/usr/bin/env node
// Rapport de couverture de citation par ENTRÉE (#309, phase 1) — pour CHAQUE dataset de
// `src/data/*.json`, compte les entrées RÉELLES (premier niveau — jamais les ids imbriqués,
// cf. `citationCoverage.mjs`) et leur citation. Sortie console (tableau trié
// par % croissant) + `--json` pour un export exploitable (phase 2 de curation).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDataset, exemptionDeDataset } from '../guards/lib/citationCoverage.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = join(ROOT, 'src', 'data');

const jsonOut = process.argv.includes('--json');
const outArgIdx = process.argv.indexOf('--out');
const outPath = outArgIdx >= 0 ? process.argv[outArgIdx + 1] : null;

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort();

const rows = files.map((f) => {
  const data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
  const { total, cited, missing, shape } = auditDataset(data);
  const missingCount = total - cited;
  const pct = total === 0 ? 100 : Math.round((cited / total) * 1000) / 10;
  const exempt = exemptionDeDataset(f) ?? null;
  return { file: f, shape, total, cited, missing: missingCount, pct, exempt, missingIds: missing };
});

if (jsonOut || outPath) {
  const json = JSON.stringify(rows, null, 2);
  if (outPath) writeFileSync(join(ROOT, outPath), json, 'utf8');
  if (jsonOut) process.stdout.write(json + '\n');
}

if (!jsonOut) {
  const sorted = [...rows].sort((a, b) => a.pct - b.pct || a.file.localeCompare(b.file));
  const w = (s, n) => String(s).padEnd(n);
  console.log(w('dataset', 30) + w('forme', 14) + w('entrées', 9) + w('citées', 8) + w('manque', 8) + w('%', 7) + 'exemption');
  console.log('-'.repeat(110));
  let totalEntries = 0, totalCited = 0, totalMissingNonExempt = 0;
  for (const r of sorted) {
    console.log(
      w(r.file, 30) + w(r.shape, 14) + w(r.total, 9) + w(r.cited, 8) + w(r.missing, 8) + w(r.pct + '%', 7) +
      (r.exempt ? `EXEMPT — ${r.exempt}` : ''),
    );
    totalEntries += r.total;
    totalCited += r.cited;
    if (!r.exempt) totalMissingNonExempt += r.missing;
  }
  console.log('-'.repeat(110));
  console.log(`TOTAL : ${totalCited}/${totalEntries} entrées citées (${Math.round((totalCited / totalEntries) * 1000) / 10}%) — ${totalMissingNonExempt} manquantes sur datasets NON exemptés.`);

  const zero = sorted.filter((r) => !r.exempt && r.cited === 0 && r.total > 0);
  if (zero.length) {
    console.log('\nFamilles à ZÉRO citation (non exemptées) :');
    for (const r of zero) console.log(`  ${r.file} — ${r.total} entrées`);
  }
}
