import { createRequire } from 'node:module';
import path from 'node:path';
import { syntaxProgram, VIRTUAL_ROOT, libererSessions } from './tsProgram.mjs';

const require = createRequire(import.meta.url);
let compilateur;
export const typescript = () => (compilateur ??= require('typescript/unstable/ast'));
const KIND_DE_SCRIPT = { ts: 'TS', mts: 'TS', cts: 'TS', tsx: 'TSX', js: 'JS', mjs: 'JS', cjs: 'JS', jsx: 'JSX' };
/** Les EXTENSIONS d'un script du dépôt, liste UNIQUE : `fichierVitest.mjs` en compose son motif, `lintStage.mjs`
 *  et `perimetre.mjs` la consomment. */
export const EXTENSIONS_DE_SCRIPT = Object.freeze(Object.keys(KIND_DE_SCRIPT).map((ext) => `.${ext}`));
const DIALECTE = { ...KIND_DE_SCRIPT, json: 'JSON' };

export function scriptKindDe(fichier, { inconnu = 'TS' } = {}) {
  const nom = String(fichier ?? '').replaceAll('\\', '/').split('/').pop() ?? '';
  const ext = nom.includes('.') ? nom.split('.').pop().toLowerCase() : '';
  const dialecte = DIALECTE[ext] ?? (inconnu === 'refus' ? null : inconnu);
  return dialecte === null ? null : typescript().ScriptKind[dialecte];
}

export function* analyserCorpus(fichiers, options = {}) {
  const entrees = Array.from(fichiers, (fichier) => {
    const kind = scriptKindDe(fichier.rel, options);
    const ext = String(fichier.rel).replaceAll('\\', '/').split('.').pop().toLowerCase();
    const rel = String(fichier.rel);
    const virtuel = Object.hasOwn(DIALECTE, ext) ? `${rel.slice(0, rel.length - ext.length)}${ext}` : `${rel}.ts`;
    return { fichier, chemin: path.resolve(virtuel).replaceAll('\\', '/'), kind };
  });
  const chemins = new Map();
  for (const { fichier, chemin, kind } of entrees) {
    if (kind === null) continue;
    if (chemins.has(chemin)) throw new Error(`analyserCorpus : chemins de parse en collision : ${chemins.get(chemin)} et ${fichier.rel} (${chemin})`);
    chemins.set(chemin, fichier.rel);
  }
  const sources = Object.fromEntries(entrees.filter(e => e.kind !== null).map(e => [e.chemin, e.fichier.text]));
  let session;
  const erreurs = [];
  try {
    if (Object.keys(sources).length) session = syntaxProgram(sources);
    for (const { fichier, chemin, kind } of entrees) {
      if (kind === null) { yield { fichier, sourceFile: null, diagnostics: [] }; continue; }
      const nom = path.resolve(VIRTUAL_ROOT, chemin).replaceAll('\\', '/');
      const sourceFile = session.program.getSourceFile(nom);
      if (!sourceFile) throw new Error(`Arbre TypeScript introuvable : ${fichier.rel}`);
      const diagnostics = session.program.getSyntacticDiagnostics(nom).map(d => ({ ...d, fileName: fichier.rel }));
      yield { fichier, sourceFile, diagnostics, checker: session.checker };
    }
  } catch (erreur) { erreurs.push(erreur); }
  finally { libererSessions(session ? [session] : [], erreurs); }
}

export function avecAnalyse(fichier, sourceFile, checker, fn) {
  if (sourceFile) return fn(sourceFile, checker);
  for (const analyse of analyserCorpus([fichier])) if (analyse.sourceFile) return fn(analyse.sourceFile, analyse.checker);
  throw new Error(`avecAnalyse : aucun arbre TypeScript pour ${fichier.rel}`);
}

export function analyserTexte(fichier, options) {
  for (const { sourceFile, diagnostics } of analyserCorpus([fichier], options)) return { fichier, sourceFile, diagnostics };
}

export function ast(fichier, options) {
  return analyserTexte(fichier, options).sourceFile;
}

/** La déclaration de PREMIER NIVEAU qui porte la ligne `ligne` (1-based) : le nom de la fonction, de la
 *  classe, de l'interface, de l'alias de type, de l'`enum`, de l'espace de noms, ou du DÉCLARATEUR de
 *  variable qui contient la ligne (`const a = 1, b = …` : `b` sur la ligne de `b`) ; `default` pour
 *  une fonction ou une classe `export default` anonyme et pour `export default <expression>` ; `''`
 *  hors de toute déclaration nommée (déstructuration comprise). Clé d'un SITE d'exemption, stable à
 *  toute édition en amont (#2200) : une table qui la lit REFUSE la clé vide, qui vaudrait clé de fichier.
 *  @param {import('typescript/unstable/ast').SourceFile} sf @param {number} ligne @returns {string} */
export function declarationQuiPorte(sf, ligne) {
  const ts = typescript();
  const ligneDe = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const porte = (n) => ligne >= ligneDe(n.getStart(sf)) && ligne <= ligneDe(n.getEnd());
  for (const st of sf.statements) {
    if (!porte(st)) continue;
    if (ts.isVariableStatement(st)) {
      const { declarations } = st.declarationList;
      const d = declarations.find(porte) ?? declarations[0];
      return ts.isIdentifier(d.name) ? d.name.text : '';
    }
    if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) {
      if (st.name) return st.name.text;
      return st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ? 'default' : '';
    }
    if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st) || ts.isModuleDeclaration(st)) return st.name.text;
    if (ts.isExportAssignment(st)) return 'default';
    return '';
  }
  return '';
}
