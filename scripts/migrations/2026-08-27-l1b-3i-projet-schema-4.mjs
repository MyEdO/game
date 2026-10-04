/**
 * Migration #1467 L1b V-P2 — les documents de projet passent au `schema: 4`.
 *
 * MOTIF MESURÉ : la FORME du document de projet a changé dans ce lot (rôles de prose —
 * `scenes[].description` → `desc`, `DialogueNode.text` → `desc`, `DialogueChoice.text` → `label`,
 * `text` des effets `journal`/`document`/`setObjective` → `desc`, `meta.description` → `desc`, et la
 * prose absente devient une clé absente). Un changement de forme se BUMPE : sans lui, un projet
 * exporté avant ce lot (bibliothèque utilisateur, `.json` portable) mourrait sur ~200 lignes zod, ce
 * que le site interdit explicitement (`src/data/migrationsDeProjet.ts` : « Ajouter ici la migration N→N+1 …
 * plutôt que de refuser en silence des projets antérieurs valides »).
 *
 * Le CHARGEMENT porte la migration mécanique 3→4 (`PROJECT_MIGRATIONS[3]`) ; CE script fait le
 * pendant sur les 4 documents COMMITTÉS, dont la charge utile est déjà à la forme 4 (migrations
 * `…-3{a,b,g,h}-*.mjs`) : il ne reste que le numéro à porter.
 *
 * ENTRÉES : les 4 `src/scenes/<campagne>/<campagne>-projet.json`.
 *
 * ORDRE : ce script se rejoue APRÈS `…-3h-…` (ordre lexical) — la charge utile est déjà migrée quand
 * le numéro change.
 * IDEMPOTENT : un document déjà en `schema: 4` — ou PLUS RÉCENT, un bump ultérieur l'ayant emporté
 * plus loin (`…-13-projet-forme.mjs` porte le 4 → 5) — est reconnu migré ; rejouée, elle n'écrit rien.
 * FAIL-FAST : `schema` absent, non numérique, ou INFÉRIEUR à 3 → sortie 1.
 * FORMATAGE PRÉSERVÉ : sérialiseur des scènes `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT
 * toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RACINE = path.join(ROOT, 'src/scenes');
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

const echecs = [];
const ecritures = [];

for (const d of fs.readdirSync(RACINE, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const abs = path.join(RACINE, d.name, `${d.name}-projet.json`);
  if (!fs.existsSync(abs)) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (typeof doc.schema !== 'number' || !Number.isFinite(doc.schema)) { echecs.push(`${rel} : \`schema\` absent ou non numérique (${JSON.stringify(doc.schema)})`); continue; }
  if (doc.schema >= 4) { ecritures.push({ rel, abs, brut, out: brut, deja: true }); continue; }
  if (doc.schema !== 3) { echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (3 ou plus récent attendus)`); continue; }
  // Le numéro change EN PLACE : `schema` garde sa position de première clé.
  ecritures.push({ rel, abs, brut, out: canonique({ ...doc, schema: 4 }), deja: false });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let migres = 0;
for (const e of ecritures) {
  if (e.out !== e.brut) { fs.writeFileSync(e.abs, e.out, 'utf8'); migres++; }
  // PREUVE post-écriture : `schema` vaut 4, et RIEN d'autre n'a bougé (comparaison hors `schema`).
  const apres = JSON.parse(e.out);
  const { schema: _a, ...resteApres } = apres;
  const { schema: _b, ...resteAvant } = JSON.parse(e.brut);
  if (apres.schema < 4 || JSON.stringify(resteApres) !== JSON.stringify(resteAvant)) {
    console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${e.rel} : schema=${apres.schema}, charge utile ${JSON.stringify(resteApres) === JSON.stringify(resteAvant) ? 'intacte' : 'ALTÉRÉE'}`);
    process.exit(1);
  }
  console.log(`${e.rel} — schema ${e.deja ? `${apres.schema} (déjà migré, no-op)` : '3 → 4'}`);
}
console.log(`TOTAL : ${migres} document(s) bumpé(s) sur ${ecritures.length}.`);
