// Cliquet décroissant de la dette de doc MANUSCRITE (#903 — toute la documentation est GÉNÉRÉE
// depuis le code, jamais écrite à la main).
//   node --test scripts/docs/manual-docs-ratchet.test.mjs   (chaîné dans `npm run test:docs`)
//
// Ce lot ne génère rien : il fige la liste des docs encore manuscrits (`manualDocsStock.mjs`) pour
// qu'un document manuscrit NEUF échoue la CI.
//
// Périmètre — `docs/*.md` À PLAT (hors sous-dossiers, `docs/plans/` et `docs/raw/` compris), même
// frontière que `scripts/docs/check-doc-refs.mjs` (`listerDossier(DOCS_DIR)` non récursif).
// Détection GÉNÉRÉ — marqueur `GÉNÉRÉ par` en tête de ligne dans les 10 premières lignes du doc ;
// les deux formes mesurées dans le dépôt sont couvertes : « ⚠️ Fichier GÉNÉRÉ par … » et
// « GÉNÉRÉ par `npx tsx …` ».
//
// Second volet (#903 suite) — le marqueur ne suffit pas à qualifier un doc de « généré » : rien ne
// vérifiait que le script cité existe ni qu'il est une ligne de `GENERATORS`. C'est exactement le
// trou par lequel `docs/sorts-implementation.md` a pourri (en-tête GÉNÉRÉ, aucun script `npm`,
// aucun `--check`, absent de la CI — 160 sorts d'écart mesurés avant correction). Ce fichier
// verrouille que le marqueur ENGAGE réellement son générateur.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../guards/lib/lister.mjs'
import { MANUAL_DOCS_STOCK } from '../guards/lib/manualDocsStock.mjs'
import { ecartsDeStock } from '../guards/lib/stock.mjs'
import { GENERATORS } from './build-all.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const DOCS_DIR = join(ROOT, 'docs')
/** Les `.md` À PLAT de `docs/`, en ordre total — UN listage pour les quatre volets qui le lisent. */
const DOCS_MD = listerDossier(DOCS_DIR).filter((f) => f.endsWith('.md'))

const GENERATED_MARKER = /^>\s*(?:⚠️\s*)?(?:Fichier\s+)?GÉNÉRÉ par\b/m

function isGenerated(text) {
  const head = text.split('\n').slice(0, 10).join('\n')
  return GENERATED_MARKER.test(head)
}

function manualDocs() {
  return DOCS_MD.filter((f) => !isGenerated(readFileSync(join(DOCS_DIR, f), 'utf8'))).map((f) => `docs/${f}`)
}

/**
 * Plafond du stock cliqueté. Il vit ICI, dans le test, et NON dans `manualDocsStock.mjs` — sans
 * lui, « le stock ne peut que décroître » n'était qu'un commentaire, et le chemin le plus court
 * pour « solder » un doc manuscrit neuf restait d'ajouter une ligne au stock, CI verte. Toute
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
  const token = m[1].split(/\s+/).find((t) => /\.(?:mjs|mts|cjs|ts|js)$/.test(t))
  return token ?? null
}

function generatedDocs() {
  return DOCS_MD.map((f) => ({ file: f, text: readFileSync(join(DOCS_DIR, f), 'utf8') }))
    .filter(({ text }) => isGenerated(text))
    .map(({ file, text }) => ({ file, head: text.split('\n').slice(0, 10).join('\n') }))
}

// Source UNIQUE des dérivés vérifiés : `GENERATORS`, que `build-all.mjs --check` rejoue un à un.
const CHECKED = new Set(GENERATORS.map((g) => g.script))

test('tout doc `GÉNÉRÉ par` cite un script qui existe et qui est une ligne de GENERATORS', () => {
  const violations = generatedDocs().flatMap(({ file, head }) => {
    const script = extractGeneratorScript(head)
    if (!script) {
      return [
        `docs/${file} se déclare GÉNÉRÉ sans citer de script exécutable en en-tête — un marqueur sans générateur pourrit en silence (précédent : docs/sorts-implementation.md, 160 sorts d'écart avant correction)`,
      ]
    }
    const violationsForDoc = []
    if (!existsSync(join(ROOT, script))) {
      violationsForDoc.push(
        `docs/${file} se déclare GÉNÉRÉ par "${script}" — ce script n'existe pas sur disque : le marqueur pourrit en silence`,
      )
    }
    if (!CHECKED.has(script)) {
      violationsForDoc.push(
        `docs/${file} se déclare GÉNÉRÉ par "${script}" — absent de GENERATORS dans scripts/docs/build-all.mjs, la source unique que docs:check vérifie : le marqueur pourrit en silence, non gardé par la CI`,
      )
    }
    return violationsForDoc
  })
  assert.deepEqual(violations, [])
})

/**
 * Troisième volet (#908) — le marqueur `GÉNÉRÉ` engage son générateur (#903 suite), mais un
 * générateur qui ne déclare pas son PÉRIMÈTRE MESURÉ se lit comme exhaustif alors qu'aucune mesure
 * ne l'est. La section s'émet DEPUIS le générateur (jamais à la main dans le `.md`, sinon elle
 * périme comme le reste) — patron : `docs/vocabulaire-mecanique.md:33-36`.
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

function fullGeneratedDocs() {
  return DOCS_MD.map((f) => ({ file: f, text: readFileSync(join(DOCS_DIR, f), 'utf8') })).filter(({ text }) =>
    isGenerated(text),
  )
}

test('section « Périmètre mesuré / angles morts » présente dans chaque doc GÉNÉRÉ (#908)', () => {
  const violations = fullGeneratedDocs()
    .filter(({ text }) => !hasPerimeterSection(text))
    .map(
      ({ file }) =>
        `docs/${file} se déclare GÉNÉRÉ sans section « Périmètre mesuré / angles morts » — un généré qui ne dit pas ce qu'il ne couvre PAS se lit comme exhaustif ; la section s'émet depuis le générateur (patron : docs/vocabulaire-mecanique.md:33-36)`,
    )
  assert.deepEqual(violations, [])
})

/**
 * Garde symétrique du cliquet manuscrit ci-dessus — SANS stock. La table de routage de `CLAUDE.md`
 * (§ « Table de routage — lire le bon doc AU MOMENT du déclencheur ») est la SEULE surface injectée
 * chez tout agent de ce dépôt : un doc qu'elle ne mentionne pas — ni directement, ni via un
 * document lui-même routé — est invisible, quelle que soit sa qualité. Cette garde n'a PAS de stock
 * cliqueté : tout doc non routé la fait échouer, sans marge — une liste d'exceptions « qui décroît »
 * se maintient à jamais et se contourne
 * (`.claude/memory/game-garde-exemption-au-site-jamais-au-fichier.md`).
 *
 * « Routé » = atteint depuis la table par une clôture transitive de citations `docs/<fichier>.md`
 * (motif explicite, chemin depuis la racine du dépôt) : la table cite directement des docs, et tout
 * doc ainsi routé qui cite à son tour un `docs/<fichier>.md` route ce doc-là aussi. Angle mort
 * déclaré : un lien markdown relatif SANS le préfixe `docs/` (`[x](donnees.md)` depuis un autre
 * fichier de `docs/`) échapperait à ce motif — mesuré absent aujourd'hui pour les docs à plat
 * (seuls `docs/raw/` et `docs/plans/` en usent, entre fichiers de leur propre sous-dossier, hors du
 * périmètre à plat de ce fichier).
 */
const CLAUDE_MD_PATH = join(ROOT, 'CLAUDE.md')
const DOC_CITATION = /docs\/[a-zA-Z0-9_.-]+\.md/g

function routingTableSlice(claudeMd) {
  const start = claudeMd.indexOf('## Table de routage')
  if (start === -1) {
    throw new Error('CLAUDE.md ne porte plus de section "## Table de routage" — garde à réancrer')
  }
  const afterStart = claudeMd.slice(start + 1)
  const nextHeading = afterStart.indexOf('\n## ')
  const end = nextHeading === -1 ? claudeMd.length : start + 1 + nextHeading
  return claudeMd.slice(start, end)
}

function routedFlatDocs() {
  const claudeMd = readFileSync(CLAUDE_MD_PATH, 'utf8')
  const routed = new Set()
  const queue = []
  for (const m of routingTableSlice(claudeMd).matchAll(DOC_CITATION)) {
    if (!routed.has(m[0])) {
      routed.add(m[0])
      queue.push(m[0])
    }
  }
  while (queue.length > 0) {
    const doc = queue.shift()
    const docPath = join(ROOT, doc)
    if (!existsSync(docPath)) continue
    const text = readFileSync(docPath, 'utf8')
    for (const m of text.matchAll(DOC_CITATION)) {
      if (!routed.has(m[0])) {
        routed.add(m[0])
        queue.push(m[0])
      }
    }
  }
  return routed
}

const flatDocPaths = () => DOCS_MD.map((f) => `docs/${f}`)

test('aucun doc à plat non atteignable depuis la table de routage de CLAUDE.md (directement ou via un doc routé)', () => {
  const routed = routedFlatDocs()
  const unrouted = flatDocPaths().filter((d) => !routed.has(d))
  assert.deepEqual(
    unrouted.map(
      (d) =>
        `${d} n'est atteignable depuis aucun déclencheur de la table de routage de CLAUDE.md (ni directement, ni via un doc lui-même routé) — ajouter une ligne à la table (question qu'un agent se pose, sur le modèle des lignes existantes), ou citer ce doc depuis un doc déjà routé`,
    ),
    [],
  )
})
