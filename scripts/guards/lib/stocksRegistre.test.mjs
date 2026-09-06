// COMPLÉTUDE DU REGISTRE DES STOCKS (node --test, sans réseau) — `npm run test:hooks`.
//
// La porte de stock compte ce que `scripts/hooks/stocks.json` DÉCLARE : une liaison hors registre
// est invisible à la porte. Ce test ferme les deux sens :
//   · tout CANDIDAT de l'arbre est déclaré (`stock`, `descripteur` ou `derive`) — trois détecteurs,
//     un verdict : la FORME (une liaison dont au moins 3 membres nomment un fichier), le NOM
//     (`…STOCK`, `…EXEMPT`, `…GELEES`, `…RATCHET`…), le CLIQUET SCALAIRE (un nombre d'un fichier de
//     test confronté à une mesure) ;
//   · toute DÉCLARATION existe, à ce fichier, sous cette forme.
// Les détecteurs NOMMENT, ils ne comptent rien : le comptage appartient au registre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  CHEMIN_REGISTRE, candidatsDuFichier, candidatsNonDeclares, chargerRegistre, parserRegistre,
  liaisonsDuFichier, verifierRegistre,
} from './stocksRegistre.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const lire = (f) => readFileSync(join(RACINE, f), 'utf8')
const registre = () => chargerRegistre({ racine: RACINE })

// ── LE SCHÉMA : ce qu'une déclaration doit dire, et ce qu'elle ne peut pas dire ───────────────────

const ENTREE_VALIDE = {
  fichier: 'scripts/guards/lib/domResiduStock.mjs',
  liaison: 'DOM_RESIDU_STOCK',
  forme: 'liste',
  role: 'stock',
  cible: 0,
  raison: 'stock des résidus DOM à résorber.',
}
const doc = (entrees) => JSON.stringify({ _entete: ['essai'], entrees })

test('schéma — une entrée complète passe, une entrée amputée est REFUSÉE en nommant son champ', () => {
  assert.equal(parserRegistre(doc([ENTREE_VALIDE])).entrees.length, 1)
  assert.throws(() => parserRegistre(doc([{ ...ENTREE_VALIDE, forme: 'tableau' }])), /forme/)
  assert.throws(() => parserRegistre(doc([{ ...ENTREE_VALIDE, role: 'borne' }])), /role/)
  assert.throws(() => parserRegistre(doc([{ ...ENTREE_VALIDE, raison: 'trop court' }])), /raison/)
  assert.throws(() => parserRegistre(doc([{ ...ENTREE_VALIDE, ailleurs: 1 }])), /ailleurs|REFUS/)
  assert.throws(() => parserRegistre('{'), /JSON illisible/)
})

test('schéma — une clé DÉCLARÉE DEUX FOIS est refusée, et un non-stock n’a pas de cible', () => {
  assert.throws(
    () => parserRegistre(doc([ENTREE_VALIDE, ENTREE_VALIDE])),
    /domResiduStock\.mjs#DOM_RESIDU_STOCK : déclarée deux fois/,
  )
  assert.throws(
    () => parserRegistre(doc([{ ...ENTREE_VALIDE, role: 'descripteur', cible: 3 }])),
    /un `descripteur` n'est jamais compté/,
  )
})

// ── LA CONFRONTATION AU CODE : une déclaration ne peut pas mentir ─────────────────────────────────

const SOURCES = {
  'scripts/guards/lib/xStock.mjs': [
    'export const X_STOCK = [',
    "  'src/a.ts',",
    "  'src/b.ts',",
    ']',
    'export const X_MAX = 12',
    'export const X_DERIVE = X_STOCK.length',
  ].join('\n'),
}
const lireFixture = (f) => {
  if (!(f in SOURCES)) throw new Error(`absent : ${f}`)
  return SOURCES[f]
}
const decl = (p) => ({ fichier: 'scripts/guards/lib/xStock.mjs', forme: 'liste', role: 'stock', cible: 0, raison: 'x'.repeat(25), ...p })

test('confrontation — une liaison ABSENTE, un fichier absent et une forme FAUSSE sont nommés', () => {
  const ecarts = verifierRegistre({ entrees: [
    decl({ liaison: 'X_STOCK' }),
    decl({ liaison: 'X_ABSENT' }),
    decl({ liaison: 'X_STOCK', fichier: 'scripts/guards/lib/absent.mjs' }),
    decl({ liaison: 'X_MAX', forme: 'liste' }),
  ] }, lireFixture)
  assert.deepEqual(ecarts, [
    "scripts/guards/lib/xStock.mjs#X_ABSENT : la liaison déclarée n'existe pas en portée de module",
    "scripts/guards/lib/absent.mjs#X_STOCK : le fichier déclaré n'existe pas",
    'scripts/guards/lib/xStock.mjs#X_MAX : déclarée `liste`, le code porte `plafond`',
  ])
})

test('confrontation — un `plafond` sans valeur LITTÉRALE exige `role: derive`, jamais un compte', () => {
  const commePlafond = decl({ liaison: 'X_DERIVE', forme: 'plafond' })
  assert.match(
    verifierRegistre({ entrees: [commePlafond] }, lireFixture)[0],
    /`plafond` sans valeur LITTÉRALE numérique — une valeur calculée se déclare `role: 'derive'`/,
  )
  assert.deepEqual(
    verifierRegistre({ entrees: [{ ...commePlafond, role: 'derive', cible: null }] }, lireFixture), [],
    'la même liaison, déclarée `derive`, est acceptée — et n’est jamais comptée',
  )
  assert.deepEqual(verifierRegistre({ entrees: [decl({ liaison: 'X_MAX', forme: 'plafond' })] }, lireFixture), [])
})

// ── LES TROIS DÉTECTEURS : ce qui DOIT être déclaré ───────────────────────────────────────────────

test('détecteur FORME — trois membres qui nomment un fichier suffisent, deux ne suffisent pas', () => {
  const liste = (n) => [
    'export const TABLE = [',
    ...Array.from({ length: n }, (_, i) => `  'src/x${i}.ts',`),
    ']',
  ].join('\n')
  const f = 'scripts/guards/lib/quelconque.mjs'
  assert.deepEqual(candidatsDuFichier(liste(2), f), [], 'deux membres : la forme ne dit rien')
  assert.deepEqual(candidatsDuFichier(liste(3), f).map((c) => [c.liaison, c.detecteurs]), [['TABLE', ['forme']]])
})

test('détecteur NOM — un nom de dette est un candidat, une BORNE DE MOTEUR n’en est pas une', () => {
  const f = 'src/gameIso/stage/viewPolicy.ts'
  const nomme = (n, v) => `export const ${n} = ${v}`
  assert.deepEqual(candidatsDuFichier(nomme('DES_HORS_PORTE_STOCK', "['a']"), f).map((c) => c.liaison), ['DES_HORS_PORTE_STOCK'])
  assert.deepEqual(candidatsDuFichier(nomme('COUTURES_GELEES', "['a']"), f).map((c) => c.liaison), ['COUTURES_GELEES'])
  for (const borne of ['ZOOM_MAX', 'PARTY_MAX', 'WS_MAX']) {
    assert.deepEqual(
      candidatsDuFichier(nomme(borne, '4'), f), [],
      `${borne} est une borne de moteur : ni la FORME (aucun fichier nommé), ni le NOM (\`_MAX\` n’en `
      + 'est pas un), ni le CLIQUET (le fichier n’est pas un test) ne la nomment',
    )
  }
})

test('détecteur CLIQUET — un scalaire confronté à une mesure DANS un test, et lui seul', () => {
  const corps = (compare) => ['const PLAFOND = 12', compare].join('\n')
  const dansUnTest = candidatsDuFichier(corps('expect(n).toBeLessThanOrEqual(PLAFOND)'), 'src/x.test.ts')
  assert.deepEqual(dansUnTest.map((c) => [c.liaison, c.detecteurs]), [['PLAFOND', ['cliquet']]])
  assert.deepEqual(
    candidatsDuFichier(corps('assert.ok(n <= PLAFOND)'), 'scripts/x.test.mjs').map((c) => c.liaison), ['PLAFOND'],
    'la même confrontation, écrite en `assert.ok`',
  )
  assert.deepEqual(
    candidatsDuFichier(corps('const autre = PLAFOND'), 'src/x.test.ts'), [],
    'un scalaire qui n’est confronté à RIEN n’est pas un cliquet',
  )
  assert.deepEqual(
    candidatsDuFichier(corps('expect(n).toBeLessThanOrEqual(PLAFOND)'), 'src/x.ts'), [],
    'hors fichier de TEST, un scalaire confronté est une borne de production',
  )
})

test('détecteur — une liaison SANS forme comptable (regex, chaîne, fonction) n’est pas un candidat', () => {
  const f = 'scripts/guards/lib/quelconque.mjs'
  assert.deepEqual(candidatsDuFichier('export const MOTIF_DETTE_RE = /dette/', f), [])
  assert.deepEqual(candidatsDuFichier("export const CHEMIN_STOCK = 'scripts/ops/audit-stock.json'", f), [])
})

test('lecture — les enveloppes d’IDENTITÉ sont traversées, une RUBRIQUE est descendue', () => {
  const f = 'scripts/guards/lib/xStock.mjs'
  const membres = (corps) => liaisonsDuFichier(corps, f).find((l) => l.liaison === 'S')
  for (const [nom, corps] of Object.entries({
    'const nu': "export const S = ['a', 'b']",
    'Object.freeze': "export const S = Object.freeze(['a', 'b'])",
    'new Set': "export const S = new Set(['a', 'b'])",
    'new Map': "export const S = new Map([['a', 1], ['b', 2]])",
    IIFE: "export const S = (() => ['a', 'b'])()",
    'fonction exportée': "export function S() { return ['a', 'b'] }",
  })) {
    assert.deepEqual([membres(corps).forme, membres(corps).entrees.length], ['liste', 2], nom)
  }
  const rubriques = membres("export const S = { 'test:hooks': ['a', 'b'], seul: 1 }")
  assert.deepEqual([rubriques.forme, rubriques.entrees.length], ['objet', 3],
    'les deux feuilles de la rubrique et la propriété simple ; la rubrique elle-même ne compte pas')
  const fiches = membres("export const S = { spells: { entrees: 456, lot: 'L' }, tables: { entrees: 2, lot: 'L' } }")
  assert.deepEqual(fiches.entrees.length, 2, 'une propriété à valeur d’OBJET est UNE entrée, pas quatre')
})

// ── LE DÉPÔT RÉEL : les deux sens de la complétude ────────────────────────────────────────────────

// LE REGISTRE N'EST PAS COMPTÉ PAR LUI-MÊME. Il porte 251 chemins de fichiers en littéral : la FORME
// en fait le plus gros « candidat » de l'arbre. S'il se déclarait, chaque déclaration NEUVE serait
// une croissance à cliqueter — sortir un stock de l'ombre coûterait le prix de le faire grossir, et
// personne ne le sortirait. La complétude l'écarte donc explicitement.
test('registre — le registre LUI-MÊME n’est jamais un candidat, quoi qu’en dise sa forme', () => {
  const brut = lire(CHEMIN_REGISTRE)
  const parForme = candidatsDuFichier(brut, CHEMIN_REGISTRE)
  assert.ok(
    parForme.some((c) => c.liaison === '$' && c.detecteurs.includes('forme')),
    'témoin muet : si la FORME ne voyait pas le registre, ce test ne prouverait rien',
  )
  assert.deepEqual(
    candidatsNonDeclares(registre(), { racine: RACINE, fichiers: [CHEMIN_REGISTRE] }), [],
    'le registre n’a rien à déclarer sur lui-même : ajouter une DÉCLARATION n’exige aucun `CLIQUET:`',
  )
})

test('registre — toute déclaration EXISTE, à son fichier et sous sa forme', () => {
  const ecarts = verifierRegistre(registre(), lire)
  assert.deepEqual(ecarts, [], `déclaration(s) qui mentent :\n  ${ecarts.join('\n  ')}`)
})

test('registre — tout CANDIDAT de l’arbre est DÉCLARÉ', (t) => {
  const manquants = candidatsNonDeclares(registre(), { racine: RACINE })
  const par = { stock: 0, descripteur: 0, derive: 0 }
  for (const e of registre().entrees) par[e.role] += 1
  t.diagnostic(`registre : ${registre().entrees.length} entrées — ${JSON.stringify(par)}`)
  assert.deepEqual(
    manquants.map((m) => `${m.cle} [${m.detecteurs.join('+')}]`), [],
    'liaison(s) candidates hors registre : les déclarer dans `scripts/hooks/stocks.json` avec leur rôle '
    + '(`stock` compté, `descripteur`/`derive` jamais comptés) — ajouter une DÉCLARATION n’exige aucun `CLIQUET:`.',
  )
})
