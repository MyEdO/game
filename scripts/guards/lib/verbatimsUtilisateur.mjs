// #3175
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre } from './lister.mjs'

const DATE = /\b20\d{2}-\d{2}(?:-\d{2})?\b/
const ATTRIBUTION = /\b(?:utilisateurs?|users?|cl[ée]ment|arbitrages?)\b|\bverbatims?\b(?=[*_\s]*(?:\([^)]*\b20\d{2}-\d{2}|(?:du\s+)?20\d{2}-\d{2}))|#\d+\s*,\s*20\d{2}-\d{2}(?:-\d{2})?\s*:/i
const REFERENCE_SOURCE = /\b[A-ZÀ-ÖØ-Þ]{2,}(?:\s+(?:\d+|[IVX]+))\s+l\.\s*\d+/
const RACINES = ['.claude/rules', '.claude/skills', '.claude/agents', '.agents', '.codex/agents', 'docs']
const FICHIERS = ['AGENTS.md', '.claude/credo.md', '.claude/sous-agents.md']

/** Les chemins textuels qui portent les consignes et références vivantes. */
export function estContexteVivant(chemin) {
  const rel = String(chemin).replace(/\\/g, '/')
  // docs/plans/ datés : archives du design, jamais consignes vivantes.
  if (/^docs\/plans\/(?:[^/]+\/)*20\d{2}-\d{2}-\d{2}[^/]*(?:\/|$)/.test(rel)) return false
  return FICHIERS.includes(rel) || (RACINES.some((racine) => rel.startsWith(racine + '/')) && /\.(?:md|toml|ya?ml|txt|json|js|mjs)$/.test(rel))
}

/**
 * Analyse syntaxique : citation française ou droite, attribution explicite et date ISO (jour ou mois).
 * L'attribution/date d'un titre Arbitrage vaut pour sa section ; une citation Source datée sans
 * attribution utilisateur n'est pas un arbitrage. Les lignes physiques restent celles du fichier.
 */
export function verbatimsUtilisateur(chemin, texte) {
  if (!estContexteVivant(chemin)) return []
  const lignes = String(texte).replace(/\r\n?/g, '\n').split('\n')
  const sections = []
  const defauts = []
  let bloc = []
  let premiereLigne = 1
  const analyser = () => {
    if (!bloc.length) return
    const contenu = bloc.join('\n').replace(/\\r\\n|\\n|"""/g, (m) => ' '.repeat(m.length))
    const citations = [...contenu.matchAll(/«[^»]*»|"[^"]*"/g)]
    let precedente = 0
    let attribution = false
    let date = false
    const section = sections.at(-1)
    if (section && !citations.length && /(?:réponses|paroles|verbatims|arbitrages)[^.!?]*utilisateur/i.test(contenu) && DATE.test(contenu)) {
      section.attribution = true
      section.date = false
    }
    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i]
      const entre = contenu.slice(precedente, citation.index)
      const avant = entre.split(/[.!?]\s+/).at(-1)
      const continuation = /^\s*[,;]?\s*(?:et|ou|puis)\b/i.test(entre)
        || /^\s*;\s*20\d{2}-\d{2}(?:-\d{2})?(?:\s+à\s+20\d{2}-\d{2}(?:-\d{2})?)?\s*:\s*$/.test(entre)
      if (!continuation) { attribution = false; date = false }
      const apres = contenu.slice(citation.index + citation[0].length, citations[i + 1]?.index ?? contenu.length)
      if (ATTRIBUTION.test(avant)) { attribution = true; date = DATE.test(avant) }
      else if (DATE.test(avant) && (attribution || section?.attribution)) date = true
      const suffixe = /^\s*(?:[—–-]\s*)?(\([^)]*\)|(?:utilisateurs?|users?|cl[ée]ment|arbitrages?)\b[^.!?]*)/i.exec(apres)?.[1] ?? ''
      const attributionApres = ATTRIBUTION.test(suffixe) && DATE.test(suffixe)
      const dateApres = DATE.test(suffixe)
      const annonce = /(?::|\bverbatim)[*_\s]*$/i.test(avant) || /^\s*>?\s*$/.test(avant)
        || (attribution && /\bchoix\s+[^.!?]*\s*$/i.test(avant))
      const datationLocale = date || dateApres || (section?.date && annonce)
      if (!REFERENCE_SOURCE.test(avant) && (((attribution || section?.attribution) && datationLocale && (annonce || continuation || dateApres)) || attributionApres)) {
        defauts.push({
          ligne: premiereLigne + contenu.slice(0, citation.index).split('\n').length - 1,
          citation: citation[0],
        })
      }
      precedente = citation.index + citation[0].length
    }
    bloc = []
  }
  lignes.forEach((ligne, i) => {
    const titre = /^\s*(#{1,6})\s+(.+)$/.exec(ligne)
    if (titre) {
      analyser()
      while (sections.length && sections.at(-1).niveau >= titre[1].length) sections.pop()
      const parent = sections.at(-1)
      sections.push({ niveau: titre[1].length, attribution: ATTRIBUTION.test(titre[2]) || parent?.attribution, date: DATE.test(titre[2]) || parent?.date })
    }
    if (!ligne.trim()) analyser()
    else {
      if (/^\s*(?:[-*+]\s|\d+[.)]\s|\|)/.test(ligne)) analyser()
      if (!bloc.length) premiereLigne = i + 1
      bloc.push(ligne)
    }
  })
  analyser()
  return defauts
}

/** Corpus sur disque : les dérivés présents et les fichiers neufs sont jugés aussi. */
export function verbatimsDuCorpus({ racine }) {
  const chemins = [
    ...FICHIERS.filter((rel) => existsSync(join(racine, rel))),
    ...RACINES.flatMap((dossier) => listerArbre(join(racine, dossier), { absent: 'vide' }).map((rel) => dossier + '/' + rel)),
  ].filter(estContexteVivant).sort()
  return chemins.flatMap((chemin) => verbatimsUtilisateur(chemin, readFileSync(join(racine, chemin), 'utf8')).map((defaut) => ({ chemin, ...defaut })))
}

if (import.meta.main) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url))
  const defauts = verbatimsDuCorpus({ racine })
  for (const { chemin, ligne } of defauts) console.error(`${chemin}:${ligne} — verbatim utilisateur daté : conserver la consigne et renvoyer au ticket ou à la fiche user-*`)
  console.log(`verbatims-utilisateur — ${defauts.length} défaut(s)`)
  process.exitCode = defauts.length ? 1 : 0
}
