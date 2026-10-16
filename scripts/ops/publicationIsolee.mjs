// #2626
import { superviserProcessus, sortieDeSupervision } from '../guards/lib/superviserProcessus.mjs'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { ajouterWorktree, brancheDe, depotDe, estAncetre, estShaComplet, fetchOrigin, reussi, refusDeGit, retirerWorktree, shaDe, shasDistants } from '../guards/lib/gitPorte.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { prendreVerrou, estPidVivant, tenantDe } from '../test/verrou.mjs'
import { cheminsDeJournal, lireJournal } from './publicationDonnee.mjs'

function snapshotDe(source, generation) {
  if (typeof generation !== 'string' || !/^[a-zA-Z0-9-]+$/.test(generation))
    throw new Error('publication isolée : génération invalide')
  return join(dirname(source), `${basename(source)}-publication-${generation}`)
}

function journalDePublication(p, verrou = false) {
  const chemin = cheminsDeJournal(p.source, p.branche).json
  if (p.journal !== chemin || p.snapshot !== snapshotDe(p.source, p.generation))
    throw new Error('publication isolée : identité invalide')
  return verrou ? `${chemin}.publication.verrou` : chemin
}

export const CONTRATS_DE_DERIVATION = [
  { fonction: journalDePublication, namespace: 'node_modules/.cache/publication' },
]

export const ENV_PUBLICATION = 'WFRP_PUBLICATION_ISOLEE'

function ancetreConfirme(question, depot, de, vers) {
  const vu = question(depot, de, vers)
  if (!vu.disponible || vu.absent) throw new Error(`publication isolée : ascendance indéterminée — ${vu.raison ?? 'objet absent'}`)
  return vu.valeur === true
}

export function publicationDe(env, racine) {
  const brut = env?.[ENV_PUBLICATION]
  if (!brut) return null
  const p = JSON.parse(brut)
  if (!p || resolve(p.snapshot ?? '') !== resolve(racine) ||
      !estShaComplet(p.demande) || !p.branche || p.branche === 'main' ||
      !(p.bail === '' || estShaComplet(p.bail)) || !p.source || !p.journal ||
      !Number.isSafeInteger(p.pid) || !p.generation)
    throw new Error('publication isolée : identité invalide')
  const chemin = journalDePublication(p)
  const tenant = tenantDe(journalDePublication(p, true))
  if (tenant?.pid !== p.pid || resolve(tenant.cwd ?? '') !== resolve(p.source) || process.ppid !== p.pid)
    throw new Error('publication isolée : lanceur ou verrou différent')
  const journal = lireJournal(chemin, p.branche)
  if (journal.publication?.generation !== p.generation ||
      journal.publication.snapshot !== p.snapshot ||
      journal.publication.demande !== p.demande ||
      (p.rattraper && (!estShaComplet(p.rattraper) || p.rattraper !== journal.publication.rattraper)) ||
      journal.branche !== p.branche)
    throw new Error('publication isolée : journal différent du snapshot demandé')
  const depot = depotDe(racine)
  if (brancheDe(depot) !== null || !ancetreConfirme(estAncetre, depot, p.demande, 'HEAD'))
    throw new Error('publication isolée : HEAD hors du snapshot demandé')
  return { ...p, bail: journal.publication.bail }
}

export function preparerPublication({ source, branche, chemins, reprendre, uuid = randomUUID, gestes = {} }) {
  const g = { depotDe, shaDe, brancheDe, shasDistants, fetchOrigin, estAncetre, ajouterWorktree, ...gestes }
  const depot = g.depotDe(source)
  if (!branche || branche === 'HEAD' || branche === 'main' || g.brancheDe(depot) !== branche)
    throw new Error('publication isolée : une branche de chantier est requise')
  const precedent = existsSync(chemins.json) ? JSON.parse(readFileSync(chemins.json, 'utf8')) : null
  if (precedent?.pid && !precedent.verdict && estPidVivant(precedent.pid))
    throw new Error(`publication isolée : train ${precedent.pid} encore vivant`)
  if (reprendre && precedent?.publication) {
    const p = precedent.publication
    const snapshot = snapshotDe(source, p.generation)
    if (p.source !== source || p.branche !== branche || p.snapshot !== snapshot || p.journal !== chemins.json ||
        p.journal !== cheminsDeJournal(source, branche).json || !existsSync(join(snapshot, '.git')) ||
        !estShaComplet(p.demande) || !(p.bail === '' || estShaComplet(p.bail)))
      throw new Error('publication isolée : snapshot de reprise absent ou incohérent')
    if (g.brancheDe(g.depotDe(p.snapshot)) !== null || !ancetreConfirme(g.estAncetre, g.depotDe(p.snapshot), p.demande, 'HEAD'))
      throw new Error('publication isolée : snapshot de reprise déplacé')
    return { ...p, pid: process.pid }
  }
  const demande = g.shaDe(depot, 'HEAD')
  if (!estShaComplet(demande)) throw new Error('publication isolée : tête committée illisible')
  const precedenteSoldee = precedent?.publication?.soldee || (precedent?.verdict?.etat === 'vert' && Boolean(precedent.etapes?.file?.detail?.fusion))
  let precedente = null
  if (precedent?.publication) {
    if (!precedent.publication.nettoyee && !precedenteSoldee && demande === precedent.publication.demande)
      throw new Error('publication isolée : snapshot précédent conservé ; utiliser --reprendre')
    if (precedenteSoldee) precedent.publication.soldee = true
    precedente = join(chemins.dossier, `${basename(chemins.json, '.json')}.${precedent.publication.generation}.json`)
    if (!existsSync(precedente)) ecrireJsonAtomique(precedente, precedent)
    ecrireJsonAtomique(chemins.json, precedent)
  }
  const ref = `refs/heads/${branche}`
  const distants = g.shasDistants(depot, [ref])
  if (!distants) throw new Error('publication isolée : tête distante illisible')
  const bail = distants.get(ref) ?? ''
  const fetch = g.fetchOrigin(depot)
  if (!reussi(fetch)) throw new Error(`publication isolée : ${refusDeGit(fetch)}`)
  let rattraper = null
  if (bail && !ancetreConfirme(g.estAncetre, depot, bail, demande)) {
    if (bail !== precedent?.publication?.publie)
      throw new Error('publication isolée : la branche distante a avancé hors de la tête demandée')
    if (!(precedenteSoldee && ancetreConfirme(g.estAncetre, depot, bail, 'origin/main'))) rattraper = bail
  }
  const generation = uuid()
  const snapshot = snapshotDe(source, generation)
  const p = { source, branche, demande, publie: null, bail, snapshot, generation, journal: chemins.json, pid: process.pid, ...(precedente ? { precedente } : {}), ...(rattraper ? { rattraper } : {}) }
  mkdirSync(chemins.dossier, { recursive: true })
  const ajout = g.ajouterWorktree(depot, { chemin: snapshot, depuis: demande, detache: true })
  if (!reussi(ajout)) throw new Error(`publication isolée : ${refusDeGit(ajout)}`)
  ecrireJsonAtomique(chemins.json, { branche, base: null, tete: null, ejections: 0, etapes: {}, publication: p })
  return p
}

export async function lancerProcessus(executable, args, options) {
  const vu = await superviserProcessus({
    commande: executable, args, cwd: options.cwd, heriter: true, env: options.env, shell: options.shell, stdio: options.stdio,
  })
  let diagnostic = ''
  const code = sortieDeSupervision(vu, { write: (texte) => { diagnostic += texte } })
  if (vu.error) throw new Error(diagnostic.trim())
  return { code, signal: vu.signal }
}

export async function publierDepuisSnapshot({
  source, branche, chemins, reprendre, args, lancementNpm,
  env = process.env, lancer = lancerProcessus, preparer = preparerPublication,
  verrouiller = prendreVerrou, retirer = retirerWorktree,
  fusionDansMain = (p) => ancetreConfirme(estAncetre, depotDe(p.snapshot), 'HEAD', 'origin/main'),
  ecrire = (texte) => process.stderr.write(texte),
  ouvrir = () => 'inherit', entamer = () => {}, achever = () => {}, echouer = (e) => { ecrire(`${e.message}\n`); return 4 }, fermer = () => {},
}) {
  const verrou = verrouiller({
    chemin: `${chemins.json}.publication.verrou`,
    libelle: `publication de ${branche}`, commande: `ops:publier ${args.join(' ')}`, cwd: source,
  })
  if (verrou.etat !== 'pris') {
    ecrire(`${verrou.message}\n`)
    return 1
  }
  try {
    const stdio = ouvrir()
    const precedent = reprendre && existsSync(chemins.json) ? JSON.parse(readFileSync(chemins.json, 'utf8')) : null
    if (precedent?.publication?.nettoyee && precedent.verdict?.etat === 'vert') {
      ecrire(`[publier] publication déjà fusionnée — tête ${precedent.publication.publie ?? precedent.tete}\n`)
      entamer()
      achever(precedent.verdict)
      return 0
    }
    const p = preparer({ source, branche, chemins, reprendre })
    entamer(p)
    ecrire(`[publier] snapshot ${p.snapshot} — tête demandée ${p.demande} — branche ${branche}\n`)
    if (!p.dependancesInstallees || !existsSync(join(p.snapshot, 'node_modules'))) {
      const npm = lancementNpm(process.platform)
      const installe = await lancer(npm.executable, npm.args, {
        cwd: p.snapshot, stdio, shell: npm.shell, env,
      })
      if (installe.code !== 0) throw new Error(`npm ci du snapshot en échec : code ${installe.code}${installe.signal ? `, signal ${installe.signal}` : ''}`)
      p.dependancesInstallees = true
      const journal = JSON.parse(readFileSync(chemins.json, 'utf8'))
      journal.publication.dependancesInstallees = true
      ecrireJsonAtomique(chemins.json, journal)
    }
    const execute = await lancer(process.execPath, [join(p.snapshot, 'scripts/ops/publier.mjs'), ...args, '--reprendre'], {
      cwd: p.snapshot, stdio, env: { ...env, [ENV_PUBLICATION]: JSON.stringify(p) },
    })
    const journal = JSON.parse(readFileSync(chemins.json, 'utf8'))
    if (!journal.verdict) throw new Error(`train du snapshot sorti sans verdict : code ${execute.code}${execute.signal ? `, signal ${execute.signal}` : ''}`)
    if (execute.code === 0 && journal.verdict?.etat === 'vert' && journal.etapes.file?.detail?.fusion) {
      journal.publication.soldee = true
      ecrireJsonAtomique(chemins.json, journal)
      let fusionConfirmee = false
      try { fusionConfirmee = fusionDansMain(p) }
      catch (e) { ecrire(`[publier] snapshot conservé : ${e.message}\n`); return execute.code }
      if (!fusionConfirmee) {
        ecrire('[publier] snapshot conservé : sa tête n’est pas constatée dans origin/main\n')
        return execute.code
      }
      const retire = retirer(depotDe(source), p.snapshot)
      if (reussi(retire)) {
        journal.publication.nettoyee = true
        ecrireJsonAtomique(chemins.json, journal)
      } else ecrire(`[publier] snapshot conservé : ${refusDeGit(retire)}\n`)
    }
    return execute.code
  } catch (e) {
    return echouer(e)
  } finally {
    fermer()
    verrou.liberer()
  }
}
