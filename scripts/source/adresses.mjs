// INVENTAIRE des adresses de prose du dépôt — LA définition du walk, source unique.
//
// Une adresse (`descRef`) peut vivre à toute profondeur de n'importe quel `.json` des deux racines
// de documents AUTHORÉS (`src/data`, `src/scenes`). Qui veut les voir toutes — la garde de
// re-résolution (`src/data/prose-resolution.test.ts`), la sonde de matérialisation
// (`src/data/source/prose-source.test.ts`), l'outil de réparation (`reparer-adresses.mjs`) — les
// prend ICI : un second walk quelque part et le périmètre des deux diverge en silence.
//
// Le listage passe par la primitive d'ORDRE TOTAL `listerArbre` (`scripts/guards/lib/lister.mjs`) :
// l'ordre du système de fichiers ferait varier l'ordre d'un rapport d'une machine à l'autre.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre } from '../guards/lib/lister.mjs'

/** Racine du dépôt, déduite de la place de ce module (`scripts/source/`). */
export const RACINE_DEPOT = fileURLToPath(new URL('../../', import.meta.url))

/** Chemin absolu d'un chemin relatif à la racine du dépôt, d'où que le processus soit lancé (#3120). */
export const cheminDuDepot = (chemin) => resolve(RACINE_DEPOT, chemin)

/** Racines de documents authorés, relatives à la racine du dépôt, en chemins POSIX. */
export const RACINES_PAR_DEFAUT = ['src/data', 'src/scenes']

/**
 * Chemins POSIX — relatifs à la racine du dépôt — des `.json` d'UNE racine, à toute profondeur.
 * Une racine absente LÈVE (défaut de `listerArbre`) : un chemin qui a bougé doit être bruyant, une
 * racine vide rendrait un périmètre vide et des gardes vertes sur le néant.
 * @param {string} racineRelative @param {string} [racine] @returns {string[]}
 */
export function fichiersJsonDe(racineRelative, racine = RACINE_DEPOT) {
  return listerArbre(join(racine, racineRelative), { filtre: (rel) => rel.endsWith('.json') })
    .map((rel) => `${racineRelative}/${rel}`)
}

/**
 * Tous les `.json` des racines données, chemins POSIX relatifs à la racine du dépôt.
 * @param {string[]} [racines] @param {string} [racine] @returns {string[]}
 */
export function fichiersJson(racines = RACINES_PAR_DEFAUT, racine = RACINE_DEPOT) {
  return racines.flatMap((r) => fichiersJsonDe(r, racine))
}

/** @typedef {{ fichier: string, chemin: string, id: string, ref: object, noeud: object }} Adresse */

/**
 * Nœuds porteurs d'une `descRef`, à toute profondeur des racines données.
 *
 * `fichier` = chemin POSIX relatif à la racine du dépôt ; `chemin` = chemin de clés jusqu'au nœud
 * (`[3].effects[0]`) ; `id` = l'`id` STABLE de l'entrée porteuse quand elle en a un, sinon le
 * `chemin` — jamais un libellé (doctrine 2026-07-09) ; `noeud` = le nœud lui-même, que la porte
 * FAIL-CLOSED `resoudreProse` juge ENTIER (la paire `desc` + `descRef` est un refus).
 * LÈVE, nommément, sur un `.json` qui ne parse plus : un document perdu est un rouge, pas un vide.
 * @param {string[]} [racines] @param {string} [racine] @returns {Adresse[]}
 */
export function adressesDuDepot(racines = RACINES_PAR_DEFAUT, racine = RACINE_DEPOT) {
  /** @type {Adresse[]} */
  const out = []
  for (const fichier of fichiersJson(racines, racine)) {
    let data
    try {
      data = JSON.parse(readFileSync(join(racine, fichier), 'utf8'))
    } catch (e) {
      // FAIL-LOUD : un `.json` d'une racine de données qui ne parse plus n'est pas « zéro adresse »,
      // c'est un document PERDU — l'avaler rendrait la garde de re-résolution verte sur le vide et
      // laisserait une écriture qui casse un document passer pour un succès.
      throw new Error(`document illisible : ${fichier} — ${e instanceof Error ? e.message : String(e)}`, { cause: e })
    }
    const walk = (node, chemin) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) {
        node.forEach((x, i) => walk(x, `${chemin}[${i}]`))
        return
      }
      if (node.descRef !== undefined) {
        const id = typeof node.id === 'string' ? node.id : chemin || '?'
        out.push({ fichier, chemin, id, ref: node.descRef, noeud: node })
      }
      for (const [k, v] of Object.entries(node)) walk(v, chemin ? `${chemin}.${k}` : k)
    }
    walk(data, '')
  }
  return out
}

/**
 * Les `.json` qui portent au moins une adresse, groupés par fichier — dérivé d'`adressesDuDepot`,
 * jamais un second balayage.
 * @param {string[]} [racines] @param {string} [racine] @returns {{ fichier: string, adresses: Adresse[] }[]}
 */
export function fichiersAdresses(racines = RACINES_PAR_DEFAUT, racine = RACINE_DEPOT) {
  /** @type {Map<string, Adresse[]>} */
  const parFichier = new Map()
  for (const a of adressesDuDepot(racines, racine)) {
    const vues = parFichier.get(a.fichier)
    if (vues) vues.push(a)
    else parFichier.set(a.fichier, [a])
  }
  return [...parFichier.entries()].map(([fichier, adresses]) => ({ fichier, adresses }))
}
