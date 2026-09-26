// `docs/doctrines.md` est DÉRIVÉ des fiches `.claude/memory/user-*.md`
// (scripts/docs/build-doctrines.mjs). Ce test verrouille les quatre propriétés qui font qu'il ne
// peut pas mentir : le VERBATIM et sa DATE viennent de la fiche, le rendu est DÉTERMINISTE, une
// édition à la main du doc est vue par `--check`, et une fiche NEUVE non reflétée l'est aussi.
// Lancé par `node --test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import {
  citationDe, dateDe, decouperFiche, fichesSuivies, ligneDe, construireDoc, tronquer, verbatimsDe,
} from './build-doctrines.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Fiche de fixture au format réel : frontmatter `name`/`description`/`metadata`, puis corps.
 *  `resume` alimente la clé `description` de l’EN-TÊTE — la garde de graphie de scène ne lit une clé
 *  `description:` que HORS frontmatter (`src/data/scene-prose-graphie-guard.test.ts`). */
const fiche = (nom, { resume = 'sans date', modified = '', corps }) =>
  [
    '---',
    `name: ${nom}`,
    `description: "${resume}"`,
    'metadata: ',
    '  node_type: memory',
    ...(modified ? [`  modified: ${modified}`] : []),
    '---',
    '',
    corps,
    '',
  ].join('\n')

const DATEE = {
  fichier: '.claude/memory/user-doctrine-datee.md',
  texte: fiche('user-doctrine-datee', {
    resume: 'Doctrine utilisateur (2026-08-24, verbatim) — le jet apparaît toujours',
    modified: '2026-08-25T14:37:16.358Z',
    corps: [
      'Directive utilisateur (2026-08-20, verbatim, lot #1426) : « On migre tout vers une forme',
      'canonique, un seul et unique endroit a modifier »',
      '',
      '**Why:** la divergence coûte plus cher que la migration.',
    ].join('\n'),
  }),
}

const ENTETE_SEULE = {
  fichier: '.claude/memory/user-doctrine-entete.md',
  texte: fiche('user-doctrine-entete', {
    resume: 'Doctrine utilisateur — aucune date au corps',
    modified: '2026-07-29T10:56:20.170Z',
    corps: 'Verbatim utilisateur : « Pour moi il ne devait pas y avoir plusieurs hôtes de jet »',
  }),
}

const SANS_DATE = {
  fichier: '.claude/memory/user-doctrine-sans-date.md',
  texte: fiche('user-doctrine-sans-date', {
    corps: 'Verbatim utilisateur : « Chacun fait ce qu il veut, et personne ne mure la porte »',
  }),
}

const TROIS = [DATEE, ENTETE_SEULE, SANS_DATE]
const dateAjout = (f) => (f === SANS_DATE.fichier ? '2026-06-02' : '2000-01-01')

test('découpage — le corps exclut le frontmatter, l en-tête ne porte que lui', () => {
  const { entete, corps } = decouperFiche(DATEE.texte)
  assert.match(entete, /^name: user-doctrine-datee$/m)
  assert.ok(!corps.includes('node_type'))
  assert.ok(corps.trimStart().startsWith('Directive utilisateur'))
})

test('verbatim — la citation la PLUS LONGUE du corps, recollée sur plusieurs lignes', () => {
  const { corps } = decouperFiche(DATEE.texte)
  assert.equal(
    citationDe(corps),
    'On migre tout vers une forme canonique, un seul et unique endroit a modifier',
  )
})

test('verbatim — une citation courte ne fait pas doctrine, la longue gagne', () => {
  const corps = 'Il a dit « oui » puis « la position s apprend, rien ne glisse jamais dans la barre »'
  assert.equal(citationDe(corps), 'la position s apprend, rien ne glisse jamais dans la barre')
})

test('verbatim — un fragment "…" NICHÉ dans un verbatim français ne l évince pas', () => {
  const corps = 'Verbatim : « Y a pas de "classe spéciale" si je suis a l initiative ou si je le subis »'
  assert.equal(citationDe(corps), 'Y a pas de "classe spéciale" si je suis a l initiative ou si je le subis')
})

test('verbatim — tronqué à la frontière de MOT quand il n y a aucune ponctuation, et le dit', () => {
  const long = `${'mot '.repeat(80)}fin`
  const coupe = tronquer(long)
  assert.ok(coupe.length <= 242, `longueur ${coupe.length}`)
  assert.ok(coupe.endsWith(' …'))
  assert.ok(!/mo …$/.test(coupe), 'coupé en plein mot')
})

test('verbatim — tronqué à la FIN DE PHRASE quand la fenêtre en offre une', () => {
  const long = `${'a'.repeat(150)}. ${'b'.repeat(300)}`
  const coupe = tronquer(long)
  assert.ok(coupe.endsWith('.'), `coupe : …${coupe.slice(-30)}`)
  assert.equal(coupe, `${'a'.repeat(150)}.`)
})

test('verbatim — aucune coupe ne laisse un MOT-OUTIL en fin (« face a … »)', () => {
  const coupe = tronquer(`${'x'.repeat(200)} devant un adversaire ou face a une maladie inconnue`)
  assert.ok(!/(\s|^)(un|une|le|la|les|de|des|du|à|a|tu|ca|ça|face a) …$/i.test(coupe), `coupe : …${coupe.slice(-24)}`)
  assert.ok(coupe.endsWith('adversaire …'), `coupe : …${coupe.slice(-24)}`)
})

test('date — le PARAGRAPHE du verbatim prime sur l en-tête', () => {
  const { entete, corps } = decouperFiche(DATEE.texte)
  assert.deepEqual(
    dateDe({ entete, corps, citation: citationDe(corps), dateAjout: () => '2000-01-01' }),
    { date: '2026-08-20', source: 'phrase' },
  )
})

test('date — à défaut, l en-tête (horodatage `modified` compris)', () => {
  const { entete, corps } = decouperFiche(ENTETE_SEULE.texte)
  assert.deepEqual(
    dateDe({ entete, corps, citation: citationDe(corps), dateAjout: () => '2000-01-01' }),
    { date: '2026-07-29', source: 'en-tete' },
  )
})

test('date — à défaut de tout, la date d AJOUT git, DITE comme telle', () => {
  const { entete, corps } = decouperFiche(SANS_DATE.texte)
  assert.deepEqual(
    dateDe({ entete, corps, citation: citationDe(corps), dateAjout: () => '2026-06-02' }),
    { date: '2026-06-02', source: 'ajout' },
  )
  assert.match(ligneDe(SANS_DATE, dateAjout), /\(2026-06-02, date d'ajout\)/)
})

test('extrait — le verbatim PRESCRIPTIF prime sur le grief, même plus bavard', () => {
  const corps = [
    'Grief (2026-08-24) : « Franchement je ne comprends pas ce que tu as fait ici, on avait dit autre',
    'chose la semaine dernière et je perds un temps fou à relire ce que tu produis chaque jour »',
    '',
    "Règle : « On migre tout vers une forme canonique, un seul endroit à modifier »",
  ].join('\n')
  assert.equal(citationDe(corps), 'On migre tout vers une forme canonique, un seul endroit à modifier')
  assert.equal(verbatimsDe(corps).length, 2)
})

test('ligne — le COMPTE de verbatims paraît dès que la fiche en porte plusieurs', () => {
  const plusieurs = {
    fichier: '.claude/memory/user-doctrine-plusieurs.md',
    texte: fiche('user-doctrine-plusieurs', {
      corps: [
        'Verbatim (2026-08-24) : « Le premier verbatim de cette fiche, assez long pour compter »',
        '',
        'Verbatim (2026-08-24) : « Le second verbatim de cette fiche, lui aussi assez long pour compter »',
      ].join('\n'),
    }),
  }
  assert.match(ligneDe(plusieurs, dateAjout), /\(2026-08-24, 2 verbatims\)/)
  assert.doesNotMatch(ligneDe(DATEE, dateAjout), /verbatims/, 'une fiche à UN verbatim ne compte pas')
})

test('ligne — nom, date, verbatim et CHEMIN de la fiche', () => {
  assert.equal(
    ligneDe(DATEE, dateAjout),
    '- **user-doctrine-datee** (2026-08-20) : « On migre tout vers une forme canonique, un seul et ' +
      "unique endroit a modifier » — `.claude/memory/user-doctrine-datee.md`",
  )
})

test('doc — titre, avertissement de dérivé, puis une ligne par fiche triée par chemin', () => {
  const doc = construireDoc(TROIS, { dateAjout })
  const lignes = doc.split('\n').filter((l) => l.startsWith('- **'))
  assert.equal(lignes.length, 3)
  assert.deepEqual(
    lignes.map((l) => /\*\*([^*]+)\*\*/.exec(l)[1]),
    ['user-doctrine-datee', 'user-doctrine-entete', 'user-doctrine-sans-date'],
  )
  assert.match(doc, /^# Doctrines utilisateur — généré\n/)
  assert.match(doc, /Fichier GÉNÉRÉ par `node scripts\/docs\/build-doctrines\.mjs`/)
  assert.ok(doc.endsWith('\n'))
})

test("doc — l ordre des fiches EN ENTRÉE ne décide de rien (cross-OS)", () => {
  assert.equal(construireDoc([...TROIS].reverse(), { dateAjout }), construireDoc(TROIS, { dateAjout }))
})

test('doc — DÉTERMINISTE à l octet (deuxième passe = premier résultat)', () => {
  assert.equal(construireDoc(TROIS, { dateAjout }), construireDoc(TROIS, { dateAjout }))
})

test('--check — un doc ÉDITÉ À LA MAIN diverge du doc régénéré', () => {
  const doc = construireDoc(TROIS, { dateAjout })
  const edite = doc.replace('endroit a modifier', 'endroit à modifier (reformulé)')
  assert.notEqual(edite, doc)
})

// ── Au RÉEL : les fiches du dépôt, pas des fixtures ────────────────────────────────────────
test('AU RÉEL — aucun extrait des fiches du dépôt ne se termine sur un mot-outil', () => {
  const dateAjoutGit = (f) =>
    execFileSync('git', ['log', '--diff-filter=A', '--format=%as', '-1', '--', f], { cwd: RACINE, encoding: 'utf8' }).trim()
  const suspendus = []
  for (const fichier of fichesSuivies(RACINE)) {
    const ligne = ligneDe({ fichier, texte: readFileSync(resolve(RACINE, fichier), 'utf8') }, dateAjoutGit)
    const extrait = /« (.*) » —/.exec(ligne)?.[1] ?? ''
    // Seul un extrait TRONQUÉ peut suspendre la phrase : un verbatim rendu en entier finit comme
    // l'utilisateur l'a fini, et sa fin lui appartient.
    if (!extrait.endsWith(' …')) continue
    if (/(?:^|\s)(?:un|une|le|la|les|des|du|de|à|a|au|aux|et|ou|que|qui|tu|je|il|on|ce|ca|ça|en|dans|pour|par|sur|avec|sans|face|comme|si) …$/i.test(extrait)) {
      suspendus.push(`${fichier} — …${extrait.slice(-40)}`)
    }
  }
  assert.deepEqual(suspendus, [])
})

test('AU RÉEL — la doctrine des JETS rend sa règle, pas un grief', () => {
  const fichier = '.claude/memory/user-doctrine-forme-canonique-unique-jets.md'
  const ligne = ligneDe({ fichier, texte: readFileSync(resolve(RACINE, fichier), 'utf8') })
  assert.match(ligne, /forme canonique|demi-migration/)
  assert.match(ligne, /\(\d{4}-\d{2}-\d{2}, \d+ verbatims\)/)
})

test('--check — une fiche user-* NEUVE non reflétée diverge (fraîcheur)', () => {
  const pose = construireDoc(TROIS, { dateAjout })
  const neuve = {
    fichier: '.claude/memory/user-doctrine-neuve.md',
    texte: fiche('user-doctrine-neuve', {
      corps: 'Verbatim (2026-09-02) : « Une doctrine neuve s écrit en fiche, jamais dans le canon »',
    }),
  }
  const avecNeuve = construireDoc([...TROIS, neuve], { dateAjout })
  assert.notEqual(avecNeuve, pose)
  assert.match(avecNeuve, /user-doctrine-neuve/)
})
