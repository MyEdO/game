// `docs/doctrines.md` est DÉRIVÉ des fiches `.claude/memory/user-*.md`
// (scripts/docs/build-doctrines.mjs). Ce test verrouille les quatre propriétés qui font qu'il ne
// peut pas mentir : la DATE vient de la fiche, le rendu est DÉTERMINISTE, une
// édition à la main du doc est vue par `--check`, et une fiche NEUVE non reflétée l'est aussi.
// Lancé par `node --test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import {
  citationDe, dateDe, decouperFiche, defautsDuTexteAssistant, ligneDe, construireDoc, verbatimsDe,
} from './build-doctrines.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'

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

test('date — le PARAGRAPHE du verbatim prime sur l en-tête', () => {
  const { entete, corps } = decouperFiche(DATEE.texte)
  assert.deepEqual(
    dateDe({ entete, corps, citation: citationDe(corps), dateAjout: () => '2000-01-01' }),
    { date: '2026-08-20', source: 'phrase' },
  )
})

test('date — deux verbatims datés COLLÉS : la date est celle de la LIGNE du verbatim qui date la ligne', () => {
  const corps = [
    '**Verbatim (2026-09-04)** : « Une première parole, plus courte. »',
    '**Arbitrage (2026-09-18, #1800)** : « Un module CSS d écran ne déclare que du PLACEMENT ; toute IDENTITÉ vit dans une primitive. »',
    '',
    '**Why :** la raison.',
  ].join('\n')
  const citation = 'Un module CSS d écran ne déclare que du PLACEMENT ; toute IDENTITÉ vit dans une primitive.'
  assert.deepEqual(
    dateDe({ entete: '', corps, citation, dateAjout: () => '2000-01-01' }),
    { date: '2026-09-18', source: 'phrase' },
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

test('verbatim qui date la ligne — le PRESCRIPTIF prime sur le grief, même plus bavard', () => {
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

test('ligne — nom, date, description de l en-tête et CHEMIN de la fiche', () => {
  assert.equal(
    ligneDe(DATEE, dateAjout),
    '- **user-doctrine-datee** (2026-08-20) — Doctrine utilisateur (2026-08-24, verbatim) — le jet apparaît toujours — `.claude/memory/user-doctrine-datee.md`',
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
  assert.match(doc, /Chaque ligne porte le nom, la date, la description de l’en-tête/)
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
  const edite = doc.replace('user-doctrine-datee**', 'user-doctrine-renommee**')
  assert.notEqual(edite, doc)
})

test('doc — les paroles restent dans les fiches, seul leur index est rendu', () => {
  const doc = construireDoc(TROIS, { dateAjout })
  assert.doesNotMatch(doc, /[«»]/)
  for (const { texte } of TROIS) {
    const { corps } = decouperFiche(texte)
    for (const citation of verbatimsDe(corps)) assert.ok(!doc.includes(citation))
  }
})

// ── Convention : le texte de l'ASSISTANT ne fournit pas le verbatim qui date la ligne ─────
const QUESTION_SANS_LE_MOT = "Jusqu'où le jeu doit-il toujours s'écarter des FAITS du livre, au-delà du choix de média pour chaque beat ?"
const REPONSE = 'Adaptation libre, pour profiter du contenu des compagnons, et le MJ fait le reste'
const OPTION = 'Le verbatim d abord, partout où il existe ; toute réplique absente du livre devient une donnée maison'

test('assistant — une ligne marquée `non-verbatim utilisateur` ne fournit JAMAIS le verbatim qui date la ligne, quelle que soit sa forme', () => {
  const cas = {
    'question entre « », sans le mot « question » dans la question': [
      `*Question posée (AskUserQuestion, non-verbatim utilisateur) : « ${QUESTION_SANS_LE_MOT} »*`,
      '',
      `**Verbatim —** réponse libre (2026-09-26) : « ${REPONSE} »`,
    ],
    'question entre guillemets droits, réponse courte': [
      `*Question posée (AskUserQuestion, non-verbatim utilisateur) : "${QUESTION_SANS_LE_MOT}"*`,
      '',
      '**Verbatim —** réponse (2026-09-26) : « Libre. »',
    ],
    'option non retenue entre « »': [
      `*Option non retenue (AskUserQuestion, non-verbatim utilisateur) : « ${QUESTION_SANS_LE_MOT} »*`,
      `**Verbatim —** réponse libre (2026-09-26) : « ${REPONSE} »`,
    ],
    'évaluation d ingénierie, marqueur en milieu de ligne': [
      `- Évaluation d'ingénierie révisable, non-verbatim utilisateur : "${QUESTION_SANS_LE_MOT}"`,
      '**Verbatim —** réponse (2026-09-26) : « Libre. »',
    ],
  }
  for (const [nom, lignes] of Object.entries(cas)) {
    const corps = lignes.join('\n')
    assert.ok(!verbatimsDe(corps).some((v) => v.includes("Jusqu'où")), `${nom} : le texte de l'assistant est un verbatim`)
    assert.ok(!String(citationDe(corps)).includes("Jusqu'où"), `${nom} : le texte de l'assistant est le verbatim qui date la ligne`)
  }
})

/** Le GÉNÉRATEUR refuse (sortie 1, message nommé) : `ligneDe` est le chemin de `construireDoc`. */
const genere = (fichier, texte) => spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { ligneDe } from ${JSON.stringify(pathToFileURL(join(RACINE, 'scripts', 'docs', 'build-doctrines.mjs')).href)}
    ligneDe(${JSON.stringify({ fichier, texte })})
  `], { encoding: 'utf8' })

test('assistant — une ligne marquée porteuse de « » est REFUSÉE, nommée fichier:ligne (question comme option non retenue)', () => {
  for (const [marque, entre] of [['Question posée', QUESTION_SANS_LE_MOT], ['Option non retenue', OPTION]]) {
    const fichier = '.claude/memory/user-doctrine-assistant-guillemete.md'
    const texte = fiche('user-doctrine-assistant-guillemete', {
      corps: [
        'Arbitrage 1 du pilotage (2026-09-26).',
        `*${marque} (AskUserQuestion, non-verbatim utilisateur) : « ${entre} »*`,
        '',
        `**Verbatim —** réponse libre (2026-09-26) : « ${REPONSE} »`,
      ].join('\n'),
    })
    const defauts = defautsDuTexteAssistant(fichier, texte)
    assert.equal(defauts.length, 1, marque)
    assert.match(defauts[0], /^\.claude\/memory\/user-doctrine-assistant-guillemete\.md:9 — texte de l'assistant/, marque)
    assert.deepEqual(defautsDuTexteAssistant(fichier, texte.replace(`« ${entre} »`, entre)), [], marque)
    const run = genere(fichier, texte)
    assert.equal(run.status, 1, `${marque} : sortie ${run.status} — stderr : ${run.stderr}`)
    assert.match(run.stderr, /user-doctrine-assistant-guillemete\.md:9 — texte de l'assistant/, marque)
  }
})

test('assistant — une annonce SANS le marqueur est REFUSÉE, nommée fichier:ligne ; parole de l’utilisateur, mention de l’outil et prose ne le sont pas', () => {
  const fichier = '.claude/memory/user-doctrine-marqueur.md'
  const annonces = [
    '*Question posée (AskUserQuestion) : x', '  *Question posée : x', 'Question posée : x', '**Question posée** : x',
    '- *Question posée : x', '> *Question posée : x', '_Question posée_ : x', 'Arbitrage 1 — *question posée* (AskUserQuestion) : x',
    `*Option non retenue à laquelle elle renvoie (AskUserQuestion) : « ${OPTION} »*`, '- Option écartée : x',
    '*Options proposées : x', "- Évaluation d'ingénierie révisable, pas l'arbitrage : x",
    '- option écartée : x', '- Proposition non retenue : x', '- Évaluation d’ingénierie révisable : x',
    '**Option** écartée : x', '- OPTION NON RETENUE : x', 'Arbitrage 2 — option **écartée** : x',
  ]
  for (const v of annonces) {
    const defauts = defautsDuTexteAssistant(fichier, `a\n${v}\nb`)
    assert.equal(defauts.length, 1, v)
    assert.match(defauts[0], /^\.claude\/memory\/user-doctrine-marqueur\.md:2 — texte de l'assistant .* sans le marqueur `non-verbatim utilisateur`/, v)
  }
  const permises = [
    '*Question posée (AskUserQuestion, non-verbatim utilisateur) : x',
    '*Option non retenue (AskUserQuestion, non-verbatim utilisateur) : x',
    "- Évaluation d'ingénierie révisable, non-verbatim utilisateur : x",
    `**Verbatim —** option retenue (2026-09-26) : « ${REPONSE} »`,
    `*Option retenue (2026-09-26) : « ${REPONSE} »*`,
    '**How to apply :** toute garde porte dans SON fichier un en-tête structuré (question posée A→B→C, primitive employée)',
    "qu'aucune décision ne remonte est une évaluation d'ingénierie révisable",
    `**Verbatim —** option retenue (AskUserQuestion, 2026-09-26) : « ${REPONSE} »`,
    `- Option choisie (2026-09-26) : « ${REPONSE} »`,
    `- Option **retenue** (2026-09-26) : « ${REPONSE} »`,
    `- OPTION RETENUE (2026-09-26) : « ${REPONSE} »`,
    '### Arbitrages (utilisateur, 2026-09-26, AskUserQuestion — option retenue et sa description, verbatim)',
    'Posée par AskUserQuestion : x',
    'Voir la Question posée plus haut.',
  ]
  for (const p of permises) assert.deepEqual(defautsDuTexteAssistant(fichier, p), [], p)
})

test('assistant — les FORMES de la classe : questions posées, question citée hors citation introduite ou suivie de sa réponse, option titrée puis écartée', () => {
  const fichier = '.claude/memory/user-doctrine-marqueur.md'
  // Ligne de base de user-doctrine-edition-5e-coeur-remplace-ldb-raw-sauf-errata.md avant sa migration.
  const base =
    '- Place de la 5e (2026-09-18, réponse à « Quelle place la 5e prend-elle dans le jeu ? ») : « Édition sélectionnable (Recommandé) » — 4e et 5e coexistent. L’option « Règles 5e à la carte sur base 4e » est ÉCARTÉE.'
  const annonces = [
    base,
    '- Place (2026-09-18, réponse à « Quelle place ? ») : « x »',
    '- Question : « Quelle place la 5e prend-elle ? »',
    '- L’option « Règles à la carte » est écartée.',
    '- La proposition « Tout en 5e » non retenue.',
    '- Les options « A » et « B » ont été écartées.',
    '**Choix (2026-10-25)**, à « Combien de Codex en parallèle ? » : « 2 au plus »',
    '*Questions posées (AskUserQuestion) : A ? B ?*',
    '- Lot (2026-10-25), en réponse au « Combien de lots ? » : « un seul »',
    '- Lot (2026-10-25), sur « Combien de lots ? » : « un seul »',
    '- « Combien de lots ? » → « un seul »',
  ]
  for (const v of annonces) {
    const defauts = defautsDuTexteAssistant(fichier, `a\n${v}\nb`)
    assert.equal(defauts.length, 1, v)
  }
  const permises = [
    `- Place de la 5e (2026-09-18) : « Tu veux dire quoi par « carte » ? »`,
    `- L’option « ${REPONSE} » est retenue.`,
    '- Réponse de l’utilisateur (2026-09-18) : « Édition sélectionnable »',
    '*Question posée (AskUserQuestion, non-verbatim utilisateur) : Combien de Codex en parallèle ?*\n**Choix (2026-10-25)** : « 2 au plus »',
    '**Verbatim (2026-10-25)** : « je lance combien de sessions à la fois ? deux, pas plus »',
    '**Verbatim (2026-10-25)** : « réponds à « pourquoi ? » avant de coder »',
  ]
  for (const p of permises) assert.deepEqual(defautsDuTexteAssistant(fichier, p), [], p)
})

test('assistant — un paragraphe **Why** / **How to apply** est de la prose de l’assistant : jamais un verbatim, jusqu’à la ligne vide ou au libellé suivant', () => {
  const WHY = 'si demain on change ce concept, combien de fichiers bougent dans tout le dépôt ?'
  const corps = [
    `**Verbatim (2026-09-04)** : « ${REPONSE} »`,
    '',
    `**Why :** le test est « ${WHY} »`,
    `et la suite du paragraphe « ${WHY} (suite) »`,
    `**How to apply:** « ${WHY} (application) »`,
    `**Teinte :** « ${OPTION} »`,
    '',
    `Reprise : « ${QUESTION_SANS_LE_MOT} »`,
  ].join('\n')
  assert.deepEqual(verbatimsDe(corps), [REPONSE, OPTION, QUESTION_SANS_LE_MOT])
})

test("AU RÉEL — aucune fiche user-* ne range de « » dans le texte de l'assistant, ni n'en tire le verbatim qui date la ligne", () => {
  // Fiches du DISQUE, pas de `git ls-files` : une fiche que git ne suit pas est lue elle aussi.
  const defauts = []
  const fautives = []
  let marquees = 0
  for (const nom of listerDossier(join(RACINE, '.claude', 'memory')).filter((f) => /^user-.*\.md$/.test(f))) {
    const texte = readFileSync(join(RACINE, '.claude', 'memory', nom), 'utf8')
    defauts.push(...defautsDuTexteAssistant(nom, texte))
    const { corps } = decouperFiche(texte)
    const assistant = corps.split('\n').filter((l) => l.includes('non-verbatim utilisateur')).map((l) => l.replace(/\s+/g, ' '))
    marquees += assistant.length
    const verbatim = citationDe(corps)
    if (verbatim && assistant.some((q) => q.includes(verbatim.slice(0, 30)))) fautives.push(`${nom} — « ${verbatim} »`)
  }
  assert.deepEqual(defauts, [])
  assert.deepEqual(fautives, [])
  assert.ok(marquees > 0, "aucune ligne de texte de l'assistant sur le disque : ce test ne juge rien")
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
