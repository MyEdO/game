import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rendre } from './build-hote-texte.mjs'

const texte = rendre().get('docs/hote-texte.md')
const source = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

test('#2898 le doc de l’hôte texte vient du code : chaque commande de `COMMANDES` y a sa ligne', () => {
  const formes = [...source('src/hoteTexte/cli.ts').matchAll(/^ {2}\['([^']+)', '/gm)].map((m) => m[1])
  assert.ok(formes.length >= 8, `témoin : les commandes de cli.ts se lisent (${formes.length})`)
  for (const forme of formes) assert.ok(texte.includes(`| \`${forme.replaceAll('|', '\\|')}\` |`), `commande absente du doc : ${forme}`)
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
