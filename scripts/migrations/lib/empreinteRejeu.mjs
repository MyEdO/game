// EMPREINTE DU REJEU (#1613) — la mesure « rien n'a bougé » pour un arbre qui N'EST PAS un dépôt.
//
// Le rejeu des migrations se mesure de trois façons, une par forme d'arbre, jamais une par migration :
//   1. `git diff` — ce qui est SUIVI, dans le dépôt (scripts/migrations/replay.mjs) ;
//   2. `git status --porcelain` — ce qui ne l'est pas, dans le dépôt (`neufsDe`) ;
//   3. l'EMPREINTE — ici : les fichiers du périmètre HACHÉS dans l'arbre rejoué, confrontés aux blobs
//      de l'arbre du sha exporté. C'est la seule voie disponible sur un EXPORT, où git ne connaît
//      aucune histoire.
//
// Pourquoi une troisième voie plutôt que `git diff` sur l'export : hors dépôt, `git diff --exit-code
// -- <a> <b> …` ne se plaint PAS — il bascule en `--no-index`, compare les deux premiers chemins et
// prend le reste en pathspec ; aucun de ceux-là n'existant, il rend **0**, soit « rien n'a bougé » sur
// un arbre pourtant réécrit (mesuré : `git rev-parse --is-inside-work-tree` y rend 128 quand
// `git diff --exit-code -- <6 chemins>` rend 0).
//
// Coût mesuré sur le périmètre réel (528 fichiers) : 0,13 à 0,17 s — un seul `git hash-object
// --stdin-paths` et un seul `git ls-tree -r -z`.
//
// DÉTERMINISME CROSS-OS : les chemins sont rendus en
// `/` et triés en UNITÉS DE CODE — `readdirSync` rend l'ordre du système de fichiers (NTFS trié,
// ext4 par hash), qui ne décide de rien ici.
import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'

/**
 * Fichiers du `perimetre` présents dans `dossier`, chemins RELATIFS en `/`, triés en unités de code.
 * Un chemin du périmètre absent de l'arbre n'est pas une erreur : le périmètre décrit ce que les
 * migrations PEUVENT écrire, pas ce que tout arbre porte.
 *
 * Une entrée du périmètre peut être un DOSSIER ou un FICHIER, et les deux comptent — parce que
 * `blobsDe` les accepte déjà toutes deux (un pathspec de `git ls-tree` ne distingue pas). Les deux
 * moitiés de la comparaison doivent voir le même monde : sous un `fichiersDe` aveugle aux fichiers,
 * un périmètre contenant `package.json` rendait un `disparus: ['package.json']` FANTÔME sur un arbre
 * pourtant intact (mesuré).
 * @param {string} dossier racine de l'arbre à lister
 * @param {readonly string[]} perimetre chemins relatifs (dossiers ou fichiers)
 * @returns {string[]}
 */
export function fichiersDe(dossier, perimetre) {
  const trouves = []
  const pile = [...perimetre]
  while (pile.length) {
    const rel = pile.pop()
    let entrees
    try {
      entrees = readdirSync(join(dossier, rel), { withFileTypes: true })
    } catch {
      // Pas un dossier : soit une entrée FICHIER du périmètre, soit un chemin absent de cet arbre.
      try {
        if (statSync(join(dossier, rel)).isFile()) trouves.push(rel)
      } catch {
        // absent : rien à hacher, et ce n'est pas une anomalie (voir ci-dessus)
      }
      continue
    }
    for (const e of entrees) {
      const chemin = `${rel}/${e.name}`
      if (e.isDirectory()) pile.push(chemin)
      else if (e.isFile()) trouves.push(chemin)
    }
  }
  return trouves.sort(parUnitesDeCode)
}

/**
 * Empreinte de l'arbre `dossier` : `chemin → sha1 du contenu`, par UN SEUL `git hash-object
 * --stdin-paths`. La commande n'a besoin d'aucun dépôt — mais elle n'est PAS brute : elle applique
 * les filtres d'entrée, donc un fichier CRLF y rend le sha de sa version LF (mesuré : même sha sans
 * `.gitattributes`, sous `* text=auto eol=lf`, ET sous `* -text`). C'est ce qui rend l'empreinte
 * comparable aux blobs, qui sont normalisés de la même façon.
 *
 * ANGLE MORT qui en découle, dit : une migration qui ne changerait QUE des fins de ligne (LF→CRLF)
 * est invisible à cette mesure. C'est exactement l'angle mort de `git diff` dans le dépôt sous
 * `* text=auto eol=lf` — la 3e voie n'élargit pas le trou, elle ne le bouche pas.
 * @param {string} dossier @param {readonly string[]} perimetre
 * @returns {Map<string, string>}
 */
export function empreinteDe(dossier, perimetre) {
  const fichiers = fichiersDe(dossier, perimetre)
  if (fichiers.length === 0) return new Map()
  const vu = spawnSync('git', ['hash-object', '--stdin-paths'], {
    cwd: dossier,
    input: `${fichiers.join('\n')}\n`,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  // Le statut de git prime : un EPIPE de l'entrée, conséquence de sa sortie, ne le masque pas ; à 0, il se nomme.
  if (typeof vu.status === 'number' && vu.status !== 0) throw new Error(`git hash-object a rendu ${vu.status} sur ${dossier} : ${(vu.stderr || '').trim()}`)
  if (vu.error || vu.status !== 0) throw new Error(`git hash-object sur ${dossier} en échec : ${vu.error?.message ?? `signal ${vu.signal}`}`)
  const shas = vu.stdout.trim().split(/\r?\n/)
  if (shas.length !== fichiers.length)
    throw new Error(`git hash-object a rendu ${shas.length} empreintes pour ${fichiers.length} fichiers de ${dossier}`)
  return new Map(fichiers.map((f, i) => [f, shas[i]]))
}

/**
 * Blobs du `perimetre` dans l'arbre de `sha` : `chemin → sha du blob`, la référence à laquelle
 * l'empreinte se compare. Un pathspec qui ne matche rien rend une liste vide sans erreur.
 * @param {string} depot @param {string} sha @param {readonly string[]} perimetre
 * @returns {Map<string, string>}
 */
export function blobsDe(depot, sha, perimetre) {
  const brut = execFileSync('git', ['ls-tree', '-r', '-z', sha, '--', ...perimetre], {
    cwd: depot,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  const entrees = brut
    .split('\0')
    .filter(Boolean)
    .map((e) => {
      const tab = e.indexOf('\t')
      return { chemin: e.slice(tab + 1), sha: e.slice(0, tab).split(' ')[2] }
    })
    .sort((a, b) => parUnitesDeCode(a.chemin, b.chemin))
  return new Map(entrees.map(({ chemin, sha: blob }) => [chemin, blob]))
}

/**
 * Écart entre l'état de RÉFÉRENCE (les blobs de la tête) et l'état APRÈS rejeu (l'empreinte).
 * Trois familles, toutes fatales : une donnée réécrite, un document créé, un document effacé.
 * @param {Map<string, string>} avant @param {Map<string, string>} apres
 * @returns {{ reecrits: string[], neufs: string[], disparus: string[] }}
 */
export function comparer(avant, apres) {
  const reecrits = []
  const disparus = []
  for (const [chemin, sha] of avant) {
    if (!apres.has(chemin)) disparus.push(chemin)
    else if (apres.get(chemin) !== sha) reecrits.push(chemin)
  }
  const neufs = [...apres.keys()].filter((chemin) => !avant.has(chemin))
  return {
    reecrits: reecrits.sort(parUnitesDeCode),
    neufs: neufs.sort(parUnitesDeCode),
    disparus: disparus.sort(parUnitesDeCode),
  }
}

/** Au-delà de ce nombre, les chemins d'une famille sont comptés au lieu d'être tous imprimés. */
const CHEMINS_IMPRIMES = 20

/** Les chemins d'une famille, le surplus compté plutôt que déroulé. */
const listerNommement = (chemins) =>
  chemins
    .slice(0, CHEMINS_IMPRIMES)
    .map((c) => `  · ${c}`)
    .concat(chemins.length > CHEMINS_IMPRIMES ? [`  · … et ${chemins.length - CHEMINS_IMPRIMES} autre(s)`] : [])

/**
 * Rapport NOMMÉ d'un écart : `lignes` pour la sortie, `rouges` pour le verdict (une entrée par
 * famille non vide). Un écart vide rend une ligne qui dit ce qui a été mesuré, jamais un silence.
 * @param {{ reecrits: string[], neufs: string[], disparus: string[] }} ecart
 * @param {number} [total] nombre de fichiers confrontés, pour la ligne verte
 * @returns {{ rouges: string[], lignes: string[] }}
 */
export function rapportDEcart({ reecrits, neufs, disparus }, total = null) {
  const rouges = []
  const lignes = []
  if (reecrits.length) {
    lignes.push('DONNÉE RÉÉCRITE par le rejeu — une migration n’est pas idempotente :', ...listerNommement(reecrits))
    rouges.push(`empreinte : ${reecrits.length} donnée(s) RÉÉCRITE(S) par le rejeu (${reecrits.slice(0, 3).join(', ')}…)`)
  }
  if (neufs.length) {
    lignes.push('FICHIER NEUF créé par le rejeu — invisible à `git diff` :', ...listerNommement(neufs))
    rouges.push(`empreinte : ${neufs.length} FICHIER(S) NEUF(S) créé(s) par le rejeu (${neufs.slice(0, 3).join(', ')}…)`)
  }
  if (disparus.length) {
    lignes.push('DOCUMENT DISPARU pendant le rejeu :', ...listerNommement(disparus))
    rouges.push(`empreinte : ${disparus.length} document(s) DISPARU(S) pendant le rejeu (${disparus.slice(0, 3).join(', ')}…)`)
  }
  if (!rouges.length) lignes.push(`empreinte : ${total ?? '?'} fichier(s) du périmètre identiques aux blobs de la tête`)
  return { rouges, lignes }
}
