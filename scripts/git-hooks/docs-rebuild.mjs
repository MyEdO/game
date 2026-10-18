// #2329, #2603
import '../node-requis.mjs'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ciblesSurDisque, GENERATORS, generateursDeCode, SOURCES_LUES } from '../docs/build-all.mjs'
import { preuveValide } from '../docs/lib/fraicheur-docs.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { cheminsDeLEcrivain, preempterLesDerives } from '../docs/lib/ecrivain-derives.mjs'
import { etapeProfilee } from '../etape-profilee.mjs'
import { ceQuEmporteLIndex, ceQuiChange, depotDe, estAncetre, fusionnesEnCours, parentsDe, racineDe, refusDeGit, shaDe, shaPrecedentDeHead, TIMEOUT_DU_HOOK_MS } from '../guards/lib/gitPorte.mjs'
import { journaliserLeHook } from './journal.mjs'
import { jouerLesMiroirs } from './miroirs-d-agents.mjs'
import { attendreLaReconstruction, CODE_MORT_SANS_VERDICT, demanderLaReconstruction, ligneDeDemande } from './reconstruction.mjs'
import { sourcesMesurees } from './selection-des-derives.mjs'
import { gitDirDe, verrouOutillageDe } from '../hooks/barriere-outil.mjs'
import { prendreVerrou } from '../test/verrou.mjs'

/** L'attente du verrou d'outillage avant un `npm ci`. Valeur maison. */
export const ATTENTE_OUTILLAGE = Object.freeze({ echeanceMs: 120_000, pasMs: 200 })

/** Le verrou d'outillage de l'arbre `cwd` (`verrouOutillageDe`, #2187) pris pour ses `npm ci` ; `pris` sans
 *  verrou hors dépôt. */
function prendreOutillage(cwd, hook) {
  const chemin = verrouOutillageDe(cwd)
  if (chemin === null) return { etat: 'pris', liberer: () => {} }
  return prendreVerrou({ chemin, libelle: 'outillage de l’arbre', commande: `docs-rebuild ${hook}`, cwd, attente: ATTENTE_OUTILLAGE })
}

/** Fichiers de `de`..`a` (ORIG_HEAD..HEAD par défaut, SHA capturés pour post-commit).
 *  Borne absente ou git indisponible : `null`. */
export function touchedFiles(cwd, { de = 'ORIG_HEAD', a = 'HEAD' } = {}) {
  let panne = false
  const depot = depotDe(cwd, { enPanne: () => { panne = true } })
  const chemins = shaDe(depot, de) === null ? null : ceQuiChange(depot, de, a).chemins()
  return panne ? null : chemins
}

/** Lot de post-merge : squash (`squash`, 1er argument du hook `post-merge` = `1`) ou fusion NON COMMITÉE
 *  (un `fusionnesEnCours` hors de l'histoire de HEAD) → `ceQuEmporteLIndex`, conflits compris ; sinon
 *  `touchedFiles`. Git indisponible : `null`. #2327 */
export function lotDuPostMerge(cwd, { squash = false } = {}) {
  let panne = false
  const depot = depotDe(cwd, { enPanne: () => { panne = true } })
  const enCours = squash || fusionnesEnCours(depot).some((sha) => {
    const vu = estAncetre(depot, sha, 'HEAD')
    if (!vu.disponible || 'absent' in vu) {
      panne = true
      return false
    }
    return !vu.valeur
  })
  const lot = panne ? null : enCours ? ceQuEmporteLIndex(depot).chemins() : touchedFiles(cwd)
  return panne ? null : lot
}

/** #2475 */
export const codeDeLArbre = (cwd, lancer = spawnSync) => {
  const vu = lancer(process.execPath, [join(cwd, 'scripts/docs/build-all.mjs'), '--code', '--perimes'], { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
  return vu.error ? 1 : vu.status ?? 1
}

/**
 * La partie SYNCHRONE d'un post-hook : le lot, puis, la passe des dérivés PRÉEMPTÉE (`preempterLesDerives`), les
 * `npm ci` sous le verrou d'outillage et les cibles de CODE dont l'attestation est périmée sans `npm ci`
 * racine ; enfin la DEMANDE de reconstruction (`demanderLaReconstruction`).
 * REND `{ code, seq }` : `seq` le numéro demandé, `null` sans demande.
 */
export function reconstruireApresGit({
  cwd, hook, avant, apres, npm = spawnSync, code = codeDeLArbre, demander = demanderLaReconstruction,
  annoncer = (texte) => process.stderr.write(texte), horloge, mesurer = () => {}, generateurs = GENERATORS,
}) {
  const rendu = (sortie, seq = null) => ({ code: sortie, seq })
  let lot
  if (hook === 'post-commit') {
    const depot = depotDe(cwd, { enPanne: (_raison, vu) => annoncer(`[${hook}] lecture Git indisponible : ${refusDeGit(vu)}\n`) })
    const parents = parentsDe(depot, 'HEAD')
    if (parents !== null && parents.length < 2) lot = []
    else {
      const nouveau = shaDe(depot, 'HEAD')
      const ancien = shaPrecedentDeHead(depot)
      lot = parents === null || nouveau === null || ancien === null ? null : touchedFiles(cwd, { de: ancien, a: nouveau })
    }
  } else lot = hook === 'post-checkout' ? (avant === apres ? [] : touchedFiles(cwd, { de: avant, a: apres }))
    : hook === 'post-merge' ? lotDuPostMerge(cwd, { squash: avant === '1' }) : touchedFiles(cwd)
  const mesure = sourcesMesurees(cwd)
  const etape = (nom, geste) => etapeProfilee(`[${hook}] ${nom}`, geste, { annoncer, horloge, mesurer })
  if (hook === 'post-checkout' && avant === '0'.repeat(40) && mesure === null) {
    annoncer(`[${hook}] worktree neuf : préparation requise par ops:chantier (\`npm ci\`, \`npm --prefix server ci\`, \`npm run docs:build\`)\n`)
    return rendu(0)
  }
  if (lot === null) annoncer(`[${hook}] plage Git inconnue : npm ci racine et server requis avant génération\n`)
  const installations = ['', 'server/'].filter((prefixe) => lot === null || lot.includes(`${prefixe}package-lock.json`))
  const selection = generateursDeCode(generateurs)
  const codeSelectionne = selection.length > 0 && !preuveValide(cwd, { generateurs, selection, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok
  if (installations.length || codeSelectionne) {
    const ecrit = preempterLesDerives(cheminsDeLEcrivain(gitDirDe(cwd)), `docs-rebuild ${hook}`,
      () => ecrireLesCibles({ cwd, hook, lot, installations, codeSelectionne, npm, code, annoncer, etape }))
    if (typeof ecrit === 'object') annoncer(`[${hook}] écrivain des dérivés tenu à l'échéance : ${ecrit.refus} ; générations arrêtées\n`)
    if (ecrit !== 0) return rendu(1)
  }
  if (!generateurs.length) return rendu(0)
  const seq = demander(cwd)
  annoncer(`[${hook}] docs dérivés : reconstruction en fond, demande ${seq} (\`node scripts/git-hooks/docs-rebuild.mjs ${hook} --attendre\` attend)\n`)
  return rendu(0, seq)
}

/** Les `npm ci` de `installations` sous le verrou d'outillage, puis les cibles de CODE (`code`) si
 *  `codeSelectionne` sans `npm ci` racine. REND 0, ou 1 au premier rouge, annoncé. */
function ecrireLesCibles({ cwd, hook, lot, installations, codeSelectionne, npm, code, annoncer, etape }) {
  let outillage = null
  let racineInstallee = false
  try {
    for (const prefixe of installations) {
      if (!existsSync(join(cwd, `${prefixe}package-lock.json`))) {
        if (lot?.includes(`${prefixe}package-lock.json`)) {
          annoncer(`[${hook}] lockfile ${prefixe}package-lock.json absent : réparer puis relancer \`npm ${prefixe ? '--prefix server ' : ''}ci\` ; générations arrêtées\n`)
          return 1
        }
        continue
      }
      const relance = prefixe ? 'npm --prefix server ci' : 'npm ci'
      outillage ??= prendreOutillage(cwd, hook)
      if (outillage.etat !== 'pris') {
        annoncer(`[${hook}] fusion effectuée, \`${relance}\` non lancé : ${outillage.message} ; générations arrêtées\n`)
        return 1
      }
      const args = [...(prefixe ? ['--prefix', 'server'] : []), 'ci', '--no-audit', '--no-fund']
      const vu = etape(relance, () => npm(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, stdio: 'inherit', shell: true }))
      if (vu?.error || vu?.status !== 0) {
        annoncer(`[${hook}] fusion effectuée, équipement incomplet : relancer \`${relance}\` dans ${cwd} (${vu?.error?.message ?? `code ${vu?.status}`}) ; générations arrêtées\n`)
        return 1
      }
      if (!prefixe) racineInstallee = true
    }
  } finally {
    outillage?.liberer?.()
  }
  if (racineInstallee || !codeSelectionne) return 0
  const sortie = etape('cibles de code', () => code(cwd))
  if (sortie === 0) return 0
  annoncer(`[${hook}] cibles de code INTERROMPUES : corriger le diagnostic puis relancer \`npm run gen\` (code ${sortie}) ; générations arrêtées\n`)
  return 1
}

/** Le code d'une reconstruction attendue (`attendreLaReconstruction`) : `CODE_DIFFERE` en cours à l'échéance. PURE. */
export const codeDeLaPasse = (passe) => (passe.etat === 'en-cours' ? CODE_DIFFERE : passe.etat === 'mort' ? CODE_MORT_SANS_VERDICT : passe.code)

/**
 * UN processus par post-hook (#2603) : `jouerLesMiroirs` (sauf `post-checkout`), puis `reconstruireApresGit` ; une
 * demande imprime `ligneDeDemande` sur stdout. `--attendre` attend la passe et rend son code.
 */
async function main(argv = process.argv.slice(2)) {
  const attendre = argv.includes('--attendre')
  const [hook, avant, apres] = argv.filter((a) => a !== '--attendre')
  const journal = journaliserLeHook(hook)
  if (hook !== 'post-checkout') await jouerLesMiroirs(hook)
  const cwd = racineDe(depotDe(process.cwd()))
  if (!cwd) return
  const { code, seq } = reconstruireApresGit({ cwd, hook, avant, apres, mesurer: journal.etape })
  process.exitCode = code
  if (seq === null) return
  process.stdout.write(ligneDeDemande(seq))
  if (!attendre) return
  const passe = attendreLaReconstruction(cwd, seq, { echeanceMs: TIMEOUT_DU_HOOK_MS })
  process.stderr.write(`[${hook}] reconstruction ${seq} : ${passe.etat}${passe.log ? `, journal ${passe.log}` : ''}\n`)
  process.exitCode = codeDeLaPasse(passe)
}

if (import.meta.main) await main()
