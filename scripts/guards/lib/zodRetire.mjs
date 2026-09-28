// API RETIRÉE de zod (#1473 R1, décision 8) — les noms que `zod` étiquette comme retirés (balise JSDoc
// de retrait, `node_modules/zod/v4/classic/compat.d.ts:10`) dans sa couche de compatibilité se LISENT
// dans cette déclaration, jamais dans une liste tenue ici. Consommateur : `src/zod-retire-guard.test.ts`.
// Module ESM pur.

/**
 * Noms EXPORTÉS que la déclaration étiquette par la balise JSDoc de retrait : alias `x as Nom`, ou
 * `export [declare] const|function|enum|type Nom`.
 * @param {string} declaration texte de `compat.d.ts`
 * @returns {string[]}
 */
export function apisRetirees(declaration) {
  const noms = [];
  for (const m of declaration.matchAll(/\/\*\*\s*@deprecated[\s\S]*?\*\/\s*(?:([\w$]+)\s+as\s+(\w+)|export\s+(?:declare\s+)?(?:const|function|enum|type)\s+(\w+))/g))
    noms.push(m[2] ?? m[3]);
  return noms;
}

/** Le code d'une source, commentaires retirés (une `//` précédée de `:` est une URL, gardée).
 * @param {string} source @returns {string} */
const sansCommentaires = (source) => source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Sites d'une API retirée : accès `z.Nom`, ou import nommé `Nom` depuis `zod`.
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @param {readonly string[]} noms
 * @returns {string[]} `chemin:ligne Nom`
 */
export function usagesRetirees(fichiers, noms) {
  if (noms.length === 0) return [];
  const alternance = noms.join('|');
  const acces = new RegExp(`\\bz\\.(${alternance})\\b`, 'g');
  const importe = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*['"]zod['"]`, 'g');
  const nomme = new RegExp(`(?:^|[\\s,{])(?:type\\s+)?(${alternance})\\b`, 'g');
  const sites = [];
  for (const { rel, text } of fichiers) {
    const code = sansCommentaires(text);
    const ligneDe = (i) => code.slice(0, i).split('\n').length;
    for (const m of code.matchAll(acces)) sites.push(`${rel}:${ligneDe(m.index)} ${m[1]}`);
    for (const m of code.matchAll(importe))
      for (const n of m[1].matchAll(nomme)) sites.push(`${rel}:${ligneDe(m.index)} ${n[1]}`);
  }
  return sites;
}
