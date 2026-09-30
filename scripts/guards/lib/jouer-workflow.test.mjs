// L'ENVELOPPE de jeu d'un workflow — ce qu'elle garantit à tout banc qui s'en sert.
// Le script joué ici est un JOUET écrit par le banc : il n'éprouve aucun workflow réel, seulement
// le contrat de l'enveloppe (dé-export de `meta`, `args` transmis, doublures `agent`/`parallel`/
// `pipeline`/`phase`/`log`, COPIES à travers `pipeline`, options COPIÉES à l'appel, FILET de racine).
// Sans lui, un défaut de l'enveloppe se lirait comme un défaut du workflow joué.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jouerWorkflow } from './jouer-workflow.mjs'

/** Écrit un script jouet dans un dossier JETABLE et le joue. */
async function jouerJouet(source, argsDuRun, repondre = () => ({ ok: true })) {
  const dir = mkdtempSync(join(tmpdir(), 'jouer-workflow-'))
  try {
    const chemin = join(dir, 'jouet.workflow.js')
    writeFileSync(chemin, source, 'utf8')
    return await jouerWorkflow(chemin, argsDuRun, repondre)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('`export const meta` est dé-exporté et le `return` de premier niveau est rendu', async () => {
  const { rendu } = await jouerJouet([
    "export const meta = { name: 'jouet', phases: [] }",
    'return { nom: meta.name }',
  ].join('\n'))
  assert.deepEqual(rendu, { nom: 'jouet' })
})

test('un `export const meta` indenté derrière un BOM est dé-exporté lui aussi (position AST, pas regex)', async () => {
  const { rendu } = await jouerJouet([
    "﻿  export const meta = { name: 'jouet', phases: [] }",
    'return { nom: meta.name }',
  ].join('\n'))
  assert.deepEqual(rendu, { nom: 'jouet' })
})

test('`args` arrive au script TEL QUEL, et un `args` absent vaut `undefined`', async () => {
  const src = 'return { vu: typeof args === "undefined" ? "absent" : args }'
  assert.deepEqual((await jouerJouet(src, { a: 1 })).rendu, { vu: { a: 1 } })
  assert.deepEqual((await jouerJouet(src, undefined)).rendu, { vu: 'absent' })
})

test('les prompts sont capturés par `phase:label`, et `log` alimente le journal', async () => {
  const { promptsParLabel, journal } = await jouerJouet([
    "phase('P')",
    "log('une ligne')",
    "await agent('mon prompt', { phase: 'P', label: 'l1' })",
    'return {}',
  ].join('\n'))
  assert.deepEqual([...promptsParLabel], [['P:l1', 'mon prompt']])
  assert.deepEqual(journal, ['une ligne'])
})

test('`parallel` ne REJETTE jamais : un thunk qui lève rend `null`, comme un agent mort', async () => {
  const { rendu } = await jouerJouet([
    'const r = await parallel([() => 1, () => { throw new Error("mort") }, () => 3])',
    'return { r }',
  ].join('\n'))
  assert.deepEqual(rendu.r, [1, null, 3])
})

test('`pipeline` dépose à `null` l’item dont une stage lève, et saute ses stages restantes', async () => {
  const { rendu } = await jouerJouet([
    'let vues = 0',
    'const r = await pipeline([{ n: 1 }, { n: 2 }],',
    '  (x) => { if (x.n === 2) throw new Error("mort") ; return { n: x.n * 10 } },',
    '  (x) => { vues++ ; return { n: x.n + 1 } })',
    'return { r, vues }',
  ].join('\n'))
  assert.deepEqual(rendu.r, [{ n: 11 }, null])
  assert.equal(rendu.vues, 1, 'la seconde stage n’est pas jouée sur l’item mort')
})

test('les items qui traversent `pipeline` sont des COPIES — une comparaison d’identité y est fausse', async () => {
  const { rendu } = await jouerJouet([
    'const item = { n: 1 }',
    'let recu = null',
    'const r = await pipeline([item], (x) => { recu = x ; return x })',
    'return { memeObjet: recu === item, valeur: r[0].n }',
  ].join('\n'))
  assert.equal(rendu.memeObjet, false)
  assert.equal(rendu.valeur, 1)
})

test('les options sont rangées telles qu’elles PARTENT : un objet de schéma muté après l’appel n’y change rien', async () => {
  const { optionsParLabel, rendu } = await jouerJouet([
    "const PARTAGE = { type: 'string', title: 'avant' }",
    "const S = { type: 'object', additionalProperties: false, required: ['o'], properties: { o: { type: 'object', properties: { t: PARTAGE } } } }",
    "await agent('p', { phase: 'P', label: 'l1', schema: S })",
    "PARTAGE.title = 'après'",
    "await agent('p', { phase: 'P', label: 'l2', schema: S })",
    'return { vivant: S.properties.o.properties.t.title }',
  ].join('\n'))
  assert.equal(rendu.vivant, 'après', 'témoin : le script a bien muté son objet')
  assert.equal(optionsParLabel.get('P:l1').schema.properties.o.properties.t.title, 'avant')
  assert.equal(optionsParLabel.get('P:l2').schema.properties.o.properties.t.title, 'après')
})

// ── Le FILET : `defautsDeRacine` sur l'objet SÉRIALISÉ qui part à chaque agent ────────────────

const AGENT_A_RACINE = (schema) => [
  `const S = ${schema}`,
  "await parallel([() => agent('p', { phase: 'P', label: 'l1', schema: S })])",
  'return {}',
].join('\n')
const RACINE_SAINE = "type: 'object', additionalProperties: false, required: ['o']"

test('témoin : une racine fermée d’objets, de tableaux et de nombres passe, quoi qu’elle porte SOUS ses propriétés', async () => {
  const { rendu } = await jouerJouet(AGENT_A_RACINE(`{ ${RACINE_SAINE}, properties: { o: { type: 'object', properties: { t: { type: 'string' } } }, l: { type: 'array', items: { type: 'string' } }, n: { type: ['number', 'null'] } } }`))
  assert.deepEqual(rendu, {})
})

test('une racine texte REJETTE, même quand `parallel` avale l’agent', async () => {
  await assert.rejects(
    () => jouerJouet(AGENT_A_RACINE(`{ ${RACINE_SAINE}, properties: { o: { type: 'object' }, t: { type: 'string' } } }`)),
    /jouet\.workflow:l1 — propriété racine « t » accepte une chaîne \(`type` : "string"\)/,
  )
})

test('a17 — une mutation d’intrinsèque (`Object.prototype.toJSON`) est jugée sur ce qui PART : le banc REJETTE', async () => {
  const avant = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON')
  try {
    await assert.rejects(
      () => jouerJouet([
        "export const meta = { name: 'jouet', phases: [{ title: 'P' }] }",
        `const S = { ${RACINE_SAINE}, properties: { o: { type: 'array', items: { type: 'string' } } } }`,
        "Object.prototype.toJSON = function () { return this.additionalProperties === false && this.required ? { type: 'object', additionalProperties: false, properties: { t: { type: 'string' } }, required: ['t'] } : this }",
        "await agent('p', { phase: 'P', label: 'l1', schema: S })",
        'return {}',
      ].join('\n')),
      /jouet\.workflow:l1 — propriété racine « t » accepte une chaîne/,
    )
  } finally {
    if (avant) Object.defineProperty(Object.prototype, 'toJSON', avant)
    else delete Object.prototype.toJSON
  }
})

test('chaque défaut de racine REJETTE avec son message', async () => {
  for (const [schema, attendu] of [
    ["'texte'", 'le schéma n’est pas un objet (lu : "texte")'],
    [`{ ${RACINE_SAINE}, properties: { o: { type: 'object' } }, $defs: {} }`, 'clé de racine « $defs » hors de type/properties/required/additionalProperties'],
    [`{ type: 'array', additionalProperties: false, properties: { o: { type: 'object' } } }`, "`type: 'object'` exigé à la racine (lu : \"array\")"],
    [`{ type: 'object', properties: { o: { type: 'object' } } }`, '`additionalProperties: false` exigé à la racine (lu : absent)'],
    [`{ ${RACINE_SAINE}, properties: [] }`, '`properties` de la racine n’est pas un objet (lu : [])'],
    [`{ ${RACINE_SAINE}, properties: { o: true } }`, 'propriété racine « o » n’est pas un objet (lu : true)'],
    [`{ ${RACINE_SAINE}, properties: { o: { enum: ['a'] } } }`, 'propriété racine « o » sans `type`'],
    [`{ ${RACINE_SAINE}, properties: { o: { type: [1] } } }`, 'propriété racine « o » : `type` n’est ni une chaîne ni un tableau de chaînes (lu : [1])'],
    [`{ ${RACINE_SAINE}, properties: { o: { type: ['null', 'string'] } } }`, 'propriété racine « o » accepte une chaîne (`type` : ["null","string"])'],
  ]) {
    await assert.rejects(
      () => jouerJouet(AGENT_A_RACINE(schema)),
      (e) => e.message.split('\n').includes(`jouet.workflow:l1 — ${attendu}`),
      schema,
    )
  }
})
