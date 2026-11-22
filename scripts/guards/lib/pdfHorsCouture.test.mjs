// Banc de la GARDE `pdfHorsCouture.mjs` (#1739) : chaque forme refusée est vue, puis le balayage du
// dépôt entier — fichiers suivis ET non encore indexés.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGISTRE_LIVRES } from '../../raw/_lib.mjs'
import { ECRIT_LU } from '../../gates/toutes.mjs'
import { cleDeLigne, positionsDesAncres } from './stock.mjs'
import { EXEMPTIONS, EXT, estShell, fichiersBalayes, litterauxDe, nomPdf, racinesBalayees, sitesFautifs } from './pdfHorsCouture.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const LITTERAUX = litterauxDe(REGISTRE_LIVRES)

function juger(fichier, source, exemptions = EXEMPTIONS) {
  const texte = source.replace(/\r\n?/g, '\n')
  const entrees = exemptions.filter((e) => e.fichier === fichier)
  const ancres = positionsDesAncres(fichier, texte, entrees.map((e) => e.ancre))
  const fautes = []
  const touchees = new Set()
  for (const site of sitesFautifs(texte, LITTERAUX, { shell: estShell(fichier) })) {
    const ancre = ancres.get(site.ligne)
    if (ancre === undefined) fautes.push(site)
    else touchees.add(ancre)
  }
  return { fautes, vues: entrees.filter((e) => touchees.has(e.ancre)) }
}

test('sitesFautifs : chaque forme refusée est VUE, chacune seule', () => {
  const lits = litterauxDe([{ id: 'x', abbr: 'X', dir: 'Source/Mon Livre', pdf: nomPdf('Autre nom') }])
  const cas = [
    ['litteral-fini', "open('Source/x.§')"],
    ['litteral-fini', 'const p = `${dir}.§`'],
    ['litteral-fini', 'python f"{d}.§"'],
    ['litteral-fini', 'p = "Source/%s.§" % x'],
    ['litteral-fini', "globSync('Source/*.§')"],
    ['extension-seule', "const p = dir + '.§'"],
    ['extension-seule', "x.concat('.§')"],
    ['extension-seule', "[x, '§'].join('.')"],
    ['extension-seule', "path.format({ name: x, ext: '.§' })"],
    ['extension-seule', 'p = x + os.extsep + "§"'],
    ['extension-seule', "f.endsWith('.§')"],
    ['extension-seule', 'Path(x).with_suffix(".§")'],
    ['gabarit-ouvert', 'const c = `marker ${x}.§ --out`'],
    ['filtre-regex', 'const re = /\\.§$/'],
    ...[0, 1, 2, [0, 1, 2]].map((i) => ['glob-classe', `globSync('Source/*.${[...EXT].map((c, j) => ([i].flat().includes(j) ? `[${c}${c.toUpperCase()}]` : c)).join('')}')`]),
    ['glob-alternative', `globSync('Source/*.{${EXT},${EXT.toUpperCase()}}')`],
    ...'@!+*?'.split('').map((p) => ['glob-alternative', `globSync('Source/*.${p}(${EXT}|${EXT.toUpperCase()})')`]),
    ['litteral-coupe', "const p = 'Source/x.p' + 'df'"],
    ['litteral-coupe', "const e = 'p' + 'df'"],
  ]
  for (const [forme, gabarit] of cas) {
    const ligne = gabarit.replaceAll('§', EXT)
    assert.deepEqual(sitesFautifs(ligne, lits).map((s) => s.forme), [forme], ligne)
  }
  assert.deepEqual(sitesFautifs('marker_single Source/$dir.§ --x'.replaceAll('§', EXT), lits, { shell: true }).map((s) => s.forme), ['mot-shell'])
  assert.deepEqual(sitesFautifs(`p = Source/${nomPdf('Mon Livre')}`, lits).map((s) => s.forme), ['litteral-du-registre'])
  assert.deepEqual(sitesFautifs("b.pdf != null && pdfDe(id)\nconst x = 'Source/*.md'", lits), [])
})

test('GARDE : aucun fichier de code ni JSON de configuration ne construit ni ne code en dur un chemin de PDF hors de la couture', () => {
  const cles = EXEMPTIONS.map(({ fichier, ancre }) => cleDeLigne(fichier, ancre))
  assert.equal(new Set(cles).size, cles.length, 'exemptions PDF déclarées en double')
  assert.ok(EXEMPTIONS.every(({ raison, date }) => raison.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date)))
  const fichiers = fichiersBalayes()
  assert.ok(fichiers.length > 1000, `balayage suspect : ${fichiers.length} fichier(s)`)
  const vues = new Set()
  const fautes = []
  for (const f of fichiers) {
    const verdict = juger(f, readFileSync(join(RACINE, f), 'utf8'))
    for (const ex of verdict.vues) vues.add(ex)
    for (const s of verdict.fautes) fautes.push(`${f}:${s.ligne} (${s.forme}) ${s.texte}`)
  }
  assert.deepEqual(fautes, [], 'chemin de PDF hors de `pdfDe` (scripts/raw/_lib.mjs) — passer par la couture ou sa CLI scripts/raw/pdf-de.mjs, ou exempter AU SITE (scripts/guards/lib/pdfHorsCouture.mjs)')
  assert.deepEqual(EXEMPTIONS.filter((e) => !vues.has(e)).map((e) => `${e.fichier} ${e.ancre}`), [], 'exemption sans site : à retirer')
})

test('exemption PDF au site unique, stable au déplacement et caduque à la réécriture', () => {
  const fichier = 'scripts/temoin-generation.mjs'
  const ancre = `const chemin = f.endsWith('.${EXT}')`
  const ex = { fichier, ancre, raison: 'test de l’extension, sans nom de livre', date: '2026-11-22' }
  const original = `const a = 1\n${ancre}\n`
  const examiner = (texte) => juger(fichier, texte, [ex])
  const deplace = examiner('\n' + original)
  assert.deepEqual(deplace.fautes, [])
  assert.ok(deplace.vues.includes(ex))

  const disparu = examiner(original.replace(ancre, ''))
  assert.deepEqual(disparu.fautes, [])
  assert.ok(!disparu.vues.includes(ex))

  const variante = ancre + ' // Témoin'
  const reecrit = examiner(original.replace(ancre, variante))
  assert.deepEqual(reecrit.fautes.map((s) => s.texte), [variante])
  assert.ok(!reecrit.vues.includes(ex))

  const double = examiner(original.replace(ancre, ancre + '\n' + ancre))
  assert.deepEqual(double.fautes.map((s) => s.texte), [ancre, ancre])
  assert.ok(!double.vues.includes(ex))

  const ajoute = examiner(original.replace(ancre, ancre + '\n' + variante))
  assert.deepEqual(ajoute.fautes.map((s) => s.texte), [variante])
  assert.ok(ajoute.vues.includes(ex))
})

test('LIT déclaré : chaque racine que la garde balaie est couverte par `ECRIT_LU[\'test:hooks\'].lit`', () => {
  const lit = ECRIT_LU['test:hooks'].lit
  const manquantes = racinesBalayees().filter((r) => !lit.some((l) => r === l || r.startsWith(l)))
  assert.deepEqual(manquantes, [], `racine(s) balayée(s) absente(s) du \`lit\` de test:hooks (scripts/gates/toutes.mjs) : ${manquantes.join(', ')}`)
})
