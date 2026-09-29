import { readFileSync, writeFileSync } from 'node:fs'
const f = '/home/user/game/scripts/guards/lib/gitPorte.mjs'
let s = readFileSync(f, 'utf8')
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`occurrences ${n} : ${a.slice(0, 60)}`); s = s.replace(a, () => b) }
rep(`// L'unique LECTURE D'ÉTAT hors commande git — \`MERGE_HEAD\` (\`fusionnesEnCours\`) — passe par
// \`tenter\` et \`confier\` : mêmes trois issues.
`, `// Le DISQUE, l'hôte le lit par \`natureDuChemin\` (\`statSync\`), et par elle ses deux lectures d'ÉTAT
// GIT hors commande git — la fusion en cours (\`MERGE_HEAD\`, \`fusionnesEnCours\`, \`readFileSync\`) et
// le rebase entamé (\`rebaseEntame\`) — qui passent par \`tenter\` et \`confier\` : mêmes trois issues.
`)
rep(`/**
 * Les commits que la FUSION EN COURS fusionne dans HEAD (\`MERGE_HEAD\`, une ligne par commit : écrite
 * \`builtin/merge.c:1044-1046\`, lue \`builtin/commit.c:1773-1778\` par \`get_merge_parent\`, \`commit.c:1700\`,
 * git v2.43.0), vide hors fusion. Avec HEAD, ce sont les PARENTS du commit à venir. Un fichier
 * illisible, ou une ligne qui ne nomme aucun commit (\`builtin/commit.c:1778\`), va à \`confier\` : \`[]\`
 * sous \`enPanne\`.
 * @param {Depot} depot @returns {string[]}
 */
export function fusionnesEnCours(depot) {
  const chemin = cheminGit(depot, 'MERGE_HEAD')
  if (!chemin) return []
  const complet = resolve(depot.cwd, chemin)
  const lu = tenter(() => (natureDuChemin(complet) === 'absent' ? '' : readFileSync(complet, 'utf8')))
  if (!lu.disponible) return confier(depot, \`MERGE_HEAD illisible : \${lu.raison}\`) ?? []
  const lignes = lu.valeur.split('\\n')
  if (lignes.at(-1) === '') lignes.pop()
  const shas = []
  for (const ligne of lignes) {
    const sha = revisionFautive(ligne) ? null : shaDe(depot, ligne)
    if (!sha) return confier(depot, \`dépôt corrompu : MERGE_HEAD, « \${ligne} » ne nomme aucun commit\`) ?? []
    shas.push(sha)
  }
  return shas
}
`, `/**
 * Les commits que la FUSION EN COURS fusionne dans HEAD (\`MERGE_HEAD\`, une ligne par commit : écrite
 * \`builtin/merge.c:1044-1046\`, lue \`builtin/commit.c:1773-1778\` par \`get_merge_parent\`, \`commit.c:1700\`,
 * git v2.43.0), vide hors fusion. Avec HEAD, ce sont les PARENTS du commit à venir. Les lignes sont
 * résolues en UN \`cat-file --batch-check\` (\`<ligne>^{commit}\`, patron de \`bornesDe\`), une ligne de
 * lot par ligne du fichier : une ligne fautive (\`revisionFautive\`, dont tout caractère de contrôle)
 * n'est jamais posée. Un fichier illisible, ou une ligne qui ne nomme aucun commit
 * (\`builtin/commit.c:1778\`), va à \`confier\` : \`[]\` sous \`enPanne\`.
 * @param {Depot} depot @returns {string[]}
 */
export function fusionnesEnCours(depot) {
  const chemin = cheminGit(depot, 'MERGE_HEAD')
  if (!chemin) return []
  const complet = resolve(depot.cwd, chemin)
  const lu = tenter(() => (natureDuChemin(complet) === 'absent' ? '' : readFileSync(complet, 'utf8')))
  if (!lu.disponible) return confier(depot, \`MERGE_HEAD illisible : \${lu.raison}\`) ?? []
  const lignes = lu.valeur.split('\\n')
  if (lignes.at(-1) === '') lignes.pop()
  const corrompue = (ligne) => confier(depot, \`dépôt corrompu : MERGE_HEAD, « \${ligne} » ne nomme aucun commit\`) ?? []
  const fautive = lignes.find(revisionFautive)
  if (fautive !== undefined) return corrompue(fautive)
  if (!lignes.length) return []
  const brut = lire(depot, ['cat-file', '--batch-check'], { entree: lignes.map((l) => \`\${l}^{commit}\\n\`).join('') })
  if (brut === null) return []
  const reponses = brut.split('\\n')
  const shas = []
  for (const [i, ligne] of lignes.entries()) {
    const sha = /^([0-9a-f]+) commit /.exec(reponses[i] ?? '')?.[1]
    if (!sha) return corrompue(ligne)
    shas.push(sha)
  }
  return shas
}

/** Les chemins d'état d'un REBASE ENTAMÉ sous le répertoire git (\`wt-status.c\`, \`wt_status_check_rebase\`). */
const ETATS_DE_REBASE = Object.freeze(['rebase-merge', 'rebase-apply'])

/**
 * Le REBASE ENTAMÉ du dépôt : le nom de son chemin d'état (\`ETATS_DE_REBASE\`) présent sous le
 * répertoire git (\`cheminGit\`, \`natureDuChemin\`), \`null\` hors rebase. Un chemin illisible va à
 * \`confier\` : \`null\` sous \`enPanne\`.
 * @param {Depot} depot @returns {'rebase-merge' | 'rebase-apply' | null}
 */
export function rebaseEntame(depot) {
  for (const nom of ETATS_DE_REBASE) {
    const chemin = cheminGit(depot, nom)
    if (!chemin) return null
    const nature = tenter(() => natureDuChemin(resolve(depot.cwd, chemin)))
    if (!nature.disponible) return confier(depot, \`\${nom} illisible : \${nature.raison}\`)
    if (nature.valeur !== 'absent') return nom
  }
  return null
}
`)
writeFileSync(f, s)
