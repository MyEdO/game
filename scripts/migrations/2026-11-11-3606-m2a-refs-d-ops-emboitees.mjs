/**
 * Migration #3606 M2a (L1c #1468) — les références des ops typées dans `OP_DEFS` sont emboîtées : un id nu
 * devient `{ id }`, à la même clé.
 *
 *   op                    clé         catalogue
 *   `rollMutation`        `table`     `mutationTables.json`
 *   `light`               `tone`      `lightTones.json`
 *   `grantNaturalWeapon`  `subType`   `weaponGroups.json`
 *
 * Entrées : chaque `src/data/*.json` suivi par git ; toute op de ces trois sortes, où qu'elle soit dans le document.
 *
 * Une entrée absente passe sans faute : une op déjà `{ id }`, ou sans la clé, n'a aucun geste. Une valeur ni chaîne ni
 * `{ id }` seul, un id absent de son catalogue, ou un document non canonique sont un ARRÊT nominatif (exit 1), AUCUNE
 * écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const idsDe = (rel) => new Set(JSON.parse(readFileSync(join(ROOT, rel), 'utf8')).map((e) => e.id));
const CLES = {
  rollMutation: { cle: 'table', ids: idsDe('src/data/mutationTables.json') },
  light: { cle: 'tone', ids: idsDe('src/data/lightTones.json') },
  grantNaturalWeapon: { cle: 'subType', ids: idsDe('src/data/weaponGroups.json') },
};

const fichiers = execFileSync('git', ['ls-files', '--', 'src/data/*.json'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => /^src\/data\/[^/]+\.json$/.test(f));
const arrets = [];
const ecritures = [];
let gestes = 0;

for (const rel of fichiers) {
  const brut = readFileSync(join(ROOT, rel), 'utf8');
  const doc = JSON.parse(brut);
  let ici = 0;
  const visiter = (n, chemin) => {
    if (Array.isArray(n)) return n.forEach((x, i) => visiter(x, `${chemin}[${i}]`));
    if (n === null || typeof n !== 'object') return;
    const regle = typeof n.op === 'string' ? CLES[n.op] : undefined;
    if (regle && n[regle.cle] !== undefined) {
      const v = n[regle.cle];
      const id = typeof v === 'string' ? v : v !== null && typeof v === 'object' && Object.keys(v).length === 1 && typeof v.id === 'string' ? v.id : undefined;
      if (id === undefined) arrets.push(`${rel} ${chemin}.${regle.cle} : ni chaîne ni { id }`);
      else if (!regle.ids.has(id)) arrets.push(`${rel} ${chemin}.${regle.cle} : « ${id} » absent de son catalogue`);
      else if (typeof v === 'string') { n[regle.cle] = { id }; ici++; }
    }
    for (const [k, x] of Object.entries(n)) visiter(x, `${chemin}.${k}`);
  };
  visiter(doc, '');
  if (ici === 0) continue;
  if (brut !== serializeDataset(JSON.parse(brut))) arrets.push(`${rel} : forme non canonique`);
  ecritures.push([rel, serializeDataset(doc)]);
  gestes += ici;
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [rel, texte] of ecritures) writeFileSync(join(ROOT, rel), texte, 'utf8');
console.log(`migration 3606 M2a (références d'ops emboîtées) : ${gestes} référence(s), ${ecritures.length} fichier(s).`);
