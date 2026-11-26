// La serrure des lectures brutes (#5037) : une lecture `node:fs` de `projets/` de ce dépôt lève le refus de la serrure,
// sauf par un module dont la clôture d'imports atteint la serrure ou la porte. Chaque lecteur est un module de fixture
// hors du dépôt, que la pile désigne comme le module qui lit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import './intercepterLecturesDesProjets.mjs'
import { clotureDImports } from './importGraph.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const DEPOT = join(ICI, '..', '..', '..')
const MODULE_DU_ROGUELITE = join(DEPOT, 'projets', 'roguelite', 'src', 'figures.ts')
/** Le refus de la serrure. Ce banc n'importe ni la serrure ni la porte : il serait, sur la pile, un module qui admet. */
const REFUS = /couvre projets\/ sans passe qui l'admette/

const LECTEUR = `import fs from 'node:fs'
export const lire = (p) => fs.readFileSync(p, 'utf8')
export const lister = (p, options) => fs.readdirSync(p, options)
export const lirePlusTard = (p) => fs.promises.readFile(p, 'utf8')
`

/** Le module lecteur `nom` de fixture sous `dossier`, hors du dépôt, précédé des imports `imports`. */
async function lecteur(dossier, nom, imports = '') {
  writeFileSync(join(dossier, `${nom}.mjs`), imports + LECTEUR)
  return import(pathToFileURL(join(dossier, `${nom}.mjs`)).href)
}

/** L'import du module `module` de ce dossier, depuis `dossier`. */
const importDe = (dossier, module) => `import '${relative(dossier, join(ICI, module)).split('\\').join('/')}'\n`

test('une lecture brute de projets/ lève le refus de la serrure ; la serrure importée ou la porte atteinte l\'admet', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'serrure-des-lectures-'))
  try {
    const nu = await lecteur(dossier, 'nu')
    const porte = await lecteur(dossier, 'porte', importDe(dossier, 'porteDesProjets.mjs'))
    const passerelle = await lecteur(dossier, 'passerelle', importDe(dossier, 'serrureDesProjets.mjs'))
    const relais = await lecteur(dossier, 'relais', "import './porte.mjs'\n")
    const client = await lecteur(dossier, 'client', importDe(dossier, 'lister.mjs'))
    assert.throws(() => nu.lire(MODULE_DU_ROGUELITE), REFUS)
    assert.throws(() => client.lire(MODULE_DU_ROGUELITE), REFUS, 'importer une passerelle n\'est pas passer la porte')
    assert.throws(() => nu.lister(join(DEPOT, 'projets')), REFUS)
    assert.throws(() => nu.lister(DEPOT, { recursive: true }), REFUS, 'une marche récursive d\'un ancêtre y descend')
    await assert.rejects(() => nu.lirePlusTard(MODULE_DU_ROGUELITE), REFUS)
    assert.ok(nu.lister(DEPOT).includes('projets'), 'nommer le dossier des projets n\'est pas le lire')
    assert.match(nu.lire(join(DEPOT, 'package.json')), /\S/, 'hors de projets/ : rien à garder')
    assert.match(porte.lire(MODULE_DU_ROGUELITE), /\S/)
    assert.match(passerelle.lire(MODULE_DU_ROGUELITE), /\S/)
    assert.match(relais.lire(MODULE_DU_ROGUELITE), /\S/, 'la clôture d\'imports qui atteint la porte l\'admet')
    assert.ok(porte.lister(DEPOT, { recursive: true }).length > 0)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('un refus levé dans le `lire` d\'un arbre de clotureDImports remonte, jamais lu comme un module illisible', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'serrure-des-lectures-arbre-'))
  try {
    const nu = await lecteur(dossier, 'nu')
    const racine = join(DEPOT, 'scripts', 'sonde-de-la-serrure.mjs').split('\\').join('/')
    const arbre = { existe: (abs) => abs === racine, lire: (abss) => new Map(abss.map((abs) => [abs, nu.lire(MODULE_DU_ROGUELITE)])) }
    assert.throws(() => clotureDImports(['scripts/sonde-de-la-serrure.mjs'], { racine: DEPOT, arbre }), REFUS)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
