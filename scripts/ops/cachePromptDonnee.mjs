// EXTRACTEUR des transcripts Claude Code (#2596) : une ligne JSON de transcript + l'état de son fil →
// enregistrements normalisés (`requetes`, `evenements`), lus par `scripts/ops/cache-prompt.mjs`.
// Aucune E/S ici : l'état d'un fil (`etatDuFil`) et le contexte partagé entre fils (`contexteDExtraction`,
// dédoublonnage `message.id|requestId`) sont la seule mémoire, mutée par `traiterLigne`.
// Rien n'est jeté en silence : un type de ligne hors `TYPES_CONNUS` devient un événement `inconnu`.

/** Résumé d'événement gardé dans `avant` d'une requête, au plus. */
export const AVANT_MAX = 20

/** Longueurs de troncature des résumés. */
const COMMANDE_MAX = 300
const SCALAIRE_MAX = 120
const PROMPT_MAX = 80
const PREMIER_PROMPT_MAX = 90

/** Clés d'enveloppe communes à toutes les lignes, jamais recopiées dans un résumé. */
const ENVELOPPE = new Set([
  'parentUuid', 'logicalParentUuid', 'isSidechain', 'uuid', 'userType', 'entrypoint', 'cwd', 'sessionId', 'session_id',
  'version', 'gitBranch', 'slug', 'timestamp', 'type', 'subtype', 'agentId', 'promptId', 'message',
])

/** Entrées d'outil qui portent du contenu : seule leur longueur est gardée. */
const CONTENUS = new Set(['content', 'new_string', 'old_string', 'prompt', 'message', 'edits', 'ops', 'new_text', 'old_text'])

/** Types de ligne sans contenu de prompt, comptés à l'inventaire : leurs changements de valeur seuls sont des
 *  événements (`CHANGEMENTS`). */
const TYPES_DE_SUIVI = new Set(['last-prompt', 'mode', 'permission-mode', 'atis-latch', 'ai-title', 'file-history-delta', 'file-history-snapshot'])

/** Types de ligne lus par l'extracteur. */
export const TYPES_CONNUS = new Set(['assistant', 'user', 'system', 'attachment', 'queue-operation', 'pr-link', 'cost-state', ...TYPES_DE_SUIVI])

/** Champs suivis : (nom de l'événement, lecture sur la ligne). */
const CHANGEMENTS = [
  ['version', (o) => o.version],
  ['gitBranch', (o) => o.gitBranch],
  ['permissionMode', (o) => o.permissionMode],
  ['mode', (o) => o.type === 'mode' ? o.mode : undefined],
  ['aiTitle', (o) => o.type === 'ai-title' ? o.aiTitle : undefined],
]

const tronquer = (s, n) => s.length > n ? s.slice(0, n) + '…' : s
const uneLigne = (s) => s.replace(/\s+/g, ' ').trim()

/** Début d'un texte injecté, et le `<summary>` d'une notification s'il en porte un. PUR. */
function apercu(texte) {
  const sommaire = /<summary>([^<]*)/.exec(texte)?.[1]
  return { debut: tronquer(uneLigne(texte), PROMPT_MAX), ...(sommaire ? { sommaire: tronquer(uneLigne(sommaire), SCALAIRE_MAX) } : {}) }
}

/** Texte d'un `content` de message (chaîne ou blocs). PUR. */
export function texteDe(c) {
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  return c.map((b) => b?.type === 'text' ? b.text ?? '' : b?.type === 'image' ? '' : JSON.stringify(b ?? '')).join('')
}

/** Les scalaires d'un objet hors `exclues`, chaînes tronquées ; un contenu (`CONTENUS`) devient sa longueur ; un
 *  objet imbriqué, tant que `profondeur` > 0, se déplie en clés `parent.enfant`. PUR. */
function scalaires(objet, max, exclues = new Set(), profondeur = 0, prefixe = '') {
  const r = {}
  for (const [k, v] of Object.entries(objet ?? {})) {
    if (exclues.has(k)) continue
    const cle = prefixe + k
    if (CONTENUS.has(k)) { r[`${cle}Long`] = typeof v === 'string' ? v.length : JSON.stringify(v ?? '').length; continue }
    if (typeof v === 'string') r[cle] = tronquer(uneLigne(v), k === 'command' ? COMMANDE_MAX : max)
    else if (typeof v === 'number' || typeof v === 'boolean') r[cle] = v
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) r[cle] = tronquer(v.join(' '), max)
    else if (profondeur > 0 && v && typeof v === 'object' && !Array.isArray(v)) Object.assign(r, scalaires(v, max, new Set(), profondeur - 1, `${cle}.`))
  }
  return r
}

/** Résumé d'un `tool_use` : scalaires de l'entrée, commande à `COMMANDE_MAX`. PUR. */
export function resumeOutil(input) {
  return scalaires(input, SCALAIRE_MAX)
}

/** Racine de transcripts que Claude Code dérive d'un cwd : `~/.claude/projects/<cwd, [:\\/.] → ->`. PUR. */
export function racineDuCwd(cwd, maison) {
  return `${maison.replace(/[\\/]+$/, '')}/.claude/projects/${cwd.replace(/[:\\/.]/g, '-')}`
}

/** Identité d'un fichier de transcript depuis son chemin relatif à la racine (segments). PUR.
 *  `<session>.jsonl` → principal ; `<session>/subagents/[workflows/<wf>/]agent-<id>.jsonl` → agent. */
export function identiteDuFichier(segments, meta) {
  const session = segments[0].replace(/\.jsonl$/, '')
  if (segments.length === 1) return { session, fil: 'principal', agentType: null, workflow: null, phase: null }
  const nom = segments.at(-1).replace(/\.jsonl$/, '')
  const iw = segments.indexOf('workflows')
  const workflow = iw >= 0 ? segments[iw + 1] ?? null : null
  const agentType = meta?.agentType ?? (workflow ? 'workflow' : 'inconnu')
  return { session, fil: nom.replace(/^agent-/, ''), agentType, workflow, phase: meta?.workflowPhase ?? null }
}

/** Contexte partagé par tous les fils d'une extraction : fenêtre, dédoublonnage, inventaire. PUR. */
export function contexteDExtraction(depuis, jusqua) {
  return {
    depuis, jusqua, vus: new Set(),
    inventaire: { lignes: 0, lignesInvalides: 0, parType: {}, parSousType: {}, inconnus: {}, requetes: 0, requetesFenetre: 0, doublons: 0, synthetiques: 0, evenements: 0 },
  }
}

/** État d'un fil (un fichier) au début de sa lecture. PUR. */
export function etatDuFil(identite, fichier) {
  return {
    ...identite, fichier, tDernier: null, precedente: null, rang: 0, apresCompactage: false,
    avant: [], avantN: 0, outils: new Map(), suivis: {}, requeteCourante: null,
    fil: { session: identite.session, fichier, fil: identite.fil, agentType: identite.agentType, workflow: identite.workflow, phase: identite.phase,
      premierT: null, dernierT: null, requetes: 0, requetesFenetre: 0, maxCtx: 0, cwd: null, version: null, premierPrompt: null },
  }
}

const incr = (o, k) => { o[k] = (o[k] ?? 0) + 1 }

/** Résumé court d'un événement pour `avant`. PUR. */
function resumeCourt(e) {
  const d = e.type === 'tool_use' ? `${e.nom}${e.resume.run_in_background ? ' (fond)' : ''} ${e.resume.command ?? e.resume.file_path ?? e.resume.path ?? e.resume.subagent_type ?? ''}`
    : e.type === 'tool_result' ? `${e.outil} ${e.taille} car.`
      : e.type === 'system' ? e.subtype
        : e.type === 'attachment' ? `${e.sorte} ${e.taille} car.`
          : e.type === 'prompt' ? `${e.nature} ${e.debut}`
            : e.type === 'file' ? `${e.operation} ${e.debut}`
              : e.type === 'changement' ? `${e.champ} ${e.de} → ${e.vers}`
                : e.type === 'erreur_api' ? e.texte
                  : e.type === 'etat_cout' ? `${e.totalCostUSD} $`
                    : e.type === 'inconnu' ? e.ligneType : ''
  return { type: e.type, r: tronquer(uneLigne(String(d)), 100) }
}

/** Nature d'un prompt utilisateur : `meta`, `balise:<nom>` (notification, commande injectée…) ou `texte`. PUR. */
function natureDuPrompt(texte, isMeta) {
  if (isMeta) return 'meta'
  const b = /^\s*<([\w-]+)/.exec(texte)
  return b ? `balise:${b[1]}` : 'texte'
}

/**
 * Lit UNE ligne brute d'un fil. Mute `etat` (le fil) et `ctx` (l'extraction) ; rend les enregistrements dont
 * l'instant tombe dans `[ctx.depuis, ctx.jusqua)`, et ceux d'un fil sans horodatage (`t` nul). Sans E/S.
 * @returns {{requetes: object[], evenements: object[]}}
 */
export function traiterLigne(ctx, etat, ligne) {
  const sortie = { requetes: [], evenements: [] }
  const inv = ctx.inventaire
  inv.lignes++
  let o
  try { o = JSON.parse(ligne) } catch { inv.lignesInvalides++; return sortie }
  if (!o || typeof o !== 'object') { inv.lignesInvalides++; return sortie }
  const type = String(o.type)
  incr(inv.parType, type)
  if (o.subtype) incr(inv.parSousType, `${type}/${o.subtype}`)
  if (type === 'attachment') incr(inv.parSousType, `attachment/${o.attachment?.type ?? '?'}`)

  const ts = o.timestamp ? Date.parse(o.timestamp) : NaN
  const tHerite = Number.isNaN(ts)
  const t = tHerite ? etat.tDernier : ts
  if (!tHerite) etat.tDernier = ts
  const dansFenetre = t === null || (t >= ctx.depuis && t < ctx.jusqua)
  const f = etat.fil
  if (!f.cwd && o.cwd) f.cwd = o.cwd
  if (!f.version && o.version) f.version = o.version

  const emettre = (e) => {
    const ev = { session: etat.session, fichier: etat.fichier, fil: etat.fil.fil, agentType: etat.agentType, t, ...(tHerite ? { tHerite } : {}), ...e }
    etat.avantN++
    if (etat.avant.length < AVANT_MAX) etat.avant.push(resumeCourt(ev))
    if (dansFenetre) { sortie.evenements.push(ev); inv.evenements++ }
  }

  for (const [champ, lire] of CHANGEMENTS) {
    const v = lire(o)
    if (v === undefined || v === null || v === '') continue
    const prec = etat.suivis[champ]
    etat.suivis[champ] = v
    if (prec !== undefined && prec !== v) emettre({ type: 'changement', champ, de: prec, vers: v })
  }

  if (!TYPES_CONNUS.has(type)) {
    const cles = Object.keys(o)
    const x = inv.inconnus[type] ??= { n: 0, cles }
    x.n++
    emettre({ type: 'inconnu', ligneType: type, cles })
    return sortie
  }
  if (TYPES_DE_SUIVI.has(type)) return sortie

  const m = o.message
  if (o.isApiErrorMessage) emettre({ type: 'erreur_api', texte: tronquer(uneLigne(texteDe(m?.content)), 200), erreur: o.error ?? null })

  if (type === 'assistant') {
    const u = m?.usage
    if (u && m.model !== '<synthetic>') {
      const id = `${m.id}|${o.requestId ?? ''}`
      if (ctx.vus.has(id)) {
        inv.doublons++
        if (etat.requeteCourante?.requestId === (o.requestId ?? null) && m.stop_reason) etat.requeteCourante.stop_reason = m.stop_reason
      } else {
        ctx.vus.add(id)
        sortie.requetes.push(...requete(ctx, etat, o, t, dansFenetre))
      }
    } else if (m?.model === '<synthetic>') inv.synthetiques++
    for (const b of Array.isArray(m?.content) ? m.content : []) {
      if (b?.type !== 'tool_use') continue
      etat.outils.set(b.id, b.name)
      emettre({ type: 'tool_use', nom: b.name, id: b.id, resume: resumeOutil(b.input) })
    }
    return sortie
  }

  if (type === 'user') {
    const c = m?.content
    if (typeof c === 'string') prompt(etat, emettre, c, o)
    else if (Array.isArray(c)) {
      const textes = c.filter((b) => b?.type === 'text').map((b) => b.text ?? '')
      if (textes.length) prompt(etat, emettre, textes.join('\n'), o)
      for (const b of c) {
        if (b?.type !== 'tool_result') continue
        emettre({ type: 'tool_result', outil: etat.outils.get(b.tool_use_id) ?? '?', id: b.tool_use_id, taille: texteDe(b.content).length, erreur: !!b.is_error })
      }
    }
    return sortie
  }

  if (type === 'system') {
    if (o.subtype === 'compact_boundary') {
      etat.apresCompactage = true
      const { preservedMessages, ...meta } = o.compactMetadata ?? {}
      emettre({ type: 'system', subtype: o.subtype, compactMetadata: { ...meta, preservedMessagesN: preservedMessages?.uuids?.length ?? 0 } })
    } else emettre({ type: 'system', subtype: o.subtype ?? null, meta: scalaires(o, SCALAIRE_MAX, ENVELOPPE), ...(Array.isArray(o.hookInfos) ? { hooks: o.hookInfos.map((h) => scalaires(h, SCALAIRE_MAX)) } : {}) })
    return sortie
  }

  if (type === 'attachment') {
    const a = o.attachment ?? {}
    const rendu = Array.isArray(o.rendered) ? o.rendered.map((r) => typeof r?.content === 'string' ? r.content : JSON.stringify(r?.content ?? '')).join('') : ''
    const texte = [a.prompt, a.content, a.text].find((x) => typeof x === 'string')
    emettre({ type: 'attachment', sorte: a.type ?? '?', taille: JSON.stringify(a).length, tailleRendue: rendu.length, renderedRole: o.renderedRole ?? null, meta: scalaires(a, SCALAIRE_MAX, new Set(['type']), 1), ...(texte ? apercu(texte) : {}) })
    return sortie
  }

  if (type === 'queue-operation') {
    const texte = typeof o.content === 'string' ? o.content : texteDe(o.content)
    emettre({ type: 'file', operation: o.operation ?? null, longueur: texte.length, ...apercu(texte) })
    return sortie
  }

  if (type === 'cost-state') {
    emettre({ type: 'etat_cout', totalCostUSD: o.totalCostUSD ?? null, modeles: Object.fromEntries(Object.entries(o.modelUsage ?? {}).map(([mo, u]) => [mo, scalaires(u, SCALAIRE_MAX)])) })
    return sortie
  }

  emettre({ type, meta: scalaires(o, SCALAIRE_MAX, ENVELOPPE) })
  return sortie
}

function prompt(etat, emettre, texte, o) {
  const nature = natureDuPrompt(texte, !!o.isMeta)
  if (nature === 'texte' && !etat.fil.premierPrompt) etat.fil.premierPrompt = tronquer(uneLigne(texte), PREMIER_PROMPT_MAX)
  emettre({ type: 'prompt', nature, isMeta: !!o.isMeta, longueur: texte.length, ...apercu(texte), origin: o.origin?.kind ?? o.origin ?? null })
}

function requete(ctx, etat, o, t, dansFenetre) {
  const m = o.message, u = m.usage
  const lu = u.cache_read_input_tokens ?? 0, ecrit = u.cache_creation_input_tokens ?? 0, nu = u.input_tokens ?? 0
  const e5 = u.cache_creation?.ephemeral_5m_input_tokens ?? 0, e1 = u.cache_creation?.ephemeral_1h_input_tokens ?? 0
  const ctxTokens = lu + ecrit + nu
  etat.rang++
  const r = {
    session: etat.session, fichier: etat.fichier, fil: etat.fil.fil, agentType: etat.agentType, model: m.model, t,
    requestId: o.requestId ?? null, lu, e5, e1, ecritAutre: ecrit - e5 - e1, nu, out: u.output_tokens ?? 0,
    pense: u.output_tokens_details?.thinking_tokens ?? null, ctx: ctxTokens,
    ecartMin: etat.precedente === null || t === null ? null : (t - etat.precedente) / 60000,
    rang: etat.rang, premiere: etat.rang === 1, apresCompactage: etat.apresCompactage, version: o.version ?? null,
    stop_reason: m.stop_reason ?? null, avantN: etat.avantN, avant: etat.avant,
  }
  etat.precedente = t
  etat.apresCompactage = false
  etat.avant = []
  etat.avantN = 0
  etat.requeteCourante = r
  const f = etat.fil
  f.requetes++
  f.premierT ??= t
  f.dernierT = t
  f.maxCtx = Math.max(f.maxCtx, ctxTokens)
  ctx.inventaire.requetes++
  if (!dansFenetre) return []
  f.requetesFenetre++
  ctx.inventaire.requetesFenetre++
  return [r]
}
