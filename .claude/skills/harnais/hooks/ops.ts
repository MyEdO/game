// COUTURE du mod `harnais` (#2278), PURE : l'appel d'un script du dépôt et la lecture de sa sortie JSON
// (mur `murs/mod-sans-regle`, `VERROU_MOD_COUTURE` d'oxlint.config.mjs). Le moteur ne suit `$` dans aucun import : le lancement
// s'écrit au site d'appel, `lire(await $.process.run(...appel($.plugin.root, <script>, <args>)))`.
import type { ProcessRunInit, ProcessRunResult } from 'claude-code'
import type { HarnaisOutilsCodex } from '../types'

/** Borne (ms) par défaut d'un script lancé ; le lecteur du suivi répond en moins d'une seconde (#2278, sonde P1). Valeur maison. */
const BORNE_MS = 20 * 1000

/** Ce que rend `lire` : la valeur lue, ou le motif de l'échec. */
export type Lu<T> = { ok: true; valeur: T; echec?: true } | { ok: false; motif: string }

/**
 * L'argv et les options de `$.process.run` pour `node <dépôt>/scripts/ops/<script>.mjs ...args`, lancé depuis
 * la racine du dépôt, trois niveaux au-dessus de `racinePlugin` (`.claude/skills/<mod>`), borné à `borneMs`.
 */
export function appel(racinePlugin: string, script: string, args: readonly string[], { borneMs = BORNE_MS, stdin }: { borneMs?: number; stdin?: string } = {}): readonly [string[], ProcessRunInit] {
  const racine = `${racinePlugin}/../../..`
  return [['node', `${racine}/scripts/ops/${script}.mjs`, ...args], { cwd: racine, timeoutMs: borneMs, ...(stdin === undefined ? {} : { stdin }) }]
}

/**
 * La sortie JSON d'un script : un objet, sinon le motif (code hors de `codes`, JSON illisible, forme fausse).
 * `codes` : les codes de sortie dont le script écrit son JSON (0 par défaut).
 */
export function lire<T>(resultat: ProcessRunResult, { codes = [0] }: { codes?: readonly number[] } = {}): Lu<T> {
  if (!codes.some((code) => code === resultat.exitCode)) return { ok: false, motif: resultat.stderr.trim() || `code de sortie ${resultat.exitCode}` }
  let valeur: unknown
  try {
    valeur = JSON.parse(resultat.stdout)
  } catch {
    return { ok: false, motif: 'sortie JSON illisible' }
  }
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return { ok: false, motif: 'sortie JSON qui n’est pas un objet' }
  return { ok: true, valeur: valeur as T, ...([0].some((code) => code === resultat.exitCode) ? {} : { echec: true as const }) }
}

export function refusNatif(valeur: Record<string, unknown>, prefixes: readonly string[]): string | null {
  const refus = valeur.refus
  return objet(refus) && texte(refus.raison) && prefixes.some((prefixe) => prefixe === refus.prefixe)
    ? `${refus.prefixe} ${refus.raison}` : null
}

function objet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

function texte(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && Boolean(valeur.trim())
}

export function outilsCodex(lu: Lu<unknown>): Lu<HarnaisOutilsCodex> {
  if (!lu.ok) return lu
  const valeur = lu.valeur
  if (lu.echec || !objet(valeur)) return { ok: false, motif: 'contrat outils Codex malformé' }
  const { outils, prefixesDeRefus, refusTechnique } = valeur
  const noms = ['codex_envoyer', 'codex_attendre', 'codex_etat']
  if (!Array.isArray(outils) || !Array.isArray(prefixesDeRefus)
    || !prefixesDeRefus.length || !prefixesDeRefus.every(texte) || !texte(refusTechnique)
    || outils.length !== noms.length
    || !outils.every((outil) => objet(outil) && texte(outil.name) && texte(outil.description)
      && objet(outil.inputSchema) && outil.inputSchema.type === 'object' && objet(outil.inputSchema.properties)
      && Array.isArray(outil.inputSchema.required) && outil.inputSchema.required.every(texte)
      && outil.inputSchema.additionalProperties === false)
    || !noms.every((nom) => outils.some((outil: Record<string, unknown>) => outil.name === nom))) {
    return { ok: false, motif: 'contrat outils Codex malformé' }
  }
  return { ok: true, valeur: valeur as HarnaisOutilsCodex }
}
