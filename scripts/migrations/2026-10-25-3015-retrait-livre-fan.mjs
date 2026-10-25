/**
 * Migration #3015 — le livre fan `frenchy-bzh` (« frenchy.bzh (contenu fan) ») quitte la donnée.
 * Clément, 2026-10-25 : « Je t autorise à supprimer tout le contenu fandom (celui de Frenchy, me
 * rappelé plus le pseudo) car il doit créer énormément de dette ».
 *
 * GESTES, tous keyés par le livre, jamais par une liste d'ids recopiée :
 *  1. `books.json` : l'entrée `frenchy-bzh` part ;
 *  2. `creatures.json`, `spells.json`, `traits.json`, `domains.json` : toute entrée de racine à
 *     `source.book = frenchy-bzh` part ;
 *  3. `skills.json`, `talents.json` : toute `specs[]` à `source.book = frenchy-bzh` part ;
 *  4. partout dans ces fichiers, un renvoi `alsoIn[]` vers le livre part (le tableau vide disparaît) ;
 *  5. `sea-events.json` : les équipages types d'abordage (`params.crewRef`/`chefRef`) qui désignaient
 *     une créature du livre passent au profil officiel de la table `REMPLACEMENTS` (valeur
 *     d'ADAPTATION, couche scénario, tracée sur #3015) ;
 *  6. `spells.json` : le drapeau `curated` part de chaque sort. Il ne séparait les sorts officiels
 *     (`true`) que de ceux du livre ; le livre parti, il est constant et ne trie plus rien.
 *
 * ENTRÉES : écrites — `src/data/books.json`, `creatures.json`, `spells.json`, `traits.json`,
 * `domains.json`, `skills.json`, `talents.json`, `sea-events.json` ; aucun autre fichier n'est lu.
 * FAIL-FAST — avant toute écriture, sortie 1 : cible de `REMPLACEMENTS` absente de `creatures.json`
 * ou elle-même sourcée au livre ; `crewRef`/`chefRef` vers une créature du livre hors table ; sort
 * restant dont `curated` n'est pas `true` (le retirer changerait son support mécanique).
 * IDEMPOTENT : rejouée sur l'état final, aucun porteur n'est trouvé et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne
 * final), constaté avant l'écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const abs = (rel) => path.join(ROOT, 'src/data', rel);
/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis un script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

const LIVRE = 'frenchy-bzh';
const RACINES = ['creatures.json', 'spells.json', 'traits.json', 'domains.json'];
const SPECS = ['skills.json', 'talents.json'];

/** Créature du livre → profil officiel qui tient son rôle d'équipage (LDB 77, MDG 16). */
const REMPLACEMENTS = {
  'pirate-fluvial': 'humain',
  'chef-pirate': 'jaego-roth',
  'maraudeur-du-chaos': 'humain',
};

const fautes = [];
const docs = new Map();
function lire(rel) {
  if (!docs.has(rel)) {
    const texte = fs.readFileSync(abs(rel), 'utf8');
    const doc = JSON.parse(texte);
    if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage hors serializeDataset`);
    docs.set(rel, { doc, avant: texte });
  }
  return docs.get(rel).doc;
}

const duLivre = (o) => o?.source?.book === LIVRE;

/** Retire en profondeur les renvois `alsoIn[]` vers le livre ; rend le nombre retiré. */
function purgerAlsoIn(noeud) {
  let n = 0;
  if (Array.isArray(noeud)) { for (const x of noeud) n += purgerAlsoIn(x); return n; }
  if (!noeud || typeof noeud !== 'object') return 0;
  if (Array.isArray(noeud.alsoIn)) {
    const reste = noeud.alsoIn.filter((r) => r?.book !== LIVRE);
    n += noeud.alsoIn.length - reste.length;
    if (reste.length) noeud.alsoIn = reste; else delete noeud.alsoIn;
  }
  for (const v of Object.values(noeud)) n += purgerAlsoIn(v);
  return n;
}

const creaturesAvant = lire('creatures.json');
const idsRetires = new Set(creaturesAvant.filter(duLivre).map((c) => c.id));
for (const [fan, cible] of Object.entries(REMPLACEMENTS)) {
  const c = creaturesAvant.find((x) => x.id === cible);
  if (!c) fautes.push(`remplacement ${fan} → ${cible} : cible absente de creatures.json`);
  else if (duLivre(c)) fautes.push(`remplacement ${fan} → ${cible} : la cible est sourcée au livre`);
}

let gestes = 0;
const books = lire('books.json');
const iLivre = books.findIndex((b) => b.id === LIVRE);
if (iLivre >= 0) { books.splice(iLivre, 1); gestes++; }

for (const rel of RACINES) {
  const doc = lire(rel);
  const reste = doc.filter((e) => !duLivre(e));
  gestes += doc.length - reste.length;
  doc.splice(0, doc.length, ...reste);
}
for (const rel of SPECS) {
  for (const e of lire(rel)) {
    if (!Array.isArray(e.specs)) continue;
    const reste = e.specs.filter((s) => !duLivre(s));
    gestes += e.specs.length - reste.length;
    e.specs = reste;
  }
}
for (const rel of [...RACINES, ...SPECS]) gestes += purgerAlsoIn(lire(rel));

const seaEvents = lire('sea-events.json');
for (const ev of seaEvents.boardEvents ?? []) {
  for (const cle of ['crewRef', 'chefRef']) {
    const ref = ev.params?.[cle];
    if (typeof ref !== 'string' || !(REMPLACEMENTS[ref] || idsRetires.has(ref))) continue;
    if (!REMPLACEMENTS[ref]) { fautes.push(`sea-events ${ev.id}.params.${cle} = ${ref} : créature du livre hors REMPLACEMENTS`); continue; }
    ev.params[cle] = REMPLACEMENTS[ref];
    gestes++;
  }
}

for (const s of lire('spells.json')) {
  if (!('curated' in s)) continue;
  if (s.curated !== true) { fautes.push(`spells ${s.id}.curated = ${s.curated} : drapeau non constant`); continue; }
  delete s.curated;
  gestes++;
}

if (fautes.length) {
  console.error(`#3015 — rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}
if (gestes === 0) {
  console.log('#3015 — rien à retirer : rien à écrire.');
  process.exit(0);
}
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(abs(rel), apres);
}
console.log(`#3015 — ${gestes} geste(s) appliqué(s).`);
