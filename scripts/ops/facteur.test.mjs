import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AUTEURS_ADMIS, MOTS, corpsDuRelais, destinataires, distribuer } from './facteur.mjs'
import { corpsRun, mesurerEtat, stepsDu } from '../gates/workflowsDuDepot.mjs'

const CORPS = '**Courrier** à la PR du lot 2 — réponse attendue.\nDétail du courrier, à ne pas recopier.'
/** Charge utile `issue_comment` d'un commentaire posé sur le ticket ou la PR `numero`. */
const evenement = ({ body = CORPS, type = 'User', association = 'OWNER', numero = 4068, pr = false, state = 'open' } = {}) => ({
  comment: { body, user: { type, login: 'cgauche' }, author_association: association, html_url: `https://github.com/MyEdO/game/issues/${numero}#issuecomment-1` },
  issue: { number: numero, state, ...(pr ? { pull_request: { url: `https://api.github.com/repos/MyEdO/game/pulls/${numero}` } } : {}) },
})
const prOuverte = (number, ref, depot = 'MyEdO/game') => ({ number, head: { ref, repo: { full_name: depot } } })
const PRS = [
  prOuverte(11, 'chantier/4068'),
  prOuverte(12, 'chantier/4068-l2'),
  prOuverte(13, 'chantier/40'),
  prOuverte(14, 'chantier/40681'),
  prOuverte(15, 'chantier/4068', 'fourche/game'),
]

test('chaque mot de tête commence par `**` : le pré-filtre du job n’en écarte aucun', () => {
  for (const mot of MOTS) assert.ok(mot.startsWith('**'), mot)
})

test('un commentaire de Bot ne se relaie pas', () => {
  assert.deepEqual(destinataires(evenement({ type: 'Bot' }), PRS).numeros, [])
})

test('un auteur hors OWNER, MEMBER, COLLABORATOR ne se relaie pas', () => {
  for (const association of ['NONE', 'CONTRIBUTOR']) {
    assert.ok(!AUTEURS_ADMIS.includes(association))
    assert.deepEqual(destinataires(evenement({ association }), PRS).numeros, [], association)
  }
})

test('un corps sans mot de tête, ou au mot noyé au milieu, ne se relaie pas', () => {
  assert.deepEqual(destinataires(evenement({ body: 'Simple remarque.' }), PRS).numeros, [])
  assert.deepEqual(destinataires(evenement({ body: 'Voir le **Courrier** plus haut.' }), PRS).numeros, [])
})

test('un Courrier sur une PR ouverte se relaie à cette PR, sur une PR fermée à personne', () => {
  assert.deepEqual(destinataires(evenement({ numero: 4069, pr: true, body: `  ${CORPS}` }), []).numeros, [4069])
  assert.deepEqual(destinataires(evenement({ numero: 4069, pr: true, state: 'closed' }), []).numeros, [])
})

test('un Courrier sur le ticket va aux PR de ses chantiers du dépôt, jamais à un préfixe numérique ni à une fourche', () => {
  assert.deepEqual(destinataires(evenement(), PRS).numeros, [11, 12])
})

test('une Prise ou un Rendu d’un auteur admis ne se relaie pas', () => {
  for (const body of ['**Prise** du lot 2, branche : `chantier/4068-l2`.', '**Rendu** du lot 2.'])
    assert.deepEqual(destinataires(evenement({ body }), PRS).numeros, [], body)
})

test('le Courrier qui donne « réponse sur #12 » n’est pas relayé à son adresse de retour', () => {
  const body = '**Courrier** au lot 1, réponse sur #12.'
  assert.deepEqual(destinataires(evenement({ body }), PRS).numeros, [11])
})

test('le relais pointe le commentaire sans en recopier le corps', () => {
  const ev = evenement()
  const relais = corpsDuRelais(ev)
  assert.ok(relais.includes(ev.comment.html_url))
  assert.ok(relais.includes('cgauche') && relais.includes('OWNER') && relais.includes('#4068'))
  for (const ligne of CORPS.split('\n')) assert.ok(!relais.includes(ligne), ligne)
})

/** Un `gh` doublé : la liste des PR ouvertes, et la pose refusée sur `refuse`. */
function banc({ prs = PRS, refuse = null } = {}) {
  const lectures = [], poses = []
  const appel = (args, options = {}) => {
    const chemin = args.find((a) => a.startsWith('repos/'))
    if (args.includes('POST')) {
      const numero = Number(/issues\/(\d+)\/comments$/.exec(chemin)[1])
      if (numero === refuse) return { ok: false, raison: 'HTTP 403' }
      poses.push({ numero, corps: options.input })
      return { ok: true, stdout: '{}' }
    }
    lectures.push(chemin)
    assert.match(chemin, /^repos\/MyEdO\/game\/pulls\?state=open&/)
    return { ok: true, stdout: JSON.stringify(prs) }
  }
  return { appel, lectures, poses }
}

test('distribuer pose le relais sur chaque destinataire, corps par l’entrée standard', () => {
  const b = banc()
  const vu = distribuer({ evenement: evenement(), appel: b.appel })
  assert.deepEqual(vu.poses, [11, 12])
  assert.deepEqual(vu.refus, [])
  assert.deepEqual(b.poses.map((p) => p.corps), [corpsDuRelais(evenement()), corpsDuRelais(evenement())])
})

test('distribuer dit la pose refusée avec la raison de l’appel', () => {
  const vu = distribuer({ evenement: evenement(), appel: banc({ refuse: 12 }).appel })
  assert.deepEqual(vu.poses, [11])
  assert.deepEqual(vu.refus, [{ numero: 12, raison: 'HTTP 403' }])
})

test('distribuer ne lit aucune PR pour un commentaire refusé d’emblée', () => {
  const b = banc()
  const vu = distribuer({ evenement: evenement({ type: 'Bot' }), appel: b.appel })
  assert.deepEqual([b.lectures, vu.poses, vu.refus], [[], [], []])
})

test('facteur.yml : se signale, lit main, et n’interpole rien dans un `run:`', () => {
  const yaml = readFileSync(new URL('../../.github/workflows/facteur.yml', import.meta.url), 'utf8')
  assert.equal(mesurerEtat('facteur.yml', yaml).autosignale, true)
  const checkouts = stepsDu(yaml).filter((s) => /^\s*- uses: actions\/checkout@/m.test(s.bloc))
  assert.equal(checkouts.length, 1)
  assert.match(checkouts[0].bloc, /^\s*ref: main\s*$/m)
  assert.match(checkouts[0].bloc, /^\s*persist-credentials: false\s*$/m)
  for (const ligne of corpsRun(yaml)) assert.ok(!ligne.includes('${{'), ligne)
  assert.ok(corpsRun(yaml).includes('node scripts/ops/facteur.mjs < "$GITHUB_EVENT_PATH"'))
})
