/**
 * Migration L2 #1548 (suite de `2026-08-30-skillid-vers-ref-emboitee.mjs`) — cinq conteneurs de Test
 * désignaient une CARACTÉRISTIQUE dans leur champ de Compétence. La référence gouvernée
 * (`ref('skill')`) les REFUSE : le défaut, invisible tant que le champ était un `z.string()` libre,
 * se corrige ici — la Caractéristique va au slot `char`, celui que les conteneurs de Test portent
 * déjà (`activities.json › char`, `incidents-monture › mount.riderTest.char`, `charKeySchema`).
 *
 * SOURCE, verbatim des `desc`/`note` des entrées concernées :
 *  - `sea-perils.json › hazards[debris-marins].freeTest` — « un Test étendu de Force Accessible
 *    (+20) pour un total de 10 DR » (MDG 13 l.481-491) ;
 *  - `steam-breakdown.json › [feu-eteint|rupture-du-reservoir].restart[0]` — « un Test étendu de
 *    Force Intermédiaire (+0) avec un total de 10 DR » (MDG 12 l.324-349) ;
 *  - `river-criticals.json › tables.{greement,superstructure}[].crewTest` — Test d'Initiative
 *    (MSRC 7).
 * Force et Initiative sont des CARACTÉRISTIQUES (`charKeySchema`), aucune n'est une entrée de
 * `skills.json` : `testValue(acteur, 'force')` retombait donc sur la Caractéristique de REPLI.
 *
 * ENTRÉES : `sea-perils.json`, `steam-breakdown.json`, `river-criticals.json`.
 * FAIL-FAST : une valeur qui n'est ni un id de `skills.json` ni une clé de Caractéristique →
 * aucune écriture, sortie 1. IDEMPOTENT : rejouée, elle n'écrit rien.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)`, vérifié avant écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const lire = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', rel), 'utf8'));

const IDS_COMPETENCES = new Set(lire('skills.json').map((s) => s.id));
/** `charKeySchema` (`src/data/schemas/grammaire/valeurs.ts`). */
const CLES_CARAC = new Set([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

const CHEMINS = [
  { fichier: 'sea-perils.json', chemin: ['hazards', '[]', 'freeTest'] },
  { fichier: 'steam-breakdown.json', chemin: ['[]', 'restart', '[]'] },
  { fichier: 'river-criticals.json', chemin: ['tables', '{}', '[]', 'crewTest'] },
];

function* parents(noeud, chemin, conteneur = null, cle = null) {
  if (chemin.length === 0) { if (conteneur != null) yield { conteneur, cle }; return; }
  if (noeud == null || typeof noeud !== 'object') return;
  const [tete, ...reste] = chemin;
  if (tete === '[]') {
    if (!Array.isArray(noeud)) return;
    for (let i = 0; i < noeud.length; i++) yield* parents(noeud[i], reste, noeud, i);
  } else if (tete === '{}') {
    if (Array.isArray(noeud)) return;
    for (const k of Object.keys(noeud)) yield* parents(noeud[k], reste, noeud, k);
  } else {
    if (Array.isArray(noeud)) return;
    yield* parents(noeud[tete], reste, noeud, tete);
  }
}

/** `{…, skill: {id}, …}` → `{…, char: id, …}` EN PLACE (la clé garde sa position). */
const versChar = (o) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => (k === 'skill' ? ['char', v.id] : [k, v])));

const documents = new Map();
for (const f of [...new Set(CHEMINS.map((c) => c.fichier))]) {
  const abs = path.join(ROOT, 'src/data', f);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    console.error(`FORME NON CANONIQUE — src/data/${f} ; AUCUNE écriture.`);
    process.exit(1);
  }
  documents.set(f, { abs, brut, data });
}

const echecs = [];
const aCorriger = [];
for (const c of CHEMINS) {
  const { data } = documents.get(c.fichier);
  for (const { conteneur, cle } of parents(data, c.chemin)) {
    const o = conteneur[cle];
    if (!estObjet(o) || o.skill == null) continue;
    const { id, spec } = o.skill;
    if (IDS_COMPETENCES.has(id)) continue;
    if (!CLES_CARAC.has(id) || spec != null) {
      echecs.push(`src/data/${c.fichier} : « ${id} » n'est ni une Compétence ni une Caractéristique nue — ${JSON.stringify(o.skill)}`);
      continue;
    }
    aCorriger.push({ conteneur, cle, fichier: c.fichier, id });
  }
}
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const e of new Set(echecs)) console.error(`  ${e}`);
  process.exit(1);
}

const comptes = new Map();
for (const { conteneur, cle, fichier, id } of aCorriger) {
  conteneur[cle] = versChar(conteneur[cle]);
  comptes.set(fichier, [...(comptes.get(fichier) ?? []), id]);
}

let total = 0;
for (const [f, { abs, brut, data }] of documents) {
  const out = JSON.stringify(data, null, 2);
  if (out.includes('\r')) { console.error(`src/data/${f} : \\r dans le texte réécrit ; AUCUNE écriture.`); process.exit(1); }
  if (out !== brut) fs.writeFileSync(abs, out, 'utf8');
  const ids = comptes.get(f) ?? [];
  total += ids.length;
  console.log(`src/data/${f} — ${ids.length} Test(s) de Caractéristique corrigé(s)${ids.length ? ` (${ids.join(', ')})` : ''} ; ${out !== brut ? 'réécrit' : 'INCHANGÉ (no-op byte-identique)'}.`);
}
console.log(`TOTAL : ${total} conteneur(s) de Test dont la Caractéristique quitte le champ de Compétence.`);
