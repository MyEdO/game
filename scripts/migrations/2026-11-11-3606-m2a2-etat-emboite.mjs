/**
 * Migration #3606 M2a2 (L1c #1468) — les références d'État des ops `condition` et `removeCondition`, typées dans
 * `OP_DEFS`, sont emboîtées : un id nu devient `{ id }`, à la même clé.
 *
 *   op                 clés
 *   `condition`        `id`, `onlyIfCondition`, `unlessCondition`
 *   `removeCondition`  `id`
 *
 * Catalogue : `etats.json` et les ids des marqueurs narratifs de `NARRATIVE_MARKERS` (`src/engine/conditions.ts`) à la
 * date de la migration, figés ici : le module du moteur ne se charge pas sous `node` nu, et le rejeu dit l'arbre de
 * cette date. Le dialecte miscast (`miscast.json`) porte la même op `condition` : il migre avec elle.
 *
 * Entrées : chaque `src/data/*.json` (`readdirSync`) et chaque `src/scenes/<campagne>/<campagne>-projet.json` ; toute op
 * de ces deux sortes, où qu'elle soit dans le document.
 *
 * Une entrée absente passe sans faute : une op déjà `{ id }`, ou sans la clé, n'a aucun geste. Une valeur ni chaîne ni
 * `{ id }` seul, un id ni au catalogue ni marqueur, ou un document non canonique sont un ARRÊT nominatif (exit 1),
 * AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MARQUEURS_NARRATIFS = ['petrifie'];
const ETATS = new Set([...JSON.parse(readFileSync(join(ROOT, 'src/data/etats.json'), 'utf8')).map((e) => e.id), ...MARQUEURS_NARRATIFS]);
const CLES = { condition: ['id', 'onlyIfCondition', 'unlessCondition'], removeCondition: ['id'] };

const canoniqueDeScene = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const documents = [
  ...readdirSync(join(ROOT, 'src/data')).filter((f) => f.endsWith('.json')).map((f) => ({ rel: `src/data/${f}`, canonique: serializeDataset })),
  ...readdirSync(join(ROOT, 'src/scenes'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'src/scenes', d.name, `${d.name}-projet.json`)))
    .map((d) => ({ rel: `src/scenes/${d.name}/${d.name}-projet.json`, canonique: canoniqueDeScene })),
];
const arrets = [];
const ecritures = [];
let gestes = 0;

for (const { rel, canonique } of documents) {
  const brut = readFileSync(join(ROOT, rel), 'utf8');
  const doc = JSON.parse(brut);
  let ici = 0;
  const visiter = (n, chemin) => {
    if (Array.isArray(n)) return n.forEach((x, i) => visiter(x, `${chemin}[${i}]`));
    if (n === null || typeof n !== 'object') return;
    for (const cle of (typeof n.op === 'string' && Object.hasOwn(CLES, n.op) ? CLES[n.op] : [])) {
      const v = n[cle];
      if (v === undefined) continue;
      const id = typeof v === 'string' ? v : v !== null && typeof v === 'object' && Object.keys(v).length === 1 && typeof v.id === 'string' ? v.id : undefined;
      if (id === undefined) arrets.push(`${rel} ${chemin}.${cle} : ni chaîne ni { id }`);
      else if (!ETATS.has(id)) arrets.push(`${rel} ${chemin}.${cle} : « ${id} » ni dans etats.json ni marqueur narratif`);
      else if (typeof v === 'string') { n[cle] = { id }; ici++; }
    }
    for (const [k, x] of Object.entries(n)) visiter(x, `${chemin}.${k}`);
  };
  visiter(doc, '');
  if (ici === 0) continue;
  if (brut !== canonique(JSON.parse(brut))) arrets.push(`${rel} : forme non canonique`);
  ecritures.push([rel, canonique(doc)]);
  gestes += ici;
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [rel, texte] of ecritures) writeFileSync(join(ROOT, rel), texte, 'utf8');
console.log(`migration 3606 M2a2 (États d'ops emboîtés) : ${gestes} référence(s), ${ecritures.length} fichier(s).`);
