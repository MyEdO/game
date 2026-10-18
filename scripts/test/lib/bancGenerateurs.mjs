const REF = /`((?:src|scripts|server|docs)\/[\w./@-]+):(\d+)`/g
const JETON = /`([^`]+)`/g
const IDENT = /^[A-Za-z_$][\w$]*$/
/** Demi-largeur de la fenêtre autour du site cité, en lignes. */
const DEMI_FENETRE = 2
/**
 * Les fautes de citation d'un doc rendu : `lire(chemin)` rend le texte du fichier cité, ou `null`.
 * Une ligne sans identifiant backtiqué ne juge que l'existence du site. PURE.
 */
function fautesDeCitations(doc, texte, lire) {
  const fautes = []
  texte.split('\n').forEach((ligne, i) => {
    const refs = [...ligne.matchAll(REF)]
    if (!refs.length) return
    const candidats = [...ligne.matchAll(JETON)].map((m) => m[1]).filter((j) => IDENT.test(j))
    for (const [, cible, numTexte] of refs) {
      const num = Number(numTexte)
      const source = lire(cible)
      if (source === null) {
        fautes.push(`${doc}:${i + 1} — cite \`${cible}:${num}\`, absent du disque`)
        continue
      }
      const src = source.split('\n')
      if (num < 1 || num > src.length) {
        fautes.push(`${doc}:${i + 1} — cite \`${cible}:${num}\`, hors des ${src.length} lignes du fichier`)
        continue
      }
      if (!candidats.length) continue
      const fenetre = src.slice(Math.max(0, num - 1 - DEMI_FENETRE), num + DEMI_FENETRE).join('\n')
      if (!candidats.some((c) => fenetre.includes(c)))
        fautes.push(`${doc}:${i + 1} — \`${cible}:${num}\` ne porte aucun de ${candidats.map((c) => `\`${c}\``).join(', ')} à ±${DEMI_FENETRE} lignes`)
    }
  })
  return fautes
}

/** Les ÉCARTS entre le rendu de `script` sur l'hôte et sous win32 (cible → texte, chacun) : une cible
 *  d'un seul côté, ou un corps différent. PUR. */
function ecartsDeRendu(script, hote, win32) {
  const ecarts = []
  for (const cible of new Set([...hote.keys(), ...win32.keys()])) {
    if (!hote.has(cible)) ecarts.push(`${script} : « ${cible} » rendue sous win32 seulement`)
    else if (!win32.has(cible)) ecarts.push(`${script} : « ${cible} » rendue sur l’hôte seulement`)
    else if (hote.get(cible) !== win32.get(cible)) ecarts.push(`${script} : « ${cible} » — le corps dépend de la plateforme`)
  }
  return ecarts
}

export { ecartsDeRendu, fautesDeCitations }
