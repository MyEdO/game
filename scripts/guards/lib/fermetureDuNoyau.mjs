// FERMETURE DE LA SURFACE DU NOYAU (#2817 D9, épique #2882) — définition UNIQUE de la mesure, lue par la garde
// `src/noyau/surface-fermeture-guard.test.ts`.
//
// Question : ce qu'un hôte externe importe (`ENTREES_FERMEES` : la surface `src/noyau/index.ts`, les scénarios
// de test qu'il lance, et l'entrée de l'hôte texte, #2898) charge-t-il à l'EXÉCUTION un module d'un hôte web ou
// d'interface ? Réponse
// attendue : aucun fichier de `ZONES_D_HOTE`, aucun paquet de `PAQUETS_D_HOTE`.
// La table `COUCHES` (`couches.mjs`) ne l'implique pas : `data` importe `scenes` en valeur, et `scenes` importe
// `state` (arêtes transitoires de #2884) ; la fermeture se MESURE donc ici.
// Primitive : `clotureDImports` (`importGraph.mjs`), arcs d'exécution seuls (`typesEffaces`), dynamiques et motifs
// d'`import.meta.glob` compris (contre la liste des fichiers de l'arbre de travail) ; les paquets se lisent sur les
// spécificateurs NON RÉSOLUS de chaque module de la fermeture.
// ANGLES MORTS : ceux de `clotureDImports` (spécificateur calculé, motif joker hors de la liste des fichiers).
import { resolve, sep } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { clotureDImports } from './importGraph.mjs'
import { TRAVAIL, depotDe, listerImage } from './gitPorte.mjs'
import { SURFACE_DU_NOYAU } from './couches.mjs'

/** Les entrées qu'un hôte externe importe, mesurées chacune par `mesure` : la surface du noyau, le registre des
 *  scénarios de test dont il construit le lancement, et l'entrée de l'hôte texte (#2898). */
export const ENTREES_FERMEES = Object.freeze([SURFACE_DU_NOYAU, 'src/scenes/test-scenarios/index.ts', 'src/hoteTexte/cli.ts'])

/** Les zones de `src/` qu'aucun module de la fermeture ne charge. */
export const ZONES_D_HOTE = Object.freeze(['state', 'ui', 'gameIso', 'web', 'net', 'audio'])

/** Les paquets qu'aucun module de la fermeture ne charge. */
export const PAQUETS_D_HOTE = Object.freeze(['react', 'react-dom', 'zustand', 'three'])

/** Le nom de paquet d'un spécificateur nu (`@scope/nom/x` → `@scope/nom`), `null` pour un chemin ou un alias. PURE. */
export function paquetDe(spec) {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('node:')) return null
  const segments = spec.split('/')
  return spec.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
}

/** La zone de `src/` d'un chemin POSIX relatif, `null` hors de `src/`. PURE. */
const zoneDe = (rel) => {
  const segments = rel.split('/')
  return segments[0] === 'src' && segments.length > 2 ? segments[1] : null
}

/** L'arbre de travail de `racine` (suivis et non suivis, hors ignorés et supprimés), en `arbre` de `clotureDImports`. */
function arbreDeTravail(racine) {
  const base = resolve(racine).split(sep).join('/')
  return {
    existe: existsSync,
    lire: (abss) => new Map(abss.map((abs) => { try { return [abs, readFileSync(abs, 'utf8')] } catch { return [abs, null] } })),
    fichiers: listerImage(depotDe(racine), TRAVAIL).map((rel) => `${base}/${rel}`),
  }
}

/**
 * La mesure : les modules de la fermeture d'exécution de `depart`, les paquets qu'ils chargent, et chaque faute (un
 * module d'une zone d'hôte, un paquet d'hôte) avec la chaîne d'imports la plus courte qui l'atteint.
 * @param {{ racine?: string, depart?: string, arbre?: { existe: (abs: string) => boolean, lire: (abss: string[]) => Map<string, string | null>, fichiers: readonly string[] } }} [p]
 * @returns {{ modules: string[], paquets: string[], fautes: { cible: string, chaine: string[] }[] }}
 */
export function mesure({ racine = '.', depart = SURFACE_DU_NOYAU, arbre = arbreDeTravail(racine) } = {}) {
  const base = resolve(racine).split(sep).join('/')
  const rel = (abs) => abs.slice(base.length + 1)
  const cache = new Map()
  const nus = new Map()
  const modules = clotureDImports([depart], {
    racine, typesEffaces: true, cache, arbre,
    specificateurs: { lire: () => undefined, ecrire: (abs, _texte, sites) => nus.set(rel(abs), sites.filter((s) => s.nature !== 'glob').map((s) => s.spec)) },
  })
  const parent = new Map([[depart, null]])
  const file = [depart]
  while (file.length) {
    const f = file.shift()
    for (const arc of cache.get(`${base}/${f}`) ?? []) {
      const cible = rel(arc.cible)
      if (!parent.has(cible) && modules.has(cible)) { parent.set(cible, f); file.push(cible) }
    }
  }
  const chaine = (f) => { const c = []; for (let x = f; x !== null; x = parent.get(x)) c.unshift(x); return c }
  const paquets = new Map()
  for (const m of modules) for (const spec of nus.get(m) ?? []) {
    const p = paquetDe(spec)
    if (p !== null && !paquets.has(p)) paquets.set(p, m)
  }
  const fautes = [
    ...[...modules].filter((m) => ZONES_D_HOTE.includes(zoneDe(m))).map((m) => ({ cible: m, chaine: chaine(m) })),
    ...[...paquets].filter(([p]) => PAQUETS_D_HOTE.includes(p)).map(([p, m]) => ({ cible: p, chaine: [...chaine(m), p] })),
  ]
  return { modules: [...modules].sort(), paquets: [...paquets.keys()].sort(), fautes }
}
