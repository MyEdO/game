// CLIQUET du GESTE de fermeture (node --test, sans réseau) : `appel` est FEINT, et le module sous
// test est une FEUILLE — le banc le vérifie sur les imports du dépôt.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { echapperRegex } from '../../src/lib/regex.ts'
import { FEUILLES, manquementsDeFeuilles } from '../guards/lib/modulesFeuilles.mjs'
import { marqueDe } from '../guards/lib/plageFermante.mjs'
import { fermerLeTicket, traiterUnTicket } from './fermer-depuis-main.mjs'

// ── LE geste de fermeture, par REST (#1813) ───────────────────────────────────

test('fermerLeTicket : le solde POSTÉ puis l’état PATCHÉ — jamais `gh issue close` (GraphQL)', () => {
  const vus = []
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', appel: (args, o) => {
    vus.push({ args, o })
    return { ok: true, stdout: '{}' }
  } })
  assert.deepEqual(vu, { ok: true })
  assert.equal(vus.length, 2)
  // Le corps ne passe NI par la liste d'arguments, NI par un fichier : `-F body=@-` le fait lire sur
  // l'ENTRÉE STANDARD (`gh api --help`, `cli/cli` 2.45.0).
  assert.deepEqual(vus[0].args, ['api', 'repos/cgauche/game/issues/1813/comments', '-X', 'POST', '-F', 'body=@-'])
  assert.deepEqual(vus[0].o, { input: 'le solde' })
  assert.equal(vus.flatMap((v) => v.args).some((a) => a.includes('le solde') || a.startsWith('body=@/')), false)
  assert.deepEqual(vus[1].args, ['api', 'repos/cgauche/game/issues/1813', '-X', 'PATCH', '-f', 'state=closed', '-f', 'state_reason=completed'])
  for (const v of vus) assert.equal(v.args.includes('issue'), false)
})

test('fermerLeTicket : `poser: false` rejoue le SEUL patch — un solde déjà au fil ne se redouble pas', () => {
  const vus = []
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', poser: false, appel: (args) => {
    vus.push(args)
    return { ok: true, stdout: '{}' }
  } })
  assert.deepEqual(vu, { ok: true })
  assert.equal(vus.length, 1)
  assert.deepEqual(vus[0], ['api', 'repos/cgauche/game/issues/1813', '-X', 'PATCH', '-f', 'state=closed', '-f', 'state_reason=completed'])
})

test('fermerLeTicket : la RAISON de fermeture est posée EXPLICITEMENT, et vaut `completed`', () => {
  // Le PATCH REST porte `state` et `state_reason` en deux champs : la doc de
  // `PATCH /repos/{owner}/{repo}/issues/{n}` ne définit AUCUNE valeur de `state_reason` pour un
  // `state=closed` sans raison. Les fermetures du dépôt portent `completed`, la raison de
  // `gh issue close --reason completed` ; sans ce cas, la retirer serait muette, et le dépôt se
  // mettrait à fermer des tickets sous une raison décidée ailleurs.
  const vus = []
  fermerLeTicket({ numero: '1813', corps: 'le solde', poser: false, appel: (args) => {
    vus.push(args)
    return { ok: true, stdout: '{}' }
  } })
  const i = vus[0].indexOf('state_reason=completed')
  assert.notEqual(i, -1, 'la raison de fermeture n’est plus passée : le défaut de l’API déciderait')
  assert.equal(vus[0][i - 1], '-f', '`state_reason` doit être un CHAMP, jamais un fragment de query')
})

test('fermerLeTicket : commentaire refusé → AUCUN patch — un ticket fermé sans son solde est la fuite', () => {
  const vus = []
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', appel: (args) => {
    vus.push(args)
    return { ok: false, raison: 'gh: Not Found (HTTP 404)' }
  } })
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /commentaire non posé — gh: Not Found \(HTTP 404\)/)
  assert.equal(vus.length, 1)
})

test('fermerLeTicket : un PATCH refusé est NOMMÉ, jamais avalé', () => {
  const vu = fermerLeTicket({ numero: '1813', corps: 'le solde', appel: (args) =>
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

/** `traiterUnTicket` avec ses trois coutures feintes ; `gestes` enregistre ce qui a été DEMANDÉ. */
function traiter({ etat, commentaires, sha = 'aaa', emporte = 'VERIFIE: le solde' }) {
  const gestes = []
  const vu = traiterUnTicket({
    numero: '1813',
    sha,
    lire: () => ({ ok: true, etat, corps: commentaires }),
    solde: () => emporte,
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
  assert.match(gestes[0].corps, new RegExp(echapperRegex(marqueDe('aaa'))))
})

test('ticket OUVERT qui porte DÉJÀ la marque : EXACTEMENT un geste, et il ne POSTE pas', () => {
  // `poser: posteUnSolde(decision)` muté en `poser: true` reposterait un solde identique, et la
  // couche pure n'en saurait rien.
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [`solde\n${marqueDe('aaa')}`] })
  assert.equal(vu.ok, true)
  assert.equal(gestes.length, 1, 'un seul geste : le PATCH')
  assert.equal(gestes[0].poser, false, 'le POST est SAUTÉ — le solde est déjà au fil')
  assert.match(vu.dit, /solde DÉJÀ au fil/)
})

test('ticket FERMÉ par ce sha : aucun geste du tout (rejeu du job)', () => {
  const { vu, gestes } = traiter({ etat: 'closed', commentaires: [marqueDe('aaa')] })
  assert.deepEqual(gestes, [])
  assert.match(vu.dit, /déjà fermée par aaa/)
})

test('ticket FERMÉ par un AUTRE geste : AVERTI, jamais refermé, aucun geste', () => {
  const { vu, gestes } = traiter({ etat: 'closed', commentaires: ['fermée à la main'] })
  assert.deepEqual(gestes, [])
  assert.match(vu.avertissement, /^::warning::/)
  assert.equal(vu.ok, true, 'une publication saine ne rougit pas le job')
})

test('lecture impossible : NOMMÉE, aucun geste — et le ticket suivant n’en pâtit pas', () => {
  const gestes = []
  const vu = traiterUnTicket({
    numero: '1813', sha: 'aaa',
    lire: () => ({ ok: false, raison: 'gh: Not Found (HTTP 404)' }),
    fermer: (p) => { gestes.push(p); return { ok: true } },
    solde: () => null,
  })
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /lecture impossible — gh: Not Found/)
  assert.deepEqual(gestes, [])
})

test('solde ABSENT du commit : le corps le DIT, et la fermeture a lieu quand même', () => {
  const { vu, gestes } = traiter({ etat: 'open', commentaires: [], emporte: null })
  assert.match(gestes[0].corps, /aucun solde emporté/)
  assert.match(vu.dit, /ABSENT/)
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
