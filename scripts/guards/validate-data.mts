/**
 * Valide un ou plusieurs documents authorés des DEUX racines (catalogues `src/data/*.json` ;
 * projets de campagne `src/scenes/<dossier>/<nom>-projet.json`) contre leur schéma zod (`src/data/schemas/`,
 * contrat de donnée Lot 1). STRICTE sur SON périmètre, comme `validateDataset` : un `.json` des deux
 * racines SANS schéma au registre est une ERREUR NOMMÉE (les 124 documents authorés sont tous
 * registrés, `PENDING` est vide). Un chemin HORS des deux racines n'est pas de sa juridiction : il
 * est compté à part, pas jugé.
 * Destiné au hook pre-commit (branché par l'orchestrateur) : reçoit des chemins en arguments.
 *
 *   npx tsx scripts/guards/validate-data.mts src/data/characteristics.json [...]
 *
 * Exit 0 si tous les documents des deux racines valident ; exit 1 + rapport lisible sinon.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFS_DE_DOCUMENT, validateDataset } from '../../src/data/schemas/validate';

/** Clé de registre d'un chemin : `<root>/<file>` — basename sous `src/data`, chemin relatif sous
 *  `src/scenes`. Le chemin reçu est normalisé POSIX (le hook passe des chemins git). */
const DEF_PAR_DOCUMENT = new Map(DEFS_DE_DOCUMENT.map((d) => [`${d.root}/${d.file}`, d]));
const cleDe = (chemin: string): string => chemin.split('\\').join('/').replace(/^\.\//, '');

/** Le périmètre JUGÉ : catalogues à plat de `src/data`, documents (même en sous-dossier) de `src/scenes`. */
const dansUneRacine = (cle: string): boolean => /^src\/data\/[^/]+\.json$/.test(cle) || /^src\/scenes\/.+\.json$/.test(cle);

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: npx tsx scripts/guards/validate-data.mts <chemin.json> [...]');
  process.exit(1);
}

let bad = 0;
let checked = 0;
let horsPerimetre = 0;
for (const p of paths) {
  const file = cleDe(p);
  const def = DEF_PAR_DOCUMENT.get(file);
  if (!def) {
    if (!dansUneRacine(file)) {
      horsPerimetre++;
      continue;
    }
    bad++;
    checked++;
    console.error(
      `KO ${file} — document authoré SANS schéma au registre : créer son def ` +
      `(\`src/data/schemas/defs/<nom>.ts\` pour \`src/data\`, \`defs-scenes/<nom>.ts\` pour \`src/scenes\`) ` +
      `dans le MÊME commit, puis \`npm run gen\`.`,
    );
    continue;
  }
  checked++;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolve(p), 'utf8'));
  } catch (err) {
    bad++;
    console.error(`KO ${file} — JSON illisible : ${(err as Error).message}`);
    continue;
  }
  const rapport = validateDataset(def.file, raw);
  if (rapport) {
    bad++;
    console.error(`KO ${rapport}`);
  }
}

if (bad > 0) {
  console.error(`\n${bad}/${checked} document(s) authoré(s) en faute.`);
  process.exit(1);
}
console.log(`OK: ${checked} document(s) authoré(s) validé(s) (${horsPerimetre} hors des deux racines).`);
