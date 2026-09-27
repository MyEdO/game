// CONTRAT du workflow `canari.yml` (node --test, sans réseau) : chaque MESURE joue, et le verdict est
// AGRÉGÉ par un seul step qui les nomme toutes.
//
// Ce que ces tests empêchent : un step de mesure qui COUPE le job — les steps suivants skippés, leurs
// verdicts perdus ; et un step qui joue sans être relu par le résumé — mesure muette, donc mesure
// inutile.
// Le YAML est lu par regex, comme `gatesDeCi` lit `ci.yml` : le contrat porte sur des lignes.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { echapperRegex } from '../../src/lib/regex.ts'
import { SIGNALEUR, stepsDu } from '../gates/workflowsDuDepot.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CHEMIN = join(RACINE, '.github', 'workflows', 'canari.yml')
const TEXTE = readFileSync(CHEMIN, 'utf8')

/** Ids nommés par le bloc `RESULTATS` du résumé. PUR. */
export function idsDuResume(texte) {
  const bloc = /RESULTATS:\s*\|\n([\s\S]*?)\n\s{8}run:/.exec(texte)
  assert.ok(bloc, 'le step « Résumé » ne porte pas de bloc RESULTATS lisible')
  return [...bloc[1].matchAll(/^\s*([A-Za-z0-9_-]+)=\$\{\{\s*steps\.([A-Za-z0-9_-]+)\.outcome\s*\}\}\s*$/gm)]
    .map((m) => ({ etiquette: m[1], step: m[2] }))
}

const STEPS = stepsDu(TEXTE)
const MESURES = STEPS.filter((s) => s.tolerant)
const RESUME = STEPS.find((s) => s.nom === 'Résumé du canari')

test('le workflow porte `permissions: issues: write` (sans quoi il ne peut ni labelliser ni commenter)', () => {
  assert.match(TEXTE, /^permissions:\n(?:.*\n)*?\s{2}issues:\s*write$/m)
})

test('CHAQUE step de mesure porte `continue-on-error: true` ET un `id`', () => {
  const sansId = MESURES.filter((s) => !s.id).map((s) => s.nom ?? s.bloc.split('\n')[0])
  assert.deepEqual(sansId, [], 'un step de mesure sans `id` est invisible au résumé — il joue pour rien')
  assert.ok(MESURES.length >= 20, `seulement ${MESURES.length} mesures tolérantes — le canari a maigri`)
})

test('AUCUN step de mesure sans `continue-on-error` : seuls l’installation et le résumé coupent', () => {
  const durs = STEPS.filter((s) => s.run && !s.tolerant).map((s) => s.id ?? s.nom)
  assert.deepEqual(durs.sort(), ['Résumé du canari', 'install'].sort(),
    'un step de mesure qui coupe le job SKIPPE toutes les mesures suivantes (17 à 22 par run mesurées)')
})

test('le résumé NOMME chaque step de mesure — et rien d’autre', () => {
  const nommes = idsDuResume(TEXTE)
  for (const { etiquette, step } of nommes) {
    assert.equal(etiquette, step, `l’étiquette « ${etiquette} » ne porte pas le nom du step relu (${step})`)
  }
  const idsResume = new Set(nommes.map((n) => n.step))
  const idsMesures = MESURES.map((s) => s.id)
  const oubliees = idsMesures.filter((id) => !idsResume.has(id))
  assert.deepEqual(oubliees, [], 'mesure(s) jouée(s) mais jamais relue(s) par le résumé')
  const idsExistants = new Set(STEPS.map((s) => s.id).filter(Boolean))
  const fantomes = [...idsResume].filter((id) => !idsExistants.has(id))
  assert.deepEqual(fantomes, [], 'le résumé relit un step qui n’existe pas — son verdict serait vide')
})

test('le résumé joue MÊME après un rouge, ne se blanchit pas, et ÉCHOUE sur une mesure rouge', () => {
  assert.ok(RESUME, 'aucun step « Résumé du canari »')
  assert.match(RESUME.bloc, /if:\s*\$\{\{\s*!cancelled\(\)\s*\}\}/)
  assert.equal(RESUME.tolerant, false, 'le résumé PORTE le verdict : il ne peut pas être `continue-on-error`')
  assert.match(RESUME.bloc, /exit 1/, 'le résumé doit rougir le job quand une mesure est rouge')
})

test('le résumé délègue le signalement au script, avec le RAPPORT et le verdict tiré de $ROUGES', () => {
  // Le geste de signalement (label, survivante, commentaire, fermeture) vit dans
  // `scripts/ops/signaler-rouge.mjs` et s'y mesure ; ici, le contrat est l'APPEL.
  assert.match(RESUME.bloc, new RegExp(`node ${echapperRegex(SIGNALEUR)}`))
  assert.match(RESUME.bloc, /--titre "Canari rouge — environnement ou suite cassés"/)
  assert.match(RESUME.bloc, /--prefixe "Canari rouge"/)
  assert.match(RESUME.bloc, /--label canari/)
  assert.match(RESUME.bloc, /--corps "\$RAPPORT"/)
  assert.match(RESUME.bloc, /--verdict "\$\(\[ -n "\$ROUGES" \] && echo rouge \|\| echo vert\)"/)
})

test('aucun `npm audit` brut ne fait échouer le canari : c’est `audit-stock.mjs` qui juge', () => {
  // Les COMMENTAIRES du workflow disent pourquoi cette forme a disparu : la mesure porte sur ce qui
  // s'EXÉCUTE, jamais sur la prose qui l'explique (sans quoi l'explication déclencherait son test).
  const execute = TEXTE.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')
  assert.ok(!/npm(?: --prefix server)? audit/.test(execute),
    'un rouge permanent sur un stock connu ne mesure plus rien (4 des 5 derniers canaris)')
  assert.match(execute, /node scripts\/ops\/audit-stock\.mjs/)
})

test('les deux mesures d’ÉTAT sont jouées par le canari', () => {
  for (const script of ['audit-stock.mjs', 'fermetures-non-citees.mjs']) {
    assert.match(TEXTE, new RegExp(`node scripts/ops/${echapperRegex(script)}`), `${script} absent du canari`)
  }
})
