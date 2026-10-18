// Ports servis par CET arbre, et IDENTITÉ de l'arbre servi (#1679 L1c-M6).
//
// Vite auto-incrémente le port quand celui demandé est pris : deux arbres lancés côte à côte
// donnaient `5173` au premier et `5174` au second, et une recette qui tape `5173` mesure alors
// l'AUTRE arbre (faux vert) : un port fixe fait servir l'arbre d'un worktree VOISIN à la recette
// (vécu 2026-08-23, #1426 : 5 serveurs Vite sur 5173-5178, rapport de bugs fantômes).
//
// La règle ne se branche PAS sur la forme du chemin (`.wt-*`, nom du dossier…) mais sur le seul
// fait qui distingue les deux natures d'arbre pour git : `<racine>/.git` est un DOSSIER dans un
// arbre principal ou un clone, un FICHIER dans un worktree LIÉ. L'arbre principal garde donc le
// port historique 5173 (`docs/recette-navigateur.md`, les skills de recette
// et `scripts/docs/build-reprise.mjs` le disent tous), les worktrees liés se répartissent sur la
// plage suivante.
//
// Deux CLONES sur la même machine réclament tous deux 5173 : avec `strictPort`, le second ÉCHOUE
// bruyamment au lancement au lieu de glisser sur le port du voisin et de le servir en silence —
// c'est la propriété recherchée, un refus se lit, un faux vert non.
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Racine de l'arbre : le dossier qui porte `vite.config.ts` et ce dossier `scripts/`. */
export const RACINE = fileURLToPath(new URL('..', import.meta.url))

/** Port de l'arbre PRINCIPAL (dev), et premier port de la plage dérivée des worktrees liés. */
export const PORT_DEV_PRINCIPAL = 5173
export const PORT_DEV_DERIVE = 5174
/** Idem pour `vite preview`. */
export const PORT_PREVIEW_PRINCIPAL = 4173
export const PORT_PREVIEW_DERIVE = 4174
/** Nombre de ports de la plage dérivée (5174-5272 en dev, 4174-4272 en preview). */
export const PLAGE_PORTS = 99

/** Nom de l'en-tête HTTP par lequel le serveur PUBLIE la racine qu'il sert. */
export const ENTETE_RACINE = 'x-wfrp-racine'

/** Forme comparable d'un chemin d'arbre : séparateurs POSIX, sans slash final, casse neutralisée
 *  (Windows rend `C:\…` ou `c:\…` selon l'appelant, et le port doit être le MÊME). */
export function normaliserRacine(chemin) {
  return chemin.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/** FNV-1a 32 bits — empreinte stable d'une machine à l'autre et d'une version de Node à l'autre. */
export function empreinte(texte) {
  let h = 0x811c9dc5
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** VRAI si `chemin` est un DOSSIER sur le disque (défaut de `estArbrePrincipal`). */
function estDossier(chemin) {
  try {
    return statSync(chemin).isDirectory()
  } catch {
    return false
  }
}

/**
 * VRAI si `racine` est un arbre principal ou un clone : `<racine>/.git` y est un DOSSIER. Dans un
 * worktree LIÉ, `git worktree add` y écrit un FICHIER (`gitdir: …`). `dossier` est injecté pour la
 * mesure ; par défaut, le disque.
 */
export function estArbrePrincipal(racine = RACINE, dossier = estDossier) {
  return dossier(join(racine, '.git'))
}

/** Port de `racine` : `principal` si l'arbre est principal, sinon `derive + empreinte % PLAGE_PORTS`. */
function portDe(racine, principal, derive, dossier) {
  if (estArbrePrincipal(racine, dossier)) return principal
  return derive + (empreinte(normaliserRacine(racine)) % PLAGE_PORTS)
}

/** Port du serveur de DEV de l'arbre `racine`. */
export function portDev(racine = RACINE, dossier = estDossier) {
  return portDe(racine, PORT_DEV_PRINCIPAL, PORT_DEV_DERIVE, dossier)
}

/** Port de `vite preview` de l'arbre `racine`. */
export function portPreview(racine = RACINE, dossier = estDossier) {
  return portDe(racine, PORT_PREVIEW_PRINCIPAL, PORT_PREVIEW_DERIVE, dossier)
}

/** URL de l'app servie en DEV par CET arbre. */
export function urlDev(racine = RACINE, dossier = estDossier) {
  return `http://localhost:${portDev(racine, dossier)}/`
}

/** URL de l'app servie par `vite preview` depuis CET arbre. */
export function urlPreview(racine = RACINE, dossier = estDossier) {
  return `http://localhost:${portPreview(racine, dossier)}/`
}

/**
 * Valeur de l'en-tête `ENTETE_RACINE` : la racine NORMALISÉE, `encodeURIComponent`-ée. Un en-tête
 * HTTP ne transporte que du latin-1 — un chemin de travail accentué ferait lever la sérialisation
 * de Node au démarrage du serveur. `racineDepuisEntete` fait le chemin inverse.
 */
export function valeurEnteteRacine(racine = RACINE) {
  return encodeURIComponent(normaliserRacine(racine))
}

/** Racine normalisée portée par une valeur d'en-tête, ou `null` si l'en-tête est absent/illisible. */
export function racineDepuisEntete(valeur) {
  if (!valeur) return null
  try {
    return normaliserRacine(decodeURIComponent(String(valeur)))
  } catch {
    return null
  }
}
