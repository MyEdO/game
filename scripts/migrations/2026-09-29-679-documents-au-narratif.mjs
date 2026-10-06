/**
 * Migration #679 — les documents remis au joueur passent au registre `narratif.documents` : chaque
 * Effect `document` EN LIGNE (`{ title, desc }`) devient `{ documentId }`, et son texte une entrée du
 * registre du MÊME document de projet, qui passe en `schema: 18`.
 *
 * UN geste, par la primitive `souleveLesDocuments` (`src/data/documentsAuNarratif.ts`) — la MÊME que
 * celle du migrateur de chargement `PROJECT_MIGRATIONS[17]` (`src/data/migrationsDeProjet.ts`), jamais un second
 * calcul. La règle globale que ses ids évitent est lue ici aux catalogues `src/data/creatures.json` et
 * `src/data/trappings.json` (au chargement : `collisionneAvecLeGlobal`, le même périmètre
 * créature/possession). Parité mesurée par `src/state/projet-migration-17-vers-18.test.ts`, qui joue la
 * MÊME fixture par les deux.
 *
 * DEUX STRATES : les projets JSON sont migrés ICI ; les générateurs qui les produisent
 * (`scripts/arene/{hub,zones1-7,expeditions}.mjs`, `scripts/loup-et-saumure/generate.mjs`) déclarent
 * leurs documents au registre de leur paquet avec les ids que ce passage produit — la garde byte-stable
 * (`src/scenes/generateurs-byte-stables.test.ts`) confronte les deux à l'octet.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json` ; `src/data/documentsAuNarratif.ts` et
 * `src/data/slug.ts` (la primitive, chargée par Node nu) ; `src/data/creatures.json`,
 * `src/data/trappings.json` (la règle globale).
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT toute écriture — non
 * canonique = sortie 1, jamais un reflow silencieux. `schema` garde sa POSITION.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE CLOSE (`schema` ∈ {17, 18}) : DERNIÈRE de la chaîne dans l'ordre lexical, elle NOMME un
 * `schema` futur.
 * FAIL-FAST : `schema` absent, non numérique ou ∉ {17, 18}, `scenes` non-tableau, bloc narratif
 * absent, Effect en ligne mal formé (levée de la primitive), périmètre vide → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { souleveLesDocuments } from '../../src/data/documentsAuNarratif.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-29-679-documents-au-narratif';
const RACINE = path.join(ROOT, 'src/scenes');

/** Forme du document AVANT et APRÈS ce bump — la borne haute est CLOSE (cf. en-tête). */
const SCHEMA_AVANT = 17;
const SCHEMA_APRES = 18;

const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/** Ids de la règle globale (créature/possession), lus aux catalogues. */
const idsGlobaux = new Set(
  ['src/data/creatures.json', 'src/data/trappings.json'].flatMap((rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')).map((e) => e.id)),
);
const estGlobal = (id) => idsGlobaux.has(id);

const echecs = [];
const cibles = fs.existsSync(RACINE)
  ? fs
    .readdirSync(RACINE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
    .filter((p) => fs.existsSync(p))
  : [];

const rapports = [];
for (const abs of cibles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (doc.schema !== SCHEMA_AVANT && doc.schema !== SCHEMA_APRES) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }
  if (!doc.narratif || typeof doc.narratif !== 'object' || Array.isArray(doc.narratif)) { echecs.push(`${rel} : bloc \`narratif\` absent ou non-objet`); continue; }

  let monte;
  try { monte = souleveLesDocuments(doc, estGlobal); } catch (e) { echecs.push(`${rel} : ${e.message}`); continue; }
  const souleves = monte.narratif.documents.length - (Array.isArray(doc.narratif.documents) ? doc.narratif.documents.length : 0);
  rapports.push({ rel, abs, brut, doc, sortie: { ...monte, schema: SCHEMA_APRES }, souleves });
}

if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  const out = canonique(r.sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : la primitive n'a plus rien à soulever, et le document s'annonce au format d'après.
  const apres = JSON.parse(out);
  if (canonique(souleveLesDocuments(apres, estGlobal)) !== out || apres.schema !== SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, document en ligne restant`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, documents soulevés : ${r.souleves} — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${rapports.reduce((n, r) => n + r.souleves, 0)} document(s) soulevé(s)`);
