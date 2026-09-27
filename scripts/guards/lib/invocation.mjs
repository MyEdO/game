// GRAMMAIRE D'INVOCATION des lanceurs du dépôt (#1679 L3) — une seule, partagée :
// `<positionnel> [--<option> <valeur>]* -- <reste…>`. UN consommateur aujourd'hui :
// `scripts/lancer-local.mjs` (`<paquet> [--cwd <dossier>] -- <bin> [args…]`).
//
// Le séparateur est cherché par `indexOf`, jamais à une position fixe : c'est ce qui laisse les
// options s'intercaler entre le positionnel et `--` sans réécrire le découpage à chaque option
// nouvelle. Tout ce qui suit `--` appartient à la commande jouée et n'est JAMAIS interprété ici.

/**
 * Découpe `argv` selon la grammaire. REND `null` — jamais une forme partielle — dès que la forme
 * n'est pas tenue : pas de positionnel, pas de `--`, reste vide, option non déclarée, option sans
 * valeur, option répétée.
 * @param {string[]} argv arguments nus (sans `node` ni le script)
 * @param {{ options?: string[] }} [contrat] noms d'options ACCEPTÉES, tirets compris (`--capture`)
 * @returns {{ positionnel: string, options: Record<string, string>, reste: string[] } | null}
 */
export function separerInvocation(argv, { options = [] } = {}) {
  const coupure = argv.indexOf('--')
  if (coupure < 1) return null
  const [positionnel, ...declarees] = argv.slice(0, coupure)
  const reste = argv.slice(coupure + 1)
  if (!positionnel || !reste.length) return null
  const lues = {}
  for (let i = 0; i < declarees.length; i += 2) {
    const nom = declarees[i]
    const valeur = declarees[i + 1]
    if (!options.includes(nom) || valeur === undefined) return null
    const cle = nom.replace(/^--/, '')
    if (cle in lues) return null
    lues[cle] = valeur
  }
  return { positionnel, options: lues, reste }
}
