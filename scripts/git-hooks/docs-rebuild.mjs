// scripts/git-hooks/docs-rebuild.mjs — corps PARTAGÉ des hooks post-merge / post-rewrite / post-checkout.
// Après une fusion, un rebase ou un changement de branche, il produit les cibles de CODE (`genererCode`,
// #2203 A2), puis régénère les docs dérivés quand le lot touche une de leurs sources, et NOMME les MIXTES
// qui ont bougé.
// Il ne touche JAMAIS l'index (aucun `git add`/`commit`) : la décision de committer reste humaine.
// Silencieux quand rien de pertinent n'a bougé (aucune source de doc dans le lot fusionné/rebasé).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { genererCode, SOURCES_LUES } from '../docs/build-all.mjs'
import { ceQuiChange, depotDe, etatDeLArbre, racineDe, shaDe } from '../guards/lib/gitPorte.mjs'

/** Fichiers du lot que le hook vient de recevoir (`de`..`a`, ORIG_HEAD..HEAD par défaut). Sans `de`,
 *  ou git indisponible : `null` (= inconnu, on régénère). */
export function touchedFiles(cwd, { de = 'ORIG_HEAD', a = 'HEAD' } = {}) {
  let panne = false
  const depot = depotDe(cwd, { enPanne: () => { panne = true } })
  const chemins = shaDe(depot, de) === null ? null : ceQuiChange(depot, de, a).chemins()
  return panne ? null : chemins
}

/** Consigne d'un arbre SANS mesure (worktree neuf) : ses docs purs sont absents, rien ne les a produits. */
export const CONSIGNE_SANS_MESURE =
  'docs dérivés absents ou non mesurés (docs/.sources-lues.json) : `npm run docs:build` les produit\n'

/**
 * Décision de post-checkout (`avant`, `apres` : les HEAD que git passe au hook). HEAD immobile :
 * `rien` ; arbre sans mesure : `consigne` — un changement de branche ne bloque jamais sur un
 * `docs:build` complet ; sinon la sélection de post-merge (`touchesDocSources`). PURE.
 * @returns {'rien'|'consigne'|'regenerer'}
 */
export function planDuCheckout({ avant, apres, mesure, lot }) {
  if (avant === apres) return 'rien'
  if (mesure === null) return 'consigne'
  return touchesDocSources(lot, mesure) ? 'regenerer' : 'rien'
}

/** Les sources MESURÉES de l'arbre (`docs/.sources-lues.json`), ou `null` si le dérivé est illisible. */
export function sourcesMesurees(racine) {
  try { return JSON.parse(readFileSync(join(racine, SOURCES_LUES), 'utf8')) } catch { return null }
}

const parentDe = (chemin) => (chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '')

/**
 * Vrai si le lot peut avoir périmé un doc dérivé. La réponse se DÉRIVE de la mesure
 * (`docs/.sources-lues.json`), jamais d'une liste de préfixes écrite à la main : 49 sources mesurées
 * vivaient hors des quatre préfixes codés d'avant (src, scripts, docs, Source, plus package.json) —
 * les fiches `.claude/memory/user-…md` → `docs/doctrines.md`, les `SKILL.md` de `.claude/skills`,
 * `tsconfig.json`, et le dossier LISTÉ
 * `.github/workflows` (#1773). Quatre façons, pour un lot, de périmer un doc dérivé :
 *   1. le chemin EST une source lue, ou une cible ;
 *   2. son dossier parent est un dossier LISTÉ ;
 *   3. son dossier parent contient déjà une source lue — c'est le frère AJOUTÉ ou RETIRÉ d'une
 *      source, que la mesure d'un générateur qui énumère sans lister ne peut pas dire autrement ;
 *   4. il vit sous `docs/` : les dérivés eux-mêmes.
 * FAIL-CLOSED : lot inconnu (pas d'ORIG_HEAD) ou mesure illisible → on régénère.
 */
export function touchesDocSources(chemins, mesure) {
  if (chemins === null || mesure === null) return true
  const fichiers = new Set()
  const dossiers = new Set()
  for (const e of Object.values(mesure)) {
    for (const f of e.fichiers ?? []) fichiers.add(f)
    for (const c of e.cibles ?? []) fichiers.add(c)
    for (const d of e.dossiers ?? []) dossiers.add(d)
  }
  const dossiersDeSources = new Set([...fichiers].map(parentDe))
  return chemins.some((brut) => {
    const chemin = brut.split('\\').join('/')
    const parent = parentDe(chemin)
    return fichiers.has(chemin) || chemin.startsWith('docs/') || dossiers.has(parent) ||
      (parent !== '' && dossiersDeSources.has(parent))
  })
}

function main(argv = process.argv.slice(2)) {
  const cwd = racineDe(depotDe(process.cwd()))
  if (!cwd) return
  genererCode({ cwd, quiet: true })
  if (argv[0] === '--checkout') {
    const [, avant, apres] = argv
    const mesure = sourcesMesurees(cwd)
    const plan = planDuCheckout({ avant, apres, mesure, lot: avant === apres || mesure === null ? [] : touchedFiles(cwd, { de: avant, a: apres }) })
    if (plan === 'consigne') process.stderr.write(CONSIGNE_SANS_MESURE)
    if (plan !== 'regenerer') return
  } else if (!touchesDocSources(touchedFiles(cwd), sourcesMesurees(cwd))) return
  try {
    execFileSync(process.execPath, ['scripts/docs/build-all.mjs', '--quiet'], { cwd, stdio: ['ignore', 'ignore', 'inherit'] })
  } catch {
    // Régénération interrompue : docs/ est un mélange d'ancien et de neuf. L'annoncer « à
    // committer » figerait ce mélange — on nomme la consigne, on ne l'exécute pas.
    process.stderr.write(`docs — régénération INTERROMPUE : docs/ possiblement incohérent, \`git checkout -- docs/\` puis corriger la cause.\n`)
    return
  }
  const changed = etatDeLArbre(depotDe(cwd))
    .filter((e) => e.etat !== '??' && e.etat[1] !== ' ' && e.chemins[0].startsWith('docs/'))
    .map((e) => e.chemins[0])
  if (!changed.length) return
  process.stderr.write(`docs régénérés : à committer (${changed.length}) :\n${changed.map((f) => `  ${f}`).join('\n')}\n`)
}

if (import.meta.main) main()
