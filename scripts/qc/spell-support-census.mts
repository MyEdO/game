/**
 * Recensement de la prise en charge MÉCANIQUE des sorts — mesure rejouable.
 *
 * Utilise le classifieur de l'application (`spellSupportOf`), jamais une heuristique locale :
 * un sort est `mecanique` / `partiel` / `narratif` exactement comme la fiche de personnage l'affiche.
 * Sortie : ventilation par livre, par famille et par domaine, puis la liste des `narratif`.
 *
 * `npx tsx scripts/qc/spell-support-census.mts [--list]`
 */
import { spells } from '../../src/data/index';
import { spellSupportOf as supportOf } from '../../src/engine/spellspec';
import { sortsNarratifs } from '../data/lib/sortsNarratifs';

type Support = ReturnType<typeof supportOf>;

const tally = <K extends string>(keyOf: (s: (typeof spells)[number]) => K) => {
  const m = new Map<K, Record<Support, number>>();
  for (const s of spells) {
    const k = keyOf(s);
    const e = m.get(k) ?? { mecanique: 0, partiel: 0, narratif: 0 };
    e[supportOf(s)]++;
    m.set(k, e);
  }
  return [...m.entries()].sort((a, b) => sum(b[1]) - sum(a[1]));
};
const sum = (e: Record<Support, number>) => e.mecanique + e.partiel + e.narratif;
const line = (k: string, e: Record<Support, number>) => {
  const n = sum(e);
  const pct = Math.round((100 * (e.mecanique + e.partiel)) / n);
  return `  ${k.padEnd(36)} total:${String(n).padStart(4)}  mecanique:${String(e.mecanique).padStart(4)}  partiel:${String(e.partiel).padStart(3)}  narratif:${String(e.narratif).padStart(4)}  (${pct}% pris en charge)`;
};

const global: Record<Support, number> = { mecanique: 0, partiel: 0, narratif: 0 };
for (const s of spells) global[supportOf(s)]++;
console.log(`TOTAL ${spells.length} sorts`);
console.log(line('(tous)', global));

console.log('\n--- par livre ---');
for (const [k, e] of tally((s) => s.source?.book ?? '(sans source)')) console.log(line(k, e));

console.log('\n--- par famille ---');
for (const [k, e] of tally((s) => s.family ?? '(sans famille)')) console.log(line(k, e));

console.log('\n--- par domaine ---');
for (const [k, e] of tally((s) => s.domainId ?? '(hors domaine)')) console.log(line(k, e));

const narr = sortsNarratifs();
console.log(`\n--- NARRATIFS : ${narr.length} (aucun effet appliqué par le moteur) ---`);
if (process.argv.includes('--list')) {
  for (const s of narr) {
    console.log(`  ${s.id.padEnd(38)} | ${s.family ?? '-'} | ${s.domainId ?? '-'} | ${s.source?.book} p.${s.source?.page} | curated:${s.curated === true}`);
  }
}
