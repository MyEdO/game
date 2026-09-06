// PORTE A POSTERIORI (node --test, sans réseau) — un STOCK NOMINATIF qui naît ou grandit dans la
// PLAGE POUSSÉE sans que le message de son commit le dise.
//
// Le garde `solde-ticket-guard` pose la même règle AU COMMIT, mais il vit dans le hook PreToolUse :
// un commit fait hors de ce canal (autre outil, autre machine, hook non installé) n'y passe pas.
// Cette mesure relit les commits une fois posés — même règle, mêmes libs (`stocksNominatifs.mjs`,
// `plageStock.mjs`), un seul endroit où elle est écrite. Lancée par `npm run test:hooks`.
//
// CE QUE LA PORTE COMPTE : les liaisons que `scripts/hooks/stocks.json` DÉCLARE `stock`, selon leur
// `forme` ; la complétude de ce registre est jouée par `scripts/guards/lib/stocksRegistre.test.mjs`.
// Les fixtures ci-dessous portent leur PROPRE registre : la règle se prouve sur des déclarations
// fabriquées, jamais sur l'état vivant du dépôt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  croissanceDesStocks, croissancesNonCouvertes, cliquetsDuMessage, entreesDeStock, estEntreeDeStock,
  raisonDeRefus,
} from '../guards/lib/stocksNominatifs.mjs'
import { chargerRegistre, declarationsParFichier } from '../guards/lib/stocksRegistre.mjs'
import { croissancesDeLaPlage, raisonDeRefusDePlage, SHA_NUL } from '../guards/lib/plageStock.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (...args) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1e8 })
const REGISTRE_DU_DEPOT = chargerRegistre({ racine: RACINE })
const declarationsDe = (f) => (declarationsParFichier(REGISTRE_DU_DEPOT).get(f) ?? []).filter((d) => d.role === 'stock')

/** ARRÊT NOMMÉ sur un clone SUPERFICIEL : `git show HEAD` y rend un diff tronqué et la mesure
 *  dirait « rien à signaler » sur un commit qu'elle n'a pas lu (patron de
 *  `fermetures-sans-solde.test.mjs`). Jamais un `skip` vert. */
function exigerHistoireComplete() {
  assert.equal(
    git('rev-parse', '--is-shallow-repository').trim(), 'false',
    "dépôt SUPERFICIEL : cette mesure lit le DIFF du dernier commit — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.",
  )
}

/** La porte était-elle EN VIGUEUR dans le commit jugé ? (sa lib y est-elle ?) Une porte juge les
 *  commits qui la PORTENT ; condamner l'histoire d'avant serait un verdict rétroactif, et l'échapper
 *  par un stock de shas rendrait à cette porte le vice qu'elle combat. Rien à tenir à jour : la
 *  condition s'éteint d'elle-même dès le premier commit qui embarque la lib. */
function porteEnVigueur() {
  try {
    git('cat-file', '-e', 'HEAD:scripts/guards/lib/stocksNominatifs.mjs')
    return true
  } catch { return false }
}

/** Début de la plage à juger. En CI, l'événement de push le porte (`GITHUB_EVENT_PATH` → `before`) ;
 *  `origin/main` n'y a PAS de reflog, il ne peut donc pas servir de base. Sans événement lisible, la
 *  base reste nulle et `croissancesDeLaPlage` juge HEAD seul en le DISANT (jamais un silence). */
function debutDeLaPlage(env = process.env) {
  if (!env.GITHUB_EVENT_PATH) return SHA_NUL
  try {
    const avant = String(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))?.before ?? '')
    return /^[0-9a-f]{40}$/.test(avant) && avant !== SHA_NUL ? avant : SHA_NUL
  } catch { return SHA_NUL }
}

// ── LES FIXTURES : un registre fabriqué, quatre porteurs, une forme chacun ────────────────────────

const F_LISTE = 'scripts/guards/lib/xStock.mjs'
const F_OBJET = 'scripts/guards/lib/xObjet.mjs'
const F_PLAFOND = 'scripts/guards/lib/xPlafond.test.mjs'
const F_DESC = 'scripts/guards/lib/xDescripteur.mjs'

const declaration = (fichier, liaison, forme, role = 'stock') => ({
  fichier, liaison, forme, role, cible: role === 'stock' ? 0 : null, raison: 'fixture de la porte de stock.',
})
const REGISTRE = { entrees: [
  declaration(F_LISTE, 'X_STOCK', 'liste'),
  declaration(F_LISTE, 'X_AUTRE', 'liste'),
  declaration(F_OBJET, 'PAR_TYPE', 'objet'),
  declaration(F_PLAFOND, 'X_MAX', 'plafond'),
  declaration(F_DESC, 'RACINES', 'liste', 'descripteur'),
  declaration(F_DESC, 'PLAFOND_DERIVE', 'plafond', 'derive'),
] }

/** Diff unifié minimal d'un fichier : `ajoutees`/`retirees` sont des lignes ENTIÈRES. */
const diffDe = (fichier, ajoutees = [], retirees = [], depart = 21) =>
  [
    `diff --git a/${fichier} b/${fichier}`,
    `--- a/${fichier}`,
    `+++ b/${fichier}`,
    `@@ -${depart},0 +${depart},1 @@`,
    ...retirees.map((l) => `-${l}`),
    ...ajoutees.map((l) => `+${l}`),
  ].join('\n')

const ENTREE_A = "  'src/state/combatSlice.ts',"
const ENTREE_B = "  'src/ui/CampaignView.test.tsx // div',"
const ENTREE_CLE = "  'scripts/guards/lib/labelLogic.mjs': 'raison mesurée',"

const images = (post, pre = null) => ({
  registre: REGISTRE,
  lirePostImage: () => post,
  lirePreImage: () => (pre === null ? post : pre),
})

const listeDe = (liaison, membres) => [`export const ${liaison} = [`, ...membres, ']'].join('\n')

test('entrée — élément de liste, clé d objet et balise commentée comptent au REPLI', () => {
  assert.equal(estEntreeDeStock(ENTREE_A), true)
  assert.equal(estEntreeDeStock(ENTREE_B), true)
  assert.equal(estEntreeDeStock(ENTREE_CLE), true)
  assert.equal(estEntreeDeStock("  'src/ui/Tabs.tsx:42',"), true)
  assert.equal(estEntreeDeStock("  'criticals.json':"), true)
})

test('entrée — un chemin cité en PROSE ou en commentaire n en est pas une', () => {
  assert.equal(estEntreeDeStock("      `⛔ src/state/combatSlice.ts a grossi`,"), false)
  assert.equal(estEntreeDeStock('  // src/state/combatSlice.ts reste à traiter'), false)
  assert.equal(estEntreeDeStock("    'src/x.ts est absent de l index',"), false)
  assert.equal(estEntreeDeStock("  const stock = ['src/a.ts', 'src/b.ts']"), false)
  assert.equal(estEntreeDeStock("import { scanTombstones } from '../guards/lib/commentPoison.mjs'"), false)
  assert.equal(estEntreeDeStock('  {'), false, 'le REPLI de ligne ne voit pas une accolade ouvrante')
})

// ── LE PÉRIMÈTRE : ce que la porte lit, c'est ce que le registre DÉCLARE ─────────────────────────

test('périmètre — un fichier DÉCLARÉ est lu, un fichier hors registre est muet', () => {
  const post = listeDe('X_STOCK', [ENTREE_A, ENTREE_B])
  const [c] = croissanceDesStocks(diffDe(F_LISTE, [ENTREE_A, ENTREE_B], [], 2), images(post, 'export const X_STOCK = [\n]'))
  assert.deepEqual([c.cle, c.net], [`${F_LISTE}#X_STOCK`, 2])
  assert.deepEqual(
    croissanceDesStocks(diffDe('src/state/combatFlow.ts', [ENTREE_A, ENTREE_B]), { registre: REGISTRE }), [],
    'un module de production n’est déclaré nulle part : la porte se tait',
  )
})

test('périmètre — le registre du DÉPÔT déclare les porteurs que la porte doit lire', () => {
  for (const [fichier, liaison] of [
    ['scripts/guards/lib/slotsStock.mjs', 'SLOTS_SANS_DECLARATION'],
    ['scripts/guards/lib/structuresStock.mjs', 'STRUCTURES_ORPHELINES'],
    ['scripts/hooks/ecrans-ui.json', '$.ecrans'],
    ['src/data/field-consumers.test.ts', 'RECOUVRES'],
    ['src/data/schemas/grammaire/prose-inline.ts', 'PROSE_INLINE_TOLEREE'],
    ['src/ui/compendium/registry-enveloppe.test.ts', 'ORPHELINS'],
  ]) {
    assert.ok(
      declarationsDe(fichier).some((d) => d.liaison === liaison),
      `${fichier}#${liaison} : porteur RÉEL absent du registre — la porte ne le compterait pas`,
    )
  }
  assert.deepEqual(declarationsDe('src/state/combatFlow.ts'), [], 'un module de production n’est pas un stock')
})

// ── LES TROIS FORMES, ET CE QUE CHACUNE COMPTE ───────────────────────────────────────────────────

test('forme LISTE — une entrée de plus est une croissance, une entrée de moins ne dit rien', () => {
  const avant = listeDe('X_STOCK', [ENTREE_A])
  const apres = listeDe('X_STOCK', [ENTREE_A, ENTREE_B])
  const [c] = croissanceDesStocks(diffDe(F_LISTE, [ENTREE_B], [], 3), images(apres, avant))
  assert.deepEqual([c.cle, c.ajoutees, c.retirees, c.net], [`${F_LISTE}#X_STOCK`, 1, 0, 1])
  assert.deepEqual(
    croissanceDesStocks(diffDe(F_LISTE, [], [ENTREE_B], 3), images(avant, apres)), [],
    'un stock qui DÉCROÎT ne dit rien',
  )
})

test('forme OBJET — une clé qui ne nomme AUCUN fichier compte comme les autres', () => {
  const objet = (cles) => ['export const PAR_TYPE = {', ...cles.map((k) => `  ${k}: { entrees: 4, lot: 'L' },`), '}'].join('\n')
  const [c] = croissanceDesStocks(
    diffDe(F_OBJET, ['  tables: { entrees: 4, lot: \'L\' },'], [], 3),
    images(objet(['spells', 'tables']), objet(['spells'])),
  )
  assert.deepEqual([c.cle, c.net], [`${F_OBJET}#PAR_TYPE`, 1], 'la clé `tables` n’est pas un chemin, et elle compte')
})

test('forme PLAFOND — la croissance est la MONTÉE de la valeur, jamais une ligne de plus', () => {
  const corps = (v) => `export const X_MAX = ${v}\nexpect(n).toBeLessThanOrEqual(X_MAX)`
  const diff = [
    `--- a/${F_PLAFOND}`, `+++ b/${F_PLAFOND}`, '@@ -1,1 +1,1 @@', '-export const X_MAX = 41', '+export const X_MAX = 43',
  ].join('\n')
  const [c] = croissanceDesStocks(diff, images(corps(43), corps(41)))
  assert.deepEqual([c.cle, c.net, c.exemples], [`${F_PLAFOND}#X_MAX`, 2, ['X_MAX 41 → 43']])
  assert.deepEqual(croissanceDesStocks(diff, images(corps(40), corps(41))), [], 'un plafond qui BAISSE ne dit rien')
})

test('rôle — un DESCRIPTEUR et un DERIVE qui grandissent ne sont JAMAIS comptés', () => {
  const desc = (membres) => [
    listeDe('RACINES', membres),
    'export const PLAFOND_DERIVE = RACINES.length',
  ].join('\n')
  assert.deepEqual(
    croissanceDesStocks(
      diffDe(F_DESC, [ENTREE_B], [], 3),
      images(desc([ENTREE_A, ENTREE_B]), desc([ENTREE_A])),
    ), [],
    'une table de racines déclarée `descripteur` grandit sans rien devoir ; son plafond `derive` non plus',
  )
})

test('clé — deux liaisons du MÊME fichier : celle qui grandit est nommée, l’autre la compense pas', () => {
  const corps = (stock, autre) => [listeDe('X_STOCK', stock), listeDe('X_AUTRE', autre)].join('\n')
  const avant = corps([ENTREE_A, ENTREE_B], [ENTREE_CLE])
  const apres = corps([ENTREE_A], [ENTREE_CLE, ENTREE_B])
  // `X_STOCK` perd une entrée (ligne 3 du PRÉ-image), `X_AUTRE` en gagne une (ligne 6 du POST).
  const diff = [
    `--- a/${F_LISTE}`, `+++ b/${F_LISTE}`,
    '@@ -3,1 +3,0 @@', `-${ENTREE_B}`,
    '@@ -6,0 +6,1 @@', `+${ENTREE_B}`,
  ].join('\n')
  const croissances = croissanceDesStocks(diff, images(apres, avant))
  assert.deepEqual(
    croissances.map((c) => [c.cle, c.net]), [[`${F_LISTE}#X_AUTRE`, 1]],
    'un net par FICHIER aurait rendu 0 : « +1 ici, −1 là » ne se compense pas entre deux stocks',
  )
})

// ── PORTÉE DE MODULE : une fixture DANS un test n'est pas un stock ────────────────────────────────

test('portée — une liaison écrite dans un corps de `test(…)` n’est aucune entrée', () => {
  const locale = ["test('x', () => {", `  ${listeDe('X_STOCK', [ENTREE_A, ENTREE_B])}`, '})'].join('\n')
  assert.deepEqual(
    croissanceDesStocks(diffDe(F_LISTE, [ENTREE_A, ENTREE_B], [], 3), images(locale)), [],
    'une fixture écrite dans un `test(...)` ne s’ajoute à aucune dette',
  )
})

test('portée — aucune ENVELOPPE ne cache un stock de module', () => {
  const E = ["  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", "  'src/ui/Tabs.tsx',"]
  const diff = diffDe(F_LISTE, E, [], 2)
  const enveloppes = {
    'const de module': ['export const X_STOCK = [', ...E, ']'],
    'IIFE de module': ['export const X_STOCK = (() => [', ...E, '])()'],
    'fonction exportée': ['export function X_STOCK() { return [', ...E, '] }'],
    'objet figé': ['export const X_STOCK = Object.freeze([', ...E, '])'],
    'Set de module': ['export const X_STOCK = new Set([', ...E, '])'],
  }
  for (const [nom, lignes] of Object.entries(enveloppes)) {
    const [c] = croissanceDesStocks(diff, images(`${lignes.join('\n')}\n`, 'export const X_STOCK = []'))
    assert.equal(c?.net, 3, `${nom} : le stock a disparu derrière l'enveloppe`)
  }
})

test('portée — sans image lisible, l’entrée COMPTE et la clé se réduit au FICHIER', () => {
  const diff = diffDe(F_LISTE, [ENTREE_A, ENTREE_B])
  const [c] = croissanceDesStocks(diff, { registre: REGISTRE })
  assert.deepEqual([c.cle, c.liaison, c.net], [F_LISTE, null, 2], 'le REPLI perd la liaison, jamais sa vue')
  assert.equal(croissanceDesStocks(diff, { registre: REGISTRE, lirePostImage: () => null }).length, 1)
})

test('croissance — un diff qui n’est PAS une chaîne LÈVE, et un « 0 » ne peut plus mentir', () => {
  // Témoin POSITIF d'abord : sans lui, un `[]` prouverait autant que la lib cassée. Le même diff,
  // passé en OBJET (l'appel qu'un juge a fait le 2026-09-04), doit lever au lieu de rendre [].
  const diff = diffDe(F_LISTE, [ENTREE_A, ENTREE_B])
  assert.ok(croissanceDesStocks(diff, { registre: REGISTRE }).length > 0, 'témoin positif muet : la mesure ne mesure rien')
  assert.throws(() => croissanceDesStocks({ diff }), /POSITIONNELLE/)
  assert.throws(() => croissanceDesStocks(undefined), /attend le diff en CHAÎNE/)
  assert.throws(() => croissanceDesStocks(null), /attend le diff en CHAÎNE/)
})

// ── LE CLIQUET : la clé DÉCLARÉE au message ──────────────────────────────────────────────────────

test('CLIQUET — le message couvre la clé s’il annonce le BON compte et un motif', () => {
  const post = listeDe('X_STOCK', [ENTREE_A, ENTREE_B])
  const diff = diffDe(F_LISTE, [ENTREE_A, ENTREE_B], [], 2)
  const img = images(post, 'export const X_STOCK = [\n]')
  const couvrant = `T\n\nCLIQUET: ${F_LISTE}#X_STOCK +2 — deux sites mesurés ce jour, extinction sous #9999`
  assert.deepEqual(croissancesNonCouvertes({ diff, message: couvrant }, img), [])
})

// La clé porte la LIAISON, et l'histoire déjà poussée est écrite en `CLIQUET: <fichier> +N`. Les deux
// graphies désignent la MÊME chose quand le fichier ne porte QU'UNE liaison déclarée : le fichier
// seul couvre alors. Dès qu'il en porte deux, il ne désigne plus rien de précis, et il ne couvre pas
// (mesuré : 5 des 7 refus rétroactifs de `a527272d3..HEAD` viennent de cette graphie).
test('CLIQUET — le FICHIER SEUL couvre un fichier à UNE liaison, jamais un fichier qui en porte deux', () => {
  const img = images(listeDe('X_STOCK', [ENTREE_A, ENTREE_B]), 'export const X_STOCK = [\n]')
  const diff = diffDe(F_LISTE, [ENTREE_A, ENTREE_B], [], 2)
  const surLeFichier = (f) => `T\n\nCLIQUET: ${f} +2 — deux sites mesurés ce jour, extinction sous #9999`

  // `F_LISTE` porte DEUX liaisons déclarées (`X_STOCK`, `X_AUTRE`) : le fichier seul ne couvre rien.
  assert.equal(
    croissancesNonCouvertes({ diff, message: surLeFichier(F_LISTE) }, img).length, 1,
    'deux liaisons déclarées : `CLIQUET: <fichier>` ne dit pas LAQUELLE a grandi',
  )
  // Le MÊME diff sur un fichier à UNE seule liaison déclarée : la graphie courte couvre.
  const uneSeule = { entrees: [declaration(F_OBJET, 'PAR_TYPE', 'liste')] }
  const diffUnique = diffDe(F_OBJET, [ENTREE_A, ENTREE_B], [], 2)
  const imgUnique = {
    registre: uneSeule,
    lirePostImage: () => listeDe('PAR_TYPE', [ENTREE_A, ENTREE_B]),
    lirePreImage: () => 'export const PAR_TYPE = [\n]',
  }
  assert.equal(croissanceDesStocks(diffUnique, imgUnique)[0].seule, true)
  assert.deepEqual(
    croissancesNonCouvertes({ diff: diffUnique, message: surLeFichier(F_OBJET) }, imgUnique), [],
    'une seule liaison déclarée : `CLIQUET: <fichier>` désigne la même chose que `<fichier>#<LIAISON>`',
  )
})

// UNE DÉCLARATION NE JUGE PAS LE PASSÉ. Une porte juge les commits qui la PORTENT, et le registre EST
// la porte : `croissancesDeLaPlage` lit `scripts/hooks/stocks.json` TEL QU'IL EST au commit jugé.
// Sans cette règle, déclarer aujourd'hui un stock que l'ancienne porte ne voyait pas rougissait des
// commits déjà poussés dont AUCUN message ne pouvait porter le cliquet (mesuré : 2 refus rétroactifs
// sur `a527272d3..HEAD`, `ops.ts#OPS_CTX_GELES +5` et `check-doc-refs.mjs#HOOK_SITES_EXEMPTS +1`).
test('plage — une déclaration ne compte QUE depuis le commit qui la porte', () => {
  const repo = mkdtempSync(join(tmpdir(), 'plage-registre-'))
  const jouer = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    jouer('init', '-q', '-b', 'main')
    jouer('config', 'user.email', 'sonde@test')
    jouer('config', 'user.name', 'sonde')
    jouer('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'scripts', 'guards', 'lib'), { recursive: true })
    mkdirSync(join(repo, 'scripts', 'hooks'), { recursive: true })
    const porteur = 'scripts/guards/lib/xStock.mjs'
    const source = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`
    writeFileSync(join(repo, porteur), source([]), 'utf8')
    jouer('add', '-A'); jouer('commit', '-q', '--no-verify', '-m', 'socle')
    // Commit 2 : le stock GRANDIT, et rien ne le déclare encore.
    writeFileSync(join(repo, porteur), source([ENTREE_A, ENTREE_B]), 'utf8')
    jouer('add', '-A'); jouer('commit', '-q', '--no-verify', '-m', 'deux de plus, sans cliquet')
    const shas = jouer('rev-list', '--reverse', 'HEAD').trim().split('\n')
    assert.deepEqual(
      croissancesDeLaPlage({ cwd: repo, avant: shas[0], apres: shas[1] }).refus, [],
      'aucun registre à ce commit : la porte n’y déclare aucun stock, elle ne juge rien',
    )
    // Commit 3 : la DÉCLARATION arrive. La croissance du commit 2 reste hors de son atteinte.
    writeFileSync(join(repo, 'scripts', 'hooks', 'stocks.json'), `${JSON.stringify({
      _entete: ['registre du dépôt jetable de ce test'],
      entrees: [{ fichier: porteur, liaison: 'STOCK', forme: 'liste', role: 'stock', cible: 0, raison: 'porteur de fixture de la porte de plage.' }],
    }, null, 2)}\n`, 'utf8')
    jouer('add', '-A'); jouer('commit', '-q', '--no-verify', '-m', 'le registre déclare le stock')
    const apres = jouer('rev-parse', 'HEAD').trim()
    assert.deepEqual(
      croissancesDeLaPlage({ cwd: repo, avant: shas[0], apres }).refus, [],
      'la déclaration ne rougit pas la croissance d’AVANT elle — aucun message ne pouvait la dire',
    )
    // Commit 4 : le MÊME stock grandit, sous la déclaration. Là, il est jugé.
    writeFileSync(join(repo, porteur), source([ENTREE_A, ENTREE_B, ENTREE_CLE]), 'utf8')
    jouer('add', '-A'); jouer('commit', '-q', '--no-verify', '-m', 'une de plus, toujours sans cliquet')
    const tete = jouer('rev-parse', 'HEAD').trim()
    assert.deepEqual(
      croissancesDeLaPlage({ cwd: repo, avant: apres, apres: tete }).refus
        .map((r) => [r.cle, r.net]), [[`${porteur}#STOCK`, 1]],
      'sous la déclaration, la croissance suivante est refusée',
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// RÉTROGRADER une liaison au registre (`stock` → `descripteur`/`derive`) éteint son comptage : c'est
// le chemin le plus court pour « solder » une dette, et il doit se DIRE comme une croissance.
test('registre — une RÉTROGRADATION de rôle est comptée comme une croissance, et se déclare', () => {
  const doc = (role) => `${JSON.stringify({
    _entete: ['registre du test'],
    entrees: [{
      fichier: F_LISTE, liaison: 'X_STOCK', forme: 'liste', role, cible: role === 'stock' ? 0 : null,
      raison: 'porteur de fixture de la porte de stock.',
    }],
  }, null, 2)}\n`
  const chemin = 'scripts/hooks/stocks.json'
  const diff = [`--- a/${chemin}`, `+++ b/${chemin}`, '@@ -6,1 +6,1 @@', '-      "role": "stock",', '+      "role": "descripteur",'].join('\n')
  const img = { lirePostImage: () => doc('descripteur'), lirePreImage: () => doc('stock') }
  const [c] = croissanceDesStocks(diff, img)
  assert.deepEqual(
    [c?.cle, c?.net, c?.exemples], [`${chemin}#${F_LISTE}#X_STOCK`, 1, [`${F_LISTE}#X_STOCK : stock → descripteur`]],
    'la PERTE DE VUE d’un stock déclaré est une croissance — la clé nomme le registre ET le stock perdu',
  )
  const message = `T\n\nCLIQUET: ${chemin}#${F_LISTE}#X_STOCK +1 — la liaison n’est plus un stock, raison mesurée`
  assert.deepEqual(croissancesNonCouvertes({ diff, message }, img), [], 'déclarée, la rétrogradation passe')
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => doc('stock'), lirePreImage: () => doc('stock') }), [],
    'un registre inchangé dans son rôle ne rend rien',
  )
})

// LE REGISTRE N'EST PAS UN STOCK : ajouter une DÉCLARATION dit ce qui EXISTE, et n'exige aucun
// `CLIQUET:`. Sans cela, sortir un stock de l'ombre coûterait le prix de le faire grossir.
test('registre — AJOUTER une déclaration n’exige aucun CLIQUET', () => {
  const chemin = 'scripts/hooks/stocks.json'
  const entree = (liaison, role = 'stock') => ({
    fichier: F_LISTE, liaison, forme: 'liste', role, cible: role === 'stock' ? 0 : null,
    raison: 'porteur de fixture de la porte de stock.',
  })
  const doc = (entrees) => `${JSON.stringify({ _entete: ['registre du test'], entrees }, null, 2)}\n`
  const avant = doc([entree('X_STOCK')])
  const apres = doc([entree('X_STOCK'), entree('X_AUTRE')])
  const diff = [
    `--- a/${chemin}`, `+++ b/${chemin}`, '@@ -10,0 +11,7 @@',
    ...apres.split('\n').slice(10, 17).map((l) => `+${l}`),
  ].join('\n')
  assert.deepEqual(
    croissanceDesStocks(diff, { lirePostImage: () => apres, lirePreImage: () => avant }), [],
    'une déclaration de PLUS ne compte rien : le registre n’est pas un stock',
  )
})

test('CLIQUET — un compte FAUX ou un motif de tampon ne couvre rien, et le refus le dit', () => {
  const post = listeDe('X_STOCK', [ENTREE_A, ENTREE_B])
  const diff = diffDe(F_LISTE, [ENTREE_A, ENTREE_B], [], 2)
  const img = images(post, 'export const X_STOCK = [\n]')
  const fauxCompte = `CLIQUET: ${F_LISTE}#X_STOCK +1 — motif suffisamment long pour passer`
  const [c] = croissancesNonCouvertes({ diff, message: fauxCompte }, img)
  assert.deepEqual([c.net, c.declare], [2, 1])
  assert.match(raisonDeRefus([c]), /annonce `\+1`, pas \+2/)
  const tampon = `CLIQUET: ${F_LISTE}#X_STOCK +2 — besoin`
  assert.equal(croissancesNonCouvertes({ diff, message: tampon }, img).length, 1)
  assert.equal(cliquetsDuMessage(tampon).length, 0, 'un motif sous le seuil n’est pas un cliquet')
})

test('refus — nomme la CLÉ, le compte et jusqu à trois exemples', () => {
  const membres = [ENTREE_A, ENTREE_B, ENTREE_CLE, "  'src/ui/Tabs.tsx',"]
  const raison = raisonDeRefus(croissanceDesStocks(
    diffDe(F_LISTE, membres, [], 2),
    images(listeDe('X_STOCK', membres), 'export const X_STOCK = [\n]'),
  ))
  assert.match(raison, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
  assert.match(raison, /xStock\.mjs#X_STOCK : \+4 entrée\(s\) nette\(s\)/)
  assert.equal(raison.split(' · ').length, 3, 'trois exemples, pas la liste entière')
  assert.match(raison, /CLIQUET: <fichier>#<LIAISON> \+N/)
})

// ── LES PORTEURS RÉELS : la déclaration lit ce que le fichier porte ───────────────────────────────
//
// Un stock est une DETTE vers zéro : son cardinal décroît (mesuré — la fusion des matières du monde
// a fait passer `slotsStock` de 339 à 338). Un test qui fige ce cardinal se casse sur le travail
// qu'il devrait saluer. Ce qui ne bouge pas, c'est que CHAQUE liaison déclarée `stock` d'un porteur
// réel rende des entrées : une déclaration qui n'en rend aucune est une porte aveugle sur ce stock.

test('porteurs réels — chaque liaison déclarée `stock` rend des entrées sur l’arbre', (t) => {
  const porteurs = [
    'scripts/guards/lib/slotsStock.mjs',
    'scripts/guards/lib/structuresStock.mjs',
    'scripts/guards/lib/legacyVocabStock.mjs',
    'scripts/hooks/ecrans-ui.json',
    'src/data/field-consumers.test.ts',
    'src/data/schemas/grammaire/prose-inline.ts',
    'src/ui/compendium/registry-enveloppe.test.ts',
  ]
  for (const rel of porteurs) {
    const contenu = readFileSync(join(RACINE, rel), 'utf8')
    const declarations = declarationsDe(rel).filter((d) => d.forme !== 'plafond')
    assert.ok(declarations.length > 0, `${rel} : aucune liaison déclarée \`stock\``)
    for (const d of declarations) {
      const n = (entreesDeStock(contenu, rel, [d]) ?? []).length
      t.diagnostic(`${rel}#${d.liaison} — ${n} entrée(s)`)
      assert.ok(n > 0, `${rel}#${d.liaison} : la déclaration ne rend AUCUNE entrée — porte aveugle`)
    }
  }
})

// Le train B a fait passer la 3e colonne de `RECOUVRES` de `src/engine/critical.ts:327` à
// `src/engine/critical.ts @repeat` : un jeton ` @symbole` que la lecture PAR LIGNE ne reconnaît pas,
// et les 11 entrées de ce stock RÉEL étaient sorties de la vue de la porte sans un mot (grounding C,
// A-bis). La lecture PAR DÉCLARATION compte les ÉLÉMENTS du tableau, quelle que soit la graphie de
// ce qu'ils portent : c'est fermé par construction, et ce test le tient sur le fichier RÉEL.
test('RECOUVRES — une entrée de plus est comptée quelle que soit la GRAPHIE de son jeton', () => {
  const f = 'src/data/field-consumers.test.ts'
  const declarations = declarationsDe(f).filter((d) => d.liaison === 'RECOUVRES')
  assert.equal(declarations.length, 1, `${f}#RECOUVRES : déclaration absente du registre`)
  const avant = readFileSync(join(RACINE, f), 'utf8')
  const NEUVE = "  ['Neuf', 'champ', 'src/engine/critical.ts @neuf'],"
  const lignes = avant.split('\n')
  const derniere = entreesDeStock(avant, f, declarations).at(-1).ligne
  const apres = [...lignes.slice(0, derniere), NEUVE, ...lignes.slice(derniere)].join('\n')
  const diff = [
    `--- a/${f}`, `+++ b/${f}`, `@@ -${derniere},0 +${derniere + 1},1 @@`, `+${NEUVE}`,
  ].join('\n')
  const [c] = croissanceDesStocks(diff, { lirePostImage: () => apres, lirePreImage: () => avant })
  assert.deepEqual([c?.cle, c?.net], [`${f}#RECOUVRES`, 1])
})

// ── Les FENÊTRES : ce que la porte voit sur des commits RÉELS ─────────────────────────────────────
//
// Chaque fenêtre est une FIXTURE (shas figés) réduite au plus petit intervalle qui porte ENCORE son
// événement : un `git show` par porteur et par commit, plus un parse AST de chaque image, se paie au
// commit. La fenêtre unique 2c11fdd9a..f0f9436f5 (27 commits) coûtait 66,5 s à elle seule ; les trois
// événements qu'elles portent vivent chacun dans UN commit, mesuré (#1679 L3b) :
//   · `02cc09c04` fait CROÎTRE `slotsStock` (335→336) pendant que `structuresStock` DÉCROÎT :
//     les deux plus gros stocks du dépôt, comptés aux deux bornes, un rendu et l'autre pas ;
//   · `c8d3105ae` fait croître un registre à clés en NOM DE FICHIER, au MILIEU de la plage ;
//   · `a9b7edf17` fait croître un stock OBJET dont les valeurs sont des RUBRIQUES, avec un `CLIQUET:`
//     au message qui annonce le MAUVAIS compte — c'est `declare` qui prouve que la porte le LIT.
//
// Ces commits sont ANTÉRIEURS au registre : la plage leur passerait un registre VIDE (une porte juge
// les commits qui la portent). Les fenêtres FORCENT donc le leur, et ce registre figé dit exactement
// ce que la fenêtre mesure.
const FENETRE_STOCKS = { avant: '571f54287', apres: '02cc09c04' }
const FENETRE_REGISTRE = { avant: '2c11fdd9a', apres: 'c8d3105ae' }
const FENETRE_STOCK_OBJET = { avant: 'da3acf95c', apres: 'a9b7edf17' }
/** Déclaration figée d'une fenêtre : ce que la porte y compte, et rien d'autre. */
const fige = (fichier, liaison, forme) => ({
  fichier, liaison, forme, role: 'stock', cible: 0, raison: 'porteur figé d’une fenêtre de la porte de stock.',
})
const REGISTRE_FENETRES = { entrees: [
  fige('scripts/guards/lib/slotsStock.mjs', 'SLOTS_SANS_DECLARATION', 'liste'),
  fige('scripts/guards/lib/structuresStock.mjs', 'STRUCTURES_ORPHELINES', 'liste'),
  fige('scripts/guards/lib/structuresStock.mjs', 'STRUCTURES_OPS', 'liste'),
  fige('scripts/guards/lib/structuresStock.mjs', 'STRUCTURES_FORMES', 'liste'),
  fige('src/state/flowtest-derived-stake.test.ts', 'AUTO_RESOLUS', 'objet'),
  fige('scripts/gates/ecrivainsAtteints.test.mjs', 'ATTENDU', 'objet'),
] }
const gitOuNull = (...args) => {
  try { return git(...args) } catch { return null }
}
const imagesDe = (avant, apres) => ({
  registre: REGISTRE_FENETRES,
  lirePostImage: (f) => gitOuNull('show', `${apres}:${f}`),
  lirePreImage: (f) => gitOuNull('show', `${avant}:${f}`),
})
const declarationsFigees = (f) => REGISTRE_FENETRES.entrees.filter((e) => e.fichier === f)

test('fenêtre — les deux plus gros stocks du dépôt sont comptés à l’entrée comme à la sortie', () => {
  const slots = 'scripts/guards/lib/slotsStock.mjs'
  const structures = 'scripts/guards/lib/structuresStock.mjs'
  const compte = (sha, rel) => entreesDeStock(gitOuNull('show', `${sha}:${rel}`), rel, declarationsFigees(rel)).length
  assert.deepEqual([compte(FENETRE_STOCKS.avant, slots), compte(FENETRE_STOCKS.apres, slots)], [335, 336])
  assert.ok(
    compte(FENETRE_STOCKS.apres, structures) < compte(FENETRE_STOCKS.avant, structures),
    '`structuresStock` DÉCROÎT sur la fenêtre',
  )

  const cumule = git('diff', '-U0', '--no-renames', `${FENETRE_STOCKS.avant}..${FENETRE_STOCKS.apres}`)
  const croissances = croissanceDesStocks(cumule, imagesDe(FENETRE_STOCKS.avant, FENETRE_STOCKS.apres))
  const parCle = new Map(croissances.map((c) => [c.cle, c]))
  assert.deepEqual(
    [parCle.get(`${slots}#SLOTS_SANS_DECLARATION`)?.ajoutees, parCle.get(`${slots}#SLOTS_SANS_DECLARATION`)?.retirees,
      parCle.get(`${slots}#SLOTS_SANS_DECLARATION`)?.net], [2, 1, 1],
    'la croissance NETTE de `slotsStock` sur la fenêtre est rendue, sous sa liaison',
  )
  assert.equal(
    croissances.some((c) => c.fichier === structures), false,
    '`structuresStock` DÉCROÎT sur la fenêtre : rien à rendre',
  )
})

test('fenêtre — les croissances non couvertes de la plage, par commit', (t) => {
  const { refus } = croissancesDeLaPlage({ cwd: RACINE, ...FENETRE_REGISTRE, registre: REGISTRE_FENETRES })
  const vus = refus.map((r) => `${r.sha.slice(0, 9)} ${r.cle} +${r.net}`)
  for (const v of vus) t.diagnostic(v)
  assert.ok(
    vus.includes('c8d3105ae src/state/flowtest-derived-stake.test.ts#AUTO_RESOLUS +2'),
    'la croissance du registre `AUTO_RESOLUS` (clés en NOM DE FICHIER) reste rendue, au MILIEU de la plage',
  )
  // Le MÊME commit fait DÉCROÎTRE `structuresStock` (1047 → 1046, mesuré) : la plage le lit et ne le
  // refuse pas — c'est le contrôle négatif, sur le commit même qui porte le contrôle positif.
  assert.equal(
    refus.some((r) => r.fichier === 'scripts/guards/lib/structuresStock.mjs'), false,
    'un stock qui décroît sur la plage n’est jamais refusé',
  )
})

test('fenêtre — un stock OBJET à RUBRIQUES est rendu, et le CLIQUET du message est LU', () => {
  const { refus } = croissancesDeLaPlage({ cwd: RACINE, ...FENETRE_STOCK_OBJET, registre: REGISTRE_FENETRES })
  const ecrivains = refus.find((r) => r.fichier === 'scripts/gates/ecrivainsAtteints.test.mjs')
  // `declare` = ce que le message ANNONCE (`CLIQUET: scripts/gates/ecrivainsAtteints.test.mjs +53`,
  // sur le FICHIER seul — graphie couverte parce que ce fichier ne porte QU'UNE liaison déclarée).
  // Il vaut 53 et la croissance 63 : le refus tient, ET il prouve que le cliquet a été lu.
  assert.deepEqual(
    [ecrivains?.sha.slice(0, 9), ecrivains?.cle, ecrivains?.net, ecrivains?.declare],
    ['a9b7edf17', 'scripts/gates/ecrivainsAtteints.test.mjs#ATTENDU', 63, 53],
    'un stock OBJET dont les valeurs sont des RUBRIQUES est rendu — la définition tableau-seul le perdait',
  )
})

// ── La mesure sur le dépôt RÉEL ───────────────────────────────────────────────────────────────────

test('CLIQUET stocks : la PLAGE POUSSÉE ne fait grossir aucun stock en silence', (t) => {
  if (!porteEnVigueur()) {
    t.diagnostic(
      `HEAD (${git('rev-parse', '--short', 'HEAD').trim()}) est ANTÉRIEUR à cette porte : sa lib n'y ` +
        'est pas, la règle ne juge que les commits qui la portent.',
    )
    return
  }
  exigerHistoireComplete()
  const { refus, notes, commits } = croissancesDeLaPlage({
    cwd: RACINE, avant: debutDeLaPlage(), apres: git('rev-parse', 'HEAD').trim(),
  })
  for (const n of notes) t.diagnostic(n)
  if (commits !== undefined) t.diagnostic(`${commits} commit(s) jugé(s)`)
  assert.deepEqual(
    refus.map((r) => `${r.sha.slice(0, 9)} ${r.cle} +${r.net}`), [],
    raisonDeRefusDePlage(refus),
  )
})
