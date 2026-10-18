// Contrat du REJEU d'un processus qui n'a pas démarré (#1679 L2 T1d).
//   node --test scripts/guards/lib/spawnResilient.test.mjs
//
// Le cas visé n'est pas simulable à volonté (le loader Windows rend `STATUS_DLL_INIT_FAILED` sous
// pression, pas sur commande) : la boucle asynchrone reçoit ce code-là de son `lancer`, la boucle
// synchrone d'un processus RÉEL qui sort avec lui ; chaque morsure vérifie que le rejeu s'arrête au bon
// endroit — et qu'un AUTRE code ne déclenche rien. Les attentes passent sous horloge simulée, la marque
// de rejeu se lit sur stderr.
//
// ANGLE MORT DÉCLARÉ : la morsure à processus RÉEL (`process.exit(3221225794)`) ne vaut que sous
// Windows — un code de sortie POSIX tient sur 8 bits, 0xC0000142 y devient 66, le rejeu ne part pas.
// Elle est donc `skip`ée hors win32 (raison dite dans le test) ; le contrat de la boucle asynchrone,
// lui, est tenu sur TOUTES les plateformes.
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

/** Capte stderr, où le helper écrit sa marque de rejeu, au lieu de polluer la sortie ; rend les seules lignes de la marque. */
const journalDeTest = (t) => {
  const ecriture = t.mock.method(process.stderr, 'write', () => true)
  return { get lignes() { return ecriture.mock.calls.map((appel) => String(appel.arguments[0])).filter((l) => l.startsWith(MARQUE_REJEU)) } }
}

/** `reessayerAuChargement` sous horloge simulée : chaque backoff (2 s + 5 s réels) s'écoule d'un coup. */
async function rejouerSansAttente(t, lancer, options) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let fini = false
  const attente = reessayerAuChargement(lancer, options).finally(() => { fini = true })
  while (!fini) {
    await new Promise((ok) => setImmediate(ok))
    t.mock.timers.tick(Math.max(...BACKOFFS_MS))
  }
  return attente
}

test('le code du loader est reconnu, et lui SEUL', () => {
  assert.equal(estEchecDeChargement(STATUS_DLL_INIT_FAILED), true)
  assert.equal(STATUS_DLL_INIT_FAILED, 3221225794, '0xC0000142 — la valeur mesurée le 2026-09-04')
  for (const autre of [0, 1, 2, 130, 3221225477, null, undefined])
    assert.equal(estEchecDeChargement(autre), false, `${autre} n’est pas un échec de chargement`)
})

test('deux rejeux au plus, puis le verdict remonte tel quel', async (t) => {
  const journal = journalDeTest(t)
  const essais = []
  const r = await rejouerSansAttente(
    t,
    (essai) => {
      essais.push(essai)
      return Promise.resolve({ code: STATUS_DLL_INIT_FAILED })
    },
    { site: 'sonde' },
  )
  assert.equal(essais.length, BACKOFFS_MS.length + 1, 'un essai initial et deux rejeux')
  assert.equal(r.code, STATUS_DLL_INIT_FAILED, 'après épuisement, le code du loader EST le verdict')
  assert.equal(journal.lignes.length, BACKOFFS_MS.length)
  for (const l of journal.lignes) assert.match(l, /^\[spawn\] rejeu — le processus n’a pas démarré : sonde/)
})

test('un succès au deuxième essai rend le succès, et compte UN rejeu', async (t) => {
  const journal = journalDeTest(t)
  const avant = rejeux.total
  const r = await rejouerSansAttente(
    t,
    (essai) => Promise.resolve(essai === 0 ? { code: STATUS_DLL_INIT_FAILED } : { code: 0, sortie: 'ok' }),
    { site: 'sonde' },
  )
  assert.deepEqual({ code: r.code, sortie: r.sortie }, { code: 0, sortie: 'ok' })
  assert.equal(rejeux.total - avant, 1)
  assert.equal(journal.lignes.length, 1)
})

test('un VRAI rouge n’est jamais rejoué : un seul essai, aucun rejeu compté', async (t) => {
  const journal = journalDeTest(t)
  const avant = rejeux.total
  const essais = []
  const r = await reessayerAuChargement(
    (essai) => {
      essais.push(essai)
      return Promise.resolve({ code: 1 })
    },
    { site: 'sonde' },
  )
  assert.deepEqual(essais, [0], 'un rouge de gate rejoué serait un verdict fabriqué')
  assert.equal(r.code, 1)
  assert.equal(rejeux.total - avant, 0)
  assert.deepEqual(journal.lignes, [])
})

test('le signal abrège l’attente du rejeu ; l’essai suivant, mené sous ce signal, rend l’annulation', async (t) => {
  journalDeTest(t)
  for (const [nom, poser] of [['aborté pendant l’attente', (a) => setTimeout(() => a.abort(), 30)], ['aborté avant l’attente', (a) => a.abort()]]) {
    const annulation = new AbortController(); const essais = []
    const debut = Date.now()
    const r = await reessayerAuChargement((essai) => {
      essais.push(essai)
      if (annulation.signal.aborted) return Promise.resolve({ code: 1, annulee: true })
      poser(annulation)
      return Promise.resolve({ code: STATUS_DLL_INIT_FAILED })
    }, { site: 'sonde', signal: annulation.signal })
    const duree = Date.now() - debut
    assert.deepEqual(essais, [0, 1], nom); assert.deepEqual(r, { code: 1, annulee: true }, nom)
    assert.ok(duree < BACKOFFS_MS[0] / 2, `${nom} : sortie à ${duree} ms, attente de rejeu ${BACKOFFS_MS[0]} ms`)
  }
})

test('attente du rejeu : un signal nul attend le plein backoff', async (t) => {
  journalDeTest(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const essais = []
  const attente = reessayerAuChargement((essai) => {
    essais.push(essai)
    return Promise.resolve({ code: essai === 0 ? STATUS_DLL_INIT_FAILED : 0 })
  }, { site: 'sonde', signal: null })
  await new Promise((ok) => setImmediate(ok))
  t.mock.timers.tick(BACKOFFS_MS[0] - 1)
  await new Promise((ok) => setImmediate(ok))
  assert.deepEqual(essais, [0], 'le second essai part avant la fin du backoff')
  t.mock.timers.tick(1)
  assert.deepEqual(await attente, { code: 0 })
  assert.deepEqual(essais, [0, 1])
})

test('`lancer` est rappelé À CHAQUE essai : ce qu’un essai consomme est re-créé', async (t) => {
  const base = mkdtempSync(join(tmpdir(), 'resilient-'))
  try {
    journalDeTest(t)
    const fichier = join(base, 'sortie.txt')
    // Le vrai `spawnBorne` réouvre son fichier en `'w'` à chaque essai : sans cela, le second écrirait
    // à la suite du premier et la sortie de gate mentirait.
    await rejouerSansAttente(
      t,
      (essai) => {
        writeFileSync(fichier, `essai ${essai}\n`)
        return Promise.resolve({ code: essai < 2 ? STATUS_DLL_INIT_FAILED : 0 })
      },
      { site: 'sonde' },
    )
    assert.equal(readFileSync(fichier, 'utf8'), 'essai 2\n', 'la sortie doit être celle du DERNIER essai')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test(
  'execFileResilient : un processus RÉEL qui SORT avec le code du loader est rejoué, puis remonte',
  {
    skip:
      process.platform !== 'win32' &&
      'un code de sortie 32 bits n’existe que sous Windows (POSIX tronque à 8 bits : 0xC0000142 → 66)',
  },
  (t) => {
    const base = mkdtempSync(join(tmpdir(), 'resilient-sync-'))
    try {
      const journal = journalDeTest(t)
      const script = join(base, 'loader.mjs')
      writeFileSync(script, `process.exit(${STATUS_DLL_INIT_FAILED})\n`)
      const avant = rejeux.total
      assert.throws(
        () => execFileResilient(process.execPath, [script], { cwd: base, encoding: 'utf8', stdio: 'ignore' }, { site: 'sonde-sync' }),
        /Command failed/,
      )
      assert.equal(rejeux.total - avant, BACKOFFS_MS.length, 'deux rejeux avant de laisser remonter')
      assert.equal(journal.lignes.length, BACKOFFS_MS.length)
      for (const l of journal.lignes) assert.match(l, /^\[spawn\] rejeu — le processus n’a pas démarré : sonde-sync/)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  },
)

test('execFileResilient : un succès passe sans rejeu, un autre rouge remonte immédiatement', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'resilient-ok-'))
  try {
    const journal = journalDeTest(t)
    const avant = rejeux.total
    writeFileSync(join(base, 'ok.mjs'), "process.stdout.write('bonjour')\n")
    assert.equal(
      execFileResilient(process.execPath, [join(base, 'ok.mjs')], { cwd: base, encoding: 'utf8' }, { site: 's' }),
      'bonjour',
    )
    writeFileSync(join(base, 'rouge.mjs'), 'process.exit(7)\n')
    assert.throws(() =>
      execFileResilient(process.execPath, [join(base, 'rouge.mjs')], { cwd: base, stdio: 'ignore' }, { site: 's' }),
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
