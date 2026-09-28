// RÉÉCRITURE TEXTUELLE ANCRÉE d'un document authoré — source unique du geste.
//
// Un `.json` de `src/data` est écrit À LA MAIN : son indentation, l'ordre de ses clés et ses blancs
// sont du travail humain. Le réécrire par `JSON.parse` → `JSON.stringify` rendrait un diff de la
// taille du fichier pour un champ changé. On remplace donc un fragment de TEXTE à SA PLACE, ancré
// sur les octets exacts qu'il porte aujourd'hui sur le disque.
//
// Consommateurs : les migrations `scripts/migrations/2026-09-05-1389-psychology-desc-vers-descref.mjs`
// et `scripts/migrations/2026-09-28-1887-regles-desc-vers-descref.mjs` (`"desc"` → `"descRef"`) et
// `scripts/source/reparer-adresses.mjs` (`"descRef"` recalée). Discipline
// commune : une ancre vue 0 ou 2+ fois n'est PAS remplacée — elle est nommée ; le compte TEXTUEL des
// remplacements se confronte au compte STRUCTUREL des gestes décidés, et rien n'est écrit si les deux
// divergent.

/** Nombre d'occurrences EXACTES de l'ancre dans le texte. @param {string} texte @param {string} ancre @returns {number} */
export function compterAncre(texte, ancre) {
  return texte.split(ancre).length - 1
}

/**
 * Remplace l'ancre — qui doit être UNIQUE — par son remplacement, à sa place exacte.
 *
 * `remplacement` peut être une fonction : elle reçoit l'INDENTATION du site — le BLANC DE TÊTE de la
 * ligne porteuse, et lui seul —, de quoi ré-indenter un objet sérialisé sans re-sérialiser le
 * document. Le blanc de tête, jamais le préfixe entier : sur un document COMPACT l'ancre vit en
 * milieu de ligne (`[ { "id": "x", "descRef": {…} } ]`) et ré-indenter sur `  { "id": "x", ` poserait
 * des accolades dans une chaîne, donc un JSON invalide (mesuré). Rend `{ erreur }` quand l'ancre
 * n'est pas unique — jamais une écriture au jugé.
 * @param {string} texte @param {string} ancre
 * @param {string | ((site: { indentation: string }) => string)} remplacement
 * @returns {{ texte: string, erreur?: undefined } | { texte?: undefined, erreur: string }}
 */
export function remplacerAncre(texte, ancre, remplacement) {
  const vues = compterAncre(texte, ancre)
  if (vues !== 1) {
    return { erreur: `ancre textuelle ${vues === 0 ? 'introuvable' : `vue ${vues} fois`}` }
  }
  const debut = texte.indexOf(ancre)
  const ligne = texte.lastIndexOf('\n', debut) + 1
  const indentation = /^[ \t]*/.exec(texte.slice(ligne, debut))[0]
  const pose = typeof remplacement === 'function' ? remplacement({ indentation }) : remplacement
  return { texte: `${texte.slice(0, debut)}${pose}${texte.slice(debut + ancre.length)}` }
}

/** Valeur sérialisée en JSON, ré-indentée pour être posée à `indentation` du fichier d'accueil.
 *  @param {unknown} valeur @param {string} indentation @returns {string} */
export function jsonIndente(valeur, indentation) {
  return JSON.stringify(valeur, null, 2).split('\n').join(`\n${indentation}`)
}

/**
 * Texte EXACT du couple `"<cle>": <objet>` porté par le disque, pour les nœuds dont l'objet
 * satisfait `correspond`. La valeur n'est jamais re-sérialisée pour être ancrée : elle est TRANCHÉE
 * dans le fichier, accolades comptées HORS chaînes (une accolade dans une prose ne ferme rien).
 * @param {string} texte @param {string} cle @param {(valeur: unknown) => boolean} correspond
 * @returns {string[]} les tranches trouvées, dans l'ordre du fichier
 */
export function ancresDObjet(texte, cle, correspond) {
  const marque = `"${cle}":`
  const out = []
  for (let i = texte.indexOf(marque); i >= 0; i = texte.indexOf(marque, i + marque.length)) {
    const ouverture = texte.indexOf('{', i + marque.length)
    if (ouverture < 0) break
    const fin = finDObjet(texte, ouverture)
    if (fin < 0) continue
    const tranche = texte.slice(i, fin)
    let valeur
    try {
      valeur = JSON.parse(texte.slice(ouverture, fin))
    } catch {
      continue
    }
    if (correspond(valeur)) out.push(tranche)
  }
  return out
}

/** Index juste APRÈS l'accolade fermante de l'objet ouvert en `ouverture`, ou `-1`. */
function finDObjet(texte, ouverture) {
  let profondeur = 0
  let dansChaine = false
  let echappe = false
  for (let k = ouverture; k < texte.length; k += 1) {
    const c = texte[k]
    if (dansChaine) {
      if (echappe) echappe = false
      else if (c === '\\') echappe = true
      else if (c === '"') dansChaine = false
      continue
    }
    if (c === '"') dansChaine = true
    else if (c === '{') profondeur += 1
    else if (c === '}') {
      profondeur -= 1
      if (profondeur === 0) return k + 1
    }
  }
  return -1
}
