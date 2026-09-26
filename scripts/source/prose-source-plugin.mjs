// Plugin Vite `wfrp:prose-source` — la prose ADRESSÉE (`descRef`) est MATÉRIALISÉE AU BUILD.
//
// La donnée committée a seulement un porteur de prose : l'adresse. Le module JSON que Vite sert (dev)
// ou bundle (prod) est un DÉRIVÉ : le `transform` y injecte le `desc` que l'adresse résout, avant que
// `vite:json` ne fabrique le module — donc les consommateurs de l'application lisent `entry.desc` comme
// avant, et le navigateur ne résout RIEN sur le chemin joueur. Même classe que `registryGen()`
// (`vite.config.ts`), qui régénère `src/_registry.generated.ts` au `buildStart`.
//
// FAIL-CLOSED : toute adresse qui ne rend pas exactement son texte fait ÉCHOUER le module par
// `this.error` — `vite build` rouge, overlay en dev, import rouge en vitest.
//
// `configureServer` RECHARGE la page quand un chapitre du `Source/` change : `this.addWatchFile` est
// inopérant sur un module `.json` (`vite:import-analysis` saute les `.json`), donc le plugin tient son
// propre index chapitre → modules JSON dépendants, rempli par le `transform`.
//
// UN service de plus, adossé à L'ADRESSE COMME URL, et il ne vit QU'EN DEV : `configureServer` sert
// `/source/<livre>/<NNN>.md` et `/source/manifest.json` depuis le disque, pour l'ÉDITEUR (aperçu d'une
// adresse dans `DescRefField`). Le chemin joueur n'en a aucun besoin — sa prose est déjà matérialisée
// dans le module JSON par le `transform` ci-dessus.
//
// LE BUILD N'ÉMET AUCUN ASSET `source/**` — il n'y a pas de `generateBundle` ici, et c'est le geste,
// pas un oubli : `deploy.yml` pousse `dist/.` sur GitHub Pages, donc un asset émis publierait les
// 16 livres VF (11,0 Mo de texte intégral) sur le web ouvert. Décision fail-closed de #1389
// (2026-09-07) : rien n'est publié tant que la question posée au pilotage #1388 n'est pas tranchée.
// L'éditeur d'adresse est un outil de POSTE DE DÉVELOPPEMENT ; hors dev il ne trouve ni manifeste ni
// chapitre, et `DescRefField` le dit en toutes lettres au lieu d'accuser l'adresse.
// Garde : `src/data/source/prose-source.test.ts` « un build de production n'émet aucun asset `source/**` ».
import { basename } from 'node:path'
import { chapitresDe, lireChapitre, oublierChapitre } from './lecteur-fs.mjs'
import { cheminChapitre, materialiser } from './resoudre.mjs'
import { BOOKS, REGISTRE_LIVRES, estLivreExtrait, readText, sigleDe } from '../raw/_lib.mjs'

/** Documents de catalogue, et eux seuls : `src/data/<nom>.json` à plat (les projets de `src/scenes`
 *  entrent au périmètre quand leur schéma compose la prose adressable). */
const CIBLE = /[\\/]src[\\/]data[\\/][^\\/]+\.json$/
/** Séparateurs POSIX — l'index de dépendance apparie des chemins Windows et des chemins Vite. */
const normalise = (chemin) => String(chemin).split('\\').join('/')

/** Route publique d'un chapitre : `/source/<livre>/<NNN>.md` — la graphie du chapitre, de la
 *  largeur de son livre (`graphieDeChapitre`, `src/data/source/decoupe.ts`). */
const ROUTE = /^\/source\/([a-z0-9-]+)\/(\d+)\.md$/
/** Route publique du manifeste : `/source/manifest.json`. */
const ROUTE_MANIFESTE = '/source/manifest.json'

/** Longueur maximale d'un titre de chapitre au manifeste (au-delà, il ne tient plus dans une liste). */
const TITRE_MAX = 60
/**
 * Un heading dont le titre n'est qu'une ANCRE de conversion Word (`# _GoBack`, `# _gjdgxs`) — reconnu
 * sur sa LIGNE BRUTE, jamais sur le titre nettoyé.
 *
 * C'est la STRUCTURE qui tranche, pas une devinette sur la forme du mot : le souligné de tête survit
 * dans le markdown (`cleanTitle` de `decoupe.ts` le retire, mais la ligne source l'a toujours), et
 * `Section.line` donne le numéro de cette ligne. Une heuristique sur le titre nettoyé écartait 64
 * VRAIS titres du corpus (`nains` LDB 05, 63 horodatages `21h30`…) et faisait dire « Minuit » au
 * chapitre 05 de NADJ au lieu de « 22h00 ».
 */
const LIGNE_ANCRE = /^\s*#+\s*_/

/**
 * Titre AFFICHABLE d'un chapitre : le premier titre de section qui nomme vraiment quelque chose.
 * Nettoyage LOCAL au manifeste — surtout pas dans `cleanTitle` (`decoupe.ts`), dont `slugify` dérive :
 * y toucher déplacerait les slugs de TOUTES les adresses déjà posées.
 * Deux filtres, mesurés sur le corpus : balises HTML résiduelles de l'extraction
 * (`<sup>L</sup><sup>A</sup>…`, rendues littéralement par l'éditeur) et headings-ANCRES, reconnus sur
 * leur ligne brute. Rend `''` si aucun titre ne survit — l'éditeur dit alors « (chapitre sans titre) »,
 * jamais le nom de fichier (qui porte l'ancre lui aussi).
 * @param {{ sections: { title: string, line: number }[] } | null} chapitre
 * @param {string} [texte] markdown BRUT du chapitre — sans lui, le filtre d'ancre ne peut pas jouer.
 * @returns {string}
 */
export function titreDeChapitre(chapitre, texte = '') {
  const lignes = texte.replace(/\r\n?/g, '\n').split('\n')
  for (const s of chapitre?.sections ?? []) {
    if (LIGNE_ANCRE.test(lignes[(s.line ?? 0) - 1] ?? '')) continue
    const propre = String(s.title ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!propre) continue
    return propre.length > TITRE_MAX ? `${propre.slice(0, TITRE_MAX - 1).trimEnd()}…` : propre
  }
  return ''
}

/** Accès au corpus `Source/` sur le DISQUE : le lecteur PARTAGÉ, sa mémoire, ses dossiers et son index. */
const CORPUS_DISQUE = {
  dossiers: () => BOOKS.map(([, dir]) => dir),
  chemin: cheminChapitre,
  lire: lireChapitre,
  oublier: oublierChapitre,
  livres: () => REGISTRE_LIVRES.filter(estLivreExtrait).map((b) => b.id),
  abbr: (bookId) => sigleDe(bookId),
  chapitres: (bookId) => chapitresDe(bookId),
}

/**
 * MANIFESTE des chapitres servis — forme UNIQUE, consommée par le middleware de dev
 * (`/source/manifest.json`), son seul lecteur : c'est en DEV, et là seulement, que le Codex édite une
 * adresse. Les chapitres d'un livre sortent en TABLEAU ORDONNÉ — un objet à clés de
 * chiffres est réordonné par JS (les clés d'index de tableau passent devant, et `'01'` n'en est pas une
 * alors que `'21'` en est une), donc l'ordre d'émission ne survivrait pas au `JSON.parse` du navigateur.
 * L'ordre est celui de `chapitresDe(bookId)`, et `octets` est la taille du texte TEL QUE SERVI (fins de
 * ligne ramenées au LF par `readText`) — d'où la lecture de chaque chapitre.
 * `titre` vient de `titreDeChapitre` (premier titre de section qui nomme vraiment quelque chose,
 * nettoyé) : le nom de fichier de l'extraction porte des ancres Word (`05 - _gjdgxs.md`,
 * `01 - _GoBack.md`) qu'aucun auteur ne reconnaît — c'est le titre qui NOMME le chapitre à l'écran.
 * @param {typeof CORPUS_DISQUE} corpus
 * @returns {Record<string, { abbr: string, chapitres: { ch: string, fichier: string, titre: string, octets: number }[] }>}
 */
export function manifesteDe(corpus) {
  const manifeste = {}
  for (const bookId of corpus.livres()) {
    const chapitres = []
    for (const ch of corpus.chapitres(bookId)) {
      const chemin = corpus.chemin(bookId, ch)
      if (!chemin) continue
      const texte = readText(chemin)
      const titre = titreDeChapitre(corpus.lire(bookId, ch), texte)
      chapitres.push({ ch, fichier: basename(chemin), titre, octets: Buffer.byteLength(texte, 'utf8') })
    }
    manifeste[bookId] = { abbr: corpus.abbr(bookId), chapitres }
  }
  return manifeste
}

/** Texte du manifeste : UNE sérialisation, pour l'unique réponse qui le sert — celle du dev. */
const texteManifeste = (corpus) => JSON.stringify(manifesteDe(corpus), null, 1)

/**
 * @param {{ corpus?: typeof CORPUS_DISQUE }} [options] `corpus` n'est injecté que par les tests du
 *   plugin (fixture hors dépôt) ; la production lit le `Source/` du dépôt.
 */
export function proseSource(options = {}) {
  const corpus = options.corpus ?? CORPUS_DISQUE
  /** chemin de chapitre (POSIX) → `{ book, ch, ids }` : les modules JSON qui en dépendent, et
   *  l'adresse du chapitre — le lecteur mémorise par `livre|chapitre`, chokidar parle en CHEMIN. */
  const dependants = new Map()

  return {
    name: 'wfrp:prose-source',
    enforce: 'pre',

    transform(code, id) {
      const propre = normalise(id)
      const marque = propre.indexOf('?')
      if (!CIBLE.test(marque === -1 ? propre : propre.slice(0, marque))) return null
      // Un id à QUERY demande une AUTRE forme du fichier, et l'id est vu ici (`vite:json` vient après) :
      // `?raw` sert la FORME DISQUE, celle que le schéma décrit et que `dev-validate` valide.
      if (marque !== -1) return null
      let materialise
      try {
        const res = materialiser(JSON.parse(code), {
          lecteur: corpus.lire,
          chemin: corpus.chemin,
          surDependance: (chemin, book, ch) => {
            const clef = normalise(chemin)
            const vu = dependants.get(clef) ?? { book, ch, ids: new Set() }
            vu.ids.add(id)
            dependants.set(clef, vu)
          },
        })
        if (res.materialises === 0) return null
        materialise = res.racine
      } catch (e) {
        this.error(`prose-source : ${propre} → ${e instanceof Error ? e.message : String(e)}`)
        return null
      }
      return { code: JSON.stringify(materialise), map: null }
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const chemin0 = String(req.url ?? '').split('?')[0]
        if (chemin0 === ROUTE_MANIFESTE) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(texteManifeste(corpus))
          return
        }
        const m = ROUTE.exec(chemin0)
        if (!m) return next()
        const chemin = corpus.chemin(m[1], m[2])
        if (!chemin) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(`chapitre-introuvable : ${m[1]} ch.${m[2]}`)
          return
        }
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        res.end(readText(chemin))
      })
      for (const dossier of corpus.dossiers()) server.watcher.add(dossier)
      server.watcher.on('change', (fichier) => {
        const vu = dependants.get(normalise(fichier))
        if (!vu || vu.ids.size === 0) return
        corpus.oublier(vu.book, vu.ch)
        for (const id of vu.ids) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload', path: '*' })
      })
    },
  }
}
