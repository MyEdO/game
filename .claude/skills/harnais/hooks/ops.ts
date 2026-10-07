// COUTURE du mod `harnais` (#2278), PURE : l'appel d'un script du dépôt et la lecture de sa sortie JSON
// (mur `murs/mod-sans-regle`, `VERROU_MOD_COUTURE` d'oxlint.config.mjs). Le moteur ne suit `$` dans aucun import : le lancement
// s'écrit au site d'appel, `lire(await $.process.run(...appel($.plugin.root, <script>, <args>)))`.
import type { ProcessRunInit, ProcessRunResult } from 'claude-code'

/** Borne (ms) par défaut d'un script lancé ; le lecteur du suivi répond en moins d'une seconde (#2278, sonde P1). Valeur maison. */
const BORNE_MS = 20 * 1000

/** Ce que rend `lire` : la valeur lue, ou le motif de l'échec. */
export type Lu<T> = { ok: true; valeur: T } | { ok: false; motif: string }

/**
 * L'argv et les options de `$.process.run` pour `node <dépôt>/scripts/ops/<script>.mjs ...args`, lancé depuis
 * la racine du dépôt, trois niveaux au-dessus de `racinePlugin` (`.claude/skills/<mod>`), borné à `borneMs`.
 */
export function appel(racinePlugin: string, script: string, args: readonly string[], { borneMs = BORNE_MS }: { borneMs?: number } = {}): readonly [string[], ProcessRunInit] {
  const racine = `${racinePlugin}/../../..`
  return [['node', `${racine}/scripts/ops/${script}.mjs`, ...args], { cwd: racine, timeoutMs: borneMs }]
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
  return { ok: true, valeur: valeur as T }
}
