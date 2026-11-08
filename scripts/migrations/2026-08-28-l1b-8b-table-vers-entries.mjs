/**
 * Migration #1467 L1b V-FLIP-TABLE — UNIFICATION DE LA CHARGE : les 6 documents uniques qui
 * nommaient leur charge utile `table` la nomment `entries`, comme les 8 documents frères de la
 * même vague (`artillery-misfire`, `incidents-monture`, `montures`, `problemes-vehicule`,
 * `structure-criticals`) et comme la famille `record` de la fabrique.
 *
 * PÉRIMÈTRE : `table` SCALAIRE de charge, jamais un objet `tables{…}` de SOUS-TABLES nommées
 * (`rencontres-edoc`, `river-criticals`, `ship-criticals` gardent leurs noms de Localisation /
 * catégorie : ce sont des champs distincts, pas une charge unique).
 *
 * ENTRÉES : les 6 `src/data/*.json` nommés dans `FICHIERS` (les seules données lues et écrites).
 *
 * IDEMPOTENT : un document portant déjà `entries` et plus de `table` est reconnu migré (exit 0).
 * FAIL-FAST : `table` ET `entries` présents ensemble, `table` non-tableau, ni l'un ni l'autre →
 * rien n'est écrit, exit 1.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` vérifié AVANT toute écriture ; la clé
 * renommée garde EXACTEMENT sa position dans l'ordre des clés.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const FICHIERS = [
  'driving-mishap.json',
  'drunkenness.json',
  'naval-progression.json',
  'obsessions.json',
  'surincantation.json',
  'vents-tourbillonnants.json',
];

const echecs = [];
const rapport = [];

for (const fichier of FICHIERS) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const data = JSON.parse(brut);

  if (JSON.stringify(data, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }
  if (!estObjet(data)) {
    echecs.push(`${fichier} : racine de forme inattendue (objet unique attendu)`);
    continue;
  }
  const aTable = Object.prototype.hasOwnProperty.call(data, 'table');
  const aEntries = Object.prototype.hasOwnProperty.call(data, 'entries');
  if (aTable && aEntries) {
    echecs.push(`${fichier} : \`table\` ET \`entries\` présents ensemble — arbitrage requis`);
    continue;
  }
  if (!aTable) {
    if (!aEntries) {
      echecs.push(`${fichier} : ni \`table\` ni \`entries\` — forme inattendue`);
      continue;
    }
    rapport.push(`  no-op ${fichier} — déjà \`entries\` (${data.entries.length} rangée(s))`);
    continue;
  }
  if (!Array.isArray(data.table)) {
    echecs.push(`${fichier} : \`table\` n'est pas un tableau (${typeof data.table})`);
    continue;
  }

  const sortie = Object.fromEntries(Object.entries(data).map(([k, v]) => [k === 'table' ? 'entries' : k, v]));
  const out = JSON.stringify(sortie, null, 2);
  fs.writeFileSync(cible, out, 'utf8');
  rapport.push(`  migré ${fichier} — table → entries (${data.table.length} rangée(s))`);

  // PREUVE post-écriture : même nombre de clés, même POSITION, charge identique à l'octet près.
  const apres = JSON.parse(out);
  const avantCles = Object.keys(data).map((k) => (k === 'table' ? 'entries' : k));
  if (Object.keys(apres).join(',') !== avantCles.join(',')) echecs.push(`${fichier} : POST — l'ordre des clés a bougé`);
  if (JSON.stringify(apres.entries) !== JSON.stringify(data.table)) echecs.push(`${fichier} : POST — la charge a été ALTÉRÉE`);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`charge unifiée \`table\` → \`entries\` : ${FICHIERS.length} document(s)`);
for (const l of rapport) console.log(l);
