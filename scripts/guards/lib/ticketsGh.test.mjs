// CLIQUET de la couture REST des tickets (node --test, sans réseau) : `appel` est FEINT et enregistre
// l'argv reçu — ce banc juge CE QU'ON DEMANDE à `gh` autant que ce qu'on en tire.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { codeSeul } from './commentPoison.mjs'
import { formesDeFermeture } from './sitesDeFermeture.mjs'
import {
  BORNE_RAISON, DEPOT, PAR_PAGE, PLAFOND_PAGES, appelGhRunner, cheminTicket, corpsDeLaPage, dernierEtatDe, lireTicket,
  pagesRest, poserCommentaire,
} from './ticketsGh.mjs'

/** `appel` feint : répond par argv joint, enregistre tout ce qu'il reçoit. */
function ghFeint(reponses) {
  const vus = []
  const options = []
  const appel = (args, o) => {
    vus.push(args)
    options.push(o)
    return reponses[args.join(' ')] ?? { ok: false, raison: `argv non prévu : ${args.join(' ')}` }
  }
  return { appel, vus, options }
}

const page = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ body: `c${i}` })))
const TICKET = `repos/${DEPOT}/issues/1813`

test('cheminTicket : la route REST d’un ticket, dépôt en paramètre', () => {
  assert.equal(cheminTicket(`${DEPOT}`, 1813), TICKET)
  assert.equal(cheminTicket(`${DEPOT}`, '1813'), TICKET)
})

test('corpsDeLaPage : une PAGE est un TABLEAU ; une réponse d’erreur est un OBJET, et elle JETTE', () => {
  assert.deepEqual(corpsDeLaPage('[{"body":"un"},{"body":"deux"}]'), [{ body: 'un' }, { body: 'deux' }])
  assert.deepEqual(corpsDeLaPage('[]'), [])
  // Le refus d'API est un OBJET. Le lire comme une page VIDE ferait croire une marque d'idempotence
  // absente, et l'appelant REPOSTERAIT son commentaire sur un ticket déjà traité.
  assert.throws(
    () => corpsDeLaPage('{"message":"This GitHub API path is not available in agent sessions"}'),
    /non tabulaire/,
  )
  assert.throws(() => corpsDeLaPage('pas du json'), /JSON|json/i)
})

test('PAR_PAGE / PLAFOND_PAGES : la taille de page maximale de l’API, et un plafond ANTI-EMBALLEMENT', () => {
  assert.equal(PAR_PAGE, 100)
  assert.equal(PLAFOND_PAGES, 50)
})

test('pagesRest : une page INCOMPLÈTE est la dernière — c’est la LISTE qui dit où elle s’arrête', () => {
  const { appel, vus } = ghFeint({
    'api truc?per_page=100&page=1': { ok: true, stdout: page(100) },
    'api truc?per_page=100&page=2': { ok: true, stdout: '[{"body":"la dernière"}]' },
  })
  const vue = pagesRest('truc', appel)
  assert.equal(vue.ok, true)
  assert.equal(vue.entrees.length, 101)
  assert.deepEqual(vue.entrees.at(-1), { body: 'la dernière' })
  assert.equal(vus.length, 2)
})

test('pagesRest : AUCUN compteur externe ne borne la boucle — un compteur lu ailleurs peut mentir', () => {
  // Chemin et appel sont les seuls paramètres REQUIS : rien par quoi passer un total. L'arrêt
  // anticipé est un PRÉDICAT sur les entrées lues (`assezLu`), pas un nombre de pages.
  assert.equal(pagesRest.length, 2)
  const { appel } = ghFeint({
    'api truc?per_page=100&page=1': { ok: true, stdout: page(100) },
    'api truc?per_page=100&page=2': { ok: true, stdout: page(0) },
  })
  // Une page PLEINE suivie d'une page vide coûte deux appels : la lecture ne s'arrête pas à 100.
  assert.equal(pagesRest('truc', appel).entrees.length, 100)
})

test('pagesRest : une page vide au premier appel coûte UNE page et rend une liste vide', () => {
  const { appel, vus } = ghFeint({ 'api truc?per_page=100&page=1': { ok: true, stdout: '[]' } })
  assert.deepEqual(pagesRest('truc', appel), { ok: true, entrees: [] })
  assert.equal(vus.length, 1)
})

test('pagesRest : un refus sur UNE page rend ROUGE, jamais une liste PARTIELLE', () => {
  const { appel } = ghFeint({
    'api truc?per_page=100&page=1': { ok: true, stdout: page(100) },
    'api truc?per_page=100&page=2': { ok: false, raison: 'gh a rendu 1 : HTTP 403' },
  })
  const vue = pagesRest('truc', appel)
  assert.equal(vue.ok, false)
  assert.equal(vue.entrees, undefined, 'une liste partielle ferait manquer ce que porte la page perdue')
  assert.equal(vue.raison, 'gh a rendu 1 : HTTP 403')
})

test('pagesRest : une réponse NON TABULAIRE est nommée, jamais lue comme une page vide', () => {
  const { appel } = ghFeint({
    'api truc?per_page=100&page=1': { ok: true, stdout: '{"message":"not available in agent sessions"}' },
  })
  const vue = pagesRest('truc', appel)
  assert.equal(vue.ok, false)
  assert.match(vue.raison, /non tabulaire/)
})

test('pagesRest : au-delà du PLAFOND la lecture est REFUSÉE, jamais tronquée', () => {
  const vus = []
  const vue = pagesRest('truc', (args) => {
    vus.push(args)
    return { ok: true, stdout: page(PAR_PAGE) }
  })
  assert.equal(vue.ok, false)
  assert.equal(vue.entrees, undefined)
  assert.match(vue.raison, /plus de 50 pages/)
  assert.equal(vus.length, PLAFOND_PAGES)
})

test('pagesRest : `assezLu` arrête la lecture APRÈS une page entière, et jamais au milieu', () => {
  const vus = []
  const vue = pagesRest('truc', (args) => {
    vus.push(args)
    return { ok: true, stdout: JSON.stringify(Array.from({ length: PAR_PAGE }, (_, i) => ({ n: vus.length * 1000 + i }))) }
  }, { assezLu: (entrees) => entrees.some((e) => e.n === 3000) })
  assert.equal(vue.ok, true)
  // La 3ᵉ page porte ce qu'on cherche : trois pages lues, ENTIÈRES, et la 4ᵉ jamais demandée.
  assert.equal(vus.length, 3)
  assert.equal(vue.entrees.length, 3 * PAR_PAGE)
})

test('pagesRest : un `assezLu` jamais satisfait ramène au cas EXHAUSTIF, plafond compris', () => {
  const vus = []
  const vue = pagesRest('truc', (args) => {
    vus.push(args)
    return { ok: true, stdout: page(PAR_PAGE) }
  }, { assezLu: () => false })
  assert.equal(vue.ok, false)
  assert.match(vue.raison, /plus de 50 pages/)
  assert.equal(vus.length, PLAFOND_PAGES)
})

test('pagesRest : sans `assezLu`, la lecture est celle d’avant — à l’entrée près', () => {
  const { appel, vus } = ghFeint({
    'api truc?per_page=100&page=1': { ok: true, stdout: page(100) },
    'api truc?per_page=100&page=2': { ok: true, stdout: page(3) },
  })
  assert.equal(pagesRest('truc', appel).entrees.length, 103)
  assert.equal(vus.length, 2)
})

test('pagesRest : un chemin qui porte DÉJÀ une query reçoit `&`, jamais un second `?`', () => {
  const { appel, vus } = ghFeint({
    'api repos/o/r/issues?state=closed&since=2026-09-01&per_page=100&page=1': { ok: true, stdout: '[]' },
  })
  assert.equal(pagesRest('repos/o/r/issues?state=closed&since=2026-09-01', appel).ok, true)
  assert.equal(vus[0][1].split('?').length - 1, 1)
})

test('pagesRest : jamais `--paginate`, jamais une sous-commande CLI — `gh api` et rien d’autre', () => {
  // `--paginate` est refusé dès la page SUIVANTE en session agent, et rend son objet d'erreur DANS
  // le flux là où le consommateur attend un tableau (mesuré 2026-09-18).
  const { appel, vus } = ghFeint({ 'api truc?per_page=100&page=1': { ok: true, stdout: '[]' } })
  pagesRest('truc', appel)
  for (const argv of vus) {
    assert.equal(argv[0], 'api', `route hors REST : gh ${argv.join(' ')}`)
    assert.notEqual(argv[1], 'graphql')
    assert.equal(argv.includes('--paginate'), false)
  }
})

// ── lireTicket ────────────────────────────────────────────────────────────────

const REP = `${DEPOT}`
const lire = (appel) => lireTicket({ depot: REP, numero: '1813', appel })

test('lireTicket : l’état, les corps de commentaires et leurs DATES, par REST — aucune sous-commande `gh issue`', () => {
  const { appel, vus } = ghFeint({
    [`api ${TICKET}`]: { ok: true, stdout: '{"state":"open","comments":2}' },
    [`api ${TICKET}/comments?per_page=100&page=1`]: {
      ok: true,
      stdout: '[{"body":"un","created_at":"2026-01-01T00:00:00Z"},{"body":"deux","created_at":"2026-01-02T00:00:00Z"}]',
    },
  })
  assert.deepEqual(lire(appel), {
    ok: true, etat: 'open', corps: ['un', 'deux'], dates: ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'],
  })
  assert.deepEqual(vus.map((a) => a[0]), ['api', 'api'])
  // `gh issue view --json` est servi par GraphQL, refusé HTTP 403 aux sessions Claude Code.
  assert.equal(vus.some((a) => a.includes('issue')), false)
})

test('lireTicket : le COMPTEUR `comments` du ticket n’est pas consulté', () => {
  // Il est lu AVANT les pages : un commentaire arrivé entre les deux appels le rend faux. Ici il
  // annonce 100 alors que 101 existent, et le 101ᵉ porte la marque d'idempotence.
  const { appel } = ghFeint({
    [`api ${TICKET}`]: { ok: true, stdout: '{"state":"closed","comments":100}' },
    [`api ${TICKET}/comments?per_page=100&page=1`]: { ok: true, stdout: page(100) },
    [`api ${TICKET}/comments?per_page=100&page=2`]: { ok: true, stdout: '[{"body":"la marque"}]' },
  })
  const vue = lire(appel)
  assert.equal(vue.corps.length, 101)
  assert.equal(vue.corps.at(-1), 'la marque')
})

test('lireTicket : un commentaire sans corps rend une chaîne vide, jamais `undefined`', () => {
  const { appel } = ghFeint({
    [`api ${TICKET}`]: { ok: true, stdout: '{"state":"open"}' },
    [`api ${TICKET}/comments?per_page=100&page=1`]: { ok: true, stdout: '[{}]' },
  })
  assert.deepEqual(lire(appel).corps, [''])
})

test('lireTicket : une PULL REQUEST est refusée AVANT toute lecture de commentaires', () => {
  const { appel, vus } = ghFeint({
    [`api ${TICKET}`]: { ok: true, stdout: '{"state":"open","pull_request":{"url":"…"}}' },
  })
  const vue = lire(appel)
  assert.equal(vue.ok, false)
  assert.match(vue.raison, /pull request, pas un ticket/)
  assert.equal(vus.length, 1)
})

test('lireTicket : refus du ticket, réponse illisible et page d’ERREUR sont NOMMÉS', () => {
  assert.deepEqual(lire(() => ({ ok: false, raison: 'gh absent' })), { ok: false, raison: 'gh absent' })

  const illisible = lire(() => ({ ok: true, stdout: 'pas du json' }))
  assert.equal(illisible.ok, false)
  assert.match(illisible.raison, /réponse gh illisible/)

  const { appel } = ghFeint({
    [`api ${TICKET}`]: { ok: true, stdout: '{"state":"open","comments":1}' },
    [`api ${TICKET}/comments?per_page=100&page=1`]: { ok: true, stdout: '{"message":"not available"}' },
  })
  const vue = lire(appel)
  assert.equal(vue.ok, false)
  assert.match(vue.raison, /non tabulaire/)
})

test('poserCommentaire : le corps par l’ENTRÉE STANDARD (`-F body=@-`), jamais `gh issue comment`', () => {
  // `gh api --help` (`cli/cli` 2.45.0) : « if the value starts with `@`, the rest of the value is
  // interpreted as a filename to read the value from. Pass `-` to read from standard input. »
  const { appel, vus, options } = ghFeint({})
  const corps = 'un solde\navec des `backticks`, des {accolades} et 4 Kio de prose'
  poserCommentaire({ depot: REP, numero: '1813', corps, appel })
  assert.deepEqual(vus[0], ['api', `${TICKET}/comments`, '-X', 'POST', '-F', 'body=@-'])
  assert.deepEqual(options[0], { input: corps })
  // Ni la liste d'ARGUMENTS (un solde entier ne tient pas dans l'argv), ni un FICHIER à balayer.
  assert.equal(vus[0].some((a) => a.includes(corps) || /^body=@[^-]/.test(String(a))), false)
})

test('appelGhRunner : le motif d’un refus vient de STDERR — `err.message` n’est que la commande', () => {
  // Mesuré : `err.message` d'`execFileSync` commence par « Command failed: gh api repos/… -X POST -F
  // body=@- », ~120 caractères avant le moindre motif. C'est stderr qui porte « gh: Not Found ».
  const echec = () => {
    const err = new Error(`Command failed: gh api repos/${DEPOT}/issues/999999999 -X POST -F body=@-\n`)
    err.stderr = 'gh: Not Found (HTTP 404)\n'
    throw err
  }
  const vu = appelGhRunner({ cwd: '/c', executer: echec })(['api', 'truc'])
  assert.deepEqual(vu, { ok: false, raison: 'gh: Not Found (HTTP 404)' })
  assert.ok(BORNE_RAISON > 200, 'la commande seule fait déjà ~120 caractères : la borne doit la déborder')
  // Sans stderr (spawn impossible), le message reste le seul motif disponible.
  const nu = appelGhRunner({ cwd: '/c', executer: () => { throw new Error('spawn gh ENOENT') } })(['api', 'truc'])
  assert.deepEqual(nu, { ok: false, raison: 'spawn gh ENOENT' })
})

test('appelGhRunner : stdin REFERMÉ sans entrée, OUVERT quand un corps passe — un seul enrobeur', () => {
  const vus = []
  const executer = (bin, args, o) => {
    vus.push({ bin, args, o })
    return 'ok\n'
  }
  const appel = appelGhRunner({ cwd: '/c', maxBuffer: 7, executer })
  assert.deepEqual(appel(['api', 'truc']), { ok: true, stdout: 'ok\n' })
  // `gh` sur un runner hérite d'un stdin jamais fermé : sans `ignore`, il peut rester pendu.
  assert.equal(vus[0].o.stdio[0], 'ignore')
  assert.equal('input' in vus[0].o, false)
  assert.deepEqual([vus[0].bin, vus[0].o.cwd, vus[0].o.maxBuffer, vus[0].o.shell], ['gh', '/c', 7, undefined])

  appel(['api', 'truc'], { input: 'un corps' })
  // `input` impose `stdio[0] = 'pipe'` et Node referme le tube après écriture : l'invariant tient.
  assert.equal(vus[1].o.stdio[0], 'pipe')
  assert.equal(vus[1].o.input, 'un corps')
})

test('appelGhRunner : par DÉFAUT c’est le vrai `gh` qui est exécuté, et son refus rend un verdict', () => {
  // Sans ce cas, rien n'assère que le défaut d'`executer` est `execFileSync` : un banc qui n'injecte
  // que des feints prouverait un enrobeur que personne n'exécute. Argv REFUSÉ par `gh` avant toute
  // requête (sous-commande inconnue), donc aucun réseau, aucun jeton, aucun effet.
  const vu = appelGhRunner({ cwd: process.cwd() })(['ceci-n-est-pas-une-sous-commande-gh'])
  assert.equal(vu.ok, false)
  assert.ok(vu.raison.trim().length > 0, 'un refus sans motif ne sert personne')
  assert.equal('stdout' in vu, false)
})

test('appelGhRunner : la sortie est du TEXTE, jamais un Buffer — `encoding` est passé', () => {
  let vues
  const executer = (bin, args, o) => {
    vues = o
    return 'du texte\n'
  }
  const vu = appelGhRunner({ cwd: '/c', executer })(['api', 'truc'])
  assert.equal(vues.encoding, 'utf8')
  assert.equal(typeof vu.stdout, 'string')
})

test('la couture REST ne FERME rien, et ne PATCHE rien : elle LIT et elle COMMENTE', () => {
  // Portée de ce cas : `ticketsGh.mjs`, et lui seul. Le recensement des sites de fermeture du DÉPÔT
  // est une autre mesure, générale, qui vit dans `sitesDeFermeture.mjs` et son banc.
  const code = codeSeul(readFileSync(new URL('./ticketsGh.mjs', import.meta.url), 'utf8'))
  assert.deepEqual(formesDeFermeture(code), [], 'aucune graphie de fermeture dans la couture')
  // Les TROIS graphies de chaîne : un gabarit `PATCH` passerait sous une paire de quotes seule.
  assert.equal(/state=closed|issue\s+close|['"`]PATCH['"`]/.test(code), false)
})

test('dernierEtatDe : le DERNIER `closed`/`reopened` des événements et sa DATE, les autres ignorés ; un refus est NOMMÉ', () => {
  const evenements = (...noms) => JSON.stringify(noms.map((event, i) => ({ event, created_at: `2026-01-0${i + 1}T00:00:00Z` })))
  const { appel, vus } = ghFeint({
    [`api ${TICKET}/events?per_page=100&page=1`]: { ok: true, stdout: evenements('labeled', 'closed', 'reopened', 'labeled') },
  })
  assert.deepEqual(dernierEtatDe({ depot: DEPOT, numero: 1813, appel }), { ok: true, evenement: 'reopened', date: '2026-01-03T00:00:00Z' })
  assert.deepEqual(vus, [['api', `${TICKET}/events?per_page=100&page=1`]])
  const ferme = ghFeint({ [`api ${TICKET}/events?per_page=100&page=1`]: { ok: true, stdout: evenements('reopened', 'closed') } })
  assert.deepEqual(dernierEtatDe({ depot: DEPOT, numero: 1813, appel: ferme.appel }), { ok: true, evenement: 'closed', date: '2026-01-02T00:00:00Z' })
  const aucun = ghFeint({ [`api ${TICKET}/events?per_page=100&page=1`]: { ok: true, stdout: evenements('labeled') } })
  assert.deepEqual(dernierEtatDe({ depot: DEPOT, numero: 1813, appel: aucun.appel }), { ok: true, evenement: null, date: null })
  const refus = ghFeint({ [`api ${TICKET}/events?per_page=100&page=1`]: { ok: false, raison: 'HTTP 502' } })
  assert.deepEqual(dernierEtatDe({ depot: DEPOT, numero: 1813, appel: refus.appel }), { ok: false, raison: 'HTTP 502' })
})
