// Filet des citations des docs PURS (#2203) : chaque `fichier:ligne` qu'un générateur de `GENERATORS`
// rend porte, à ±2 lignes du site SUR LE DISQUE, l'un des identifiants backtiqués de sa ligne. Le doc
// n'est pas commité : ce qu'on juge est son RENDU (`renduDe`), jamais un fichier de `docs/`.
//   node --test scripts/docs/citations-rendues.test.mjs  (chaîné dans `npm run test:docs`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERATORS, renduDe } from './build-all.mjs'
import { estUnDocMarkdown } from './lib/ecriture-derives.mjs'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const REF = /`((?:src|scripts|server|docs)\/[\w./@-]+):(\d+)`/g
const JETON = /`([^`]+)`/g
const IDENT = /^[A-Za-z_$][\w$]*$/
/** Demi-largeur de la fenêtre autour du site cité, en lignes. */
const DEMI_FENETRE = 2

/**
 * Les fautes de citation d'un doc rendu : `lire(chemin)` rend le texte du fichier cité, ou `null`.
 * Une ligne sans identifiant backtiqué ne juge que l'existence du site. PURE.
 */
function fautesDeCitations(doc, texte, lire) {
  const fautes = []
  texte.split('\n').forEach((ligne, i) => {
    const refs = [...ligne.matchAll(REF)]
    if (!refs.length) return
    const candidats = [...ligne.matchAll(JETON)].map((m) => m[1]).filter((j) => IDENT.test(j))
    for (const [, cible, numTexte] of refs) {
      const num = Number(numTexte)
      const source = lire(cible)
      if (source === null) {
        fautes.push(`${doc}:${i + 1} — cite \`${cible}:${num}\`, absent du disque`)
        continue
      }
      const src = source.split('\n')
      if (num < 1 || num > src.length) {
        fautes.push(`${doc}:${i + 1} — cite \`${cible}:${num}\`, hors des ${src.length} lignes du fichier`)
        continue
      }
      if (!candidats.length) continue
      const fenetre = src.slice(Math.max(0, num - 1 - DEMI_FENETRE), num + DEMI_FENETRE).join('\n')
      if (!candidats.some((c) => fenetre.includes(c)))
        fautes.push(`${doc}:${i + 1} — \`${cible}:${num}\` ne porte aucun de ${candidats.map((c) => `\`${c}\``).join(', ')} à ±${DEMI_FENETRE} lignes`)
    }
  })
  return fautes
}

const lireDuDisque = (chemin) => {
  try { return readFileSync(path.join(RACINE, chemin), 'utf8') } catch { return null }
}

test('fautesDeCitations : le symbole à ±2 lignes du site passe ; au-delà, ou site hors fichier, faute nommée', () => {
  const source = ['a', 'b', 'function cible() {', 'c', 'd', 'e', 'f'].join('\n')
  const lire = (c) => (c === 'src/x.ts' ? source : null)
  assert.deepEqual(fautesDeCitations('d.md', '`cible` vit en `src/x.ts:1`', lire), [])
  assert.deepEqual(fautesDeCitations('d.md', '`cible` vit en `src/x.ts:5`', lire), [])
  assert.deepEqual(fautesDeCitations('d.md', '`cible` vit en `src/x.ts:6`', lire), ['d.md:1 — `src/x.ts:6` ne porte aucun de `cible` à ±2 lignes'])
  assert.deepEqual(fautesDeCitations('d.md', 'site `src/x.ts:9`', lire), ['d.md:1 — cite `src/x.ts:9`, hors des 7 lignes du fichier'])
  assert.deepEqual(fautesDeCitations('d.md', 'site `src/y.ts:1`', lire), ['d.md:1 — cite `src/y.ts:1`, absent du disque'])
})

test('chaque doc RENDU par `GENERATORS` cite des sites qui portent leur symbole (±2 lignes)', async () => {
  const fautes = []
  let docs = 0
  for (const g of GENERATORS.filter((x) => x.targets.some(estUnDocMarkdown))) {
    for (const [cible, texte] of await renduDe(g)) {
      if (!estUnDocMarkdown(cible)) continue
      docs++
      fautes.push(...fautesDeCitations(cible, texte, lireDuDisque))
    }
  }
  assert.ok(docs > 20, `${docs} doc(s) rendu(s) : le balayage est aveugle`)
  assert.deepEqual(fautes, [])
})
