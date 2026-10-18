// Les arguments de `scripts/test/perimetre.mjs` (#2400), lus aussi par `scripts/hooks/codeur-gates-guard.mjs` (#2568).

/** Les arguments de la CLI ; lève sur un usage invalide. PURE. */
export function lireArguments(args) {
  const options = { liste: false }
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--reacquerir-memoire') { options.reacquerirMemoire = true; continue }
    if (a === '--liste' || a === '--docs') { options[a.slice(2)] = true; continue }
    const valeur = args[i + 1]
    if (!['--base', '--tete', '--budget'].includes(a) || valeur === undefined || valeur.startsWith('--'))
      throw new Error('usage : test:perimetre -- [--base <ref>] [--tete <ref>] [--liste] [--budget <s>] [--docs] [--reacquerir-memoire]')
    i += 1
    if (a === '--budget') {
      if (!/^\d+$/.test(valeur)) throw new Error(`--budget attend un entier de secondes, reçu « ${valeur} »`)
      options.budget = Number(valeur)
    } else options[a.slice(2)] = valeur
  }
  if (options.tete && !options.base) throw new Error('--tete exige --base')
  return options
}
