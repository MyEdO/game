// SYNCHRONISEUR DU PRINCIPAL (#2187) : l'arbre principal avance de sa tête B à `origin/main` U sans
// geste manuel, sans perdre une écriture locale, et refuse par un état NOMMÉ ce qu'il ne sait pas faire
// sans perte. Design jugé : `.git/suivi/2187-design-synchroniseur-verdict-2026-10-07.md` (#2187,
// commentaire 6026872846), ordre exact des étapes 1 à 10.
//
// Limite nommée : un écrivain NON git entre la comparaison et l'écriture d'un W′, et un ignoré créé
// entre la capture et `read-tree`, ne sont pas exclus (verdict, D4 (b) et (c)).
//
// Le post-merge de l'avance court en FOND (#2493, `.git/suivi/2493-design-verdict-2026-10-08.md`) : la plage
// due vit dans `<git-common-dir>/synchro-consommateurs/du.json`, un consommateur détaché (`--consommer`) la
// joue et la solde.
//
// Usage : `npm run ops:synchroniser [-- --json]`, `[-- --mesurer [--visee <sha>] --json]` (ni fetch, ni
// verrou, ni écriture), `[-- --consommer]` (le consommateur), depuis n'importe quel worktree du dépôt.
import { randomUUID, createHash } from 'node:crypto'
import { accessSync, appendFileSync, closeSync, constants as fsConstants, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import {
  GitIndisponible, INDEX, TIMEOUT_DU_DISTANT_MS, TIMEOUT_DU_HOOK_MS, TIMEOUT_READ_TREE_MS, TRONC, ajoutDe, arbrePrincipal, attributsDe, avancerArbre, brancheDe, ceQuiChange, ceriseDe,
  cheminGit, cheminsIgnores, combienDe, contenuDuBlob, depotDe, ecrireBlob, entreesDe, estAncetre, etatDeLArbre, fetchOrigin,
  fusionDiff3, fusionnesEnCours, lancerHook, poserDansIndex, poserRef, rafraichirIndex, rebaseEntame, refusDeGit,
  reussi, shaDe, shasDuTravail, transactionDeRefs,
} from '../guards/lib/gitPorte.mjs'
import { renommerResilient } from '../guards/lib/renommageResilient.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { estPidVivant, prendreVerrouAsync, sousEcheanceAsync } from '../test/verrou.mjs'
import { verrouOutillageDe } from '../hooks/barriere-outil.mjs'

/** Les chemins dont un changement B..U ne prend effet qu'à la PROCHAINE session d'un client (verdict, D2). */
export const CONFIGURATION_CLIENT = Object.freeze([/^\.claude\/settings\.json$/, /^\.codex\/hooks\.json$/, /^\.claude\/skills\/harnais\//])

/** Les points d'arrêt `gestes.etape(nom)` des étapes 4 à 10 du verdict, dans l'ordre (#2493, verdict §2) ;
 *  la capture (étape 3) et la reprise reconnue (avant sa transaction) ont les leurs, `capture` et
 *  `reprise`, hors de cette liste. */
export const ETAPES = Object.freeze(['transaction', 'travail', 'arbre', 'index', 'commit', 'liberation', 'consommateurs'])

/** L'attente bornée des verrous (`synchro.verrou`, `index.lock`, verrous de refs d'une reprise) : un essai
 *  tous les `pasMs`, une annonce au premier refus puis au plus une par `annonceMs` (`annonceEspacee`). */
export const ATTENTE = Object.freeze({ echeanceMs: 120_000, pasMs: 200, annonceMs: 5_000 })

/** L'âge (ms) au-delà duquel le tenant de `synchro.verrou` est PÉRIMÉ, vivant ou non (#2493, verdict §2). */
export const BORNE_DU_VERROU_MS = ATTENTE.echeanceMs + TIMEOUT_DU_DISTANT_MS + TIMEOUT_READ_TREE_MS + 60_000

/** L'âge (ms) au-delà duquel le tenant du verrou du consommateur est PÉRIMÉ, vivant ou non (#2493, verdict §2). */
export const BORNE_DU_CONSOMMATEUR_MS = TIMEOUT_DU_HOOK_MS + ATTENTE.echeanceMs + 60_000

/** Le tenant que porte le verrou `chemin` (`verrou.mjs`), `null` s'il est absent, illisible ou sans PID. */
function tenantDe(chemin) {
  try {
    const lu = JSON.parse(readFileSync(chemin, 'utf8'))
    return Number.isInteger(lu?.pid) ? lu : null
  } catch {
    return null
  }
}

/** L'âge (s) d'un tenant à l'`horloge`, `null` sans date lisible. PURE. */
const ageDe = (tenant, horloge) => {
  const date = Date.parse(tenant?.date ?? '')
  return Number.isFinite(date) ? Math.round((horloge() - date) / 1000) : null
}

/**
 * Le `estVivant` d'une prise du verrou `chemin` : `estVivant(pid)`, et le tenant `pid` relu n'a pas dépassé
 * `borneMs` d'âge.
 * @param {string} chemin @param {number} borneMs @param {(pid: number) => boolean} estVivant @param {() => number} horloge
 */
const vivantSousBorne = (chemin, borneMs, estVivant, horloge) => (/** @type {number} */ pid) => {
  if (!estVivant(pid)) return false
  const tenant = tenantDe(chemin)
  const age = tenant?.pid === pid ? ageDe(tenant, horloge) : null
  return age === null || age * 1000 <= borneMs
}

/** La date de modification ISO du fichier `chemin`, `null` s'il manque. */
function mtimeDe(chemin) {
  try {
    return statSync(chemin).mtime.toISOString()
  } catch {
    return null
  }
}

/**
 * Le `estVivant` d'une prise du verrou `chemin` (`vivantSousBorne`, sans borne si `borneMs` est `null`) qui
 * CONSIGNE dans `orphelins` (clé `chemin`) son tenant jugé absent (#2493) : `PID mort`, ou `âge > borne`.
 * @param {string} chemin @param {number | null} borneMs @param {(pid: number) => boolean} estVivant @param {() => number} horloge
 * @param {Map<string, Orphelin>} orphelins
 */
const consignant = (chemin, borneMs, estVivant, horloge, orphelins) => (/** @type {number} */ pid) => {
  const tenant = tenantDe(chemin)
  const vivant = borneMs === null ? estVivant(pid) : vivantSousBorne(chemin, borneMs, estVivant, horloge)(pid)
  if (!vivant && tenant?.pid === pid) {
    orphelins.set(chemin, { verrou: chemin, pid, depuis: tenant.date ?? mtimeDe(chemin), preuve: estVivant(pid) ? 'âge > borne' : 'PID mort' })
  }
  return vivant
}

/** @typedef {{ verrou: string, pid: number, depuis: string | null, preuve: 'jeton du journal' | 'PID mort' | 'âge > borne' }} Orphelin */

/** Les orphelins `orphelins` nommés : `<nom> (PID p mort depuis d, preuve)`, joints par `, `. PURE. @param {Orphelin[]} orphelins */
const nomDesOrphelins = (orphelins) => orphelins
  .map((o) => `${basename(o.verrou)} (PID ${o.pid}${o.preuve === 'âge > borne' ? '' : ' mort'} depuis ${o.depuis ?? '?'}, ${o.preuve})`).join(', ')

/** `verrou tenu par le PID p depuis d (a s)` : le tenant d'un verrou, à l'`horloge`. */
const tenuPar = (tenant, horloge) => `verrou tenu par le PID ${tenant?.pid ?? '?'} depuis ${tenant?.date ?? '?'} (${ageDe(tenant, horloge) ?? '?'} s)`

/** `annoncer` au premier appel, puis au plus une fois par `intervalleMs` de `horloge`. */
export function annonceEspacee(annoncer, horloge, intervalleMs) {
  let derniere = -Infinity
  return (/** @type {string} */ texte) => {
    const maintenant = horloge()
    if (maintenant - derniere < intervalleMs) return
    derniere = maintenant
    annoncer(texte)
  }
}

/** Le dossier des dépôts de conflit, hors de `synchro/` que lit `journalEnCours`. */
const CONFLITS = 'synchro-conflits'

/** Les états d'opération git qu'un avancement ne traverse pas (`wt-status.c`, `wt_status_get_state`). */
const OPERATIONS = Object.freeze(['CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG'])

/** Les valeurs de l'attribut `merge` sous lesquelles git fusionne en texte (`git help gitattributes`, « merge »). */
const FUSION_TEXTE = new Set(['unspecified', 'set'])

/** Les lignes d'un texte, fin de ligne comprise. PURE. @param {string} texte */
const lignesDe = (texte) => texte.match(/[^\n]*\n|[^\n]+$/g) ?? []

/** La ligne sans sa fin. PURE. @param {string} ligne */
const nue = (ligne) => ligne.replace(/\r?\n$/, '')

/** `petite` est-elle une SOUS-SUITE ordonnée de `grande` (lignes comparées sans leur fin) ? PURE. */
function estSousSuite(petite, grande) {
  let i = 0
  for (const ligne of grande) if (i < petite.length && nue(petite[i]) === nue(ligne)) i += 1
  return i === petite.length
}

/**
 * La taille des marqueurs de conflit (`--marker-size`, `git help merge-file`) qu'aucune ligne de `textes`
 * n'imite : 1 + la plus longue suite de `<`, `=`, `>` ou `|` en tête de ligne, 7 au moins. PURE.
 * @param {...(string | Buffer)} textes
 */
export function tailleDeMarqueur(...textes) {
  let plusLongue = 0
  for (const texte of textes) {
    for (const [suite] of String(texte).matchAll(/^(?:<+|=+|>+|\|+)/gm)) plusLongue = Math.max(plusLongue, suite.length)
  }
  return Math.max(7, plusLongue + 1)
}

/** Le marqueur de conflit (`<`, `|`, `=` ou `>` répété `taille` fois) qui ouvre `ligne`, `null` sinon. PURE. */
const marqueurDe = (ligne, taille) => new RegExp(`^(<{${taille}}|\\|{${taille}}|={${taille}}|>{${taille}})(?: |\\r?\\n|$)`).exec(ligne)?.[1][0] ?? null

/**
 * La sortie `merge-file -p --diff3` dont chaque bloc en conflit à base VIDE, où un côté est une
 * sous-suite ordonnée de l'autre, est résolu par le PLUS LONG (verdict, D3) ; `null` dès qu'un bloc
 * ne l'est pas ; `taille` = celle des marqueurs (`tailleDeMarqueur`). PURE.
 * @param {string} texte @param {number} taille @returns {string | null}
 */
export function resoudreBaseVide(texte, taille) {
  const sortie = []
  /** @type {{ local: string[], base: string[], amont: string[] } | null} */
  let bloc = null
  let cote = 'local'
  for (const ligne of lignesDe(texte)) {
    const marqueur = marqueurDe(ligne, taille)
    if (!bloc) {
      if (marqueur === '<') [bloc, cote] = [{ local: [], base: [], amont: [] }, 'local']
      else sortie.push(ligne)
      continue
    }
    if (marqueur === '|' && cote === 'local') cote = 'base'
    else if (marqueur === '=' && cote !== 'amont') cote = 'amont'
    else if (marqueur === '>' && cote === 'amont') {
      const { local, base, amont } = bloc
      if (base.length) return null
      if (estSousSuite(local, amont)) sortie.push(...amont)
      else if (estSousSuite(amont, local)) sortie.push(...local)
      else return null
      bloc = null
    } else bloc[/** @type {'local' | 'base' | 'amont'} */ (cote)].push(ligne)
  }
  return bloc ? null : sortie.join('')
}

/** L'empreinte d'un fichier, `null` s'il est absent. @param {string} chemin */
const empreinteDe = (chemin) => (existsSync(chemin) ? createHash('sha256').update(readFileSync(chemin)).digest('hex') : null)

/** Les octets d'un fichier de l'arbre, `null` s'il est absent. @param {string} chemin */
const octetsDe = (chemin) => (existsSync(chemin) ? readFileSync(chemin) : null)

/** Les octets `lus` (`null` = absent) sont-ils ceux d'`attendu` (base64 du journal, `null` = absent) ? PURE. */
const memes = (/** @type {Buffer | null} */ lus, /** @type {string | null} */ attendu) =>
  lus === null ? attendu === null : attendu !== null && lus.equals(Buffer.from(attendu, 'base64'))


/**
 * Synchronise l'arbre PRINCIPAL du dépôt de `depuis` sur `origin/main`. REND un état nommé :
 * `avance`, `avance-non-prete` (hook `post-merge` en échec), `a-jour`, ou un refus `branche-etrangere`,
 * `operation-en-cours`, `origin-indisponible`, `divergent`, `occupe`, `conflit`, `collision-ignore`,
 * `ecriture-concurrente`, `reprise-impossible`, ou `git-indisponible` quand git ne répond pas (avec
 * `journal` si l'avance est entamée : la reprise le relira), ou `interrompu` : l'avance arrêtée en cours
 * de route, `journal` et `verrous` conservés, que le passage suivant reprend. Un `conflit` dépose ses
 * versions sous `<git-common-dir>/synchro-conflits/<U>/` (`versions`) ; `avance` et `a-jour` purgent ces
 * dépôts. `env` : l'environnement de git ; `gestes` : `etape(nom)` après chaque étape d'`ETAPES`,
 * `estVivant` et `attente` des verrous (mesure), UNE échéance pour `synchro.verrou` puis `index.lock` ;
 * `annoncer(texte)` : chaque attente d'un verrou tenu. Une reprise conclue ENCHAÎNE un passage complet
 * (`synchroniser`, fetch compris) sous le même verrou et la même échéance (`enchainer`). Le consommateur est
 * lancé UNE fois, en fin de passage, après toutes ses avances, dès qu'une plage est due et qu'aucun journal
 * ne reste en cours : l'état rendu, refus compris, porte `consommateurs` (`lancerConsommateur`) ;
 * `consommateur` : le script lancé en fond, celui du principal par défaut. Chaque verrou repris à un
 * détenteur absent est nommé dans `orphelins` (`Orphelin`).
 * @param {{ depuis?: string, env?: NodeJS.ProcessEnv, horloge?: () => number, annoncer?: (texte: string) => void, consommateur?: string,
 *   gestes?: { etape?: (nom: string) => void | Promise<void>, estVivant?: (pid: number) => boolean, attente?: { echeanceMs: number, pasMs: number, annonceMs?: number } } }} [p]
 */
export async function synchroniserPrincipal({ depuis = process.cwd(), env, gestes = {}, horloge = Date.now, annoncer = () => {}, consommateur } = {}) {
  const { etape = () => {}, estVivant = estPidVivant } = gestes
  const attente = { ...ATTENTE, ...gestes.attente }
  const racine = arbrePrincipal(depotDe(depuis, { env }))
  if (!racine.disponible) return { etat: 'git-indisponible', raison: racine.raison }
  const depot = depotDe(racine.valeur, { env })
  const commun = join(racine.valeur, '.git')
  const debut = horloge()
  const cheminDuVerrou = join(commun, 'synchro.verrou')
  /** @type {Map<string, Orphelin>} */
  const orphelinDuVerrou = new Map()
  const verrou = await prendreVerrouAsync({
    chemin: cheminDuVerrou, libelle: 'synchronisation du principal', commande: 'ops:synchroniser',
    cwd: racine.valeur, estVivant: consignant(cheminDuVerrou, BORNE_DU_VERROU_MS, estVivant, horloge, orphelinDuVerrou), horloge,
    attente: { ...attente, annoncer: ((dire) => (tenant) => dire(`[synchroniser] ${tenuPar(tenant, horloge)}`))(annonceEspacee(annoncer, horloge, attente.annonceMs)) },
  })
  if (verrou.etat !== 'pris') return { etat: 'occupe', message: verrou.message, tenant: verrou.tenant ?? null, ageS: ageDe(verrou.tenant, horloge) }
  /** @type {any} */
  const ctx = {
    depot, racine: racine.valeur, commun, index: '', verrouIndex: '', jeton: null, etape, attente, debut, horloge, estVivant,
    annoncer: annonceEspacee(annoncer, horloge, attente.annonceMs), tx: null, outillage: null, env,
    consommateur: consommateur ?? join(racine.valeur, 'scripts', 'ops', 'synchroniser.mjs'), orphelins: [...orphelinDuVerrou.values()],
  }
  const avecOrphelins = (vu) => (ctx.orphelins.length ? { ...vu, orphelins: ctx.orphelins } : vu)
  try {
    const relatif = cheminGit(depot, 'index')
    if (!relatif) throw new GitIndisponible('chemin de l’index non rendu')
    ctx.index = resolve(racine.valeur, relatif)
    ctx.verrouIndex = `${ctx.index}.lock`
    const journal = journalEnCours(commun)
    const repris = journal ? await reprendre(ctx, journal) : null
    const vu = repris === null ? await synchroniser(ctx)
      : repris.etat === 'avance' ? enchainer(repris, await synchroniser(ctx))
        : repris
    if (vu.etat === 'avance' || vu.etat === 'a-jour') rmSync(join(commun, CONFLITS), { recursive: true, force: true })
    if (journalEnCours(commun) !== null) return avecOrphelins(vu)
    const consommateurs = await lancerConsommateur(ctx)
    await ctx.etape('consommateurs')
    return avecOrphelins(avecConsommateurs(vu, consommateurs))
  } catch (e) {
    const indisponible = e instanceof GitIndisponible
    if (!indisponible && ctx.jeton === null) throw e
    await abandonner(ctx)
    const laisse = journalEnCours(commun)
    const journal = laisse ? { journal: cheminDuJournal(ctx, laisse.vers) } : {}
    if (indisponible) return avecOrphelins({ etat: 'git-indisponible', raison: e.raison, ...journal })
    const verrous = octetsDe(ctx.verrouIndex)?.toString('utf8') === ctx.jeton ? [ctx.verrouIndex] : []
    return avecOrphelins({ etat: 'interrompu', raison: String(/** @type {any} */ (e)?.stack ?? e), ...journal, verrous })
  } finally {
    libererOutillage(ctx)
    verrou.liberer()
  }
}


/**
 * La reprise conclue `repris` suivie du passage `suite` : une avance de `repris.de` au dernier `vers`,
 * `reprise` = la plage reprise ; un refus de `suite` est rendu tel quel. PURE.
 */
function enchainer(repris, suite) {
  const reprise = { de: repris.de, vers: repris.vers }
  if (suite.etat === 'a-jour') return { ...repris, reprise }
  if (suite.etat !== 'avance') return suite
  const configuration = [...new Set([...(repris.configurationClientChangee ?? []), ...(suite.configurationClientChangee ?? [])])]
  return { ...suite, de: repris.de, configurationClientChangee: configuration, reprise }
}

/** Le dossier du journal de l'avance vers U (journal, index de transport et candidat). */
const dossierDe = (ctx, vers) => join(ctx.commun, 'synchro', vers)

/** Le fichier du journal de l'avance vers U. */
const cheminDuJournal = (ctx, vers) => join(dossierDe(ctx, vers), 'journal.json')

/** La transaction de refs ouverte ABANDONNÉE (`abort`), s'il y en a une. */
async function abandonner(ctx) {
  const tx = ctx.tx
  ctx.tx = null
  if (tx) await tx.abort()
}

/** L'attente d'un verrou sous l'échéance UNIQUE du passage (`ctx.debut`), `annoncer` à chaque refus. */
const attenteRestante = (ctx, annoncer) => ({ echeanceMs: ctx.debut + ctx.attente.echeanceMs - ctx.horloge(), pasMs: ctx.attente.pasMs, annoncer })

/** Le journal laissé par un synchroniseur mort, `null` s'il n'y en a pas. @param {string} commun */
function journalEnCours(commun) {
  const racine = join(commun, 'synchro')
  if (!existsSync(racine)) return null
  for (const nom of readdirSync(racine)) {
    const chemin = join(racine, nom, 'journal.json')
    if (existsSync(chemin)) return JSON.parse(readFileSync(chemin, 'utf8'))
  }
  return null
}

/** Le journal écrit d'un seul geste (`ecrireJsonAtomique`). */
const ecrireJournal = (ctx, journal) => ecrireJsonAtomique(cheminDuJournal(ctx, journal.vers), journal)

/** Un essai de prise d'`index.lock` (`wx`) sous `jeton` : `cree`, `repris` s'il porte déjà `jetonConnu`, `tenu` sinon. */
function prendreVerrouIndexUneFois(ctx, jeton, jetonConnu) {
  try {
    const fd = openSync(ctx.verrouIndex, 'wx')
    try {
      writeSync(fd, jeton)
    } finally {
      closeSync(fd)
    }
    return 'cree'
  } catch (e) {
    if (/** @type {any} */ (e)?.code !== 'EEXIST') throw e
  }
  return jetonConnu !== null && octetsDe(ctx.verrouIndex)?.toString('utf8') === jetonConnu ? 'repris' : 'tenu'
}

/**
 * `index.lock` pris sous le `jeton` (`prendreVerrouIndexUneFois`), rejoué jusqu'à l'échéance du passage
 * (`attenteRestante`). REND `cree` ou `repris` (`ctx.jeton` posé), ou `tenu` à échéance.
 * @returns {Promise<'cree' | 'repris' | 'tenu'>}
 */
async function prendreVerrouIndex(ctx, jeton, jetonConnu = null) {
  const vu = await sousEcheanceAsync({
    attente: attenteRestante(ctx, () => ctx.annoncer(`[synchroniser] index.lock tenu : ${ctx.verrouIndex}`)),
    horloge: ctx.horloge,
    essai: () => prendreVerrouIndexUneFois(ctx, jeton, jetonConnu),
    abouti: (etat) => etat !== 'tenu',
  })
  if (vu !== 'tenu') ctx.jeton = jeton
  return vu
}

/** `index.lock` retiré s'il porte encore `jeton`. */
function libererVerrouIndex(ctx, jeton) {
  if (octetsDe(ctx.verrouIndex)?.toString('utf8') === jeton) rmSync(ctx.verrouIndex, { force: true })
}

/** Le refus d'opération : HEAD hors `main`, ou une opération git entamée. `null` sinon. */
function refusDEtat(depot, racine) {
  const branche = brancheDe(depot)
  if (branche !== TRONC.nom) return { etat: 'branche-etrangere', branche }
  const operations = [
    ...(fusionnesEnCours(depot).length ? ['MERGE_HEAD'] : []),
    ...[rebaseEntame(depot)].filter((r) => r !== null),
    ...OPERATIONS.filter((nom) => {
      const chemin = cheminGit(depot, nom)
      return chemin !== null && existsSync(resolve(racine, chemin))
    }),
  ]
  return operations.length ? { etat: 'operation-en-cours', operations } : null
}

/** Le premier passage : mesure, verrous, capture, puis `avancer`. */
async function synchroniser(ctx) {
  const { depot } = ctx
  const recu = fetchOrigin(depot)
  if (!reussi(recu)) return { etat: 'origin-indisponible', raison: refusDeGit(recu) }
  const refus = refusDEtat(depot, ctx.racine)
  if (refus) return refus
  const de = shaDe(depot, 'HEAD')
  const vers = shaDe(depot, TRONC.suivi)
  if (!de) throw new GitIndisponible('HEAD ne nomme aucun commit')
  if (!vers) return { etat: 'origin-indisponible', raison: `${TRONC.suivi} absent après fetch` }
  if (de === vers) return { etat: 'a-jour', sha: de }
  const ancetre = estAncetre(depot, de, vers)
  if (!ancetre.disponible) throw new GitIndisponible(ancetre)
  if (!('valeur' in ancetre) || !ancetre.valeur) return { etat: 'divergent', de, vers, cerise: ceriseDe(depot, vers, de) }
  const jeton = randomUUID()
  if ((await prendreVerrouIndex(ctx, jeton)) === 'tenu') {
    return { etat: 'operation-en-cours', operations: ['index.lock'], raison: `Unable to create '${ctx.verrouIndex}': File exists.` }
  }
  let applique = false
  try {
    const refusApres = refusDEtat(depot, ctx.racine) ?? (shaDe(depot, 'HEAD') === de ? null : { etat: 'ecriture-concurrente', raison: 'HEAD a bougé' })
    if (refusApres) return finir(ctx, { jeton, vers }, refusApres)
    mkdirSync(dossierDe(ctx, vers), { recursive: true })
    const capture = capturer(ctx, de, vers)
    if ('refus' in capture) return finir(ctx, { jeton, vers }, capture.refus)
    const journal = { pid: process.pid, jeton, de, vers, empreinteIndex: empreinteDe(ctx.index), empreinteCandidat: null, etape: 'capture', ...capture }
    ecrireJournal(ctx, journal)
    applique = true
    await ctx.etape('capture')
    return await avancer(ctx, journal, [])
  } finally {
    if (!applique && existsSync(ctx.verrouIndex)) {
      libererVerrouIndex(ctx, jeton)
      oublierJournal(ctx, vers)
    }
  }
}

/** Le refus ou le succès qui CLÔT un passage : `index.lock` libéré, journal supprimé (étape 10). */
async function finir(ctx, journal, resultat) {
  libererVerrouIndex(ctx, journal.jeton)
  await ctx.etape('liberation')
  oublierJournal(ctx, journal.vers)
  return resultat
}

/**
 * L'avance arrêtée APRÈS une écriture que la reprise sait finir : transaction de refs abandonnée,
 * `index.lock` et journal CONSERVÉS et nommés ; le passage suivant reprend (`reprendre`).
 */
async function interrompre(ctx, journal, raison, details = {}) {
  await abandonner(ctx)
  return { etat: 'interrompu', raison, journal: cheminDuJournal(ctx, journal.vers), verrous: [ctx.verrouIndex], ...details }
}

/** Le dossier du journal vers `vers` supprimé, puis `synchro/` s'il est vide. */
function oublierJournal(ctx, vers) {
  rmSync(dossierDe(ctx, vers), { recursive: true, force: true })
  try {
    rmdirSync(join(ctx.commun, 'synchro'))
  } catch (e) {
    if (!['ENOTEMPTY', 'ENOENT', 'EEXIST'].includes(/** @type {any} */ (e)?.code)) throw e
  }
}

/** Une entrée d'image sérialisable, `null` absente. */
const entree = (e) => (e ? { mode: e.mode, sha: e.sha } : null)

/**
 * La CAPTURE (étape 3) : D = chemins changés B..U ; P = ceux de D que l'arbre a salis, chacun avec ses
 * candidats W′ et S′ (`candidatDe`) ; D\P avec leurs entrées B et U. Un refus `collision-ignore` ou
 * `conflit` nomme ses chemins.
 */
function capturer(ctx, de, vers) {
  const { depot } = ctx
  const D = ceQuiChange(depot, de, vers).chemins()
  const sales = new Set(etatDeLArbre(depot).map((e) => e.chemins[0]))
  const [b, u, s] = [entreesDe(depot, de, D), entreesDe(depot, vers, D), entreesDe(depot, INDEX, D)]
  const ignores = cheminsIgnores(depot, D.filter((p) => !b.has(p) && !s.has(p) && !sales.has(p) && existsSync(join(ctx.racine, p))))
  if (ignores.size) return { refus: { etat: 'collision-ignore', chemins: [...ignores] } }
  const P = D.filter((p) => sales.has(p))
  const attributs = attributsDe(depot, P, 'merge')
  const conflits = []
  const chemins = []
  for (const p of P) {
    const vu = candidatDe(ctx, { p, b: b.get(p) ?? null, u: u.get(p) ?? null, s: s.get(p) ?? null, attribut: attributs.get(p) ?? 'unspecified', de, vers })
    if ('conflit' in vu) conflits.push({ chemin: p, raison: vu.conflit, proposition: vu.proposition ?? vu.conflit, b: b.get(p) ?? null, u: u.get(p) ?? null })
    else chemins.push(vu)
  }
  if (conflits.length) {
    return { refus: { etat: 'conflit', chemins: conflits.map(({ chemin, raison }) => ({ chemin, raison })), versions: deposerConflits(ctx, de, vers, conflits) } }
  }
  const horsP = D.filter((p) => !sales.has(p)).map((p) => ({ chemin: p, b: entree(b.get(p)), u: entree(u.get(p)) }))
  const configuration = D.filter((p) => CONFIGURATION_CLIENT.some((re) => re.test(p)))
  return { chemins, horsP, configuration }
}

/**
 * Les versions de chaque chemin en `conflit`, déposées sous `<git-common-dir>/synchro-conflits/<vers>/<chemin>/` :
 * `base` (B, ou le blob du commit qui ajoute le chemin), `amont` (U), `locale` (l'arbre) — chacune si elle
 * existe — et `proposition` (sortie `merge-file --diff3`, ou la raison du conflit). REND le dossier.
 */
function deposerConflits(ctx, de, vers, conflits) {
  const racine = join(ctx.commun, CONFLITS, vers)
  rmSync(racine, { recursive: true, force: true })
  for (const { chemin, proposition, b, u } of conflits) {
    const dossier = join(racine, ...chemin.split('/'))
    mkdirSync(dossier, { recursive: true })
    const ajout = b ? null : ajoutDe(ctx.depot, de, vers, chemin)
    const base = b ?? (ajout ? entreesDe(ctx.depot, ajout, [chemin]).get(chemin) ?? null : null)
    if (base) writeFileSync(join(dossier, 'base'), contenuDuBlob(ctx.depot, base.sha, { chemin }))
    if (u) writeFileSync(join(dossier, 'amont'), contenuDuBlob(ctx.depot, u.sha, { chemin }))
    const locale = octetsDe(join(ctx.racine, chemin))
    if (locale) writeFileSync(join(dossier, 'locale'), locale)
    writeFileSync(join(dossier, 'proposition'), proposition)
  }
  return racine
}

/**
 * Les candidats d'un chemin p de P (verdict, D3) : S′ = fusion(S, base, U), W′ = fusion(W, S, S′),
 * base = B, ou le blob du DERNIER commit de B..U qui ajoute p. `{ conflit }` sinon.
 */
function candidatDe(ctx, { p, b, u, s, attribut, de, vers }) {
  const { depot } = ctx
  const travail = octetsDe(join(ctx.racine, p))
  const capture = (wPrime, sPrime) => ({ chemin: p, w: travail?.toString('base64') ?? null, wPrime: wPrime?.toString('base64') ?? null, s: entree(s), sPrime: entree(sPrime), u: entree(u) })
  if (!u) {
    if (travail === null && (!s || (b !== null && s.sha === b.sha))) return capture(null, null)
    return { conflit: 'supprimé en amont, modifié chez nous' }
  }
  if (travail === null || (b && !s)) return { conflit: 'supprimé chez nous, modifié en amont' }
  const ajout = b ? null : ajoutDe(depot, de, vers, p)
  const base = b ?? (ajout ? entreesDe(depot, ajout, [p]).get(p) ?? null : null)
  if (!base) return { conflit: `aucune base de ${p} dans ${de}..${vers}` }
  const fusionnable = FUSION_TEXTE.has(attribut)
  let sPrime = u
  if (s && s.sha !== base.sha && s.sha !== u.sha) {
    if (!fusionnable) return { conflit: `attribut merge=${attribut}` }
    const fusion = fusionner(ctx, p, contenuDuBlob(depot, s.sha), contenuDuBlob(depot, base.sha), contenuDuBlob(depot, u.sha))
    if ('conflit' in fusion) return fusion
    const blob = ecrireBlob(depot, fusion.octets)
    if (!reussi(blob)) throw new GitIndisponible(blob.disponible ? refusDeGit(blob) : blob)
    sPrime = { mode: u.mode, sha: String(blob.valeur.stdout).trim() }
  }
  const sw = s ?? base
  const empreinte = shasDuTravail(depot, [p]).get(p)
  if (empreinte === sPrime.sha) return capture(travail, sPrime)
  if (empreinte === sw.sha) return capture(contenuDuBlob(depot, sPrime.sha, { chemin: p }), sPrime)
  if (!fusionnable) return { conflit: `attribut merge=${attribut}` }
  const fusion = fusionner(ctx, p, travail, contenuDuBlob(depot, sw.sha, { chemin: p }), contenuDuBlob(depot, sPrime.sha, { chemin: p }))
  return 'conflit' in fusion ? fusion : capture(fusion.octets, sPrime)
}

/** `merge-file --diff3` de trois versions, puis `resoudreBaseVide`. `{ octets }`, ou `{ conflit, proposition? }`
 *  qui porte le texte à marqueurs. */
function fusionner(ctx, p, local, base, amont) {
  const dossier = join(ctx.commun, 'synchro', 'fusion')
  mkdirSync(dossier, { recursive: true })
  const fichiers = { ours: join(dossier, 'local'), base: join(dossier, 'base'), theirs: join(dossier, 'amont') }
  writeFileSync(fichiers.ours, local)
  writeFileSync(fichiers.base, base)
  writeFileSync(fichiers.theirs, amont)
  try {
    const taille = tailleDeMarqueur(local, base, amont)
    const vu = fusionDiff3(ctx.depot, fichiers, { ours: 'local', base: 'base', theirs: 'amont' }, taille)
    if ('binaire' in vu) return { conflit: 'binaire' }
    const texte = vu.conflit ? resoudreBaseVide(vu.texte, taille) : vu.texte
    return texte === null ? { conflit: `fusion de ${p} en conflit`, proposition: vu.texte } : { octets: Buffer.from(texte, 'utf8') }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

/** Les étapes 4 et sa revalidation : la transaction ouverte, `{ tx }` ou `{ refus }` (transaction abandonnée). */
async function ouvrirTransaction(ctx, journal) {
  const tx = transactionDeRefs(ctx.depot, { message: `synchroniser: ${journal.de}..${journal.vers}` })
  ctx.tx = tx
  for (const ordre of [() => tx.start(), () => tx.update('HEAD', journal.vers, journal.de), () => tx.prepare()]) {
    const vu = await ordre()
    if (!vu.ok) {
      await abandonner(ctx)
      return { refus: { etat: 'operation-en-cours', operations: ['refs'], raison: vu.raison } }
    }
  }
  const branche = brancheDe(ctx.depot)
  if (branche !== TRONC.nom) {
    await abandonner(ctx)
    return { refus: { etat: 'branche-etrangere', branche } }
  }
  await ctx.etape('transaction')
  return { tx }
}

/** Les W′ déjà posés, remis à W (CAS inverse). */
function defaire(ctx, ecrits) {
  for (const c of ecrits) {
    const chemin = join(ctx.racine, c.chemin)
    if (memes(octetsDe(chemin), c.wPrime)) writeFileSync(chemin, Buffer.from(c.w, 'base64'))
  }
}

/**
 * Les étapes 4 à 10 depuis le `journal` ; `aU` = les chemins de D\P déjà à U (reprise).
 */
async function avancer(ctx, journal, aU, { reprise = false } = {}) {
  const ouverte = await ouvrirTransaction(ctx, journal)
  if ('refus' in ouverte) return reprise ? refusEnReprise(ctx, journal, ouverte.refus) : finir(ctx, journal, ouverte.refus)
  const { tx } = ouverte
  const ecrits = []
  const echouer = async (resultat) => {
    defaire(ctx, ecrits)
    await abandonner(ctx)
    return finir(ctx, journal, resultat)
  }
  const outillage = await prendreOutillage(ctx)
  if (outillage) return reprise ? interrompre(ctx, journal, outillage.message, { refus: outillage }) : echouer(outillage)
  for (const c of journal.chemins) {
    const chemin = join(ctx.racine, c.chemin)
    const lus = octetsDe(chemin)
    if (memes(lus, c.wPrime)) continue
    if (!memes(lus, c.w)) return echouer({ etat: 'ecriture-concurrente', chemins: [c.chemin] })
    mkdirSync(dirname(chemin), { recursive: true })
    writeFileSync(chemin, Buffer.from(c.wPrime, 'base64'))
    ecrits.push(c)
  }
  ecrireJournal(ctx, { ...journal, etape: 'travail' })
  await ctx.etape('travail')
  const dossier = dossierDe(ctx, journal.vers)
  const transport = join(dossier, 'index.transport')
  rmSync(`${transport}.lock`, { force: true })
  copyFileSync(ctx.index, transport)
  const entrees = [...journal.chemins, ...aU].map((c) => (c.u ? { chemin: c.chemin, ...c.u } : { chemin: c.chemin, retirer: /** @type {true} */ (true) }))
  const pose = poserDansIndex(ctx.depot, { index: transport, entrees })
  if (!reussi(pose)) return echouer({ etat: 'ecriture-concurrente', raison: refusDeGit(pose) })
  const frais = rafraichirIndex(ctx.depot, { index: transport })
  if (!reussi(frais)) return echouer({ etat: 'ecriture-concurrente', raison: refusDeGit(frais) })
  const arbre = avancerArbre(ctx.depot, { index: transport, de: journal.de, vers: journal.vers })
  if (!reussi(arbre)) return echouer({ etat: 'ecriture-concurrente', raison: refusDeGit(arbre) })
  await ctx.etape('arbre')
  const candidat = join(dossier, 'index.candidat')
  copyFileSync(transport, candidat)
  const indexees = journal.chemins.filter((c) => c.sPrime && c.u && c.sPrime.sha !== c.u.sha).map((c) => ({ chemin: c.chemin, ...c.sPrime }))
  if (indexees.length) {
    const vu = poserDansIndex(ctx.depot, { index: candidat, entrees: indexees })
    if (!reussi(vu)) return interrompre(ctx, journal, refusDeGit(vu))
  }
  const avecCandidat = { ...journal, etape: 'candidat', empreinteCandidat: empreinteDe(candidat) }
  ecrireJournal(ctx, avecCandidat)
  renommerResilient(candidat, ctx.index)
  await ctx.etape('index')
  return conclure(ctx, avecCandidat, tx)
}

/** Les étapes 8 à 10 (#2493, verdict §2) : `commit` de la transaction, puis `apresLeCommit`. */
async function conclure(ctx, journal, tx) {
  const vu = await tx.commit()
  ctx.tx = null
  if (!vu.ok) return interrompre(ctx, journal, vu.raison)
  return apresLeCommit(ctx, journal)
}

/** `ORIG_HEAD` = B, journal à `avance`, plage due enregistrée (`enregistrerDu`) ; puis `liberer`. */
async function apresLeCommit(ctx, journal) {
  const orig = poserRef(ctx.depot, 'ORIG_HEAD', journal.de)
  if (!reussi(orig)) throw new GitIndisponible(orig.disponible ? refusDeGit(orig) : orig)
  ecrireJournal(ctx, { ...journal, etape: 'avance' })
  enregistrerDu(ctx, journal)
  await ctx.etape('commit')
  return liberer(ctx, journal)
}

/** L'étape 9 : `index.lock`, journal et outillage libérés ; le consommateur part en fin de passage (`synchroniserPrincipal`). */
async function liberer(ctx, journal) {
  libererVerrouIndex(ctx, journal.jeton)
  oublierJournal(ctx, journal.vers)
  libererOutillage(ctx)
  await ctx.etape('liberation')
  return { etat: 'avance', de: journal.de, vers: journal.vers, configurationClientChangee: journal.configuration }
}

/** Le dossier du consommateur : `du.json` et les logs `<pid>.log`. */
const dossierDesConsommateurs = (commun) => join(commun, 'synchro-consommateurs')

/** La plage due `{ de, vers, du, echec }`. */
const cheminDuDu = (commun) => join(dossierDesConsommateurs(commun), 'du.json')

/** Le verrou du consommateur, sous `.git` : `npm ci` efface `node_modules/.cache`. */
export const verrouDuConsommateur = (commun) => join(commun, 'synchro-consommateurs.verrou')

/** Le log du consommateur `pid`. */
const logDuConsommateur = (commun, pid) => join(dossierDesConsommateurs(commun), `${pid}.log`)

/** La plage due, `null` sans plage ou illisible. @param {string} commun */
function lireDu(commun) {
  try {
    return JSON.parse(readFileSync(cheminDuDu(commun), 'utf8'))
  } catch {
    return null
  }
}

/** La plage due FUSIONNÉE avec l'avance `journal` : `de` et `du` gardés s'ils existent, `vers` = U, `echec` effacé. */
function enregistrerDu(ctx, journal) {
  const lu = lireDu(ctx.commun)
  ecrireJsonAtomique(cheminDuDu(ctx.commun), { de: lu?.de ?? journal.de, vers: journal.vers, du: lu?.du ?? new Date(ctx.horloge()).toISOString(), echec: null })
}

/** Le consommateur `en-cours` de la plage `du` du dossier `commun`, tenu par `tenant`, à l'`horloge`. */
const enCours = (commun, horloge, du, tenant) => ({
  etat: 'en-cours', pid: tenant.pid, depuis: tenant.date, ageS: ageDe(tenant, horloge), de: du.de, vers: du.vers, log: logDuConsommateur(commun, tenant.pid),
})

/** Le consommateur en `echec` de la plage `du`, `null` sans échec posé. PURE. */
const echecDe = (du) => (du.echec ? { etat: 'echec', code: du.echec.code, fin: du.echec.fin, de: du.de, vers: du.vers, log: du.echec.log } : null)

/**
 * Le consommateur de la plage due, appelé UNE fois par passage : aucun sans plage ; `echec` posé sans avance
 * neuve ; `ignore` quand git ignore le hook (`hookIgnore`) ; `en-cours` tenu par un vivant ; sinon LANCÉ,
 * détaché (`lancerDetache`, `--consommer`), le tenant absent de son verrou nommé dans `ctx.orphelins`.
 */
async function lancerConsommateur(ctx) {
  const du = lireDu(ctx.commun)
  if (!du) return null
  if (du.echec) return echecDe(du)
  const ignore = hookIgnore(ctx, 'post-merge')
  if (ignore) return { etat: 'ignore', hook: ignore, de: du.de, vers: du.vers }
  const chemin = verrouDuConsommateur(ctx.commun)
  const tenant = tenantDe(chemin)
  /** @type {Map<string, Orphelin>} */
  const orphelin = new Map()
  if (tenant && consignant(chemin, BORNE_DU_CONSOMMATEUR_MS, ctx.estVivant, ctx.horloge, orphelin)(tenant.pid)) return enCours(ctx.commun, ctx.horloge, du, tenant)
  ctx.orphelins.push(...orphelin.values())
  purgerPerimes({ dossier: dossierDesConsommateurs(ctx.commun), motif: /^\d+\.log$/, ageMs: PEREMPTION_MS })
  const pid = lancerDetache({ script: ctx.consommateur, args: ['--consommer'], cwd: ctx.racine, fdLog: 'ignore', envSupplementaire: ctx.env ?? {} })
  return enCours(ctx.commun, ctx.horloge, du, { pid, date: new Date(ctx.horloge()).toISOString() })
}

/**
 * L'état `vu` et son consommateur : `avance` ou `a-jour` devient `avance-non-prete` pour un hook ignoré par git
 * ou un consommateur en échec ; tout autre état, et tout autre consommateur, porte `consommateurs`. PURE.
 */
function avecConsommateurs(vu, consommateurs) {
  if (!consommateurs) return vu
  if (vu.etat !== 'avance' && vu.etat !== 'a-jour') return { ...vu, consommateurs }
  const { de, vers } = consommateurs
  const configuration = vu.configurationClientChangee ? { configurationClientChangee: vu.configurationClientChangee } : {}
  if (consommateurs.etat === 'ignore') {
    return { etat: 'avance-non-prete', de, vers, ...configuration, code: null, hookIgnore: consommateurs.hook, sortie: `hook présent mais non exécutable, ignoré par git : ${consommateurs.hook}` }
  }
  if (consommateurs.etat === 'echec') return { etat: 'avance-non-prete', de, vers, ...configuration, code: consommateurs.code, log: consommateurs.log, consommateurs }
  return { ...vu, consommateurs }
}

/**
 * Le chemin du hook `nom` (`rev-parse --git-path hooks/<nom>`, `core.hooksPath` compris) PRÉSENT mais que
 * git ignore sans échouer, `null` sinon : hors win32, `access(X_OK)` refusé (`hook.c`, `find_hook`).
 * Sous win32, git lance le fichier sans tester son mode, et un hook sans `#!` sort en 1 (mesuré le
 * 2026-10-07, git 2.51.0.windows.2).
 */
function hookIgnore(ctx, nom) {
  if (process.platform === 'win32') return null
  const relatif = cheminGit(ctx.depot, `hooks/${nom}`)
  if (!relatif) throw new GitIndisponible(`chemin du hook ${nom} non rendu`)
  const chemin = resolve(ctx.racine, relatif)
  if (!existsSync(chemin)) return null
  try {
    accessSync(chemin, fsConstants.X_OK)
    return null
  } catch {
    return chemin
  }
}

/** Les verrous de refs qu'une transaction morte laisserait (`HEAD.lock`, `<branche>.lock`). */
const verrousDeRefs = (ctx) => [join(ctx.commun, 'HEAD.lock'), join(ctx.commun, ...TRONC.branche.split('/')) + '.lock']

/**
 * La REPRISE du journal d'un synchroniseur mort (verdict, « Reprise ») : l'état réel reconnu parmi les
 * états connus, puis une transaction NEUVE ; tout autre état → `reprise-impossible`, qui conserve tout.
 */
async function reprendre(ctx, journal) {
  const { depot } = ctx
  const prise = await prendreVerrouIndex(ctx, journal.jeton, journal.jeton)
  if (prise === 'tenu') {
    return { etat: 'operation-en-cours', operations: ['index.lock'], raison: `Unable to create '${ctx.verrouIndex}': File exists.` }
  }
  if (prise === 'repris') ctx.orphelins.push({ verrou: ctx.verrouIndex, pid: journal.pid, depuis: mtimeDe(ctx.verrouIndex), preuve: 'jeton du journal' })
  const impossible = (raison, { verrous = [], ...details } = {}) => {
    if (prise === 'cree') libererVerrouIndex(ctx, journal.jeton)
    return { etat: 'reprise-impossible', raison, journal: cheminDuJournal(ctx, journal.vers), verrous: prise === 'repris' ? [...verrous, ctx.verrouIndex] : verrous, ...details }
  }
  const perimes = await sousEcheanceAsync({
    attente: attenteRestante(ctx), horloge: ctx.horloge, essai: () => verrousDeRefs(ctx).filter(existsSync), abouti: (tenus) => !tenus.length,
  })
  if (perimes.length) return impossible('verrous de refs périmés', { verrous: perimes })
  if (brancheDe(depot) !== TRONC.nom) return impossible('HEAD hors de main')
  const tete = shaDe(depot, 'HEAD')
  if (tete === journal.vers) return apresLeCommit(ctx, journal)
  if (tete !== journal.de) return impossible(`HEAD = ${tete}, ni ${journal.de} ni ${journal.vers}`)
  const empreinte = empreinteDe(ctx.index)
  const candidat = journal.empreinteCandidat !== null && empreinte === journal.empreinteCandidat
  if (!candidat && empreinte !== journal.empreinteIndex) return impossible('index ni capturé ni candidat')
  const etrangers = journal.chemins.filter((c) => {
    const lus = octetsDe(join(ctx.racine, c.chemin))
    return !memes(lus, c.w) && !memes(lus, c.wPrime)
  }).map((c) => c.chemin)
  if (etrangers.length) return impossible('fichiers ni W ni W′', { chemins: etrangers })
  const presents = journal.horsP.filter((h) => existsSync(join(ctx.racine, h.chemin))).map((h) => h.chemin)
  const shas = shasDuTravail(depot, presents)
  const aU = []
  const hors = []
  for (const h of journal.horsP) {
    const sha = shas.get(h.chemin) ?? null
    if (sha === (h.b?.sha ?? null)) continue
    if (sha === (h.u?.sha ?? null)) aU.push(h)
    else hors.push(h.chemin)
  }
  if (hors.length) return impossible('fichiers ni B ni U', { chemins: hors })
  await ctx.etape('reprise')
  if (!candidat) return avancer(ctx, journal, aU, { reprise: true })
  const ouverte = await ouvrirTransaction(ctx, journal)
  if ('refus' in ouverte) return refusEnReprise(ctx, journal, ouverte.refus)
  const outillage = await prendreOutillage(ctx)
  if (outillage) return interrompre(ctx, journal, outillage.message, { refus: outillage })
  return conclure(ctx, journal, ouverte.tx)
}

/**
 * Le verrou d'outillage du principal (`verrouOutillageDe`, barrière des hooks d'outil) pris sous
 * l'échéance du passage, pour les étapes 5 à 8 ; `liberer` le libère. REND `null` s'il est pris, le
 * refus `occupe` sinon.
 */
async function prendreOutillage(ctx) {
  const chemin = verrouOutillageDe(ctx.racine)
  if (chemin === null) throw new GitIndisponible(`git-dir de ${ctx.racine} illisible`)
  /** @type {Map<string, Orphelin>} */
  const orphelin = new Map()
  const vu = await prendreVerrouAsync({
    chemin, libelle: 'outillage du principal', commande: 'ops:synchroniser', cwd: ctx.racine, estVivant: consignant(chemin, null, ctx.estVivant, ctx.horloge, orphelin), horloge: ctx.horloge,
    attente: attenteRestante(ctx, (tenant) => ctx.annoncer(`[synchroniser] outillage tenu par le PID ${tenant?.pid ?? '?'}`)),
  })
  if (vu.etat !== 'pris') return { etat: 'occupe', message: vu.message, tenant: vu.tenant ?? null }
  ctx.orphelins.push(...orphelin.values())
  ctx.outillage = vu
  return null
}

/** Le verrou d'outillage libéré, s'il est tenu. */
function libererOutillage(ctx) {
  ctx.outillage?.liberer()
  ctx.outillage = null
}

/** La transaction d'une REPRISE refusée : l'état laissé par le mort reste tel quel, `interrompu` le nomme. */
const refusEnReprise = (ctx, journal, refus) => interrompre(ctx, journal, `transaction de refs refusée en reprise : ${refus.etat}`, { refus })

/**
 * Le CONSOMMATEUR (`--consommer`, #2493 verdict §2) : sous son verrou, joue `post-merge` sur la plage due
 * (`ORIG_HEAD` = son `de`) tant qu'elle change, puis la SOLDE sous `synchro.verrou` : supprimée sur un code 0,
 * `echec` posé sinon. Chaque ligne va à `<git-common-dir>/synchro-consommateurs/<pid>.log`, une exception
 * comprise. REND 0, 1 sur une exception.
 * @param {{ depuis?: string, env?: NodeJS.ProcessEnv, horloge?: () => number, estVivant?: (pid: number) => boolean,
 *   attente?: { echeanceMs: number, pasMs: number } }} [p]
 */
export async function consommerLaPlage({ depuis = process.cwd(), env, horloge = Date.now, estVivant = estPidVivant, attente = ATTENTE } = {}) {
  const racine = arbrePrincipal(depotDe(depuis, { env }))
  if (!racine.disponible) throw new GitIndisponible(racine.raison)
  const depot = depotDe(racine.valeur, { env })
  const commun = join(racine.valeur, '.git')
  const log = logDuConsommateur(commun, process.pid)
  mkdirSync(dossierDesConsommateurs(commun), { recursive: true })
  const ecrire = (/** @type {string} */ texte) => appendFileSync(log, `${texte}\n`)
  const iso = () => new Date(horloge()).toISOString()
  const chemin = verrouDuConsommateur(commun)
  /** @type {Map<string, Orphelin>} */
  const orphelin = new Map()
  const prise = await prendreVerrouAsync({
    chemin, libelle: 'consommateur du post-merge', commande: 'ops:synchroniser --consommer', cwd: racine.valeur,
    estVivant: consignant(chemin, BORNE_DU_CONSOMMATEUR_MS, estVivant, horloge, orphelin), horloge,
  })
  if (prise.etat !== 'pris') {
    ecrire(`[consommateurs] déjà en cours : PID ${prise.tenant?.pid ?? '?'} depuis ${prise.tenant?.date ?? '?'}`)
    return 0
  }
  if (orphelin.size) ecrire(`[consommateurs] ${iso()} verrou orphelin repris : ${nomDesOrphelins([...orphelin.values()])}`)
  let tenu = true
  const lacher = () => {
    if (tenu) prise.liberer()
    tenu = false
  }
  try {
    for (;;) {
      const du = lireDu(commun)
      if (!du) return 0
      const orig = poserRef(depot, 'ORIG_HEAD', du.de)
      if (!reussi(orig)) throw new GitIndisponible(orig.disponible ? refusDeGit(orig) : orig)
      const debut = horloge()
      ecrire(`[consommateurs] ${iso()} post-merge ORIG_HEAD=${du.de.slice(0, 9)} HEAD=${du.vers.slice(0, 9)} — début`)
      const vu = lancerHook(depot, 'post-merge', ['0'])
      const diagnostic = vu.disponible ? (vu.absent ? vu.diagnostic : vu.valeur) : vu.diagnostic
      const code = diagnostic?.status ?? null
      const sortie = [diagnostic?.stdout, diagnostic?.stderr].map((flux) => String(flux ?? '').trimEnd()).filter(Boolean).join('\n')
      ecrire(`[consommateurs] ${iso()} post-merge — fin, code ${code} (${((horloge() - debut) / 1000).toFixed(1)} s)${sortie ? `\n${sortie}` : ''}`)
      const cheminSynchro = join(commun, 'synchro.verrou')
      const synchro = await prendreVerrouAsync({
        chemin: cheminSynchro, libelle: 'synchronisation du principal', commande: 'ops:synchroniser --consommer', cwd: racine.valeur,
        estVivant: vivantSousBorne(cheminSynchro, BORNE_DU_VERROU_MS, estVivant, horloge), horloge, attente,
      })
      if (synchro.etat !== 'pris') {
        ecrire(`[consommateurs] verrou de synchronisation tenu par le PID ${synchro.tenant?.pid ?? '?'} (âge ${ageDe(synchro.tenant, horloge) ?? '?'} s) : plage due laissée au prochain passage`)
        return 0
      }
      try {
        const relu = lireDu(commun)
        if (relu && (relu.de !== du.de || relu.vers !== du.vers)) continue
        if (relu && code === 0) rmSync(cheminDuDu(commun), { force: true })
        else if (relu) ecrireJsonAtomique(cheminDuDu(commun), { ...relu, echec: { pid: process.pid, fin: iso(), code, log } })
        lacher()
        return 0
      } finally {
        synchro.liberer()
      }
    }
  } catch (e) {
    ecrire(`[consommateurs] ${iso()} arrêt : ${e instanceof GitIndisponible ? refusDeGit(e) : /** @type {any} */ (e)?.stack ?? e}`)
    return 1
  } finally {
    lacher()
  }
}

/** Le tenant VIVANT du verrou `chemin` sous `borneMs`, `null` sinon. */
function tenantVivant(chemin, borneMs, estVivant, horloge) {
  const tenant = tenantDe(chemin)
  return tenant && vivantSousBorne(chemin, borneMs, estVivant, horloge)(tenant.pid) ? tenant : null
}

/**
 * Les verrous ORPHELINS d'une MESURE (#2493) : `synchro.verrou`, outillage et consommateur tenus par un
 * détenteur absent (`consignant`), `index.lock` portant le jeton du journal `journal` d'un PID mort.
 * @returns {Orphelin[]}
 */
function orphelinsMesures({ commun, racine, verrouIndex, journal, horloge, estVivant }) {
  /** @type {Map<string, Orphelin>} */
  const orphelins = new Map()
  const verrous = [[join(commun, 'synchro.verrou'), BORNE_DU_VERROU_MS], [verrouOutillageDe(racine), null], [verrouDuConsommateur(commun), BORNE_DU_CONSOMMATEUR_MS]]
  for (const [chemin, borneMs] of verrous) {
    const tenant = chemin === null ? null : tenantDe(chemin)
    if (tenant) consignant(/** @type {string} */ (chemin), borneMs, estVivant, horloge, orphelins)(tenant.pid)
  }
  const index = journal && verrouIndex && octetsDe(verrouIndex)?.toString('utf8') === journal.jeton && !estVivant(journal.pid)
    ? [{ verrou: verrouIndex, pid: journal.pid, depuis: mtimeDe(verrouIndex), preuve: /** @type {const} */ ('jeton du journal') }] : []
  return [...index, ...orphelins.values()]
}

/** Le champ `consommateurs` d'une MESURE : `en-cours`, `echec`, ou `du` sans consommateur vivant ; `null` sans plage. */
function consommateursMesures(commun, horloge, estVivant) {
  const du = lireDu(commun)
  if (!du) return null
  if (du.echec) return echecDe(du)
  const tenant = tenantVivant(verrouDuConsommateur(commun), BORNE_DU_CONSOMMATEUR_MS, estVivant, horloge)
  return tenant ? enCours(commun, horloge, du, tenant) : { etat: 'du', depuis: du.du, de: du.de, vers: du.vers }
}

/**
 * La MESURE du principal (#2493, verdict §2), sans fetch, sans verrou, sans écriture : `interrompu` (journal
 * présent), `a-jour`, `occupe`, `en-retard`, `divergent`, ou un refus d'état ; chacune porte `mesure: true`,
 * `consommateurs` dès qu'une plage est due, et `orphelins` dès qu'un verrou est tenu par un détenteur absent
 * (`orphelinsMesures`). `visee` : le sha visé, `origin/main` local par défaut.
 * @param {{ depuis?: string, visee?: string | null, env?: NodeJS.ProcessEnv, horloge?: () => number, estVivant?: (pid: number) => boolean }} [p]
 */
export function mesurerPrincipal({ depuis = process.cwd(), visee = null, env, horloge = Date.now, estVivant = estPidVivant } = {}) {
  try {
    const racine = arbrePrincipal(depotDe(depuis, { env }))
    if (!racine.disponible) return { etat: 'git-indisponible', mesure: true, raison: racine.raison }
    const depot = depotDe(racine.valeur, { env })
    const commun = join(racine.valeur, '.git')
    const consommateurs = consommateursMesures(commun, horloge, estVivant)
    const journal = journalEnCours(commun)
    const relatif = cheminGit(depot, 'index')
    const verrouIndex = relatif ? `${resolve(racine.valeur, relatif)}.lock` : null
    const orphelins = orphelinsMesures({ commun, racine: racine.valeur, verrouIndex, journal, horloge, estVivant })
    const avec = (vu) => ({ ...vu, mesure: true, ...(consommateurs ? { consommateurs } : {}), ...(orphelins.length ? { orphelins } : {}) })
    const refus = refusDEtat(depot, racine.valeur)
    if (refus) return avec(refus)
    const head = shaDe(depot, 'HEAD')
    if (!head) throw new GitIndisponible('HEAD ne nomme aucun commit')
    const V = visee ?? shaDe(depot, TRONC.suivi)
    if (journal) {
      return avec({
        etat: 'interrompu', journal: join(commun, 'synchro', journal.vers, 'journal.json'), de: journal.de, vers: journal.vers,
        etape: journal.etape, head, visee: V, verrous: verrouIndex && existsSync(verrouIndex) ? [verrouIndex] : [],
      })
    }
    if (!V || !shaDe(depot, V)) return avec({ etat: 'origin-indisponible', raison: `visée ${V ?? TRONC.suivi} absente du dépôt local` })
    const ancetre = (a, b) => {
      const vu = estAncetre(depot, a, b)
      if (!vu.disponible) throw new GitIndisponible(vu)
      return 'valeur' in vu && vu.valeur === true
    }
    if (head === V || ancetre(V, head)) return avec({ etat: 'a-jour', sha: head, visee: V })
    if (!ancetre(head, V)) return avec({ etat: 'divergent', de: head, vers: V })
    const retard = combienDe(depot, [`${head}..${V}`])
    const tenant = tenantVivant(join(commun, 'synchro.verrou'), BORNE_DU_VERROU_MS, estVivant, horloge)
    if (tenant) return avec({ etat: 'occupe', tenant, ageS: ageDe(tenant, horloge), head, visee: V, retard })
    return avec({ etat: 'en-retard', head, visee: V, retard })
  } catch (e) {
    if (e instanceof GitIndisponible) return { etat: 'git-indisponible', mesure: true, raison: e.raison }
    throw e
  }
}

/** Les 9 premiers caractères d'un sha. PURE. */
const court = (sha) => String(sha ?? '?').slice(0, 9)

/** La ligne d'un refus nommé : sa raison, sa branche, ses opérations, ses chemins, ou sa plage. PURE. */
function motifDuRefus(vu) {
  if (vu.raison) return String(vu.raison).split('\n')[0]
  if (vu.branche) return vu.branche
  if (Array.isArray(vu.operations)) return vu.operations.join(', ')
  if (Array.isArray(vu.chemins)) return vu.chemins.map((c) => (typeof c === 'string' ? c : c.chemin)).join(', ')
  return vu.de && vu.vers ? `${court(vu.de)}..${court(vu.vers)}` : ''
}

/** Le suffixe du consommateur d'un état, `''` s'il n'en porte pas. PURE. */
function suffixeDuConsommateur(vu) {
  const c = vu.consommateurs
  if (!c || vu.etat === 'avance-non-prete') return ''
  const plage = `${court(c.de)}..${court(c.vers)}`
  if (c.etat === 'en-cours') return ` ; post-merge ${plage} en fond : PID ${c.pid} depuis ${c.depuis} (${c.ageS} s), issue : ${c.log}`
  if (c.etat === 'echec') return ` ; post-merge ${plage} en échec (code ${c.code}, ${c.fin}) : ${c.log}`
  if (c.etat === 'ignore') return ` ; post-merge ${plage} ignoré par git : ${c.hook}`
  return ` ; post-merge ${plage} dû depuis ${c.depuis}, aucun consommateur vivant`
}

/** Le suffixe des verrous orphelins d'un état : repris par un passage, à reprendre pour une mesure ; `''` sans orphelin. PURE. */
const suffixeDesOrphelins = (vu) => (vu.orphelins?.length
  ? ` ; verrous orphelins ${vu.mesure ? 'à reprendre' : 'repris'} : ${nomDesOrphelins(vu.orphelins)}` : '')

/**
 * La LIGNE d'un état de passage ou de mesure (#2493, verdict §2), suffixée de ses verrous orphelins, de son
 * consommateur et de la configuration client changée. PURE.
 * @param {any} vu
 */
export function ligneDeLEtat(vu) {
  const configuration = vu.configurationClientChangee?.length ? ` ; configuration client changée : ${vu.configurationClientChangee.join(', ')}` : ''
  return `${corpsDeLaLigne(vu)}${suffixeDesOrphelins(vu)}${suffixeDuConsommateur(vu)}${configuration}`
}

/** Le corps de `ligneDeLEtat`, sans suffixe. PURE. */
function corpsDeLaLigne(vu) {
  const avance = `avancé de ${court(vu.de)} à ${court(vu.vers)}`
  switch (vu.etat) {
    case 'a-jour':
      return `à jour sur ${court(vu.sha)}`
    case 'avance':
      return `${avance}${vu.reprise ? ` (reprise de ${court(vu.reprise.de)}..${court(vu.reprise.vers)})` : ''}`
    case 'avance-non-prete':
      return vu.hookIgnore ? `${avance}, post-merge ignoré par git : ${vu.hookIgnore}` : `${avance}, post-merge en échec (code ${vu.code}, ${vu.consommateurs?.fin ?? '?'}) : ${vu.log}`
    case 'interrompu':
      return vu.mesure
        ? `interrompu : avance ${court(vu.de)}..${court(vu.vers)} entamée (étape ${vu.etape}), HEAD ${court(vu.head)} — reprise due (journal ${vu.journal})`
        : `interrompu : ${String(vu.raison ?? '').split('\n')[0]} — reprise due (journal ${vu.journal ?? '?'})`
    case 'occupe': {
      const age = vu.ageS === null || vu.ageS === undefined ? '?' : Math.round(vu.ageS / 60)
      return `occupé : verrou tenu par le PID ${vu.tenant?.pid ?? '?'} depuis ${vu.tenant?.date ?? '?'} (${age} min, ${vu.tenant?.commande ?? '?'})`
    }
    case 'en-retard':
      return `en retard : HEAD ${court(vu.head)}, ${vu.retard} commit(s) derrière ${court(vu.visee)}, aucune avance entamée — synchronisation due`
    default:
      return `refusé (${vu.etat}) : ${motifDuRefus(vu)}`
  }
}

/** Les états qu'un passage peut taire. */
const ETATS_MUETS = new Set(['a-jour', 'avance'])

/** La commande de reprise d'un état : le consommateur seul (`--consommer`) pour une avance au post-merge en échec. PURE. */
const repriseDe = (vu) => (vu.etat === 'avance-non-prete' && vu.consommateurs?.etat === 'echec' ? 'npm run ops:synchroniser -- --consommer' : 'npm run ops:synchroniser')

/**
 * Le texte qu'un passage rend à une SESSION : `''` pour `a-jour` ou `avance` sans configuration client
 * changée, consommateur ni verrou orphelin ; sinon `[synchroniser] principal <ligneDeLEtat>`, suivi de la
 * reprise (`repriseDe`) hors d'`a-jour` et d'`avance`. PURE.
 * @param {any} vu
 */
export function texteDeSession(vu) {
  const muet = ETATS_MUETS.has(vu.etat)
  if (muet && !vu.configurationClientChangee?.length && !vu.consommateurs && !vu.orphelins?.length) return ''
  return `[synchroniser] principal ${ligneDeLEtat(vu)}${muet ? '' : ` — reprise : \`${repriseDe(vu)}\``}`
}

/** Le code de sortie d'un état : 0 pour `avance` et `a-jour`, 2 si git manque, 1 sinon. PURE. */
const codeDe = (vu) => (vu.etat === 'avance' || vu.etat === 'a-jour' ? 0 : vu.etat === 'git-indisponible' ? 2 : 1)

/**
 * La CLI : `--json` imprime l'état et son `texte` (`texteDeSession`) en JSON ; `--mesurer [--visee <sha>]`
 * mesure sans rien écrire (`mesurerPrincipal`), sa `ligne` (`ligneDeLEtat`) et son `texte` en JSON ;
 * `--consommer` joue la plage due (`consommerLaPlage`), en échec comprise.
 * Code 0 pour `avance` et `a-jour`, 1 pour un autre état, 2 si git manque.
 */
async function principal(argv) {
  const json = argv.includes('--json')
  if (argv.includes('--consommer')) return consommerLaPlage()
  if (argv.includes('--mesurer')) {
    const visee = argv[argv.indexOf('--visee') + 1]
    const mesure = mesurerPrincipal({ visee: argv.includes('--visee') ? visee : null })
    const ligne = ligneDeLEtat(mesure)
    const texte = `[synchroniser] principal ${ligne}`
    process.stdout.write(json ? `${JSON.stringify({ ...mesure, ligne, texte })}\n` : `${texte}\n`)
    return codeDe(mesure)
  }
  const vu = await synchroniserPrincipal({ annoncer: (texte) => process.stderr.write(`${texte}\n`) })
  process.stdout.write(json ? `${JSON.stringify({ ...vu, texte: texteDeSession(vu) })}\n` : `[synchroniser] principal ${ligneDeLEtat(vu)}\n`)
  return codeDe(vu)
}

if (import.meta.main) process.exitCode = await principal(process.argv.slice(2))
