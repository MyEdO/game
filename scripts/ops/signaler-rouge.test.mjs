// CONTRAT DU SIGNALEUR (#1779) : un workflow sans porte se NOMME en rougissant, par un fil UNIQUE.
//   node --test scripts/ops/signaler-rouge.test.mjs   (joué par `npm run test:ops`)
//
// Les gestes sont PURS (`decider`, `survivanteDe`, `recit`) et le spawn est INJECTÉ : aucun appel
// réseau, mais les ARGS `gh` réellement construits sont mesurés — c'est eux qui posaient le label,
// trouvaient la survivante et fermaient l'issue dans `canari.yml`.
// Fixtures sous `os.tmpdir()` : le corps du rapport est un FICHIER (`--body-file`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyserTexte } from '../guards/lib/dialecte.mjs'
import { evaluateurDuDepot, lectureDeModule } from '../guards/lib/racinesBalayees.mjs'
import { DESCRIPTION_LABEL, decider, options, recit, signaler, survivanteDe } from './signaler-rouge.mjs'

/** Un `spawn` de doublure : enregistre les appels, sert les sorties données dans l'ordre. */
function doublure(sorties = []) {
  const vus = []
  let rang = 0
  const spawn = (cmd, args, opts) => {
    vus.push({ cmd, args, opts })
    const sortie = sorties[Math.min(rang, sorties.length - 1)] ?? ''
    rang += 1
    return { status: 0, stdout: sortie, stderr: '' }
  }
  return { spawn, vus }
}

/** Un corps de rapport sur disque, jeté par l'appelant. */
function corpsJetable(texte = '## rapport') {
  const dossier = mkdtempSync(join(tmpdir(), 'signaler-rouge-'))
  const chemin = join(dossier, 'rapport.md')
  writeFileSync(chemin, texte)
  return { dossier, chemin }
}

test('decider : ROUGE avec survivante COMMENTE, sans survivante CRÉE', () => {
  assert.deepEqual(decider({ survivante: 42, verdict: 'rouge' }), [{ geste: 'commenter', numero: 42 }])
  assert.deepEqual(decider({ survivante: null, verdict: 'rouge' }), [{ geste: 'creer' }])
})

test('decider : VERT avec survivante COMMENTE puis FERME, sans survivante ne fait RIEN', () => {
  assert.deepEqual(decider({ survivante: 7, verdict: 'vert' }), [
    { geste: 'commenter', numero: 7 },
    { geste: 'fermer', numero: 7 },
  ])
  assert.deepEqual(decider({ survivante: null, verdict: 'vert' }), [])
})

test('la SURVIVANTE est la plus ANCIENNE ouverte dont le titre commence par le préfixe', () => {
  const issues = [
    { number: 3, createdAt: '2026-09-10T00:00:00Z', title: 'Canari rouge — environnement ou suite cassés' },
    { number: 1, createdAt: '2026-09-01T00:00:00Z', title: 'Canari rouge — autre' },
    { number: 2, createdAt: '2026-08-01T00:00:00Z', title: 'Autre sujet' },
  ]
  assert.equal(survivanteDe(issues, 'Canari rouge'), 1)
  assert.equal(survivanteDe(issues, 'Rapport de dépendances rouge'), null)
  assert.equal(survivanteDe([], 'Canari rouge'), null)
})

test('le récit NOMME le geste posé', () => {
  assert.equal(recit(decider({ survivante: 42, verdict: 'rouge' })), 'rapport posté sur #42')
  assert.equal(recit(decider({ survivante: 42, verdict: 'vert' })), 'rapport posté puis #42 fermée')
  assert.equal(recit(decider({ survivante: null, verdict: 'rouge' })), 'issue ouverte')
  assert.equal(recit(decider({ survivante: null, verdict: 'vert' })), 'verdict vert et aucune issue ouverte : rien à ouvrir')
})

test('les options : `--prefixe` vaut `--titre` par défaut, une option manquante LÈVE', () => {
  const lu = options(['--titre', 'Rapport de dépendances rouge', '--label', 'canari', '--corps', 'r.md', '--verdict', 'rouge'])
  assert.equal(lu.prefixe, 'Rapport de dépendances rouge')
  assert.throws(() => options(['--titre', 'x', '--label', 'canari', '--corps', 'r.md']), /--verdict manquante/)
  assert.throws(
    () => options(['--titre', 'x', '--label', 'canari', '--corps', 'r.md', '--verdict', 'orange']),
    /--verdict doit valoir/,
  )
})

test('le corps fourni par argv couvre le corpus et un appel littéral garde son chemin', () => {
  const rel = 'scripts/ops/signaler-rouge.mjs'
  const litt = 'scripts/ops/appel-signaler.mjs'
  const textes = new Map([
    [rel, readFileSync(new URL('./signaler-rouge.mjs', import.meta.url), 'utf8')],
    [litt, "import { signaler } from './signaler-rouge.mjs'; signaler({ corps: 'docs/architecture.md' })"],
  ])
  const lectures = new Map([...textes].map(([rel, text]) => [rel, lectureDeModule(rel, analyserTexte({ rel, text }).sourceFile)]))
  const evaluateur = evaluateurDuDepot({
    lecture: (fichier) => lectures.get(fichier),
    cible: (_fichier, spec) => spec === './signaler-rouge.mjs' ? rel : null,
  })
  const lecturesDeLAppel = (fichier) => evaluateur.sitesDe(fichier).filter((site) => site.appel === 'signaler').flatMap((site) => site.valeurs)
  assert.deepEqual(lecturesDeLAppel(rel), [{
    chemin: '',
    sous: 'couverture corpus entier : scripts/ops/signaler-rouge.mjs#options:retour.corps — chaîne sans borne déclarée à la source',
  }])
  assert.deepEqual(lecturesDeLAppel(litt), [{ chemin: 'docs/architecture.md' }])
})

test('ROUGE sans survivante : label idempotent, recherche par préfixe, issue CRÉÉE avec son label', () => {
  const { dossier, chemin } = corpsJetable()
  try {
    const { spawn, vus } = doublure(['', '[]'])
    const dit = signaler({
      titre: 'Canari rouge — environnement ou suite cassés', prefixe: 'Canari rouge',
      label: 'canari', corps: chemin, verdict: 'rouge', spawn,
    })
    assert.equal(dit, 'issue ouverte')
    assert.deepEqual(vus[0].args.slice(0, 3), ['label', 'create', 'canari'])
    assert.ok(vus[0].args.includes('--force'), 'le label doit être posé de façon IDEMPOTENTE')
    // `--force` réécrit la description à chaque run et deux workflows partagent le label `canari` :
    // une description tirée du préfixe ferait battre le label d’un run à l’autre.
    assert.deepEqual(vus[0].args[vus[0].args.indexOf('--description') + 1], DESCRIPTION_LABEL)
    assert.ok(!DESCRIPTION_LABEL.includes('Canari'), 'la description du label ne dépend d’aucun préfixe')
    assert.deepEqual(vus[1].args.slice(0, 4), ['issue', 'list', '--state', 'open'])
    assert.ok(vus[1].args.includes('Canari rouge in:title'))
    assert.deepEqual(vus[2].args.slice(0, 2), ['issue', 'create'])
    assert.ok(vus[2].args.includes('Canari rouge — environnement ou suite cassés'))
    assert.ok(vus[2].args.includes('--label') && vus[2].args.includes('canari'))
    assert.equal(vus.length, 3)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('ROUGE avec survivante : la plus ancienne est COMMENTÉE, aucune issue n’est créée', () => {
  const { dossier, chemin } = corpsJetable()
  try {
    const issues = JSON.stringify([
      { number: 9, createdAt: '2026-09-09T00:00:00Z', title: 'Canari rouge — environnement ou suite cassés' },
      { number: 4, createdAt: '2026-09-02T00:00:00Z', title: 'Canari rouge — environnement ou suite cassés' },
    ])
    const { spawn, vus } = doublure(['', issues])
    const dit = signaler({
      titre: 'Canari rouge — environnement ou suite cassés', prefixe: 'Canari rouge',
      label: 'canari', corps: chemin, verdict: 'rouge', spawn,
    })
    assert.equal(dit, 'rapport posté sur #4')
    assert.deepEqual(vus[2].args, ['issue', 'comment', '4', '--body-file', chemin])
    assert.ok(!vus.some((v) => v.args[1] === 'create' && v.args[0] === 'issue'))
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('VERT avec survivante : commentée puis FERMÉE ; VERT sans survivante : rien après la recherche', () => {
  const { dossier, chemin } = corpsJetable()
  try {
    const issues = JSON.stringify([{ number: 4, createdAt: '2026-09-02T00:00:00Z', title: 'Canari rouge — x' }])
    const avec = doublure(['', issues])
    assert.equal(
      signaler({ titre: 'Canari rouge — x', prefixe: 'Canari rouge', label: 'canari', corps: chemin, verdict: 'vert', spawn: avec.spawn }),
      'rapport posté puis #4 fermée',
    )
    assert.deepEqual(avec.vus[2].args, ['issue', 'comment', '4', '--body-file', chemin])
    assert.deepEqual(avec.vus[3].args, ['issue', 'close', '4', '--reason', 'completed'])

    const sans = doublure(['', '[]'])
    assert.equal(
      signaler({ titre: 'Canari rouge — x', prefixe: 'Canari rouge', label: 'canari', corps: chemin, verdict: 'vert', spawn: sans.spawn }),
      'verdict vert et aucune issue ouverte : rien à ouvrir',
    )
    assert.equal(sans.vus.length, 2, 'un vert sans survivante ne doit ni commenter ni créer')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('CHAQUE appel `gh` ferme son stdin (un runner ne le ferme pas pour lui)', () => {
  const { dossier, chemin } = corpsJetable()
  try {
    const issues = JSON.stringify([{ number: 4, createdAt: '2026-09-02T00:00:00Z', title: 'Canari rouge — x' }])
    const { spawn, vus } = doublure(['', issues])
    signaler({ titre: 'Canari rouge — x', prefixe: 'Canari rouge', label: 'canari', corps: chemin, verdict: 'vert', spawn })
    assert.ok(vus.length >= 4)
    for (const { args, opts } of vus)
      assert.equal(opts.stdio[0], 'ignore', `appel gh ${args.join(' ')} avec stdin OUVERT`)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('un `gh` qui échoue LÈVE : un signalement muet ne sert à rien', () => {
  const { dossier, chemin } = corpsJetable()
  try {
    const spawn = () => ({ status: 1, stdout: '', stderr: 'gh: jeton expiré' })
    assert.throws(
      () => signaler({ titre: 't', prefixe: 't', label: 'canari', corps: chemin, verdict: 'rouge', spawn }),
      /a rendu 1/,
    )
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
