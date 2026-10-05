import { createRequire } from 'node:module';
import path from 'node:path';
import { syntaxProgram, VIRTUAL_ROOT, libererSessions } from './tsProgram.mjs';

const require = createRequire(import.meta.url);
let compilateur;
export const typescript = () => (compilateur ??= require('typescript/unstable/ast'));
const DIALECTE = { ts: 'TS', mts: 'TS', cts: 'TS', tsx: 'TSX', js: 'JS', mjs: 'JS', cjs: 'JS', jsx: 'JSX', json: 'JSON' };

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
    return { fichier, chemin: path.resolve(`${fichier.rel}${Object.hasOwn(DIALECTE, ext) ? '' : '.ts'}`).replaceAll('\\', '/'), kind };
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
      yield { fichier, sourceFile, diagnostics };
    }
  } catch (erreur) { erreurs.push(erreur); }
  finally { libererSessions(session ? [session] : [], erreurs); }
}

export function analyserTexte(fichier, options) {
  for (const analyse of analyserCorpus([fichier], options)) return analyse;
}

export function ast(fichier, options) {
  return analyserTexte(fichier, options).sourceFile;
}
