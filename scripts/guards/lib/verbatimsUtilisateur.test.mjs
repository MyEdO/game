import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { estContexteVivant, verbatimsUtilisateur, verbatimsDuCorpus } from './verbatimsUtilisateur.mjs'
import { NON_GENERATOR_CHECKS } from '../../docs/build-all.mjs'

const analyser = (texte) => verbatimsUtilisateur('.claude/rules/contrat.md', texte)

test('attribution et date dans les deux ordres, formes de citation et mois', () => {
  for (const texte of [
    '(utilisateur, 2026-10-31 : « Une consigne. »)',
    '(2026-10-31, Clément : « Une consigne. »)',
    'Clément (2026-10-31) : "Une consigne."',
    '« Une consigne. » (Clément, 2026-10-31)',
    '« Une consigne. » (2026-10-31, utilisateur)',
    '(utilisateur, 2026-06 : « Une consigne. »)',
    'Arbitrage user 2026-10-31 : « Une consigne. »',
  ]) assert.equal(analyser(texte).length, 1, texte)
})

test('citation multilignes : ligne physique exacte, CRLF et TOML échappé', () => {
  assert.deepEqual(analyser('Titre\r\n\r\nUtilisateur 2026-10-31 :\r\n« Une\r\nconsigne. »'), [{ ligne: 4, citation: '« Une\nconsigne. »' }])
  assert.equal(verbatimsUtilisateur('.codex/agents/juge.toml', 'instructions = """\nArbitrage utilisateur du 2026-09-28 : « Un contrôle. »\\r\\n\n"""').length, 1)
})

test('deux citations sous une attribution, sans contaminer une phrase suivante', () => {
  assert.deepEqual(analyser('Utilisateur 2026-10-31 : « Première. » et\n« Seconde. ». La règle dit « autre chose ».'), [
    { ligne: 1, citation: '« Première. »' },
    { ligne: 2, citation: '« Seconde. »' },
  ])
})

test('dates successives sous la même attribution : jour et intervalle, sans traverser une phrase', () => {
  for (const date of ['2026-09-23', '2026-09-23 à 2026-09-25']) {
    assert.deepEqual(analyser(`(utilisateur, 2026-07-17 : « A » ; ${date} : « B »). La Source dit « C ».`), [
      { ligne: 1, citation: '« A »' },
      { ligne: 1, citation: '« B »' },
    ])
  }
  assert.deepEqual(analyser('(utilisateur, 2026-07-17 : « A »). 2026-09-23 : « B »'), [{ ligne: 1, citation: '« A »' }])
})

test('section Arbitrages et intro des réponses : dates locales, fin de section', () => {
  assert.equal(analyser('## Arbitrages\n\n- 2026-10-31 : « Première. »\n- 2026-10-30 : « Seconde. »\n\n## Source\n\n« Autre. »').length, 2)
  assert.equal(analyser('## Charte\n\nTirée des réponses de l’utilisateur du 2026-10-31.\n\n- **But.** « Une consigne. » (2026-10-31).').length, 1)
})

test('titre utilisateur daté : labels GUI distincts du choix cité localement et du bloc cité', () => {
  const gui = '## Décisions (validées utilisateur 2026-06-08)\n\n- Maître d’arène : PNJ « maître d’arène » → sa boutique (marchander/réparer/soigner) puis un choix **« Vague suivante »** relance le combat.'
  assert.deepEqual(analyser(gui), [])
  assert.deepEqual(analyser('(utilisateur, 2026-10-25, choix « 2 au plus »)'), [{ ligne: 1, citation: '« 2 au plus »' }])
  assert.deepEqual(analyser('## Contrôles — précisé par l’utilisateur (2026-06-11)\n\n> « Les joueurs ne partagent pas le même écran. »'), [{ ligne: 3, citation: '« Les joueurs ne partagent pas le même écran. »' }])
})

test('date et attribution ne traversent pas les paragraphes ou les éléments de liste', () => {
  assert.deepEqual(analyser('Vécu utilisateur 2026-07-12.\n\n« regarde mon écran »'), [])
  assert.deepEqual(analyser('- Utilisateur 2026-07-12 : mesure.\n- Une règle « citée ».'), [])
})

test('RAW et utilisateur dans la même phrase : seule la parole attribuée est refusée', () => {
  const texte = 'LDB 12 l.1 : « Texte du livre. » ; arbitrage utilisateur du 2026-10-31, verbatim « Une décision. ». Le livre ajoute « autre texte ». '
  assert.deepEqual(verbatimsUtilisateur('docs/raw/4e/tests.md', texte), [{ ligne: 1, citation: '« Une décision. »' }])
})

test('les références RAW datées, verbatim seul et citations sans date restent légitimes', () => {
  for (const texte of [
    'Verbatim LDB (2026-10-31) : « Texte du livre. »',
    'Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05).\n\n« Une méthode. »',
    'Utilisateur : « Une citation sans date. »',
    'Arbitrage utilisateur (2026-06-12) : la contrainte v1 « sans dépendre d’un système externe » est levée.',
    'Arbitrage #327 (2026-07-11) : les forbans du livre vont « fouiller la cale ».',
    '« Texte du livre. » — LDB 12 l.1, vérifié le 2026-10-31.',
  ]) assert.deepEqual(verbatimsUtilisateur('docs/raw/4e/tests.md', texte), [], texte)
})

const plan = (rel) => ['docs/plans', rel].join('/')

test('périmètre et exclusions de principe, y compris plans non datés', () => {
  for (const chemin of ['AGENTS.md', '.claude/credo.md', '.claude/sous-agents.md', '.claude/rules/x.md', '.claude/skills/x/ref.md', '.claude/agents/x.md', '.agents/skills/x/SKILL.md', '.codex/agents/x.toml', 'docs/raw/4e/tests.md', plan('vivant.md')]) assert.equal(estContexteVivant(chemin), true, chemin)
  for (const chemin of ['.claude/memory/user-x.md', '.claude/soldes/1.md', plan('2026-10-31-design.md'), plan('lot/2026-10-31/x.md'), 'Source/livre.md', 'src/engine/x.ts']) assert.equal(estContexteVivant(chemin), false, chemin)
})

test('scan disque : fichier neuf et dérivé présent, archives écartées', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'verbatims-utilisateur-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const poser = (rel, texte) => {
    const parent = rel.slice(0, rel.lastIndexOf('/'))
    if (parent) mkdirSync(join(racine, parent), { recursive: true })
    writeFileSync(join(racine, rel), texte)
  }
  const parole = 'Utilisateur 2026-10-31 : « Une consigne. »'
  poser('AGENTS.md', parole)
  poser('.claude/sous-agents.md', parole)
  poser('docs/raw/implemente.generated.md', parole)
  poser('.claude/memory/user-x.md', parole)
  poser(plan('2026-10-31-design.md'), parole)
  assert.deepEqual(verbatimsDuCorpus({ racine }).map(({ chemin, ligne }) => ({ chemin, ligne })), [{ chemin: '.claude/sous-agents.md', ligne: 1 }, { chemin: 'AGENTS.md', ligne: 1 }, { chemin: 'docs/raw/implemente.generated.md', ligne: 1 }])
  poser('AGENTS.md', 'Consigne — #3175')
  poser('.claude/sous-agents.md', 'Consigne — #3175')
  poser('docs/raw/implemente.generated.md', 'Référence — user-x')
  assert.deepEqual(verbatimsDuCorpus({ racine }), [])
})

test('docs:check appelle la garde après les générateurs', () => {
  assert.ok(NON_GENERATOR_CHECKS.includes('scripts/guards/lib/verbatimsUtilisateur.mjs'))
})

test('formes canoniques des fiches : verbatim daté, ticket daté et emphase', () => {
  for (const texte of [
    '**Verbatim (2026-10-25)** : « Une consigne. »',
    '**Verbatim (2026-10-31, #3175)** : « Une consigne. »',
    'Verbatim (2026-10-25) : « Une consigne. »',
    'Verbatim du 2026-10-25 : « Une consigne. »',
    '**Verbatim (consigné le 2026-07-26, 7f5ea5bfa)** : « Une consigne. »',
    '**Verbatim 2026-10-05** (projets de l’éditeur) : « Une consigne. »',
    '(#1822, 2026-10-05 : « Une consigne. »)',
    '**Utilisateur (2026-10-25)** : « Une consigne. »',
    'Utilisateur (2026-10-25) : **« Une consigne. »**',
    'Utilisateur (2026-10-25) : *« Une consigne. »*',
    'Utilisateur (2026-10-25) : __« Une consigne. »__',
  ]) assert.equal(analyser(texte).length, 1, texte)
})

test('référence Source et simple virgule : aucun verbatim utilisateur annoncé', () => {
  for (const texte of [
    'Arbitrage (2026-10-25), LDB 12 l.1 : « Texte. »',
    'Arbitrage #327 (2026-07-11), ADE III l.4 : « Texte du livre. »',
    '## Arbitrage utilisateur 2026-10-25\n\nLDB 12 l.1 : « Texte. »',
    "Arbitrage utilisateur du 2026-10-25 : le bouton s'appelle, désormais, « Vague suivante ».",
    'Validé utilisateur (2026-10-25), bouton, « Vague suivante ».',
    'DESIGN v2 S2 (#1463, 2026-08-23) : « Une forme de donnée. »',
    'Le commentaire #1466 du 2026-08-23 : « Le registre des SLOTS. »',
  ]) assert.deepEqual(analyser(texte), [], texte)
})
