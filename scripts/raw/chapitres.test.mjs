// INTÉGRITÉ du registre de chapitres de l'Atlas (`scripts/raw/chapitres.json`, #1825 lot E) : un
// numéro de chapitre est une PROMESSE sur le disque, et un `book` une PROMESSE sur le registre des
// livres — deux choses qu'un schéma ne peut pas tenir (zod ne voit ni `Source/` ni l'autre fichier).
// La garde vit donc ICI, où vit le résolveur de fichier-chapitre (`_lib.mjs#chapterFile`), et tourne
// sous `npm run test:raw` — la lane qui porte déjà toutes les gardes Atlas à accès disque.
// Le CONTRAT : tout `book` est l'id d'un livre COUVERT par l'Atlas (porteur d'un `dir`) ; tout `ch`
// résout un fichier ; tout `catalogue` est produit par `build-catalogs.mjs` ; aucun motif ne porte
// de réf citable ; aucun doublon ; et l'ORDRE du fichier est celui du rendu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chapterFile, estLivreExtrait, refRe, REGISTRE_CHAPITRES, REGISTRE_LIVRES } from './_lib.mjs'
import { idsDeCatalogue } from './build-catalogs.mjs'

const { horsRegle, enCatalogue } = REGISTRE_CHAPITRES
const TOUTES = [
  ...horsRegle.map((e) => ({ ...e, ou: 'horsRegle' })),
  ...enCatalogue.map((e) => ({ ...e, ou: `enCatalogue (${e.catalogue})` })),
]
/** Les livres COUVERTS par l'Atlas : ceux dont le `dir` porte des chapitres sur disque. */
const LIVRES_COUVERTS = new Map(REGISTRE_LIVRES.filter(estLivreExtrait).map((b) => [b.id, b]))

test('#1825 : tout `book` est l’id d’un livre du registre COUVERT par l’Atlas (porteur d’un `dir`)', () => {
  const inconnus = TOUTES.filter((e) => !LIVRES_COUVERTS.has(e.book)).map((e) => `${e.book} ${e.ch} (${e.ou})`)
  assert.deepEqual(
    inconnus,
    [],
    'un `book` est l’`id` STABLE d’un livre de `src/data/books.json`, jamais son sigle, et un livre ' +
      `sans \`dir\` n’a pas de chapitre sur disque à désigner :\n${inconnus.join('\n')}`,
  )
})

test('#1825 : tout `ch` résout un fichier-chapitre sous le `dir` de son livre', () => {
  const morts = []
  for (const e of TOUTES) {
    const livre = LIVRES_COUVERTS.get(e.book)
    if (!livre) continue
    if (!chapterFile(livre.abbr, e.ch)) morts.push(`${livre.abbr} ${e.ch} (${e.ou}) — aucun fichier-chapitre n°${e.ch} sous ${livre.dir}`)
  }
  assert.deepEqual(morts, [], `des chapitres déclarés ne résolvent AUCUN fichier :\n${morts.join('\n')}`)
})

// JEU DE CLÉS FERMÉ. Sans lui, une faute de frappe est SILENCIEUSE : `de` au lieu de `from` sur la
// seule entrée à plage la ferait transcrire le chapitre ENTIER dans son catalogue, et aucune autre
// garde ne bouge (le déplié `{ book, catalogue, ...spec }` de `_lib.mjs#cataloguesDe` passe la clé
// inconnue telle quelle à `chapterFile`, qui la voit comme « aucune plage »). Un schéma zod ne peut
// pas tenir ce fichier (il est hors `src/data`) : le contrat vit ici, et il est EXACT — toute clé
// hors de la liste rougit, et `to`/`title` n'ont de sens qu'avec le `from` qui ouvre la plage.
const CLES = { horsRegle: { obligatoires: ['book', 'ch', 'motif'], facultatives: [] }, enCatalogue: { obligatoires: ['book', 'ch', 'catalogue'], facultatives: ['from', 'to', 'title'] } }

test('#1825 : chaque entrée porte EXACTEMENT son jeu de clés — une clé inconnue est une faute muette', () => {
  const fautes = []
  for (const [nom, liste] of [['horsRegle', horsRegle], ['enCatalogue', enCatalogue]]) {
    const { obligatoires, facultatives } = CLES[nom]
    const admises = new Set([...obligatoires, ...facultatives])
    for (const e of liste) {
      const cles = Object.keys(e)
      const ou = `${nom} ${e.book} ${e.ch}`
      for (const k of cles) if (!admises.has(k)) fautes.push(`${ou} — clé INCONNUE \`${k}\``)
      for (const k of obligatoires) if (!(k in e)) fautes.push(`${ou} — clé MANQUANTE \`${k}\``)
      if (!Number.isInteger(e.ch) || e.ch <= 0) fautes.push(`${ou} — \`ch\` doit être un entier positif, pas ${JSON.stringify(e.ch)}`)
      for (const k of cles) if (k !== 'ch' && (typeof e[k] !== 'string' || !e[k].trim())) fautes.push(`${ou} — \`${k}\` doit être une chaîne non vide`)
      if ((e.to || e.title) && !e.from) fautes.push(`${ou} — \`to\`/\`title\` sans \`from\` : la plage n'a pas d'ouverture, le chapitre ENTIER serait transcrit`)
    }
  }
  assert.deepEqual(fautes, [], `jeu de clés violé :\n${fautes.join('\n')}`)
})

test('#1825 : tout motif est une phrase, jamais un vide qui rendrait l’exclusion muette', () => {
  const muets = horsRegle.filter((e) => typeof e.motif !== 'string' || !e.motif.trim()).map((e) => `${e.book} ${e.ch}`)
  assert.deepEqual(muets, [], 'le motif d’exclusion est de la DONNÉE : un chapitre hors-règle dit POURQUOI')
})

// Un motif est NOTRE prose éditoriale sur la classification, pas de la prose de livre : il se
// reformule librement. Une réf citable `<ABRÉV> NN l.X` posée LÀ serait une citation que RIEN ne
// vérifie : aucun scanner de réfs ne lit ce fichier — `reconcile.mjs` et `check-code-refs.mjs`
// scannent les citants de `src/**` (`scripts/raw/lib/fichiersCitants.mjs`), `check-refs.mjs` les `.md`
// de `docs/raw/`. Elle pourrirait donc en silence au premier réancrage. Un motif renvoie au CHAPITRE
// (« ch.8 »), jamais à la ligne.
test('#1825 : aucun motif ne porte de réf citable — ce serait une citation que rien ne vérifie', () => {
  const citants = horsRegle.flatMap((e) => [...String(e.motif).matchAll(refRe())].map((m) => `${e.book} ${e.ch} — « ${m[0]} »`))
  assert.deepEqual(
    citants,
    [],
    'un motif est de la prose ÉDITORIALE : renvoyer au chapitre (« ch.8 »), jamais une réf ' +
      `\`ABRÉV NN l.X\` — aucun scanner ne lit ce fichier, la réf y pourrirait sans bruit :\n${citants.join('\n')}`,
  )
})

test('#1825 : tout `catalogue` est l’un de ceux que `build-catalogs.mjs` produit', () => {
  const connus = new Set(idsDeCatalogue())
  const orphelins = enCatalogue.filter((e) => !connus.has(e.catalogue)).map((e) => `${e.book} ${e.ch} → ${e.catalogue}`)
  assert.deepEqual(orphelins, [], `un catalogue inconnu n’écrit nulle part : ${orphelins.join(', ')}`)
})

test('#1825 : chaque catalogue produit reçoit au moins un chapitre — aucun fichier vide', () => {
  const vides = idsDeCatalogue().filter((id) => !enCatalogue.some((e) => e.catalogue === id))
  assert.deepEqual(vides, [], 'un catalogue que plus aucun livre n’alimente s’écrirait VIDE, écrasant le committé')
})

test('#1825 : aucun doublon — (book, ch) en `horsRegle`, (book, ch, catalogue) en `enCatalogue`', () => {
  const doublons = (liste, cle) => {
    const vus = new Set(), dupes = []
    for (const e of liste) { const k = cle(e); if (vus.has(k)) dupes.push(k); else vus.add(k) }
    return dupes
  }
  assert.deepEqual(doublons(horsRegle, (e) => `${e.book} ${e.ch}`), [], 'un chapitre n’a qu’UN motif d’exclusion')
  assert.deepEqual(doublons(enCatalogue, (e) => `${e.book} ${e.ch} ${e.catalogue}`), [], 'un chapitre n’entre qu’UNE fois dans un catalogue donné')
})

// L'ORDRE du fichier EST celui du rendu (`_lib.mjs#cataloguesDe` ne trie pas) : les blocs d'un
// catalogue sortent dans l'ordre du registre des livres, puis du numéro de chapitre. Le tenir ICI
// plutôt qu'à la lecture garde le fichier lisible et la sortie stable par la MÊME règle.
test('#1825 : les deux listes suivent l’ordre du registre des livres, puis le numéro de chapitre', () => {
  const rang = new Map(REGISTRE_LIVRES.map((b, i) => [b.id, i]))
  for (const [nom, liste] of [['horsRegle', horsRegle], ['enCatalogue', enCatalogue]]) {
    const cles = liste.map((e) => [rang.get(e.book) ?? Infinity, e.ch])
    const trie = [...cles].sort((a, b) => a[0] - b[0] || a[1] - b[1])
    assert.deepEqual(cles, trie, `${nom} : l’ordre du fichier doit être « ordre du registre, puis chapitre »`)
  }
})
