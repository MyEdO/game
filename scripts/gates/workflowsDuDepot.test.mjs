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
import { blocsDeJobs, stepsCi } from './gatesDeCi.mjs'
import { DOSSIER, DOSSIER_ACTIONS, ETATS, PORTE, SIGNALEUR, WORKFLOWS, branchesDePush, corpsRun, declencheursDe, lireActions, lireWorkflows, mesurerEtat, portePipe, shellAPipefail, shellParDefaut, stepsDu, verdict } from './workflowsDuDepot.mjs'

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

test('`declencheursDe` lit les clés du bloc `on:`, sous-clés et commentaires sautés', () => {
  const texte =
    'name: x\non:  # déclencheurs\n  push:\n    branches: [main]\n\n  # à la main\n  workflow_dispatch:\n    inputs:\n      nom:\njobs:\n  tests:\n'
  assert.deepEqual(declencheursDe(texte), ['push', 'workflow_dispatch'])
})

test('`declencheursDe` LÈVE sur toute forme de `on:` qu’il ne sait pas lire, et `mesurerEtat` avec lui', () => {
  const formes = {
    'liste en ligne': 'name: x\non: [push, workflow_dispatch]\njobs:\n',
    'scalaire en ligne': 'name: x\non: workflow_dispatch\njobs:\n',
    'clé citée': 'name: x\n"on":\n  push:\njobs:\n',
    'bloc absent': 'name: x\njobs:\n  tests:\n',
    'bloc vide': 'name: x\non:\njobs:\n',
    'élément de liste': 'name: x\non:\n  - push\njobs:\n',
    'indentation inconnue': 'name: x\non:\n   push:\njobs:\n',
  }
  for (const [forme, texte] of Object.entries(formes)) {
    assert.throws(() => declencheursDe(texte, 'banc.yml'), /^Error: banc\.yml : bloc `on:` illisible/, forme)
    assert.throws(() => mesurerEtat('banc.yml', texte), /^Error: banc\.yml : bloc `on:` illisible/, forme)
  }
})

test('`branchesDePush` lit les filtres `push.branches` du bloc `on:` : liste en ligne ou en bloc, `null` sans filtre, `[]` sans `push`', () => {
  assert.deepEqual(branchesDePush("on:\n  push:\n    branches: ['chantier/**', \"feat/**\", main]  # x\n  merge_group:\n    types: [checks_requested]\njobs:\n"), ['chantier/**', 'feat/**', 'main'])
  assert.deepEqual(branchesDePush('on:\n  push:\n    branches:\n      - chantier/**\n      - feat/**\n    paths:\n      - src/**\njobs:\n'), ['chantier/**', 'feat/**'])
  assert.equal(branchesDePush('on:\n  push:\n    paths: [src/**]\njobs:\n'), null)
  assert.deepEqual(branchesDePush('on:\n  merge_group:\njobs:\n'), [])
  assert.ok(branchesDePush(readFileSync(join(RACINE, DOSSIER, PORTE), 'utf8'), PORTE).length > 0, 'le `ci.yml` du dépôt se lit')
})

test('`branchesDePush` LÈVE sur `branches-ignore`, une valeur scalaire ou une liste vide', () => {
  for (const texte of [
    'on:\n  push:\n    branches-ignore: [x]\njobs:\n',
    'on:\n  push:\n    branches: main\njobs:\n',
    'on:\n  push:\n    branches: []\njobs:\n',
    'on:\n  push:\n    branches:\n    paths: [x]\njobs:\n',
  ])
    assert.throws(() => branchesDePush(texte, 'banc.yml'), /^Error: banc\.yml : filtre `push\.branches` illisible/, texte)
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
  coursesCi({ commit: 'a'.repeat(40), spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } } })
  const consulte = vus[vus.indexOf('--workflow') + 1]
  assert.ok(vus.includes('--workflow'), `coursesCi ne filtre aucun workflow : ${vus.join(' ')}`)
  assert.equal(consulte, PORTE, 'la porte au push consulte un autre workflow que PORTE')
  assert.equal(WORKFLOWS[consulte]?.etat, 'porte', `${consulte} n’est pas déclaré « porte » au registre`)
})

// PIPEFAIL (#3028) : un step sans `shell` tourne sous `bash -e {0}`, SANS pipefail (fixture de log :
// scripts/guards/lib/coursesCi.test.mjs, « shell: /usr/bin/bash -e {0} ») : `mesure | tee` y prend le
// code du `tee`, et l'étape `audit-stock` du canari est restée verte sur 31 écarts. Sous `shell: bash`
// explicite, GitHub lance `bash --noprofile --norc -eo pipefail {0}`.

/**
 * Steps PIPÉS d'un texte qui ne tournent pas sous pipefail, nommés avec leur remède. Le shell effectif
 * est celui du step, sinon `defaults.run.shell` du job, sinon celui du workflow ; une action composite
 * n'a pas de `defaults` : son step porte son `shell`. PUR.
 * @param {string} chemin nommé dans le constat @param {string} texte @param {{ composite?: boolean }} [p]
 */
function pipesSansPipefail(chemin, texte, { composite = false } = {}) {
  const fautes = []
  const juger = (steps, defaut, remede) => {
    for (const s of steps) {
      if (!s.run || !portePipe(corpsRun(s.bloc))) continue
      const shell = s.shell ?? defaut
      if (shellAPipefail(shell)) continue
      fautes.push(
        `${chemin} : step « ${s.nom ?? s.id ?? corpsRun(s.bloc)[0]} » pipe sans pipefail ` +
          `(shell effectif : ${shell ?? (composite ? 'aucun' : 'bash -e {0} par défaut')}) — ${remede}`,
      )
    }
  }
  if (composite) juger(stepsDu(texte, { indent: 4 }), null, 'pose `shell: bash` sur le step')
  else {
    const duWorkflow = shellParDefaut(texte)
    for (const job of blocsDeJobs({ texte }))
      juger(
        stepsDu(job.texte),
        shellParDefaut(job.texte, 4) ?? duWorkflow,
        'pose `shell: bash` sur le step, ou `defaults.run.shell: bash` au workflow ou au job',
      )
  }
  return fautes
}

/** Toutes les fautes de pipefail d'un dépôt (workflows et actions composites). */
const pipesDuDepot = (cwd) => [
  ...lireWorkflows({ cwd }).flatMap(({ fichier, texte }) => pipesSansPipefail(`${DOSSIER}/${fichier}`, texte)),
  ...lireActions({ cwd }).flatMap(({ fichier, texte }) =>
    pipesSansPipefail(`${DOSSIER_ACTIONS}/${fichier}`, texte, { composite: true }),
  ),
]

/** Un workflow d'un job à un step `run`, sous `defaults` de workflow et `shell` de step optionnels. PUR. */
const workflowPipe = (ligneRun, { defaults = '', shell = '' } = {}) =>
  `name: Banc\non:\n  workflow_dispatch:\n${defaults}jobs:\n  banc:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Mesurer\n${shell}        run: |\n          ${ligneRun}\n`
const DEFAUTS_BASH = 'defaults:\n  run:\n    shell: bash\n'

test('PIPEFAIL — sur l’arbre RÉEL, aucun step pipé (workflow ou action composite) ne tourne sans pipefail', () => {
  assert.ok(lireWorkflows({ cwd: RACINE }).length > 0 && lireActions({ cwd: RACINE }).length > 0, 'le dépôt a des workflows et des actions')
  assert.deepEqual(pipesDuDepot(RACINE), [])
})

test('PIPEFAIL — un step pipé SANS shell rougit en nommant son remède ; `defaults.run.shell: bash` ou `shell: bash` le verdit', () => {
  const nu = pipesSansPipefail('banc.yml', workflowPipe('node mesure.mjs | tee rapport.txt'))
  assert.equal(nu.length, 1, nu.join('\n'))
  assert.match(nu[0], /^banc\.yml : step « Mesurer » pipe sans pipefail \(shell effectif : bash -e \{0\} par défaut\)/)
  assert.match(nu[0], /`shell: bash` sur le step, ou `defaults\.run\.shell: bash` au workflow ou au job/)
  assert.deepEqual(pipesSansPipefail('banc.yml', workflowPipe('node mesure.mjs | tee rapport.txt', { defaults: DEFAUTS_BASH })), [])
  assert.deepEqual(pipesSansPipefail('banc.yml', workflowPipe('node mesure.mjs | tee r', { shell: '        shell: bash\n' })), [])
  const job = workflowPipe('node mesure.mjs | tee r').replace('    runs-on:', '    defaults:\n      run:\n        shell: bash\n    runs-on:')
  assert.deepEqual(pipesSansPipefail('banc.yml', job), [], 'defaults.run.shell au JOB')
})

test('PIPEFAIL — `shell: sh` sur le step l’emporte sur `defaults.run.shell: bash` et rougit', () => {
  const fautes = pipesSansPipefail('banc.yml', workflowPipe('a | b', { defaults: DEFAUTS_BASH, shell: '        shell: sh\n' }))
  assert.equal(fautes.length, 1, fautes.join('\n'))
  assert.match(fautes[0], /shell effectif : sh\)/)
})

test('PIPEFAIL — `||`, un `|` entre apostrophes, en commentaire ou dans `${{ }}` n’est pas un pipe ; `$( a | b )` en est un', () => {
  for (const ligne of ['test -z "$x" || exit 1', "gh api --jq '.[] | {number}' x", 'echo ok # a | b', 'echo ${{ a || b }}'])
    assert.deepEqual(pipesSansPipefail('banc.yml', workflowPipe(ligne)), [], ligne)
  for (const ligne of ['X="$(git log | head -1)"', 'a |& b'])
    assert.equal(pipesSansPipefail('banc.yml', workflowPipe(ligne)).length, 1, ligne)
})

test('PIPEFAIL — action composite : un step pipé sans `shell: bash` rougit (pas de `defaults` en composite)', () => {
  const action = (shell) => `name: A\nruns:\n  using: composite\n  steps:\n    - id: m\n${shell}      run: a | tee r\n`
  const fautes = pipesSansPipefail('a/action.yml', action('      shell: sh\n'), { composite: true })
  assert.equal(fautes.length, 1, fautes.join('\n'))
  assert.match(fautes[0], /^a\/action\.yml : step « m » pipe sans pipefail \(shell effectif : sh\) — pose `shell: bash` sur le step$/)
  assert.deepEqual(pipesSansPipefail('a/action.yml', action('      shell: bash\n'), { composite: true }), [])
})

test('MORSURE PIPEFAIL — `defaults:` retiré de canari.yml : la garde rougit en nommant canari.yml', () => {
  const racine = depotJetable()
  try {
    const avant = lire(racine, 'canari.yml')
    const sans = avant.replace(DEFAUTS_BASH, '')
    assert.notEqual(sans, avant, 'canari.yml porte `defaults.run.shell: bash`')
    ecrire(racine, 'canari.yml', sans)
    const fautes = pipesDuDepot(racine)
    assert.ok(fautes.length > 0 && fautes.every((f) => f.startsWith(`${DOSSIER}/canari.yml : `)), fautes.join('\n'))
    assert.ok(fautes.some((f) => f.includes("« Stock d'audit (racine + server) »")), fautes.join('\n'))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
