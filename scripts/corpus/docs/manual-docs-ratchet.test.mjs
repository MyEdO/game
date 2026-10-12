import test from 'node:test'

import assert from 'node:assert/strict'

import { readFileSync, existsSync } from 'node:fs'

import { join } from 'node:path'

import { fileURLToPath } from 'node:url'

import { listerDossier } from '../../guards/lib/lister.mjs'

import { MANUAL_DOCS_STOCK } from '../../guards/lib/manualDocsStock.mjs'

import { ecartsDeStock } from '../../guards/lib/stock.mjs'

import { GENERATORS, generateurDe, rendreCible } from '../../docs/build-all.mjs'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

const DOCS_DIR = join(ROOT, 'docs')

const DOCS_MD = listerDossier(DOCS_DIR).filter((f) => f.endsWith('.md'))

const GENERES_A_PLAT = GENERATORS.flatMap((g) => g.targets).filter((t) => /^docs\/[^/]+\.md$/.test(t))

const GENERATED_MARKER = /^>\s*(?:⚠️\s*)?(?:Fichier\s+)?GÉNÉRÉ par\b/m

function isGenerated(text) {
  const head = text.split('\n').slice(0, 10).join('\n')
  return GENERATED_MARKER.test(head)
}

const estGenere = (f) => generateurDe(`docs/${f}`) !== undefined

function manualDocs() {
  return DOCS_MD.filter((f) => !estGenere(f)).map((f) => `docs/${f}`)
}

async function texteDuDoc(doc) {
  if (generateurDe(doc) !== undefined) return rendreCible(doc)
  const chemin = join(ROOT, doc)
  return existsSync(chemin) ? readFileSync(chemin, 'utf8') : null
}

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

async function routedFlatDocs() {
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

test('aucun doc à plat non atteignable depuis la table de routage de CLAUDE.md (directement ou via un doc routé)', async () => {
  const routed = await routedFlatDocs()
  const unrouted = flatDocPaths().filter((d) => !routed.has(d))
  assert.deepEqual(
    unrouted.map(
      (d) =>
        `${d} n'est atteignable depuis aucun déclencheur de la table de routage de CLAUDE.md (ni directement, ni via un doc lui-même routé) — ajouter une ligne à la table (question qu'un agent se pose, sur le modèle des lignes existantes), ou citer ce doc depuis un doc déjà routé`,
    ),
    [],
  )
})
