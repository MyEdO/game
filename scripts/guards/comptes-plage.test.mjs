// PORTE DES COMPTES (#2705, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) sur un dépôt jetable : chaque
// borne de la plage mesurée dans SON image, et aucune ligne de message n'admet une hausse.
//   node --test scripts/guards/comptes-plage.test.mjs   (joué par `npm run test:hooks`, racine scripts/guards)
// La mesure est TypeScript : elle tourne dans un processus enfant `tsx`, sous l'env d'un dépôt forgé (`envDeDepotForge`).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { envDeDepotForge, forgerDepot } from './lib/depotGabarit.mjs'
import { commitDe, depotDe, listerImage, reussi, shaDe } from './lib/gitPorte.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))

/** Longueur maximale des chemins d'un `git add` : sous la ligne de commande de win32 (32 767 caractères). */
const LIGNE_MAX = 24_000

/** `chemins` en lots dont la somme des longueurs reste sous `LIGNE_MAX`. */
function enLots(chemins) {
  const lots = [[]]
  let longueur = 0
  for (const c of chemins) {
    if (longueur + c.length + 1 > LIGNE_MAX && lots.at(-1).length) {
      lots.push([])
      longueur = 0
    }
    lots.at(-1).push(c)
    longueur += c.length + 1
  }
  return lots
}

/** Une op du premier tableau d'ops de `donnee` qui satisfait `choisir`, et ce tableau. */
function opDe(donnee, choisir) {
  const pile = [donnee]
  while (pile.length) {
    const v = pile.pop()
    if (!v || typeof v !== 'object') continue
    if (Array.isArray(v)) {
      const op = v.find((x) => x && typeof x === 'object' && typeof x.op === 'string' && choisir(x))
      if (op) return { op, tableau: v }
    }
    pile.push(...Object.values(v))
  }
  throw new Error('aucune op ne répond au choix')
}

/** `texte` de `spells.json` où la première op qui satisfait `choisir` est doublée dans son tableau. */
const ajouterOp = (choisir) => (texte) => {
  const spells = JSON.parse(texte)
  const { op, tableau } = opDe(spells, choisir)
  tableau.push({ ...op })
  return JSON.stringify(spells)
}

/** Les verdicts de `jugerLesComptes` sur chaque `[base, tete]` du dépôt `racine`, dans UN processus `tsx` (la mesure
 *  d'un commit s'y mémoïse), sous l'env d'un dépôt forgé. Les verdicts sont la DERNIÈRE ligne de sa sortie : `genererCode`
 *  imprime son bilan sur la même. */
function jugerDansTsx(racine, plages) {
  const module = (rel) => JSON.stringify(pathToFileURL(join(RACINE, rel)).href)
  const code = [
    `import { depotDe } from ${module('scripts/guards/lib/gitPorte.mjs')};`,
    `import { jugerLesComptes } from ${module('scripts/guards/lib/corpusDesComptes.mts')};`,
    'const [racine, plages] = JSON.parse(process.argv[1]);',
    'const depot = depotDe(racine);',
    'const verdicts = plages.map(([base, tete]) => jugerLesComptes({ depot, base, tete }));',
    'process.stdout.write(`\\n${JSON.stringify(verdicts)}\\n`);',
  ].join('\n')
  const vu = spawnSync(process.execPath, [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), '--input-type=module', '-e', code, '--', JSON.stringify([racine, plages])], {
    cwd: RACINE, env: envDeDepotForge(), encoding: 'utf8', maxBuffer: 1 << 26,
  })
  assert.equal(vu.status, 0, `mesure tsx en échec (${vu.status ?? vu.signal}) : ${vu.stderr}`)
  return JSON.parse(vu.stdout.trimEnd().split('\n').at(-1))
}

test('jugerLesComptes : une op TYPÉE ajoutée passe ; un schéma qui régresse et une op NON TYPÉE ajoutée sont refusés, MÊME sous `CLIQUET:`', { timeout: 300_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-plage-'))
  try {
    const reel = depotDe(RACINE, { env: envDeDepotForge() })
    const suivis = listerImage(reel, 'HEAD', 'src', 'Source')
    for (const rel of suivis) {
      mkdirSync(dirname(join(dossier, rel)), { recursive: true })
      writeFileSync(join(dossier, rel), readFileSync(join(RACINE, rel)))
    }
    const depot = forgerDepot(dossier)
    for (const lot of enLots(suivis)) assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: lot })), 'commit de fondation')
    const commiter = (muter, message) => {
      for (const [rel, f] of Object.entries(muter)) writeFileSync(join(dossier, rel), f(readFileSync(join(dossier, rel), 'utf8')), 'utf8')
      assert.ok(reussi(commitDe(depot, { message, chemins: Object.keys(muter) })), message)
      return shaDe(depot, 'HEAD')
    }
    const fondation = shaDe(depot, 'HEAD')
    const typee = commiter({ 'src/data/spells.json': ajouterOp((o) => o.op === 'reduceDiseaseDays') }, 'op typée')
    const lache = commiter({
      'src/data/schemas/defs/creatures.ts': (t) => t.replace('skills: z.array(competenceChiffreeAEmplacementSchema),', 'skills: z.array(z.any()),').replace("spells: refs('spell'),", 'spells: z.array(z.string()),'),
      'src/data/spells.json': ajouterOp((o) => o.op === 'freeReroll'),
    }, 'schéma et op\n\nCLIQUET: scripts/guards/lib/structuresStock.mjs +1 — op de plus, déclarée au message')

    const [passe, refus] = jugerDansTsx(dossier, [[fondation, typee], [typee, lache]])
    assert.equal(passe.ok, true, passe.texte)
    assert.equal(refus.ok, false, refus.texte)
    const lignes = refus.texte.split('\n').filter((l) => l.startsWith('  ['))
    assert.deepEqual(lignes.map((l) => l.replace(/ — .*/, '')), [
      '  [détecteur de la tête] STRUCTURES_OPS : freeReroll | op | spells.json',
      '  [détecteur de la tête] SLOTS_SANS_DECLARATION : creatures.json | skills',
      '  [détecteur de la tête] SLOTS_SANS_DECLARATION : creatures.json | spells',
    ], refus.texte)
    assert.match(refus.texte, /STRUCTURES_OPS : freeReroll \| op \| spells\.json — HAUSSE \d+ > \d+ : la dette GRANDIT\./)
    assert.match(refus.texte, /SLOTS_SANS_DECLARATION : creatures\.json \| skills — site NEUF : la dette NAÎT\./)
    assert.match(refus.texte, /SLOTS_SANS_DECLARATION : creatures\.json \| spells — site NEUF : la dette NAÎT\./)
    assert.match(refus.texte, /aucun `CLIQUET:` ne les couvre/)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
