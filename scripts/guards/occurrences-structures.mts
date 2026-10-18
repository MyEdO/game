import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COLLECTIONS_A_COMPTE, COMMANDE_D_ECRITURE, actualiserOccurrences } from './lib/occurrencesStock.mjs';
import { corpusDesComptes } from './lib/corpusDesComptes.mts';

const args = process.argv.slice(2);
const position = args.indexOf('--racine');
const inconnus = args.filter((a, i) => !['--check', '--write', '--racine'].includes(a) && !(position >= 0 && i === position + 1));
if (inconnus.length || (position >= 0 && !args[position + 1]) || (args.includes('--check') && args.includes('--write')))
  throw new Error('Usage : occurrences-structures.mts [--check | --write] [--racine chemin]');
const root = position >= 0 ? resolve(args[position + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const corpus = corpusDesComptes(root);
const collections = await Promise.all(COLLECTIONS_A_COMPTE.map(async (c) => ({
  ...c,
  rel: c.porteur,
  texte: readFileSync(resolve(root, c.porteur), 'utf8'),
  observe: c.mesure(corpus),
  stock: (await import(pathToFileURL(resolve(root, c.porteur)).href))[c.nom],
})));
const resultat = actualiserOccurrences(collections);
if ('refus' in resultat) {
  console.error(resultat.refus);
  process.exitCode = 1;
} else {
  for (const r of resultat.ecritures) {
    console.log(`${r.rel} : ${r.changements.length} baisse(s) à écrire${r.changements.length ? '\n' + r.changements.join('\n') : ''}`);
  }
  if (args.includes('--write')) {
    for (const r of resultat.ecritures) if (r.changements.length) writeFileSync(resolve(root, r.rel), r.texte);
  } else if (resultat.ecritures.some((r) => r.changements.length)) {
    console.error(`Exécuter ${COMMANDE_D_ECRITURE} pour écrire les BAISSES mesurées.`);
    process.exitCode = 1;
  }
}
