import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rendre } from './build-hote-texte.mjs'
import { INSTRUCTIONS, outils } from '../../src/hoteTexte/outils.ts'

const texte = rendre().get('docs/hote-texte.md')
const source = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

test('#2898 le doc de l’hôte texte vient du code : chaque outil y a sa section, chaque entrée sa ligne, les instructions leur citation', () => {
  const definitions = outils({ scenarios: null, cadences: ['manuel'] })
  assert.deepEqual(Object.keys(definitions).sort(), ['jouer', 'lire', 'nouvelle'], 'témoin : les outils se lisent')
  for (const [nom, { description, schema }] of Object.entries(definitions)) {
    assert.ok(texte.includes(`### \`${nom}\`\n\n${description.split('\n')[0]}`), `outil absent du doc : ${nom}`)
    for (const cle of Object.keys(schema)) assert.match(texte, new RegExp(`\\| \`${cle}\`\\??\\s?\\| `), `entrée absente du doc : ${nom}.${cle}`)
  }
  for (const ligne of INSTRUCTIONS.split('\n')) assert.ok(texte.includes(`> ${ligne}`), `instruction absente du doc : ${ligne}`)
})

test('#2898 les bornes du doc sont celles de `BORNES`, et chaque catégorie d’erreur y a son cas', () => {
  const lignes = /lignes: \{ ([^}]+) \}/.exec(source('src/hoteTexte/vue.ts'))[1]
  for (const [, commande, n] of lignes.matchAll(/(\w+): (\d+)/g)) assert.match(texte, new RegExp(`\\| \`${commande}\` \\| ${n} \\|`), `borne absente : ${commande}`)
  for (const categorie of ['validation', 'permission', 'regle']) assert.match(texte, new RegExp(`\\| \`${categorie}\` \\| `), `catégorie absente : ${categorie}`)
})

/** Le poids du doc, et la largeur d'une ligne de sa table des verbes : un type s'y écrit par son nom, jamais déplié. */
const DOC_AU_PLUS = 50_000
const LIGNE_DE_VERBE_AU_PLUS = 400

test('#2898 le doc reste court : sous son poids, chaque ligne de la table des verbes sous sa largeur', () => {
  assert.ok(texte.length <= DOC_AU_PLUS, `docs/hote-texte.md pèse ${texte.length} caractères`)
  const verbes = texte.split('\n').filter((l) => /^\| `[a-z]\w*` \| `/.test(l))
  assert.ok(verbes.length > 500, `témoin : la table des verbes se lit (${verbes.length})`)
  const longues = verbes.filter((l) => l.length > LIGNE_DE_VERBE_AU_PLUS).map((l) => `${/^\| `(\w+)`/.exec(l)[1]} (${l.length})`)
  assert.deepEqual(longues, [])
})
