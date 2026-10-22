// LE GDSCRIPT SANS RÈGLE (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md`, B3 et M-e) — un script de
// l'hôte Godot lit la vue du noyau et ne calcule aucune règle. Module ESM pur, sans état ni lecture disque ; la lecture
// lexicale est celle de `gdscript.mjs`.
//
// CONTRAT : `calculsDeRegle` cherche dans le code seul (`lexemesGdscript`) chaque forme qu'un calcul de règle prend en
// GDScript, jamais le nom d'une fonction du prototype :
//   `hasard` : un identifiant de l'API de hasard du moteur Godot (`randi`, `randomize`, `RandomNumberGenerator`,
//              `pick_random`, `rand_from_seed`, `shuffle`…), `seed` et `hash` ;
//   `chemin` : les classes de recherche de chemin du moteur (`AStar…`, `Navigation…`) ;
//   `calcul` : toute arithmétique binaire (`+ - * / % ** << >>` et leurs affectations composées), hormis le `+` et le
//              `%` d'un littéral de chaîne (concaténation, mise en forme) ; le moins unaire passe ; et `Expression`, qui
//              évalue un calcul écrit en chaîne ;
//   `ordre`  : toute comparaison d'ordre (`< > <= >=`) ;
//   `mesure` : tout appel d'une fonction de mesure (`MESURES` : valeur absolue, bornes, arrondis, distances, normes…).
// `calcul`, `ordre` et `mesure` sont permis dans le seul module de mise en page (`estMiseEnPage`), reconnu par sa
// STRUCTURE et jamais par son nom : au niveau du script, rien que `class_name`, `extends`, des `const` et des
// `static func` typées, chacune rendant un réel ou un vecteur et prenant des entiers, des réels et au plus un vecteur ;
// `derive-du-noyau.hors-store.test.ts` en exige un seul.
// ANGLES MORTS, que la recette et le juge voient et que la garde ne voit pas : une seconde position passée au module de
// mise en page en scalaires (`ecart(a, bx, by)`), et la géométrie des rectangles (`Rect2i.grow`, `has_point`), que
// l'écran emploie aussi pour savoir ce qu'un défilement cache.

import { lexemesGdscript } from './gdscript.mjs'

/** Les fonctions de mesure du moteur Godot, appelées nues ou en méthode. */
const MESURES = new Set([
  'abs', 'absi', 'absf', 'sign', 'signi', 'signf', 'clamp', 'clampi', 'clampf', 'min', 'mini', 'minf', 'max', 'maxi', 'maxf',
  'floor', 'floori', 'floorf', 'ceil', 'ceili', 'ceilf', 'round', 'roundi', 'roundf', 'snapped', 'snappedi', 'snappedf',
  'sqrt', 'pow', 'posmod', 'fposmod', 'fmod', 'wrap', 'wrapi', 'wrapf', 'lerp', 'lerpf', 'remap', 'distance_to',
  'distance_squared_to', 'length', 'length_squared', 'dot', 'cross', 'angle_to', 'direction_to', 'move_toward',
])
/** Les mots-clés après lesquels un opérateur est unaire : aucun n'achève une valeur. */
const PREFIXES = new Set([
  'if', 'elif', 'else', 'for', 'while', 'match', 'when', 'return', 'and', 'or', 'not', 'in', 'is', 'as', 'var', 'const',
  'func', 'static', 'extends', 'class_name', 'signal', 'await', 'enum', 'pass', 'break', 'continue',
])
const ARITHMETIQUE = new Set(['+', '-', '*', '/', '%', '**', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>='])
const DE_CHAINE = new Set(['+', '%', '+=', '%='])
const ORDRE = new Set(['<', '>', '<=', '>='])
const JETON = /("""[^"]*"""|'''[^']*'''|"[^"\n]*"|'[^'\n]*')|(0x[\da-fA-F_]+|0b[01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)|([A-Za-z_]\w*)|(\*\*=|<<=|>>=|\*\*|<<|>>|<=|>=|==|!=|->|:=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|&&|\|\||[-+*/%<>=!&|^~(){}[\],.:;@$])/g
const RETOUR = String.raw`(?:float|Vector2i?|Vector3i?)`
const PARAMETRE = /^\s*\w+\s*:\s*(int|float|Vector2i?|Vector3i?)\s*$/
const FONCTION = new RegExp(String.raw`^static func \w+\(([^)]*)\)\s*->\s*${RETOUR}\s*:\s*$`)
const NIVEAU_DU_SCRIPT = /^(?:class_name \w+|extends \w+|const \w+\s*(?::\s*\w+\s*)?:?=.*)\s*$/

/**
 * Le script est-il le module de mise en page : au niveau du script, rien que `class_name`, `extends`, des `const` et des
 * `static func` typées (un réel ou un vecteur rendu ; des entiers, des réels et au plus un vecteur en paramètres), dont
 * une au moins ?
 * @param {string} src
 * @returns {boolean}
 */
export function estMiseEnPage(src) {
  let fonctions = 0
  for (const ligne of lexemesGdscript(src).code.split('\n')) {
    if (!ligne.trim() || /^\s/.test(ligne)) continue
    const f = FONCTION.exec(ligne)
    if (f) {
      const types = f[1].trim() ? f[1].split(',').map((p) => PARAMETRE.exec(p)?.[1]) : []
      if (types.some((t) => !t) || types.filter((t) => t.startsWith('Vector')).length > 1) return false
      fonctions++
    } else if (!NIVEAU_DU_SCRIPT.test(ligne)) return false
  }
  return fonctions > 0
}

/**
 * Les calculs de règle d'un script GDScript, chacun avec sa famille, sa ligne et son extrait.
 * @param {string} src
 * @returns {{ famille: 'hasard' | 'chemin' | 'calcul' | 'ordre' | 'mesure', ligne: number, extrait: string }[]}
 */
export function calculsDeRegle(src) {
  const code = lexemesGdscript(src).code.replace(/\$[\w/]+/g, (m) => '_'.repeat(m.length))
  const miseEnPage = estMiseEnPage(src)
  const jetons = [...code.matchAll(JETON)].map((m) => ({ texte: m[0], index: m.index, chaine: !!m[1], valeur: !!(m[1] || m[2]), mot: !!m[3] }))
  const finitUneValeur = (j) => !!j && (j.valeur || (j.mot && !PREFIXES.has(j.texte)) || [')', ']', '}'].includes(j.texte))
  const ligneDe = (index) => code.slice(0, index).split('\n').length
  const trouves = []
  jetons.forEach((j, k) => {
    const avant = jetons[k - 1]
    const apres = jetons[k + 1]
    const famille = j.mot && (/(?:^|_)rand|shuffl/i.test(j.texte) || j.texte === 'seed' || j.texte === 'hash') ? 'hasard'
      : j.mot && /^(?:AStar|Navigation)/.test(j.texte) ? 'chemin'
        : j.mot && j.texte === 'Expression' ? 'calcul'
          : miseEnPage ? null
            : j.mot && MESURES.has(j.texte) && apres?.texte === '(' ? 'mesure'
              : ORDRE.has(j.texte) && finitUneValeur(avant) ? 'ordre'
                : ARITHMETIQUE.has(j.texte) && finitUneValeur(avant) && !(DE_CHAINE.has(j.texte) && (avant.chaine || apres?.chaine)) ? 'calcul'
                  : null
    if (famille) trouves.push({ famille, ligne: ligneDe(j.index), extrait: code.slice(avant?.index ?? j.index, (apres?.index ?? j.index) + (apres?.texte.length ?? j.texte.length)).replace(/\s+/g, ' ') })
  })
  return trouves
}
