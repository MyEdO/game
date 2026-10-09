// CLIQUET du GESTE de fermeture (node --test, sans réseau) : `appel` est FEINT, et le module sous
// test est une FEUILLE — le banc le vérifie sur les imports du dépôt.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT, lireTicket } from '../guards/lib/ticketsGh.mjs'
import { readFileSync } from 'node:fs'
import { FEUILLES, manquementsDeFeuilles } from '../guards/lib/modulesFeuilles.mjs'
import { fermeturesDeLaPlage, marqueDe } from '../guards/lib/plageFermante.mjs'
import { fermerLeTicket, traiterUnTicket } from './fermer-depuis-main.mjs'

// ── LE geste de fermeture, par REST (#1813) ───────────────────────────────────

test('fermerLeTicket : le solde POSTÉ puis l’état PATCHÉ — jamais `gh issue close` (GraphQL)', () => {
  const vus = []
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', raison: 'completed', appel: (args, o) => {
    vus.push({ args, o })
    return { ok: true, stdout: '{}' }
  } })
  assert.deepEqual(vu, { ok: true })
  assert.equal(vus.length, 2)
  // Le corps ne passe NI par la liste d'arguments, NI par un fichier : `-F body=@-` le fait lire sur
  // l'ENTRÉE STANDARD (`gh api --help`, `cli/cli` 2.45.0).
  assert.deepEqual(vus[0].args, ['api', `repos/${DEPOT}/issues/1813/comments`, '-X', 'POST', '-F', 'body=@-'])
  assert.deepEqual(vus[0].o, { input: 'le solde' })
  assert.equal(vus.flatMap((v) => v.args).some((a) => a.includes('le solde') || a.startsWith('body=@/')), false)
  assert.deepEqual(vus[1].args, ['api', `repos/${DEPOT}/issues/1813`, '-X', 'PATCH', '-f', 'state=closed', '-f', 'state_reason=completed'])
  for (const v of vus) assert.equal(v.args.includes('issue'), false)
})

test('fermerLeTicket : `poser: false` rejoue le SEUL patch, sous la raison donnée — un solde déjà au fil ne se redouble pas', () => {
  const vus = []
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', raison: 'not_planned', poser: false, appel: (args) => {
    vus.push(args)
    return { ok: true, stdout: '{}' }
  } })
  assert.deepEqual(vu, { ok: true })
  assert.equal(vus.length, 1)
  assert.deepEqual(vus[0], ['api', `repos/${DEPOT}/issues/1813`, '-X', 'PATCH', '-f', 'state=closed', '-f', 'state_reason=not_planned'])
})

test('fermerLeTicket : la RAISON de fermeture est un CHAMP `state_reason`, celle qu’on lui donne', () => {
  // Le PATCH REST porte `state` et `state_reason` en deux champs : la doc de
  // `PATCH /repos/{owner}/{repo}/issues/{n}` ne définit AUCUNE valeur de `state_reason` pour un
  // `state=closed` sans raison — le défaut de l’API ne décide jamais.
  for (const raison of ['completed', 'duplicate', 'not_planned']) {
    const vus = []
    fermerLeTicket({ numero: '1813', corps: 'le solde', raison, poser: false, appel: (args) => {
      vus.push(args)
      return { ok: true, stdout: '{}' }
    } })
    const i = vus[0].indexOf(`state_reason=${raison}`)
    assert.notEqual(i, -1, `la raison ${raison} n’est pas passée`)
    assert.equal(vus[0][i - 1], '-f', '`state_reason` doit être un CHAMP, jamais un fragment de query')
  }
})

test('fermerLeTicket : commentaire refusé → AUCUN patch — un ticket fermé sans son solde est la fuite', () => {
  const vus = []
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', raison: 'completed', appel: (args) => {
    vus.push(args)
    return { ok: false, raison: 'gh: Not Found (HTTP 404)' }
  } })
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /commentaire non posé — gh: Not Found \(HTTP 404\)/)
  assert.equal(vus.length, 1)
})

test('fermerLeTicket : un PATCH refusé est NOMMÉ, jamais avalé', () => {
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', raison: 'completed', appel: (args) =>
    (args.includes('PATCH') ? { ok: false, raison: 'HTTP 403' } : { ok: true, stdout: '{}' }) })
  assert.deepEqual(vu, { ok: false, raison: 'HTTP 403' })
})

test('fermerLeTicket n’écrit RIEN sur le disque : aucune fabrique de fichier dans ce module', () => {
  // Le corps part par stdin : un fichier temporaire serait un écrivain de plus à déclarer aux gates,
  // et une source d'exception HORS de la boucle de `main()`.
  const code = readFileSync(new URL('./fermer-depuis-main.mjs', import.meta.url), 'utf8')
  assert.equal(/mkdtempSync|writeFileSync|mkdirSync|appendFileSync/.test(code), false)
})

// ── le CÂBLAGE de l’idempotence : la décision PURE devenue geste ──────────────

/** Les dates des commentaires feints : un jour d'écart chacun, à partir du 2026-01-01. */
const datesDe = (commentaires) => commentaires.map((_, i) => `2026-01-0${i + 1}T00:00:00Z`)
/** Une date d'événement POSTÉRIEURE à tout commentaire feint, et une ANTÉRIEURE. */
const APRES = '2026-02-01T00:00:00Z'
const AVANT = '2025-12-01T00:00:00Z'

/** `traiterUnTicket` avec ses quatre coutures feintes ; `gestes` enregistre ce qui a été DEMANDÉ. */
function traiter({
  etat, commentaires, sha = 'aaa', citants = [sha], emporte = 'VERIFIE: le solde', evenement = 'closed', date = APRES,
}) {
  const gestes = []
  const vu = traiterUnTicket({
    numero: '1813',
    sha,
    citants,
    lire: () => ({ ok: true, etat, corps: commentaires, dates: datesDe(commentaires) }),
    solde: (s) => (emporte === null ? null : `${emporte} de ${s}`),
    evenements: () => ({ ok: true, evenement, date }),
    fermer: (p) => {
      gestes.push(p)
      return { ok: true }
    },
  })
  return { vu, gestes }
}

test('ticket OUVERT sans marque : le solde est POSTÉ puis l’état patché', () => {
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [] })
  assert.equal(vu.ok, true)
  assert.equal(gestes.length, 1)
  assert.equal(gestes[0].poser, true)
  assert.match(gestes[0].corps, /VERIFIE: le solde/)
  assert.match(gestes[0].corps, new RegExp(marqueDe('aaa').replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')))
})

test('ticket OUVERT qui porte DÉJÀ la marque : EXACTEMENT un geste, et il ne POSTE pas', () => {
  // C'est LA régression de la passe 1 : `poser: posteUnSolde(decision)` mutée en `poser: true`
  // reposte un solde identique, et la couche pure n'en sait rien.
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [`solde\n${marqueDe('aaa')}`] })
  assert.equal(vu.ok, true)
  assert.equal(gestes.length, 1, 'un seul geste : le PATCH')
  assert.equal(gestes[0].poser, false, 'le POST est SAUTÉ — le solde est déjà au fil')
  assert.match(vu.dit, /solde DÉJÀ au fil/)
})

test('ticket FERMÉ par ce sha : aucun geste du tout (rejeu du job)', () => {
  const { vu, gestes } = traiter({ etat: 'closed', commentaires: [marqueDe('aaa')] })
  assert.deepEqual(gestes, [])
  assert.match(vu.dit, /déjà fermée par un citant de la plage \(aaa\)/)
})

test('R3 : course de A annulée, `ops:fermer` manuel sur A, ticket ROUVERT, B le cite — il se ferme avec le solde de B', () => {
  // La course suivante recule sa base sous A (`baseDeLaPlage`) : A et B citent le même ticket, qui
  // porte la marque de A et un dernier événement `reopened`.
  const [{ sha, citants }] = fermeturesDeLaPlage([
    { sha: 'aaa', message: 'fix: corrige #1813' },
    { sha: 'bbb', message: 'fix: corrige #1813 pour de bon' },
  ])
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [marqueDe('aaa')], sha, citants, evenement: 'reopened' })
  assert.equal(vu.ok, true)
  assert.equal(gestes.length, 1, 'le ticket rouvert puis cité par B se ferme')
  assert.equal(gestes[0].poser, true, 'le solde de B est POSTÉ')
  assert.match(gestes[0].corps, /VERIFIE: le solde de bbb/)
  assert.match(gestes[0].corps, new RegExp(marqueDe('bbb').replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')))
})

test('R3 bis : marque du dernier citant présente, ticket ROUVERT → AVERTI, jamais refermé', () => {
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [marqueDe('aaa')], evenement: 'reopened' })
  assert.deepEqual(gestes, [], 'un rejeu ne referme pas un ticket rouvert à la main')
  assert.equal(vu.ok, true)
  assert.match(vu.avertissement, /^::warning::\[fermetures\] #1813 ROUVERT/)
})

test('R3 bis, cas e : `reopened` ANTÉRIEUR à la marque → le PATCH raté est rejoué, sans second solde', () => {
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [marqueDe('aaa')], evenement: 'reopened', date: AVANT })
  assert.equal(vu.ok, true)
  assert.equal(gestes.length, 1, 'un ticket rouvert AVANT la pose du solde se ferme')
  assert.equal(gestes[0].poser, false)
})

test('R3 bis, cas d : marque d’un citant NON dernier, PATCH raté → un seul solde, jamais un second', () => {
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [marqueDe('aaa')], sha: 'bbb', citants: ['aaa', 'bbb'] })
  assert.equal(vu.ok, true)
  assert.equal(gestes.length, 1)
  assert.equal(gestes[0].poser, false, 'le solde de A est déjà au fil : B ne poste rien')
})

test('R3 bis : les événements ne se lisent QUE pour un ticket ouvert marqué, et leur refus rougit sans geste', () => {
  let lus = 0
  const base = {
    numero: '1813', sha: 'aaa', solde: () => 'solde',
    evenements: () => { lus += 1; return { ok: false, raison: 'HTTP 502' } },
  }
  const gestes = []
  const fermer = (p) => { gestes.push(p); return { ok: true } }
  traiterUnTicket({ ...base, fermer, lire: () => ({ ok: true, etat: 'open', corps: [], dates: [] }) })
  traiterUnTicket({ ...base, fermer, lire: () => ({ ok: true, etat: 'closed', corps: [], dates: [] }) })
  assert.equal(lus, 0, 'ni `fermer` ni `rapporter` ne paient la lecture des événements')
  gestes.length = 0
  const vu = traiterUnTicket({ ...base, fermer, lire: () => ({ ok: true, etat: 'open', corps: [marqueDe('aaa')], dates: datesDe([0]) }) })
  assert.equal(lus, 1)
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /événements illisibles — HTTP 502/)
  assert.deepEqual(gestes, [])
})

test('R2 : une PR citée s’AVERTIT — la course reste verte, aucun geste', () => {
  const gestes = []
  const vu = traiterUnTicket({
    numero: '2155', sha: 'aaa',
    lire: (n) => lireTicket({ depot: DEPOT, numero: n, appel: () => ({ ok: true, stdout: '{"state":"open","pull_request":{}}' }) }),
    fermer: (p) => { gestes.push(p); return { ok: true } },
    solde: () => null,
  })
  assert.equal(vu.ok, true, 'un rejeu reproduirait l’échec : il ne rougit pas')
  assert.match(vu.avertissement, /^::warning::\[fermetures\] #2155 intraitable — #2155 est une pull request/)
  assert.deepEqual(gestes, [])
})

test('R2 : un ticket INEXISTANT (HTTP 404) ou SUPPRIMÉ (HTTP 410) s’AVERTIT, aucun geste', () => {
  for (const raison of ['gh: Not Found (HTTP 404)', 'gh: This issue was deleted (HTTP 410)']) {
    const gestes = []
    const vu = traiterUnTicket({
      numero: '999999', sha: 'aaa',
      lire: (n) => lireTicket({ depot: DEPOT, numero: n, appel: () => ({ ok: false, raison }) }),
      fermer: (p) => { gestes.push(p); return { ok: true } },
      solde: () => null,
    })
    assert.equal(vu.ok, true, `${raison} : un rejeu reproduirait l’échec`)
    assert.equal(vu.avertissement, `::warning::[fermetures] #999999 intraitable — ${raison} ; non fermé, à vérifier\n`)
    assert.deepEqual(gestes, [])
  }
})

test('ticket FERMÉ par un AUTRE geste : AVERTI, jamais refermé, aucun geste', () => {
  const { vu, gestes } = traiter({ etat: 'closed', commentaires: ['fermée à la main'] })
  assert.deepEqual(gestes, [])
  assert.match(vu.avertissement, /^::warning::/)
  assert.equal(vu.ok, true, 'une publication saine ne rougit pas le job')
})

test('lecture impossible TRANSITOIRE : NOMMÉE, aucun geste — la course rougit et se rejoue', () => {
  const gestes = []
  const vu = traiterUnTicket({
    numero: '1813', sha: 'aaa',
    lire: () => ({ ok: false, raison: 'gh: Bad Gateway (HTTP 502)' }),
    fermer: (p) => { gestes.push(p); return { ok: true } },
    solde: () => null,
  })
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /lecture impossible — gh: Bad Gateway/)
  assert.deepEqual(gestes, [])
})

test('solde ABSENT du commit : le corps le DIT, et la fermeture a lieu quand même', () => {
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [], emporte: null })
  assert.match(gestes[0].corps, /aucun solde emporté/)
  assert.match(vu.dit, /ABSENT/)
})

test('NATURE du solde → `state_reason` du geste : corrigé → completed, doublon → duplicate, caduc/décidé → not_planned, sans solde → completed', () => {
  for (const [emporte, raison] of [
    ['VERIFIE: le solde', 'completed'],
    ['VERIFIE: le solde\nNATURE: corrigé\n', 'completed'],
    ['VERIFIE: le solde\nNATURE: doublon #1700\n', 'duplicate'],
    ['VERIFIE: le solde\nNATURE: caduc\n', 'not_planned'],
    ['VERIFIE: le solde\nNATURE: décidé\n', 'not_planned'],
    [null, 'completed'],
  ]) {
    const { vu, gestes } = traiter({ etat: 'open', commentaires: [], emporte })
    assert.equal(vu.ok, true)
    assert.equal(gestes[0].raison, raison, `${emporte} → ${raison}`)
  }
})

test('NATURE : le chemin `patcher` (solde déjà au fil) porte la raison du solde', () => {
  const { gestes } = traiter({ etat: 'open', commentaires: [`solde\n${marqueDe('aaa')}`], emporte: 'VERIFIE: le solde\nNATURE: caduc\n' })
  assert.equal(gestes.length, 1)
  assert.equal(gestes[0].poser, false)
  assert.equal(gestes[0].raison, 'not_planned')
})

test('NATURE illisible au solde publié : AVERTI, aucun geste — jamais fermé sous une raison devinée', () => {
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [], emporte: 'VERIFIE: le solde\nNATURE: abandonné' })
  assert.deepEqual(gestes, [])
  assert.equal(vu.ok, true)
  assert.match(vu.avertissement, /^::warning::\[fermetures\] #1813 intraitable — solde de aaa : "NATURE: abandonné/)
})

test('CLIQUET : le module qui FERME est une FEUILLE — aucune source suivie ne l’acquiert par un spécificateur LITTÉRAL', () => {
  // Un import suffit à mettre le geste à portée d'appel, et aucune lecture d'argv ne voit un appel
  // indirect. La mesure est GÉNÉRALE et vit dans `scripts/guards/lib/modulesFeuilles.mjs` — un
  // prédicat écrit ici rate les graphies qu'il n'a pas imaginées (multi-ligne, dynamique, ré-export,
  // chemin sans extension, `require`/`createRequire`). CE QU'ELLE PROUVE, et le titre s'y borne :
  // les acquisitions dont le spécificateur est un LITTÉRAL. Un chemin passé par variable n'est
  // lisible par aucune analyse statique.
  const vu = manquementsDeFeuilles()
  assert.deepEqual(vu.manquements, [])
  assert.ok(FEUILLES.some((f) => f.module === 'scripts/ops/fermer-depuis-main.mjs'), 'ce module est DÉCLARÉ feuille')
  assert.ok(vu.sourcesLues > 1000, `la garde ne lit plus les sources du dépôt (${vu.sourcesLues})`)
})
