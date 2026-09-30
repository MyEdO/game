// CLIQUET du board des chantiers (node --test) : tout ce qui décide est PUR, et la MESURE se joue sur
// des QUESTIONS au dépôt injectées — la base de comparaison est un paramètre, et la fixture le prouve
// avec une base qui n'est ni `main` ni `origin/main`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { readFileSync } from 'node:fs'
import {
  CHAMPS, COULEURS_STATUT, JOURS_DORMANT, STATUTS, avanceDite,
  construireLignes, cleNormalisee, indexerIssues, issuesDeGh, jourDe, lireChamps,
  lireItems, mesurer, mutationOptions, optionsAReecrire, optionsDuChamp, planDeSync, poserChamp,
  statutDe, statutLePlusVivant, synchroniser, ticketsCites, ticketsDe, valeursDeLigne,
} from './board.mjs'
import { GESTES_DE_L_INVENTAIRE, inventaire } from './worktrees.mjs'

const MS_JOUR = 24 * 60 * 60 * 1000
const MAINTENANT = new Date('2026-09-15T12:00:00Z')
const ilYA = (jours, secondes = 0) => new Date(MAINTENANT.getTime() - jours * MS_JOUR - secondes * 1000).toISOString()

test('avanceDite : l’avance, puis le retard', () => {
  assert.equal(avanceDite({ avance: 1, retard: 17 }), '+1 / −17')
})

test('ticketsDe tire les segments PUREMENT numériques de ≥ 3 chiffres du nom de branche', () => {
  assert.deepEqual(ticketsDe('chantier/1478-1644-recette-opera'), [1478, 1644])
  assert.deepEqual(ticketsDe('wt-1728-L1'), [1728])
  assert.deepEqual(ticketsDe('codex/1388'), [1388])
  assert.deepEqual(ticketsDe('chantier/1739-crb5e'), [1739])
  assert.deepEqual(ticketsDe('chantier/1727-cliquets'), [1727])
  assert.deepEqual(ticketsDe('ab/phanes'), [])
})

test('ticketsDe se replie sur les messages d’avance : le plus cité, à égalité le plus petit', () => {
  const messages = 'fix(x): refs #1500 refs #1500\nchore: refs #1600\n'
  assert.deepEqual(ticketsDe('ab/notre', messages), [1500])
  const egalite = 'feat: refs #1600\nfix: corrige #1500\n'
  assert.deepEqual(ticketsDe('ab/notre', egalite), [1500])
  assert.deepEqual(ticketsDe('ab/notre', 'un message sans citation\n'), [])
})

test('statutDe rend les cinq statuts, et la frontière de JOURS_DORMANT est inclusive', () => {
  const cadre = { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT }
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(0) }, cadre), 'En cours')
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(7) }, cadre), 'En cours')
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(7, 1) }, cadre), 'Dormant')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(1), citeParLaBase: true }, cadre), 'Fusionné')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(1), issue: { state: 'CLOSED' } }, cadre), 'Fermé')
})

test('à 0 commit d’avance, `Fusionné` EXIGE la preuve : sans citation de la base, c’est `Ouvert`', () => {
  const cadre = { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT }
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(0) }, cadre), 'Ouvert')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(0), citeParLaBase: false }, cadre), 'Ouvert')
  assert.equal(statutDe({ avance: 0, dernierCommitISO: ilYA(0), citeParLaBase: true }, cadre), 'Fusionné')
  assert.equal(statutDe({ avance: 3, dernierCommitISO: ilYA(0), citeParLaBase: true }, cadre), 'En cours')
  assert.deepEqual(STATUTS, ['En cours', 'Dormant', 'Ouvert', 'Fusionné', 'Fermé'])
  assert.equal(statutLePlusVivant('Fusionné', 'Ouvert'), 'Ouvert')
})

test('statutDe : `Fermé` PRIME sur une branche vivante', () => {
  const vu = statutDe(
    { avance: 12, dernierCommitISO: ilYA(0), issue: { state: 'CLOSED', closedAt: ilYA(1) } },
    { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT },
  )
  assert.equal(vu, 'Fermé')
  assert.equal(statutLePlusVivant('Dormant', 'En cours'), 'En cours')
  assert.equal(statutLePlusVivant('Fusionné', 'Fermé'), 'Fusionné')
})

test('un ticket porté par DEUX branches : statut le plus vivant, et les deux branches listées', () => {
  const lignes = construireLignes({
    branches: [
      { nom: 'chantier/1501-a', avance: 2, retard: 5, dernierCommitISO: ilYA(20), tickets: [1501], worktrees: [] },
      { nom: 'wt-1501-L2', avance: 4, retard: 1, dernierCommitISO: ilYA(1), tickets: [1501], worktrees: ['/dep/.wt-1501 (sale)'] },
    ],
    issues: new Map([[1501, { number: 1501, state: 'OPEN', title: 'Un chantier' }]]),
  }, { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT })
  assert.equal(lignes.length, 1)
  assert.equal(lignes[0].statut, 'En cours')
  assert.deepEqual(lignes[0].branches, ['chantier/1501-a', 'wt-1501-L2'])
  assert.equal(lignes[0].avance, '+2 / −5 · +4 / −1')
  assert.deepEqual(lignes[0].worktrees, ['/dep/.wt-1501 (sale)'])
  assert.equal(lignes[0].dernierCommit, ilYA(1).slice(0, 10))
})

test('ticketsCites lit une CHAÎNE de `#N` après le mot-clé, et ignore les `#N` nus', () => {
  assert.deepEqual([...ticketsCites('fix: refs #1392 #1388').keys()], [1392, 1388])
  assert.deepEqual([...ticketsCites('feat: refs #1687 #1644 lot 2').keys()], [1687, 1644])
  assert.deepEqual([...ticketsCites('refs #1392, #1388').keys()], [1392, 1388])
  assert.deepEqual([...ticketsCites('taxe #1648').keys()], [])
  assert.deepEqual([...ticketsCites('voir #12').keys()], [])
  assert.deepEqual([...ticketsCites('refs #1644\nautre ligne #99').keys()], [1644])
  assert.equal(ticketsCites('refs #1644 #1644').get(1644), 2)
})

test('jourDe garde le JOUR ÉCRIT PAR GIT (fuseau du committer), jamais un jour recalculé en UTC', () => {
  assert.equal(jourDe('2026-09-14T23:30:00+02:00'), '2026-09-14')
  assert.equal(jourDe('2026-09-14T01:00:00-05:00'), '2026-09-14')
  assert.equal(jourDe(''), '')
  assert.equal(jourDe('pas une date'), '')
})

test('construireLignes trie par statut (En cours → Fermé) puis par ticket croissant', () => {
  const lignes = construireLignes({
    branches: [
      { nom: 'chantier/1900', avance: 1, retard: 0, dernierCommitISO: ilYA(30), tickets: [1900], worktrees: [] },
      { nom: 'chantier/1800', avance: 1, retard: 0, dernierCommitISO: ilYA(0), tickets: [1800], worktrees: [] },
      { nom: 'chantier/1700', avance: 0, retard: 3, dernierCommitISO: ilYA(2), tickets: [1700], worktrees: ['/dep/.wt (propre+fusionné)'] },
      { nom: 'chantier/1300', avance: 0, retard: 0, dernierCommitISO: ilYA(0), tickets: [1300], worktrees: ['/dep/.wt-1300 (tenu)'] },
      { nom: 'chantier/1500', avance: 2, retard: 4, dernierCommitISO: ilYA(0), tickets: [1500], worktrees: ['/dep/.wt-1500 (sale)'] },
    ],
    fusionnes: [{ ticket: 1600, dateISO: ilYA(3) }, { ticket: 1700, dateISO: ilYA(2) }],
    issues: new Map([
      [1600, { number: 1600, state: 'OPEN', closedAt: null }],
      [1500, { number: 1500, state: 'CLOSED', closedAt: ilYA(1) }],
    ]),
  }, { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT })
  assert.deepEqual(lignes.map((l) => [l.statut, l.ticket]),
    [['En cours', 1800], ['Dormant', 1900], ['Ouvert', 1300], ['Fusionné', 1600], ['Fusionné', 1700], ['Fermé', 1500]])
})

test('un ticket SEULEMENT cité par la base et DÉJÀ CLOS ne fait AUCUNE ligne', () => {
  const issues = new Map([[1736, { number: 1736, state: 'CLOSED', closedAt: ilYA(2), title: 'Fini' }]])
  const cadre = { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT }
  assert.deepEqual(construireLignes({ fusionnes: [{ ticket: 1736, dateISO: ilYA(2) }], issues }, cadre), [])

  const avecBranche = construireLignes({
    branches: [{
      nom: 'chantier/1736', avance: 0, retard: 3, dernierCommitISO: ilYA(2), tickets: [1736],
      worktrees: ['/dep/.wt-1736 (propre+fusionné)'],
    }],
    fusionnes: [{ ticket: 1736, dateISO: ilYA(2) }],
    issues,
  }, cadre)
  assert.deepEqual(avecBranche.map((l) => [l.ticket, l.statut, l.worktrees.length]), [[1736, 'Fermé', 1]])
})

const LIGNE = {
  ticket: 1727,
  titre: 'Cliquets',
  statut: 'En cours',
  branches: ['chantier/1727-cliquets'],
  worktrees: ['/dep/.wt-1727 (sale)'],
  avance: '+1 / −17',
  dernierCommit: '2026-09-14',
}

const itemDe = (surcharges = {}) => ({
  id: 'PVTI_1',
  ticket: 1727,
  champs: {
    status: 'En cours',
    branche: 'chantier/1727-cliquets',
    worktree: '/dep/.wt-1727 (sale)',
    avance: '+1 / −17',
    derniercommit: '2026-09-14',
    ...surcharges,
  },
})

test('planDeSync (a) un item ABSENT est ajouté', () => {
  const plan = planDeSync([LIGNE], [])
  assert.deepEqual(plan.ajouts, [1727])
  assert.deepEqual(plan.editions, [])
  assert.deepEqual(plan.archivages, [])
})

test('planDeSync (b) un item PRÉSENT identique ne produit AUCUN geste — idempotence', () => {
  const plan = planDeSync([LIGNE], [itemDe()])
  assert.deepEqual(plan, { ajouts: [], editions: [], archivages: [] })
})

test('planDeSync (c) une seule valeur qui diffère → UNE édition, qui NOMME son champ', () => {
  const plan = planDeSync([LIGNE], [itemDe({ status: 'Dormant' })])
  assert.deepEqual(plan.editions, [{ itemId: 'PVTI_1', champ: 'Status', valeur: 'En cours' }])
  assert.deepEqual(plan.ajouts, [])
})

test('planDeSync : une DATE ne se compare que sur son jour', () => {
  const plan = planDeSync([LIGNE], [itemDe({ derniercommit: '2026-09-14T00:00:00Z' })])
  assert.deepEqual(plan.editions, [])
  assert.equal(CHAMPS.find((c) => c.nom === 'Dernier commit').type, 'DATE')
})

test('planDeSync (b2) un item existant NON mesuré dont l’issue est CLOSED est ARCHIVÉ', () => {
  const parti = { id: 'PVTI_9', ticket: 1751, champs: { status: 'Fermé' } }
  const plan = planDeSync([LIGNE], [itemDe(), parti], {
    issues: new Map([[1751, { number: 1751, state: 'CLOSED', closedAt: ilYA(1) }]]),
  })
  assert.deepEqual(plan.archivages, ['PVTI_9'])
  assert.deepEqual(plan.editions, [])
  assert.deepEqual(plan.ajouts, [])
})

test('planDeSync (c2) un item existant NON mesuré dont l’issue est OUVERTE n’est PAS touché', () => {
  const aLaMain = { id: 'PVTI_9', ticket: 999, champs: { status: 'Todo' } }
  const plan = planDeSync([LIGNE], [itemDe(), aLaMain], {
    issues: new Map([[999, { number: 999, state: 'OPEN', closedAt: null }]]),
  })
  assert.deepEqual(plan, { ajouts: [], editions: [], archivages: [] })
  const sansEtat = planDeSync([LIGNE], [itemDe(), aLaMain])
  assert.deepEqual(sansEtat.archivages, [])
})

test('planDeSync (d) une ligne `Fermé` MESURÉE s’édite normalement et ne s’archive JAMAIS', () => {
  const clos = { ...LIGNE, statut: 'Fermé' }
  const plan = planDeSync([clos], [itemDe()], {
    issues: new Map([[1727, { number: 1727, state: 'CLOSED', closedAt: ilYA(400) }]]),
  })
  assert.deepEqual(plan.archivages, [])
  assert.deepEqual(plan.editions, [{ itemId: 'PVTI_1', champ: 'Status', valeur: 'Fermé' }])
})

test('valeursDeLigne joint branches et worktrees par « · », et keye par NOM de champ', () => {
  const valeurs = valeursDeLigne({ ...LIGNE, branches: ['a', 'b'], worktrees: ['/x (sale)', '/y (tenu)'] })
  assert.deepEqual(Object.keys(valeurs), CHAMPS.map((c) => c.nom))
  assert.equal(valeurs.Branche, 'a · b')
  assert.equal(valeurs.Worktree, '/x (sale) · /y (tenu)')
})

test('le STATUT est porté par le champ INTÉGRÉ `Status`, dont les options sont les nôtres', () => {
  const declare = CHAMPS.find((c) => c.type === 'SINGLE_SELECT')
  assert.equal(declare.nom, 'Status')
  assert.deepEqual([...declare.options], STATUTS)
  assert.equal(valeursDeLigne(LIGNE).Status, 'En cours')
  assert.equal(cleNormalisee('Status'), 'status')
})

test('optionsAReecrire : les nôtres → non ; le Todo/In Progress/Done intégré → oui', () => {
  const integre = {
    fields: [{
      id: 'PVTSSF_1',
      name: 'Status',
      type: 'ProjectV2SingleSelectField',
      options: [{ id: 'a', name: 'Todo' }, { id: 'b', name: 'In Progress' }, { id: 'c', name: 'Done' }],
    }],
  }
  const notre = {
    fields: [{
      id: 'PVTSSF_1',
      name: 'Status',
      type: 'ProjectV2SingleSelectField',
      options: STATUTS.map((nom, i) => ({ id: `o${i}`, name: nom })),
    }],
  }
  assert.deepEqual(optionsDuChamp(integre, 'Status'), ['Todo', 'In Progress', 'Done'])
  assert.equal(optionsAReecrire(optionsDuChamp(integre, 'Status')), true)
  assert.equal(optionsAReecrire(optionsDuChamp(notre, 'Status')), false)
  assert.equal(optionsAReecrire(['Dormant', 'En cours', 'Fusionné', 'Fermé']), true)
  assert.deepEqual(optionsDuChamp(integre, 'Statut absent'), [])
})

test('mutationOptions nomme les 5 options et leur COULEUR, sur le fieldId donné', () => {
  const requete = mutationOptions('PVTSSF_1')
  assert.match(requete, /updateProjectV2Field\(input: \{fieldId: "PVTSSF_1", singleSelectOptions: \[/)
  for (const nom of STATUTS) {
    assert.ok(requete.includes(`{name: "${nom}", color: ${COULEURS_STATUT[nom]}, description: ""}`),
      `option manquante : ${nom} — ${requete}`)
  }
  assert.deepEqual(Object.values(COULEURS_STATUT), ['GREEN', 'ORANGE', 'YELLOW', 'BLUE', 'GRAY'])
  assert.match(requete, /\.\.\. on ProjectV2SingleSelectField \{ id options \{ id name \} \}/)
})

test('indexerIssues : un numéro absent de la liste est une ANOMALIE nommée, pas un ticket silencieux', () => {
  const vu = indexerIssues([{ number: 1727, state: 'open', closed_at: null, title: 'T' }], [1727, 9999])
  assert.equal(vu.issues.get(1727).title, 'T')
  assert.equal(vu.issues.has(9999), false)
  assert.deepEqual(vu.anomalies, [`ticket #9999 introuvable dans ${DEPOT}`])
})

test('indexerIssues rend la forme que lisent les consommateurs : state MAJUSCULE, closedAt', () => {
  // REST rend `open`/`closed` et `closed_at` ; `statutDe` et `planDeSync` comparent à `CLOSED`.
  const vu = indexerIssues([
    { number: 1388, state: 'closed', closed_at: '2026-09-01T10:00:00Z', title: 'Fini' },
    { number: 1727, state: 'open', closed_at: null, title: 'Cliquets' },
  ], [1388, 1727])
  assert.deepEqual(vu.issues.get(1388),
    { number: 1388, state: 'CLOSED', closedAt: '2026-09-01T10:00:00Z', title: 'Fini' })
  assert.deepEqual(vu.issues.get(1727), { number: 1727, state: 'OPEN', closedAt: null, title: 'Cliquets' })
  assert.deepEqual(vu.anomalies, [])
})

test('indexerIssues ÉCARTE les pull requests : la route /issues les sert aussi', () => {
  const vu = indexerIssues([
    { number: 1813, state: 'open', closed_at: null, title: 'PR homonyme', pull_request: { url: '…' } },
  ], [1813])
  assert.equal(vu.issues.has(1813), false)
  assert.deepEqual(vu.anomalies, [`ticket #1813 introuvable dans ${DEPOT}`])
})

const issueFeinte = (number, reste = {}) => ({ number, state: 'open', closed_at: null, title: 'x', ...reste })
const servirPages = (pages) => {
  const routes = []
  const appel = (args) => {
    routes.push(args.join(' '))
    return { ok: true, stdout: JSON.stringify(pages[routes.length - 1] ?? []) }
  }
  return { routes, appel }
}

test('board ne SPAWNE pas : le seul site de spawn `gh` est celui de la couture (`appelGhRunner`)', () => {
  // Deux CONTRATS sont légitimes (`gh` JETTE, la couture rend un verdict) ; deux SPAWNS ne le sont
  // pas — la copie perdrait `stdio[0] = 'ignore'`, la parade au `gh` pendu sur le stdin d'un runner.
  const source = readFileSync(new URL('./board.mjs', import.meta.url), 'utf8')
  assert.equal(/child_process/.test(source), false, 'board.mjs spawne hors de `ticketsGh.mjs`')
})

test('issuesDeGh lit la LISTE page par page — un seul chemin, jamais un GET par numéro', () => {
  const { routes, appel } = servirPages([
    Array.from({ length: 100 }, (_, i) => issueFeinte(2000 + i)),
    [{ number: 1727, state: 'closed', closed_at: '2026-09-10T00:00:00Z', title: 'Cliquets' }],
  ])
  const vu = issuesDeGh([1727, 2000, 4242], appel)
  assert.deepEqual(routes, [
    `api repos/${DEPOT}/issues?state=all&sort=created&direction=desc&per_page=100&page=1`,
    `api repos/${DEPOT}/issues?state=all&sort=created&direction=desc&per_page=100&page=2`,
  ])
  assert.equal(vu.issues.get(1727).state, 'CLOSED')
  assert.equal(vu.issues.get(2000).state, 'OPEN')
  assert.deepEqual(vu.anomalies, [`ticket #4242 introuvable dans ${DEPOT}`])
})

test('issuesDeGh s’arrête dès que TOUS les numéros demandés sont vus — l’ORDRE est DEMANDÉ', () => {
  const { routes, appel } = servirPages([
    Array.from({ length: 100 }, (_, i) => issueFeinte(1900 - i)),
    Array.from({ length: 100 }, (_, i) => issueFeinte(1800 - i)),
    Array.from({ length: 100 }, (_, i) => issueFeinte(1700 - i)),
  ])
  const vu = issuesDeGh([1890, 1750], appel)
  // Le dernier numéro demandé tombe page 2 : la 3ᵉ n'est JAMAIS demandée.
  assert.equal(routes.length, 2)
  for (const route of routes) assert.match(route, /sort=created&direction=desc/)
  assert.deepEqual(vu.anomalies, [])
  assert.equal(vu.issues.get(1750).state, 'OPEN')
})

test('issuesDeGh : l’arrêt est la COMPLÉTUDE, jamais un SEUIL — une issue TRANSFÉRÉE a un numéro NEUF', () => {
  // #1999 vient d'un autre dépôt : date de création ANCIENNE (donc page 3 en tri `created desc`),
  // numéro NEUF. Un arrêt « la page est passée sous le plus petit numéro demandé » la manquerait.
  const { routes, appel } = servirPages([
    Array.from({ length: 100 }, (_, i) => issueFeinte(1900 - i)),
    Array.from({ length: 100 }, (_, i) => issueFeinte(1800 - i)),
    [issueFeinte(1999), issueFeinte(1600)],
  ])
  const vu = issuesDeGh([1850, 1999], appel)
  assert.equal(routes.length, 3, 'un arrêt par SEUIL se serait arrêté à la page 2')
  assert.deepEqual(vu.anomalies, [])
  assert.equal(vu.issues.get(1999).number, 1999)
})

test('issuesDeGh : un numéro INTROUVABLE fait lire la liste entière, et le PLAFOND refuse', () => {
  let pages = 0
  const appel = () => {
    pages += 1
    return { ok: true, stdout: JSON.stringify(Array.from({ length: 100 }, (_, i) => issueFeinte(pages * 1000 + i))) }
  }
  assert.throws(() => issuesDeGh([1], appel), /plus de 50 pages/)
  assert.equal(pages, 50)
})

test('issuesDeGh JETTE sur un refus REST : jamais une carte partielle', () => {
  const appel = () => ({ ok: false, raison: 'HTTP 403 quelque chose' })
  assert.throws(() => issuesDeGh([1727], appel), { message: `lecture des tickets de ${DEPOT} refusée : HTTP 403 quelque chose` })
})

test('lireChamps et lireItems ne lisent que ce qui est contractuel, par NOM normalisé', () => {
  const champs = lireChamps({
    fields: [
      { id: 'F1', name: 'Status', type: 'ProjectV2SingleSelectField', options: [{ id: 'O1', name: 'En cours' }] },
      { id: 'F2', name: 'Dernier commit', type: 'ProjectV2Field' },
    ],
  })
  assert.equal(champs.get(cleNormalisee('Dernier commit')).id, 'F2')
  assert.equal(champs.get('status').options.get(cleNormalisee('En cours')), 'O1')

  const items = lireItems({
    items: [
      { id: 'PVTI_1', title: 'x', content: { type: 'Issue', number: 1727, repository: `${DEPOT}` }, statut: 'En cours', 'dernier commit': '2026-09-14' },
      { id: 'PVTI_2', content: { type: 'DraftIssue', title: 'note' } },
      { id: 'PVTI_3', content: { type: 'Issue', number: 12, repository: 'autre/depot' } },
    ],
    totalCount: 3,
  })
  assert.deepEqual(items.map((i) => i.ticket), [1727])
  assert.equal(items[0].champs[cleNormalisee('Dernier commit')], '2026-09-14')
})

const fait = (valeur) => ({ disponible: true, valeur })

/**
 * Les QUESTIONS du board, factices : chaque réponse est celle d'une question de l'hôte
 * (`GESTES_DU_BOARD`), jamais une sortie de git. `appels` journalise les questions posées.
 */
function gestesFactices({ branches = [], divergence = () => ({ avance: 0, retard: 0 }), journal = () => [], fetchOrigin = () => fait(''), appels = [] } = {}) {
  return {
    arbrePrincipal: () => fait('/dep'),
    fetchOrigin,
    branchesDe: () => branches,
    divergenceDe: (_depot, base, nom) => {
      appels.push(`divergenceDe ${base} ${nom}`)
      return divergence(base, nom)
    },
    journalDe: (_depot, revisions) => {
      appels.push(`journalDe ${revisions.join(' ')}`)
      return journal(revisions)
    },
  }
}
const branche = (nom, dernierCommitISO) => ({ nom, dernierCommitISO, sha: 'aaaaaaa' })

test('la MESURE reçoit sa BASE en paramètre : `main` local n’est jamais la base', () => {
  const appels = []
  const vu = mesurer({
    cwd: '/dep/.wt-1768',
    base: 'origin/autre',
    gestes: gestesFactices({
      branches: [branche('chantier/1727-cliquets', '2026-09-14T09:00:00+02:00'), branche('main', '2026-09-15T08:00:00+02:00')],
      divergence: () => ({ avance: 1, retard: 17 }),
      appels,
    }),
    inv: () => ({ ok: true, worktrees: [{ chemin: '/dep', principal: true, branche: 'main' }] }),
    issues: () => ({ issues: new Map([[1727, { number: 1727, state: 'OPEN', title: 'Cliquets' }]]), anomalies: [] }),
    maintenant: MAINTENANT,
  })
  assert.equal(vu.ok, true)
  assert.ok(appels.includes('divergenceDe origin/autre chantier/1727-cliquets'), `questions posées : ${JSON.stringify(appels)}`)
  assert.ok(appels.includes('journalDe origin/autre..chantier/1727-cliquets'), `questions posées : ${JSON.stringify(appels)}`)
  assert.ok(appels.every((a) => !/(^| )main\.\.|\.\.\.main( |$)| main$/.test(a)), `questions posées : ${JSON.stringify(appels)}`)
  assert.deepEqual(vu.lignes.map((l) => [l.ticket, l.statut, l.avance]), [[1727, 'En cours', '+1 / −17']])
})

test('la mesure NOMME le worktree détaché et la branche sans ticket, et les tient hors du board', () => {
  const vu = mesurer({
    cwd: '/dep',
    base: 'origin/main',
    gestes: gestesFactices({
      branches: [branche('ab/phanes', '2026-09-10T09:00:00+02:00'), branche('chantier/vide', '2026-09-10T09:00:00+02:00')],
      divergence: () => ({ avance: 2, retard: 3 }),
      journal: () => [{ sha: 'aaaaaaa', date: '2026-09-10T09:00:00+02:00', message: 'un message sans citation\n' }],
    }),
    inv: () => ({
      ok: true,
      worktrees: [
        { chemin: '/dep', principal: true, branche: 'main' },
        { chemin: '/dep/.codex/worktrees/914b/Game', principal: false, branche: null, classe: 'propre+hors-main' },
      ],
    }),
    issues: () => ({ issues: new Map(), anomalies: [] }),
    maintenant: MAINTENANT,
  })
  assert.equal(vu.ok, true)
  assert.deepEqual(vu.lignes, [])
  assert.equal(vu.anomalies.filter((a) => a.startsWith('worktree détaché')).length, 1)
  assert.equal(vu.anomalies.filter((a) => a.startsWith('branche sans ticket dérivable')).length, 2)
})

test('la mesure REFUSE nommément quand origin n’est pas consultable', () => {
  const vu = mesurer({
    cwd: '/dep',
    gestes: gestesFactices({ fetchOrigin: () => ({ disponible: false, raison: 'réseau coupé' }) }),
  })
  assert.equal(vu.ok, false)
  assert.match(vu.refus, /origin non consultable \(réseau coupé\)/)
  assert.match(vu.refus, /`npm run ops:board -- --liste --sans-fetch` mesure sur les refs déjà là/)
})

test('UNE mesure = UN fetch, ZÉRO sous sansFetch : l’inventaire est toujours appelé sous `sansFetch: true`', () => {
  for (const [sansFetch, attendus] of [[false, 1], [true, 0]]) {
    let fetchs = 0
    const fetchOrigin = () => { fetchs += 1; return fait('') }
    const demandes = []
    const inv = (params) => {
      demandes.push(params.sansFetch)
      return inventaire({
        ...params,
        gestes: { ...GESTES_DE_L_INVENTAIRE, fetchOrigin, worktreesDe: () => [{ chemin: '/dep', principal: true, branche: 'main' }] },
      })
    }
    const vu = mesurer({ cwd: '/dep', sansFetch, gestes: gestesFactices({ fetchOrigin }), inv, issues: () => ({ issues: new Map(), anomalies: [] }) })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(fetchs, attendus, `sansFetch=${sansFetch}`)
    assert.deepEqual(demandes, [true])
  }
})

test('etatIssue est posé sur TOUTE ligne ; sans portée, jamais de statut `Introuvable`', () => {
  const lignes = construireLignes({
    branches: [
      { nom: 'chantier/1800', avance: 1, retard: 0, dernierCommitISO: ilYA(0), tickets: [1800], worktrees: [] },
      { nom: 'chantier/1500', avance: 1, retard: 0, dernierCommitISO: ilYA(0), tickets: [1500], worktrees: [] },
      { nom: 'chantier/1300', avance: 1, retard: 0, dernierCommitISO: ilYA(0), tickets: [1300], worktrees: [] },
    ],
    issues: new Map([[1800, { state: 'OPEN' }], [1500, { state: 'CLOSED' }]]),
  }, { maintenant: MAINTENANT, joursDormant: JOURS_DORMANT })
  assert.deepEqual(lignes.map((l) => [l.ticket, l.statut, l.etatIssue]),
    [[1300, 'En cours', 'introuvable'], [1800, 'En cours', 'ouvert'], [1500, 'Fermé', 'fermé']])
})

test('une branche sans avance ET sans worktree est IGNORÉE ; avec worktree, `Fusionné` si la base la cite, sinon `Ouvert`', () => {
  const mesureAvec = (citation) => mesurer({
    cwd: '/dep',
    gestes: gestesFactices({
      branches: [branche('chantier/1751-ops', '2026-09-12T09:00:00+02:00'), branche('worktree-agent-mort', '2026-09-01T09:00:00+02:00')],
      divergence: () => ({ avance: 0, retard: 7 }),
      journal: () => (citation ? [{ sha: 'aaaaaaa', date: '2026-09-14T09:00:00+02:00', message: citation }] : []),
    }),
    inv: () => ({
      ok: true,
      worktrees: [
        { chemin: '/dep', principal: true, branche: 'main' },
        { chemin: '/dep/.wt-1751', principal: false, branche: 'chantier/1751-ops', classe: 'propre+fusionné' },
      ],
    }),
    issues: () => ({ issues: new Map([[1751, { number: 1751, state: 'OPEN' }]]), anomalies: [] }),
    maintenant: MAINTENANT,
  })

  const cite = mesureAvec('feat: refs #1751\n')
  assert.deepEqual(cite.lignes.map((l) => [l.ticket, l.statut, l.worktrees]),
    [[1751, 'Fusionné', ['/dep/.wt-1751 (propre+fusionné)']]])
  assert.deepEqual(cite.anomalies, [])

  const sansCitation = mesureAvec('')
  assert.deepEqual(sansCitation.lignes.map((l) => [l.ticket, l.statut]), [[1751, 'Ouvert']])
})

test('la mesure NOMME un journal de base illisible, et ne dit pas « sans ticket » sur un log non lu', () => {
  const vu = mesurer({
    cwd: '/dep',
    gestes: gestesFactices({
      branches: [branche('ab/phanes', '2026-09-10T09:00:00+02:00')],
      divergence: () => ({ avance: 2, retard: 3 }),
      journal: () => null,
    }),
    inv: () => ({ ok: true, worktrees: [{ chemin: '/dep', principal: true, branche: 'main' }] }),
    issues: () => ({ issues: new Map(), anomalies: [] }),
    maintenant: MAINTENANT,
  })
  assert.deepEqual(vu.lignes, [])
  assert.equal(vu.anomalies.filter((a) => a.startsWith('messages d’avance de ab/phanes illisibles')).length, 1)
  assert.equal(vu.anomalies.filter((a) => a.startsWith('journal de origin/main illisible')).length, 1)
  assert.equal(vu.anomalies.filter((a) => a.startsWith('branche sans ticket dérivable')).length, 0)
})

const CHAMPS_FIXTURE = {
  fields: [
    { id: 'F_ST', name: 'Status', type: 'ProjectV2SingleSelectField', options: STATUTS.map((nom, i) => ({ id: `O${i}`, name: nom })) },
    { id: 'F_BR', name: 'Branche', type: 'ProjectV2Field' },
    { id: 'F_WT', name: 'Worktree', type: 'ProjectV2Field' },
    { id: 'F_AV', name: 'Avance', type: 'ProjectV2Field' },
    { id: 'F_DC', name: 'Dernier commit', type: 'ProjectV2Field' },
  ],
}

/** Un `gh` de fixture : rend le JSON attendu par commande, et journalise chaque appel. */
function ghDeFixture(items, appels) {
  return (args) => {
    appels.push(args.join(' '))
    const quoi = args.slice(0, 2).join(' ')
    if (quoi === 'project list') {
      return JSON.stringify({ projects: [{ id: 'PVT_1', number: 1, title: 'Chantiers', closed: false }] })
    }
    if (quoi === 'project field-list') return JSON.stringify(CHAMPS_FIXTURE)
    if (quoi === 'project item-list') return JSON.stringify({ items, totalCount: items.length })
    if (quoi === 'project item-edit' || quoi === 'project item-archive') return '{}'
    if (quoi === 'project item-add') return JSON.stringify({ id: 'PVTI_NEUF' })
    throw new Error(`gh non prévu dans la fixture : ${args.join(' ')}`)
  }
}

const LIGNE_VIDEE = {
  ticket: 1700, statut: 'Fusionné', branches: [], worktrees: [], avance: '', dernierCommit: '',
}

const ITEM_1700 = (champs) => ({
  id: 'PVTI_7',
  content: { type: 'Issue', number: 1700, repository: `${DEPOT}` },
  ...champs,
})

test('synchroniser EFFACE les valeurs devenues vides (--clear) — une branche retirée ne reste pas affichée', () => {
  const appels = []
  const items = [ITEM_1700({
    status: 'En cours', branche: 'chantier/1700-x', worktree: '/dep/.wt-1700 (sale)', avance: '+3 / −2',
  })]
  const bilan = synchroniser({
    lignes: [LIGNE_VIDEE],
    gh: ghDeFixture(items, appels),
    issues: () => ({ issues: new Map(), anomalies: [] }),
  })
  const editions = appels.filter((a) => a.startsWith('project item-edit'))
  assert.equal(bilan.ok, true)
  assert.equal(bilan.misAJour, 4)
  assert.equal(editions.length, 4)
  assert.equal(editions.filter((a) => a.includes('--clear')).length, 3)
  assert.ok(editions.some((a) => a === 'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_ST --single-select-option-id O3'),
    `gestes reçus : ${JSON.stringify(editions)}`)
  for (const champ of ['F_BR', 'F_WT', 'F_AV']) {
    assert.ok(editions.includes(`project item-edit --project-id PVT_1 --id PVTI_7 --field-id ${champ} --clear`),
      `effacement manquant : ${champ} — ${JSON.stringify(editions)}`)
  }
  assert.equal(appels.filter((a) => a.startsWith('project item-add')).length, 0)
})

test('synchroniser : le SECOND passage sur l’item déjà à jour ne fait AUCUN geste', () => {
  const appels = []
  const items = [ITEM_1700({ status: 'Fusionné', branche: '', worktree: '', avance: '' })]
  const bilan = synchroniser({
    lignes: [LIGNE_VIDEE],
    gh: ghDeFixture(items, appels),
    issues: () => ({ issues: new Map(), anomalies: [] }),
  })
  assert.deepEqual(bilan, { ok: true, numero: 1, ajoutes: 0, misAJour: 0, archives: 0, cree: false })
  assert.deepEqual(appels.filter((a) => /item-(edit|add|archive)/.test(a)), [])
})

test('synchroniser ARCHIVE l’item d’un ticket non mesuré dont l’issue est CLOSED', () => {
  const appels = []
  const items = [ITEM_1700({ status: 'Fusionné', branche: '', worktree: '', avance: '' }), {
    id: 'PVTI_9', content: { type: 'Issue', number: 1751, repository: `${DEPOT}` }, status: 'Fermé',
  }]
  const bilan = synchroniser({
    lignes: [LIGNE_VIDEE],
    gh: ghDeFixture(items, appels),
    issues: (numeros) => {
      assert.deepEqual(numeros, [1751])
      return { issues: new Map([[1751, { number: 1751, state: 'CLOSED' }]]), anomalies: [] }
    },
  })
  assert.equal(bilan.archives, 1)
  assert.ok(appels.includes('project item-archive 1 --owner cgauche --id PVTI_9'),
    `gestes reçus : ${JSON.stringify(appels)}`)
})

test('poserChamp : un drapeau par TYPE — texte, date, option, et --clear pour le vide', () => {
  const champs = lireChamps(CHAMPS_FIXTURE)
  const args = []
  const ghFn = (a) => { args.push(a.join(' ')); return '{}' }
  const pose = (champ, valeur) => poserChamp({
    ghFn, projetId: 'PVT_1', itemId: 'PVTI_7', champs, champ, valeur,
  })
  pose('Branche', 'chantier/1700-x')
  pose('Dernier commit', '2026-09-14T09:00:00+02:00')
  pose('Status', 'Dormant')
  pose('Avance', '')
  assert.deepEqual(args, [
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_BR --text chantier/1700-x',
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_DC --date 2026-09-14',
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_ST --single-select-option-id O1',
    'project item-edit --project-id PVT_1 --id PVTI_7 --field-id F_AV --clear',
  ])
  assert.throws(() => pose('Status', 'Todo'), /option « Todo » absente du champ « Status »/)
})
