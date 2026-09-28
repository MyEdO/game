// CLIQUET DU REGISTRE DES WORKFLOWS (#1779) : chaque workflow du dépôt est vu par la porte, se nomme
// lui-même en rougissant, ou figure en liste blanche NOMMÉE avec sa raison — et l'état DÉCLARÉ est
// MESURÉ sur le YAML.
//   node --test scripts/gates/workflowsDuDepot.test.mjs   (joué par `npm run test:hooks`)
//
// Le cas : un rouge d'un workflow hors `ci.yml` n'était vu par aucune porte ni nommé par aucun canal
// (`export-issues.yml` rouge chaque mardi du 2026-09-08 au 2026-09-15, #1713).
// Les mutations se jouent sur un dépôt JETABLE (`mkdtempSync` + `cpSync` sous os.tmpdir()) : l'arbre
// du dépôt n'est jamais écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coursesCi } from '../guards/lib/coursesCi.mjs'
import { stepsCi } from './gatesDeCi.mjs'
import { DOSSIER, ETATS, PORTE, SIGNALEUR, WORKFLOWS, corpsRun, lireWorkflows, mesurerEtat, verdict } from './workflowsDuDepot.mjs'

/** Un workflow d'une seule ligne de `run`, sous la condition `si`. PUR — aucun disque. */
const workflowAvec = (si, ligneRun) =>
  `name: Banc\non:\n  schedule:\n    - cron: '0 6 * * 2'\njobs:\n  banc:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Signaler\n        if: \${{ ${si} }}\n        run: |\n          ${ligneRun}\n`

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Une COPIE jetable de `.github/workflows/`, sur laquelle les mutations se jouent. */
function depotJetable() {
  const racine = mkdtempSync(join(tmpdir(), 'workflows-du-depot-'))
  mkdirSync(join(racine, DOSSIER), { recursive: true })
  cpSync(join(RACINE, DOSSIER), join(racine, DOSSIER), { recursive: true })
  return racine
}

const ecrire = (racine, fichier, texte) => writeFileSync(join(racine, DOSSIER, fichier), texte)
const lire = (racine, fichier) => readFileSync(join(racine, DOSSIER, fichier), 'utf8')

test('sur l’arbre RÉEL, chaque workflow est déclaré ET son état est mesuré', () => {
  assert.deepEqual(verdict({ cwd: RACINE }), [])
})

test('`mesurerEtat` rend, sur chaque YAML réel, exactement l’état DÉCLARÉ', () => {
  const fichiers = lireWorkflows({ cwd: RACINE })
  assert.deepEqual(fichiers.map((w) => w.fichier).sort(), Object.keys(WORKFLOWS).sort())
  for (const { fichier, texte } of fichiers) {
    const mesure = mesurerEtat(fichier, texte)
    const declare = WORKFLOWS[fichier].etat
    for (const etat of Object.keys(ETATS))
      assert.equal(mesure[etat], etat === declare, `${fichier} : état « ${etat} » — motifs : ${mesure.motifs.join(' ; ')}`)
  }
})

test('chaque raison déclarée NOMME son fait (elle n’est jamais vide)', () => {
  for (const [fichier, { raison }] of Object.entries(WORKFLOWS))
    assert.ok(raison && raison.length > 30, `${fichier} : la raison doit citer le fait qui porte l’état`)
})

test('un `if` qui N’EXIGE PAS le rouge ne vaut pas autosignale (!failure(), success() && !cancelled())', () => {
  // Les trois faux-verts du juge de diff (2026-09-16) : la condition doit faire jouer le step SUR
  // rouge, et le chemin doit s’EXÉCUTER — sans quoi la garde crédite un workflow muet.
  const nie = mesurerEtat('banc.yml', workflowAvec('!failure()', `node ${SIGNALEUR} --verdict rouge`))
  assert.equal(nie.autosignale, false, `(A) !failure() — ${nie.motifs.join(' ; ')}`)
  const vert = mesurerEtat('banc.yml', workflowAvec('success() && !cancelled()', `node ${SIGNALEUR} --verdict rouge`))
  assert.equal(vert.autosignale, false, `(B) success() && !cancelled() — ${vert.motifs.join(' ; ')}`)
})

test('le chemin du signaleur cité en COMMENTAIRE ne vaut pas autosignale : la mesure porte sur ce qui s’EXÉCUTE', () => {
  const prose = mesurerEtat('banc.yml', workflowAvec('!cancelled()', `# jadis : node ${SIGNALEUR}\n          echo rien`))
  assert.equal(prose.autosignale, false, `(C) prose — ${prose.motifs.join(' ; ')}`)
  assert.deepEqual(corpsRun(workflowAvec('!cancelled()', `# jadis : node ${SIGNALEUR}\n          echo rien`)), ['echo rien'])
})

test('les `if` qui font VRAIMENT jouer sur rouge valent autosignale : always(), !cancelled(), failure()', () => {
  for (const si of ['always()', '!cancelled()', 'failure()'])
    assert.equal(
      mesurerEtat('banc.yml', workflowAvec(si, `node ${SIGNALEUR} --verdict rouge`)).autosignale,
      true,
      `« ${si} » devrait valoir autosignale`,
    )
})

test('AUCUN workflow n’écrit une issue en ligne : le signaleur est le seul écrivain', () => {
  const fautes = []
  for (const { fichier, texte } of lireWorkflows({ cwd: RACINE }))
    for (const ligne of corpsRun(texte))
      if (/\bgh issue (create|comment|close)\b/.test(ligne)) fautes.push(`${fichier} : ${ligne}`)
  assert.deepEqual(fautes, [], `un \`gh issue …\` en ligne dans un YAML n’est pas un canal : passe par ${SIGNALEUR}`)
})

test('MORSURE : un `gh issue create` inséré dans un workflow est vu comme une écriture en ligne', () => {
  const racine = depotJetable()
  try {
    ecrire(racine, 'deploy.yml', `${lire(racine, 'deploy.yml')}      - run: gh issue create --title x --body y\n`)
    const fautes = []
    for (const { fichier, texte } of lireWorkflows({ cwd: racine }))
      for (const ligne of corpsRun(texte))
        if (/\bgh issue (create|comment|close)\b/.test(ligne)) fautes.push(`${fichier} : ${ligne}`)
    assert.deepEqual(fautes, ['deploy.yml : gh issue create --title x --body y'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le LECTEUR de `ci.yml` (`gatesDeCi`) lit bien le fichier que PORTE nomme', () => {
  // Confrontation, pas recopie : `cheminCi` (gatesDeCi.mjs) garde son littéral (le registre n’est importé par
  // aucune gate) — c’est ce test qui refuse la dérive entre les deux.
  const racine = mkdtempSync(join(tmpdir(), 'porte-de-gatesDeCi-'))
  try {
    mkdirSync(join(racine, DOSSIER), { recursive: true })
    writeFileSync(join(racine, DOSSIER, PORTE), 'jobs:\n  gates:\n    steps:\n      - run: npm test\n')
    assert.deepEqual(stepsCi({ cwd: racine }).map((s) => s.commande), ['npm test'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un workflow NEUF sans entrée au registre fait rougir la garde', () => {
  const racine = depotJetable()
  try {
    ecrire(racine, 'neuf.yml', 'name: Neuf\non:\n  schedule:\n    - cron: \'0 6 * * 2\'\njobs:\n  banc:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm ci\n')
    const constats = verdict({ cwd: racine })
    assert.equal(constats.length, 1, constats.join('\n'))
    assert.match(constats[0], /neuf\.yml n’est déclaré dans AUCUN état/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un workflow déclaré « autosignale » dont le step signaleur part fait rougir la garde', () => {
  const racine = depotJetable()
  try {
    ecrire(racine, 'deps-report.yml', lire(racine, 'deps-report.yml').replace(`node ${SIGNALEUR}`, 'echo rien'))
    const constats = verdict({ cwd: racine })
    assert.equal(constats.length, 1, constats.join('\n'))
    assert.match(constats[0], /deps-report\.yml est déclaré « autosignale » mais le YAML ne le mesure PAS/)
    assert.match(constats[0], new RegExp(`aucun step n’EXÉCUTE ${SIGNALEUR.replace(/[./]/g, '\\$&')}`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un workflow déclaré « manuel » qui gagne un `on: push` fait rougir la garde', () => {
  const racine = depotJetable()
  try {
    ecrire(racine, 'deploy.yml', lire(racine, 'deploy.yml').replace('on:\n  workflow_dispatch:', 'on:\n  push:\n  workflow_dispatch:'))
    const constats = verdict({ cwd: racine })
    assert.equal(constats.length, 1, constats.join('\n'))
    assert.match(constats[0], /deploy\.yml est déclaré « manuel » mais le YAML ne le mesure PAS/)
    assert.match(constats[0], /déclencheurs : push, workflow_dispatch/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un workflow qui se signale SANS être déclaré « autosignale » fait rougir la garde', () => {
  const racine = depotJetable()
  try {
    ecrire(
      racine,
      'deploy.yml',
      `${lire(racine, 'deploy.yml')}      - name: Se nommer en rougissant\n        if: \${{ !cancelled() }}\n        run: node ${SIGNALEUR} --titre x --label canari --corps r.md --verdict rouge\n`,
    )
    const constats = verdict({ cwd: racine })
    assert.equal(constats.length, 1, constats.join('\n'))
    assert.match(constats[0], /deploy\.yml est déclaré « manuel » mais le YAML mesure AUSSI « autosignale »/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un workflow déclaré mais ABSENT du disque fait rougir la garde', () => {
  const racine = depotJetable()
  try {
    rmSync(join(racine, DOSSIER, 'canari.yml'))
    const constats = verdict({ cwd: racine })
    assert.equal(constats.length, 1, constats.join('\n'))
    assert.match(constats[0], /canari\.yml est déclaré mais ABSENT du disque/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('la PORTE est celle que `coursesCi` consulte — mesuré sur les args réellement passés à `gh`', () => {
  let vus = null
  coursesCi({ env: {}, spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } } })
  const consulte = vus[vus.indexOf('--workflow') + 1]
  assert.ok(vus.includes('--workflow'), `coursesCi ne filtre aucun workflow : ${vus.join(' ')}`)
  assert.equal(consulte, PORTE, 'la porte au push consulte un autre workflow que PORTE')
  assert.equal(WORKFLOWS[consulte]?.etat, 'porte', `${consulte} n’est pas déclaré « porte » au registre`)
})
