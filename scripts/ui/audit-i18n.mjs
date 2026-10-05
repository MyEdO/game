#!/usr/bin/env node
import { analyserCorpus } from '../guards/lib/dialecte.mjs';
// Audit EXHAUSTIF (AST, pas grep à l'oeil) des chaines FR affichees en dur dans l'UI, hors
// catalogue i18n (`src/i18n/`). Etape 1 du ticket #320 (2e chasse aux dettes, lot L6) — MESURE
// seule, aucune migration. Scanne `src/ui/**/*.tsx?` + `src/state/**/*.ts(x)` (messages composes
// hors catalogue), en excluant les fichiers de test (`*.test.ts(x)`).
//
// Classification (heuristique documentee, pas un contrat) :
//   - AFFICHE (compte) : litteral contenant un caractere accentue FR, OU un espace interne, OU un
//     seul mot capitalise plausible (`Terminer`, `Continuer`...). Exclu si : chemin d'import/export,
//     position de type (`LiteralTypeNode`), CLE d'une propriete/enum, sous-arbre d'un attribut JSX
//     technique (`className`/`class`/`style`), ou 1er argument (la cle) d'un appel `t(...)`.
//   - CATALOGUE (compte a part) : appels `t(...)` (reference une cle du catalogue i18n).
// Les doublons EXACTS (meme contenu, tous fichiers confondus) sont detectes separement — l'effort
// de migration estime = nombre de chaines UNIQUES apres dedoublonnage, pas le total brut.
//
// Usage : node scripts/ui/audit-i18n.mjs [--json] [--out <path>]
import * as ts from 'typescript/unstable/ast';
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIRS = ['src/ui', 'src/state'];

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e) && !estFichierVitest(e) && !/\.stories\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).sort();

// Attributs JSX "techniques" — jamais du texte affiché à l'utilisateur, exclus du scan.
const TECH_JSX_ATTRS = new Set([
  'className', 'class', 'style', 'id', 'key', 'htmlFor', 'type', 'name', 'rel', 'target', 'method',
  'action', 'role', 'variant', 'size', 'kind', 'as', 'to', 'href', 'src', 'xmlns', 'viewBox', 'd',
  'fill', 'stroke', 'strokeWidth', 'transform', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1',
  'y1', 'x2', 'y2', 'width', 'height', 'preserveAspectRatio', 'clipPath', 'gradientUnits', 'offset',
  'stopColor', 'data-testid', 'autoComplete',
]);

const FRENCH_ACCENT_RE = /[À-ÿ]/;
const CAPITALIZED_WORD_RE = /^[A-Z][a-zàâäéèêëïîôöùûüçœ]{2,}$/;
// Attributs SVG/HTML sérialisés en dur (`fill="none" stroke="currentColor" ...`, defs d'icônes) —
// contiennent des espaces mais sont 100% techniques, jamais du texte affiché.
const SVG_ATTR_SERIALIZATION_RE = /^([\w-]+="[^"]*"\s*)+$/;

function isDisplayText(content) {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (SVG_ATTR_SERIALIZATION_RE.test(trimmed)) return false;
  if (FRENCH_ACCENT_RE.test(trimmed)) return true;
  if (/\s/.test(trimmed)) return true;
  if (CAPITALIZED_WORD_RE.test(trimmed)) return true;
  return false;
}

/** Concatène les segments littéraux d'un template (ignore les `${expr}`), pour juger le CONTENU. */
function templateLiteralText(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text;
    for (const span of node.templateSpans) s += span.literal.text;
    return s;
  }
  return '';
}

/** true si `node` est la CLÉ (pas la valeur) d'une propriété/enum — jamais du texte affiché. */
function isPropertyKeyPosition(node) {
  const p = node.parent;
  if (!p) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignatureDeclaration(p) || ts.isEnumMember(p)) && p.name === node) return true;
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) return true;
  return false;
}

function isTypePosition(node) {
  return !!node.parent && ts.isLiteralTypeNode(node.parent);
}

function isModuleSpecifierPosition(node) {
  const p = node.parent;
  return !!p && (
    (ts.isImportDeclaration(p) && p.moduleSpecifier === node) ||
    (ts.isExportDeclaration(p) && p.moduleSpecifier === node)
  );
}

const results = []; // { file, rel, count, entries: [{ text, line }] }
const globalOccurrences = new Map(); // text -> [{ file, line }]
let catalogRefs = 0;
const catalogRefsPerFile = new Map();

for (const { fichier: { rel: file }, sourceFile: sf } of analyserCorpus(files.map((file) => ({ rel: file, text: readFileSync(file, 'utf8') })))) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');

  const entries = [];
  let fileCatalogRefs = 0;

  function lineOf(node) {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  }

  function visit(node, suppressed) {
    // Appel t(...) : compte comme référence catalogue, SAUTE le 1er argument (la clé).
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      fileCatalogRefs++;
      node.arguments.forEach((arg, i) => { if (i > 0) visit(arg, suppressed); });
      return;
    }

    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sf);
      const sub = suppressed || TECH_JSX_ATTRS.has(attrName);
      if (node.initializer) visit(node.initializer, sub);
      return;
    }

    if (!suppressed && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))) {
      if (!isPropertyKeyPosition(node) && !isTypePosition(node) && !isModuleSpecifierPosition(node)) {
        const content = ts.isStringLiteral(node) ? node.text : templateLiteralText(node);
        if (isDisplayText(content)) {
          const line = lineOf(node);
          entries.push({ text: content, line });
          if (!globalOccurrences.has(content)) globalOccurrences.set(content, []);
          globalOccurrences.get(content).push({ file: rel, line });
        }
      }
    }

    node.forEachChild((child) => visit(child, suppressed));
  }

  visit(sf, false);

  catalogRefs += fileCatalogRefs;
  if (fileCatalogRefs) catalogRefsPerFile.set(rel, fileCatalogRefs);
  if (entries.length) results.push({ file: rel, count: entries.length, entries });
}

results.sort((a, b) => b.count - a.count);

const totalDisplayed = results.reduce((s, r) => s + r.count, 0);
const uniqueTexts = globalOccurrences.size;
const duplicateOccurrences = totalDisplayed - uniqueTexts;
const duplicateGroups = [...globalOccurrences.entries()].filter(([, locs]) => locs.length > 1);
duplicateGroups.sort((a, b) => b[1].length - a[1].length);

const top15 = results.slice(0, 15);
const pctHardcoded = totalDisplayed + catalogRefs > 0
  ? Math.round((totalDisplayed / (totalDisplayed + catalogRefs)) * 1000) / 10
  : 0;

const report = {
  scannedFiles: files.length,
  filesWithDisplayedStrings: results.length,
  totalDisplayedOccurrences: totalDisplayed,
  uniqueDisplayedStrings: uniqueTexts,
  duplicateOccurrences,
  duplicateGroups: duplicateGroups.length,
  catalogRefs,
  pctHardcodedVsTotal: pctHardcoded,
  estimatedMigrationKeys: uniqueTexts,
  top15: top15.map((r) => ({ file: r.file, count: r.count })),
  topDuplicates: duplicateGroups.slice(0, 15).map(([textVal, locs]) => ({
    text: textVal, occurrences: locs.length, sample: locs.slice(0, 3),
  })),
};

const jsonOut = process.argv.includes('--json');
const outArgIdx = process.argv.indexOf('--out');
const outPath = outArgIdx >= 0 ? process.argv[outArgIdx + 1] : null;

if (jsonOut || outPath) {
  const json = JSON.stringify({ ...report, allFiles: results.map(({ file, count }) => ({ file, count })) }, null, 2);
  if (outPath) writeFileSync(join(ROOT, outPath), json, 'utf8');
  if (jsonOut) process.stdout.write(json + '\n');
}

if (!jsonOut) {
  console.log(`Fichiers scannés (src/ui + src/state, hors *.test.*) : ${report.scannedFiles}`);
  console.log(`Fichiers avec ≥1 chaîne affichée hors catalogue      : ${report.filesWithDisplayedStrings}`);
  console.log(`Occurrences totales de chaînes affichées en dur       : ${report.totalDisplayedOccurrences}`);
  console.log(`  dont chaînes UNIQUES (après dédoublonnage)          : ${report.uniqueDisplayedStrings}`);
  console.log(`  dont occurrences DUPLIQUÉES (même texte, ≥2×)       : ${report.duplicateOccurrences} (${report.duplicateGroups} groupes)`);
  console.log(`Références au catalogue (\`t(...)\`)                    : ${report.catalogRefs}`);
  console.log(`% chaînes en dur vs total (dur + catalogue)           : ${report.pctHardcodedVsTotal}%`);
  console.log(`Estimation clés à créer (dédoublonné)                 : ${report.estimatedMigrationKeys}`);
  console.log('\nTop 15 fichiers les plus denses :');
  const w = (s, n) => String(s).padEnd(n);
  for (const r of top15) console.log(`  ${w(r.file, 45)} ${r.count}`);
  console.log('\nTop doublons exacts (texte × occurrences) :');
  for (const [textVal, locs] of duplicateGroups.slice(0, 15)) {
    console.log(`  ×${locs.length}  "${coupeAuMot(textVal, 60)}"`);
  }
}
