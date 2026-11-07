/**
 * Migration #1467 L1b V-P2 — la clé `desc` à valeur `null` DISPARAÎT de l'entrée.
 *
 * MOTIF MESURÉ : l'enveloppe de document déclare `desc: z.string().min(1).optional()`
 * (`src/data/schemas/grammaire/document.ts`) — une prose ABSENTE est une clé absente, pas une clé à
 * `null` ni une chaîne vide. Trois états pour un seul concept, c'est le troisième qui ment : la
 * chaîne vide est vue « présente » par un lecteur et « absente » par un autre ; `null` force chaque lecteur à un `?? undefined`.
 *
 * ENTRÉES : les deux racines de documents — tout `src/data/*.json` et tout
 * `src/scenes/<campagne>/<campagne>-projet.json`. La purge est mesurée sur la DONNÉE, pas déclarée
 * par fichier : ce qui n'en porte pas est laissé intact.
 *
 * EMPIÈTEMENT L3 ASSUMÉ, déclaré : 24 des porteurs vivent dans les projets de scène sous
 * `scenes[].entities[].postes[].ammo[]` — des snapshots d'`ItemInstance`, strate Instance, hors du
 * périmètre du contrat de structures. Leur PRODUCTEUR est `src/engine/items.ts` (recopie de
 * `t.desc`) : après la purge du catalogue il recopie `undefined`, et la clé est absente à la
 * sérialisation. Les laisser aurait fait mentir le schéma sur ces documents.
 *
 * FORMATAGE PRÉSERVÉ : `src/data` est `JSON.stringify(doc, null, 2)`, les scènes
 * `JSON.stringify(doc, null, 1) + '\n'` — la forme est vérifiée AVANT toute écriture.
 *
 * CHAÎNE VIDE — périmètre BORNÉ, mesuré (2026-08-27) : 3 porteurs de `desc: ""` dans les deux
 * racines. Un seul est purgé ici, `diligence-projet.json › scenes[0]`, parce que son schéma admet
 * l'absence. Les deux autres — `species.json[4]` et `talents.json[0]` — sont déclarés
 * `desc: z.string()` REQUIS (`defs/species.ts:29`, `defs/talents.ts:48`) : retirer la clé les rendrait
 * invalides, et aucune prose ne s'invente (règle 1). Ils meurent avec le lot qui posera `min(1)` sur
 * ces deux defs, pas ici.
 *
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve plus aucun porteur et sort 0.
 * FAIL-FAST : forme non canonique d'un document du périmètre → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const echecs = [];
const ecritures = [];

/** Retire récursivement toute paire `desc: null`. Rend `[valeur, compte]`. */
function purge(v) {
  if (Array.isArray(v)) {
    let n = 0;
    const out = v.map((x) => { const [y, k] = purge(x); n += k; return y; });
    return [out, n];
  }
  if (!v || typeof v !== 'object') return [v, 0];
  let n = 0;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === 'desc' && x === null) { n++; continue; }
    const [y, m] = purge(x);
    n += m;
    out[k] = y;
  }
  return [out, n];
}

/** Retire la chaîne VIDE des entrées de Scène d'un document de projet. Rend `[document, compte]`. */
function purgeSceneVide(doc) {
  if (!Array.isArray(doc?.scenes)) return [doc, 0];
  let n = 0;
  const scenes = doc.scenes.map((s) => {
    if (s?.desc !== '') return s;
    n++;
    const { desc: _vide, ...reste } = s;
    return reste;
  });
  return [n ? { ...doc, scenes } : doc, n];
}

function traite(abs, canonique) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  let doc;
  try { doc = JSON.parse(brut); } catch { echecs.push(`${rel} : JSON illisible`); return; }
  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); return; }
  const [sansNull, n1] = purge(doc);
  const [sortie, n2] = purgeSceneVide(sansNull);
  const n = n1 + n2;
  if (n === 0) return;
  ecritures.push({ rel, abs, brut, out: canonique(sortie), n, nulls: n1, vides: n2 });
}

const canonData = (doc) => JSON.stringify(doc, null, 2);
const canonScene = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

for (const f of fs.readdirSync(path.join(ROOT, 'src/data'))) {
  if (f.endsWith('.json')) traite(path.join(ROOT, 'src/data', f), canonData);
}
const RACINE_SCENES = path.join(ROOT, 'src/scenes');
for (const d of fs.readdirSync(RACINE_SCENES, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const abs = path.join(RACINE_SCENES, d.name, `${d.name}-projet.json`);
  if (fs.existsSync(abs)) traite(abs, canonScene);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let total = 0;
for (const e of ecritures) {
  fs.writeFileSync(e.abs, e.out, 'utf8');
  total += e.n;
  console.log(`${e.rel} — \`desc\` sans prose purgés : ${e.n} (null ${e.nulls}, chaîne vide de Scène ${e.vides})`);
  // PREUVE post-écriture : plus aucun porteur, et la purge ne touche RIEN d'autre (le document
  // rechargé est strictement égal au document purgé en mémoire).
  const apres = JSON.parse(e.out);
  const [reste, rn] = purge(apres);
  const [, rv] = purgeSceneVide(apres);
  if (rn !== 0 || rv !== 0 || JSON.stringify(reste) !== JSON.stringify(apres)) {
    console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${e.rel} : ${rn} \`desc: null\` et ${rv} \`desc: ""\` résiduel(s)`);
    process.exit(1);
  }
}
console.log(`TOTAL : ${total} clé(s) \`desc\` sans prose retirée(s) sur ${ecritures.length} document(s).`);
