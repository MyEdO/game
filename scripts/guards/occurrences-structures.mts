import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanDuCorpus } from '../docs/lib/structures-scan.mjs';
import { slotsDuParse, champsSansSlot } from '../docs/lib/slots-registre.mjs';
import { actualiserOccurrences, siteDeForme, siteDeSlot } from './lib/occurrencesStock.mjs';

const args = process.argv.slice(2);
const position = args.indexOf('--racine');
const inconnus = args.filter((a, i) => !['--check', '--write', '--racine'].includes(a) && !(position >= 0 && i === position + 1));
if (inconnus.length || (position >= 0 && !args[position + 1]) || (args.includes('--check') && args.includes('--write')))
  throw new Error('Usage : occurrences-structures.mts [--check | --write] [--racine chemin]');
const root = position >= 0 ? resolve(args[position + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const formesRel = 'scripts/guards/lib/structuresStock.mjs';
const slotsRel = 'scripts/guards/lib/slotsStock.mjs';
const { STRUCTURES_FORMES } = await import(pathToFileURL(resolve(root, formesRel)).href);
const { SLOTS_SANS_DECLARATION } = await import(pathToFileURL(resolve(root, slotsRel)).href);
const { defs, scan } = scanDuCorpus(root);
const resultats = actualiserOccurrences([
  { rel: formesRel, texte: readFileSync(resolve(root, formesRel), 'utf8'), nom: 'STRUCTURES_FORMES',
    observe: scan.formes.filter((f) => f.statut === 'historique' || f.statut === 'divergente'), stock: STRUCTURES_FORMES, site: siteDeForme },
  { rel: slotsRel, texte: readFileSync(resolve(root, slotsRel), 'utf8'), nom: 'SLOTS_SANS_DECLARATION',
    observe: champsSansSlot(scan, slotsDuParse(scan, defs)), stock: SLOTS_SANS_DECLARATION, site: siteDeSlot },
]);
for (const r of resultats) {
  console.log(`${r.rel} : ${r.changements.length} occurrence(s) à actualiser${r.changements.length ? '\n' + r.changements.join('\n') : ''}`);
}
if (args.includes('--write')) {
  for (const r of resultats) if (r.changements.length) writeFileSync(resolve(root, r.rel), r.texte);
} else if (resultats.some((r) => r.changements.length)) {
  console.error('Exécuter node scripts/lancer-local.mjs tsx -- tsx scripts/guards/occurrences-structures.mts --write pour déclarer les occurrences mesurées.');
  process.exitCode = 1;
}
