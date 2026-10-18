import { closeSync, openSync, writeSync } from 'node:fs'
import { StringDecoder } from 'node:string_decoder'
import { arretIndetermine, texteDeCause } from './arretNatif.mjs'
import { codeEnfant } from './codesDeSortie.mjs'
import { reessayerAuChargement } from './spawnResilient.mjs'
import { lancerProcessusSupervise } from './superviserProcessus.mjs'

/** Délai d'arrêt accordé à l'hôte natif entre la demande et le certificat de zéro (#2586). */
const DELAI_ARRET_MS = 2000
const DUREE_MAX_MS = 2147483647
const erreurNommee = (code, message) => Object.assign(new Error(message), { code })

/** Projection SÉRIALISABLE d'un résultat de `spawnBorne` : erreurs et causes (agrégées, cycliques) projetées, ni
 *  argv ni env (#2586). */
export function diagnosticDuLancement({ arret, error, code, pid, status, signal, expiree, annulee, dossier, defautCollecte } = {}) {
  const vues = new Set()
  const projeterErreur = (erreur) => {
    if (erreur == null) return null
    if (typeof erreur !== 'object') return { message: texteDeCause(erreur) }
    if (vues.has(erreur)) return { cycle: true }
    vues.add(erreur)
    const projection = { name: erreur.name, code: erreur.code, message: texteDeCause(erreur), operation: erreur.operation, pid: erreur.pid }
    if (erreur.cause !== undefined) projection.cause = projeterErreur(erreur.cause)
    if (Array.isArray(erreur.errors)) projection.errors = erreur.errors.map(projeterErreur)
    vues.delete(erreur)
    return projection
  }
  return { code, pid, status, signal, expiree, annulee, dossier, error: projeterErreur(error), defautCollecte: projeterErreur(defautCollecte),
    arret: arret ? { etat: arret.etat, pid: arret.pid, echeance: arret.echeance, methode: arret.methode, zeroNatif: arret.zeroNatif,
      erreurs: (arret.erreurs ?? []).map(projeterErreur) } : null }
}

/** Émet à `ligne`, une LIGNE par appel et sans terminateur, erreur, collecte et arrêt de `resultat` sous `prefixe` :
 *  chaque couple qualificatif–message une seule fois, au premier contexte qui le porte, le qualificatif étant le code
 *  (ou le nom) de la première erreur de sa chaîne qui en a un ; l'erreur et la collecte d'abord, puis leurs causes ;
 *  une entrée d'arrêt déjà citée garde sa ligne d'opération et de PID connus, une fois. REND `true` quand l'arrêt
 *  n'est pas prouvé `mort` (#2586). */
export function diagnosticArret(resultat, ligne, prefixe = '[gates] ') {
  const diagnostic = diagnosticDuLancement(resultat)
  const emises = new Set()
  const emettre = (texte) => { if (!emises.has(texte)) { emises.add(texte); ligne(prefixe + texte) } }
  const cites = new Set()
  const porteurs = new Set()
  const qualificatif = (erreur) => erreur.code ?? erreur.name ??
    (erreur.cause && !erreur.cause.cycle && erreur.cause.message === erreur.message ? qualificatif(erreur.cause) : undefined)
  const citer = (erreur, contexte, porteur) => {
    if (!erreur) return
    const tete = porteur ? `${porteur} ` : contexte
    if (erreur.cycle) { emettre(`${tete}cycle`); return }
    const code = qualificatif(erreur)
    const cle = `${code ?? ''}\n${erreur.message}`
    if (!cites.has(cle)) {
      cites.add(cle)
      emettre(`${tete}${code ? `${code} — ` : ''}${erreur.message}`)
    } else if (porteur && !porteurs.has(porteur)) emettre(porteur)
    if (porteur) porteurs.add(porteur)
  }
  const causes = (erreur) => {
    if (!erreur || erreur.cycle) return
    imprimer(erreur.cause, 'cause : ')
    for (const cause of erreur.errors ?? []) imprimer(cause, 'cause agrégée : ')
  }
  const imprimer = (erreur, contexte, porteur) => { citer(erreur, contexte, porteur); causes(erreur) }
  citer(diagnostic.error, 'erreur : ')
  citer(diagnostic.defautCollecte, 'collecte : ')
  causes(diagnostic.error)
  causes(diagnostic.defautCollecte)
  if (diagnostic.arret?.etat === 'mort') return false
  if (!diagnostic.arret) emettre('arrêt indéterminé : preuve d’arrêt absente.')
  for (const erreur of diagnostic.arret?.erreurs ?? []) {
    imprimer(erreur, '', ['arrêt indéterminé :', erreur.operation, erreur.pid == null ? undefined : `PID ${erreur.pid}`].filter(Boolean).join(' '))
  }
  emettre(`diagnostic arrêt : ${JSON.stringify(diagnostic)}`)
  return true
}

/** Demande l'arrêt au propriétaire natif `controle` et REND l'`arret` de son unique `fin` (#2586). */
export async function tuerArbre(controle, cause) {
  controle.demanderArret(cause)
  return (await controle.fin).arret
}

/**
 * Lance `node <argv>` (ou `commande`) sous la supervision native `superviser`, sa sortie dans `fichier`, BORNÉ par
 * `limiteMs` et `maxBuffer`, et REJOUÉ si le processus n'a pas démarré (`spawnResilient` : le fichier de sortie est
 * réouvert en `'w'` à chaque essai, sans quoi le second écrirait à la suite du premier). À l'expiration, à
 * l'annulation ou au dépassement de capture, l'arrêt est DEMANDÉ au contrôle natif, qui emporte l'arbre entier
 * (`npm`, `vitest` et leurs workers) ; `surControle` reçoit ce contrôle dès l'hôte lancé, `surPid` le PID de la
 * CIBLE. L'arrêt n'est `mort` que sur le certificat de la `fin` native ; un `superviser` qui lève sans rendre de
 * contrôle et peut avoir lancé son hôte : l'arrêt est `indetermine` (#2586). `pret`, réglé au plus tard par la `fin`,
 * est attendu après elle. `signal` abrège l'attente d'un rejeu, et l'essai suivant rend l'annulation sans lancer.
 * REND `{ code, status, signal, error, stdout, stderr, expiree, annulee, arret, controle, fichier, sortie, limiteMs, pid }`.
 */
export function spawnBorne({ commande, argv, fichier, limiteMs, delaiArretMs = DELAI_ARRET_MS, cwd, env = process.env,
  surPid, surControle, site, signal: annulation, fluxDistincts = false, maxBuffer = 1024 * 1024, superviser = lancerProcessusSupervise }) {
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer < 0) throw erreurNommee('BORNE_INVALIDE', `maxBuffer doit être un nombre entier non négatif d’octets : ${maxBuffer}`)
  for (const [nom, valeur] of [['limiteMs', limiteMs], ['delaiArretMs', delaiArretMs]])
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > DUREE_MAX_MS || (nom === 'delaiArretMs' && valeur === 0)) throw erreurNommee('BORNE_INVALIDE', `${nom} doit être une durée finie ${nom === 'delaiArretMs' ? 'positive' : 'non négative'}, au plus ${DUREE_MAX_MS} ms : ${valeur}`)
  const unEssai = async () => {
    if (annulation?.aborted) return { code: 1, status: null, signal: null, error: null, stdout: '', stderr: '', expiree: false, annulee: true,
      arret: { pid: undefined, etat: 'mort', erreurs: [] }, fichier, sortie: '', limiteMs, pid: undefined }
    const fd = openSync(fichier, 'w')
    let controle; let hote; let expiree = false; let annulee = false; let erreur = null
    let stdout = ''; let stderr = ''; let sortie = ''; let octets = 0
    const decodeStdout = new StringDecoder('utf8'); const decodeStderr = new StringDecoder('utf8'); const decodeSortie = new StringDecoder('utf8')
    const annulationLimite = new AbortController()
    const signalLancement = annulation ? AbortSignal.any([annulation, annulationLimite.signal]) : annulationLimite.signal
    const demanderArret = (cause) => controle?.demanderArret(cause)
    const annuler = () => { annulee = true; demanderArret(erreurNommee('ABORT_ERR', 'lancement annulé')) }
    const minuterie = setTimeout(() => {
      expiree = true
      const cause = erreurNommee('ETIMEDOUT', `échéance ${limiteMs} ms`)
      demanderArret(cause); annulationLimite.abort(cause)
    }, limiteMs)
    annulation?.addEventListener('abort', annuler, { once: true })
    const capturer = (bytes, decoder, ajouter) => {
      if (erreur) return
      try {
        const tampon = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
        const retenus = tampon.subarray(0, Math.max(0, maxBuffer - octets))
        octets += tampon.length
        if (fluxDistincts) ajouter(decoder.write(retenus))
        sortie += decodeSortie.write(retenus)
        writeSync(fd, retenus)
        if (octets > maxBuffer) throw erreurNommee('ENOBUFS', `capture supérieure à ${maxBuffer} octets`)
      } catch (e) { erreur = e; demanderArret(e) }
    }
    const lireStdout = (bytes) => capturer(bytes, decodeStdout, (texte) => { stdout += texte })
    const lireStderr = (bytes) => capturer(bytes, decodeStderr, (texte) => { stderr += texte })
    let fin
    try {
      ({ hote, controle } = await superviser(commande ?? process.execPath, argv, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'],
        shell: commande === 'npm' && process.platform === 'win32', delaiArretMs, signal: signalLancement }))
      hote.stdout?.on('data', lireStdout); hote.stderr?.on('data', lireStderr)
      surControle?.(controle)
      const receptionPid = controle.pret.then(({ pidCible }) => surPid?.(pidCible)).catch((e) => { if (controle.pid !== null) { erreur ??= e; demanderArret(e) } })
      if (expiree) demanderArret(erreurNommee('ETIMEDOUT', `échéance ${limiteMs} ms`))
      if (annulee || annulation?.aborted) annuler()
      fin = await controle.fin
      await receptionPid
    } catch (e) {
      erreur ??= e
      if (controle) { demanderArret(e); fin = await controle.fin }
    } finally {
      clearTimeout(minuterie); annulation?.removeEventListener('abort', annuler)
      hote?.stdout?.removeListener('data', lireStdout); hote?.stderr?.removeListener('data', lireStderr)
      closeSync(fd)
    }
    if (fluxDistincts) { stdout += decodeStdout.end(); stderr += decodeStderr.end() }
    sortie += decodeSortie.end()
    const { status = null, signal = null, error } = fin?.resultatCible ?? {}
    if (error) erreur ??= erreurNommee(error.code, error.message)
    const arret = fin?.arret ?? arretIndetermine({ operation: 'lancement', cause: erreur, message: 'superviseur sans fin native : arrêt non prouvé' })
    if (arret.etat !== 'mort') erreur ??= erreurNommee('ARRET_INDETERMINE', 'zéro natif non confirmé')
    return { code: erreur || expiree || annulee || arret.etat !== 'mort' ? 1 : codeEnfant(status, signal), status, signal, error: erreur,
      stdout, stderr, expiree, annulee, arret, controle, fichier, sortie, limiteMs, pid: controle?.pid ?? undefined }
  }
  return reessayerAuChargement(unEssai, { site: site ?? fichier, signal: annulation })
}
