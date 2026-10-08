import fs from 'node:fs'
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { join, resolve, extname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { z } from 'zod'
import { prendreVerrou } from '../test/verrou.mjs'
import { depotDe, arbrePrincipal, brancheDe, shaDe } from '../guards/lib/gitPorte.mjs'
import { citerArgv } from './publier.mjs'
import { BORNE_RAISON } from '../guards/lib/ticketsGh.mjs'

export const PRODUCTEUR = 'ops:session'
const terminaux = new Set(['fermee', 'echec-reservation', 'echec-controle'])
const Identite = z.object({ pid: z.number().int().positive(), creation: z.string().min(1) }).passthrough()
const CarteSession = z.object({
  sessionId: z.uuid(), producteur: z.literal(PRODUCTEUR), ticket: z.number().int().positive(), nom: z.string().min(1),
  agent: z.enum(['claude', 'codex']), consigne: z.string().refine(isAbsolute), worktree: z.string().refine(isAbsolute), racine: z.string().refine(isAbsolute),
  branche: z.string().min(1), head: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/), date: z.iso.datetime(), reserveJusqua: z.number(),
  lanceur: Identite, empreinteJeton: z.string().regex(/^[0-9a-f]{64}$/), empreinteNonce: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  etat: z.enum(['reservee', 'vivante', 'arret-demande', 'nettoyage', 'fermee', 'echec-reservation', 'echec-controle']),
  controleur: Identite.optional(), jobHost: Identite.optional(), agentProcessus: Identite.optional(),
  evenements: z.array(z.object({ ticket: z.number().int().positive(), nom: z.string(), sessionId: z.uuid(), date: z.iso.datetime(), type: z.enum(['lancement', 'clôture', 'échec']) })),
}).passthrough().superRefine((c, ctx) => {
  if (c.etat === 'reservee' && !c.empreinteNonce) ctx.addIssue({ code: 'custom', message: 'nonce requis' })
  if (['vivante', 'arret-demande'].includes(c.etat) && (!c.controleur || !c.jobHost)) ctx.addIssue({ code: 'custom', message: 'identités de contrôle requises' })
  if (['nettoyage', 'fermee'].includes(c.etat) && !['sortie', 'echec'].includes(c.issueSortie)) ctx.addIssue({ code: 'custom', message: 'issue de sortie requise' })
  if (c.etat === 'echec-controle' && c.codeEnveloppe !== undefined) ctx.addIssue({ code: 'custom', message: 'sortie enveloppe inconnue' })
})
const PolitiqueSession = z.object({ sandbox: z.enum(['danger-full-access']), approvalPolicy: z.enum(['never']), ignoreUserConfig: z.boolean(), model: z.string().min(1), reasoningEffort: z.string().regex(/^[a-z]+$/) }).strict()
const validerPolitique = (brut) => {
  const vu = PolitiqueSession.safeParse(brut)
  if (!vu.success) throw new Error(`POLITIQUE INVALIDE : ${vu.error.issues.map((e) => `${e.path.join('.') || e.keys?.join(',') || '—'}: ${e.message}`).join('; ')}`)
  return vu.data
}
export const lirePolitique = (chemin = new URL('./session-policy.json', import.meta.url)) => validerPolitique(JSON.parse(fs.readFileSync(chemin, 'utf8')))
const empreinte = (secret) => createHash('sha256').update(secret).digest('hex')
const identique = (a, b) => !!a && !!b && a.pid === b.pid && a.creation === b.creation
const sommeil = (ms) => new Promise((r) => setTimeout(r, ms))
const lireJSON = (chemin) => JSON.parse(fs.readFileSync(chemin, 'utf8'))
const sauver = (chemin, valeur) => {
  const temporaire = `${chemin}.${randomUUID()}.tmp`
  try { fs.writeFileSync(temporaire, `${JSON.stringify(valeur, null, 2)}\n`, { flag: 'wx' }); fs.renameSync(temporaire, chemin) }
  finally { fs.rmSync(temporaire, { force: true }) }
}

export function envAgent(env) {
  const propre = { ...env }
  delete propre.WFRP_SESSION_JETON
  delete propre.WFRP_SESSION_REVENDICATION
  delete propre.CLAUDE_CODE_CHILD_SESSION
  delete propre.GH_TOKEN
  delete propre.GITHUB_TOKEN
  return propre
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

export function planAgent(carte, { natif, consigne, rapport, schema, politique }) {
  if (extname(natif ?? '').toLowerCase() !== '.exe') throw new Error('AGENT NATIF ABSENT : executable .exe requis')
  if (carte.agent === 'claude') return { executable: natif, args: [consigne], shell: false }
  if (carte.agent !== 'codex') throw new Error('AGENT INCONNU')
  const p = validerPolitique(politique)
  return { executable: natif, shell: false, args: ['exec', ...(p.ignoreUserConfig ? ['--ignore-user-config'] : []), '-m', p.model, '-c', `model_reasoning_effort="${p.reasoningEffort}"`, '-c', `approval_policy="${p.approvalPolicy}"`, '-c', `sandbox_mode="${p.sandbox}"`, '-C', carte.worktree, '-o', rapport, '--output-schema', schema, consigne] }
}

export const contratCodex = ({ sessionId, ticket, worktree }) => `Rapport final JSON : sessionId=${sessionId}, ticket=${ticket}, worktree=${worktree} ; atterrissage = sha du commit d'atterrissage sur main si ta publication est MERGED, sinon null ; resume décrit le résultat.`

export const consigneAgent = (carte, texte) => carte.agent === 'codex' ? `${texte}\n\n${contratCodex({ sessionId: carte.sessionId, ticket: carte.ticket, worktree: carte.worktree })}` : texte

export function lancerAgent(plan, carte, { journal, lancer = spawn, echo = (morceau) => process.stderr.write(morceau), delaiMs = 2_000 }) {
  const child = lancer(plan.executable, plan.args, { cwd: carte.worktree, shell: false, stdio: carte.agent === 'codex' ? ['inherit', 'inherit', 'pipe'] : 'inherit', env: envAgent(process.env) })
  child.stderr?.on('data', (morceau) => { echo(morceau); fs.appendFileSync(journal, morceau) })
  const ferme = new Promise((ok) => { if (!child.stderr) return ok(); child.stderr.once('close', ok); child.stderr.once('error', ok) })
  const cause = async () => {
    await Promise.race([ferme, new Promise((ok) => setTimeout(ok, delaiMs).unref())])
    try { return fs.readFileSync(journal, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' · ').slice(-BORNE_RAISON) } catch { return '' }
  }
  return { child, cause }
}

const cheminComparable = (chemin) => process.platform === 'win32' ? resolve(chemin).toLowerCase() : resolve(chemin)

const SCHEMA_RAPPORT = fileURLToPath(new URL('./session-report.schema.json', import.meta.url))
const CLES_RAPPORT = JSON.parse(fs.readFileSync(SCHEMA_RAPPORT, 'utf8')).required.toSorted().join(',')

export function validerRapport(rapport, carte) {
  if (!rapport || typeof rapport !== 'object' || Object.keys(rapport).toSorted().join(',') !== CLES_RAPPORT || typeof rapport.sessionId !== 'string' || !Number.isInteger(rapport.ticket) || typeof rapport.worktree !== 'string' || typeof rapport.resume !== 'string' || (rapport.atterrissage !== null && !/^[0-9a-f]{40}$/.test(String(rapport.atterrissage)))) return { ok: false, raison: 'RAPPORT INVALIDE' }
  if (rapport.sessionId !== carte.sessionId || rapport.ticket !== carte.ticket || cheminComparable(rapport.worktree) !== cheminComparable(carte.worktree)) return { ok: false, raison: 'RAPPORT ÉTRANGER' }
  return { ok: true }
}

export function creerSessions({ dossier, horloge = Date.now, processus = mesurerProcessus, inventaire = inventorierProcessus, dormir = sommeil, lanceur }) {
  fs.mkdirSync(dossier, { recursive: true })
  const chemin = (id) => { if (!/^[\w-]+$/.test(id)) throw new Error('IDENTITÉ INVALIDE'); return join(dossier, `${id}.json`) }
  const stop = (id) => join(dossier, `${id}.stop`)
  const bootstrap = (id) => join(dossier, `${id}.bootstrap`)
  const validerCarte = (brut, fichier) => {
    if (!brut || typeof brut !== 'object' || Array.isArray(brut) || typeof brut.producteur !== 'string' || !brut.producteur) throw new Error(`CARTE INVALIDE : ${fichier}`)
    if (brut.producteur !== PRODUCTEUR) return brut
    const vu = CarteSession.safeParse(brut)
    if (!vu.success || `${brut.sessionId}.json` !== fichier) throw new Error(`CARTE INVALIDE : ${fichier}${vu.success ? ' — identité/fichier divergent' : ` — ${vu.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`}`)
    return vu.data
  }
  const collection = () => {
    const cartes = [], anomalies = []
    for (const fichier of fs.readdirSync(dossier).filter((n) => n.endsWith('.json'))) {
      try { cartes.push(validerCarte(lireJSON(join(dossier, fichier)), fichier)) }
      catch (e) { anomalies.push({ fichier, raison: e.message }) }
    }
    return { cartes, anomalies }
  }
  const lire = (id) => {
    const fichier = `${id}.json`
    let brut
    try { brut = lireJSON(chemin(id)) } catch (e) { if (e.code === 'ENOENT') throw e; throw new Error(`CARTE INVALIDE : ${fichier}`, { cause: e }) }
    return validerCarte(brut, fichier)
  }
  const maintenant = () => new Date(horloge()).toISOString()
  const sansControleur = (c) => !c.controleur && !c.jobHost && !c.agentProcessus
  const capacite = (c, jeton) => {
    if (!jeton) throw new Error('JETON ABSENT')
    if (!timingSafeEqual(Buffer.from(c.empreinteJeton, 'hex'), Buffer.from(empreinte(jeton), 'hex'))) throw new Error('JETON INCORRECT')
  }
  const signalerEchec = (c, raison) => {
    c.raison = raison; c.echecLe = maintenant()
    if (!c.evenements.some((e) => e.type === 'échec')) c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date: c.echecLe, type: 'échec' })
  }
  const libererReservation = (c, etat, raison) => {
    c.etat = etat; delete c.empreinteNonce; delete c.codeEnveloppe
    fs.rmSync(bootstrap(c.sessionId), { force: true })
    const date = maintenant()
    if (raison) signalerEchec(c, raison)
    if (etat === 'fermee') { c.fermeeLe = date; c.issueSortie = c.raison ? 'echec' : 'sortie' }
    if (etat === 'fermee') c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date, type: 'clôture' })
  }
  const sousVerrou = (geste) => {
    const prise = prendreVerrou({ chemin: join(dossier, 'registre.lock'), libelle: 'sessions', commande: 'ops:session', cwd: dossier, attente: { echeanceMs: 5000, pasMs: 20 } })
    if (prise.etat !== 'pris') throw new Error(prise.message)
    try { return geste() } finally { prise.liberer() }
  }
  const ecrireCarte = (carte) => sousVerrou(() => { validerCarte(carte, `${carte.sessionId}.json`); if (fs.existsSync(chemin(carte.sessionId))) { const precedente = lire(carte.sessionId); if (precedente.producteur !== PRODUCTEUR || carte.producteur !== PRODUCTEUR) throw new Error('CARTE ÉTRANGÈRE'); } sauver(chemin(carte.sessionId), carte); return carte })
  const muter = (id, fn) => sousVerrou(() => { const carte = lire(id); if (carte.producteur !== PRODUCTEUR) throw new Error('CARTE ÉTRANGÈRE'); fn(carte); validerCarte(carte, `${id}.json`); sauver(chemin(id), carte); return carte })
  const constater = () => { const liste = inventaire(); return { inventaire: liste, processus: new Map(liste.map((p) => [p.pid, p])) } }
  const encorePresent = (carte, vue) => [carte.controleur, carte.jobHost, carte.agentProcessus].some((id) => id && identique(vue.processus.get(id.pid), id))
  const reconcilier = () => {
    return sousVerrou(() => {
      const ensemble = collection()
      const vue = constater()
      for (const c of ensemble.cartes) {
        if (c.producteur !== PRODUCTEUR) continue
        if (c.etat === 'reservee' && horloge() > c.reserveJusqua) {
          libererReservation(c, 'echec-reservation', 'RÉSERVATION EXPIRÉE')
          sauver(chemin(c.sessionId), c)
        } else if (c.etat === 'nettoyage' && !encorePresent(c, vue)) {
          c.etat = 'fermee'; c.fermeeLe = maintenant(); c.codeEnveloppe = 0
          c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date: c.fermeeLe, type: 'clôture' })
          sauver(chemin(c.sessionId), c)
        } else if (['vivante', 'arret-demande'].includes(c.etat) && !encorePresent(c, vue)) {
          c.etat = 'echec-controle'; c.raison = 'contrôle perdu, sortie inconnue'; c.issueSortie = 'echec'; c.echecLe = maintenant(); delete c.codeEnveloppe
          c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date: c.echecLe, type: 'échec' })
          sauver(chemin(c.sessionId), c)
        }
      }
      return { ...ensemble, ...vue }
    })
  }
  const choisir = (cible, { attente = false, vue = reconcilier() } = {}) => {
    const exact = vue.cartes.find((c) => c.sessionId === cible)
    if (exact) return exact
    const anomalie = vue.anomalies.find((a) => a.fichier === `${cible}.json`)
    if (anomalie) throw new Error(anomalie.raison)
    const pid = /^\d+$/.test(String(cible)) ? Number(cible) : null
    const matches = vue.cartes.filter((c) => String(c.ticket) === String(cible) || c.nom === cible || (pid !== null && [c.controleur, c.agentProcessus].some((id) => id?.pid === pid && identique(vue.processus.get(pid), id))))
    if (!matches.length) throw new Error('NON INSCRIT : aucune session correspondante')
    const actives = matches.filter((c) => c.producteur !== PRODUCTEUR || !terminaux.has(c.etat))
    if (actives.length > 1) throw new Error('CIBLE AMBIGUË : plusieurs sessions actives, utiliser UUID')
    if (actives.length === 1) return actives[0]
    if (!attente) throw new Error('DÉJÀ SORTIE')
    return matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.sessionId.localeCompare(a.sessionId))[0]
  }
  const controle = (carte, vue = constater()) => {
    const vu = vue.processus.get(carte.controleur?.pid)
    if (!vu) throw new Error('CONTRÔLE PERDU : contrôleur absent')
    if (!identique(vu, carte.controleur)) throw new Error('PID RECYCLÉ : contrôleur étranger')
    if (!identique(vue.processus.get(carte.jobHost?.pid), carte.jobHost)) throw new Error('CONTRÔLE PERDU : JobHost absent ou recyclé')
  }
  const estSortieObservee = (carte) => carte.etat === 'fermee'
  const sortie = (id, fin) => muter(id, (c) => { if (c.etat === 'fermee' || c.etat === 'nettoyage') throw new Error('DÉJÀ SORTIE'); const raison = fin.raison ?? c.raison; Object.assign(c, fin, { raison, etat: 'nettoyage', issueSortie: raison || (fin.codeAgent !== 0 && !fin.arret) ? 'echec' : 'sortie', sortieLe: maintenant() }); delete c.codeEnveloppe })
  const revendiquer = (id, nonce, ids) => sousVerrou(() => {
    const c = lire(id)
    if (c.producteur !== PRODUCTEUR) throw new Error('CARTE ÉTRANGÈRE')
    if (c.etat === 'echec-reservation' || (c.etat === 'reservee' && horloge() > c.reserveJusqua)) throw new Error('RÉSERVATION EXPIRÉE')
    if (c.etat !== 'reservee') throw new Error('REVENDICATION REFUSÉE')
    const revendication = nonce ?? lireJSON(bootstrap(id)).nonce
    if (c.etat !== 'reservee' || c.empreinteNonce !== empreinte(revendication ?? '')) throw new Error('REVENDICATION REFUSÉE')
    const vue = constater()
    ids = { controleur: ids.controleur ?? vue.processus.get(ids.controleurPid), jobHost: ids.jobHost ?? vue.processus.get(ids.jobHostPid) }
    if (!ids.controleur?.creation || !ids.jobHost?.creation || !identique(vue.processus.get(ids.controleur.pid), ids.controleur) || !identique(vue.processus.get(ids.jobHost.pid), ids.jobHost)) throw new Error('REVENDICATION : IDENTITÉ NON MESURÉE')
    Object.assign(c, ids, { etat: 'vivante', revendiqueLe: maintenant() }); delete c.empreinteNonce
    sauver(chemin(id), c)
    fs.rmSync(bootstrap(id), { force: true })
    return c
  })
  const api = {
    lire, ecrireCarte, muter,
    reserver(p) {
      const vue = reconcilier()
      return sousVerrou(() => {
        if (collection().cartes.some((c) => c.producteur === PRODUCTEUR && !terminaux.has(c.etat) && (c.ticket === p.ticket || c.nom === p.nom))) throw new Error('COLLISION : ticket ou nom déjà réservé')
        const sessionId = randomUUID(), jeton = randomBytes(32).toString('hex'), nonce = randomBytes(32).toString('hex')
        const carte = { ...p, sessionId, producteur: PRODUCTEUR, lanceur: lanceur ? lanceur() : vue.processus.get(process.pid), date: maintenant(), reserveJusqua: horloge() + 60_000, empreinteJeton: empreinte(jeton), empreinteNonce: empreinte(nonce), etat: 'reservee', evenements: [{ ticket: p.ticket, nom: p.nom, sessionId, date: maintenant(), type: 'lancement' }] }
        validerCarte(carte, `${sessionId}.json`)
        sauver(chemin(sessionId), carte)
        sauver(bootstrap(sessionId), { nonce })
        return { carte, jeton, nonce }
      })
    },
    revendiquer,
    agentDemarre: (id, agentProcessus) => muter(id, (c) => { if (!agentProcessus?.creation) throw new Error('IDENTITÉ AGENT ABSENTE'); c.agentProcessus = agentProcessus }),
    demanderArret(cible, jeton) {
      const vue = reconcilier(), choisie = choisir(cible, { vue, attente: true })
      return muter(choisie.sessionId, (c) => {
        capacite(c, jeton)
        if (sansControleur(c) && ['reservee', 'echec-reservation'].includes(c.etat)) { libererReservation(c, 'fermee'); return }
        if (terminaux.has(c.etat) || c.etat === 'nettoyage') throw new Error('DÉJÀ SORTIE')
        controle(c, constater())
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
      const c = muter(id, (carte) => {
        capacite(carte, jeton)
        if (sansControleur(carte) && ['reservee', 'echec-reservation'].includes(carte.etat)) {
          libererReservation(carte, 'echec-reservation', raison)
        } else { signalerEchec(carte, raison); if (['nettoyage', 'fermee'].includes(carte.etat)) carte.issueSortie = 'echec' }
      })
      if (sansControleur(c)) return c
      if (['nettoyage', 'fermee', 'echec-controle'].includes(c.etat)) return (await api.attendre(id, { timeoutMs: 30_000 })).carte
      return (await api.fermer(id, jeton)).carte ?? lire(id)
    },
    async attenteDemarrage(id, jeton) {
      const limite = lire(id).reserveJusqua
      do {
        reconcilier()
        const c = lire(id)
        if (c.etat !== 'reservee') return c
        if (horloge() >= limite) return api.echecDemarrage(id, jeton, 'CONTRÔLEUR NON DÉMARRÉ')
        await dormir(Math.min(100, limite - horloge()))
      } while (true)
    },
    lister() {
      const vue = reconcilier()
      const toutes = vue.cartes.map((c) => {
        let etatMesure = c.etat
        if (c.producteur === PRODUCTEUR && !terminaux.has(c.etat)) {
          if (c.etat === 'nettoyage') etatMesure = 'nettoyage-en-cours'
          else if (c.etat !== 'reservee') { try { controle(c, vue) } catch { etatMesure = 'orpheline' } }
        }
        const { empreinteJeton: _empreinteJeton, empreinteNonce: _empreinteNonce, ...publique } = c
        return { ...publique, etatMesure, ageMs: horloge() - Date.parse(c.date) }
      })
      const inscrits = toutes.flatMap((c) => [c.controleur, c.agentProcessus]).filter(Boolean)
      return { cartes: toutes, anomalies: vue.anomalies, nonInscrits: vue.inventaire.filter((p) => /codex/i.test(p.nom ?? '') && !inscrits.some((id) => identique(p, id))).map((p) => ({ ...p, etatMesure: 'NON INSCRIT', stoppable: false })), evenements: toutes.flatMap((c) => c.evenements ?? []) }
    },
    async attendre(cible, { timeoutMs = 60_000 } = {}) {
      const vue = reconcilier()
      const id = choisir(cible, { attente: true, vue }).sessionId, debut = horloge()
      do {
        const c = lire(id)
        if (terminaux.has(c.etat) && c.etat !== 'fermee') return { etat: c.etat, carte: muter(id, (carte) => { carte.consommeLe = maintenant() }) }
        if (estSortieObservee(c)) return { etat: 'sortie', carte: muter(id, (carte) => { carte.consommeLe = maintenant() }) }
        if (horloge() - debut >= timeoutMs) return { etat: 'indeterminee', raison: 'ATTENTE TIMEOUT', carte: c }
        await dormir(Math.min(250, timeoutMs - (horloge() - debut)))
        reconcilier()
      } while (true)
    },
    async fermer(cible, jeton, { timeoutMs = 30_000 } = {}) {
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
    async superviser(id, { lancer, lireRapport, causeSortie, periodeMs = 500 }) {
      let child, timer, fini, arret = false
      try {
        const initiale = lire(id)
        child = lancer(initiale)
        fini = new Promise((ok, non) => { child.once('error', non); child.once('exit', (codeAgent, signal) => ok({ codeAgent, signal })) })
        const identite = processus(child.pid)
        if (identite) api.agentDemarre(id, identite)
        timer = setInterval(() => {
          if (arret) return
          try { const demande = lireJSON(stop(id)); if (demande.sessionId === id && demande.demandeId === lire(id).demandeId) { arret = true; child.kill() } }
          catch (e) { if (e.code !== 'ENOENT') { arret = true; child.kill() } }
        }, periodeMs)
        const fin = await fini
        let rapport, raison
        if (lire(id).etat === 'arret-demande') arret = true
        if (causeSortie && fin.codeAgent !== 0 && !arret) { const cause = await causeSortie(); raison = `AGENT SORTI EN ${fin.codeAgent ?? fin.signal}${cause ? ` : ${cause}` : ''}` }
        if (initiale.agent === 'codex' && fin.codeAgent === 0 && !arret) {
          try { const lu = lireRapport(), validation = validerRapport(lu, initiale); if (validation.ok) rapport = lu; else raison = validation.raison }
          catch (e) { raison = e.message }
        }
        return { ...sortie(id, { ...fin, arret, rapport, raison }), codeEnveloppe: 0 }
      } catch (e) {
        if (child && child.exitCode === null && !arret) child.kill()
        if (fini) { try { await fini } catch {} }
        return { ...sortie(id, { codeAgent: null, raison: `SPAWN/SUPERVISION : ${e.message}` }), codeEnveloppe: 0 }
      } finally { if (timer) clearInterval(timer); fs.rmSync(stop(id), { force: true }) }
    },
  }
  return api
}

function powershell(commande) {
  const vu = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', commande], { encoding: 'utf8', windowsHide: true, timeout: 15_000, env: envAgent(process.env) })
  if (vu.error || vu.status !== 0) throw new Error(`MESURE WINDOWS INDISPONIBLE : ${vu.error?.message ?? vu.stderr}`)
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
  if (!principal.disponible) throw new Error(principal.raison)
  return { racine: principal.valeur, gitCommun: join(principal.valeur, '.git'), worktree: resolve(worktree), branche: brancheDe(depot), head: shaDe(depot, 'HEAD') }
}

export async function controleur({ dossier, id, hostPid = Number(process.env.WFRP_SESSION_JOBHOST) }) {
  const sessions = creerSessions({ dossier })
  sessions.revendiquer(id, undefined, { controleurPid: process.pid, jobHostPid: hostPid })
  delete process.env.WFRP_SESSION_REVENDICATION
  try {
  const carte = sessions.lire(id), rapport = join(dossier, `${id}.rapport`)
  const plan = planAgent(carte, { natif: carte.executable, consigne: consigneAgent(carte, fs.readFileSync(carte.consigne, 'utf8')), rapport, schema: SCHEMA_RAPPORT, politique: lirePolitique() })
  let agent
  return await sessions.superviser(id, {
    lancer: () => { agent = lancerAgent(plan, carte, { journal: join(dossier, `${id}.stderr`) }); return agent.child },
    causeSortie: () => agent.cause(),
    lireRapport: () => lireJSON(rapport),
  })
  } catch (e) { return sessions.sortie(id, { codeAgent: null, raison: e.message }) }
}

if (import.meta.main) {
  try { await controleur({ dossier: process.argv[2], id: process.argv[3] }) }
  catch (e) { process.stderr.write(`[session] ${e.message}\n`) }
  process.exitCode = 0
}

export const ligneControleur = ({ node = process.execPath, script, dossier, id }) => [node, script, dossier, id].map(citerArgv).join(' ')
