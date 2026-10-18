// Contrat du REJEU d'un processus qui n'a pas démarré (#1679 L2 T1d).
//   node --test scripts/guards/lib/spawnResilient.test.mjs
//
// Le cas visé n'est pas simulable à volonté (le loader Windows rend `STATUS_DLL_INIT_FAILED` sous
// pression, pas sur commande) : chaque morsure force donc ce code-là par l'injection du lanceur
// (`executer` / `lancer`), puis vérifie que le rejeu s'arrête au bon endroit — et qu'un AUTRE code ne
// déclenche rien.
//
// ANGLE MORT DÉCLARÉ : la morsure à processus RÉEL (`process.exit(3221225794)`) ne vaut que sous
// Windows — un code de sortie POSIX tient sur 8 bits, 0xC0000142 y devient 66, le rejeu ne part pas.
// Elle est donc `skip`ée hors win32 (raison dite dans le test) ; le contrat de la boucle, lui, est
// tenu sur TOUTES les plateformes par la morsure à lanceur injecté.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BACKOFFS_MS,
  MARQUE_REJEU,
  STATUS_DLL_INIT_FAILED,
  compterRejeux,
  estEchecDeChargement,
  execFileResilient,
  reessayerAuChargement,
  rejeux,
} from './spawnResilient.mjs'

/** Journal de test : capte ce que le helper écrit, au lieu de polluer la sortie. */
const journalDeTest = () => {
  const lignes = []
  return { write: (t) => lignes.push(t), lignes }
}

/** Attente INSTANTANÉE : les backoffs réels (2 s + 5 s) n'ont rien à mesurer ici. */
const sansAttente = async () => {}

test('le code du loader est reconnu, et lui SEUL', () => {
  assert.equal(estEchecDeChargement(STATUS_DLL_INIT_FAILED), true)
  assert.equal(STATUS_DLL_INIT_FAILED, 3221225794, '0xC0000142 — la valeur mesurée le 2026-09-04')
  for (const autre of [0, 1, 2, 130, 3221225477, null, undefined])
    assert.equal(estEchecDeChargement(autre), false, `${autre} n’est pas un échec de chargement`)
})

test('deux rejeux au plus, puis le verdict remonte tel quel', async () => {
  const journal = journalDeTest()
  const essais = []
  const r = await reessayerAuChargement(
    (essai) => {
      essais.push(essai)
      return Promise.resolve({ code: STATUS_DLL_INIT_FAILED })
    },
    { site: 'sonde', journal, attendre: sansAttente },
  )
  assert.equal(essais.length, BACKOFFS_MS.length + 1, 'un essai initial et deux rejeux')
  assert.equal(r.code, STATUS_DLL_INIT_FAILED, 'après épuisement, le code du loader EST le verdict')
  assert.equal(journal.lignes.length, BACKOFFS_MS.length)
  for (const l of journal.lignes) assert.match(l, /^\[spawn\] rejeu — le processus n’a pas démarré : sonde/)
})

test('un succès au deuxième essai rend le succès, et compte UN rejeu', async () => {
  const journal = journalDeTest()
  const avant = rejeux.total
  const r = await reessayerAuChargement(
    (essai) => Promise.resolve(essai === 0 ? { code: STATUS_DLL_INIT_FAILED } : { code: 0, sortie: 'ok' }),
    { site: 'sonde', journal, attendre: sansAttente },
  )
  assert.deepEqual({ code: r.code, sortie: r.sortie }, { code: 0, sortie: 'ok' })
  assert.equal(rejeux.total - avant, 1)
})

test('un VRAI rouge n’est jamais rejoué : un seul essai, aucun rejeu compté', async () => {
  const journal = journalDeTest()
  const avant = rejeux.total
  const essais = []
  const r = await reessayerAuChargement(
    (essai) => {
      essais.push(essai)
      return Promise.resolve({ code: 1 })
    },
    { site: 'sonde', journal, attendre: sansAttente },
  )
  assert.deepEqual(essais, [0], 'un rouge de gate rejoué serait un verdict fabriqué')
  assert.equal(r.code, 1)
  assert.equal(rejeux.total - avant, 0)
  assert.deepEqual(journal.lignes, [])
})

test('le signal réveille l’attente du rejeu et rend le dernier résultat, sans nouvel essai', async () => {
  for (const [nom, poser] of [['aborté pendant l’attente', (a) => setTimeout(() => a.abort(), 30)], ['aborté avant l’attente', (a) => a.abort()]]) {
    const journal = journalDeTest(); const annulation = new AbortController(); const essais = []
    const debut = Date.now()
    const r = await reessayerAuChargement((essai) => {
      essais.push(essai); poser(annulation)
      return Promise.resolve({ code: STATUS_DLL_INIT_FAILED })
    }, { site: 'sonde', journal, signal: annulation.signal })
    const duree = Date.now() - debut
    assert.deepEqual(essais, [0], nom); assert.equal(r.code, STATUS_DLL_INIT_FAILED, nom)
    assert.ok(duree < BACKOFFS_MS[0] / 2, `${nom} : sortie à ${duree} ms, attente de rejeu ${BACKOFFS_MS[0]} ms`)
  }
})

test('`lancer` est rappelé À CHAQUE essai : ce qu’un essai consomme est re-créé', async () => {
  const base = mkdtempSync(join(tmpdir(), 'resilient-'))
  try {
    const journal = journalDeTest()
    const fichier = join(base, 'sortie.txt')
    // Le vrai `spawnBorne` réouvre son fichier en `'w'` à chaque essai : sans cela, le second écrirait
    // à la suite du premier et la sortie de gate mentirait.
    await reessayerAuChargement(
      (essai) => {
        writeFileSync(fichier, `essai ${essai}\n`)
        return Promise.resolve({ code: essai < 2 ? STATUS_DLL_INIT_FAILED : 0 })
      },
      { site: 'sonde', journal, attendre: sansAttente },
    )
    assert.equal(readFileSync(fichier, 'utf8'), 'essai 2\n', 'la sortie doit être celle du DERNIER essai')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/** Erreur d'`execFileSync` : le code de sortie y vit dans `status` (lu par `codeDeLErreur`). */
const erreurDeLancement = (status) => Object.assign(new Error('Command failed'), { status })

test('execFileResilient : un lancement qui rend le code du loader est rejoué, puis remonte', () => {
  const journal = journalDeTest()
  const avant = rejeux.total
  const essais = []
  const executer = () => {
    essais.push(essais.length)
    throw erreurDeLancement(STATUS_DLL_INIT_FAILED)
  }
  assert.throws(
    () => execFileResilient('peu-importe', [], {}, { site: 'sonde-sync', journal, executer }),
    /Command failed/,
  )
  assert.equal(essais.length, BACKOFFS_MS.length + 1, 'un essai initial et deux rejeux')
  assert.equal(rejeux.total - avant, BACKOFFS_MS.length, 'deux rejeux avant de laisser remonter')
  assert.equal(journal.lignes.length, BACKOFFS_MS.length)
  for (const l of journal.lignes) assert.match(l, /^\[spawn\] rejeu — le processus n’a pas démarré : sonde-sync/)
})

test(
  'execFileResilient : un processus RÉEL qui SORT avec le code du loader est rejoué, puis remonte',
  {
    skip:
      process.platform !== 'win32' &&
      'un code de sortie 32 bits n’existe que sous Windows (POSIX tronque à 8 bits : 0xC0000142 → 66)',
  },
  () => {
    const base = mkdtempSync(join(tmpdir(), 'resilient-sync-'))
    try {
      const journal = journalDeTest()
      const script = join(base, 'loader.mjs')
      writeFileSync(script, `process.exit(${STATUS_DLL_INIT_FAILED})\n`)
      const avant = rejeux.total
      assert.throws(
        () => execFileResilient(process.execPath, [script], { cwd: base, encoding: 'utf8', stdio: 'ignore' }, {
          site: 'sonde-sync',
          journal,
        }),
        /Command failed/,
      )
      assert.equal(rejeux.total - avant, BACKOFFS_MS.length, 'deux rejeux avant de laisser remonter')
      assert.equal(journal.lignes.length, BACKOFFS_MS.length)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  },
)

test('execFileResilient : un succès passe sans rejeu, un autre rouge remonte immédiatement', () => {
  const base = mkdtempSync(join(tmpdir(), 'resilient-ok-'))
  try {
    const journal = journalDeTest()
    const avant = rejeux.total
    writeFileSync(join(base, 'ok.mjs'), "process.stdout.write('bonjour')\n")
    assert.equal(
      execFileResilient(process.execPath, [join(base, 'ok.mjs')], { cwd: base, encoding: 'utf8' }, { site: 's', journal }),
      'bonjour',
    )
    writeFileSync(join(base, 'rouge.mjs'), 'process.exit(7)\n')
    assert.throws(() =>
      execFileResilient(process.execPath, [join(base, 'rouge.mjs')], { cwd: base, stdio: 'ignore' }, { site: 's', journal }),
    )
    assert.equal(rejeux.total - avant, 0)
    assert.deepEqual(journal.lignes, [])
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('les rejeux d’un processus SÉPARÉ se comptent dans sa sortie', () => {
  assert.equal(compterRejeux(''), 0)
  assert.equal(compterRejeux(null), 0)
  assert.equal(compterRejeux(`${MARQUE_REJEU} : a\nbruit\n${MARQUE_REJEU} : b\n`), 2)
})

test('l’attente bloquante existe et ne dépend de rien', async () => {
  const { attendreSync } = await import('./spawnResilient.mjs')
  const debut = Date.now()
  attendreSync(120)
  assert.ok(Date.now() - debut >= 100, 'l’attente synchrone n’a pas bloqué')
  assert.ok(existsSync(new URL('./spawnResilient.mjs', import.meta.url)))
})
