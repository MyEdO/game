/**
 * Migration #1667 train (a) — chaque document-table de `criticals.json` porte son dé de tirage sous
 * `die` (`options.deDeTirage`, `src/data/schemas/defs/criticals.ts`), posé juste avant `entries`.
 *
 * Dé imprimé, le même pour les 8 tableaux :
 *   - `jeu: 'ldb'` (4 tableaux) : « lancez 1d100 et référez-vous au tableau approprié », LDB 18 l.53 ;
 *   - `jeu: 'aa'` (4 tableaux) : « lancez encore 1d100 et reportez-vous à la ligne concernée dans le
 *     tableau des Blessures Critiques », AA 07 l.32.
 *
 * Entrées : src/data/criticals.json.
 *
 * Le `die` n'est écrit que là où il manque ; un `die` déjà présent est une donnée, laissée telle
 * quelle. FORME ASSERTÉE SUR LE RÉSULTAT : chaque document porte `entries` et `die`. Un document au
 * `jeu` sans dé connu, ou un fichier non canonique, est un ARRÊT nominatif (exit 1), AUCUNE écriture.
 * Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'criticals.json';

/** Le dé IMPRIMÉ par jeu (réfs en en-tête). */
const DE_PAR_JEU = { ldb: 'd100', aa: 'd100' };

/** Pose `die` juste avant `entries`, au même rang que les autres clés. */
function poserLeDe(doc, die) {
  const copie = Object.entries(doc);
  for (const k of Object.keys(doc)) delete doc[k];
  for (const [k, v] of copie) {
    if (k === 'entries') doc.die = die;
    doc[k] = v;
  }
}

const chemin = join(ROOT, 'src/data', FICHIER);
const brut = readFileSync(chemin, 'utf8');
const docs = JSON.parse(brut);
const arrets = [];
if (brut !== serializeDataset(docs)) arrets.push(`${FICHIER} : forme non canonique`);
else {
  for (const [i, d] of docs.entries()) {
    const ou = `${FICHIER} [${i}] ${d.id}`;
    if ('die' in d) continue;
    const die = DE_PAR_JEU[d.jeu];
    if (!die) arrets.push(`${ou} : jeu « ${d.jeu} » sans dé imprimé connu`);
    else poserLeDe(d, die);
  }
  for (const [i, d] of docs.entries()) {
    const ou = `${FICHIER} [${i}] ${d.id}`;
    if (!Array.isArray(d.entries)) arrets.push(`${ou} : aucune rangée sous \`entries\``);
    if (typeof d.die !== 'string') arrets.push(`${ou} : aucun dé de tirage \`die\``);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(docs);
if (out !== brut) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1667 (a) : ${out !== brut ? `${FICHIER} réécrit` : 'aucune écriture'}.`);
