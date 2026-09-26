/**
 * Migration #1467 L1b V-Src — `structures.json` : la réf de source passe de la granularité CHAPITRE
 * (`{book, chapter}`) au FOLIO IMPRIMÉ (`{book, page}`), forme commune `sourceRefSchema`.
 *
 * MOTIF MESURÉ : `src/data/schemas/defs/structures.ts` déclarait un `z.strictObject({book, chapter})`
 * PROPRE au dataset — seule survivance de cette granularité dans les deux racines de documents
 * (`scripts/guards/lib/structuresStock.mjs:696`, 24 occurrences « historique » ;
 * `:894`, la forme du def). Un `chapter` ne se confronte à AUCUN instrument : ni `auditFolio`
 * (`scripts/guards/lib/folioIntegrity.mjs`, voie desc-verbatim → `data-folio`), ni
 * `auditAlignment` (`scripts/guards/lib/folioLineAlign.mjs`) ne mordent sans `page`.
 *
 * FOLIOS POSÉS — chacun ATTESTÉ dans l'extraction, jamais déduit d'un numéro de chapitre :
 *   - folio 89  (`archives-de-l-empire-2`) : `#### BARRICADES ET PROTECTIONS TYPIQUES`,
 *     `ADE II 8` l.280, folio gouvernant 89 (`folioGoverningWhy` → `{folio:89, reason:'ok'}`).
 *     Les 5 entrées ADE II n'ont pas de `desc` : c'est l'ancre de TITRE de leur table qui atteste.
 *   - folios 119 / 120 (`aux-armes`) : `### TABLEAU DES STRUCTURES COURANTES`, `AA 10` l.26
 *     (folio gouvernant 119), la table courant sur les deux folios. Les 19 entrées AA portent une
 *     `desc` VERBATIM : chacune est confrontée à `auditFolio` APRÈS écriture (verdict `folio-ok`
 *     exigé pour les 19 — c'est la preuve, pas la table).
 *
 * ENTRÉES : `src/data/structures.json` (la seule donnée lue et écrite) ; `Source/` via
 * `scripts/guards/lib/folioIntegrity.mjs` pour la vérification.
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée déjà en `{book, page}` au folio attendu est
 * reconnue « déjà migrée » et laissée intacte ; rejouée sur l'état final, la migration n'écrit rien
 * et sort 0. FAIL-FAST : id inconnu de la table, id absent du fichier, ancre textuelle introuvable,
 * `page` déjà présente mais DIVERGENTE, ou verdict `auditFolio` autre que `folio-ok` → rien n'est
 * écrit (l'écriture est différée après la vérification), sortie 1.
 *
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE ancrée sur le couple `"chapter": <n>` qui suit l'`"id"`
 * de l'entrée — aucun `JSON.stringify` du document.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditFolio } from '../guards/lib/folioIntegrity.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/structures.json');

/** Folio IMPRIMÉ par entrée — attesté au Source (voir en-tête), jamais recalculé depuis `chapter`. */
const FOLIOS = {
  // ADE II « Le théâtre de la guerre » — table « Barricades et protections typiques », folio 89.
  porte: 89,
  'porte-blindee': 89,
  'porte-de-ville': 89,
  'mur-en-bois': 89,
  'mur-en-pierre': 89,
  // AA 10 « Tableau des Structures Courantes » — folio 119.
  charrette: 119,
  'chariot-leger': 119,
  'chariot-moyen': 119,
  'chariot-lourd': 119,
  'barge-moyenne': 119,
  'bateau-de-patrouille': 119,
  chaloupe: 119,
  'cloture-en-clayonnage': 119,
  // … suite de la même table, folio 120.
  diligence: 120,
  herse: 120,
  'mantelet-de-bois': 120,
  'mur-a-ossature-en-bois': 120,
  'mur-de-chateau': 120,
  'mur-de-forteresse-naine': 120,
  'mur-de-pierre-aa': 120,
  'mur-en-pierres-seches': 120,
  'palissade-de-pieux': 120,
  'solide-porte-en-bois': 120,
  terrassement: 120,
};

const echecs = [];
const migres = [];
const dejaMigres = [];

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

// ── Confrontation de la TABLE au contenu réel du fichier ─────────────────────────────────────────
const idsFichier = data.map((e) => e.id);
for (const id of Object.keys(FOLIOS)) {
  if (!idsFichier.includes(id)) echecs.push(`${id} : id de la table ABSENT de structures.json`);
}
// Une entrée NÉE au folio (`{book, page}`, postérieure à la migration) n'a rien à migrer : seule une
// entrée encore au chapitre exige sa ligne de table.
for (const e of data) {
  if (!(e.id in FOLIOS) && typeof e.source?.page !== 'number')
    echecs.push(`${e.id} : entrée de structures.json ABSENTE de la table de folios`);
}

// ── Réécriture textuelle ancrée (différée : rien n'est écrit avant la vérification) ──────────────
let out = brut;
for (const entree of data) {
  const { id, source } = entree;
  const page = FOLIOS[id];
  if (page === undefined) continue;

  if (typeof source?.page === 'number') {
    if (source.page !== page) echecs.push(`${id} : page ${source.page} déjà posée, DIVERGENTE de ${page}`);
    else dejaMigres.push(id);
    continue;
  }
  if (typeof source?.chapter !== 'number') {
    echecs.push(`${id} : source sans \`chapter\` NI \`page\` — forme inattendue ${JSON.stringify(source)}`);
    continue;
  }

  const ancreId = `"id": ${JSON.stringify(id)}`;
  const occurrences = out.split(ancreId).length - 1;
  if (occurrences !== 1) {
    echecs.push(`${id} : ancre \`${ancreId}\` vue ${occurrences} fois (1 attendue)`);
    continue;
  }
  const debut = out.indexOf(ancreId);
  const ancreChapitre = `"chapter": ${source.chapter}`;
  const at = out.indexOf(ancreChapitre, debut);
  if (at === -1) {
    echecs.push(`${id} : ancre textuelle \`${ancreChapitre}\` introuvable après l'id`);
    continue;
  }
  out = out.slice(0, at) + `"page": ${page}` + out.slice(at + ancreChapitre.length);
  migres.push({ id, chapter: source.chapter, page });
}

// ── PREUVE : les entrées à `desc` sont confrontées à `auditFolio` sur le texte MIGRÉ ─────────────
const apres = JSON.parse(out);
const verdicts = [];
for (const e of apres) {
  if (typeof e.desc !== 'string' || !e.desc) continue;
  const r = auditFolio({ book: e.source.book, page: e.source.page, desc: e.desc });
  verdicts.push({ id: e.id, page: e.source.page, verdict: r.verdict });
  if (r.verdict !== 'folio-ok') {
    echecs.push(`${e.id} : auditFolio rend « ${r.verdict} » pour le folio ${e.source.page} (folio-ok exigé)`);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

console.log(`structures.json — migrées {book,chapter} → {book,page} : ${migres.length}`);
for (const m of migres) console.log(`  ${m.id}  ch.${m.chapter} → folio ${m.page}`);
console.log(`Déjà au folio (no-op) : ${dejaMigres.length}`);
console.log(`\nPREUVE auditFolio (entrées à desc verbatim) : ${verdicts.length} entrée(s)`);
for (const v of verdicts) console.log(`  ${v.id.padEnd(24)} folio ${v.page} → ${v.verdict}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/structures.json`);
