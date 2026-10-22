#!/usr/bin/env node
// Rapport d'INTÉGRITÉ DU FOLIO (#536) — pour chaque entrée de `src/data/*.json` portant
// `source: {book, page}` + `desc`, retrouve la `desc` VERBATIM dans le `Source/` du livre déclaré
// (règle stricte 5) et compare le folio déclaré à l'encadrement `data-folio` de l'occurrence.
// Mécanique dans `scripts/guards/lib/folioIntegrity.mjs` (partagée avec le verrou cliquet de
// `src/data/book-source-integrity.test.ts`). C'est l'outil de SOLDE du stock : il donne, pour chaque
// entrée réfutée, le folio RÉEL à recopier — après quoi la clé se retire de `folioRatchetStock.mjs`.
//
// Deux voies de réfutation (cf. l'en-tête de `folioIntegrity.mjs`) : `hors-livre` (folio au-delà du
// dernier folio attesté du livre — n'a pas besoin de la desc) et `encadrement` (desc retrouvée entre
// deux marqueurs qui excluent le folio annoncé).
//
// Verdicts non réfutés — le rapport ne les compte pas comme des fautes, mais les AFFICHE : ce sont les
// angles morts de la garde, pas des entrées absoutes. `desc-introuvable` (match verbatim bruité),
// `sans-marqueur`, `livre-hors-atlas` (pas d'extraction FR), `desc-trop-courte`.
//
// `--stock` re-rend `folioRatchetStock.mjs` depuis la mesure — et REFUSE d'écrire un stock plus GRAND
// que l'actuel : l'outil ne sait que SOLDER. Faire croître le stock reste un geste manuel doublé d'un
// relèvement du plafond dans la garde, donc visible en revue.
//
// VOIE C (#1200) : quand la desc ne localise rien, le TITRE de section prend le relais. Chacune de ses
// réfutations est une régression (aucun stock, #1225), et ce qu'elle ne résout pas non plus est listé
// nommément (`--muets`) : plus aucune entrée n'échappe en silence.
//
// Usage : node scripts/data/audit-folios.mjs [--json] [--out <fichier>] [--stock] [--muets]
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditFolios, renderStock } from '../guards/lib/folioIntegrity.mjs';
import { FOLIO_RATCHET } from '../guards/lib/folioRatchetStock.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = join(ROOT, 'src', 'data');

const jsonOut = process.argv.includes('--json');
const outArgIdx = process.argv.indexOf('--out');
const outPath = outArgIdx >= 0 ? process.argv[outArgIdx + 1] : null;

const { violations, titleViolations, noteAuthored, unresolved, stats, total, multi } = auditFolios(DATA_DIR);

const fmt = (ranges) =>
  ranges.map((r) => (r.hi === null ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}-${r.hi}`)).join(',');

const rows = violations.map((v) => ({
  key: v.key,
  book: v.book,
  declare: v.page,
  voie: v.voie,
  reel: v.voie === 'hors-livre' ? `>${v.max} (dernier folio du livre)` : fmt(v.ranges),
  chapitre: v.ranges[0]?.file ?? '',
  cliquete: FOLIO_RATCHET.has(v.key),
}));

if (process.argv.includes('--stock')) {
  const cible = join(ROOT, 'scripts', 'guards', 'lib', 'folioRatchetStock.mjs');
  if (violations.length > FOLIO_RATCHET.size) {
    console.error(
      `REFUS : la mesure rend ${violations.length} clés, le stock en porte ${FOLIO_RATCHET.size}. Cet outil ne sait que SOLDER.\n` +
        `Les entrées ci-dessous sont des RÉGRESSIONS à corriger au Source, pas à cliqueter :\n` +
        rows.filter((r) => !r.cliquete).map((r) => `  ${r.key} p.${r.declare} -> ${r.reel}`).join('\n'),
    );
    process.exit(1);
  }
  const ancien = readFileSync(cible, 'utf8');
  const entete = ancien.slice(0, ancien.indexOf('/** @type {ReadonlySet<string>} */')).trimEnd();
  writeFileSync(cible, renderStock(violations, entete));
  console.log(`stock re-rendu : ${FOLIO_RATCHET.size} -> ${violations.length} clés (en-tête conservé — le mettre à jour à la main).`);
} else if (jsonOut || outPath) {
  const payload = JSON.stringify({ total, stats, rows, multi, titleViolations, noteAuthored, unresolved }, null, 2);
  if (outPath) writeFileSync(outPath, payload);
  else console.log(payload);
} else {
  const somme = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`Entrées citées scannées : ${total}`);
  console.log('Verdicts :');
  for (const [k, n] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${n}`);
  console.log(`  ${'(somme)'.padEnd(18)} ${somme}`);
  const resolusTitre = stats['titre:titre-ok'] ?? 0;
  console.log(`\nRÉFUTÉES (voie desc) : ${violations.length} / ${total} scannées — dont ${
    rows.filter((r) => r.voie === 'hors-livre').length
  } hors-livre, ${rows.filter((r) => r.voie === 'encadrement').length} par encadrement`);
  console.log(`VOIE TITRE : ${resolusTitre} entrées confirmées, ${titleViolations.length} réfutées, ${noteAuthored.length} à note authored (jamais cliquetées), ${unresolved.length} irrésolues (ni desc ni titre).\n`);
  for (const r of rows) {
    const tag = r.cliquete ? '' : '  <= HORS CLIQUET (régression)';
    console.log(`  ${r.key.padEnd(48)} ${r.book.padEnd(22)} p.${String(r.declare).padEnd(5)} -> ${r.reel.padEnd(30)} ${r.chapitre}${tag}`);
  }
  if (titleViolations.length) {
    console.log(`\nRÉFUTÉES PAR LE TITRE DE SECTION (régressions) : ${titleViolations.length} (le folio montré est celui d'un titre HOMONYME, pas un emplacement prouvé)`);
    for (const v of titleViolations) {
      console.log(`  ${v.key.padEnd(48)} p.${String(v.page).padEnd(5)} -> titre le plus proche ${fmt(v.proche ? [v.proche] : v.ranges).padEnd(10)} écart ${String(v.ecart).padEnd(3)} ${v.proche?.file ?? ''}`);
    }
  }
  if (noteAuthored.length) {
    console.log(`\nÀ ARBITRER — réfutées par le titre MAIS porteuses d'une note authored : ${noteAuthored.length}`);
    for (const n of noteAuthored) {
      console.log(`  ${n.key.padEnd(48)} p.${String(n.page).padEnd(5)} note : ${n.note}`);
    }
  }
  if (process.argv.includes('--muets')) {
    console.log(`\nIRRÉSOLUES (ni desc ni titre) : ${unresolved.length}`);
    for (const u of unresolved) console.log(`  ${u.key.padEnd(48)} p.${String(u.page).padEnd(5)} ${u.descVerdict} / ${u.titreVerdict}`);
  }
  if (multi.length) {
    console.log(`\nÀ ARBITRER — desc trouvée sur PLUSIEURS folios (le livre la porte deux fois) : ${multi.length}`);
    for (const m of multi) console.log(`  ${m.key.padEnd(48)} p.${m.declare ?? m.page} vs ${fmt(m.ranges)}`);
  }
}
