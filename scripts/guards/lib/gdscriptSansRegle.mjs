// LE GDSCRIPT SANS RÈGLE (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md`, B3 et M-e) — un script de
// l'hôte Godot lit la vue du noyau et ne calcule aucune règle : ni dé, ni chemin, ni mesure entre cases. Module ESM
// pur, sans état ni lecture disque, même patron que `codeSeul.mjs`, pour le dialecte GDScript.
//
// CONTRAT :
//  - `lexemesGdscript` rend le CODE (commentaires `#` et contenu des chaînes blanchis en espaces, lignes et colonnes
//    préservées) et les CHAÎNES (texte et ligne), toutes formes : `"…"`, `'…'`, triples, préfixes `&`, `^`, `r`.
//  - `calculsDeRegle` cherche dans le code seul les trois familles que le principe interdit à un hôte, chacune par la
//    FORME qu'elle prend en GDScript, jamais par le nom d'une fonction du prototype :
//      `hasard` : l'API de hasard du moteur Godot, dont chaque nom commence par `rand` ou `Random`, et `seed` ;
//      `chemin` : les classes de recherche de chemin du moteur (`AStar…`, `Navigation…`) ;
//      `mesure` : une distance (`distance_to`, `distance_squared_to`), une différence ou une somme de deux
//                 coordonnées (`.x`, `.y`, `.z`, `[0]`…`[2]`), une coordonnée décalée d'un entier (une case voisine).
//    Une coordonnée décalée d'un réel (`case.x + 0.5`, le centre d'une case) est de la mise en scène, pas une mesure.

/** Une coordonnée lue : un axe (`.x`, `.y`, `.z`) ou un indice d'axe (`[0]`, `[1]`, `[2]`), en fin d'opérande. */
const COORDONNEE = String.raw`(?:\.[xyz]|\[[0-2]\])`;
/** L'opérande qui suit un `+` ou un `-` : un chemin d'accès, appels sans argument compris. */
const OPERANDE = String.raw`[A-Za-z_][\w.]*(?:\(\))?(?:\.\w+|\[\d+\])*|\d+(?:\.\d*)?`;
const DECALAGE = new RegExp(String.raw`${COORDONNEE}\s*[-+]=?\s*(${OPERANDE})`, 'g');
const EST_COORDONNEE = new RegExp(String.raw`${COORDONNEE}$`);
const MOT = /[A-Za-z_]\w*/g;
const DISTANCE = /\.distance(?:_squared)?_to\s*\(/g;

/**
 * Le code d'un script GDScript, commentaires et contenu des chaînes blanchis, et ses chaînes.
 * @param {string} src
 * @returns {{ code: string, chaines: { texte: string, ligne: number }[] }}
 */
export function lexemesGdscript(src) {
  const code = src.split('')
  const chaines = []
  let ligne = 1
  let i = 0
  const blanchir = (de, a) => { for (let k = de; k < a; k++) if (code[k] !== '\n') code[k] = ' ' }
  while (i < src.length) {
    const c = src[i]
    if (c === '\n') { ligne++; i++; continue }
    if (c === '#') {
      const fin = src.indexOf('\n', i)
      const a = fin < 0 ? src.length : fin
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
  return { code: code.join(''), chaines }
}

/**
 * Les calculs de règle d'un script GDScript, chacun avec sa famille, sa ligne et son extrait.
 * @param {string} src
 * @returns {{ famille: 'hasard' | 'chemin' | 'mesure', ligne: number, extrait: string }[]}
 */
export function calculsDeRegle(src) {
  const { code } = lexemesGdscript(src)
  const ligneDe = (index) => code.slice(0, index).split('\n').length
  const trouves = []
  for (const m of code.matchAll(MOT)) {
    const famille = /^(?:rand|Random)|^seed$/.test(m[0]) ? 'hasard' : /^(?:AStar|Navigation)/.test(m[0]) ? 'chemin' : null
    if (famille) trouves.push({ famille, ligne: ligneDe(m.index), extrait: m[0] })
  }
  for (const m of code.matchAll(DISTANCE)) trouves.push({ famille: 'mesure', ligne: ligneDe(m.index), extrait: m[0] })
  for (const m of code.matchAll(DECALAGE)) {
    const operande = m[1]
    if (EST_COORDONNEE.test(operande) || /^\d+$/.test(operande)) trouves.push({ famille: 'mesure', ligne: ligneDe(m.index), extrait: m[0] })
  }
  return trouves.sort((a, b) => a.ligne - b.ligne)
}
