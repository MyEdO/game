import fs from 'node:fs'
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { join, resolve, extname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { z } from 'zod'
import { prendreVerrou } from '../test/verrou.mjs'
import { depotDe, arbrePrincipal, brancheDe, shaDe, etatDeLArbre } from '../guards/lib/gitPorte.mjs'
import { citerArgv, cheminsDeJournal, lireJournal, idDeRun, envDeLancement, veillerLeTrain, FILE_TIMEOUT_MIN } from './publier.mjs'

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
  publication: z.object({ etat: z.enum(['non-demandee', 'demandee', 'lancee', 'echouee', 'fusionnee']) }).passthrough(),
  evenements: z.array(z.object({ ticket: z.number().int().positive(), nom: z.string(), sessionId: z.uuid(), date: z.iso.datetime(), type: z.enum(['lancement', 'clôture', 'échec']) })),
}).passthrough().superRefine((c, ctx) => {
  if (c.etat === 'reservee' && !c.empreinteNonce) ctx.addIssue({ code: 'custom', message: 'nonce requis' })
  if (['vivante', 'arret-demande'].includes(c.etat) && (!c.controleur || !c.jobHost)) ctx.addIssue({ code: 'custom', message: 'identités de contrôle requises' })
  if (['nettoyage', 'fermee'].includes(c.etat) && !['sortie', 'echec'].includes(c.issueSortie)) ctx.addIssue({ code: 'custom', message: 'issue de sortie requise' })
  if (c.etat === 'echec-controle' && c.codeEnveloppe !== undefined) ctx.addIssue({ code: 'custom', message: 'sortie enveloppe inconnue' })
})
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

export function planAgent(carte, { natif, consigne, gitCommun, rapport, schema, profilExiste, politique }) {
  if (extname(natif ?? '').toLowerCase() !== '.exe') throw new Error('AGENT NATIF ABSENT : executable .exe requis')
  if (carte.agent === 'claude') return { executable: natif, args: [consigne], shell: false }
  if (carte.agent !== 'codex') throw new Error('AGENT INCONNU')
  if (!profilExiste) throw new Error(`PROFIL ABSENT : ${politique.profile}`)
  if (politique.sandbox !== 'workspace-write' || politique.approveForMe !== true || politique.networkAccess !== false) throw new Error('POLITIQUE INVALIDE')
  return { executable: natif, shell: false, args: ['exec', '-p', politique.profile, '-C', carte.worktree, '--add-dir', gitCommun, '--sandbox', politique.sandbox, '--approve-for-me', '-c', `sandbox_workspace_write.network_access=${politique.networkAccess}`, '-o', rapport, '--output-schema', schema, consigne] }
}

export function validerRapport(rapport, carte, git) {
  if (!rapport || Object.keys(rapport).sort().join(',') !== 'head,publier,resume,sessionId,ticket,worktree' || typeof rapport.publier !== 'boolean' || typeof rapport.resume !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(rapport.head ?? '')) return { ok: false, raison: 'RAPPORT INVALIDE' }
  if (rapport.sessionId !== carte.sessionId || rapport.ticket !== carte.ticket || resolve(rapport.worktree) !== resolve(carte.worktree)) return { ok: false, raison: 'RAPPORT ÉTRANGER' }
  if (!carte.branche.startsWith('chantier/') || git.branche !== carte.branche || git.head !== rapport.head || !git.propre) return { ok: false, raison: 'GIT DIVERGENT' }
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
          c.etat = 'echec-reservation'; c.raison = 'RÉSERVATION EXPIRÉE'; c.echecLe = maintenant(); delete c.empreinteNonce
          c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date: c.echecLe, type: 'échec' })
          sauver(chemin(c.sessionId), c); fs.rmSync(bootstrap(c.sessionId), { force: true })
        } else if (c.etat === 'nettoyage' && !encorePresent(c, vue)) {
          c.etat = 'fermee'; c.fermeeLe = maintenant(); c.codeEnveloppe = 0
          c.evenements.push({ ticket: c.ticket, nom: c.nom, sessionId: c.sessionId, date: c.fermeeLe, type: 'clôture' })
          sauver(chemin(c.sessionId), c)
        } else if (['vivante', 'arret-demande'].includes(c.etat) && !encorePresent(c, vue)) {
          c.etat = 'echec-controle'; c.raison = 'contrôle perdu, sortie inconnue'; c.issueSortie = 'echec'; c.echecLe = maintenant(); delete c.codeEnveloppe
          if (c.publication.etat !== 'non-demandee') c.publication = { etat: 'echouee', raison: c.raison }
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
  const sortie = (id, fin) => muter(id, (c) => { if (c.etat === 'fermee' || c.etat === 'nettoyage') throw new Error('DÉJÀ SORTIE'); Object.assign(c, fin, { etat: 'nettoyage', issueSortie: fin.raison || (fin.codeAgent !== 0 && !fin.arret) ? 'echec' : 'sortie', sortieLe: maintenant() }); delete c.codeEnveloppe })
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
        const carte = { ...p, sessionId, producteur: PRODUCTEUR, lanceur: lanceur ? lanceur() : vue.processus.get(process.pid), date: maintenant(), reserveJusqua: horloge() + 60_000, empreinteJeton: empreinte(jeton), empreinteNonce: empreinte(nonce), etat: 'reservee', publication: { etat: 'non-demandee' }, evenements: [{ ticket: p.ticket, nom: p.nom, sessionId, date: maintenant(), type: 'lancement' }] }
        validerCarte(carte, `${sessionId}.json`)
        sauver(chemin(sessionId), carte)
        sauver(bootstrap(sessionId), { nonce })
        return { carte, jeton, nonce }
      })
    },
    revendiquer,
    agentDemarre: (id, agentProcessus) => muter(id, (c) => { if (!agentProcessus?.creation) throw new Error('IDENTITÉ AGENT ABSENTE'); c.agentProcessus = agentProcessus }),
    demanderArret(cible, jeton) {
      const vue = reconcilier(), choisie = choisir(cible, { vue })
      return muter(choisie.sessionId, (c) => {
        if (!jeton) throw new Error('JETON ABSENT')
        if (!timingSafeEqual(Buffer.from(c.empreinteJeton, 'hex'), Buffer.from(empreinte(jeton), 'hex'))) throw new Error('JETON INCORRECT')
        if (terminaux.has(c.etat) || c.etat === 'nettoyage') throw new Error('DÉJÀ SORTIE')
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
    async superviser(id, { lancer, lireRapport, mesurerGit, publier, periodeMs = 500 }) {
      let child, timer, fini, arret = false
      const annulation = new AbortController()
      try {
        const initiale = lire(id)
        child = lancer(initiale)
        fini = new Promise((ok, non) => { child.once('error', non); child.once('exit', (codeAgent, signal) => ok({ codeAgent, signal })) })
        const identite = processus(child.pid)
        if (identite) api.agentDemarre(id, identite)
        timer = setInterval(() => {
          if (arret) return
          try { const demande = lireJSON(stop(id)); if (demande.sessionId === id && demande.demandeId === lire(id).demandeId) { arret = true; child.kill(); annulation.abort(); } }
          catch (e) { if (e.code !== 'ENOENT') { arret = true; child.kill(); annulation.abort(); } }
        }, periodeMs)
        const fin = await fini
        let rapport, publication = { etat: 'non-demandee' }, raison
        if (lire(id).etat === 'arret-demande') arret = true
        if (initiale.agent === 'codex' && fin.codeAgent === 0 && !arret) {
          try {
            rapport = lireRapport(); const validation = validerRapport(rapport, initiale, mesurerGit())
            if (!validation.ok) raison = validation.raison
            else if (rapport.publier) {
              controle(lire(id))
              muter(id, (c) => { if (c.etat === 'arret-demande') throw new Error('ARRÊT DEMANDÉ'); c.rapport = rapport; c.publication = { etat: 'demandee' } })
              muter(id, (c) => { if (c.etat === 'arret-demande') throw new Error('ARRÊT DEMANDÉ'); c.publication = { etat: 'lancee' } })
              publication = await publier(initiale, rapport, annulation.signal)
              if (publication.etat !== 'fusionnee' || publication.statut !== 'MERGED' || !publication.sha || !publication.pr) { publication = { ...publication, etat: 'echouee', raison: publication.raison ?? 'VERDICT MERGED ABSENT' }; raison = publication.raison }
            }
          } catch (e) { raison = e.message; publication = { etat: 'echouee', raison } }
        }
        return { ...sortie(id, { ...fin, arret, rapport, publication, raison }), codeEnveloppe: 0 }
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

export async function publierSession(carte, rapport, signal, { lancer = spawn, executer = spawnSync, lire = lireJournal, veiller = veillerLeTrain, horloge = Date.now, mesurerHead = () => shaDe(depotDe(carte.worktree), 'HEAD') } = {}) {
  const script = join(carte.worktree, 'scripts/ops/publier.mjs')
  const lancement = horloge()
  if (signal?.aborted) return { etat: 'echouee', raison: 'ARRÊT DEMANDÉ' }
  const child = lancer(process.execPath, [script], { cwd: carte.worktree, shell: false, stdio: 'inherit', env: { ...envAgent(process.env), ...envDeLancement(lancement) } })
  const annuler = () => child.kill()
  signal?.addEventListener('abort', annuler, { once: true })
  const fin = new Promise((ok, non) => { child.once('error', non); child.once('exit', (code) => ok(code)) })
  const code = await fin
  signal?.removeEventListener('abort', annuler)
  if (signal?.aborted) return { etat: 'echouee', raison: 'ARRÊT DEMANDÉ' }
  const chemins = cheminsDeJournal(carte.worktree, carte.branche), run = idDeRun({ pid: child.pid, lancement })
  const veille = veiller({ run, fileTimeoutMin: FILE_TIMEOUT_MIN, lire: () => lire(chemins.json, carte.branche), ecrire: (ligne) => process.stdout.write(`${ligne}\n`) })
  const journal = lire(chemins.json, carte.branche)
  if (code !== 0 || veille !== 0 || journal.run !== run || journal.verdict?.etat !== 'vert') return { etat: 'echouee', raison: `TRAIN ${code} / VEILLE ${veille}` }
  const mesure = executer('gh', ['pr', 'view', carte.branche, '--json', 'number,state,mergeCommit'], { cwd: carte.worktree, encoding: 'utf8', windowsHide: true, timeout: 30_000, env: envAgent(process.env) })
  if (mesure.error || mesure.status !== 0) return { etat: 'echouee', raison: 'PR INDISPONIBLE APRÈS TRAIN' }
  const vu = JSON.parse(mesure.stdout)
  if (vu.state !== 'MERGED' || !vu.mergeCommit?.oid || !mesurerHead()) return { etat: 'echouee', raison: `PR ${vu.state ?? 'inconnue'}` }
  return { etat: 'fusionnee', statut: vu.state, pr: vu.number, sha: vu.mergeCommit.oid }
}

export async function controleur({ dossier, id, hostPid = Number(process.env.WFRP_SESSION_JOBHOST) }) {
  const sessions = creerSessions({ dossier })
  sessions.revendiquer(id, undefined, { controleurPid: process.pid, jobHostPid: hostPid })
  delete process.env.WFRP_SESSION_REVENDICATION
  try {
  const carte = sessions.lire(id), dossierOps = fileURLToPath(new URL('.', import.meta.url))
  const politique = lireJSON(join(dossierOps, 'session-policy.json'))
  const texte = fs.readFileSync(carte.consigne, 'utf8')
  const rapport = join(dossier, `${id}.rapport`)
  const consigne = carte.agent === 'codex' ? `${texte}\nRapport final JSON : sessionId=${id}, ticket=${carte.ticket}, worktree=${carte.worktree}; head doit être le HEAD final mesuré, publier est ton intention de publication, resume décrit le résultat.` : texte
  const plan = planAgent(carte, { natif: carte.executable, consigne, gitCommun: join(carte.racine, '.git'), rapport, schema: join(dossierOps, 'session-report.schema.json'), profilExiste: carte.profilExiste, politique })
  return await sessions.superviser(id, {
    lancer: () => spawn(plan.executable, plan.args, { cwd: carte.worktree, shell: false, stdio: 'inherit', env: envAgent(process.env) }),
    lireRapport: () => lireJSON(rapport),
    mesurerGit: () => { const depot = depotDe(carte.worktree); return { branche: brancheDe(depot), head: shaDe(depot, 'HEAD'), propre: etatDeLArbre(depot).length === 0 } },
    publier: publierSession,
  })
  } catch (e) { return sessions.sortie(id, { codeAgent: null, raison: e.message }) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await controleur({ dossier: process.argv[2], id: process.argv[3] }) }
  catch (e) { process.stderr.write(`[session] ${e.message}\n`) }
  process.exitCode = 0
}

export const ligneControleur = ({ node = process.execPath, script, dossier, id }) => [node, script, dossier, id].map(citerArgv).join(' ')
