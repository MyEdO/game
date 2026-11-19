// Cliquet décroissant de la dette de doc MANUSCRITE (#903 — toute la documentation est GÉNÉRÉE
// depuis le code, jamais écrite à la main).
//   node --test scripts/corpus/docs/manual-docs-ratchet.test.mjs   (chaîné dans `npm run test:corpus`)
//
// Ce lot ne génère rien : il fige la liste des docs encore manuscrits (`manualDocsStock.mjs`) pour
// qu'un document manuscrit NEUF échoue la CI.
//
// Périmètre — `docs/*.md` À PLAT (hors sous-dossiers, `docs/plans/` et `docs/raw/` compris), même
// frontière que `scripts/docs/check-doc-refs.mjs` (`listerDossier(DOCS_DIR)` non récursif).
// Détection GÉNÉRÉ — l'appartenance à `GENERATORS` (`generateurDe`, scripts/docs/build-all.mjs), jamais
// le disque : une cible de `GENERATORS` est générée par définition, et son texte se lit à son rendu
// sur l'hôte (`renduSurLHote`), jamais sur disque (#2203).
//
// Second volet (#903) — un doc MANUSCRIT qui porte le marqueur `GÉNÉRÉ par` ment : il n'a ni
// script `npm`, ni `--check`, ni place en CI, et dérive sans rien dire. Le marqueur n'est porté
// que par une cible de `GENERATORS`.
//
// Filet des citations des docs PURS (#2203) : chaque `fichier:ligne` qu'un générateur de `GENERATORS`
// rend porte, à ±2 lignes du site SUR LE DISQUE, l'un des identifiants backtiqués de sa ligne.
//
// Rendu sous win32 (#1801, DoD 1) : chaque dérivé de `GENERATORS` rend le MÊME corps sur l'hôte et
// sous win32. L'hôte de développement est Windows, la CI est Linux : un générateur qui bâtit un chemin
// RELATIF par l'API de `node:path` rend un corps qui dépend de la plateforme. La garde compare, par
// générateur, le rendu d'un processus de l'hôte à celui d'un processus rendu sous win32
// (`rendusEnProcessus`) : tous deux jouent le même lot de `LOTS`, et `scripts/docs/lib/plateforme-win32.mjs`
// en `--import` est leur SEULE différence. Sur un hôte win32, la garde ne compare rien de vrai : sans la
// simulation, les deux côtés sont le même rendu natif ; avec elle, les chemins absolus de l'hôte passés à
// `child_process` (exécutable, `cwd`) perdent leur lecteur (`versPosix`), et un lancement à `cwd` échoue
// (`spawnSync /Program Files/nodejs/node.exe ENOENT`). Elle saute sur win32 et mord en CI Linux.
// Le lieu d'un module décide de ce qu'il voit : le dépôt voit win32, `node_modules` voit l'hôte
// (`estModuleDuDepot`, plateforme-win32-hooks.mjs).
//
// Tous ces volets vivent dans ce fichier parce qu'ils lisent le MÊME rendu des générateurs sur l'hôte
// (`rendusParCote`), calculé une fois : deux fichiers de test le paieraient deux fois (#3412).
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { enFileBornee } from '../../guards/lib/fileBornee.mjs'
import { listerDossier } from '../../guards/lib/lister.mjs'
import { MANUAL_DOCS_STOCK } from '../../guards/lib/manualDocsStock.mjs'
import { spawnBorne } from '../../guards/lib/processusBorne.mjs'
import { ecartsDeStock } from '../../guards/lib/stock.mjs'
import { GENERATORS, generateurDe } from '../../docs/build-all.mjs'
import { estUnDocMarkdown } from '../../docs/lib/ecriture-derives.mjs'
import { ecartsDeRendu, fautesDeCitations } from '../../test/lib/bancGenerateurs.mjs'
import { coeurs } from '../../test/partition.mjs'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/** Le module qui rend sous win32, en `--import` ; il se pose AVANT `tsx/esm`. */
const SOUS_WIN32 = ['--import', new URL('../../docs/lib/plateforme-win32.mjs', import.meta.url).href]

const RENDRE_SEUL = fileURLToPath(new URL('../../docs/lib/rendre-seul.mjs', import.meta.url))

const RENDRE_ENSEMBLE = fileURLToPath(new URL('../../docs/lib/rendre-ensemble.mjs', import.meta.url))

const TSX_ESM = pathToFileURL(fileURLToPath(import.meta.resolve('tsx/esm'))).href

const ECHEANCE_MS = 900_000

/** Rendu d'un lot : tous les dérivés de `GENERATORS` tiennent sous cette capture. */
const CAPTURE_MAX = 256 * 1024 * 1024

/** Les lots de rendu, un processus chacun : les générateurs `node` ENSEMBLE (`rendre-ensemble.mjs` : le rendu qu'un
 *  générateur lit d'un autre s'y calcule une fois), et chaque générateur `tsx` seul, lancé comme son runner
 *  (`rendre-seul.mjs` derrière `tsx/esm`). `lire` rend, de la sortie du processus, `[script, [cible, texte][]][]`. */
const LOTS = [
  { nom: 'node', argv: [RENDRE_ENSEMBLE, ...GENERATORS.filter((g) => g.runner !== 'tsx').map((g) => g.script)], lire: (sortie) => JSON.parse(sortie) },
  ...GENERATORS.filter((g) => g.runner === 'tsx').map((g) => ({
    nom: g.script, argv: ['--import', TSX_ESM, RENDRE_SEUL, g.script], lire: (sortie) => [[g.script, JSON.parse(sortie)]],
  })),
]

/** Les rendus du lot `lot` par un processus node que `imports` précharge, arrêté avec `signal` :
 *  `[script, cible → texte][]`. */
async function rendusEnProcessus(lot, imports, dossier, signal) {
  const cote = imports.length ? 'sous win32' : 'sur l’hôte'
  const r = await spawnBorne({
    argv: [...imports, ...lot.argv],
    fichier: join(dossier, `${lot.nom.replaceAll('/', '_')}.${imports.length ? 'win32' : 'hote'}.log`),
    limiteMs: ECHEANCE_MS, cwd: ROOT, env: { ...process.env, WFRP_PLATEFORME_RACINE: ROOT },
    signal, fluxDistincts: true, maxBuffer: CAPTURE_MAX, site: `rendus-des-generateurs/${lot.nom} ${cote}`,
  })
  if (r.code !== 0) throw new Error(`${lot.nom} ${cote} : sortie ${r.code}${r.error ? ` (${r.error.code ?? ''} ${r.error.message})` : ''}\n${r.stderr}`)
  return lot.lire(r.stdout).map(([script, rendu]) => [script, new Map(rendu)])
}

/** L'arrêt des processus de rendu encore en vol à la fin du fichier. */
const ARRET = new AbortController()
after(() => ARRET.abort())

let rendus

/** Les rendus de chaque générateur de `GENERATORS` (`script` → cible → texte), lancés UNE fois : `hote` toujours, et
 *  `win32` hors d'un hôte win32 (`null` sur lui). Les processus se mènent de front par `enFileBornee`, un par cœur
 *  (`coeurs`), lancés par `spawnBorne` (#2586). */
function rendusParCote() {
  rendus ??= (async () => {
    const cotes = process.platform === 'win32' ? [[]] : [[], SOUS_WIN32]
    const dossier = mkdtempSync(join(tmpdir(), 'rendus-des-generateurs-'))
    try {
      const parTache = await enFileBornee(
        LOTS.flatMap((lot) => cotes.map((imports) => (signal) => rendusEnProcessus(lot, imports, dossier, signal))),
        { deFront: coeurs(process.env, availableParallelism), signal: ARRET.signal },
      )
      const [hote, win32 = null] = cotes.map((_, i) => new Map(parTache.filter((_, j) => j % cotes.length === i).flat()))
      return { hote, win32 }
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  })()
  return rendus
}

/** Le rendu du générateur `g` sur l'hôte : cible → texte. */
const renduSurLHote = async (g) => (await rendusParCote()).hote.get(g.script)

const DOCS_DIR = join(ROOT, 'docs')

/** Les `.md` À PLAT présents dans `docs/`, en ordre total. */
const DOCS_MD = listerDossier(DOCS_DIR).filter((f) => f.endsWith('.md'))

/** Les cibles de `GENERATORS` qui sont des `.md` À PLAT de `docs/`. */
const GENERES_A_PLAT = GENERATORS.flatMap((g) => g.targets).filter((t) => /^docs\/[^/]+\.md$/.test(t))

const GENERATED_MARKER = /^>\s*(?:⚠️\s*)?(?:Fichier\s+)?GÉNÉRÉ par\b/m

function isGenerated(text) {
  const head = text.split('\n').slice(0, 10).join('\n')
  return GENERATED_MARKER.test(head)
}

/** Un `.md` à plat de `docs/` est GÉNÉRÉ quand un générateur de `GENERATORS` l'écrit. */
const estGenere = (f) => generateurDe(`docs/${f}`) !== undefined

function manualDocs() {
  return DOCS_MD.filter((f) => !estGenere(f)).map((f) => `docs/${f}`)
}

/** Texte d'un `docs/<fichier>.md` : son RENDU s'il est généré, le disque s'il est manuscrit, `null` absent. LÈVE sur
 *  une cible que son générateur ne rend pas. */
async function texteDuDoc(doc) {
  const g = generateurDe(doc)
  if (g !== undefined) {
    const texte = (await renduSurLHote(g)).get(doc)
    if (texte === undefined) throw new Error(`${g.script} ne rend pas ${doc}`)
    return texte
  }
  const chemin = join(ROOT, doc)
  return existsSync(chemin) ? readFileSync(chemin, 'utf8') : null
}

/**
 * Plafond du stock cliqueté. Il vit ICI, dans le test, et NON dans `manualDocsStock.mjs` — sans
 * lui, « le stock ne peut que décroître » n'est qu'un commentaire, et le chemin le plus court
 * pour « solder » un doc manuscrit neuf est d'ajouter une ligne au stock, CI verte. Toute
 * hausse de ce chiffre modifie CE fichier de test, jamais `manualDocsStock.mjs` seul. Il ne
 * DESCEND qu'en soldant des docs (génération ou suppression), jamais en ajoutant une entrée.
 */
const MANUAL_DOCS_MAX = 8

const ecarts = ecartsDeStock({
  observe: manualDocs(),
  stock: MANUAL_DOCS_STOCK,
  cle: (d) => d,
  remede: {
    neuve: (d) => `${d} est manuscrit et absent du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock manuel`,
    perimee: (d) => `retirer "${d}" du stock — il est désormais GÉNÉRÉ (ou n'existe plus)`,
  },
})

test('aucun doc manuscrit NEUF hors du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock', () => {
  assert.deepEqual(ecarts.neuves, [])
})

test('le stock cliqueté ne peut que DÉCROÎTRE — aucune entrée désormais GÉNÉRÉE n’y traîne', () => {
  assert.deepEqual(ecarts.perimees, [])
})

test('le stock cliqueté ne GROSSIT pas — sa taille est plafonnée par le test', () => {
  assert.ok(
    ecarts.taille <= MANUAL_DOCS_MAX,
    `stock de ${ecarts.taille} docs manuscrits pour un plafond de ${MANUAL_DOCS_MAX}`,
  )
})

test('aucun doc MANUSCRIT ne se déclare `GÉNÉRÉ par` — le marqueur n’est porté que par une cible de GENERATORS', () => {
  const violations = DOCS_MD.filter((f) => !estGenere(f) && isGenerated(readFileSync(join(DOCS_DIR, f), 'utf8'))).map(
    (f) =>
      `docs/${f} se déclare GÉNÉRÉ sans être une cible de GENERATORS dans scripts/docs/build-all.mjs, la source unique que docs:check vérifie : le marqueur pourrit en silence, non gardé par la CI`,
  )
  assert.deepEqual(violations, [])
})

/**
 * Motif d'extraction du générateur cité en en-tête. Les formes mesurées dans le dépôt divergent
 * (« GÉNÉRÉ par `node scripts/docs/build-systemes.mjs` » vs « GÉNÉRÉ par `npx tsx
 * scripts/gen-sorts-doc.mts` ») : le motif capture tout le contenu entre backticks après
 * « GÉNÉRÉ par », puis retient le PREMIER token qui ressemble à un chemin de script exécutable
 * (`.mjs`/`.mts`/`.cjs`/`.ts`/`.js`) — insensible au lanceur (`node`, `npx tsx`…) qui le précède.
 */
const GENERATOR_QUOTE = /GÉNÉRÉ par\s+`([^`]+)`/

function extractGeneratorScript(head) {
  const m = head.match(GENERATOR_QUOTE)
  if (!m) return null
  return m[1].split(/\s+/).find((t) => /\.(?:mjs|mts|cjs|ts|js)$/.test(t)) ?? null
}

test('tout doc GÉNÉRÉ qui porte le marqueur `GÉNÉRÉ par` y cite SON générateur de GENERATORS', async () => {
  const violations = []
  for (const doc of GENERES_A_PLAT) {
    const head = (await texteDuDoc(doc)).split('\n').slice(0, 10).join('\n')
    if (!isGenerated(head)) continue
    const cite = extractGeneratorScript(head)
    const script = generateurDe(doc).script
    if (cite !== script)
      violations.push(`${doc} se déclare GÉNÉRÉ par "${cite ?? '(aucun script)'}" — son générateur dans GENERATORS est "${script}" : le marqueur ment sur qui le régénère`)
  }
  assert.deepEqual(violations, [])
})

test('tout générateur de GENERATORS existe sur disque', () => {
  assert.deepEqual(GENERATORS.map((g) => g.script).filter((script) => !existsSync(join(ROOT, script))), [])
})

/**
 * Troisième volet (#908) — le marqueur `GÉNÉRÉ` engage son générateur (#903 suite), mais un
 * générateur qui ne déclare pas son PÉRIMÈTRE MESURÉ se lit comme exhaustif alors qu'aucune mesure
 * ne l'est. La section s'émet DEPUIS le générateur (jamais à la main dans le `.md`, sinon elle
 * périme comme le reste) — patron : le bloc **Périmètre mesuré / angles morts** de
 * `docs/vocabulaire-mecanique.md`.
 */
// Deux phrases co-présentes, PAS un mot isolé (piège de mesure consigné dans #908 : « périmètre »
// seul donne des faux positifs — `systemes.md` « nom/périmètre/état/ticket », une ligne de tableau
// de `sorts-implementation.md`). La forme du rendu diverge selon le générateur (bloc `**gras**` sur
// une ligne, titre `## Périmètre mesuré et angles morts`, ou blockquote `> ` multi-lignes) — le texte
// est donc normalisé (continuations de blockquote et retours à la ligne aplatis) avant le test.
function hasPerimeterSection(text) {
  const normalized = text.replace(/\n>?\s*/g, ' ')
  return /P[ée]rim[èe]tre\s+mesur[ée]s?/i.test(normalized) && /angles?\s+morts?/i.test(normalized)
}

test('section « Périmètre mesuré / angles morts » présente dans chaque doc GÉNÉRÉ (#908)', async () => {
  assert.ok(GENERES_A_PLAT.length > 0, 'GENERATORS ne porte aucun doc à plat — la garde serait verte à vide')
  const violations = []
  for (const doc of GENERES_A_PLAT) if (!hasPerimeterSection(await texteDuDoc(doc))) violations.push(doc)
  assert.deepEqual(
    violations.map(
      (doc) =>
        `${doc} se déclare GÉNÉRÉ sans section « Périmètre mesuré / angles morts » — un généré qui ne dit pas ce qu'il ne couvre PAS se lit comme exhaustif ; la section s'émet depuis le générateur (patron : le bloc « Périmètre mesuré / angles morts » de docs/vocabulaire-mecanique.md)`,
    ),
    [],
  )
})

/**
 * Garde symétrique du cliquet manuscrit ci-dessus — SANS stock. La table de routage d’`AGENTS.md`
 * (§ « Table de routage — lire le bon doc AU MOMENT du déclencheur ») est la SEULE surface injectée
 * chez tout agent de ce dépôt : un doc qu'elle ne mentionne pas — ni directement, ni via un
 * document lui-même routé — est invisible, quelle que soit sa qualité. Cette garde n'a PAS de stock
 * cliqueté : tout doc non routé la fait échouer, sans marge — une liste d'exceptions « qui décroît »
 * se maintient à jamais et se contourne
 * (`.claude/memory/user-doctrine-garde-exemption-au-site-forme-et-catalogue.md`).
 *
 * « Routé » = atteint depuis la table par une clôture transitive de citations `docs/<fichier>.md`
 * (motif explicite, chemin depuis la racine du dépôt) : la table cite directement des docs, et tout
 * doc ainsi routé qui cite à son tour un `docs/<fichier>.md` route ce doc-là aussi. Angle mort
 * déclaré : un lien markdown relatif SANS le préfixe `docs/` (`[x](donnees.md)` depuis un autre
 * fichier de `docs/`) échapperait à ce motif — mesuré absent aujourd'hui pour les docs à plat
 * (seuls `docs/raw/` et `docs/plans/` en usent, entre fichiers de leur propre sous-dossier, hors du
 * périmètre à plat de ce fichier).
 */
const AGENTS_MD_PATH = join(ROOT, 'AGENTS.md')

const DOC_CITATION = /docs\/[a-zA-Z0-9_.-]+\.md/g

function routingTableSlice(agentsMd) {
  const start = agentsMd.indexOf('## Table de routage')
  if (start === -1) {
    throw new Error('AGENTS.md ne porte plus de section "## Table de routage" — garde à réancrer')
  }
  const afterStart = agentsMd.slice(start + 1)
  const nextHeading = afterStart.indexOf('\n## ')
  const end = nextHeading === -1 ? agentsMd.length : start + 1 + nextHeading
  return agentsMd.slice(start, end)
}

async function routedFlatDocs() {
  const agentsMd = readFileSync(AGENTS_MD_PATH, 'utf8')
  const routed = new Set()
  const queue = []
  for (const m of routingTableSlice(agentsMd).matchAll(DOC_CITATION)) {
    if (!routed.has(m[0])) {
      routed.add(m[0])
      queue.push(m[0])
    }
  }
  while (queue.length > 0) {
    const text = await texteDuDoc(queue.shift())
    if (text === null) continue
    for (const m of text.matchAll(DOC_CITATION)) {
      if (!routed.has(m[0])) {
        routed.add(m[0])
        queue.push(m[0])
      }
    }
  }
  return routed
}

const flatDocPaths = () => [...new Set([...manualDocs(), ...GENERES_A_PLAT])].sort()

test('aucun doc à plat non atteignable depuis la table de routage d’AGENTS.md (directement ou via un doc routé)', async () => {
  const routed = await routedFlatDocs()
  const unrouted = flatDocPaths().filter((d) => !routed.has(d))
  assert.deepEqual(
    unrouted.map(
      (d) =>
        `${d} n'est atteignable depuis aucun déclencheur de la table de routage d’AGENTS.md (ni directement, ni via un doc lui-même routé) — ajouter une ligne à la table (question qu'un agent se pose, sur le modèle des lignes existantes), ou citer ce doc depuis un doc déjà routé`,
    ),
    [],
  )
})

const lireDuDisque = (chemin) => {
  try { return readFileSync(join(ROOT, chemin), 'utf8') } catch { return null }
}

test('chaque doc RENDU par `GENERATORS` cite des sites qui portent leur symbole (±2 lignes)', async () => {
  const fautes = []
  let docs = 0
  for (const g of GENERATORS.filter((x) => x.targets.some(estUnDocMarkdown))) {
    for (const [cible, texte] of await renduSurLHote(g)) {
      if (!estUnDocMarkdown(cible)) continue
      docs++
      fautes.push(...fautesDeCitations(cible, texte, lireDuDisque))
    }
  }
  assert.ok(docs > 20, `${docs} doc(s) rendu(s) : le balayage est aveugle`)
  assert.deepEqual(fautes, [])
})

test('chaque générateur de `GENERATORS` rend le MÊME corps sur l’hôte et sous win32', {
  skip: process.platform === 'win32' && 'hôte win32 : sans la simulation, les deux côtés sont le même rendu natif ; avec elle, un lancement à `cwd` échoue (ENOENT) — la garde mord en CI Linux',
}, async () => {
  const { hote, win32 } = await rendusParCote()
  assert.deepEqual(GENERATORS.flatMap((g) => ecartsDeRendu(g.script, hote.get(g.script), win32.get(g.script))), [])
})
