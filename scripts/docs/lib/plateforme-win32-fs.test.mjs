import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fsSousWin32 } from './plateforme-win32-fs.mjs'
import { analyserTexte } from '../../guards/lib/dialecte.mjs'
import { evaluateurDuDepot, lectureDeModule } from '../../guards/lib/racinesBalayees.mjs'

const callbacks = ['readFile', 'fileExists', 'directoryExists', 'getAccessibleEntries', 'realpath']
const lecteur = 'C' + ':'
function racineDuBanc() { return '/depot' }
export const CONTRATS_DE_DERIVATION = [{ fonction: racineDuBanc, namespace: '/depot' }]
const windows = lecteur + racineDuBanc().replace(/\//g, '\\') + '\\src\\é.ts'
const posix = `${racineDuBanc()}/src/é.ts`

test('racine du banc : valeurs absolues indépendantes', () => {
  assert.equal(posix, '/depot/src/é.ts')
  assert.equal(windows, 'C' + ':' + '\\depot\\src\\é.ts')
  assert.equal(lecteur + posix, 'C' + ':' + '/depot/src/é.ts')
})

for (const nom of callbacks) {
  test(`${nom} : le callback original reçoit Windows avant la délégation POSIX`, () => {
    const appels = []
    const valeur = nom === 'realpath' ? '/depot/cible/é.ts' : { temoin: nom }
    const adapte = fsSousWin32({ [nom]: (chemin) => { appels.push(['original', chemin]); return undefined } }, {
      [nom]: (chemin) => { appels.push(['disque', chemin]); return valeur },
    })
    assert.deepEqual(adapte[nom](windows), nom === 'realpath' ? lecteur + '\\depot\\cible\\é.ts' : valeur)
    assert.deepEqual(appels, [['original', windows], ['disque', posix]])
  })

  test(`${nom} : null, false, chaîne vide et entrées vides ferment le recouvrement`, () => {
    for (const valeur of [null, false, '', { files: [], directories: [] }]) {
      const adapte = fsSousWin32({ [nom]: () => valeur }, {
        [nom]: () => assert.fail('le disque ne doit pas être consulté'),
      })
      assert.equal(adapte[nom](windows), valeur)
    }
  })

  test(`${nom} : une exception originale reste visible, sans accès disque`, () => {
    const erreur = new Error(nom)
    const adapte = fsSousWin32({ [nom]: () => { throw erreur } }, {
      [nom]: () => assert.fail('le disque ne doit pas être consulté'),
    })
    assert.throws(() => adapte[nom](windows), (e) => e === erreur)
  })

  test(`${nom} : callback absent, la délégation disque est explicite`, () => {
    const adapte = fsSousWin32({}, { [nom]: (chemin) => { assert.equal(chemin, posix); return undefined } })
    assert.equal(adapte[nom](windows), undefined)
  })

  test(`${nom} : une exception disque après undefined reste visible`, () => {
    const erreur = new Error(`disque ${nom}`)
    const adapte = fsSousWin32({ [nom]: () => undefined }, { [nom]: () => { throw erreur } })
    assert.throws(() => adapte[nom](windows), (e) => e === erreur)
  })
}

test('readFile injecté : BOM, CRLF et unités UTF16 restent identiques, y compris une chaîne vide', () => {
  const texte = '\uFEFFconst x = "\uD800\uFEFFé😀";\r\n'
  for (const valeur of [texte, '']) {
    const adapte = fsSousWin32({}, { readFile: () => valeur })
    assert.equal(adapte.readFile(windows), valeur)
  }
})

const corps = 'é😀\r\n'
const le = (texte) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(texte, 'utf16le')])
const be = (texte) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(texte, 'utf16le').swap16()])
// microsoft/typescript-go@2bd066d87f5bafd315be9f40889d0a60b9e58e0b internal/vfs/internal/internal.go decodeBytes
for (const [nom, octets, attendu] of [
  ['vide', Buffer.alloc(0), ''],
  ['UTF8 sans BOM', Buffer.from(corps, 'utf8'), corps],
  ['UTF8 BOM', Buffer.from(`\uFEFF${corps}`, 'utf8'), corps],
  ['UTF8 second BOM', Buffer.from(`\uFEFF\uFEFF${corps}`, 'utf8'), `\uFEFF${corps}`],
  ['UTF16LE BOM', le(corps), corps],
  ['UTF16BE BOM', be(corps), corps],
  ['UTF16LE second BOM', le(`\uFEFF${corps}`), `\uFEFF${corps}`],
  ['UTF16BE second BOM', be(`\uFEFF${corps}`), `\uFEFF${corps}`],
  ['UTF16LE octet impair', Buffer.from([0xff, 0xfe, 0x61, 0, 0xff]), 'a'],
  ['UTF16BE octet impair', Buffer.from([0xfe, 0xff, 0, 0x61, 0xff]), 'a'],
  ['UTF16LE surrogates isolés', Buffer.from([0xff, 0xfe, 0, 0xd8, 0x61, 0, 0, 0xdc]), '\uFFFDa\uFFFD'],
  ['UTF16BE surrogates isolés', Buffer.from([0xfe, 0xff, 0xd8, 0, 0, 0x61, 0xdc, 0]), '\uFFFDa\uFFFD'],
]) {
  test(`readFile disque par défaut : ${nom}`, () => {
    const racine = mkdtempSync(path.join(tmpdir(), 'plateforme-win32-decodage-'))
    try {
      const fichier = path.join(racine, 'fixture.ts')
      writeFileSync(fichier, octets)
      assert.equal(fsSousWin32().readFile(path.relative(process.cwd(), fichier)), attendu)
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })
}

test('realpath : retour disque Windows, relatif inchangé, callback original prioritaire', () => {
  for (const [lue, attendu] of [['/cible/x', lecteur + '\\cible\\x'], ['relatif/x', 'relatif/x']]) {
    assert.equal(fsSousWin32({}, { realpath: () => lue }).realpath(windows), attendu)
  }
  assert.equal(fsSousWin32({ realpath: () => windows }, { realpath: () => assert.fail() }).realpath(windows), windows)
})

test('getAccessibleEntries : les noms simples délégués restent intacts', () => {
  const entrees = { files: ['A.ts', 'é.ts'], directories: ['sous-dossier'] }
  assert.equal(fsSousWin32({}, { getAccessibleEntries: () => entrees }).getAccessibleEntries(lecteur + '/depot'), entrees)
})

test('les effets hors des cinq callbacks sont conservés sans adaptation', () => {
  const writeFile = () => {}
  const removeFile = () => {}
  const original = { writeFile, removeFile }
  const adapte = fsSousWin32(original, {})
  assert.equal(adapte.writeFile, writeFile)
  assert.equal(adapte.removeFile, removeFile)
  assert.deepEqual(original, { writeFile, removeFile })
})

test('les séparateurs Windows sont convertis uniquement pour le disque', () => {
  for (const [entree, attendu] of [[lecteur + posix, posix], [windows, posix], ['src\\é.ts', 'src/é.ts'], [posix, posix]]) {
    const appels = []
    const adapte = fsSousWin32({ readFile: (nom) => { appels.push(nom); return undefined } }, {
      readFile: (nom) => { appels.push(nom); return '' },
    })
    assert.equal(adapte.readFile(entree), '')
    assert.deepEqual(appels, [entree, attendu])
  }
})

test('racine du banc : le vrai Source conserve le contrat et toutes les lectures dérivées', () => {
  const rel = 'scripts/docs/lib/plateforme-win32-fs.test.mjs'
  const texte = readFileSync(new URL('./plateforme-win32-fs.test.mjs', import.meta.url), 'utf8')
  const lecture = lectureDeModule(rel, analyserTexte({ rel, text: texte }).sourceFile)
  assert.deepEqual(lecture.fonctions.racineDuBanc.contrat, { namespace: '/depot' })
  const evaluateur = evaluateurDuDepot({ lecture: (f) => f === rel ? lecture : null, cible: () => null })
  const sites = evaluateur.sitesDe(rel).filter((s) => s.appel === 'readFile')
  const couvert = (raison) => ({ chemin: '', sous: `couverture corpus entier : ${rel}#racineDuBanc:/depot — ${raison}` })
  const valeurs = sites.at(-1)?.valeurs
  const attendues = [
    couvert('namespace externe recomposé'),
    couvert('descente dans namespace susceptible de lien'),
    { chemin: 'src/é.ts' },
  ]
  assert.equal(valeurs.length, attendues.length)
  assert.deepEqual(new Set(valeurs.map((v) => JSON.stringify(v))), new Set(attendues.map((v) => JSON.stringify(v))))
  assert.equal(valeurs.some((v) => v.hors === true), false)
  assert.equal(valeurs.some((v) => /^chemin absolu /.test(v.non ?? '')), false)
})
