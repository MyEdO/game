import { analyserCorpus, typescript } from './dialecte.mjs';
import { contexteImports, estAppelDeclare } from './canonUnique.mjs';

const DECLARATEURS = { 'src/data/schemas/grammaire/prose.ts': ['proseNommee'] };

export function cheminsProseNommee(fichiers) {
  const ts = typescript();
  const chemins = [];
  for (const { sourceFile, checker, diagnostics } of analyserCorpus(fichiers)) {
    if (!sourceFile) continue;
    if (diagnostics.length) throw new Error(`proseNommee : syntaxe refusée dans ${sourceFile.fileName}`);
    const contexte = contexteImports(sourceFile, checker);
    const visiter = (noeud) => {
      if (ts.isCallExpression(noeud) && estAppelDeclare(noeud, sourceFile, DECLARATEURS, contexte)) {
        const chemin = noeud.arguments[1];
        if (chemin && ts.isStringLiteral(chemin)) chemins.push(chemin.text);
      }
      noeud.forEachChild(visiter);
    };
    visiter(sourceFile);
  }
  return chemins;
}
