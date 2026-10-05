// SITES DE FERMETURE — quelles sources du dépôt portent le geste qui FERME un ticket (#1813).
//
// L'INVARIANT : fermer un ticket est un geste RARE et nommé. Chaque site est déclaré ici, avec ce
// qu'il ferme et pour quel job ; une source qui se met à porter la graphie sans être déclarée est un
// manquement. Le dépôt en compte DEUX, pour deux régimes distincts — ils ne se confondent pas :
// `fermer-depuis-main.mjs` ferme les tickets SOLDÉS d'une plage poussée sur `main` (job `fermetures`
// de fermetures.yml), `signaler-rouge.mjs` ferme la survivante d'un signalement de course rouge quand la
// course repasse au vert (canari.yml, deps-report.yml).
//
// CE QUI EST RÉUTILISÉ, et pourquoi rien n'est réécrit ici :
//   · le RECONNAISSEUR du geste est `fermetureGh` (scripts/hooks/solde-ticket-guard.mjs) — celui-là
//     même dont la porte de commit se sert pour REFUSER une fermeture hors commit. Les trois graphies
//     qu'il connaît (`gh issue close`, `gh issue edit --state closed`, `gh api … state=closed`, cette
//     dernière couvrant le PATCH REST `-f state=closed`) sont donc mesurées ici à l'identique : une
//     seconde table dirait « ferme » d'une commande que la porte laisse passer, ou l'inverse ;
//   · le CORPUS est `sourcesSuivies` (modulesFeuilles.mjs) — git, jamais le disque ;
//   · le BLANCHIMENT est `codeSeul` (commentPoison.mjs), qui retire les COMMENTAIRES en gardant les
//     chaînes : un argv de fermeture EST une donnée littérale, l'effacer rendrait la garde aveugle.
//
// CE QUE LA LECTURE STATIQUE NE PEUT PAS VOIR, dit : un argv dont les jetons ne sont pas des
// littéraux (`gh([...verbe, numero])`). L'unicité ne se tient donc pas sur les seuls argv — elle se
// tient d'abord sur les IMPORTS (`modulesFeuilles.mjs`), qui, eux, ne se contournent pas.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { codeSeul } from './commentPoison.mjs'
import { RACINE, sourcesSuivies } from './modulesFeuilles.mjs'
import { fermetureGh } from '../../hooks/solde-ticket-guard.mjs'

/**
 * Les sites AUTORISÉS à porter la graphie, nominatifs. Tout site hors de cette liste est un
 * manquement ; en retirer un exige que la source n'en porte plus la graphie.
 * @type {ReadonlyArray<{fichier:string, pourquoi:string}>}
 */
export const SITES_DECLARES = Object.freeze([
  Object.freeze({
    fichier: 'scripts/ops/fermer-depuis-main.mjs',
    pourquoi:
      'ferme les tickets SOLDÉS d’une plage poussée sur main, checks requis du sha poussé verts ' +
      '(scripts/ops/checks-requis.mjs) — job `fermetures` ' +
      'de .github/workflows/fermetures.yml ; c’est la route que la porte de commit impose (`la fermeture passe ' +
      'par un commit corrige #N porteur de son solde`)',
  }),
  Object.freeze({
    fichier: 'scripts/ops/signaler-rouge.mjs',
    pourquoi:
      'ferme la SURVIVANTE d’un signalement de course rouge quand la course repasse au vert — ' +
      '.github/workflows/canari.yml et deps-report.yml, sur RUNNER, où GraphQL n’est pas refusé ; ' +
      'écarté de la conversion REST par le solde de #1804, mesuré CI-seulement',
  }),
  Object.freeze({
    fichier: 'scripts/ops/fermer-depuis-main.test.mjs',
    pourquoi: 'MESURE la graphie du geste sur un `appel` INJECTÉ — aucun appel ne part vers GitHub',
  }),
  Object.freeze({
    fichier: 'scripts/ops/signaler-rouge.test.mjs',
    pourquoi: 'MESURE la graphie du geste sur un `spawn` INJECTÉ — aucun appel ne part vers GitHub',
  }),
  Object.freeze({
    fichier: 'scripts/guards/lib/sitesDeFermeture.test.mjs',
    pourquoi:
      'porte la TABLE des graphies que ce recensement doit reconnaître, et les témoins NÉGATIFS qui ' +
      'lui ressemblent — un banc de reconnaisseur ne peut pas ne pas écrire ce qu’il reconnaît',
  }),
  Object.freeze({
    fichier: 'scripts/hooks/segments-profonds.test.mjs',
    pourquoi:
      'MESURE le découpage en segments d’une commande que la porte de fermeture doit REFUSER : la ' +
      'graphie y est la donnée du cas, jamais un geste joué',
  }),
])

/** Un jeton LITTÉRAL d'argv, quelle que soit la graphie de quote. Instance de module réutilisée :
 *  `matchAll` repart de zéro à chaque appel, `lastIndex` n'est pas partagé. */
const LITTERAL = /['"`]([^'"`]*)['"`]/g

/**
 * Les formes de fermeture que porte un TEXTE source, dédupliquées et triées. PURE.
 * Chaque littéral de TABLEAU est lu comme un argv candidat : ses jetons LITTÉRAUX (les autres sont
 * des expressions, donc illisibles), jugés par `fermetureGh` avec puis sans `gh` en tête — un appel
 * de source écrit l'exécutable (`['gh', 'issue', 'close']`) ou le sous-entend dans son enrobeur
 * (`gh(['issue', 'close', …])`), et les deux ferment.
 * @param {string} texte @returns {string[]}
 */
export function formesDeFermeture(texte) {
  const vues = new Set()
  for (const m of codeSeul(texte).matchAll(/\[([^[\]]*)\]/g)) {
    const jetons = [...m[1].matchAll(LITTERAL)].map((x) => x[1])
    if (!jetons.length) continue
    for (const segment of [jetons, ['gh', ...jetons]]) {
      const forme = fermetureGh(segment)
      if (forme) vues.add(forme)
    }
  }
  return [...vues].sort()
}

/**
 * Le recensement : quelles sources SUIVIES portent la graphie, et lesquelles ne sont pas déclarées.
 * @param {{racine?:string, sources?:string[], declares?:typeof SITES_DECLARES}} [p]
 * @returns {{sites:{fichier:string, formes:string[]}[], manquements:string[], sourcesLues:number}}
 */
export function recensementDesFermetures({ racine = RACINE, sources, declares = SITES_DECLARES } = {}) {
  const lues = sources ?? sourcesSuivies(racine)
  const sites = []
  for (const source of lues) {
    let texte
    try {
      texte = readFileSync(resolve(racine, source), 'utf8')
    } catch {
      continue
    }
    const formes = formesDeFermeture(texte)
    if (formes.length) sites.push({ fichier: source, formes })
  }

  const nommes = new Set(declares.map((d) => d.fichier))
  const manquements = sites
    .filter((s) => !nommes.has(s.fichier))
    .map(
      (s) =>
        `${s.fichier} porte un geste de FERMETURE (${s.formes.join(', ')}) sans être déclaré : ` +
        'fermer un ticket est un geste nommé — déclare le site et ce qu’il ferme dans SITES_DECLARES ' +
        '(scripts/guards/lib/sitesDeFermeture.mjs), ou sors la fermeture de cette source',
    )
  for (const d of declares)
    if (!sites.some((s) => s.fichier === d.fichier))
      manquements.push(
        `site déclaré qui ne ferme PLUS rien : ${d.fichier} — une déclaration sans geste pré-autorise ` +
        'une fermeture qui reviendrait en silence ; retire-la',
      )
  return { sites, manquements: manquements.sort(), sourcesLues: lues.length }
}
