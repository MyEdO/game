// LE DIALECTE GDSCRIPT (#2928) — la lecture lexicale d'un script de l'hôte Godot (`hotes/godot/projet/`), pour les
// gardes qui le lisent : le CODE seul, ses CHAÎNES et ses COMMENTAIRES. Module ESM pur, exécutable par `node` nu, sans
// état ni lecture disque : le pendant GDScript de `codeSeul.mjs` (dialecte JavaScript), même contrat de blanchiment.
//
// CONTRAT :
//  - `code` : la source, commentaires `#` et contenu des chaînes blanchis en espaces, délimiteurs gardés, lignes et
//    colonnes préservées. Toutes les formes de chaîne : `"…"`, `'…'`, triples, préfixes `&` (StringName), `^`
//    (NodePath), `r` (brute, sans échappement).
//  - `chaines` : le texte de chaque chaîne et sa ligne.
//  - `commentaires` : la forme `Comment` de `commentPoison.mjs` (`text`, délimiteurs compris, `line`, `start`, `end`),
//    les commentaires de lignes adjacentes fusionnés en un, leurs marqueurs `#` de continuation blanchis : la garde du
//    poison de commentaire les lit comme ceux du TypeScript.

/**
 * La lecture lexicale d'un script GDScript.
 * @param {string} src
 * @returns {{ code: string, chaines: { texte: string, ligne: number }[], commentaires: { text: string, line: number, start: number, end: number }[] }}
 */
export function lexemesGdscript(src) {
  const code = src.split('')
  const chaines = []
  const bruts = []
  let ligne = 1
  let i = 0
  const blanchir = (de, a) => { for (let k = de; k < a; k++) if (code[k] !== '\n') code[k] = ' ' }
  while (i < src.length) {
    const c = src[i]
    if (c === '\n') { ligne++; i++; continue }
    if (c === '#') {
      const fin = src.indexOf('\n', i)
      const a = fin < 0 ? src.length : fin
      bruts.push({ text: src.slice(i, a), line: ligne, start: i, end: a })
      blanchir(i, a)
      i = a
      continue
    }
    if (c !== '"' && c !== "'") { i++; continue }
    const brute = src[i - 1] === 'r' && !/\w/.test(src[i - 2] ?? '')
    const delim = src.startsWith(c.repeat(3), i) ? c.repeat(3) : c
    const debut = i + delim.length
    let j = debut
    while (j < src.length && !src.startsWith(delim, j) && (delim.length === 3 || src[j] !== '\n')) j += !brute && src[j] === '\\' ? 2 : 1
    chaines.push({ texte: src.slice(debut, j), ligne })
    blanchir(debut, j)
    ligne += src.slice(debut, j).split('\n').length - 1
    i = j + delim.length
  }
  const commentaires = []
  for (const b of bruts) {
    const dernier = commentaires.at(-1)
    if (dernier && dernier.line + dernier.text.split('\n').length === b.line) {
      dernier.text += `\n${b.text.replace(/^#+/, (m) => ' '.repeat(m.length))}`
      dernier.end = b.end
    } else commentaires.push({ ...b })
  }
  return { code: code.join(''), chaines, commentaires }
}
