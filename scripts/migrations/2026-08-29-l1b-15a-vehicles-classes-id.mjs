/**
 * Migration #1467 L1b V-P6 — `vehicles.json` : la clé d'IDENTITÉ des classes de passage
 * (`travel.classes[].key`) devient `id`.
 *
 * Les 6 classes des trois véhicules à facette Voyage (`interieur`/`exterieur` de la diligence,
 * `cabine`/`pont` de la barge et de la barge fluviale) portent une identité STABLE consommée par
 * `src/engine/travel.ts` (`transportCost`) et choisie à l'écran : c'est
 * la forme canonique `id` + `label`, `key` n'en était que la graphie divergente.
 *
 * ENTRÉES : `src/data/vehicles.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une classe portant déjà `id` (et pas `key`) est reconnue
 * migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : `key` ET `id` présents ensemble sur une classe (arbitrage requis), `key` non-chaîne ou
 * vide → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture ; `id` prend la POSITION exacte de `key` (première clé de la classe).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/vehicles.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/vehicles.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const entrees = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : null;
if (!entrees) {
  console.error('FORME INATTENDUE — src/data/vehicles.json n’expose ni tableau racine ni `entries` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
let aMigrer = 0;
let dejaId = 0;
for (const v of entrees) {
  for (const c of v?.travel?.classes ?? []) {
    const aKey = c.key !== undefined;
    const aId = c.id !== undefined;
    if (aKey && aId) echecs.push(`${v.id} : classe portant \`key\` ET \`id\` (${JSON.stringify(c.key)} / ${JSON.stringify(c.id)}) — arbitrage requis`);
    else if (aKey) {
      if (typeof c.key !== 'string' || !c.key) echecs.push(`${v.id} : \`key\` de forme inattendue ${JSON.stringify(c.key)}`);
      else aMigrer++;
    } else if (aId) dejaId++;
    else echecs.push(`${v.id} : classe sans identité (ni \`key\` ni \`id\`) — ${JSON.stringify(c)}`);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const avantClasses = JSON.stringify(entrees.map((v) => (v?.travel?.classes ?? []).map((c) => ({ ...c, key: undefined, id: undefined }))));

for (const v of entrees) {
  const t = v?.travel;
  if (!t?.classes) continue;
  t.classes = t.classes.map((c) =>
    c.key === undefined ? c : Object.fromEntries(Object.entries(c).map(([k, val]) => [k === 'key' ? 'id' : k, val])),
  );
}

const out = JSON.stringify(data, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucune `key` de classe, chaque classe porte un `id` non vide EN
// PREMIÈRE clé, et la charge utile (tout sauf l'identité) est intacte.
const apres = JSON.parse(out);
const apresEntrees = Array.isArray(apres) ? apres : apres.entries;
const restes = [];
const ids = [];
for (const v of apresEntrees) {
  for (const c of v?.travel?.classes ?? []) {
    if ('key' in c) restes.push(`${v.id} : \`key\` résiduelle`);
    if (typeof c.id !== 'string' || !c.id) restes.push(`${v.id} : \`id\` absent ou vide`);
    if (Object.keys(c)[0] !== 'id') restes.push(`${v.id}/${c.id} : \`id\` n’est pas la 1ʳᵉ clé (${Object.keys(c).join(', ')})`);
    ids.push(`${v.id}/${c.id}`);
  }
}
const memeCharge = JSON.stringify(apresEntrees.map((v) => (v?.travel?.classes ?? []).map((c) => ({ ...c, key: undefined, id: undefined })))) === avantClasses;
if (restes.length || !memeCharge) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${restes.join(' ; ') || '—'} ; charge utile ${memeCharge ? 'intacte' : 'ALTÉRÉE'}`);
  process.exit(1);
}

console.log(`vehicles.json — travel.classes \`key\` → \`id\` : ${aMigrer} migrée(s), ${dejaId} déjà à \`id\``);
console.log(`Classes : ${ids.join(', ')}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/vehicles.json`);
