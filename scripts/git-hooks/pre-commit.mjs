// Hook pre-commit (#2327) : la porte LÉGÈRE du commit, jugée sur le contenu de l'INDEX.
// REFUSE (exit 1) au nom de l'INTÉGRITÉ du dépôt seule (#2327 A8) : arbre de travail imbriqué
// (`arbreImbrique.mjs`), lock npm amputé (`npmLockHoisted.mjs`), fins de ligne (`eolStage.mjs`) — et
// la lecture de l'index en panne, sans laquelle aucune des trois ne juge.
// AVERTIT, site et geste, puis sort en 0 : les gardes de FORME (`FORMES`), que la CI rejuge en refus,
// le canal de la baseline nominative (`decisions-baseline.json`) et le tag `[entériné]` ajouté. Une
// panne d'outillage du lint (oxlint absent, index illisible) est un saut averti, comme ses défauts.
// Sous une fusion en cours, les fichiers « stagés » sont ceux de son APPORT PROPRE (#2328 A7).
// Contenu jugé : l'INDEX seul, baseline nominative comprise. Trois lectures du DISQUE, nommées : le
// `.git` des dossiers parents des chemins stagés (`arbreImbrique.mjs`), la config et l'oxlint de CET
// arbre (`lintStage.mjs`, un écart de config est un saut déclaré). Corpus, contrats de donnée,
// docs dérivés et suites restent à la CI (#2327 §0, §1) ; les tests du périmètre se jouent à la main,
// `npm run test:perimetre` (#2400). La durée totale est imprimée en fin de hook.
// Porte de version de Node en PREMIER import (`scripts/node-requis.mjs`) : la clôture STATIQUE ne porte
// ni module TypeScript ni attribut d'import ; `commentPoison.mjs`, qui en porte, se charge après elle.
import '../node-requis.mjs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emojisIn } from '../guards/lib/emojiAffordance.mjs';
import { scanHardcode } from '../guards/lib/hardcode.mjs';
import { scanRollSeamExclusivity } from '../guards/lib/rollSeamExclusivity.mjs';
import { rollSeamExcluded } from '../guards/lib/rollSeamWhitelist.mjs';
import { scanNpmLockHoisted } from '../guards/lib/npmLockHoisted.mjs';
import { scanArbresImbriques } from '../guards/lib/arbreImbrique.mjs';
import { lintDeLIndex } from '../guards/lib/lintStage.mjs';
import { codeDePanne, paquetsDArgv } from '../guards/lib/porteSpawn.mjs';
import { cheminsMalNormalises, raisonDeRefusEol } from '../guards/lib/eolStage.mjs';
import { defautsDeForme, familleDe, raisonDeRefusDeForme } from '../guards/memoire-forme.mjs';
import { INDEX, ceQuApporteLeCommit, depotDe, eolsDe, lireEnLot, racineDe, raisonCourte } from '../guards/lib/gitPorte.mjs';
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs';
import { journaliserLeHook } from './journal.mjs';

const DEBUT_MS = Date.now();
const journal = journaliserLeHook('pre-commit');
const {
  scanTombstones, scanExcuses, scanRawClaims, scanDecisionClaims, scanLegacyVocabHorsStock,
  estFichierScanne, DECISIONS_BASELINE_PATH, decisionsBaselineDe, partitionBaseline, formatBaselineReport,
} = await import('../guards/lib/commentPoison.mjs');

/** Les gardes de FORME jouées ici en avertissement, et le step de CI qui les REFUSE (#2327 A8). */
const FORMES = Object.freeze({
  'pierre tombale': 'suite (`npm test`) — src/comment-poison-guard.test.ts',
  'excuse sans tag': 'suite (`npm test`) — src/comment-poison-guard.test.ts',
  "vocabulaire de l'ancien état": 'suite (`npm test`) — src/comment-poison-guard.test.ts',
  "emoji d'affordance": 'suite (`npm test`) — src/ui/no-emoji-affordance.test.ts',
  'seam de jet contourné': 'suite (`npm test`) — src/state/roll-seam-exclusivity-guard.test.ts',
  'forme du stock permanent': 'types-hooks (`npm run test:hooks`) — scripts/guards/memoire-forme.test.mjs',
  lint: 'types (`npm run lint`)',
});

// git chdir dans la racine de la copie de travail avant d'invoquer un hook (githooks(5)) : `cwd` porte
// l'arbre QUI COMMITTE, worktree compris (`core.hooksPath` relatif, #1679 L1c).
const ROOT = resolve(racineDe(depotDe(process.cwd())) ?? process.cwd());
const depot = depotDe(ROOT);
// Périmètre de `scanHardcode` : celui de `combat-hardcode-guard.test.ts` (`SCAN_DIRS`).
const hardcodeRe = /^src\/(?:engine|state)\//;
const estJsonDeDonnee = (rel) => /^src\/scenes\/.*\.json$/.test(rel) || /^src\/data\/[^/]+\.json$/.test(rel);
/** La baseline nominative, relative à la racine du dépôt qui porte ce hook : lue dans l'INDEX de ROOT
 *  comme le contenu jugé. */
const BASELINE = relative(fileURLToPath(new URL('../..', import.meta.url)), DECISIONS_BASELINE_PATH).split(sep).join('/');

const offenders = [];
/** Avertissements de forme : famille de `FORMES` → lignes. */
const formes = new Map();
const avertir = (famille, ligne) => formes.set(famille, [...(formes.get(famille) ?? []), ligne]);
/** Ce que le commit APPORTE (`ceQuApporteLeCommit`). Une fusion que git ne rejoue pas est un fautif
 *  NOMMÉ, jamais une retombée sur HEAD. */
const apport = (() => {
  try {
    return ceQuApporteLeCommit(depot);
  } catch (e) {
    offenders.push(`apport du commit illisible — ${raisonCourte(e?.message ?? e)}`);
    return null;
  }
})();
const staged = (apport?.chemins('ACMR') ?? []).map((f) => f.replace(/\\/g, '/'));

// Les blobs à juger, en UN lot (`lireEnLot`) ; un lot refusé se relit chemin par chemin pour NOMMER le
// chemin que l'index ne rend pas (`texteAJuger`).
const aLire = [...staged.filter((rel) => estFichierScanne(rel) || estJsonDeDonnee(rel) || rel === 'package-lock.json' || familleDe(rel)), BASELINE];
const lot = (() => {
  try { return lireEnLot(depot, INDEX, aLire); } catch { return null; }
})();
/** Le BLOB DE L'INDEX de `rel`, `null` s'il n'y en a pas ; une lecture refusée est un fautif NOMMÉ. */
function texteAJuger(rel) {
  if (lot) return lot.get(rel) ?? null;
  try {
    return lireEnLot(depot, INDEX, [rel]).get(rel) ?? null;
  } catch (e) {
    offenders.push(`${rel} : illisible dans l'index — ${raisonCourte(e?.message ?? e)}`);
    return null;
  }
}
/** Le diff de l'APPORT (`apport`) ; une panne est un fautif NOMMÉ. */
const diffDeLApport = (() => {
  try {
    return apport?.diff() ?? '';
  } catch (e) {
    offenders.push(`diff du lot illisible — ${raisonCourte(e?.message ?? e)}`);
    return '';
  }
})();

// INTÉGRITÉ — #1679 L1c : le contenu d'un arbre de travail imbriqué n'appartient pas au dépôt hôte.
for (const x of scanArbresImbriques(staged, { racine: ROOT })) offenders.push(x.detail);

// Signaux non bloquants, en OBJETS `{ file, line, detail }` : ils passent par la baseline nominative
// (`decisions-baseline.json`) avant impression, qui les range en NOUVEAU / BASELINE.
const warnings = [];
// Fichiers réellement scannés — périmètre sur lequel la péremption d'une entrée se juge.
const scannedTs = [];

for (const rel of staged) {
  // MÊME périmètre que la suite Vitest et le hook au stylo : `estFichierScanne` (`commentPoison.mjs`).
  if (!estFichierScanne(rel)) continue;
  // Familles de COMMENTAIRES : tests compris (commentPoison.mjs). Familles CODE (hardcode, emoji, seam
  // de jet) : leur périmètre canonique EXCLUT les fichiers de test, qui plantent les FIXTURES de ces
  // gardes (`EXCLUDED` de combat-hardcode-guard.test.ts, roll-seam-exclusivity-guard.test.ts,
  // no-emoji-affordance.test.ts).
  const isTestFile = estFichierVitest(rel);
  const text = texteAJuger(rel);
  if (text === null) continue;
  scannedTs.push(rel);
  for (const x of scanTombstones(rel, text)) avertir('pierre tombale', `${rel}:${x.line} ${x.detail}`);
  for (const x of scanExcuses(rel, text)) avertir('excuse sans tag', `${rel}:${x.line} ${x.detail}`);
  for (const x of scanLegacyVocabHorsStock(rel, text)) avertir("vocabulaire de l'ancien état", `${rel}:${x.line} ${x.detail}`);
  for (const x of scanRawClaims(rel, text))
    warnings.push({ file: rel, line: x.line, detail: `[affirmation RAW non ancrée] ${x.detail}` });
  for (const x of scanDecisionClaims(rel, text))
    warnings.push({ file: rel, line: x.line, detail: `[revendication d'autorité sans trace] ${x.detail}` });
  if (!isTestFile && hardcodeRe.test(rel))
    for (const x of scanHardcode(rel, text)) warnings.push({ file: rel, line: x.line, detail: `[hardcode réactif par-nom] ${x.detail}` });
  if (!isTestFile && /^src\/(ui|state|gameIso)\//.test(rel))
    for (const emoji of emojisIn(text)) avertir("emoji d'affordance", `${rel} ${emoji}`);
  // #274 — whitelist : SOURCE UNIQUE `rollSeamWhitelist.mjs`.
  if (!isTestFile && !rollSeamExcluded(rel))
    for (const x of scanRollSeamExclusivity(rel, text)) avertir('seam de jet contourné', `${rel}:${x.line} ${x.detail}`);
}

// #290 — emoji dans la DONNÉE (`src/scenes/**/*.json` + `src/data/*.json`).
for (const rel of staged.filter(estJsonDeDonnee)) {
  const text = texteAJuger(rel);
  if (text === null) continue;
  for (const emoji of emojisIn(text)) avertir("emoji d'affordance", `${rel} ${emoji}`);
}

// FORME DU STOCK PERMANENT (scripts/guards/memoire-forme.mjs), périmètre `familleDe`.
const parFichier = [];
for (const rel of staged.filter(familleDe)) {
  const texte = texteAJuger(rel);
  if (texte === null) continue;
  const defauts = defautsDeForme(rel, texte);
  if (defauts.length) parFichier.push({ chemin: rel, defauts });
}
const raisonDeForme = raisonDeRefusDeForme(parFichier);
if (raisonDeForme) avertir('forme du stock permanent', raisonDeForme);

// Tag [entériné] NOUVELLEMENT introduit dans le diff stagé : rendu VISIBLE (mot réservé à l'utilisateur).
const addedTags = diffDeLApport.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && /\[entériné[^\]]*\]/i.test(l));
if (addedTags.length) {
  process.stderr.write(`pre-commit — tag(s) [entériné] AJOUTÉ(s) par ce commit (mot réservé à l'utilisateur — vérifier que CHAQUE site a reçu sa validation) :\n${addedTags.map((l) => `  ${l.slice(0, 160)}`).join('\n')}\n`);
}

// INTÉGRITÉ — #528 : package-lock.json amputé des entrées hoistées @emnapi/* par une régénération npm 11.
if (staged.includes('package-lock.json')) {
  const lockText = texteAJuger('package-lock.json');
  if (lockText !== null) {
    for (const x of scanNpmLockHoisted(lockText)) offenders.push(`package-lock.json:${x.line} [lock npm amputé] ${x.detail}`);
  }
}

// INTÉGRITÉ — FINS DE LIGNE DE L'INDEX : un blob stagé porteur de `\r` sur un chemin que
// `.gitattributes` déclare `eol=lf` (scripts/guards/lib/eolStage.mjs).
if (staged.length) {
  try {
    const entrees = paquetsDArgv(staged).flatMap((paquet) => eolsDe(depot, paquet));
    const raison = raisonDeRefusEol(cheminsMalNormalises(entrees));
    if (raison) offenders.push(raison);
  } catch (e) {
    offenders.push(`fins de ligne de l'index — porte en PANNE : ${codeDePanne(e) ?? e.message} (le garde n'a pas tourné)`);
  }
}

// LINT des fichiers stagés, lus dans l'index (scripts/guards/lib/lintStage.mjs).
const lint = lintDeLIndex(ROOT, depot, staged);
for (const d of lint.defauts) avertir('lint', `${d.site} [${d.gravite}] ${d.regle} — ${d.message}`);
if (lint.saut) process.stderr.write(`pre-commit — lint SAUTÉ : ${lint.saut} ; la gate ${FORMES.lint} le rejuge.\n`);

// Canal non bloquant : la baseline nominative sépare le DÉJÀ TRANCHÉ (une ligne par site) de ce qui
// arrive avec ce commit ; une entrée sans site dans les fichiers scannés est signalée pour purge.
const rapport = formatBaselineReport(partitionBaseline(warnings, decisionsBaselineDe(texteAJuger(BASELINE)), scannedTs));
if (rapport.length) {
  process.stderr.write(`pre-commit — signaux de commentaires (non bloquant) :\n${rapport.map((l) => `  ${l}`).join('\n')}\n`);
}
for (const [famille, lignes] of formes) {
  process.stderr.write(`pre-commit — AVERTISSEMENT [${famille}] : corriger avant de pousser, la CI refuse — ${FORMES[famille]}\n${lignes.map((l) => `  ${l}`).join('\n')}\n`);
}
process.stderr.write(`[pre-commit] ${staged.length} fichier(s) stagé(s) — ${((Date.now() - DEBUT_MS) / 1000).toFixed(1)} s\n`);
if (offenders.length) {
  journal.refuser(...offenders);
  process.stderr.write(`pre-commit REFUSÉ — intégrité du dépôt (#2327 A8) :\n${offenders.map((o) => `  ${o}`).join('\n')}\n`);
  process.exit(1);
}
