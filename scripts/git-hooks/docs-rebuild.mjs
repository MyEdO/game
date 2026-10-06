// #2329
import '../node-requis.mjs'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ciblesSurDisque, GENERATORS, generateursDeCode, genererCode, perimetreDesMixtes, SOURCES_LUES } from '../docs/build-all.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'
import { etapeProfilee } from '../etape-profilee.mjs'
import { ceQuiChange, depotDe, etatDeLArbre, parentsDe, racineDe, refusDeGit, shaDe, shaPrecedentDeHead } from '../guards/lib/gitPorte.mjs'
import { journaliserLeHook } from './journal.mjs'

/** Fichiers de `de`..`a` (ORIG_HEAD..HEAD par défaut, SHA capturés pour post-commit).
 *  Borne absente ou git indisponible : `null`. */
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

/** Les dossiers qui contiennent `chemin`, du parent à la racine (`''`) comprise. */
function ancetresDe(chemin) {
  const ancetres = [parentDe(chemin)]
  while (ancetres.at(-1) !== '') ancetres.push(parentDe(ancetres.at(-1)))
  return ancetres
}

/**
 * Vrai si le lot peut avoir périmé un doc dérivé. La réponse se DÉRIVE de la mesure
 * (`docs/.sources-lues.json`, #1773). Quatre façons, pour un lot, de périmer un doc dérivé :
 *   1. le chemin EST une source lue, ou une cible ;
 *   2. un de ses ANCÊTRES est un dossier LISTÉ — un fichier posé dans un dossier NEUF change le
 *      listing du premier ancêtre qui existait (#2193) ;
 *   3. son dossier parent contient déjà une source lue — c'est le frère AJOUTÉ ou RETIRÉ d'une
 *      source, que la mesure d'un générateur qui énumère sans lister ne peut pas dire autrement ;
 *   4. sans restriction par générateur, il vit sous `docs/`.
 * Lot inconnu ou mesure illisible → régénération conservatrice.
 * `seulement` (des `script` de `GENERATORS`) restreint la mesure aux entrées de ces générateurs ; un
 * membre SANS entrée fait régénérer, comme une mesure illisible (#2193).
 */
export function touchesDocSources(chemins, mesure, { seulement = null } = {}) {
  if (chemins === null || mesure === null) return true
  if (seulement && seulement.some((script) => !Object.hasOwn(mesure, script))) return true
  const fichiers = new Set()
  const dossiers = new Set()
  const dossiersDeSources = new Set()
  for (const e of seulement ? seulement.map((script) => mesure[script]) : Object.values(mesure)) {
    for (const f of e.fichiers ?? []) {
      fichiers.add(f)
      dossiersDeSources.add(parentDe(f))
    }
    for (const c of e.cibles ?? []) fichiers.add(c)
    for (const d of e.dossiers ?? []) dossiers.add(d)
  }
  return chemins.some((brut) => {
    const chemin = brut.split('\\').join('/')
    const parent = parentDe(chemin)
    return fichiers.has(chemin) || (!seulement && chemin.startsWith('docs/')) || ancetresDe(chemin).some((a) => dossiers.has(a)) ||
      (parent !== '' && dossiersDeSources.has(parent))
  })
}

export function selectionDesGenerateurs({ lot, mesure, cwd, generateurs = GENERATORS }) {
  const tous = (raison) => ({ scripts: generateurs.map((g) => g.script), complete: true, raison })
  if (lot === null) return tous('plage Git inconnue')
  if (lot.some((f) => ['package.json', 'package-lock.json', 'server/package.json', 'server/package-lock.json'].includes(f))) return tous('toolchain modifiée : lectures des dépendances non mesurées')
  if (!mesure || generateurs.some((g) => !Array.isArray(mesure[g.script]?.fichiers) || !Array.isArray(mesure[g.script]?.dossiers) || !Array.isArray(mesure[g.script]?.cibles))) return tous('mesure absente ou incomplète')
  if (lot.some((f) => ['scripts/docs/build-all.mjs', 'scripts/git-hooks/docs-rebuild.mjs'].includes(f) || f.startsWith('scripts/docs/lib/'))) return tous('graphe ou outil de mesure modifié')
  if (generateurs.some((g) => mesure[g.script].cibles.some((c) => !existsSync(join(cwd, c))) ||
    [...g.targets, ...(g.injecte ?? [])].some((c) => !c.includes('*') && !existsSync(join(cwd, c))))) return tous('cible absente')
  const selection = new Set(generateurs.filter((g) => touchesDocSources(lot, mesure, { seulement: [g.script] })).map((g) => g.script))
  const sorties = (g) => [...g.targets, ...(g.injecte ?? [])]
  let changement = true
  while (changement) {
    const avant = selection.size
    if (generateursDeCode(generateurs).some((g) => selection.has(g.script)))
      for (const g of perimetreDesMixtes(generateurs)) selection.add(g.script)
    for (const g of generateurs) {
      if (selection.has(g.script)) {
        for (const producteur of generateurs)
          if (producteur !== g && mesure[g.script].fichiers.some((f) => sorties(producteur).some((c) => correspondGlob(f, c)))) selection.add(producteur.script)
        if (perimetreDesMixtes(generateurs).includes(g) && (g.injecte ?? []).length)
          for (const code of generateursDeCode(generateurs)) selection.add(code.script)
      } else if (generateurs.some((producteur) => selection.has(producteur.script) &&
        (mesure[g.script].fichiers.some((f) => sorties(producteur).some((c) => correspondGlob(f, c))) ||
          touchesDocSources(ciblesSurDisque(sorties(producteur), cwd), mesure, { seulement: [g.script] })))) selection.add(g.script)
    }
    changement = selection.size !== avant
  }
  return { scripts: generateurs.filter((g) => selection.has(g.script)).map((g) => g.script), complete: false, raison: 'sources mesurées et préalables' }
}

export function reconstruireApresGit({ cwd, hook, avant, apres, npm = spawnSync, code = genererCode, docs = execFileSync, annoncer = (texte) => process.stderr.write(texte), horloge, generateurs = GENERATORS }) {
  let lot
  if (hook === 'post-commit') {
    const depot = depotDe(cwd, { enPanne: (_raison, vu) => annoncer(`[${hook}] lecture Git indisponible : ${refusDeGit(vu)}\n`) })
    const parents = parentsDe(depot, 'HEAD')
    if (parents !== null && parents.length < 2) return 0
    const nouveau = shaDe(depot, 'HEAD')
    const ancien = shaPrecedentDeHead(depot)
    lot = parents === null || nouveau === null || ancien === null ? null : touchedFiles(cwd, { de: ancien, a: nouveau })
  } else lot = hook === 'post-checkout' ? (avant === apres ? [] : touchedFiles(cwd, { de: avant, a: apres })) : touchedFiles(cwd)
  const mesure = sourcesMesurees(cwd)
  const etape = (nom, geste) => etapeProfilee(`[${hook}] ${nom}`, geste, { annoncer, horloge })
  if (hook === 'post-checkout' && avant === '0'.repeat(40) && mesure === null) {
    annoncer(`[${hook}] worktree neuf : préparation requise par ops:chantier (\`npm ci\`, \`npm --prefix server ci\`, \`npm run docs:build\`)\n`)
    return 0
  }
  const selection = selectionDesGenerateurs({ lot, mesure, cwd, generateurs })
  const selectionnes = generateurs.filter((g) => selection.scripts.includes(g.script))
  if (selection.scripts.length) annoncer(`[${hook}] docs : ${selection.complete ? 'génération complète' : 'sélection'} (${selection.scripts.length}/${generateurs.length}) — ${selection.raison}\n`)
  if (lot === null) annoncer(`[${hook}] plage Git inconnue : npm ci racine et server requis avant génération\n`)
  let codeProduit = false
  for (const prefixe of ['', 'server/']) {
    if (lot !== null && !lot.includes(`${prefixe}package-lock.json`)) continue
    if (!existsSync(join(cwd, `${prefixe}package-lock.json`))) {
      if (lot?.includes(`${prefixe}package-lock.json`)) {
        annoncer(`[${hook}] lockfile ${prefixe}package-lock.json absent : réparer puis relancer \`npm ${prefixe ? '--prefix server ' : ''}ci\` ; générations arrêtées\n`)
        return 1
      }
      continue
    }
    const relance = prefixe ? 'npm --prefix server ci' : 'npm ci'
    const args = [...(prefixe ? ['--prefix', 'server'] : []), 'ci', '--no-audit', '--no-fund']
    const vu = etape(relance, () => npm(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, stdio: 'inherit', shell: true }))
    if (vu?.error || vu?.status !== 0) {
      annoncer(`[${hook}] fusion effectuée, équipement incomplet : relancer \`${relance}\` dans ${cwd} (${vu?.error?.message ?? `code ${vu?.status}`}) ; générations arrêtées\n`)
      return 1
    }
    if (!prefixe) codeProduit = true
  }
  if (!codeProduit && generateursDeCode(selectionnes).length > 0 && etape('cibles de code', () => code({ cwd, quiet: false, generateurs: selectionnes })) !== 0) {
    annoncer(`[${hook}] génération de code interrompue : docs non régénérés\n`)
    return 1
  }
  if (hook === 'post-checkout') {
    const plan = planDuCheckout({ avant, apres, mesure, lot })
    if (plan === 'consigne') annoncer(CONSIGNE_SANS_MESURE)
    if (plan !== 'regenerer') return 0
  }
  if (!selection.scripts.length) return 0
  try {
    etape('docs dérivés', () => docs(process.execPath, ['scripts/docs/build-all.mjs', '--verifier-code', ...(selection.complete ? [] : ['--only', ...selection.scripts])], { cwd, stdio: 'inherit' }))
  } catch (e) {
    annoncer(`[${hook}] docs — régénération INTERROMPUE : corriger le diagnostic puis relancer \`npm run docs:build\` (${e.status ?? e.message})\n`)
    return 1
  }
  const changed = etatDeLArbre(depotDe(cwd))
    .filter((e) => e.etat !== '??' && e.etat[1] !== ' ' && e.chemins[0].startsWith('docs/'))
    .map((e) => e.chemins[0])
  if (changed.length) annoncer(`docs régénérés : à committer (${changed.length}) :\n${changed.map((f) => `  ${f}`).join('\n')}\n`)
  return 0
}

function main([hook, avant, apres] = process.argv.slice(2)) {
  journaliserLeHook(hook)
  const cwd = racineDe(depotDe(process.cwd()))
  if (cwd) process.exitCode = reconstruireApresGit({ cwd, hook, avant, apres })
}

if (import.meta.main) main()
