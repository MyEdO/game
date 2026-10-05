// La PROJECTION des registres (livres, DOMAINES) vers les `args` d'un workflow d'extraction Atlas.
// Les sigles et les clés de domaine des fixtures sont INVENTÉS : un banc qui en recopierait un réel
// réintroduirait la table qu'on vient de sortir du code (#1825). Le seul contact avec les registres
// RÉELS est une propriété de FORME, sans aucun nom de livre ni de domaine.
// Le dossier de chapitre (#2290) — projection des familles de `ficheDeDossier`, args de la table,
// écriture de la fiche rendue — se juge en fin de fichier, sur ses propres fixtures.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { REGISTRE_LIVRES } from './_lib.mjs'
import { argsDeDossierDeChapitre, argsDeTableSimulee, ecrireFiche, famillesDeLaFiche, lireRendu, perimetreDeCoeur, valeurDeDrapeau } from './workflow-args.mjs'
import { chargerDossiers } from './lib/dossiers.mjs'
import { FAMILLES_DE_DOSSIER, PREFIXES_D_ID, STATUTS_DE_BEAT, ficheDeDossier } from '../../src/data/source/dossier.ts'
import { coeursDeDomaines, coeursDuRegistre, domainesDe } from './_lib.mjs'

/** Domaines de fixture : deux cœurs, clés et titres inventés. */
const DOMAINES = {
  alpha: [
    { cle: 'domaine-un', titre: 'Premier Domaine de Fixture' },
    { cle: 'domaine-deux', titre: 'Second Domaine de Fixture' },
  ],
  beta: [{ cle: 'domaine-trois', titre: 'Troisieme Domaine de Fixture' }],
}
const LOT = ['domaine-un']
/** Les options communes : registres de fixture, choix déclarés. */
const opts = (extra) => ({ supplements: true, lot: LOT, registre: FIXTURE, registreDomaines: DOMAINES, ...extra })

const FIXTURE = [
  { id: 'base-alpha', abbr: 'BKA', dir: 'Source/Fixture - Base Alpha', language: 'Langue-A', coeur: 'alpha' },
  { id: 'base-beta', abbr: 'BKB', dir: 'Source/Fixture - Base Beta', language: 'Langue-B', coeur: 'beta' },
  { id: 'supplement-gamma', abbr: 'SPG', dir: 'Source/Fixture - Supplement Gamma', language: 'Langue-B' },
  { id: 'sans-extraction', abbr: 'SXX', language: 'Langue-A' },
]

test('coeursDuRegistre : les cœurs déclarés, dans l’ordre du fichier, sans doublon', () => {
  assert.deepEqual(coeursDuRegistre(FIXTURE), ['alpha', 'beta'])
})

test('perimetreDeCoeur : `supplements: true` ajoute les suppléments ; l’AUTRE cœur et les livres sans `dir` restent dehors', () => {
  assert.deepEqual(perimetreDeCoeur('alpha', opts()), {
    coeur: 'alpha',
    supplements: true,
    domaines: DOMAINES.alpha,
    lot: LOT,
    livres: [
      { ab: 'BKA', dir: 'Source/Fixture - Base Alpha', coeur: 'alpha', language: 'Langue-A' },
      { ab: 'SPG', dir: 'Source/Fixture - Supplement Gamma', coeur: null, language: 'Langue-B' },
    ],
  })
  assert.deepEqual(perimetreDeCoeur('beta', opts({ lot: ['domaine-trois'] })).livres.map((l) => l.ab), ['BKB', 'SPG'])
})

test('perimetreDeCoeur : la CARTE des domaines est celle du cœur demandé — jamais celle d’un autre', () => {
  assert.deepEqual(perimetreDeCoeur('beta', opts({ lot: ['domaine-trois'] })).domaines, DOMAINES.beta)
})

// Une aire CADRÉE SANS fiche (entrée à `ticket`) est le cas NOMINAL d'un run : c'est elle
// que le lot demande, et la carte doit les porter TOUTES — sinon le premier domaine d'un cœur neuf
// tournerait contre une carte à une entrée et sur-absorberait ses voisins.
test('perimetreDeCoeur : une aire à EXTRAIRE entre au lot, et la carte la porte — sans sa DETTE', () => {
  const cadrees = {
    alpha: [
      { cle: 'domaine-un', titre: 'Premier Domaine de Fixture', ticket: '#4242' },
      { cle: 'domaine-deux', titre: 'Second Domaine de Fixture', ticket: '#4242' },
    ],
  }
  const p = perimetreDeCoeur('alpha', opts({ registreDomaines: cadrees }))
  assert.deepEqual(p.lot, LOT)
  assert.deepEqual(p.domaines, [
    { cle: 'domaine-un', titre: 'Premier Domaine de Fixture' },
    { cle: 'domaine-deux', titre: 'Second Domaine de Fixture' },
  ])
})

test('perimetreDeCoeur : un `lot` NON DÉCLARÉ ou une clé INCONNUE LÈVE en nommant les domaines du cœur', () => {
  const sansLot = { ...opts() }
  delete sansLot.lot
  assert.throws(() => perimetreDeCoeur('alpha', sansLot), /`lot` de domaines non déclaré.*domaine-un, domaine-deux/s)
  assert.throws(() => perimetreDeCoeur('alpha', opts({ lot: [] })), /`lot` de domaines non déclaré/)
  assert.throws(
    () => perimetreDeCoeur('alpha', opts({ lot: ['domaine-un', 'domaine-jamais-declare'] })),
    /« domaine-jamais-declare » inconnu\(s\) du cœur « alpha ».*domaine-un, domaine-deux/s,
  )
  // La clé d'un AUTRE cœur n'est pas une clé de celui-ci : deux cœurs ne se joignent pas par `cle`.
  assert.throws(() => perimetreDeCoeur('alpha', opts({ lot: ['domaine-trois'] })), /« domaine-trois » inconnu\(s\)/)
})

test('perimetreDeCoeur : un cœur SANS domaine déclaré LÈVE — il ne rend pas un lot vide en silence', () => {
  assert.throws(
    () => perimetreDeCoeur('alpha', opts({ registreDomaines: { beta: DOMAINES.beta } })),
    /aucun domaine déclaré pour le cœur « alpha ».*domaines\.json.*beta/s,
  )
})

test('perimetreDeCoeur : `supplements: false` ne garde que les livres de CE cœur, et le résultat PORTE le choix', () => {
  const p = perimetreDeCoeur('alpha', opts({ supplements: false }))
  assert.deepEqual(p.livres.map((l) => l.ab), ['BKA'])
  assert.equal(p.supplements, false)
})

test('perimetreDeCoeur : `supplements` NON DÉCLARÉ LÈVE — la compatibilité supplement/cœur n’est pas au registre', () => {
  const sans = { ...opts() }
  delete sans.supplements
  assert.throws(() => perimetreDeCoeur('alpha', sans), /`supplements` non déclaré.*supplements: true.*supplements: false/s)
  assert.throws(() => perimetreDeCoeur('alpha', opts({ supplements: 'oui' })), /`supplements` non déclaré/)
})

test('perimetreDeCoeur : un cœur absent ou non textuel LÈVE en nommant les cœurs du registre', () => {
  assert.throws(() => perimetreDeCoeur('omega', opts()), /aucun livre de cœur « omega ».*alpha, beta/s)
  assert.throws(() => perimetreDeCoeur('', opts()), /absent ou non textuel.*alpha, beta/s)
  assert.throws(() => perimetreDeCoeur(undefined, opts()), /absent ou non textuel/)
})

// REPRISE : re-vérifier un rendu déjà produit. Le rendu entre par le même `args` ; ce qui se refuse
// ici se refuserait sinon APRÈS le lancement du run, agents partis.
test('lireRendu : un chemin absent, un JSON cassé, un rendu sans `domain` ou sans topic LÈVENT en nommant', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'reprise-'))
  try {
    assert.throws(() => lireRendu(join(dossier, 'jamais-ecrit.json')), /rendu de reprise illisible/)
    const chemin = join(dossier, 'rendu.json')
    writeFileSync(chemin, '{ pas du json')
    assert.throws(() => lireRendu(chemin), /non analysable/)
    writeFileSync(chemin, JSON.stringify({ topics: [{ topicId: 't' }] }))
    assert.throws(() => lireRendu(chemin), /sans `domain`/)
    writeFileSync(chemin, JSON.stringify({ domain: 'domaine-un', topics: [] }))
    assert.throws(() => lireRendu(chemin), /sans topic/)
    writeFileSync(chemin, JSON.stringify({ domain: 'domaine-un', topics: [{ topicId: 't', faithful: null }] }))
    assert.deepEqual(lireRendu(chemin).domain, 'domaine-un')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

// Ce qu'on a SOUS LA MAIN après un run : le rendu du lot, ou ce que le lanceur en a emballé. Exiger
// un domaine NU obligeait à découper le fichier à la main avant chaque reprise — un geste que rien
// ne vérifie et que personne ne fait juste.
test('lireRendu : les TROIS formes du rendu (run, lanceur, domaine nu), et le domaine NOMMÉ', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'reprise-formes-'))
  const unDomaine = (cle) => ({ domain: cle, title: 'Un Titre', topics: [{ topicId: 't', faithful: null, issues: [] }] })
  const duRun = { coeur: 'alpha', supplements: false, domains: [unDomaine('domaine-un'), unDomaine('domaine-deux')], sautes: [] }
  const ecrire = (nom, v) => {
    const c = join(dossier, nom)
    writeFileSync(c, JSON.stringify(v))
    return c
  }
  try {
    assert.equal(lireRendu(ecrire('run.json', duRun), 'domaine-deux').domain, 'domaine-deux')
    assert.equal(lireRendu(ecrire('lanceur.json', { result: duRun }), 'domaine-un').domain, 'domaine-un')
    assert.equal(lireRendu(ecrire('nu.json', unDomaine('domaine-un')), 'domaine-un').domain, 'domaine-un')
    // Sans nom, un rendu à UN seul domaine se prend sans ambiguïté ; à plusieurs, il REFUSE.
    assert.equal(lireRendu(ecrire('un-seul.json', { domains: [unDomaine('domaine-un')] })).domain, 'domaine-un')
    assert.throws(() => lireRendu(join(dossier, 'run.json')), /porte 2 domaines \(domaine-un, domaine-deux\)/)
    // Un domaine demandé que le rendu ne porte pas : le refus dit ce qu'il y A.
    assert.throws(
      () => lireRendu(join(dossier, 'run.json'), 'domaine-jamais-rendu'),
      /« domaine-jamais-rendu » n'est pas dans le rendu.*domaine-un, domaine-deux/s,
    )
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('perimetreDeCoeur : une REPRISE entre au résultat, et son domaine EST le lot — de CE cœur', () => {
  const rendu = { domain: 'domaine-un', topics: [{ topicId: 'topic-un', faithful: null }] }
  const p = perimetreDeCoeur('alpha', opts({ reprise: rendu }))
  assert.deepEqual(p.reprise, rendu)
  assert.deepEqual(p.lot, ['domaine-un'])
  // Sans reprise, la clé n'existe même pas : un `reprise: null` ferait croire à un mode déclaré.
  assert.equal(Object.hasOwn(perimetreDeCoeur('alpha', opts()), 'reprise'), false)
  // Le domaine du rendu appartient au cœur demandé, et il est le lot ENTIER.
  assert.throws(
    () => perimetreDeCoeur('alpha', opts({ reprise: { domain: 'domaine-trois', topics: [{}] } })),
    /domaine « domaine-trois », inconnu du cœur « alpha »/,
  )
  assert.throws(
    () => perimetreDeCoeur('alpha', opts({ reprise: rendu, lot: ['domaine-deux'] })),
    /une reprise ne joue que le domaine de son rendu.*domaine-deux/s,
  )
})

test('valeurDeDrapeau : les DEUX graphies d’un drapeau à argument, et `undefined` s’il est absent', () => {
  assert.equal(valeurDeDrapeau(['--reprise', 'rendu.json'], '--reprise'), 'rendu.json')
  assert.equal(valeurDeDrapeau(['--reprise=rendu.json'], '--reprise'), 'rendu.json')
  assert.equal(valeurDeDrapeau(['--coeur-seul'], '--reprise'), undefined)
})

test('perimetreDeCoeur : un livre du périmètre sans `language` LÈVE — la langue des citations ne se devine pas', () => {
  const muet = FIXTURE.map((b) => (b.abbr === 'SPG' ? { ...b, language: undefined } : b))
  assert.throws(() => perimetreDeCoeur('alpha', opts({ registre: muet })), /sans champ `language` \(SPG\)/)
})

test('registre RÉEL : chaque cœur déclaré projette, sous les DEUX choix, un périmètre non vide à langues complètes', () => {
  const coeurs = coeursDuRegistre(REGISTRE_LIVRES)
  assert.ok(coeurs.length >= 1, 'le registre ne déclare aucun cœur de règles')
  const cadres = coeursDeDomaines()
  for (const coeur of coeurs) {
    // Un cœur du registre SANS domaine au registre des domaines ne s'extrait pas : le dire ICI
    // au lieu de le sauter garde la boucle TOTALE sur les cœurs du registre.
    if (!cadres.includes(coeur)) {
      assert.throws(() => perimetreDeCoeur(coeur, { supplements: true, lot: ['peu-importe'] }), /aucun domaine déclaré/)
      continue
    }
    const lot = [domainesDe(coeur)[0].cle]
    for (const supplements of [true, false]) {
      const { livres, domaines } = perimetreDeCoeur(coeur, { supplements, lot })
      assert.deepEqual(
        domaines,
        domainesDe(coeur).map((d) => ({ cle: d.cle, titre: d.titre })),
        `carte des domaines infidèle au cœur ${coeur}`,
      )
      assert.ok(livres.length > 0, `périmètre vide pour le cœur ${coeur} (supplements=${supplements})`)
      assert.ok(livres.some((l) => l.coeur === coeur), `aucun livre de cœur dans le périmètre ${coeur}`)
      assert.deepEqual(livres.filter((l) => !l.language), [], `livres sans langue au périmètre ${coeur}`)
      if (!supplements) assert.deepEqual(livres.filter((l) => l.coeur !== coeur), [], 'un supplement a fui dans `--coeur-seul`')
    }
  }
})

// ── Dossier de chapitre (#2290) ─────────────────────────────────────────────────────────────────
// Le sigle des fixtures est RÉEL (`EDO`) : la fiche passe les gardes du chargeur (`chargerDossiers`),
// dont la graphie de réf (`refRe`) est celle du registre réel. Le `Source/` n'est jamais lu :
// `fichierDe` est injecté.

const COMMIT = 'f6e343dc8abf36a9d34cc3fd13de60af3d9ac894'
const fichierDe = (abbr, nn) => `Source/${abbr}-${nn}.md`
const OPTIONS_DOSSIER = { worktree: '/arbre-jete', date: '2026-10-05', commit: COMMIT, fichierDe }
const vides = Object.fromEntries(FAMILLES_DE_DOSSIER.map((f) => [f, []]))
/** Le rendu d'un run au verdict DOSSIER : la fiche, et ce qui juge le run. */
const RUN = {
  verdict: 'DOSSIER', livre: 'EDO', chapitre: '01',
  lecture: { date: '2026-10-05', commit: COMMIT },
  ...vides,
  beats: [{ id: 'b1', titre: 'La route', statut: 'obligatoire', preuveDuStatut: 'EDO 01 l.1 le dit', mediasCandidats: ['dialogue'], ref: ['EDO 01 l.1'] }],
  trous: { lentillesSansRendu: [], completudeSansRendu: [], anomaliesDeCorrection: [] },
  corrections: [], synthese_markdown: 's', agents: { lecture: 3, completude: 1, total: 4 },
}
/** `corps(dir)` dans un dossier jetable, supprimé ensuite. */
const dansUnJetable = (corps) => {
  const dir = mkdtempSync(join(tmpdir(), 'dossiers-')).replace(/\\/g, '/')
  try {
    return corps(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('famillesDeLaFiche : chaque famille de `ficheDeDossier`, dans son ordre, avec son préfixe, son minimum et la forme de ses attributs — sans `id`, que le script pose', () => {
  const familles = famillesDeLaFiche()
  assert.deepEqual(Object.keys(familles), FAMILLES_DE_DOSSIER)
  for (const famille of FAMILLES_DE_DOSSIER) {
    const { prefixe, minimum, entree } = familles[famille]
    const attributs = Object.keys(ficheDeDossier.shape[famille].element.shape).filter((a) => a !== 'id')
    assert.equal(prefixe, PREFIXES_D_ID[famille], famille)
    assert.equal(minimum === 0, ficheDeDossier.shape[famille].safeParse([]).success, famille)
    assert.deepEqual([Object.keys(entree.properties), entree.required, entree.additionalProperties], [attributs, attributs, false], famille)
  }
  assert.deepEqual(familles.beats.entree.properties.statut.enum, [...STATUTS_DE_BEAT], 'les enums viennent de la définition unique')
  assert.equal(familles.beats.minimum, 1)
  const medias = ficheDeDossier.shape.beats.element.shape.mediasCandidats
  assert.equal(familles.beats.entree.properties.mediasCandidats.uniqueItems, true, 'l’unicité des médias se projette')
  assert.equal(medias.safeParse(['dialogue', 'dialogue']).success, false, 'et zod refuse toujours le doublon')
})

test('argsDeDossierDeChapitre : les args du workflow — fichiers dérivés du chapitre, familles projetées ; toute entrée fautive LÈVE en se nommant', () => {
  assert.deepEqual(argsDeDossierDeChapitre('EDO', '01', { ...OPTIONS_DOSSIER, compagnons: ['EDOC-03'] }), {
    livre: 'EDO', chapitre: '01', fichiers: ['Source/EDO-01.md'], compagnons: ['Source/EDOC-03.md'],
    worktree: '/arbre-jete', date: '2026-10-05', commit: COMMIT, familles: famillesDeLaFiche(),
  })
  const cas = [
    [['XXX', '01', OPTIONS_DOSSIER], /« XXX » n'est le sigle d'aucun livre extrait/],
    [['EDO', '1a', OPTIONS_DOSSIER], /chapitre « 1a » — un numéro de chapitre/],
    [['EDO', '01', { ...OPTIONS_DOSSIER, worktree: 'arbre' }], /--worktree « arbre » — le chemin ABSOLU/],
    [['EDO', '01', { ...OPTIONS_DOSSIER, date: '5 octobre' }], /--date « 5 octobre » — AAAA-MM-JJ/],
    [['EDO', '01', { ...OPTIONS_DOSSIER, commit: 'abc' }], /commit « abc » — l'empreinte complète/],
    [['EDO', '01', { ...OPTIONS_DOSSIER, compagnons: ['EDOC03'] }], /compagnon « EDOC03 » — attendu <ABBR>-<NN>/],
    [['EDO', '01', { ...OPTIONS_DOSSIER, fichierDe: () => null }], /EDO 01 n'a aucun fichier chapitre \(chapterFile\)/],
  ]
  for (const [[livre, chapitre, options], attendu] of cas) assert.throws(() => argsDeDossierDeChapitre(livre, chapitre, options), attendu)
})

test('ecrireFiche : la fiche d’un run au verdict DOSSIER s’écrit à `<dir>/<livre>/<chapitre>.json`, sans rien de ce qui juge le run, et le chargeur la relit', () => {
  dansUnJetable((dir) => {
    assert.equal(ecrireFiche(RUN, { dir }), `${dir}/EDO/01.json`)
    const ecrit = readFileSync(`${dir}/EDO/01.json`, 'utf8')
    const fiche = Object.fromEntries(['lecture', ...FAMILLES_DE_DOSSIER].map((c) => [c, RUN[c]]))
    assert.equal(ecrit, `${JSON.stringify(fiche, null, 2)}\n`)
    assert.deepEqual(chargerDossiers(dir).map((d) => [d.chemin, d.ids]), [[`${dir}/EDO/01.json`, ['EDO-01#b1']]])
    assert.deepEqual(argsDeTableSimulee('EDO', '01', { worktree: '/arbre-jete', date: '2026-10-05', seed: 'graine', dir, fichierDe }), {
      livre: 'EDO', chapitre: '01', fichiers: ['Source/EDO-01.md'], dossier: fiche, seed: 'graine', worktree: '/arbre-jete', date: '2026-10-05',
    }, '`args.dossier` de la table = l’OBJET de la fiche chargée')
  })
})

test('ecrireFiche : un run hors verdict DOSSIER, une fiche hors schéma ou hors gardes du chargeur, un chapitre inconnu — REFUSÉS, rien n’est écrit', () => {
  const cas = [
    [{ ...RUN, verdict: 'LECTURE INCOMPLÈTE', trous: { ...RUN.trous, lentillesSansRendu: ['mecanique'] } }, /verdict « LECTURE INCOMPLÈTE » — seul un run au verdict DOSSIER porte une fiche ; trous : lentillesSansRendu \(mecanique\)/],
    [{ ...RUN, beats: [] }, /fiche hors schéma \(ficheDeDossier, src\/data\/source\/dossier\.ts\)\n {2}beats/],
    [{ ...RUN, lecture: undefined }, /fiche hors schéma[^\n]*\n {2}lecture/],
    [{ ...RUN, beats: [{ ...RUN.beats[0], ref: ['EDO 01 ligne 1'] }] }, /réf hors graphie/],
    [{ ...RUN, beats: [{ ...RUN.beats[0], preuveDuStatut: 'voir l.4' }] }, /ligne nue en prose/],
    [{ ...RUN, livre: 'XXX' }, /« XXX » n'est le sigle d'aucun livre extrait/],
  ]
  dansUnJetable((dir) => {
    for (const [rendu, attendu] of cas) {
      assert.throws(() => ecrireFiche(rendu, { dir }), attendu)
      assert.deepEqual(chargerDossiers(dir), [], `${attendu} : rien n'est écrit`)
    }
    assert.throws(() => argsDeTableSimulee('EDO', '01', { worktree: '/arbre-jete', date: '2026-10-05', seed: 'graine', dir, fichierDe }), /aucune fiche .*\/EDO\/01\.json — un dossier de chapitre se lit/)
  })
})
