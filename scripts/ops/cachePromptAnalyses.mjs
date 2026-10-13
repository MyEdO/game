// ANALYSES du cache de prompt (#2596) : fonctions PURES sur les enregistrements normalisés de
// `cachePromptDonnee.mjs` (`{ requetes, evenements, fils }`, fenêtre et exclusions déjà appliquées).
// Chaque analyse rend des données ; le rendu Markdown vit dans `cachePromptRapport.mjs`.
import { tableTotale } from '../../src/lib/tableTotale.ts'

/** Requête « froide » : plus de `SEUIL_FROID` tokens écrits ET plus de la moitié du prompt écrit. */
export const SEUIL_FROID = 20000

/** TTL servi, en minutes : 1 h au fil principal, 5 min aux sous-agents (#2596) ; `ttlEmpirique` le re-mesure. */
export const TTL_MIN = { principal: 60, agent: 5 }

/** $ par million de tokens, par modèle : catalogue `pricing_tiers` + `models[].pricing` de claude.exe 2.1.296.
 *  Vérifié au cent contre les lignes `cost-state` d'un fil principal sans sous-agent (866ffc9c) ; transcripts de
 *  sous-agents sous-comptés : #2596, commentaire 6143427125. `long` : tarif au-delà de `above` tokens de prompt. */
export const PRIX = {
  'claude-opus-5-5': { in: 4, out: 20, w5: 5, w1: 8, rd: 0.2 },
  'claude-sonnet-5-5': { in: 2, out: 10, w5: 2.5, w1: 4, rd: 0.1 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, w5: 0.125, w1: 0.2, rd: 0.01, long: { above: 1e5, in: 0.5, out: 2.5, w5: 0.625, w1: 1, rd: 0.05 } },
  'claude-haiku-4-5-20251001': { in: 1, out: 5, w5: 1.25, w1: 2, rd: 0.1 },
}

/** Invocation de `npm run test:perimetre` (hors `-- --liste`). */
export const PERIM = /(^|[;&|({]\s*|&&\s*)(timeout \d+ )?([A-Z_]+= )?npm run (-s |--silent )?test:perimetre\b(?!\s*--\s*--liste)/

const SHELL = /^(Bash|PowerShell|bash)$|ctx_shell/

export const ecrit = (r) => r.e5 + r.e1 + r.ecritAutre
export const froide = (r) => ecrit(r) > SEUIL_FROID && ecrit(r) > r.ctx / 2

/** Tarif d'une requête : `PRIX` de son modèle (suffixe `[1m]` reconnu), palier `long` au-delà de son seuil ;
 *  `null` hors grille. */
export function prixDe(r) {
  let p = PRIX[String(r.model).replace(/\[1m\]$/, '')]
  if (!p) return null
  if (p.long && r.ctx > p.long.above) p = p.long
  return p
}

/** Coût en $ d'une requête par composante, `null` si le modèle est hors `PRIX`. */
export function coutDollars(r) {
  const p = prixDe(r)
  if (!p) return null
  const M = 1e6, pense = r.pense ?? 0
  return { lu: r.lu * p.rd / M, e5: (r.e5 + r.ecritAutre) * p.w5 / M, e1: r.e1 * p.w1 / M, nu: r.nu * p.in / M, sortie: (r.out - pense) * p.out / M, pense: pense * p.out / M }
}
const ZERO = { lu: 0, e5: 0, e1: 0, nu: 0, sortie: 0, pense: 0 }
/** $ des écritures en cache d'une requête (0 hors grille). */
export const coutEcriture = (r) => { const c = coutDollars(r) ?? ZERO; return c.e5 + c.e1 }
/** $ du prompt d'une requête : lu, écrit, input hors cache (0 hors grille). */
export const coutPrompt = (r) => { const c = coutDollars(r) ?? ZERO; return c.lu + c.e5 + c.e1 + c.nu }
/** Ce que l'écriture a coûté de plus, en $, qu'une lecture de `tokens` (défaut : les tokens écrits). */
export const surcout = (r, tokens = ecrit(r)) => { const p = prixDe(r); return p ? coutEcriture(r) - tokens * p.rd / 1e6 : 0 }
export const estPrincipal = (x) => x.fil === 'principal'
export const groupeDe = (x) => estPrincipal(x) ? 'principal' : 'sous-agents'
const cleFil = (x) => `${x.session}|${x.fil}`
const ttlDe = (x) => estPrincipal(x) ? TTL_MIN.principal : TTL_MIN.agent

export function par(xs, cle) {
  const g = new Map()
  for (const x of xs) { const k = cle(x); const l = g.get(k); if (l) l.push(x); else g.set(k, [x]) }
  return g
}
export function quantile(xs, p) {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null
}
const sommeDe = (xs, f) => xs.reduce((a, x) => a + f(x), 0)

/** Agrégat de tokens d'un lot de requêtes. */
export function somme(rs) {
  const a = { req: 0, lu: 0, ecrit: 0, e5: 0, e1: 0, nu: 0, out: 0, pense: 0, dollarsPrompt: 0, dollarsEcriture: 0, surcout: 0 }
  for (const r of rs) {
    a.req++; a.lu += r.lu; a.ecrit += ecrit(r); a.e5 += r.e5; a.e1 += r.e1; a.nu += r.nu; a.out += r.out; a.pense += r.pense ?? 0
    a.dollarsPrompt += coutPrompt(r); a.dollarsEcriture += coutEcriture(r); a.surcout += surcout(r)
  }
  return a
}
const tableau = (g, f = somme) => [...g].map(([cle, xs]) => ({ cle, ...f(xs) }))

/** Requêtes de chaque fil, par rang. */
export function requetesParFil(requetes) {
  const g = par(requetes, cleFil)
  for (const rs of g.values()) rs.sort((a, b) => a.rang - b.rang)
  return g
}

/** Cause d'une écriture : incrémental, ou la classe de la reprise froide. */
export function causeDEcriture(r) {
  if (!froide(r)) return 'incrémental'
  if (r.premiere) return estPrincipal(r) ? 'début ou reprise de session' : 'naissance d’agent'
  if (r.apresCompactage) return 'après compactage'
  if (r.ecartMin > 60) return 'inactivité > 1 h'
  if (r.ecartMin > 5) return 'inactivité 5 min – 1 h'
  return 'sans cause visible (< 5 min)'
}
const estReprise = (r) => /inactivité|sans cause/.test(causeDEcriture(r))

// ── 1-2. Volumes et écritures ─────────────────────────────────────────────────────────────────────

export function vueEnsemble({ requetes }) {
  return { total: somme(requetes), groupes: tableau(par(requetes, groupeDe)) }
}

export const TRANCHES_ECART = [[0, 5], [5, 15], [15, 30], [30, 60], [60, 120], [120, 240], [240, Infinity]]

export function ecrituresParCause({ requetes }) {
  const causes = tableau(par(requetes, causeDEcriture)).sort((a, b) => b.ecrit - a.ecrit)
  const parGroupe = [...par(requetes, groupeDe)].map(([g, rs]) => ({ groupe: g, causes: tableau(par(rs, causeDEcriture)) }))
  const reprises = requetes.filter(estReprise)
  const tranches = TRANCHES_ECART.map(([a, b]) => ({ a, b, ...somme(reprises.filter((r) => r.ecartMin >= a && r.ecartMin < b)) }))
  const lourdes = requetes.filter((r) => causeDEcriture(r) !== 'incrémental').sort((a, b) => ecrit(b) - ecrit(a)).slice(0, 20)
    .map((r) => ({ t: r.t, session: r.session, fil: r.agentType ?? 'principal', cause: causeDEcriture(r), ecartMin: r.ecartMin, ecrit: ecrit(r), ctx: r.ctx }))
  return { causes, parGroupe, tranches, lourdes }
}

// ── 3-4. Compactages et contexte ──────────────────────────────────────────────────────────────────

export function compactages({ evenements }) {
  const cs = evenements.filter((e) => e.type === 'system' && e.subtype === 'compact_boundary')
    .map((e) => ({ t: e.t, session: e.session, fil: e.agentType ?? 'principal', ...e.compactMetadata }))
    .sort((a, b) => a.t - b.t)
  const pre = cs.map((c) => c.preTokens ?? 0), post = cs.map((c) => c.postTokens ?? 0)
  return {
    liste: cs, n: cs.length, preMoyen: cs.length ? sommeDe(pre, (x) => x) / cs.length : 0, preMax: Math.max(0, ...pre),
    postMoyen: cs.length ? sommeDe(post, (x) => x) / cs.length : 0, ecartes: sommeDe(pre, (x) => x) - sommeDe(post, (x) => x),
    declencheurs: Object.fromEntries([...par(cs, (c) => c.trigger ?? '?')].map(([k, v]) => [k, v.length])),
    precalcules: cs.filter((c) => c.precomputed).length, dureeMediane: quantile(cs.map((c) => c.durationMs ?? 0), 0.5), dureeMax: Math.max(0, ...cs.map((c) => c.durationMs ?? 0)),
  }
}

export function contexte({ requetes }) {
  const resume = (rs) => { const x = rs.map((r) => r.ctx); return { n: rs.length, med: quantile(x, 0.5), p90: quantile(x, 0.9), p99: quantile(x, 0.99), max: Math.max(0, ...x) } }
  const fils = [...requetesParFil(requetes)].map(([cle, rs]) => {
    let croissance = 0, chutes = 0
    for (let i = 1; i < rs.length; i++) { const d = rs[i].ctx - rs[i - 1].ctx; if (d < -rs[i - 1].ctx / 2) chutes++; else croissance += d }
    return { cle, type: rs[0].agentType ?? 'principal', ...resume(rs), croissanceParRequete: rs.length > 1 ? croissance / (rs.length - 1) : 0, chutes }
  }).sort((a, b) => b.max - a.max)
  return { global: { ...resume(requetes), au150k: requetes.filter((r) => r.ctx > 150e3).length, au200k: requetes.filter((r) => r.ctx > 200e3).length },
    parGroupe: [...par(requetes, groupeDe)].map(([g, rs]) => ({ groupe: g, ...resume(rs) })), fils }
}

// ── 5-8. Sessions, types d'agents, coût par modèle, chronologie ───────────────────────────────────

export function sessions({ requetes, fils, evenements }) {
  const infos = new Map(fils.filter(estPrincipal).map((f) => [f.session, f]))
  const nCompact = par(evenements.filter((e) => e.subtype === 'compact_boundary'), (e) => e.session)
  return [...par(requetes, (r) => r.session)].map(([s, rs]) => ({
    session: s, cwd: infos.get(s)?.cwd ?? null, premierPrompt: infos.get(s)?.premierPrompt ?? null, ...somme(rs),
    sousAgents: new Set(rs.filter((r) => !estPrincipal(r)).map((r) => r.fil)).size, compactages: nCompact.get(s)?.length ?? 0,
    ecritFroid: somme(rs.filter((r) => causeDEcriture(r) !== 'incrémental')).ecrit, dollars: dollars(rs).total,
  })).sort((a, b) => b.dollars - a.dollars)
}

export function typesAgents({ requetes }) {
  return [...par(requetes.filter((r) => !estPrincipal(r)), (r) => r.agentType ?? 'inconnu')].map(([type, rs]) => {
    const fs_ = [...requetesParFil(rs).values()]
    const nais = rs.filter((r) => causeDEcriture(r) === 'naissance d’agent'), rep = rs.filter(estReprise)
    return { type, agents: fs_.length, ...somme(rs), modeles: [...new Set(rs.map((r) => r.model))], naissanceMoyenne: nais.length ? somme(nais).ecrit / nais.length : null,
      reprises: rep.length, reecrit: somme(rep).ecrit, ctxMaxMoyen: sommeDe(fs_, (f) => Math.max(...f.map((r) => r.ctx))) / fs_.length,
      dureeMediane: quantile(fs_.map((f) => (f.at(-1).t - f[0].t) / 60000), 0.5), dollars: dollars(rs).total }
  }).sort((a, b) => b.dollars - a.dollars)
}

export function dollars(rs) {
  const a = { lu: 0, e5: 0, e1: 0, nu: 0, sortie: 0, pense: 0, total: 0, horsGrille: 0 }
  for (const r of rs) {
    const c = coutDollars(r)
    if (!c) { a.horsGrille++; continue }
    for (const k of Object.keys(c)) { a[k] += c[k]; a.total += c[k] }
  }
  return a
}
export function coutParModele({ requetes }) {
  return {
    modeles: [...par(requetes, (r) => r.model)].map(([m, rs]) => ({ modele: m, ...somme(rs), dollars: dollars(rs) })).sort((a, b) => b.dollars.total - a.dollars.total),
    groupes: [...par(requetes, (r) => estPrincipal(r) ? 'principal' : `agent:${r.agentType}`)].map(([g, rs]) => ({ groupe: g, dollars: dollars(rs) })).sort((a, b) => b.dollars.total - a.dollars.total),
    jours: [...par(requetes, (r) => new Date(r.t).toISOString().slice(0, 10))].map(([j, rs]) => ({ jour: j, dollars: dollars(rs) })).sort((a, b) => a.jour.localeCompare(b.jour)),
    total: dollars(requetes),
    modelesHorsGrille: [...new Set(requetes.filter((r) => !prixDe(r)).map((r) => r.model))].sort(),
  }
}

/** Rapprochement de chaque ligne `cost-state` (cumul de session) avec le coût recalculé jusqu'à sa POSITION : fil
 *  principal jusqu'à son rang, sous-agents jusqu'à son instant, cumuls d'avant la fenêtre (`dollarsAvantFenetre`)
 *  compris. `ecart` = (calculé − totalCostUSD) / totalCostUSD. */
export function rapprochementCoutEtat({ requetes, evenements, fils }) {
  const filsDe = par(fils, (f) => f.session), rqs = par(requetes, (r) => r.session)
  return evenements.filter((e) => e.type === 'etat_cout' && estPrincipal(e)).sort((a, b) => a.t - b.t).map((e) => {
    const fs_ = filsDe.get(e.session) ?? [], rs = rqs.get(e.session) ?? []
    const avant = (xs) => sommeDe(xs, (f) => f.dollarsAvantFenetre ?? 0)
    const dp = dollars(rs.filter((r) => estPrincipal(r) && r.rang <= e.rang)), ds = dollars(rs.filter((r) => !estPrincipal(r) && r.t <= e.t))
    const principal = avant(fs_.filter(estPrincipal)) + dp.total, sousAgents = avant(fs_.filter((f) => !estPrincipal(f))) + ds.total
    const calcule = principal + sousAgents
    return { session: e.session, t: e.t, rang: e.rang, totalCostUSD: e.totalCostUSD, principal, sousAgents, calcule,
      ecart: e.totalCostUSD ? (calcule - e.totalCostUSD) / e.totalCostUSD : null,
      horsGrille: dp.horsGrille + ds.horsGrille + sommeDe(fs_, (f) => f.horsGrilleAvantFenetre ?? 0), modeles: e.modeles }
  })
}

export function chronologie({ requetes, evenements }) {
  const compact = par(evenements.filter((e) => e.subtype === 'compact_boundary'), (e) => Math.floor(e.t / 3600e3))
  return [...par(requetes, (r) => Math.floor(r.t / 3600e3))].sort((a, b) => a[0] - b[0])
    .map(([h, rs]) => ({ heure: h * 3600e3, ...somme(rs), ecritFroid: somme(rs.filter((r) => causeDEcriture(r) !== 'incrémental')).ecrit, compactages: compact.get(h)?.length ?? 0 }))
}

// ── 9-10. Nourriture du contexte, erreurs ─────────────────────────────────────────────────────────

export function nourriture({ evenements }) {
  const usages = new Map(evenements.filter((e) => e.type === 'tool_use').map((e) => [`${e.session}|${e.id}`, e]))
  const res = evenements.filter((e) => e.type === 'tool_result')
  const agreg = (xs, cle, taille) => [...par(xs, cle)].map(([k, v]) => ({ cle: k, n: v.length, car: sommeDe(v, taille), max: Math.max(...v.map(taille)) })).sort((a, b) => b.car - a.car)
  return {
    outils: [...par(res, groupeDe)].map(([g, v]) => ({ groupe: g, lignes: agreg(v, (e) => e.outil, (e) => e.taille) })),
    attachments: agreg(evenements.filter((e) => e.type === 'attachment'), (e) => e.sorte, (e) => e.tailleRendue || e.taille),
    prompts: agreg(evenements.filter((e) => e.type === 'prompt'), (e) => e.nature, (e) => e.longueur),
    gros: res.filter((e) => e.taille > 40000).map((e) => { const u = usages.get(`${e.session}|${e.id}`); return { t: e.t, session: e.session, fil: e.agentType ?? 'principal', outil: e.outil, car: e.taille, commande: u?.resume?.command ?? u?.resume?.file_path ?? u?.resume?.pattern ?? null } }).sort((a, b) => b.car - a.car),
  }
}

export function erreursApi({ evenements }) {
  const es = evenements.filter((e) => e.type === 'erreur_api')
  return { n: es.length, motifs: [...par(es, (e) => e.texte.replace(/\d+/g, 'N').slice(0, 80))].map(([k, v]) => ({ motif: k, n: v.length })).sort((a, b) => b.n - a.n) }
}

// ── TTL ───────────────────────────────────────────────────────────────────────────────────────────

export const TRANCHES_TTL = [[3, 4], [4, 4.5], [4.5, 5], [5, 5.5], [5.5, 7], [50, 58], [58, 60], [60, 62], [62, 75]]

/** TTL SERVI (tokens écrits 5 min / 1 h, fils mixtes) et TTL EMPIRIQUE (part froide par tranche d'écart). */
export function ttl({ requetes }) {
  const servi = [...par(requetes, (r) => r.agentType ?? 'principal')].map(([type, rs]) => {
    const fils = [...requetesParFil(rs).values()]
    return { type, e5: sommeDe(rs, (r) => r.e5), e1: sommeDe(rs, (r) => r.e1), fils: fils.length, mixtes: fils.filter((f) => f.some((r) => r.e5 > 0) && f.some((r) => r.e1 > 0)).length }
  })
  const suivies = requetes.filter((r) => !r.premiere && !r.apresCompactage && r.ecartMin != null)
  const empirique = [...par(suivies, groupeDe)].map(([g, rs]) => ({ groupe: g, tranches: TRANCHES_TTL.map(([a, b]) => { const y = rs.filter((r) => r.ecartMin >= a && r.ecartMin < b); return { a, b, n: y.length, froides: y.filter(froide).length } }) }))
  return { servi, empirique }
}

// ── Commandes, test:perimetre ─────────────────────────────────────────────────────────────────────

export function classerCommande(c = '') {
  if (/perimetre/i.test(c)) return 'test:perimetre'
  if (/typecheck|tsc\b/.test(c)) return 'typecheck'
  if (/mutation/i.test(c)) return 'mutations'
  if (/\bnpm ci\b|npm install/.test(c)) return 'npm ci/install'
  if (/ops:ci|gh run (watch|view)/.test(c)) return 'ops:ci / gh run'
  if (/\bgh\b/.test(c)) return 'gh'
  if (/gates/.test(c)) return 'gates'
  if (/vitest|npm (run )?test|node --test/.test(c)) return 'vitest/npm test'
  if (/playwright|recette|chrome/i.test(c)) return 'recette'
  if (/rejeu|rejuger/.test(c)) return 'rejeu'
  if (/\bsleep\b/.test(c)) return 'sleep'
  if (/\bgit\b/.test(c)) return 'git'
  if (/\bbuild\b|vite/.test(c)) return 'build'
  if (/docs:/.test(c)) return 'docs:*'
  return 'autre'
}

/** Durée de chaque commande shell : premier plan tool_use → tool_result ; fond tool_use → notification qui porte
 *  son `<tool-use-id>` (préfixe de 17 caractères : la notification est tronquée à l'extraction). */
function finsDesOutils(evenements) {
  const res = new Map(evenements.filter((e) => e.type === 'tool_result').map((e) => [`${e.session}|${e.id}`, e]))
  const notifs = new Map()
  for (const e of evenements) {
    if (e.type === 'tool_use' || e.type === 'tool_result') continue
    const m = /<tool-use-id>(toolu_[A-Za-z0-9]{6,})/.exec(e.debut ?? '')
    if (m) { const k = `${e.session}|${m[1].slice(0, 17)}`; if (!notifs.has(k)) notifs.set(k, e) }
  }
  /** L'événement qui clôt l'appel `u` : son résultat au premier plan, sa notification en fond. */
  return (u) => u.resume?.run_in_background ? notifs.get(`${u.session}|${u.id.slice(0, 17)}`) : res.get(`${u.session}|${u.id}`)
}

export function commandes({ evenements }) {
  const finDe = finsDesOutils(evenements)
  return evenements.filter((e) => e.type === 'tool_use' && SHELL.test(e.nom)).map((u) => {
    const c = u.resume?.command ?? '', fond = !!u.resume?.run_in_background
    const fin = finDe(u)?.t
    return { session: u.session, fil: u.fil, type: u.agentType ?? 'principal', t: u.t, min: fin == null ? null : (fin - u.t) / 60000, fond, perim: PERIM.test(c), classe: classerCommande(c), commande: c.slice(0, 200) }
  }).sort((a, b) => a.t - b.t)
}

export function synthesesCommandes(cmds) {
  const sa = cmds.filter((c) => c.type !== 'principal' && c.min != null)
  const classes = [...par(sa, (c) => c.perim ? 'test:perimetre (invocation)' : c.classe)].map(([k, a]) => ({
    classe: k, n: a.length, plus4: a.filter((c) => c.min > 4).length, plus5: a.filter((c) => c.min > 5).length,
    minPlus4: sommeDe(a.filter((c) => c.min > 4), (c) => c.min), med: quantile(a.map((c) => c.min), 0.5), p90: quantile(a.map((c) => c.min), 0.9),
  })).sort((a, b) => b.minPlus4 - a.minPlus4)
  const tp = cmds.filter((c) => c.perim)
  const perim = [...par(tp, (c) => c.type === 'principal' ? 'principal' : 'sous-agents')].map(([g, a]) => ({ groupe: g, n: a.length, fond: a.filter((c) => c.fond).length, med: quantile(a.map((c) => c.min), 0.5), plus5: a.filter((c) => c.min > 5).length }))
  const P = tp.filter((c) => c.type === 'principal'), S = tp.filter((c) => c.type !== 'principal')
  const doublons = P.filter((p) => S.some((s) => s.session === p.session && s.t < p.t && p.t - s.t < 3 * 3600e3)).length
  const runsParFil = [...par(S, cleFil).values()].map((v) => v.length)
  return { classes, perim, doublonsOrchestrateur: doublons, runsOrchestrateur: P.length, runsParFil: Object.fromEntries([...par(runsParFil, (n) => n)].map(([n, v]) => [n, v.length])) }
}

// ── A. Reprises froides des sous-agents ───────────────────────────────────────────────────────────

const estMessage = (e) => (e.type === 'prompt' && (/^The coordinator sent a message/.test(e.debut ?? '') || (!e.isMeta && !/^This session is being continued|^\[Request interrupted/.test(e.debut ?? ''))))
  || (e.type === 'attachment' && e.sorte === 'queued_command')

/** Cause de chaque reprise froide de sous-agent (hors naissance et compactage) : l'outil dont la durée couvre
 *  ≥ 70 % de l'attente, un SendMessage sur agent rendu, un message attendu, sinon la latence du modèle. */
export function reprisesSousAgents({ requetes, evenements }) {
  const evs = par(evenements.filter((e) => !estPrincipal(e)), cleFil)
  const usages = new Map(evenements.filter((e) => e.type === 'tool_use').map((e) => [`${e.session}|${e.id}`, e]))
  const lignes = []
  for (const [k, rs] of requetesParFil(requetes.filter((r) => !estPrincipal(r)))) {
    const es = evs.get(k) ?? []
    for (let i = 1; i < rs.length; i++) {
      const r = rs[i], p = rs[i - 1]
      if (r.premiere || r.apresCompactage || !froide(r) || p.rang !== r.rang - 1) continue
      const attente = r.t - p.t
      const entre = es.filter((e) => e.t > p.t && e.t <= r.t)
      const msgs = entre.filter(estMessage), rendu = entre.some((e) => e.type === 'tool_use' && e.nom === 'SubagentHandback')
      let long = null
      for (const x of entre.filter((e) => e.type === 'tool_result')) {
        const u = usages.get(`${x.session}|${x.id}`); if (!u) continue
        const d = x.t - Math.max(u.t, p.t); if (!long || d > long.d) long = { d, u }
      }
      let cause
      if (rendu && msgs.length) cause = 'SendMessage sur agent rendu'
      else if (long && long.d >= 0.7 * attente) cause = SHELL.test(long.u.nom) ? `outil ${PERIM.test(long.u.resume?.command ?? '') ? 'test:perimetre' : classerCommande(long.u.resume?.command)}${long.u.resume?.run_in_background ? ' (fond)' : ''}` : `outil ${long.u.nom}`
      else if (msgs.length) cause = 'message attendu'
      else if (rendu) cause = 'rendu puis reprise sans message'
      else cause = 'latence du modèle'
      lignes.push({ session: r.session, fil: r.fil, type: r.agentType, t: r.t, attenteMin: attente / 60000, outilMin: long ? long.d / 60000 : null, ecrit: ecrit(r), surcout: surcout(r), cause })
    }
  }
  const agreg = (cle) => [...par(lignes, cle)].map(([k, v]) => ({ cle: k, n: v.length, ecrit: sommeDe(v, (x) => x.ecrit), surcout: sommeDe(v, (x) => x.surcout), attenteMed: quantile(v.map((x) => x.attenteMin), 0.5) })).sort((a, b) => b.surcout - a.surcout)
  return { lignes, parCause: agreg((x) => x.cause), parType: agreg((x) => x.type), typeCause: agreg((x) => `${x.type} | ${x.cause}`), parJour: agreg((x) => new Date(x.t).toISOString().slice(0, 10)) }
}

/** Coût d'une naissance par type d'agent : 1re requête du fil. */
export function naissances({ requetes }) {
  return [...par(requetes.filter((r) => r.premiere && !estPrincipal(r)), (r) => r.agentType)].map(([type, rs]) => ({ type, n: rs.length, ecritMoyen: somme(rs).ecrit / rs.length, ecritMedian: quantile(rs.map(ecrit), 0.5), dollars: dollars(rs).total })).sort((a, b) => b.n - a.n)
}

// ── B. Réveils de l'orchestrateur ─────────────────────────────────────────────────────────────────

export const AGENT_MORT = 'agent mort (watchdog / failed / stalled)'
export const PRIORITE_REVEIL = ['utilisateur', 'message inter-session', 'agent rendu', AGENT_MORT, 'commande de fond', 'monitor', 'réveil programmé', 'limite d’usage réinitialisée', 'reprise après compactage']

/** Notification d'agent : `<summary>` « Agent "…" … », « Background agent "… » ou « … background agent "… ». */
const NOTIF_AGENT = /^(Background )?[Aa]gent "|background agent "|agent-message/
/** Agent mort : `<status>` failed, killed ou stopped de sa notification. */
const STATUT_MORT = /^(failed|killed|stopped)$/

/** Causes de réveil lues dans les événements d'un écart. */
export function causesDeReveil(es) {
  const c = []
  for (const e of es) {
    const s = e.sommaire ?? e.debut ?? ''
    if (e.type === 'prompt' && (e.origin === 'human' || /^balise:(bash-input|command-name|pasted)/.test(e.nature))) c.push('utilisateur')
    else if (e.type === 'prompt' && e.origin === 'peer') c.push(/agent-message/.test(s) ? 'agent rendu' : 'message inter-session')
    else if (e.type === 'prompt' && e.origin === 'auto-continuation') c.push('limite d’usage réinitialisée')
    else if ((e.type === 'prompt' && e.origin === 'task-notification') || (e.type === 'attachment' && e.sorte === 'queued_command'))
      c.push(NOTIF_AGENT.test(s) ? (STATUT_MORT.test(e.statut ?? '') ? AGENT_MORT : 'agent rendu') : /^Background command/i.test(s) ? 'commande de fond' : /^Monitor/.test(s) ? 'monitor' : /wakeup|scheduled/i.test(s) ? 'réveil programmé' : /cross-session-message/.test(s) ? 'message inter-session' : 'notification autre')
    else if (e.type === 'system' && e.subtype === 'scheduled_task_fire') c.push('réveil programmé')
    else if (e.type === 'prompt' && /continued from a previous/.test(s)) c.push('reprise après compactage')
  }
  return c
}

export const TRANCHES_REVEIL = [[0, 5], [5, 15], [15, 30], [30, 55], [55, 60], [60, 120], [120, 240], [240, 480], [480, Infinity]]

export function reveilsOrchestrateur({ requetes, evenements }) {
  const evs = par(evenements.filter(estPrincipal), (e) => e.session)
  const dist = TRANCHES_REVEIL.map(([a, b]) => ({ a, b, n: 0, froides: 0, ecrit: 0, dollarsEcriture: 0 }))
  const longues = []
  for (const [k, rs] of requetesParFil(requetes.filter(estPrincipal))) {
    const es = evs.get(k.split('|')[0]) ?? []
    for (let i = 1; i < rs.length; i++) {
      const r = rs[i], p = rs[i - 1]
      if (r.premiere || p.rang !== r.rang - 1) continue
      const d = dist.find((x) => r.ecartMin >= x.a && r.ecartMin < x.b); d.n++
      if (!froide(r) || r.apresCompactage) continue
      d.froides++; d.ecrit += ecrit(r); d.dollarsEcriture += coutEcriture(r)
      if (r.ecartMin < TTL_MIN.principal) continue
      const cs = causesDeReveil(es.filter((e) => e.t > p.t && e.t <= r.t))
      longues.push({ session: r.session, t: r.t, ecartMin: r.ecartMin, ecrit: ecrit(r), dollarsEcriture: coutEcriture(r), ctx: r.ctx, cause: PRIORITE_REVEIL.find((x) => cs.includes(x)) ?? cs[0] ?? 'aucun événement' })
    }
  }
  const parCause = [...par(longues, (x) => x.cause)].map(([c, v]) => ({ cause: c, n: v.length, ecrit: sommeDe(v, (x) => x.ecrit), dollarsEcriture: sommeDe(v, (x) => x.dollarsEcriture) })).sort((a, b) => b.dollarsEcriture - a.dollarsEcriture)
  return { distribution: dist, longues, parCause }
}

export function outilsAttente({ evenements }) {
  const NOMS = /^(ScheduleWakeup|Monitor|TaskStop|ListAgents|CronCreate|SendMessage)$/
  const usages = evenements.filter((e) => e.type === 'tool_use')
  const erreurs = new Set(evenements.filter((e) => e.type === 'tool_result' && e.erreur).map((e) => `${e.session}|${e.id}`))
  const lignes = [...par(usages.filter((u) => NOMS.test(u.nom) || u.resume?.run_in_background), (u) => `${groupeDe(u)} | ${u.resume?.run_in_background && !NOMS.test(u.nom) ? `${u.nom} (fond)` : u.nom}`)]
    .map(([k, v]) => ({ cle: k, n: v.length, erreurs: v.filter((u) => erreurs.has(`${u.session}|${u.id}`)).length })).sort((a, b) => b.n - a.n)
  return { lignes, reveilsProgrammes: evenements.filter((e) => e.type === 'system' && e.subtype === 'scheduled_task_fire').length }
}

// ── C. Préfixe cassé ──────────────────────────────────────────────────────────────────────────────

const couvert = (r) => r.lu + ecrit(r)

/** Où la requête lit-elle son préfixe : c(n-1), c(n-k), 0, un préfixe court (système), autre. */
export function pointsDeCache({ requetes }) {
  const cl = {}
  const add = (r, k) => { const g = `${groupeDe(r)} | ${k}`; cl[g] = (cl[g] ?? 0) + 1 }
  for (const rs of requetesParFil(requetes).values()) for (let i = 0; i < rs.length; i++) {
    const r = rs[i], p = rs[i - 1]
    if (r.premiere) { add(r, 'première'); continue }
    if (!p || p.rang !== r.rang - 1) { add(r, 'sans précédente en fenêtre'); continue }
    if (r.lu === couvert(p)) { add(r, 'lu = c(n-1)'); continue }
    let k = 0
    for (let j = i - 2; j >= Math.max(0, i - 40); j--) if (couvert(rs[j]) === r.lu) { k = i - j; break }
    if (k) add(r, k > 3 ? 'lu = c(n-4..40)' : `lu = c(n-${k})`)
    else if (r.lu === 0) add(r, 'lu = 0')
    else if (r.lu < 40000 && ecrit(r) > r.lu) add(r, 'lu = préfixe court, écrit > lu')
    else add(r, r.lu > couvert(p) ? 'autre, lu > c(n-1)' : 'autre, lu < c(n-1)')
  }
  return Object.entries(cl).map(([cle, n]) => ({ cle, n })).sort((a, b) => a.cle.localeCompare(b.cle))
}

/** Frontières de tour du fil principal : 1re requête après une fin de tour (`finDeTour`, segmentation par
 *  `turn_duration` à l'extraction), avec l'ajout de harnais au tour précédent et la perte de préfixe contre la
 *  requête précédente du fichier (`couvertPrec`, fenêtre ignorée). Écart < TTL et hors compactage. */
export function frontieresDeTour({ requetes }) {
  return requetes.filter((r) => estPrincipal(r) && r.finDeTour && r.couvertPrec != null && !r.apresCompactage && r.ecartMin < TTL_MIN.principal)
    .map((r) => ({ session: r.session, t: r.t, ajout: r.ajoutTourPrecedent, perte: r.couvertPrec - r.lu, lu: r.lu, casse: r.couvertPrec - r.lu > SEUIL_FROID }))
}

/** Réécritures complètes (lu ≤ 40k, perte > 20k) hors naissance et compactage, sous et au-delà du TTL du fil,
 *  attribuées : sous-agent / frontière avec ajout harnais / frontière sans ajout / milieu de tour. */
export function reecritures({ requetes }) {
  const fr = new Map(frontieresDeTour({ requetes }).map((b) => [`${b.session}|${b.t}`, b]))
  const toutes = []
  for (const rs of requetesParFil(requetes).values()) for (let i = 1; i < rs.length; i++) {
    const r = rs[i], p = rs[i - 1]
    if (r.premiere || r.apresCompactage || p.rang !== r.rang - 1) continue
    const perdu = couvert(p) - r.lu
    if (!(r.lu <= 40000 && perdu > SEUIL_FROID && ecrit(r) > SEUIL_FROID)) continue
    const b = fr.get(`${r.session}|${r.t}`)
    toutes.push({ ...r, perdu, sousTtl: r.ecartMin < ttlDe(r), modeleChange: r.model !== p.model, attribution: !estPrincipal(r) ? 'sous-agent' : !b ? 'milieu de tour' : b.ajout ? 'frontière, ajout harnais au tour précédent' : 'frontière, sans ajout' })
  }
  const sous = toutes.filter((x) => x.sousTtl)
  const agreg = (xs, cle) => [...par(xs, cle)].map(([k, v]) => ({ cle: k, n: v.length, ecrit: somme(v).ecrit, surcout: sommeDe(v, (x) => surcout(x, x.perdu)) })).sort((a, b) => b.n - a.n)
  const tranche = (m) => m < 1 ? '<1' : m < 5 ? '1-5' : m < 15 ? '5-15' : m < 30 ? '15-30' : '30-60'
  return { toutes: toutes.length, sousTtl: sous, parAttribution: agreg(sous, (x) => x.attribution), parTranche: agreg(sous, (x) => `${groupeDe(x)} ${tranche(x.ecartMin)}`), parSession: agreg(sous, (x) => x.session), valeursLu: agreg(sous, (x) => String(x.lu)).slice(0, 10) }
}

/** Fréquence de chaque sorte de ligne `avant` (type + premier mot) dans les réécritures sous TTL et dans un témoin
 *  (lu = c(n-1), même groupe, écart sous TTL). */
export function signatureAvant({ requetes }, sousTtl) {
  const sorte = (a) => `${a.type}:${a.r.split(' ')[0]}`
  const freq = (rs) => { const f = {}; for (const r of rs) for (const s of new Set(r.avant.map(sorte))) f[s] = (f[s] ?? 0) + 1; return f }
  const temoin = []
  for (const rs of requetesParFil(requetes).values()) for (let i = 1; i < rs.length; i++) if (rs[i].lu === couvert(rs[i - 1]) && rs[i].ecartMin < ttlDe(rs[i])) temoin.push(rs[i])
  const fr = freq(sousTtl), ft = freq(temoin)
  return { n: sousTtl.length, nTemoin: temoin.length, sortes: [...new Set([...Object.keys(fr), ...Object.keys(ft)])].map((s) => ({ sorte: s, reecritures: (fr[s] ?? 0) / (sousTtl.length || 1), temoin: (ft[s] ?? 0) / (temoin.length || 1) })).sort((a, b) => (b.reecritures - b.temoin) - (a.reecritures - a.temoin)).slice(0, 15) }
}

/** Les `thinking_drop` et la requête qui suit dans le même fil. */
export function thinkingDrops({ requetes, evenements }) {
  const rq = requetesParFil(requetes)
  const lignes = evenements.filter((e) => e.type === 'attachment' && e.sorte === 'thinking_drop').map((e) => {
    const m = e.meta ?? {}
    const suivante = (rq.get(cleFil(e)) ?? []).find((r) => r.t >= e.t)
    return { session: e.session, groupe: groupeDe(e), t: e.t, raison: m['newlyDropped.reason'] ?? null, kinds: m['clientChange.kinds'] ?? null, fci: m['clientChange.firstChangedMessageIndex'] ?? null, baseline: m['clientChange.baseline'] ?? null, blocs: m['newlyDropped.blockCount'] ?? null, lu: suivante?.lu ?? null, ecrit: suivante ? ecrit(suivante) : null, complete: suivante ? suivante.lu < 40000 : null }
  })
  const compte = (cle) => Object.fromEntries([...par(lignes, cle)].map(([k, v]) => [k, v.length]))
  return { n: lignes.length, parGroupe: compte((x) => x.groupe), parRaison: compte((x) => String(x.raison)), parKinds: compte((x) => String(x.kinds)), parBaseline: compte((x) => String(x.baseline)), suivante: compte((x) => x.complete === null ? 'aucune' : x.complete ? 'réécriture complète' : 'partielle'), ecritApres: sommeDe(lignes, (x) => x.ecrit ?? 0) }
}

/** Transitions de `credential_org.organizationUuid` par session (fil principal). */
export function basculesOrganisation({ evenements }) {
  const out = []
  for (const [s, es] of par(evenements.filter((e) => e.type === 'attachment' && e.sorte === 'credential_org' && estPrincipal(e)), (e) => e.session)) {
    let prec = null
    for (const e of es.sort((a, b) => a.t - b.t)) { const o = e.meta?.organizationUuid ?? null; if (prec !== null && o !== prec) out.push({ session: s, t: e.t, de: prec, vers: o }); prec = o }
  }
  return out
}

// ── D/E. Plafond de contexte simulé ───────────────────────────────────────────────────────────────

/** Plafonds de contexte simulés, en tokens. */
export const PLAFONDS = [150e3, 200e3, 250e3, 300e3]

/** Coût de chaque groupe (principal, sous-agents) si son contexte était plafonné à `C` : au-delà, `compactage`
 *  (lecture du contexte, résumé de P tokens en sortie, réécriture de P) ou `redemarrage` (réécriture de B, sans
 *  résumé). B = médiane des contextes de naissance, P = médiane des contextes après une chute réelle (< 70 %).
 *  `reel` = la même formule sans plafond, égale au coût de `dollars` ; modèle hors grille ignoré. */
export function simuPlafond({ requetes }) {
  return ['principal', 'sous-agents'].map((groupe) => {
    const fils = [...requetesParFil(requetes.filter((r) => groupeDe(r) === groupe)).values()]
    const B = quantile(fils.map((a) => a[0].ctx), 0.5) ?? 0
    const chutes = fils.flatMap((a) => a.filter((r, i) => i > 0 && r.ctx < 0.7 * a[i - 1].ctx).map((r) => r.ctx))
    const P = quantile(chutes, 0.5) ?? B
    const ecrit1h = (r) => r.e1 > 0 || groupe === 'principal'
    const jouer = (C, mode) => {
      let dollars_ = 0, coupures = 0
      for (const a of fils) {
        let O = 0
        for (let i = 0; i < a.length; i++) {
          const r = a[i], p = prixDe(r)
          if (!p) continue
          if (i > 0 && r.ctx < 0.7 * a[i - 1].ctx) O = 0
          let ctx = r.ctx - O
          if (C && ctx > C) {
            const base = mode === 'redemarrage' ? B : P, resume = mode === 'redemarrage' ? 0 : P
            dollars_ += (ctx * p.rd + resume * p.out + base * (ecrit1h(r) ? p.w1 : p.w5)) / 1e6
            coupures++; O = r.ctx - base; ctx = base
          }
          const w = ecrit(r), ws = Math.min(w, ctx), f5 = w ? (r.e5 + r.ecritAutre) / w : ecrit1h(r) ? 0 : 1
          dollars_ += (Math.max(0, ctx - ws - r.nu) * p.rd + ws * f5 * p.w5 + ws * (1 - f5) * p.w1 + r.nu * p.in + r.out * p.out) / 1e6
        }
      }
      return { dollars: dollars_, coupures }
    }
    const reel = jouer(0).dollars
    return { groupe, fils: fils.length, B, P, reel, plafonds: PLAFONDS.map((C) => ({ C, compactage: jouer(C, 'compactage'), redemarrage: jouer(C, 'redemarrage') })) }
  })
}

// ── Verdict de test:perimetre, conformité SendMessage ─────────────────────────────────────────────

/** La base `<base>.code` qu'écrit une commande de fond sous la forme de `scripts/hooks/appel-borne-guard.mjs`,
 *  `null` hors de cette forme. PUR. */
const baseDeFond = (commande) => /["']([^"']+)\.code["']/.exec(commande)?.[1] ?? null

/** Le résultat de sonde (`scripts/ops/sonde.mjs`) TERMINÉ de `base` dans le fil de `u`, après `u` : `{ code, fin }`,
 *  `null` sans sonde terminée. */
function sondeTerminee(evenements, finDe, u, base) {
  for (const e of evenements.filter((x) => x.type === 'tool_use' && cleFil(x) === cleFil(u) && x.t > u.t && SHELL.test(x.nom)).sort((a, b) => a.t - b.t)) {
    const c = e.resume?.command ?? ''
    if (!c.includes('sonde.mjs') || !c.includes(`${base}.code`)) continue
    const fin = finDe(e)?.fin ?? ''
    const code = /\[sonde\] TERMINÉE — code (-?\d+)/.exec(fin)?.[1]
    if (code !== undefined) return { code: Number(code), fin }
  }
  return null
}

/** Chaque run de `test:perimetre` d'un sous-agent codeur, son code et son verdict : vert (0), rouge (≠ 0), inconnu ;
 *  par fil, le verdict de son DERNIER run. Le code : au premier plan, le résultat ; en fond sous la forme à `.code`
 *  de `appel-borne-guard.mjs`, la SONDE terminée (la notification n'y porte que le code de l'enveloppe) ; en fond
 *  hors de cette forme, la notification. */
export function verdictPerimetre({ evenements }) {
  const finDe = finsDesOutils(evenements)
  const runs = evenements.filter((e) => e.type === 'tool_use' && e.agentType === 'codeur' && SHELL.test(e.nom) && PERIM.test(e.resume?.command ?? ''))
    .sort((a, b) => a.t - b.t).map((u) => {
      const fond = !!u.resume?.run_in_background, f = finDe(u)
      const base = fond ? baseDeFond(u.resume?.command ?? '') : null
      const sonde = base ? sondeTerminee(evenements, finDe, u, base) : null
      const code = base ? sonde?.code ?? null : f?.code ?? null
      const fin = base ? sonde?.fin ?? null : fond ? f?.sommaire ?? null : f?.fin ?? null
      return { session: u.session, fil: u.fil, t: u.t, fond, code, verdict: code === 0 ? 'vert' : code == null ? 'inconnu' : 'rouge', fin }
    })
  const parFil = [...par(runs, cleFil)].map(([, v]) => ({ session: v[0].session, fil: v[0].fil, runs: v.length, rouges: v.filter((x) => x.verdict === 'rouge').length, verdict: v.at(-1).verdict, fin: v.at(-1).fin }))
  return { runs, parFil }
}

/** Livraisons de SendMessage à un sous-agent (« The coordinator sent a message ») et l'écart à son dernier
 *  `SubagentHandback` : une reprise d'agent rendu depuis plus de 5 min recharge son contexte à froid. */
export function conformiteSendMessage({ evenements }) {
  const es = evenements.filter((e) => !estPrincipal(e) && ((e.type === 'prompt' && /^The coordinator sent a message/.test(e.debut ?? '')) || (e.type === 'tool_use' && e.nom === 'SubagentHandback')))
    .sort((a, b) => a.t - b.t)
  const rendu = new Map(), livraisons = []
  for (const e of es) {
    const k = cleFil(e)
    if (e.type === 'tool_use') { rendu.set(k, e.t); continue }
    const h = rendu.get(k)
    livraisons.push({ session: e.session, fil: e.fil, type: e.agentType, t: e.t, apresRendu: h != null, ecartMin: h != null ? (e.t - h) / 60000 : null })
    rendu.delete(k)
  }
  return { livraisons, surAgentRendu: livraisons.filter((x) => x.apresRendu).length, renduPlus5: livraisons.filter((x) => x.ecartMin > 5) }
}

/** Transcripts lus : les fichiers qui portent au moins une requête de la fenêtre (stable d'un run à l'autre). */
export const transcriptsLus = (requetes) => new Set(requetes.map((r) => r.fichier)).size

// ── Comptes clés (DoD #2596) et delta ─────────────────────────────────────────────────────────────

export function analyser(d) {
  const cmds = commandes(d)
  const ree = reecritures(d)
  return {
    vue: vueEnsemble(d), causes: ecrituresParCause(d), compactages: compactages(d), contexte: contexte(d), sessions: sessions(d), types: typesAgents(d),
    cout: coutParModele(d), coutEtat: rapprochementCoutEtat(d), chronologie: chronologie(d), nourriture: nourriture(d), erreurs: erreursApi(d), ttl: ttl(d),
    commandes: synthesesCommandes(cmds), reprises: reprisesSousAgents(d), naissances: naissances(d), reveils: reveilsOrchestrateur(d), attente: outilsAttente(d),
    points: pointsDeCache(d), reecritures: ree, signature: signatureAvant(d, ree.sousTtl), frontieres: frontieresDeTour(d), drops: thinkingDrops(d), bascules: basculesOrganisation(d),
    plafond: simuPlafond(d), perimetre: verdictPerimetre(d), sendMessage: conformiteSendMessage(d),
  }
}

export function comptesCles(a) {
  const T = a.vue.total
  const cause = (c) => a.causes.causes.find((x) => x.cle === c)?.ecrit ?? 0
  const repCodeur = a.reprises.lignes.filter((x) => x.type === 'codeur' && /test:perimetre/.test(x.cause))
  const reveilsEnVol = a.reveils.longues.filter((x) => x.cause === 'agent rendu' || x.cause === 'commande de fond')
  const fr = a.frontieres
  return {
    requetes: T.req, ecrit: T.ecrit, partEcrituresCoutPrompt: T.dollarsPrompt ? T.dollarsEcriture / T.dollarsPrompt : 0,
    partReprisesFroidesDansEcritures: T.ecrit ? (cause('inactivité 5 min – 1 h') + cause('inactivité > 1 h') + cause('sans cause visible (< 5 min)')) / T.ecrit : 0,
    reprisesFroidesCodeurApresPerimetre: repCodeur.length, ecritReprisesCodeurApresPerimetre: sommeDe(repCodeur, (x) => x.ecrit),
    reprisesFroidesSousAgents: a.reprises.lignes.length, surcoutReprisesSousAgentsUSD: sommeDe(a.reprises.lignes, (x) => x.surcout),
    reveilsOrchestrateurPlus1hSurAgentOuCommande: reveilsEnVol.length, ecritReveilsEnVol: sommeDe(reveilsEnVol, (x) => x.ecrit),
    reveilsOrchestrateurPlus1hSurAgentMort: a.reveils.longues.filter((x) => x.cause === AGENT_MORT).length,
    reecrituresSansInactivite: a.reecritures.sousTtl.length, reecrituresSansInactivitePrincipal: a.reecritures.sousTtl.filter(estPrincipal).length,
    frontieresCasseesAvecAjout: fr.filter((b) => b.ajout && b.casse).length, frontieresAvecAjout: fr.filter((b) => b.ajout).length,
    frontieresCasseesSansAjout: fr.filter((b) => !b.ajout && b.casse).length, frontieresSansAjout: fr.filter((b) => !b.ajout).length,
    perimetreOrchestrateurApresCodeur: a.commandes.doublonsOrchestrateur, thinkingDrops: a.drops.n, compactages: a.compactages.n,
    dollarsTotal: a.cout.total.total, dollarsEcritures: a.cout.total.e5 + a.cout.total.e1, requetesHorsGrille: a.cout.total.horsGrille,
    modelesHorsGrille: a.cout.modelesHorsGrille.join(', '),
    ...Object.fromEntries(a.plafond.map((g) => [`plafond200k_${g.groupe === 'principal' ? 'principal' : 'sousAgents'}`, g.reel ? g.plafonds.find((x) => x.C === 200e3).compactage.dollars / g.reel - 1 : 0])),
    perimetreCodeursVert: a.perimetre.parFil.filter((x) => x.verdict === 'vert').length, perimetreCodeursRouge: a.perimetre.parFil.filter((x) => x.verdict === 'rouge').length,
    perimetreCodeursInconnu: a.perimetre.parFil.filter((x) => x.verdict === 'inconnu').length,
    sendMessageSurAgentRenduPlus5min: a.sendMessage.renduPlus5.length,
    coutEtatEcartMaxAbs: Math.max(0, ...a.coutEtat.map((c) => Math.abs(c.ecart ?? 0))),
  }
}

/** Delta entre deux jeux de comptes : `{ cle: { avant, apres, delta } }`, clés de l'un ou l'autre. */
export function delta(avant, apres) {
  return tableTotale([...new Set([...Object.keys(avant), ...Object.keys(apres)])], (k) => ({ avant: avant[k] ?? null, apres: apres[k] ?? null, delta: typeof avant[k] === 'number' && typeof apres[k] === 'number' ? apres[k] - avant[k] : null }))
}
