// SYNCHRONISEUR DU PRINCIPAL (#2187) : l'arbre principal avance de sa tête B à `origin/main` U sans
// geste manuel, sans perdre une écriture locale, et refuse par un état NOMMÉ ce qu'il ne sait pas faire
// sans perte. Design jugé : `.git/suivi/2187-design-synchroniseur-verdict-2026-10-07.md` (#2187,
// commentaire 6026872846), ordre exact des étapes 1 à 10.
//
// Limite nommée : un écrivain NON git entre la comparaison et l'écriture d'un W′, et un ignoré créé
// entre la capture et `read-tree`, ne sont pas exclus (verdict, D4 (b) et (c)).
//
// Usage : `npm run ops:synchroniser [-- --json]`, depuis n'importe quel worktree du dépôt.
import { randomUUID, createHash } from 'node:crypto'
import { accessSync, closeSync, constants as fsConstants, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync, writeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  GitIndisponible, INDEX, TRONC, ajoutDe, arbrePrincipal, attributsDe, avancerArbre, brancheDe, ceQuiChange, ceriseDe,
  cheminGit, cheminsIgnores, contenuDuBlob, depotDe, ecrireBlob, entreesDe, estAncetre, etatDeLArbre, fetchOrigin,
  fusionDiff3, fusionnesEnCours, lancerHook, poserDansIndex, poserRef, rafraichirIndex, rebaseEntame, refusDeGit,
  reussi, shaDe, shasDuTravail, transactionDeRefs,
} from '../guards/lib/gitPorte.mjs'
import { BACKOFFS_MS, attendreSync } from '../guards/lib/spawnResilient.mjs'
import { estPidVivant, prendreVerrouAsync, sousEcheanceAsync } from '../test/verrou.mjs'

/** Les chemins dont un changement B..U ne prend effet qu'à la PROCHAINE session d'un client (verdict, D2). */
export const CONFIGURATION_CLIENT = Object.freeze([/^\.claude\/settings\.json$/, /^\.codex\/hooks\.json$/, /^\.claude\/skills\/harnais\//])

/** Les points d'arrêt `gestes.etape(nom)` des étapes 4 à 10 du verdict, dans l'ordre ; la capture
 *  (étape 3) et la reprise reconnue (avant sa transaction) ont les leurs, `capture` et `reprise`, hors
 *  de cette liste. */
export const ETAPES = Object.freeze(['transaction', 'travail', 'arbre', 'index', 'commit', 'consommateurs', 'liberation'])

/** L'attente bornée des verrous (`synchro.verrou`, `index.lock`, verrous de refs d'une reprise) : un essai
 *  tous les `pasMs`, une annonce au premier refus puis au plus une par `annonceMs` (`annonceEspacee`). */
export const ATTENTE = Object.freeze({ echeanceMs: 120_000, pasMs: 200, annonceMs: 5_000 })

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

/** Les codes d'un `rename` que Windows refuse pendant qu'un autre processus tient la cible ouverte. */
const RENOMMAGE_REFUSE = new Set(['EPERM', 'EACCES', 'EBUSY'])

/**
 * L'index `cible` REMPLACÉ par le fichier `candidat` (`renameSync`), rejoué sous `BACKOFFS_MS` tant que
 * le système le refuse (`RENOMMAGE_REFUSE`). REND les codes des refus essuyés ; LÈVE le dernier refus à
 * épuisement.
 * @param {string} candidat @param {string} cible @param {{ attendre?: (ms: number) => void }} [opts] @returns {string[]}
 */
export function remplacerIndex(candidat, cible, { attendre = attendreSync } = {}) {
  const refus = []
  for (;;) {
    try {
      renameSync(candidat, cible)
      return refus
    } catch (e) {
      const code = /** @type {any} */ (e)?.code
      if (!RENOMMAGE_REFUSE.has(code) || refus.length >= BACKOFFS_MS.length) throw e
      refus.push(code)
      attendre(BACKOFFS_MS[refus.length - 1])
    }
  }
}

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
 * `annoncer(texte)` : chaque attente d'un verrou tenu.
 * @param {{ depuis?: string, env?: NodeJS.ProcessEnv, horloge?: () => number, annoncer?: (texte: string) => void,
 *   gestes?: { etape?: (nom: string) => void | Promise<void>, estVivant?: (pid: number) => boolean, attente?: { echeanceMs: number, pasMs: number, annonceMs?: number } } }} [p]
 */
export async function synchroniserPrincipal({ depuis = process.cwd(), env, gestes = {}, horloge = Date.now, annoncer = () => {} } = {}) {
  const { etape = () => {}, estVivant = estPidVivant } = gestes
  const attente = { ...ATTENTE, ...gestes.attente }
  const racine = arbrePrincipal(depotDe(depuis, { env }))
  if (!racine.disponible) return { etat: 'git-indisponible', raison: racine.raison }
  const depot = depotDe(racine.valeur, { env })
  const commun = join(racine.valeur, '.git')
  const debut = horloge()
  const verrou = await prendreVerrouAsync({
    chemin: join(commun, 'synchro.verrou'), libelle: 'synchronisation du principal', commande: 'ops:synchroniser',
    cwd: racine.valeur, estVivant, horloge,
    attente: { ...attente, annoncer: ((dire) => (tenant) => dire(`[synchroniser] verrou tenu par le PID ${tenant?.pid ?? '?'}`))(annonceEspacee(annoncer, horloge, attente.annonceMs)) },
  })
  if (verrou.etat !== 'pris') return { etat: 'occupe', message: verrou.message, tenant: verrou.tenant ?? null }
  /** @type {any} */
  const ctx = { depot, racine: racine.valeur, commun, index: '', verrouIndex: '', jeton: null, etape, attente, debut, horloge, annoncer: annonceEspacee(annoncer, horloge, attente.annonceMs), tx: null }
  try {
    const relatif = cheminGit(depot, 'index')
    if (!relatif) throw new GitIndisponible('chemin de l’index non rendu')
    ctx.index = resolve(racine.valeur, relatif)
    ctx.verrouIndex = `${ctx.index}.lock`
    const journal = journalEnCours(commun)
    const vu = journal ? await reprendre(ctx, journal) : await synchroniser(ctx)
    if (vu.etat === 'avance' || vu.etat === 'a-jour') rmSync(join(commun, CONFLITS), { recursive: true, force: true })
    return vu
  } catch (e) {
    const indisponible = e instanceof GitIndisponible
    if (!indisponible && ctx.jeton === null) throw e
    await abandonner(ctx)
    const laisse = journalEnCours(commun)
    const journal = laisse ? { journal: cheminDuJournal(ctx, laisse.vers) } : {}
    if (indisponible) return { etat: 'git-indisponible', raison: e.raison, ...journal }
    const verrous = octetsDe(ctx.verrouIndex)?.toString('utf8') === ctx.jeton ? [ctx.verrouIndex] : []
    return { etat: 'interrompu', raison: String(/** @type {any} */ (e)?.stack ?? e), ...journal, verrous }
  } finally {
    verrou.liberer()
  }
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

/** Le journal écrit d'un seul geste (temporaire puis `rename`). */
function ecrireJournal(ctx, journal) {
  const chemin = cheminDuJournal(ctx, journal.vers)
  writeFileSync(`${chemin}.tmp`, JSON.stringify(journal))
  renameSync(`${chemin}.tmp`, chemin)
}

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
  remplacerIndex(candidat, ctx.index)
  await ctx.etape('index')
  return conclure(ctx, avecCandidat, tx)
}

/** Les étapes 8 à 10 : `commit` de la transaction, `ORIG_HEAD` = B, puis `consommer`. */
async function conclure(ctx, journal, tx) {
  const vu = await tx.commit()
  ctx.tx = null
  if (!vu.ok) return interrompre(ctx, journal, vu.raison)
  const orig = poserRef(ctx.depot, 'ORIG_HEAD', journal.de)
  if (!reussi(orig)) throw new GitIndisponible(orig.disponible ? refusDeGit(orig) : orig)
  ecrireJournal(ctx, { ...journal, etape: 'avance' })
  await ctx.etape('commit')
  return consommer(ctx, journal)
}

/** Les étapes 9 et 10 : `post-merge` lancé, son code LU ; puis libération. */
async function consommer(ctx, journal) {
  const commun = { de: journal.de, vers: journal.vers, configurationClientChangee: journal.configuration }
  const ignore = hookIgnore(ctx, 'post-merge')
  if (ignore) {
    await ctx.etape('consommateurs')
    return finir(ctx, journal, { etat: 'avance-non-prete', ...commun, code: null, hookIgnore: ignore, sortie: `hook présent mais non exécutable, ignoré par git : ${ignore}` })
  }
  const vu = lancerHook(ctx.depot, 'post-merge', ['0'])
  const diagnostic = vu.disponible ? (vu.absent ? vu.diagnostic : vu.valeur) : vu.diagnostic
  const code = diagnostic?.status ?? null
  await ctx.etape('consommateurs')
  return finir(ctx, journal, code === 0 ? { etat: 'avance', ...commun } : { etat: 'avance-non-prete', ...commun, code, sortie: refusDeGit(vu) })
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
  if (tete === journal.vers) {
    const orig = poserRef(depot, 'ORIG_HEAD', journal.de)
    if (!reussi(orig)) throw new GitIndisponible(orig.disponible ? refusDeGit(orig) : orig)
    return consommer(ctx, journal)
  }
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
  return conclure(ctx, journal, ouverte.tx)
}

/** La transaction d'une REPRISE refusée : l'état laissé par le mort reste tel quel, `interrompu` le nomme. */
const refusEnReprise = (ctx, journal, refus) => interrompre(ctx, journal, `transaction de refs refusée en reprise : ${refus.etat}`, { refus })

/** La CLI : `--json` imprime l'état en JSON. Code 0 pour `avance` et `a-jour`, 1 pour un autre état, 2 si git manque. */
async function principal(argv) {
  const json = argv.includes('--json')
  const vu = await synchroniserPrincipal({ annoncer: (texte) => process.stderr.write(`${texte}\n`) })
  process.stdout.write(json ? `${JSON.stringify(vu)}\n` : `[synchroniser] ${vu.etat}${'raison' in vu && vu.raison ? ` — ${vu.raison}` : ''}\n`)
  return vu.etat === 'avance' || vu.etat === 'a-jour' ? 0 : vu.etat === 'git-indisponible' ? 2 : 1
}

if (import.meta.main) process.exitCode = await principal(process.argv.slice(2))
