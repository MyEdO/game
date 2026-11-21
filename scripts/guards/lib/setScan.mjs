// Mécanique de la lentille « set() bruts des flows » (#321 lentille 3) : recense chaque
// `set({...})` et `set((s) => ({...}))` dans le noyau, hors `stateFields.ts`, source du manifeste.
// Cette mesure alimente le CLI `scripts/data/set-scan.mjs` et la garde `src/noyau/set-scan-guard.test.ts`.
//
// Extraction PURE regex/scan de parenthèses (pas de parseur AST) — suffisant pour un COMPTE, pas
// pour un refactor : les clés imbriquées profondes ne sont pas déroulées, seul le NIVEAU 1 de
// l'objet passé à `set(` est lu.
import { readFileSync } from 'node:fs';
import { estModule } from './importGraph.mjs';
import { listerArbre } from './lister.mjs';
import { estFichierVitest, estKitDeTest } from './fichierVitest.mjs';
import { join, relative } from 'node:path';

/** Clés `pending*`/transitoires du manifeste (`noyau/stateFields.ts`) — lues par REGEX sur le
 *  SOURCE (pas d'import TS, module `.mjs` nu) : `  <key>: { init: ...` en tête de ligne.
 * @param {string} dir dossier qui porte `stateFields.ts` @returns {Set<string>} */
export function stateFieldKeys(dir) {
  const text = readFileSync(join(dir, 'stateFields.ts'), 'utf8');
  const re = /^\s{2}(\w+): \{ init:/gm;
  const keys = new Set();
  let m;
  while ((m = re.exec(text))) keys.add(m[1]);
  return keys;
}

/** Trouve l'objet littéral top-level d'un appel `set(` à partir de l'index de `set(` — supporte
 *  `set({...})` et `set((s) => ({...}))` / `set((s)=>({...}))`. Renvoie le texte entre la 1ʳᵉ `{`
 *  après `set(` et sa `}` correspondante (comptage de profondeur), ou null si mal formé/dynamique
 *  (ex. `set(fn)` sans littéral — hors scope de cette mesure).
 * @param {string} text @param {number} callStart @returns {string | null} */
export function extractSetLiteral(text, callStart) {
  let i = callStart + 'set('.length;
  const arrow = /^\s*\([^)]*\)\s*=>\s*\(?/.exec(text.slice(i, i + 40));
  if (arrow) i += arrow[0].length;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] !== '{') return null;
  let depth = 0;
  const start = i;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/** Clés top-level d'un littéral `{ a: ..., b: ..., ...spread }` — profondeur 1 seulement.
 * @param {string} lit @returns {string[]} */
export function topLevelKeys(lit) {
  const keys = [];
  let depth = 0;
  let i = 1;
  let tokenStart = i;
  const readKey = (from) => {
    const m = /^\s*(\.\.\.)?([A-Za-z0-9_$]+)\s*[,:}]/.exec(lit.slice(from));
    if (!m) return null;
    return m[1] ? `...${m[2]}` : m[2];
  };
  for (; i < lit.length - 1; i++) {
    if (depth === 0 && i === tokenStart) {
      const k = readKey(i);
      if (k) keys.push(k);
    }
    if (lit[i] === '{' || lit[i] === '(' || lit[i] === '[') depth++;
    else if (lit[i] === '}' || lit[i] === ')' || lit[i] === ']') depth--;
    else if (lit[i] === ',' && depth === 0) tokenStart = i + 1;
  }
  return keys;
}

/** @param {string} path @returns {{ line: number, keys: string[] }[]} */
export function scanFile(path) {
  const text = readFileSync(path, 'utf8');
  const results = [];
  const re = /\bset\(/g;
  let m;
  while ((m = re.exec(text))) {
    const lit = extractSetLiteral(text, m.index);
    if (!lit) continue;
    const line = text.slice(0, m.index).split('\n').length;
    results.push({ line, keys: topLevelKeys(lit) });
  }
  return results;
}

/** Recense les écritures du noyau et les remises à zéro de champs d’état hors `resetFields(...)`.
 * @param {string} root racine du dépôt
 * @returns {{ totalCalls: number, totalAdHocResets: number, files: Array<{ file: string, setCalls: number, adHocPendingResets: number, adHocLines: number[] }> }} */
export function runSetScan(root) {
  const noyauDir = join(root, 'src/noyau');
  const pendingKeys = stateFieldKeys(noyauDir);
  const files = listerArbre(noyauDir, {
    filtre: (f) => estModule(f) && !estFichierVitest(f) && !estKitDeTest(f) && f !== 'stateFields.ts',
  });

  const report = [];
  let totalCalls = 0;
  let totalAdHocResets = 0;
  for (const fichier of files) {
    const f = join(noyauDir, fichier);
    const calls = scanFile(f);
    if (!calls.length) continue;
    const rel = relative(root, f).split('\\').join('/');
    let adHoc = 0;
    const adHocLines = [];
    for (const c of calls) {
      const nonSpread = c.keys.filter((k) => !k.startsWith('...'));
      const touchesPending = nonSpread.some((k) => pendingKeys.has(k));
      const usesResetFields = c.keys.some((k) => k.startsWith('...resetFields'));
      if (touchesPending && !usesResetFields) { adHoc++; adHocLines.push(c.line); }
    }
    totalCalls += calls.length;
    totalAdHocResets += adHoc;
    report.push({ file: rel, setCalls: calls.length, adHocPendingResets: adHoc, adHocLines });
  }
  report.sort((a, b) => b.setCalls - a.setCalls);
  return { totalCalls, totalAdHocResets, files: report };
}
