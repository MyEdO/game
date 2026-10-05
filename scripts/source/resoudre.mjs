// Résolveur de PROSE d'une entrée de donnée : `desc` en clair, ou `descRef` qui ADRESSE le `Source/`.
// FAIL-CLOSED — c'est le résolveur des gardes et des migrations : toute adresse qui ne rend pas
// exactement son texte (section disparue, bornes bougées, empreinte divergente…) LÈVE, jamais un
// texte approchant ni un silence. `desc` et `descRef` sont EXCLUSIFS : les deux ensemble = adresse
// et copie en concurrence, donc levée.
import { resoudreAdresse } from '../../src/data/source/decoupe.ts'
import { lireChapitre } from './lecteur-fs.mjs'
import { chapterFile, sigleDe } from '../raw/_lib.mjs'

/**
 * Prose d'une entrée.
 * @param {{ desc?: unknown, descRef?: { book: string, ch: string, parts: object[] } }} entree
 * @param {(bookId: string, ch: string) => object|null} lecteur
 * @param {string} [ou] chemin JSON du nœud dans son document (`narratif.presetsPnj[3].profil`), qui
 *   NOMME le nœud dans l'erreur, suivi de son `id` ou de son `label` s'il en porte un.
 * @returns {{ etat: 'inline', md: string } | { etat: 'resolue', md: string, folios: number[] }
 *           | { etat: 'absente' }}
 */
export function resoudreProse(entree, lecteur = lireChapitre, ou) {
  const ref = entree?.descRef
  if (typeof entree?.desc === 'string' && ref) {
    const nom = entree.id ?? entree.label
    throw new Error(`desc-et-descRef : ${ou ? `${ou}${nom ? ` (${nom})` : ''}` : nom ?? '(sans id)'}`)
  }
  if (typeof entree?.desc === 'string') return { etat: 'inline', md: entree.desc }
  if (!ref) return { etat: 'absente' }
  const chapitre = lecteur(ref.book, ref.ch)
  if (!chapitre) throw new Error(`chapitre-introuvable : ${ref.book} ch.${ref.ch}`)
  const res = resoudreAdresse(chapitre, ref)
  if (res.error) throw new Error(`${res.error} : ${res.detail}`)
  return { etat: 'resolue', md: res.md, folios: res.folios }
}

/**
 * Chemin du fichier de chapitre d'un livre, ou `null` — l'adresse d'un `descRef` ramenée au disque.
 * RELATIF à la racine du dépôt, tel que `chapterFile` le compose depuis le `dir` de `books.json`
 * — `path.join`, donc au SÉPARATEUR DE LA PLATEFORME :
 * `Source/Warhammer v4 - Livre de base version corrigee/21 - Psychologie.md` sous POSIX, le même
 * chemin à l'antislash sous Windows. C'est cette forme que chokidar rend, et c'est elle
 * qui sert de clé à l'index de dépendance du plugin Vite. `fichierChapitre` (`lecteur-fs.mjs`) ne rend
 * que le NOM du fichier.
 * @param {string} bookId @param {string|number} ch @returns {string|null}
 */
export function cheminChapitre(bookId, ch) {
  const abbr = sigleDe(bookId)
  return (abbr ? chapterFile(abbr, ch) : null)?.path ?? null
}

/**
 * MATÉRIALISE la prose adressée d'une racine de document : copie PROFONDE où chaque nœud portant
 * `descRef` reçoit le `desc` que son adresse résout (le `descRef` reste — c'est lui la source).
 * Pendant Node du `transform` du plugin Vite : UNE définition de « matérialiser », consommée par le
 * plugin ET par les scripts.
 *
 * Invariant « HORS VITE = FORME DISQUE » : un script Node lit la donnée du disque, où une entrée
 * ADRESSÉE n'a pas de `desc`. Tout consommateur Node de prose passe donc par ici (ou par
 * `resoudreProse`) au moment où la famille qu'il lit est migrée — ils sont inventoriés par
 * `scripts/source/inventaire-consommateurs-prose.mjs`.
 *
 * FAIL-CLOSED par `resoudreProse` : une adresse morte ou une empreinte divergente LÈVE.
 * Déterministe : même entrée, même `JSON.stringify`.
 *
 * @param {unknown} racine
 * @param {{ lecteur?: (bookId: string, ch: string) => object|null,
 *           chemin?: (bookId: string, ch: string) => string|null,
 *           surDependance?: (cheminChapitre: string, book: string, ch: string) => void }} [options]
 *   `surDependance` reçoit le chemin et l'adresse de chaque chapitre LU (index de rechargement du
 *   serveur de dev, qui apparie un chemin rendu par chokidar à un couple livre/chapitre).
 * @returns {{ racine: unknown, materialises: number }}
 */
export function materialiser(racine, options = {}) {
  const { lecteur = lireChapitre, chemin = cheminChapitre, surDependance } = options
  let materialises = 0
  const copie = (v, ou = '') => {
    if (Array.isArray(v)) return v.map((x, i) => copie(x, `${ou}[${i}]`))
    if (!v || typeof v !== 'object') return v
    const source = v
    const out = {}
    for (const [k, x] of Object.entries(source)) {
      // Le `desc` d'un nœud ADRESSÉ est celui de l'adresse, quoi que porte la donnée à cette clé —
      // symétrique de `versDisque` (`schemas/grammaire/prose.ts`). `resoudreProse` refuse déjà la
      // paire `desc` (chaîne) + `descRef` ; sans ce saut, une valeur d'un AUTRE type à cette clé
      // écraserait en silence la prose matérialisée quand elle suit `descRef`.
      if (k === 'desc' && source.descRef !== undefined) continue
      if (k === 'descRef' && source.descRef !== undefined) {
        out.desc = resoudreProse(source, lecteur, ou || '(racine)').md
        materialises += 1
        const ref = source.descRef
        const fichier = surDependance ? chemin(ref?.book, ref?.ch) : null
        if (fichier) surDependance(fichier, ref?.book, ref?.ch)
      }
      out[k] = copie(x, ou ? `${ou}.${k}` : k)
    }
    return out
  }
  return { racine: copie(racine), materialises }
}
