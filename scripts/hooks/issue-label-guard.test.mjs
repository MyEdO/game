// Tests du garde `issue-label-guard` : refus d'une création de ticket sans label par ses TROIS
// portes (CLI, API REST, GraphQL), refus d'un texte interpolé par le shell, et volet CONTEXTE
// (familles de labels absentes, titre trop long) qui MESURE sans jamais bloquer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import {
  evaluate, contexteEmission, isGhIssueCreateSegment, isGhApiIssueCreate, isGhGraphqlIssueCreate, isLabelFlag,
} from './issue-label-guard.mjs'

const denies = (cmd) => evaluate(cmd) !== null
const allows = (cmd) => evaluate(cmd) === null

test('DENY : gh issue create sans label', () => {
  assert.ok(denies('gh issue create --title "X" --body-file b.md'))
  assert.ok(denies('gh issue new --title "X"'))
})

test('ALLOW : gh issue create AVEC label (toutes graphies)', () => {
  assert.ok(allows('gh issue create --title X --label bug'))
  assert.ok(allows('gh issue create --title X --label "livre:ADE" --label domaine:combat'))
  assert.ok(allows('gh issue create --title X --label=type:donnée'))
  assert.ok(allows('gh issue create --title X -l bug'))
  assert.ok(allows('gh issue create --title X -lbug'))
})

test('ALLOW : autres sous-commandes gh (jamais bloquées)', () => {
  assert.ok(allows('gh issue list --state all'))          // list, pas create
  assert.ok(allows('gh issue edit 5 --add-label bug'))     // edit
  assert.ok(allows('gh label list'))
  assert.ok(allows('gh pr create --title X'))              // pr, pas issue
})

test('ALLOW : la sous-chaîne « gh issue create » citée n\'est pas une création', () => {
  assert.ok(allows('echo "gh issue create --title X"'))            // echo d\'une string
  assert.ok(allows('gh issue list --search "gh issue create"'))    // string quotée = un seul token
})

test('flag global à valeur intercalé avant la sous-commande (adjacence issue/create)', () => {
  assert.ok(denies('gh -R owner/repo issue create --title X'))      // sans label
  assert.ok(allows('gh -R owner/repo issue create --title X --label bug'))
})

test('enchaînements : un segment gh-issue-create sans label dans une chaîne est refusé', () => {
  assert.ok(denies('cd /tmp && gh issue create --title X'))
  assert.ok(allows('cd /tmp && gh issue create --title X --label bug'))
  assert.ok(denies('gh label list && gh issue create --title X'))  // 2e segment sans label
})

test('call-operator PowerShell : & gh issue create', () => {
  assert.ok(denies('& gh issue create --title X'))
})

test('isLabelFlag / isGhIssueCreateSegment (unités)', () => {
  assert.equal(isLabelFlag('--label'), true)
  assert.equal(isLabelFlag('--label=x'), true)
  assert.equal(isLabelFlag('-l'), true)
  assert.equal(isLabelFlag('-lbug'), true)
  assert.equal(isLabelFlag('--title'), false)
  assert.equal(isLabelFlag('bug'), false)
  assert.equal(isGhIssueCreateSegment(['gh', 'issue', 'create']), true)
  assert.equal(isGhIssueCreateSegment(['gh', 'issue', 'new']), true)
  assert.equal(isGhIssueCreateSegment(['gh', 'issue', 'list']), false)
  assert.equal(isGhIssueCreateSegment(['git', 'commit']), false)
})

// ── Portes REST / GraphQL (sonde `sonde-bypass.mjs` : 5 DENY / 5 PASSE → 7 DENY / 3 PASSE) ────────
test('DENY : création de ticket par l’API REST sans champ labels', () => {
  assert.ok(denies(`gh api -X POST /repos/${DEPOT}/issues -f title=x`))
  assert.ok(denies(`gh api --method POST repos/${DEPOT}/issues -f title=x -f body=y`))
})

test('ALLOW : REST avec labels, corps en --input, ou simple LECTURE de la route', () => {
  assert.ok(allows(`gh api -X POST /repos/${DEPOT}/issues -f title=x -f labels[]=sev:mineur`))
  assert.ok(allows(`gh api -X POST /repos/${DEPOT}/issues --input corps.json`))
  assert.ok(allows(`gh api /repos/${DEPOT}/issues`))
  assert.ok(allows(`gh api -X GET /repos/${DEPOT}/issues`))
})

test('DENY : mutation GraphQL createIssue sans labelIds ; ALLOW avec', () => {
  assert.ok(denies('gh api graphql -f query=\'mutation{createIssue(input:{repositoryId:"R",title:"x"}){issue{number}}}\''))
  assert.ok(allows('gh api graphql -f query=\'mutation{createIssue(input:{repositoryId:"R",title:"x",labelIds:["L"]}){issue{number}}}\''))
  assert.ok(allows('gh api graphql -f query=\'query{repository(owner:"o",name:"n"){id}}\''))
})

test('isGhApiIssueCreate / isGhGraphqlIssueCreate (unités)', () => {
  assert.equal(isGhApiIssueCreate(['gh', 'api', '-X', 'POST', '/repos/o/r/issues']), true)
  assert.equal(isGhApiIssueCreate(['gh', 'api', '/repos/o/r/issues']), false)
  assert.equal(isGhApiIssueCreate(['gh', 'api', '-X', 'POST', '/repos/o/r/pulls']), false)
  assert.equal(isGhApiIssueCreate(['gh', 'issue', 'create']), false)
  assert.equal(isGhGraphqlIssueCreate(['gh', 'api', 'graphql', '-f', 'query=mutation{createIssue}']), true)
  assert.equal(isGhGraphqlIssueCreate(['gh', 'api', 'graphql', '-f', 'query=query{viewer}']), false)
})

// ── Texte INTERPOLÉ par le shell : il EXÉCUTE backtics et `$( )` avant que gh les voie (×3) ─────
test('DENY : un corps/titre porteur d’un backtick ou d’un $( ) part en --body-file', () => {
  const backtick = String.fromCharCode(96)
  assert.ok(denies('gh issue comment 42 --body "état : ' + backtick + 'npm test' + backtick + '"'))
  assert.ok(denies('gh issue create --title X --label bug --body "voir ' + backtick + 'src/x.ts' + backtick + '"'))
  assert.ok(denies('gh pr create --title X --body "sha $(git rev-parse HEAD)"'))
  assert.ok(denies('gh issue edit 42 --body "$(cat corps.md)"'))
  assert.match(evaluate('gh issue comment 42 --body "a ' + backtick + 'b' + backtick + '"').reason, /--body-file/)
})

test('ALLOW : le même corps passé en --body-file, et un backtick hors des flags de texte', () => {
  const backtick = String.fromCharCode(96)
  assert.ok(allows('gh issue comment 42 --body-file corps.md'))
  assert.ok(allows('gh issue create --title X --label bug --body-file corps.md'))
  assert.ok(allows('echo "' + backtick + 'date' + backtick + '"'))
})

// ── Volet CONTEXTE : mesure d’abord, jamais un refus (régime « je m’absente des heures ») ─────────
test('CONTEXTE : les familles sev:/type:/domaine: manquantes sont NOMMÉES, sans refus', () => {
  const cmd = 'gh issue create --title X --label bug'
  assert.equal(evaluate(cmd), null, 'un label suffit au refus : les familles ne bloquent pas')
  const ctx = contexteEmission(cmd)
  assert.match(ctx, /sev: type: domaine:/)
  assert.equal(contexteEmission('gh issue create --title X --label sev:mineur --label type:donnée --label domaine:combat --label épique'), null)
  assert.match(contexteEmission('gh issue create --title X --label sev:mineur,type:donnée'), /domaine:/)
})

// #2173 (juge de diff, `cas3.json`) : la création dans un bloc PowerShell s'exécute ; la chaîne qui la cite non.
test('une création de ticket DANS un bloc PowerShell est jugée ; la même création CITÉE dans une chaîne passe', () => {
  assert.ok(denies('1..3 | % { gh issue create --title x --body y }'))
  assert.ok(allows('Get-ChildItem | % { "gh issue create $_" }'))
})

test('CONTEXTE : un titre au-delà de 200 caractères est signalé, jamais refusé', () => {
  const long = 'T'.repeat(201)
  const cmd = 'gh issue create --title "' + long + '" --label sev:mineur --label type:donnée --label domaine:combat'
  assert.equal(evaluate(cmd), null)
  assert.match(contexteEmission(cmd), /201 caractères/)
  const court = 'gh issue create --title "' + 'T'.repeat(200) + '" --label sev:mineur --label type:donnée --label domaine:combat --label épique'
  assert.equal(contexteEmission(court), null, '200 pile reste silencieux (le seuil est un dépassement)')
})

test('CONTEXTE : aucune émission de ticket → aucun contexte', () => {
  assert.equal(contexteEmission('git status'), null)
  assert.equal(contexteEmission('gh issue list --label sev:majeur'), null)
  assert.equal(contexteEmission(''), null)
})

// ── Rattachement en sous-issue native (#2561) : note de CONTEXTE, jamais un refus ─────────────────
const LABELS = '--label sev:mineur --label type:donnée --label domaine:combat'

test('RATTACHEMENT : toute création hors épique reçoit la note, sans refus, corps jamais lu', () => {
  for (const cmd of [
    'gh issue create --title X ' + LABELS + ' --body "constat"',
    'gh issue create --title X ' + LABELS + ' --body-file corps.md',
    'gh issue create --title X ' + LABELS,
  ]) {
    assert.equal(evaluate(cmd), null)
    assert.match(contexteEmission(cmd), /^Rattachement/m, cmd)
  }
})

test('RATTACHEMENT : une création portant le label `épique` est exemptée', () => {
  assert.equal(contexteEmission('gh issue create --title X ' + LABELS + ' --label épique --body "plan"'), null)
  assert.equal(contexteEmission('gh issue create --title X --label sev:mineur,type:donnée,domaine:combat,épique'), null)
})

test("RATTACHEMENT : la note pose les trois questions dans l'ordre du credo, la sous-issue de famille en dernier", () => {
  const note = contexteEmission('gh issue create --title X ' + LABELS + ' --body "constat"')
  const rangs = ['(1) corrigeable dans le geste', '(2) la COUCHE', '`campagne:*` = scénario', '(3) sinon, APRÈS la création', 'sous-issue de sa FAMILLE', 'jamais orpheline']
    .map((jalon) => note.indexOf(jalon))
  assert.ok(rangs.every((r) => r >= 0), `jalons absents : ${rangs}`)
  assert.deepEqual([...rangs].sort((a, b) => a - b), rangs)
  assert.ok(note.includes(`gh api -X POST repos/${DEPOT}/issues/<famille>/sub_issues -F sub_issue_id=<id>`))
})

test("AIDE : `gh issue create --help`, `-h` et `gh help issue create` ne sont pas des créations", () => {
  for (const cmd of ['gh issue create --help', 'gh issue create -h', 'gh help issue create', 'gh api --help repos/o/r/issues -f title=x']) {
    assert.ok(allows(cmd), cmd)
    assert.equal(contexteEmission(cmd), null, cmd)
  }
  assert.ok(denies('gh issue create --title X'), 'sans aide, la création sans label reste refusée')
})

test('une commande trop imbriquée pour être jugée est refusée', () => {
  assert.match(evaluate('echo $($($($($(gh issue create --title x)))))')?.reason ?? '', /commande trop imbriquée pour être jugée/)
})
