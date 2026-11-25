// PORTE DES COMPTES (#2705, #2969, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) sur une COPIE du dépôt
// réel (`src`, `Source`, `docs/dossiers`, les lectures des générateurs, `scripts`) : un balayage du dépôt réel, joué
// sans concurrence (#2586, #5037).
//   node --test scripts/corpus-isole/guards/comptes-plage-depot-reel.test.mjs   (gate `test:corpus-isole`)
// La mesure est TypeScript : elle tourne dans des processus enfants `tsx`, sous l'env d'un dépôt forgé (`envDeDepotForge`).
// Sur des dépôts jetables : scripts/guards/comptes-plage.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { RACINE, lancementDuJugement } from '../../guards/lib/comptesPlage.testkit.mjs'
import { envDeDepotForge, forgerDepot } from '../../guards/lib/depotGabarit.mjs'
import { enFileBornee } from '../../guards/lib/fileBornee.mjs'
import { SUIVI, commitDe, depotDe, listerImage, reussi, shaDe } from '../../guards/lib/gitPorte.mjs'
import { spawnBorne } from '../../guards/lib/processusBorne.mjs'
import { cleDeSite } from '../../guards/lib/stock.mjs'
import { LUS_PAR_LES_GENERATEURS } from '../../docs/build-all.mjs'
import { coeurs } from '../../test/partition.mjs'

/** Échéance d'un processus de jugement mené de front. */
const ECHEANCE_MS = 900_000

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

/** Les verdicts de chaque groupe de plages de `groupes`, un processus `tsx` par groupe, menés de front par
 *  `enFileBornee`, un par cœur (`coeurs`), lancés par `spawnBorne` et arrêtés avec `signal` (#2586) : un commit que deux
 *  plages d'un MÊME groupe partagent ne s'y mesure qu'une fois. */
async function jugerDeFront(racine, groupes, signal) {
  const journaux = mkdtempSync(join(tmpdir(), 'comptes-plage-jugements-'))
  try {
    return await enFileBornee(groupes.map((plages, i) => async (s) => {
      const r = await spawnBorne({
        ...lancementDuJugement(racine, plages), fichier: join(journaux, `${i}.log`), limiteMs: ECHEANCE_MS,
        signal: s, fluxDistincts: true, site: `comptes-plage/jugement ${i}`,
      })
      assert.equal(r.code, 0, `mesure tsx en échec (${r.status ?? r.signal}${r.error ? `, ${r.error.code ?? ''} ${r.error.message}` : ''}) : ${r.stderr}`)
      return JSON.parse(r.stdout)
    }), { deFront: coeurs(process.env, availableParallelism), signal })
  } finally {
    rmSync(journaux, { recursive: true, force: true })
  }
}

/** `texte` où `avant`, présent, devient `apres`. */
const remplacer = (avant, apres) => (texte) => {
  assert.ok(texte.includes(avant), `motif absent : ${avant}`)
  return texte.replace(avant, apres)
}

/** `texte` suivi de `ajout`. */
const ajouter = (ajout) => (texte) => `${texte}${ajout}`

test('jugerLesComptes : une op ajoutée à la donnée, typée ou non, passe ; un schéma qui régresse et une op inscrite à `OPS_NON_TYPEES` sont refusés, MÊME sous `CLIQUET:` ; un générateur et le src, ou le détecteur, qui lit sa sortie, changés ensemble, se lient ; un CLASSEMENT changé sans donnée est une baisse du détecteur, une référence emboîtée une baisse de donnée (#2969)',{ timeout: 900_000 }, async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-plage-'))
  try {
    const reel = depotDe(RACINE, { env: envDeDepotForge() })
    const suivis = listerImage(reel, SUIVI, 'src', 'Source', 'docs/dossiers', ...LUS_PAR_LES_GENERATEURS, 'scripts', 'package.json', 'tsconfig.json')
    const mecanique = 'src/data/schemas/grammaire/mecanique.ts'
    const registreDOp = 'export const OPS_NON_TYPEES: readonly string[] = '
    const opNonTypeeDeDonnee = 'sondeDonneeNonTypee'
    const stockInitial = registreDOp + JSON.stringify([opNonTypeeDeDonnee]) + ';'
    const introduireLeStock = remplacer(registreDOp + '[];', stockInitial)
    for (const rel of suivis) {
      mkdirSync(dirname(join(dossier, rel)), { recursive: true })
      const source = readFileSync(join(RACINE, rel))
      writeFileSync(join(dossier, rel), rel === mecanique ? introduireLeStock(source.toString('utf8')) : source)
    }
    const depot = forgerDepot(dossier)
    for (const lot of enLots(suivis)) assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: lot })), 'commit de fondation')
    const commiter = (muter, message) => {
      for (const [rel, f] of Object.entries(muter)) writeFileSync(join(dossier, rel), f(readFileSync(join(dossier, rel), 'utf8')), 'utf8')
      assert.ok(reussi(commitDe(depot, { message, chemins: Object.keys(muter) })), message)
      return shaDe(depot, 'HEAD')
    }
    const fondation = shaDe(depot, 'HEAD')
    const donnee = commiter({
      'src/data/spells.json': (texte) => {
        const spells = JSON.parse(texte)
        const { op, tableau } = opDe(spells, (o) => o.op === 'reduceDiseaseDays')
        tableau.push({ ...op }, { op: opNonTypeeDeDonnee })
        return JSON.stringify(spells)
      },
    }, 'ops de donnée, typée et non typée')
    const lache = commiter({
      'src/data/schemas/defs/creatures.ts': (texte) => [
        remplacer('z.array(competenceChiffreeAEmplacementSchema)', 'z.array(z.custom<{ value: number }>())'),
        remplacer("spells: refs('spell'),", 'spells: z.array(z.string()),'),
      ].reduce((courant, muter) => muter(courant), texte),
      [mecanique]: remplacer(stockInitial, registreDOp + JSON.stringify([opNonTypeeDeDonnee, 'sondeNonTypee']) + ';'),
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
    // Le classement `estFeuilleDId` (module marqué `MARQUE_DE_CLASSEMENT`) changé sans aucune donnée : sous le
    // détecteur de la base, la tête garde ses feuilles, et la baisse est celle du DÉTECTEUR.
    const registre = 'src/data/schemas/grammaire/interne/feuilles.ts'
    const emboitee = "op: z.literal('contractDisease'), disease: ref('maladie')"
    const plate = "op: z.literal('contractDisease'), disease: idDe('maladie')"
    const avecRefPlate = commiter({ [mecanique]: remplacer(emboitee, plate) }, 'témoin de référence à plat')
    const classementDeLaTete = remplacer('typeDeFeuilleDId(noeud) !== undefined;', "typeDeFeuilleDId(noeud) !== undefined && typeDeFeuilleDId(noeud) !== 'maladie';")
    const reclasse = commiter({ [registre]: classementDeLaTete }, 'classement sans donnée')
    // Une référence emboîtée ferme le site à plat dans le schéma : les deux détecteurs voient la baisse.
    const retire = commiter({
      [registre]: remplacer(" && typeDeFeuilleDId(noeud) !== 'maladie';", ';'),
      [mecanique]: remplacer(plate, emboitee),
    }, 'référence emboîtée')

    const [[passe, refus], [liee], [symetrique], [duDetecteur, deDonnee]] = await jugerDeFront(dossier, [
      [[fondation, donnee], [donnee, lache]],
      [[lache, croisee]],
      [[lecteur, renommee]],
      [[avecRefPlate, reclasse], [avecRefPlate, retire]],
    ], t.signal)
    assert.equal(passe.ok, true, passe.texte)
    assert.doesNotMatch(passe.texte, /paire sautée/, passe.texte)
    assert.equal(refus.ok, false, refus.texte)
    const lignes = refus.texte.split('\n').filter((l) => l.startsWith('  ['))
    const site = (volet, champs, suffixes) => [
      { fichier: 'src/data#creatures', ref: '[].' },
      { fichier: 'src/scenes#projet', ref: '.narratif.presetsPnj[].profil.' },
    ].flatMap((s) => champs.flatMap((c) => suffixes.map((x) => `${volet} : ${cleDeSite({ ...s, ref: s.ref + c + x, occurrence: 1 })}`)))
    const feuilles = site('FEUILLES_D_ID', ['skills', 'spells'], ['', '[]'])
    const locales = site('STRUCTURES_LOCALES', ['skills'], ['[]'])
    const attendues = ['DETTE_OPS : sondeNonTypee | non typée', ...feuilles, ...locales]
    const deLaBase = `détecteur de la base (${donnee.slice(0, 9)})`
    assert.deepEqual(lignes.map((l) => l.replace(/ — .*/, '')), ['détecteur de la tête', deLaBase].flatMap((d) => attendues.map((a) => `  [${d}] ${a}`)), refus.texte)
    assert.equal(liee.ok, true, liee.texte)
    assert.doesNotMatch(liee.texte, /paire sautée/, liee.texte)
    assert.equal(symetrique.ok, true, symetrique.texte)
    assert.doesNotMatch(symetrique.texte, /paire sautée/, symetrique.texte)
    assert.match(refus.texte, /DETTE_OPS : sondeNonTypee \| non typée — site NEUF : la dette NAÎT\. Typer le payload/)
    for (const l of feuilles) assert.ok(refus.texte.includes(`${l} — feuille \`idDe\` RELÂCHÉE : le chemin n’est plus \`idDe\` à la tête (\`libre\`).`), refus.texte)
    for (const l of locales) assert.ok(refus.texte.includes(`${l} — site NEUF : la dette NAÎT. Typer le nœud`), refus.texte)
    assert.match(refus.texte, /aucun `CLIQUET:` ne les couvre/)
    assert.equal(duDetecteur.ok, false, duDetecteur.texte)
    assert.match(duDetecteur.texte, /baisse de détecteur non justifiée exactement par FAUX-POSITIF:/, duDetecteur.texte)
    assert.match(duDetecteur.texte, /FAUX-POSITIF manquant : \["DETTE_OPS","contractDisease \| à plat:disease",1\]/, duDetecteur.texte)
    assert.doesNotMatch(duDetecteur.texte, /paire sautée/, duDetecteur.texte)
    assert.equal(deDonnee.ok, true, deDonnee.texte)
    assert.doesNotMatch(deDonnee.texte, /paire sautée/, deDonnee.texte)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
