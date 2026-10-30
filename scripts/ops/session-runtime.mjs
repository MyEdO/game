import fs from 'node:fs'
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { join, resolve, extname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { z } from 'zod'
import { prendreVerrou } from '../test/verrou.mjs'
import { depotDe, arbrePrincipal, brancheDe, shaDe } from '../guards/lib/gitPorte.mjs'
import { citerArgv } from '../guards/lib/lancerDetache.mjs'
import { BORNE_RAISON } from '../guards/lib/ticketsGh.mjs'
import { preflightSessionStart, contexteRecu, validerRecuSessionStart, PreuveSessionStart, ANNEXES_SESSION_START } from './session-start.mjs'
import { ecrireJsonAtomique as sauver } from '../guards/lib/ecritureJsonAtomique.mjs'
import { prefixeDeRefus, CATEGORIES_DE_REFUS } from '../guards/lib/categorieDeRefus.mjs'
import { FICHIER_TENU, renommerResilient } from '../guards/lib/renommageResilient.mjs'
import { lancerPontCodex, envoyerCodex, veillerCodex, ANNEXES_CODEX } from './session-codex.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

export const PRODUCTEUR = 'ops:session'
const terminaux = new Set(['fermee', 'echec-reservation', 'echec-controle'])
const erreur = (categorie, message, options) => new Error(`${prefixeDeRefus(categorie)} ${message}`, options)
const ANNEXES = Object.freeze({ stop: 'stop', bootstrap: 'bootstrap', ...ANNEXES_SESSION_START, contexte: 'hook-context', terminal: 'terminal-close', journalHote: 'jobhost.log', journal: 'stderr', rapport: 'rapport', ...ANNEXES_CODEX })
export const annexeDe = (dossier, id, cle) => join(dossier, `${id}.${ANNEXES[cle]}`)
const EXTENSION_CARTE = '.json'
/** Le nom de fichier de la carte `id` dans le registre. PURE. */
const nomDeCarte = (id) => `${id}${EXTENSION_CARTE}`
const Identite = z.object({ pid: z.number().int().positive(), creation: z.string().min(1) }).passthrough()
const CarteSession = z.object({
  sessionId: z.uuid(), producteur: z.literal(PRODUCTEUR), ticket: z.number().int().positive(), nom: z.string().min(1),
  agent: z.enum(['claude', 'codex']), consigne: z.string().refine(isAbsolute), worktree: z.string().refine(isAbsolute), racine: z.string().refine(isAbsolute),
  branche: z.string().min(1), head: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/), date: z.iso.datetime(), reserveJusqua: z.number(),
  lanceur: Identite, empreinteJeton: z.string().regex(/^[0-9a-f]{64}$/), empreinteNonce: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  empreinteNonceHook: z.string().regex(/^[0-9a-f]{64}$/), demarrageJusqua: z.number(),
  hooks: z.object({ empreinteCanon: z.string().regex(/^[0-9a-f]{64}$/), empreinteCredo: z.string().regex(/^[0-9a-f]{64}$/).optional(), delaiMs: z.number().positive() }).strict(),
  recuSessionStart: PreuveSessionStart.optional(),
  etat: z.enum(['reservee', 'vivante', 'arret-demande', 'nettoyage', 'fermee', 'echec-reservation', 'echec-controle']),
  controleur: Identite.optional(), jobHost: Identite.optional(), agentProcessus: Identite.optional(),
  evenements: z.array(z.object({ ticket: z.number().int().positive(), nom: z.string(), sessionId: z.uuid(), date: z.iso.datetime(), type: z.enum(['lancement', 'clôture', 'échec']) })),
}).passthrough().superRefine((c, ctx) => {
  if (c.etat === 'reservee' && !c.empreinteNonce) ctx.addIssue({ code: 'custom', message: 'nonce requis' })
  if (['vivante', 'arret-demande'].includes(c.etat) && (!c.controleur || !c.jobHost)) ctx.addIssue({ code: 'custom', message: 'identités de contrôle requises' })
  if (['nettoyage', 'fermee'].includes(c.etat) && !['sortie', 'echec'].includes(c.issueSortie)) ctx.addIssue({ code: 'custom', message: 'issue de sortie requise' })
  if (c.etat === 'echec-controle' && c.codeEnveloppe !== undefined) ctx.addIssue({ code: 'custom', message: 'sortie enveloppe inconnue' })
})
const PolitiqueSession = z.object({ sandbox: z.enum(['danger-full-access']), approvalPolicy: z.enum(['never']), model: z.enum(['gpt-6.1-sol']), reasoningEffort: z.enum(['medium']) }).strict()
const validerPolitique = (brut) => {
  const vu = PolitiqueSession.safeParse(brut)
  if (!vu.success) throw erreur('validation', `POLITIQUE INVALIDE : ${vu.error.issues.map((e) => `${e.path.join('.') || e.keys?.join(',') || '—'}: ${e.message}`).join('; ')}`)
  return vu.data
}
export const lirePolitique = (chemin = new URL('./session-policy.json', import.meta.url)) => validerPolitique(JSON.parse(fs.readFileSync(chemin, 'utf8')))
const empreinte = (secret) => createHash('sha256').update(secret).digest('hex')
const identique = (a, b) => !!a && !!b && a.pid === b.pid && a.creation === b.creation
const sommeil = (ms) => new Promise((r) => setTimeout(r, ms))
const lireJSON = (chemin) => JSON.parse(fs.readFileSync(chemin, 'utf8'))

/** Le refus porté par `erreur` : catégorie lue à son préfixe, `transitoire` pour une erreur fs d'un fichier tenu
 *  (`FICHIER_TENU`), `panne` sinon ; `retentable` de cette catégorie, raison sans préfixe. Seul juge du « retentable » du
 *  cycle de session (#3150). PURE. */
export function refusSession(erreur) {
  const message = erreur instanceof Error ? erreur.message : String(erreur)
  const categorie = Object.keys(CATEGORIES_DE_REFUS).find((c) => message.startsWith(prefixeDeRefus(c))) ?? (FICHIER_TENU.has(erreur?.code) ? 'transitoire' : 'panne')
  const prefixe = prefixeDeRefus(categorie)
  return { prefixe, categorie, retentable: CATEGORIES_DE_REFUS[categorie], raison: message.startsWith(prefixe) ? message.slice(prefixe.length).trim() : message, ...(erreur?.reprise ? { reprise: erreur.reprise } : {}) }
}

/** Le délai (ms) par défaut de `fermer` avant `ACK TIMEOUT`. Valeur maison. */
export const DELAI_FERMETURE_MS = 30_000
/** La fenêtre (ms) d'une réservation (`reserveJusqua`). Valeur maison. */
const FENETRE_RESERVATION_MS = 60_000
/** Le plafond (ms) d'attente du verrou du registre (`sousVerrou`). Valeur maison. */
const PLAFOND_VERROU_REGISTRE_MS = 15_000

/** La borne de rejeu d'un refus retentable, par site du cycle de session (#3150) : `supervision` couvre quatre plafonds du
 *  verrou du registre. */
export const BORNES_DE_REJEU = Object.freeze({ supervision: 4 * PLAFOND_VERROU_REGISTRE_MS, arret: DELAI_FERMETURE_MS, demarrage: FENETRE_RESERVATION_MS })

/** Le résultat de `geste`, rejoué tous les `pasMs` tant qu'il lève un refus `retentable` (`refusSession`) et que la série
 *  de refus ne dépasse pas `borneMs` (#3150). Un refus non retentable, ou retentable au-delà de la borne, est relevé tel quel. */
export async function rejouer(geste, { borneMs, horloge = Date.now, dormir = sommeil, pasMs = 250 }) {
  let serie = null
  do {
    try { return await geste() }
    catch (e) {
      if (!refusSession(e).retentable) throw e
      serie ??= horloge()
      if (horloge() - serie > borneMs) throw e
      await dormir(pasMs)
    }
  } while (true)
}

export function envAgent(env) {
  return Object.fromEntries(Object.entries(env).filter(([cle]) => !/^(?:WFRP_SESSION_JETON|WFRP_SESSION_REVENDICATION|CLAUDE_CODE_CHILD_SESSION|CLAUDE_PROJECT_DIR)$/i.test(cle)))
}

export function lireJsonc(texte) {
  let resultat = '', chaine = false, echappe = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i], n = texte[i + 1]
    if (chaine) { resultat += c; if (echappe) echappe = false; else if (c === '\\') echappe = true; else if (c === '"') chaine = false; continue }
    if (c === '"') { chaine = true; resultat += c; continue }
    if (c === '/' && n === '/') { while (i < texte.length && texte[i] !== '\n') i++; resultat += '\n'; continue }
    if (c === '/' && n === '*') { i += 2; while (i < texte.length && !(texte[i] === '*' && texte[i + 1] === '/')) i++; i++; continue }
    resultat += c
  }
  let nettoye = ''; chaine = false; echappe = false
  for (let i = 0; i < resultat.length; i++) {
    const c = resultat[i]
    if (chaine) { nettoye += c; if (echappe) echappe = false; else if (c === '\\') echappe = true; else if (c === '"') chaine = false; continue }
    if (c === '"') chaine = true
    if (c === ',' && /^\s*[}\]]/.test(resultat.slice(i + 1))) continue
    nettoye += c
  }
  return JSON.parse(nettoye)
}

export function planAgent(carte, { natif, consigne, politique }) {
  if (extname(natif ?? '').toLowerCase() !== '.exe') throw erreur('validation', 'AGENT NATIF ABSENT : executable .exe requis')
  if (carte.agent === 'claude') return { executable: natif, args: [consigne], shell: false }
  if (carte.agent !== 'codex') throw erreur('validation', 'AGENT INCONNU')
  const p = validerPolitique(politique)
  return { executable: natif, shell: false, args: ['-c', `model="${p.model}"`, '-c', `model_reasoning_effort="${p.reasoningEffort}"`, '-c', `approval_policy="${p.approvalPolicy}"`, '-c', `sandbox_mode="${p.sandbox}"`, '-c', 'features.hooks=true', '--dangerously-bypass-hook-trust', 'app-server', '--listen', 'stdio://'] }
}

export const contratCodex = ({ sessionId, ticket, worktree }) => `Rapport final JSON : sessionId=${sessionId}, ticket=${ticket}, worktree=${worktree} ; atterrissage = sha du commit d'atterrissage sur main si ta publication est MERGED, sinon null ; resume décrit le résultat.`

export const consigneAgent = (carte, texte) => carte.agent === 'codex' ? `${texte}\n\n${contratCodex({ sessionId: carte.sessionId, ticket: carte.ticket, worktree: carte.worktree })}` : texte

export function lancerAgent(plan, carte, { journal, lancer = spawn, echo = (morceau) => process.stderr.write(morceau), delaiMs = 2_000, env = process.env }) {
  const child = lancer(plan.executable, plan.args, { cwd: carte.worktree, shell: false, stdio: carte.agent === 'codex' ? ['inherit', 'inherit', 'pipe'] : 'inherit', env: envAgent(env) })
  child.stderr?.on('data', (morceau) => { echo(morceau); fs.appendFileSync(journal, morceau) })
  const ferme = new Promise((ok) => { if (!child.stderr) return ok(); child.stderr.once('close', ok); child.stderr.once('error', ok) })
  const cause = async () => {
    await Promise.race([ferme, new Promise((ok) => setTimeout(ok, delaiMs).unref())])
    try { return fs.readFileSync(journal, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' · ').slice(-BORNE_RAISON) } catch { return '' }
  }
  return { child, cause }
}

const cheminComparable = (chemin) => process.platform === 'win32' ? resolve(chemin).toLowerCase() : resolve(chemin)

const TYPES_DE_SCHEMA = Object.assign(Object.create(null), { string: (v) => typeof v === 'string', integer: Number.isInteger, null: (v) => v === null, object: (v) => !!v && typeof v === 'object' && !Array.isArray(v) })
const MOTS_DE_SCHEMA = new Set(['type', 'pattern', 'required', 'properties', 'additionalProperties'])

export function validateurDeSchema(schema) {
  if (!TYPES_DE_SCHEMA.object(schema) || Object.getPrototypeOf(schema) !== Object.prototype) throw erreur('validation', `SCHÉMA HORS INTERPRÈTE : sous-schéma non objet (${JSON.stringify(schema)})`)
  const hors = Object.keys(schema).filter((mot) => !MOTS_DE_SCHEMA.has(mot))
  const types = schema.type === undefined ? null : [schema.type].flat()
  if (types?.some((type) => !TYPES_DE_SCHEMA[type])) hors.push(`type ${types.join('|')}`)
  if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) hors.push('additionalProperties')
  if (hors.length) throw erreur('validation', `SCHÉMA HORS INTERPRÈTE : ${hors.join(', ')}`)
  const motif = schema.pattern === undefined ? null : new RegExp(schema.pattern, 'u')
  const proprietes = Object.entries(schema.properties ?? {}).map(([cle, sous]) => [cle, validateurDeSchema(sous)])
  const objet = schema.properties !== undefined || schema.required !== undefined || schema.additionalProperties === false
  return (valeur) => {
    if (types && !types.some((type) => TYPES_DE_SCHEMA[type](valeur))) return false
    if (motif && typeof valeur === 'string' && !motif.test(valeur)) return false
    if (!objet) return true
    if (!TYPES_DE_SCHEMA.object(valeur) || (schema.required ?? []).some((cle) => !Object.hasOwn(valeur, cle))) return false
    if (schema.additionalProperties === false && Object.keys(valeur).some((cle) => !Object.hasOwn(schema.properties ?? {}, cle))) return false
    return proprietes.every(([cle, conforme]) => !Object.hasOwn(valeur, cle) || conforme(valeur[cle]))
  }
}

const SCHEMA_RAPPORT = fileURLToPath(new URL('./session-report.schema.json', import.meta.url))
const rapportConforme = validateurDeSchema(JSON.parse(fs.readFileSync(SCHEMA_RAPPORT, 'utf8')))

export function lireRapportDe(chemin) {
  let texte
  try { texte = fs.readFileSync(chemin, 'utf8') } catch (e) { if (e.code === 'ENOENT') throw erreur('panne', 'RAPPORT ABSENT', { cause: e }); throw erreur(refusSession(e).categorie, `LECTURE RAPPORT : ${e.message}`, { cause: e }) }
  try { return JSON.parse(texte) } catch (e) { throw erreur('panne', 'RAPPORT INVALIDE', { cause: e }) }
}

export function validerRapport(rapport, carte) {
  if (!rapportConforme(rapport)) return { ok: false, raison: 'RAPPORT INVALIDE' }
  if (rapport.sessionId !== carte.sessionId || rapport.ticket !== carte.ticket || cheminComparable(rapport.worktree) !== cheminComparable(carte.worktree)) return { ok: false, raison: 'RAPPORT ÉTRANGER' }
  return { ok: true }
}

export function creerSessions({ dossier, horloge = Date.now, processus = mesurerProcessus, inventaire = inventorierProcessus, dormir = sommeil, lanceur, envoyer = envoyerCodex, veiller = veillerCodex }) {
  fs.mkdirSync(dossier, { recursive: true })
  const fichierDe = (id) => { if (!/^[\w-]+$/.test(id)) throw erreur('validation', 'IDENTITÉ INVALIDE'); return nomDeCarte(id) }
  const chemin = (id) => join(dossier, fichierDe(id))
  const annexe = (id, cle) => annexeDe(dossier, id, cle)
  const stop = (id) => annexe(id, 'stop'), bootstrap = (id) => annexe(id, 'bootstrap'), recu = (id) => annexe(id, 'recu')
  const validerCarte = (brut, fichier) => {
    if (!brut || typeof brut !== 'object' || Array.isArray(brut) || typeof brut.producteur !== 'string' || !brut.producteur) throw erreur('panne', `CARTE INVALIDE : ${fichier}`)
    if (brut.producteur !== PRODUCTEUR) return brut
    const vu = CarteSession.safeParse(brut)
    if (!vu.success || nomDeCarte(brut.sessionId) !== fichier) throw erreur('panne', `CARTE INVALIDE : ${fichier}${vu.success ? ' — identité/fichier divergent' : ` — ${vu.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`}`)
    return vu.data
  }
  const collection = () => {
    const cartes = [], anomalies = []
    for (const fichier of fs.readdirSync(dossier).filter((n) => n.endsWith(EXTENSION_CARTE))) {
      try { cartes.push(validerCarte(brutDe(fichier), fichier)) }
      catch (e) { anomalies.push({ fichier, raison: e.message }) }
    }
    return { cartes, anomalies }
  }
  const brutDe = (fichier) => {
    try { return lireJSON(join(dossier, fichier)) } catch (e) {
      if (e.code === 'ENOENT') throw erreur('métier', `CARTE ABSENTE : ${fichier}`, { cause: e })
      if (refusSession(e).retentable) throw erreur('transitoire', `CARTE TENUE : ${fichier}`, { cause: e })
      throw erreur('panne', `CARTE INVALIDE : ${fichier}`, { cause: e })
    }
  }
  const lire = (id) => { const fichier = fichierDe(id); return validerCarte(brutDe(fichier), fichier) }
  const maintenant = () => new Date(horloge()).toISOString()
  const sansControleur = (c) => !c.controleur && !c.jobHost && !c.agentProcessus
  const capacite = (c, jeton) => {
    if (!jeton) throw erreur('permission', 'JETON ABSENT')
    if (typeof jeton !== 'string' || !timingSafeEqual(Buffer.from(c.empreinteJeton, 'hex'), Buffer.from(empreinte(jeton), 'hex'))) throw erreur('permission', 'JETON INCORRECT')
  }
  const observer = (c, observation) => { c.observations ??= []; if (!c.observations.includes(observation)) c.observations.push(observation) }
  const signalerEchec = (c, raison, origine = 'diagnostic') => {
    if (origine === 'terminal' && c.raisonOrigine === 'generique') {
      observer(c, c.raison)
      c.raison = raison; c.raisonOrigine = origine
      c.observations = c.observations.filter((observation) => observation !== raison)
    }
    if (c.raison && raison !== c.raison) observer(c, raison)
    if (!c.raison) { c.raison = raison; c.raisonOrigine = origine }
    c.echecLe ??= maintenant()
    if (!c.evenements.some((e) => e.type === 'échec')) c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date: c.echecLe, type: 'échec' })
  }
  const libererReservation = (c, etat, raison) => {
    c.etat = etat; delete c.empreinteNonce; delete c.codeEnveloppe
    fs.rmSync(bootstrap(c.sessionId), { force: true })
    fs.rmSync(annexe(c.sessionId, 'contexte'), { force: true })
    fs.rmSync(recu(c.sessionId), { force: true })
    const date = maintenant()
    if (raison) signalerEchec(c, raison)
    if (etat === 'fermee') { c.fermeeLe = date; c.issueSortie = c.raison ? 'echec' : 'sortie' }
    if (etat === 'fermee') c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date, type: 'clôture' })
  }
  const sousVerrou = (geste) => {
    const prise = prendreVerrou({ chemin: join(dossier, 'registre.lock'), libelle: 'sessions', commande: 'ops:session', cwd: dossier, attente: { echeanceMs: 5000, pasMs: 20, parTenant: true, plafondMs: PLAFOND_VERROU_REGISTRE_MS } })
    if (prise.etat !== 'pris') throw erreur('transitoire', prise.message)
    try { return geste() } finally { prise.liberer() }
  }
  const ecrireCarte = (carte) => sousVerrou(() => { validerCarte(carte, nomDeCarte(carte.sessionId)); if (fs.existsSync(chemin(carte.sessionId))) { const precedente = lire(carte.sessionId); if (precedente.producteur !== PRODUCTEUR || carte.producteur !== PRODUCTEUR) throw erreur('permission', 'CARTE ÉTRANGÈRE'); } sauver(chemin(carte.sessionId), carte); return carte })
  const muter = (id, fn) => sousVerrou(() => { const carte = lire(id); if (carte.producteur !== PRODUCTEUR) throw erreur('permission', 'CARTE ÉTRANGÈRE'); fn(carte); validerCarte(carte, fichierDe(id)); sauver(chemin(id), carte); return carte })
  const constater = () => { const liste = inventaire(); return { inventaire: liste, processus: new Map(liste.map((p) => [p.pid, p])) } }
  const memesIdentites = (a, b) => !!a && !!b && ['controleur', 'jobHost', 'agentProcessus'].every((cle) => (!a[cle] && !b[cle]) || identique(a[cle], b[cle]))
  const observationCourante = (carte, vue) => memesIdentites(carte, vue.observees.get(carte.sessionId))
  const encorePresent = (carte, vue) => [carte.controleur, carte.jobHost, carte.agentProcessus].some((id) => id && identique(vue.processus.get(id.pid), id))
  const terminalFerme = (carte) => {
    try {
      const fichier = annexe(carte.sessionId, 'terminal')
      if (fs.statSync(fichier).size > 2048) return false
      const signal = z.object({ sessionId: z.uuid(), jobHost: Identite }).strict().parse(lireJSON(fichier))
      return signal.sessionId === carte.sessionId && identique(signal.jobHost, carte.jobHost)
    } catch (e) { if (refusSession(e).retentable) throw e; return false }
  }
  const conserverDiagnosticTerminal = (carte) => {
    if (terminalFerme(carte)) signalerEchec(carte, 'terminal fermé', 'terminal')
    try {
      const diagnostic = coupeAuMot(fs.readFileSync(annexe(carte.sessionId, 'journalHote'), 'utf8').trim(), BORNE_RAISON)
      if (diagnostic) { carte.diagnosticJobHost = diagnostic; signalerEchec(carte, diagnostic) }
    } catch (e) { if (e.code !== 'ENOENT') throw e }
    if (carte.raison && carte.issueSortie) carte.issueSortie = 'echec'
  }
  const DIAGNOSTICS_TERMINAUX = ['terminal', 'journalHote']
  const transitions = {
    expiration: { purger: false, appliquer: (c) => libererReservation(c, 'echec-reservation', 'RÉSERVATION EXPIRÉE') },
    cloture: { purger: true, appliquer: (c) => {
      conserverDiagnosticTerminal(c)
      c.etat = 'fermee'; c.fermeeLe = maintenant(); c.codeEnveloppe = 0
      c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date: c.fermeeLe, type: 'clôture' })
    } },
    perte: { purger: true, appliquer: (c) => { conserverDiagnosticTerminal(c); c.etat = 'echec-controle'; signalerEchec(c, 'contrôle perdu, sortie inconnue', 'generique'); c.issueSortie = 'echec'; delete c.codeEnveloppe } },
    diagnostic: { purger: true, appliquer: (c) => conserverDiagnosticTerminal(c) },
  }
  const transitionDue = (c, vue) => {
    if (c.producteur !== PRODUCTEUR) return null
    if (c.etat === 'reservee' && horloge() > c.reserveJusqua) return 'expiration'
    if (!observationCourante(c, vue) || encorePresent(c, vue)) return null
    if (c.etat === 'nettoyage') return 'cloture'
    if (['vivante', 'arret-demande'].includes(c.etat)) return 'perte'
    if (terminaux.has(c.etat) && c.jobHost && DIAGNOSTICS_TERMINAUX.some((cle) => fs.existsSync(annexe(c.sessionId, cle)))) return 'diagnostic'
    return null
  }
  const reconcilier = () => {
    const initiales = collection()
    const vue = { ...constater(), observees: new Map(initiales.cartes.map((c) => [c.sessionId, c])) }
    const candidates = initiales.cartes.filter((c) => transitionDue(c, vue))
    if (candidates.length) sousVerrou(() => { for (const { sessionId } of candidates) {
      let c
      try { c = lire(sessionId) } catch { continue }
      const transition = transitionDue(c, vue)
      if (!transition) continue
      try { transitions[transition].appliquer(c) } catch (e) { if (refusSession(e).retentable) continue; throw e }
      sauver(chemin(sessionId), c)
      if (transitions[transition].purger) for (const cle of DIAGNOSTICS_TERMINAUX) fs.rmSync(annexe(sessionId, cle), { force: true })
    } })
    return { ...collection(), ...vue }
  }
  const choisir = (cible, { attente = false, vue = reconcilier() } = {}) => {
    const exact = vue.cartes.find((c) => c.sessionId === cible)
    if (exact) return exact
    const anomalie = vue.anomalies.find((a) => a.fichier === nomDeCarte(cible))
    if (anomalie) throw new Error(anomalie.raison)
    const pid = /^\d+$/.test(String(cible)) ? Number(cible) : null
    const matches = vue.cartes.filter((c) => String(c.ticket) === String(cible) || c.nom === cible || (pid !== null && [c.controleur, c.agentProcessus].some((id) => id?.pid === pid && identique(vue.processus.get(pid), id))))
    if (!matches.length) throw erreur('métier', 'NON INSCRIT : aucune session correspondante')
    const actives = matches.filter((c) => c.producteur !== PRODUCTEUR || !terminaux.has(c.etat))
    if (actives.length > 1) throw erreur('validation', 'CIBLE AMBIGUË : plusieurs sessions actives, utiliser UUID')
    if (actives.length === 1) return actives[0]
    if (!attente) throw erreur('métier', 'DÉJÀ SORTIE')
    return matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.sessionId.localeCompare(a.sessionId))[0]
  }
  const controle = (carte, vue = constater()) => {
    const vu = vue.processus.get(carte.controleur?.pid)
    if (!vu) throw erreur('panne', 'CONTRÔLE PERDU : contrôleur absent')
    if (!identique(vu, carte.controleur)) throw erreur('permission', 'PID RECYCLÉ : contrôleur étranger')
    if (!identique(vue.processus.get(carte.jobHost?.pid), carte.jobHost)) throw erreur('panne', 'CONTRÔLE PERDU : JobHost absent ou recyclé')
  }
  const estSortieObservee = (carte) => carte.etat === 'fermee'
  const sortie = (id, fin) => muter(id, (c) => { if (c.etat === 'fermee' || c.etat === 'nettoyage') throw erreur('métier', 'DÉJÀ SORTIE'); conserverDiagnosticTerminal(c); if (fin.raison) signalerEchec(c, fin.raison, fin.raisonOrigine); const { raison, raisonOrigine } = c; Object.assign(c, fin, { rapport: fin.rapport ?? c.rapport, raison, raisonOrigine, etat: 'nettoyage', issueSortie: raison || (fin.codeAgent !== 0 && !fin.arret) ? 'echec' : 'sortie', sortieLe: maintenant() }); delete c.codeEnveloppe })
  const revendiquer = (id, nonce, ids) => {
    const vue = constater()
    const mesuree = (donnee, pid) => { const vu = donnee ?? vue.processus.get(pid); return vu?.creation && identique(vue.processus.get(vu.pid), vu) ? vu : null }
    const mesures = { controleur: mesuree(ids.controleur, ids.controleurPid), jobHost: mesuree(ids.jobHost, ids.jobHostPid) }
    return sousVerrou(() => {
      const c = lire(id)
      if (c.producteur !== PRODUCTEUR) throw erreur('permission', 'CARTE ÉTRANGÈRE')
      if (c.etat === 'vivante' && identique(c.controleur, mesures.controleur) && identique(c.jobHost, mesures.jobHost)) { fs.rmSync(bootstrap(id), { force: true }); return c }
      if (c.etat === 'echec-reservation' || (c.etat === 'reservee' && horloge() > c.reserveJusqua)) throw erreur('métier', 'RÉSERVATION EXPIRÉE')
      if (c.etat !== 'reservee') throw erreur('permission', 'REVENDICATION REFUSÉE')
      const revendication = nonce ?? lireJSON(bootstrap(id)).nonce
      if (c.empreinteNonce !== empreinte(revendication ?? '')) throw erreur('permission', 'REVENDICATION REFUSÉE')
      if (!mesures.controleur || !mesures.jobHost) throw erreur('permission', 'REVENDICATION : IDENTITÉ NON MESURÉE')
      Object.assign(c, mesures, { etat: 'vivante', revendiqueLe: maintenant() }); delete c.empreinteNonce
      sauver(chemin(id), c)
      fs.rmSync(bootstrap(id), { force: true })
      return c
    })
  }
  const constaterRecu = (id) => {
    const c = lire(id)
    if (c.recuSessionStart) return { ok: true }
    let validation
    try { validation = validerRecuSessionStart(lireJSON(recu(id)), c) }
    catch (e) { if (refusSession(e).retentable) throw e; return { ok: false, raison: e.code === 'ENOENT' ? 'REÇU SESSIONSTART ABSENT' : `REÇU SESSIONSTART ILLISIBLE : ${e.message}` } }
    if (validation.ok) muter(id, (carte) => { const { nonce: _nonce, ...preuve } = validation.recu; carte.recuSessionStart = preuve })
    return validation
  }
  const api = {
    lire, ecrireCarte, muter, constaterRecu,
    etat(cible) {
      const choisie = choisir(cible, { attente: true })
      if (choisie.producteur !== PRODUCTEUR) throw new Error(`${prefixeDeRefus('permission')} CARTE ÉTRANGÈRE`)
      return api.lister().cartes.find((c) => c.sessionId === choisie.sessionId)
    },
    async envoyer(cible, jeton, { message, requestId = randomUUID(), timeoutMs = 30_000 } = {}) {
      const carte = choisir(cible, { attente: true })
      if (carte.producteur !== PRODUCTEUR) throw new Error(`${prefixeDeRefus('permission')} CARTE ÉTRANGÈRE`)
      capacite(carte, jeton)
      if (carte.agent !== 'codex') throw erreur('validation', `SESSION NON CODEX : agent ${carte.agent}`)
      if (carte.etat !== 'vivante') throw erreur('métier', 'SESSION CODEX NON VIVANTE')
      controle(carte)
      return { ...await envoyer({ dossier, sessionId: carte.sessionId, jeton, message, requestId, timeoutMs }), requestId }
    },
    projectionCodex(id, projection) {
      const carte = lire(id)
      if (projection.rapport) {
        const recuNatif = constaterRecu(id)
        if (!recuNatif.ok) throw new Error(`${prefixeDeRefus('panne')} ${recuNatif.raison}`)
        const validation = validerRapport(projection.rapport, carte)
        if (!validation.ok) throw new Error(`${prefixeDeRefus('panne')} ${validation.raison}`)
      }
      return muter(id, (c) => { c.codex = projection; if (projection.rapport) c.rapport = projection.rapport; if (projection.cause) signalerEchec(c, projection.cause) })
    },
    reserver(p) {
      const vue = reconcilier()
      return sousVerrou(() => {
        if (collection().cartes.some((c) => c.producteur === PRODUCTEUR && !terminaux.has(c.etat) && (c.ticket === p.ticket || c.nom === p.nom))) throw erreur('métier', 'COLLISION : ticket ou nom déjà réservé')
        const sessionId = randomUUID(), jeton = randomBytes(32).toString('hex'), nonce = randomBytes(32).toString('hex'), nonceHook = randomBytes(32).toString('hex')
        const carte = { ...p, sessionId, producteur: PRODUCTEUR, lanceur: lanceur ? lanceur() : vue.processus.get(process.pid), date: maintenant(), reserveJusqua: horloge() + FENETRE_RESERVATION_MS, demarrageJusqua: horloge() + (p.hooks?.delaiMs ?? 60_000), empreinteNonceHook: empreinte(nonceHook), empreinteJeton: empreinte(jeton), empreinteNonce: empreinte(nonce), etat: 'reservee', evenements: [{ ticket: p.ticket, nom: p.nom, sessionId, date: maintenant(), type: 'lancement' }] }
        validerCarte(carte, fichierDe(sessionId))
        sauver(chemin(sessionId), carte)
        sauver(bootstrap(sessionId), { nonce })
        sauver(annexe(sessionId, 'contexte'), contexteRecu(carte, dossier, nonceHook))
        return { carte, jeton, nonce }
      })
    },
    revendiquer,
    agentDemarre: (id, agentProcessus) => muter(id, (c) => { if (!agentProcessus?.creation) throw erreur('panne', 'IDENTITÉ AGENT ABSENTE'); c.agentProcessus = agentProcessus }),
    demanderArret(cible, jeton) {
      const vue = reconcilier(), choisie = choisir(cible, { vue, attente: true })
      return muter(choisie.sessionId, (c) => {
        capacite(c, jeton)
        if (!observationCourante(c, vue)) throw erreur('transitoire', 'OBSERVATION PÉRIMÉE : identités de session modifiées')
        if (sansControleur(c) && ['reservee', 'echec-reservation'].includes(c.etat)) { libererReservation(c, 'fermee'); return }
        if (terminaux.has(c.etat) || c.etat === 'nettoyage') throw erreur('métier', 'DÉJÀ SORTIE')
        controle(c, vue)
        if (c.etat === 'arret-demande') return
        c.etat = 'arret-demande'; c.demandeId = randomUUID(); c.arretDemandeLe = maintenant()
        sauver(stop(c.sessionId), { sessionId: c.sessionId, demandeId: c.demandeId })
      })
    },
    ackArret(id, demandeId) {
      reconcilier()
      const carte = lire(id)
      if (carte.demandeId !== demandeId || !estSortieObservee(carte)) return null
      return muter(id, (c) => { c.arretAckLe = maintenant() })
    },
    sortie,
    async echecDemarrage(id, jeton, raison) {
      const demarrage = (geste, pasMs = 100) => rejouer(geste, { borneMs: BORNES_DE_REJEU.demarrage, horloge, dormir, pasMs })
      const c = await demarrage(() => muter(id, (carte) => {
        capacite(carte, jeton)
        if (sansControleur(carte) && ['reservee', 'echec-reservation'].includes(carte.etat)) {
          libererReservation(carte, 'echec-reservation', raison)
        } else { signalerEchec(carte, raison); if (['nettoyage', 'fermee'].includes(carte.etat)) carte.issueSortie = 'echec' }
      }))
      if (sansControleur(c)) return c
      return demarrage(async () => {
        if (['nettoyage', 'fermee', 'echec-controle'].includes(lire(id).etat)) return (await api.attendre(id, { timeoutMs: 30_000, processusSeulement: true })).carte
        return (await api.fermer(id, jeton)).carte ?? lire(id)
      })
    },
    async attenteDemarrage(id, jeton) {
      const limite = lire(id).demarrageJusqua
      do {
        reconcilier()
        const c = lire(id)
        if (c.recuSessionStart) return c
        const validation = constaterRecu(id)
        if (validation.ok) return lire(id)
        if (validation.raison !== 'REÇU SESSIONSTART ABSENT') return api.echecDemarrage(id, jeton, validation.raison)
        if (c.etat !== 'reservee' && c.etat !== 'vivante') return api.echecDemarrage(id, jeton, 'REÇU SESSIONSTART ABSENT : agent sorti avant le hook natif')
        if (horloge() >= limite) return api.echecDemarrage(id, jeton, c.etat === 'reservee' ? 'CONTRÔLEUR NON DÉMARRÉ' : 'REÇU SESSIONSTART ABSENT : délai du hook natif dépassé')
        await dormir(Math.min(100, limite - horloge()))
      } while (true)
    },
    lister() {
      const vue = reconcilier()
      const toutes = vue.cartes.map((c) => {
        let etatMesure = c.etat
        if (c.producteur === PRODUCTEUR && !terminaux.has(c.etat)) {
          if (!observationCourante(c, vue)) etatMesure = 'indeterminee'
          else if (c.etat === 'nettoyage') etatMesure = 'nettoyage-en-cours'
          else if (c.etat !== 'reservee') { try { controle(c, vue) } catch { etatMesure = 'orpheline' } }
        }
        const { empreinteJeton: _empreinteJeton, empreinteNonce: _empreinteNonce, empreinteNonceHook: _empreinteNonceHook, ...publique } = c
        return { ...publique, etatMesure, ageMs: horloge() - Date.parse(c.date) }
      })
      const inscrits = toutes.flatMap((c) => [c.controleur, c.agentProcessus]).filter(Boolean)
      return { cartes: toutes, anomalies: vue.anomalies, nonInscrits: vue.inventaire.filter((p) => /codex/i.test(p.nom ?? '') && !inscrits.some((id) => identique(p, id))).map((p) => ({ ...p, etatMesure: 'NON INSCRIT', stoppable: false })), evenements: toutes.flatMap((c) => c.evenements ?? []) }
    },
    archiver() {
      const vue = constater(), archive = join(dossier, 'archive'), archivees = [], conservees = []
      const candidates = collection().anomalies
      if (candidates.length) sousVerrou(() => { for (const { fichier } of candidates) {
        let raison, brut = null
        try { brut = brutDe(fichier); validerCarte(brut, fichier); continue } catch (e) {
          const refus = refusSession(e)
          if (refus.categorie === 'métier') continue
          if (refus.retentable) { conservees.push({ fichier, raison: e.message }); continue }
          raison = e.message
        }
        if (brut && typeof brut === 'object' && encorePresent(brut, vue)) { conservees.push({ fichier, raison }); continue }
        const base = fichier.slice(0, -EXTENSION_CARTE.length)
        const noms = [...Object.values(ANNEXES).map((suffixe) => `${base}.${suffixe}`), fichier].filter((nom) => fs.existsSync(join(dossier, nom)))
        const occupe = noms.find((nom) => fs.existsSync(join(archive, nom)))
        if (occupe) { conservees.push({ fichier, raison: erreur('métier', `ARCHIVE OCCUPÉE : archive/${occupe}`).message }); continue }
        fs.mkdirSync(archive, { recursive: true })
        try { for (const nom of noms) { renommerResilient(join(dossier, nom), join(archive, nom)); archivees.push(nom) } }
        catch (e) { conservees.push({ fichier, raison: erreur(refusSession(e).categorie, `ARCHIVAGE INTERROMPU : ${fichier} — ${e.code ?? e.message}`, { cause: e }).message }) }
      } })
      return { archivees, conservees }
    },
    async attendre(cible, { timeoutMs = 60_000, depuis = 0, processusSeulement = false } = {}) {
      const vue = reconcilier()
      const choisie = choisir(cible, { attente: true, vue }), id = choisie.sessionId, debut = horloge()
      if (!processusSeulement && choisie.producteur === PRODUCTEUR && choisie.agent === 'codex' && !terminaux.has(choisie.etat)) return veiller({ dossier, sessionId: id, depuis, timeoutMs })
      do {
        const c = lire(id)
        if (terminaux.has(c.etat) && c.etat !== 'fermee') return { etat: c.etat, carte: muter(id, (carte) => { carte.consommeLe = maintenant() }) }
        if (estSortieObservee(c)) return { etat: 'sortie', carte: muter(id, (carte) => { carte.consommeLe = maintenant() }) }
        if (horloge() - debut >= timeoutMs) return { etat: 'indeterminee', raison: 'ATTENTE TIMEOUT', carte: c }
        await dormir(Math.min(250, timeoutMs - (horloge() - debut)))
        reconcilier()
      } while (true)
    },
    async fermer(cible, jeton, { timeoutMs = DELAI_FERMETURE_MS } = {}) {
      const demande = api.demanderArret(cible, jeton), debut = horloge()
      if (demande.etat === 'fermee' && sansControleur(demande)) return { etat: 'fermee', carte: demande }
      do {
        const vue = reconcilier()
        const c = lire(demande.sessionId)
        if (c.etat === 'echec-controle') return { etat: c.etat, carte: c }
        if (c.demandeId === demande.demandeId && estSortieObservee(c)) return { etat: 'sortie', carte: muter(c.sessionId, (carte) => { carte.arretAckLe = maintenant() }) }
        if (!terminaux.has(c.etat) && c.etat !== 'nettoyage') controle(c, vue)
        if (horloge() - debut >= timeoutMs) return { etat: 'indeterminee', raison: 'ACK TIMEOUT' }
        await dormir(100)
      } while (true)
    },
    async superviser(id, { lancer, apresLancement, lireRapport, causeSortie, periodeMs = 500 }) {
      let child, timer, fini, veille, arret = false, termine = false
      const registre = (geste) => rejouer(geste, { borneMs: BORNES_DE_REJEU.supervision, horloge, dormir })
      const arretDemande = () => {
        if (termine) return false
        let demande
        try { demande = lireJSON(stop(id)) } catch (e) { if (e.code === 'ENOENT') return false; throw e }
        return demande.sessionId === id && demande.demandeId === lire(id).demandeId
      }
      try {
        const initiale = await registre(() => lire(id))
        child = lancer(initiale)
        fini = new Promise((ok, non) => { child.once('error', non); child.once('exit', (codeAgent, signal) => ok({ codeAgent, signal })) })
        fini.catch(() => {})
        if (apresLancement) await registre(apresLancement)
        const identite = await registre(() => processus(child.pid))
        if (identite) await registre(() => api.agentDemarre(id, identite))
        timer = setInterval(() => {
          if (arret || veille) return
          veille = rejouer(arretDemande, { borneMs: BORNES_DE_REJEU.arret, horloge, dormir, pasMs: periodeMs })
            .then((demandee) => demandee, () => !termine)
            .then((tuer) => { if (tuer) { arret = true; child.kill() } })
            .finally(() => { veille = undefined })
        }, periodeMs)
        const fin = await fini
        termine = true
        let rapport, raison, raisonOrigine
        const recuNatif = await registre(() => constaterRecu(id))
        if (!recuNatif.ok) raison = recuNatif.raison
        if ((await registre(() => lire(id))).etat === 'arret-demande') arret = true
        if (causeSortie && fin.codeAgent !== 0 && !arret) {
          const cause = await causeSortie()
          if (cause || recuNatif.ok) {
            if (!recuNatif.ok) await registre(() => muter(id, (c) => observer(c, recuNatif.raison)))
            raison = `AGENT SORTI EN ${fin.codeAgent ?? fin.signal}${cause ? ` : ${cause}` : ''}`
            raisonOrigine = cause ? 'diagnostic' : 'generique'
          }
        }
        if (recuNatif.ok && initiale.agent === 'codex' && fin.codeAgent === 0 && !arret && !(await registre(() => lire(id))).codex) {
          try { const lu = await registre(lireRapport), validation = validerRapport(lu, initiale); if (validation.ok) rapport = lu; else raison = validation.raison }
          catch (e) { raison = e.message }
        }
        return { ...await registre(() => sortie(id, { ...fin, arret, rapport, raison, raisonOrigine })), codeEnveloppe: 0 }
      } catch (e) {
        termine = true
        if (child && child.exitCode === null && !arret) child.kill()
        if (fini) { try { await fini } catch {} }
        const cause = causeSortie && child ? await causeSortie() : ''
        return { ...await registre(() => sortie(id, { codeAgent: null, raison: `SPAWN/SUPERVISION : ${cause || e.message}` })), codeEnveloppe: 0 }
      } finally { if (timer) clearInterval(timer); await veille; fs.rmSync(stop(id), { force: true }) }
    },
  }
  return api
}

function powershell(commande) {
  const vu = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', commande], { encoding: 'utf8', windowsHide: true, timeout: 15_000, env: envAgent(process.env) })
  if (vu.error || vu.status !== 0) throw erreur('transitoire', `MESURE WINDOWS INDISPONIBLE : ${vu.error?.message ?? vu.stderr}`)
  return vu.stdout.trim()
}

export function inventorierProcessus() {
  const brut = powershell("@(Get-CimInstance Win32_Process | Select-Object ProcessId,Name,@{n='Creation';e={$_.CreationDate.ToUniversalTime().ToString('o')}}) | ConvertTo-Json -Compress")
  return (JSON.parse(brut || '[]')).map((p) => ({ pid: p.ProcessId, nom: p.Name, creation: p.Creation }))
}
export function mesurerProcessus(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null
  const brut = powershell(`Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' | Select-Object ProcessId,@{n='Creation';e={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`)
  if (!brut) return null
  const p = JSON.parse(brut)
  return { pid: p.ProcessId, creation: p.Creation }
}
export function contexteSessions(worktree) {
  const depot = depotDe(worktree), principal = arbrePrincipal(depot)
  if (!principal.disponible) throw erreur('panne', principal.raison)
  return { racine: principal.valeur, gitCommun: join(principal.valeur, '.git'), worktree: resolve(worktree), branche: brancheDe(depot), head: shaDe(depot, 'HEAD') }
}

export async function piloterAgent({ sessions, dossier, carte, consigne, lancer, pont = lancerPontCodex, preflight = preflightSessionStart, retirer = (fichier) => fs.rmSync(fichier, { force: true }), horloge = Date.now, dormir = sommeil }) {
  const id = carte.sessionId, rapport = annexeDe(dossier, id, 'rapport'), journal = annexeDe(dossier, id, 'journal'), contexteHook = annexeDe(dossier, id, 'contexte')
  const sous = (geste) => rejouer(geste, { borneMs: BORNES_DE_REJEU.supervision, horloge, dormir })
  let agent
  try {
    const actuel = await preflight(carte.worktree, carte.agent)
    if (actuel.empreinteCanon !== carte.hooks?.empreinteCanon || actuel.empreinteCredo !== carte.hooks?.empreinteCredo) throw erreur('permission', 'HOOKS : EMPREINTE CHANGÉE AVANT SPAWN')
    const contexte = await sous(() => lireJSON(contexteHook))
    const plan = planAgent(carte, { natif: carte.executable, consigne: consigneAgent(carte, consigne), rapport, schema: SCHEMA_RAPPORT, politique: lirePolitique() })
    return await sessions.superviser(id, {
      lancer: () => {
        const env = envAgent({ ...process.env, WFRP_SESSION_START: Buffer.from(JSON.stringify(contexte)).toString('base64') })
        agent = carte.agent === 'codex'
          ? pont({ plan, carte, dossier, consigne: consigneAgent(carte, consigne), schema: SCHEMA_RAPPORT, env, lancer, notifier: (projection) => sessions.projectionCodex(id, projection) })
          : lancerAgent(plan, carte, { journal, lancer, env })
        return agent.child
      },
      apresLancement: () => sessions.muter(id, (c) => { c.journalDiagnostic = carte.agent === 'codex' ? agent.journalDiagnostic : journal }),
      causeSortie: () => agent.cause(),
      lireRapport: () => lireRapportDe(rapport),
    })
  } finally {
    if (agent) await agent.cause()
    for (const fichier of [rapport, contexteHook, annexeDe(dossier, id, 'recu')]) { try { await sous(() => retirer(fichier)) } catch (e) { process.stderr.write(`[session] ${refusSession(e).prefixe} PURGE IMPOSSIBLE : ${fichier} — ${e.code ?? e.message}\n`) } }
  }
}

export async function controleur({ dossier, id, hostPid = Number(process.env.WFRP_SESSION_JOBHOST), sessions = creerSessions({ dossier }), piloter = piloterAgent, horloge = Date.now, dormir = sommeil }) {
  const sous = (borneMs, geste) => rejouer(geste, { borneMs, horloge, dormir })
  await sous(BORNES_DE_REJEU.demarrage, () => sessions.revendiquer(id, undefined, { controleurPid: process.pid, jobHostPid: hostPid }))
  delete process.env.WFRP_SESSION_REVENDICATION
  try {
    const carte = await sous(BORNES_DE_REJEU.supervision, () => sessions.lire(id))
    const consigne = await sous(BORNES_DE_REJEU.supervision, () => fs.readFileSync(carte.consigne, 'utf8'))
    return await piloter({ sessions, dossier, carte, consigne, horloge, dormir })
  } catch (e) { return sous(BORNES_DE_REJEU.supervision, () => sessions.sortie(id, { codeAgent: null, raison: e.message })) }
}

if (import.meta.main) {
  try { await controleur({ dossier: process.argv[2], id: process.argv[3] }) }
  catch (e) { process.stderr.write(`[session] ${e.message}\n`) }
  process.exitCode = 0
}

export const ligneControleur = ({ node = process.execPath, script, dossier, id }) => [node, script, dossier, id].map(citerArgv).join(' ')
