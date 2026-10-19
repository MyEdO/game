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
 *  d'un commit s'y mémoïse), sous l'env d'un dépôt forgé. Les verdicts sont sa sortie ENTIÈRE : la génération et la
 *  mesure d'une image tournent dans des processus enfants à sortie capturée. */
function jugerDansTsx(racine, plages) {
  const module = (rel) => JSON.stringify(pathToFileURL(join(RACINE, rel)).href)
  const code = [
    `import { depotDe } from ${module('scripts/guards/lib/gitPorte.mjs')};`,
    `import { jugerLesComptes } from ${module('scripts/guards/lib/corpusDesComptes.mts')};`,
    'const [racine, plages] = JSON.parse(process.argv[1]);',
    'const depot = depotDe(racine);',
    'const verdicts = plages.map(([base, tete]) => jugerLesComptes({ depot, base, tete }));',
    'process.stdout.write(JSON.stringify(verdicts));',
  ].join('\n')
  const vu = spawnSync(process.execPath, [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), '--input-type=module', '-e', code, '--', JSON.stringify([racine, plages])], {
    cwd: RACINE, env: envDeDepotForge(), encoding: 'utf8', maxBuffer: 1 << 26,
  })
  assert.equal(vu.status, 0, `mesure tsx en échec (${vu.status ?? vu.signal}) : ${vu.stderr}`)
  return JSON.parse(vu.stdout)
}

/** `texte` où `avant`, présent, devient `apres`. */
const remplacer = (avant, apres) => (texte) => {
  assert.ok(texte.includes(avant), `motif absent : ${avant}`)
  return texte.replace(avant, apres)
}

/** `texte` suivi de `ajout`. */
const ajouter = (ajout) => (texte) => `${texte}${ajout}`

test('jugerLesComptes : une op TYPÉE ajoutée passe ; un schéma qui régresse et une op NON TYPÉE ajoutée sont refusés, MÊME sous `CLIQUET:` ; un générateur et le src, ou le détecteur, qui lit sa sortie, changés ensemble, se lient',{ timeout: 600_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-plage-'))
  try {
    const reel = depotDe(RACINE, { env: envDeDepotForge() })
    const suivis = listerImage(reel, 'HEAD', 'src', 'Source', 'scripts', 'package.json', 'tsconfig.json')
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
    // Le générateur de la tête importe du src que la base n'a pas, et le src de la tête lit une sortie que le
    // générateur de la base ne produit pas : seule la génération de CHAQUE image par son propre code lie une paire.
    const croisee = commiter({
      'src/data/schemas/grammaire/cle-d-espace.ts': ajouter('\nexport const MARQUE_DE_LA_TETE = 2705;\n'),
      'scripts/gen-espaces.mts': (t) => [
        remplacer("= {};\\n';", "= {};\\nexport const MARQUE_DE_LA_TETE = ' + MARQUE_DE_LA_TETE + ';\\n';"),
        remplacer('= IDS;\\n\\n` +', '= IDS;\\n\\n` +\n    `export const MARQUE_DE_LA_TETE = ${MARQUE_DE_LA_TETE};\\n\\n` +'),
      ].reduce((texte, f) => f(texte), `import { MARQUE_DE_LA_TETE } from '../src/data/schemas/grammaire/cle-d-espace';\n${t}`),
      'src/data/schemas/grammaire/ref.ts': ajouter("\nimport { MARQUE_DE_LA_TETE } from '../_ids.generated';\nexport const MARQUE_LUE = MARQUE_DE_LA_TETE;\n"),
    }, 'générateur et src croisés')
    // Un générateur et le module du DÉTECTEUR qui lit sa sortie, renommés ensemble : le détecteur de la base lit une
    // sortie que le générateur de la tête ne produit plus, et seule la régénération par SES générateurs lie sa paire.
    const lecteur = commiter({
      'scripts/gen-espaces.mts': remplacer('= IDS;\\n\\n` +', '= IDS;\\n\\n` +\n    `export const MARQUE_DU_DETECTEUR = 2705;\\n\\n` +'),
      'scripts/docs/lib/structures-scan.mts': ajouter("\nimport { MARQUE_DU_DETECTEUR } from '../../../src/data/schemas/_ids.generated';\nexport const MARQUE_LUE_PAR_LE_DETECTEUR = MARQUE_DU_DETECTEUR;\n"),
    }, 'générateur et détecteur qui lit sa sortie')
    const renommee = commiter({
      'scripts/gen-espaces.mts': remplacer('MARQUE_DU_DETECTEUR', 'MARQUE_RENOMMEE'),
      'scripts/docs/lib/structures-scan.mts': (t) => remplacer('MARQUE_DU_DETECTEUR', 'MARQUE_RENOMMEE')(t).replaceAll('MARQUE_DU_DETECTEUR', 'MARQUE_RENOMMEE'),
    }, 'générateur et détecteur renommés ensemble')

    const [passe, refus, liee, symetrique] = jugerDansTsx(dossier, [[fondation, typee], [typee, lache], [lache, croisee], [lecteur, renommee]])
    assert.equal(passe.ok, true, passe.texte)
    assert.doesNotMatch(passe.texte, /paire sautée/, passe.texte)
    assert.equal(refus.ok, false, refus.texte)
    const lignes = refus.texte.split('\n').filter((l) => l.startsWith('  ['))
    const attendues = ['STRUCTURES_OPS : freeReroll | op | spells.json', 'SLOTS_SANS_DECLARATION : creatures.json | skills', 'SLOTS_SANS_DECLARATION : creatures.json | spells']
    const deLaBase = `détecteur de la base (${typee.slice(0, 9)})`
    assert.deepEqual(lignes.map((l) => l.replace(/ — .*/, '')), ['détecteur de la tête', deLaBase].flatMap((d) => attendues.map((a) => `  [${d}] ${a}`)), refus.texte)
    assert.equal(liee.ok, true, liee.texte)
    assert.doesNotMatch(liee.texte, /paire sautée/, liee.texte)
    assert.equal(symetrique.ok, true, symetrique.texte)
    assert.doesNotMatch(symetrique.texte, /paire sautée/, symetrique.texte)
    assert.match(refus.texte, /STRUCTURES_OPS : freeReroll \| op \| spells\.json — HAUSSE \d+ > \d+ : la dette GRANDIT\./)
    assert.match(refus.texte, /SLOTS_SANS_DECLARATION : creatures\.json \| skills — site NEUF : la dette NAÎT\./)
    assert.match(refus.texte, /SLOTS_SANS_DECLARATION : creatures\.json \| spells — site NEUF : la dette NAÎT\./)
    assert.match(refus.texte, /aucun `CLIQUET:` ne les couvre/)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
