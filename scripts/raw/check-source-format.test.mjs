// Test de la garde `check-source-format` (node --test, joué par `npm run test:raw`). Les
// familles MORDENT — d'abord sur des dossiers SYNTHÉTIQUES (le détecteur est PUR, un site par
// fichier fautif), puis sur de VRAIS dossiers fabriqués sous `os.tmpdir()` (le chemin disque : listing,
// lecture, chemin POSIX) —, la clé de site ne porte aucune position, et le stock COMMITTÉ est le
// point fixe de sa régénération (`texteRegenere`) sur les écarts mesurés sur l'arbre, dans les deux
// sens.
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  sitesDuDossier, scanDossier, scanAll, dossiersFR, formeDeLigne1, estNomDeSignet,
  comptesDeTables, balisesResiduelles, liensDIndex, regenerations,
  ecartsAuGrain, mobilierAll, rougesDuMobilier, titresSoudesAll, titresSoudesDuDossier,
  FAMILLES, STOCK_PATH, PREFIXES_FR,
} from './check-source-format.mjs'
import {
  comptesParFamille, ecartDeRegeneration, entreesRegenerees, lireEntreesDeSite, naissanceEnPlace, texteDeStock, texteEnPlace,
  texteRegenere,
} from '../guards/lib/stockDeSites.mjs'
import { BOOKS, decoupeDe, gabaritTitreDe, livreExtraitDe, livresATitres, livresDecoupes, nomsDeLaListe, ongletsDe, readText } from './_lib.mjs'
import { chiffresDes, fenetreDe, mobilierDuDossier } from './lib/mobilier.mjs'
import { EXEMPTIONS_MOBILIER } from '../guards/lib/mobilierExemptions.mjs'
import { cleDeSite, ecartDuVolet, naissanceDu, sitesEnEntrees } from '../guards/lib/stock.mjs'
import { estSeparateur, ligne1DePlage, titreDuFichier } from '../../src/data/source/decoupe.ts'

const DIR = 'Source/Livre'
const familles = (fichiers) => sitesDuDossier(DIR, fichiers).map((s) => s.famille).sort()

/** Un chapitre au format CANONIQUE : ligne 1 `*Pages PDF a-b*`, ancre INLINE, table séparée, et il
 *  OUVRE sur le titre que son NOM déclare (famille `ouverture`). */
const chapitreCanonique = (nom = '01 - Chapitre.md', folio = 3) => ({
  nom,
  texte: [
    ligne1DePlage(folio + 3, folio + 5),
    '',
    `<span id="page-${folio + 2}-0" data-folio="${folio}"></span># **${titreDuFichier(nom).toUpperCase()}**`,
    '',
    '| Lancer | Effet |',
    '| --- | --- |',
    '| 01-10 | Rien |',
    '',
  ].join('\n'),
})

const indexVivant = (cibles) => ({
  nom: '00 - Index.md',
  texte: ['# Index', '', ...cibles.map((c) => `- [x](<${c}>) — folio 3`)].join('\n'),
})

/** La liste de découpe d'un dossier de fixture : ce qui rend la famille `sans-decoupe` MUETTE — un
 *  livre dont le grain est DÉCLARÉ se juge par confrontation, jamais par stock. */
const listePour = (noms) => noms.map((n) => ({ titre: titreDuFichier(n), ouverture: titreDuFichier(n).toUpperCase(), page: 6, pageFin: 8 }))

test('un dossier au FORMAT canonique ne rend AUCUN écart', () => {
  const fichiers = [chapitreCanonique(), indexVivant(['01 - Chapitre.md'])]
  assert.deepEqual(sitesDuDossier(DIR, fichiers, listePour(['01 - Chapitre.md'])), [])
})

test('ligne1-hors-format : `*Folio N+*` et `# Titre` sont NOMMÉS, la tranche d’UNE page est canonique', () => {
  assert.equal(formeDeLigne1('*Pages PDF 10-23*'), null)
  // Un chapitre d'UNE page rend `*Pages PDF 48*` (LDB `06 - Classes.md` l.1) : canonique aussi.
  assert.equal(formeDeLigne1('*Pages PDF 48*'), null)
  assert.equal(ligne1DePlage(48, 48), '*Pages PDF 48*')
  assert.equal(formeDeLigne1('*Folio 3+*'), '*Folio N+*')
  assert.equal(formeDeLigne1('# CRÉDITS'), '# Titre')
  assert.equal(formeDeLigne1(''), '(ligne vide)')
  assert.equal(formeDeLigne1('Du texte nu'), 'autre')

  const scan = { nom: '01 - Credits.md', texte: '*Folio 3+*\n\n# CRÉDITS\n' }
  const sites = sitesDuDossier(DIR, [scan, { ...scan, nom: '02 - Suite.md' }])
  const l1 = sites.filter((s) => s.famille === 'ligne1-hors-format')
  assert.deepEqual(l1.map((s) => [s.file, s.ref]), [[`${DIR}/01 - Credits.md`, '*Folio N+*'], [`${DIR}/02 - Suite.md`, '*Folio N+*']], 'un site par FICHIER, sa forme')
})

test('sans-folio : un chapitre sans aucune ancre `data-folio` est compté ; l’index ne l’est jamais', () => {
  const sansAncre = { nom: '01 - X.md', texte: '*Pages PDF 6-8*\n\n# X\n' }
  const sites = sitesDuDossier(DIR, [sansAncre, indexVivant(['01 - X.md'])])
  assert.deepEqual(
    sites.filter((s) => s.famille === 'sans-folio').map((s) => s.ref),
    ['aucune ancre data-folio'],
  )
  // L'index lui-même n'a pas d'ancre et ne compte pas : sinon TOUT dossier serait hors format.
  assert.deepEqual(sitesDuDossier(DIR, [chapitreCanonique(), indexVivant([])])
    .filter((s) => s.famille === 'sans-folio'), [])
})

test('ancre-seule : une ancre SEULE sur sa ligne est un écart, la même INLINE ne l’est pas', () => {
  const seule = {
    nom: '01 - X.md',
    texte: '*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>\nDu texte.\n',
  }
  const sites = sitesDuDossier(DIR, [seule])
  assert.deepEqual(sites.filter((s) => s.famille === 'ancre-seule').map((s) => [s.ref, s.nombre]), [['ancre(s) seule(s)', 1]])
  // Forme canonique : l'ancre PRÉFIXE le paragraphe qu'elle ouvre.
  assert.deepEqual(
    sitesDuDossier(DIR, [{ ...seule, texte: seule.texte.replace('</span>\n', '</span>') }])
      .filter((s) => s.famille === 'ancre-seule'),
    [],
  )
})

test('nom-de-signet : un titre de fichier qui est un signet Word est NOMMÉ, fichier par fichier', () => {
  assert.ok(estNomDeSignet('_GoBack'))
  assert.ok(estNomDeSignet('_gjdgxs'))
  assert.ok(estNomDeSignet('Sans titre'))
  assert.ok(!estNomDeSignet('Combat'))

  const sites = sitesDuDossier(DIR, [
    { ...chapitreCanonique(), nom: '01 - _GoBack.md' },
    { ...chapitreCanonique(), nom: '02 - Combat.md' },
  ])
  assert.deepEqual(
    sites.filter((s) => s.famille === 'nom-de-signet').map((s) => s.ref),
    ['_GoBack'],
  )
})

test('html-residuel : `<sup>` est compté UNE fois par élément ; `<br>` et les ancres ne le sont pas', () => {
  assert.deepEqual([...balisesResiduelles('a<sup>1</sup> b<sup>2</sup>')], [['sup', 2]])
  assert.deepEqual([...balisesResiduelles('a<br>b<br/>c')], [])
  assert.deepEqual([...balisesResiduelles('<span id="page-5-0" data-folio="3"></span>texte')], [])
  // Une ancre SANS `data-folio` (le cas AU1) reste hors de cette famille : `sans-folio` la nomme.
  assert.deepEqual([...balisesResiduelles('<span id="page-5-0"></span>texte')], [])

  const sites = sitesDuDossier(DIR, [{ nom: '01 - X.md', texte: '*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>a<sup>1</sup>\n' }])
  assert.deepEqual(sites.filter((s) => s.famille === 'html-residuel').map((s) => [s.ref, s.nombre]), [['<sup>', 1]])
})

/* ─── GRAIN (#1739) : le dossier CONFRONTÉ à la liste de découpe du livre ─────────────────────
 * La liste est la DÉCLARATION, le dossier est le FAIT. Le prédicat d'ouverture vit au feuillet pur
 * `lib/titres.mjs` et sert AUSSI à la coupe : ce qui se juge ici, c'est la CONFRONTATION.
 * ───────────────────────────────────────────────────────────────────────────────────────────── */

const chapitreDe = (nom, titre) => ({ nom, texte: `*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>${titre}\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n` })
const indexDe = (noms) => ({ nom: '00 - Index.md', texte: `# Index\n\n${noms.map((n) => `- [x](<${n}>) — p.6-8`).join('\n')}\n` })
/** Les écarts au grain d'un dossier d'UN fichier, sa ligne 1 et son index au format attendu. */
const grain = (nom, titre, ouverture) =>
  ecartsAuGrain(DIR, [chapitreDe(nom, titre), indexDe([nom])],
    [{ titre: nom.replace(/^\d+ - |\.md$/g, ''), ouverture, page: 6, pageFin: 8 }]).map((s) => s.ref)

test('grain : les TROIS lectures d’une ligne de titre ouvrent — entière, gras, reste hors gras', () => {
  // Le cas CANONIQUE : le titre, en capitales, en gras.
  assert.deepEqual(grain('01 - Combat.md', '# **COMBAT**', 'COMBAT'), [])
  // Sans gras (planche en double page du CRB 5e, `# MAKING A TEST`) : la ligne ENTIÈRE.
  assert.deepEqual(grain('01 - Combat.md', '# Combat', 'COMBAT'), [])
  // Typographie et niveau de `#` : ni l'un ni l'autre ne décide.
  assert.deepEqual(grain("01 - Ungrakk's Brayherd.md", '##### **UNGRAKK’S  BRAYHERD**', "UNGRAKK'S BRAYHERD"), [])
  // MOBILIER de gouttière (onglet au chiffre romain du chapitre) : hors du GRAS.
  assert.deepEqual(grain('01 - Poisons.md', '# **POISONS** V', 'POISONS'), [])
  // Ornements de fer des deux côtés du gras (CRB 5e `# • **CONSUMER GUIDE** •`).
  assert.deepEqual(grain('01 - Consumer Guide.md', '# • **CONSUMER GUIDE** •', 'CONSUMER GUIDE'), [])
  // Le RESTE hors gras : le mobilier est en gras, le titre ne l'est pas.
  assert.deepEqual(grain('01 - Consumer Guide.md', '# **XI** CONSUMER GUIDE', 'CONSUMER GUIDE'), [])
  // `<sup>` déballé avant lecture (icône de rang en tête de titre).
  assert.deepEqual(grain('01 - Hante.md', '#### <sup>h</sup> **HANTE**', 'HANTE'), [])
})

test('grain : les MORSURES — un titre voisin n’ouvre rien, le mobilier ne se rogne pas', () => {
  // `APPENDIX III` n'ouvre pas `APPENDIX I` : c'est une SUITE de mots, jamais un préfixe.
  assert.deepEqual(grain('01 - Appendix I.md', '# **APPENDIX III** I', 'APPENDIX I'),
    ["n'ouvre pas sur « APPENDIX I » (l.1 de titre « # **APPENDIX III** I »)"])
  // `SKILLS AND TALENTS` n'ouvre pas `SKILLS`.
  assert.deepEqual(grain('01 - Skills.md', '# **SKILLS AND TALENTS**', 'SKILLS'),
    ["n'ouvre pas sur « SKILLS » (l.1 de titre « # **SKILLS AND TALENTS** »)"])
  // Un fichier sans AUCUNE ligne de titre, là où la liste en déclare une, est NOMMÉ.
  assert.deepEqual(
    ecartsAuGrain(DIR, [{ nom: '01 - Combat.md', texte: '*Pages PDF 6-8*\n\n**UNE ACCROCHE**\n' }, indexDe(['01 - Combat.md'])],
      [{ titre: 'Combat', ouverture: 'COMBAT', page: 6, pageFin: 8 }]).map((s) => s.ref),
    ["n'ouvre pas sur « COMBAT » (aucune ligne de titre)"],
  )
  // Une entrée SANS `ouverture` (couverture, planche) n'a rien à ouvrir.
  assert.deepEqual(
    ecartsAuGrain(DIR, [{ nom: '01 - Cover.md', texte: '*Pages PDF 6-8*\n\n**UNE ACCROCHE**\n' }, indexDe(['01 - Cover.md'])],
      [{ titre: 'Cover', page: 6, pageFin: 8 }]),
    [],
  )
})

test('grain : la LIGNE 1, les NOMS et l’INDEX se confrontent à la liste — rien ne se calcule', () => {
  // La plage est COPIÉE de la liste : une ligne 1 qui en diffère est NOMMÉE, avec l'attendu.
  assert.deepEqual(
    ecartsAuGrain(DIR, [chapitreDe('01 - Combat.md', '# **COMBAT**'), indexDe(['01 - Combat.md'])],
      [{ titre: 'Combat', ouverture: 'COMBAT', page: 6, pageFin: 9 }]).map((s) => s.ref),
    ['ligne 1 « *Pages PDF 6-8* » pour *Pages PDF 6-9*'],
  )
  // Un fichier DÉCLARÉ et absent, un fichier SERVI et non déclaré : les deux sens sont rouges.
  const deux = ecartsAuGrain(DIR, [chapitreDe('01 - Combat.md', '# **COMBAT**'), indexDe(['01 - Combat.md'])],
    [{ titre: 'Magie', ouverture: 'MAGIE', page: 6, pageFin: 8 }])
  assert.deepEqual(deux.map((s) => s.ref), [
    'déclaré par la liste de découpe, ABSENT du dossier',
    'servi, ABSENT de la liste de découpe',
    '1 lien(s) pour 1 fichier(s) déclaré(s), ou hors ordre',
  ])
  // L'index doit lister les fichiers DÉCLARÉS, dans l'ORDRE de la liste.
  assert.deepEqual(
    ecartsAuGrain(DIR, [chapitreDe('01 - Combat.md', '# **COMBAT**'), indexDe([])],
      [{ titre: 'Combat', ouverture: 'COMBAT', page: 6, pageFin: 8 }]).map((s) => s.ref),
    ['0 lien(s) pour 1 fichier(s) déclaré(s), ou hors ordre'],
  )
})

test('sans-decoupe : un livre SANS liste de découpe rend un site par chapitre', () => {
  const fichiers = [chapitreDe('01 - A.md', '# **A**'), chapitreDe('02 - B.md', '# **B**')]
  const sites = sitesDuDossier(DIR, fichiers).filter((s) => s.famille === 'sans-decoupe')
  assert.deepEqual(sites.map((s) => [s.file, s.ref]), [[`${DIR}/01 - A.md`, 'grain non déclaré'], [`${DIR}/02 - B.md`, 'grain non déclaré']])
  // Avec une liste, la famille se TAIT : le grain se juge par confrontation, pas par stock.
  const liste = [{ titre: 'A', ouverture: 'A', page: 6, pageFin: 8 }, { titre: 'B', ouverture: 'B', page: 6, pageFin: 8 }]
  assert.deepEqual(sitesDuDossier(DIR, fichiers, liste).filter((s) => s.famille === 'sans-decoupe'), [])
})

test('index-mort : un lien relatif vers un fichier ABSENT est un écart ; un lien externe ne l’est pas', () => {
  assert.deepEqual(liensDIndex('- [x](<01 - X.md>)\n- [y](02%20-%20Y.md)\n- [z](https://x)\n'), [
    '01 - X.md', '02 - Y.md',
  ])
  const chap = chapitreCanonique('01 - X.md')
  const sites = sitesDuDossier(DIR, [chap, indexVivant(['01 - X.md', '17 - _GoBack.md'])])
  assert.deepEqual(sites.filter((s) => s.famille === 'index-mort').map((s) => [s.ref, s.nombre]), [['lien(s) mort(s)', 1]])
})

test('table-sans-separateur : un bloc de table sans ligne `|---|` est compté, sur le total des tables', () => {
  assert.ok(estSeparateur('| --- | --- |'))
  assert.ok(estSeparateur('|--|--|--|'))
  assert.ok(!estSeparateur('| 01-10 | Rien |'))
  assert.deepEqual(comptesDeTables('| A | B |\n| --- | --- |\n| 1 | 2 |\n'), { total: 1, sansSeparateur: 0 })
  assert.deepEqual(comptesDeTables('| A | B |\n| 1 | 2 |\n'), { total: 1, sansSeparateur: 1 })
  // Une ancre qui OUVRE la ligne de table n'empêche pas de la voir (le cas `span-colle` de #1384).
  assert.deepEqual(
    comptesDeTables('<span id="page-5-0" data-folio="3"></span>| A | B |\n| --- | --- |\n'),
    { total: 1, sansSeparateur: 0 },
  )
  const sites = sitesDuDossier(DIR, [{ nom: '01 - X.md', texte: '*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>a\n\n| A | B |\n| 1 | 2 |\n' }])
  assert.deepEqual(sites.filter((s) => s.famille === 'table-sans-separateur').map((s) => [s.ref, s.nombre]), [['table(s) sans séparateur', 1]])
})

test('le NOMBRE d’occurrences d’un site est HORS CLÉ : une réparation partielle garde l’identité de l’entrée', () => {
  const texte = (n) => `*Pages PDF 6-8*\n\n<span id="page-5-0" data-folio="3"></span>a${'<sup>1</sup>'.repeat(n)}\n`
  const entree = (n) => sitesEnEntrees(sitesDuDossier(DIR, [{ nom: '01 - X.md', texte: texte(n) }]).filter((s) => s.famille === 'html-residuel'))[0]
  assert.deepEqual([entree(3).nombre, entree(2).nombre], [3, 2])
  assert.equal(cleDeSite(entree(3)), cleDeSite(entree(2)))
})

test('largeur-de-numero : une largeur PAR DOSSIER, celle du plus grand numéro', () => {
  const chap = (nom) => ({ ...chapitreCanonique(), nom })
  const largeurs = (noms) => sitesDuDossier(DIR, noms.map(chap)).filter((s) => s.famille === 'largeur-de-numero')
  // Deux chiffres tant que le livre tient sous 100 — aucun livre du corpus ne bouge.
  assert.deepEqual(largeurs(['07 - A.md', '21 - B.md']), [])
  // Passé la centaine, la largeur du dossier devient TROIS, pour tous ses fichiers.
  assert.deepEqual(largeurs(['099 - A.md', '100 - B.md']), [])
  assert.deepEqual(largeurs(['99 - A.md', '100 - B.md']).map((s) => s.ref), ['hors largeur 3'])
  assert.deepEqual(largeurs(['07 - A.md', '100 - B.md']).map((s) => s.ref), ['hors largeur 3'])
  // Un site par fichier hors largeur.
  assert.deepEqual(largeurs(['07 - A.md', '08 - B.md', '100 - C.md']).map((s) => s.file), ['Source/Livre/07 - A.md', 'Source/Livre/08 - B.md'])
  // `00 - Index.md` n'est pas un chapitre : il ne porte ni largeur ni écart.
  assert.deepEqual(largeurs(['07 - A.md', '21 - B.md']).concat(
    sitesDuDossier(DIR, [chap('07 - A.md'), indexVivant(['07 - A.md'])]).filter((s) => s.famille === 'largeur-de-numero'),
  ), [])
})

// --- Le chemin DISQUE, sur de VRAIS dossiers jetables (aucune écriture dans l'arbre) ---

/** Fabrique un dossier de livre sous `os.tmpdir()`. @returns {string} son chemin */
function dossierJetable(nom, fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'wfrp-format-'))
  const dir = join(racine, nom)
  mkdirSync(dir, { recursive: true })
  for (const { nom: f, texte } of fichiers) writeFileSync(join(dir, f), texte, 'utf8')
  return { racine, dir }
}

test('DISQUE : un dossier au format ne rend rien ; un dossier « scan/folio », un signet et un index mort mordent', () => {
  const conforme = dossierJetable('Warhammer v4 - Conforme', [
    chapitreCanonique('01 - Chapitre.md'),
    indexVivant(['01 - Chapitre.md']),
  ])
  try {
    // Un dossier au FORMAT, mais qu'aucune liste de découpe ne déclare : son GRAIN reste inconnu,
    // et c'est là le seul écart qu'il porte.
    assert.deepEqual(scanDossier(conforme.dir).map((s) => `${s.famille} ${s.ref}`), ['sans-decoupe grain non déclaré'])
  } finally { rmSync(conforme.racine, { recursive: true, force: true }) }

  const casse = dossierJetable('WH - V4 - Scan', [
    { nom: '01 - Credits.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>\nDu texte.\n' },
    { nom: '02 - _GoBack.md', texte: '*Folio 4+*\n\n<span id="page-6-0" data-folio="4"></span>\nAutre.\n' },
    indexVivant(['01 - Credits.md', '17 - _GoBack.md']),
  ])
  try {
    const sites = scanDossier(casse.dir)
    assert.deepEqual(sites.map((s) => s.famille), [
      'ligne1-hors-format', 'ligne1-hors-format', 'ancre-seule', 'ancre-seule', 'nom-de-signet', 'index-mort', 'sans-decoupe', 'sans-decoupe',
    ])
    assert.deepEqual(sites.map((s) => s.ref), [
      '*Folio N+*', '*Folio N+*', 'ancre(s) seule(s)', 'ancre(s) seule(s)', '_GoBack', 'lien(s) mort(s)', 'grain non déclaré', 'grain non déclaré',
    ])
    // Le `fichier` nomme le chapitre fautif lui-même (l'index pour `index-mort`) : sans `.md`,
    // l'entrée serait invisible aux portes de croissance (stocksNominatifs.mjs).
    assert.deepEqual(sites.map((s) => s.file.split('/').pop()), [
      '01 - Credits.md', '02 - _GoBack.md', '01 - Credits.md', '02 - _GoBack.md', '02 - _GoBack.md', '00 - Index.md', '01 - Credits.md', '02 - _GoBack.md',
    ])
    for (const s of sites) {
      assert.ok(!s.file.includes('\\'), `chemin POSIX attendu : ${s.file}`)
      assert.match(s.file, /\.md$/, `le stock doit nommer un fichier : ${s.file}`)
    }
  } finally { rmSync(casse.racine, { recursive: true, force: true }) }
})

test('DISQUE : le BALAYAGE voit les 16 livres à `dir` ET les dossiers FR hors registre', () => {
  const dossiers = dossiersFR()
  for (const [abbr, dir] of BOOKS) {
    assert.ok(dossiers.includes(dir.split('\\').join('/')), `livre ${abbr} absent du balayage`)
  }
  // Les quatre dossiers PRÉ-PIPELINE ne sont dans aucun `dir` de `books.json` : sans le balayage
  // par préfixe, ils échapperaient à toute garde (c'est le trou que cette garde ferme).
  const horsRegistre = dossiers.filter((d) => !BOOKS.some(([, dir]) => dir.split('\\').join('/') === d))
  assert.deepEqual(horsRegistre, [
    "Source/Boite d'Initiation WFRP 4e Edition VF",
    'Source/WH4_FR_BI_Livre_Aventure',
    'Source/WH4_FR_BI_Livre_Ubersreik',
    'Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF',
  ])
  for (const p of PREFIXES_FR) assert.ok(dossiers.some((d) => d.startsWith(`Source/${p}`)), `préfixe muet : ${p}`)
})

test('un livre de `books.json` dont le dossier MANQUE lève — un corpus amputé rendrait un vert muet', () => {
  assert.throws(
    () => dossiersFR('Source', [['FANTOME', 'Source/Ce dossier n existe pas']]),
    /FANTOME/,
  )
})

// --- Le STOCK committé ---

test('stock COMMITTÉ : chaque écart mesuré y a son entrée, et aucune entrée n’est soldée', () => {
  const { neuves, perimees } = ecartDuVolet({ sites: scanAll(), stock: lireEntreesDeSite(STOCK_PATH), ou: 'source-format-stock.json' })
  assert.deepEqual(neuves, [], `écart(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

// AUCUN GÉNÉRATEUR SÉPARÉ : le fichier de stock EST le texte de sa régénération (`texteRegenere`),
// écrit par `npx tsx scripts/guards/lib/regenStock.mts scripts/raw/check-source-format.mjs`. Ce test le
// vérifie à l'octet, ORDRE compris, là où l'écart ci-dessus ne juge que les ensembles.
test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des écarts mesurés sur l’arbre', () => {
  for (const r of regenerations(scanAll())) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
})

// Le `quoi` ne dépend jamais de la mesure du run : deux soldes disjoints d'un même stock le laissent
// identique, et le pilote de fusion les fusionne sans conflit.
test('un solde laisse le quoi à l’octet', () => {
  const sites = scanAll()
  const [s0] = sites
  const reste = sites.filter((s) => s.famille !== s0.famille || s.file !== s0.file || s.ref !== s0.ref)
  assert.ok(reste.length < sites.length)
  const enPlace = texteEnPlace(STOCK_PATH)
  const [r] = regenerations(reste)
  assert.equal(JSON.parse(texteRegenere(r, { enPlace, lot: null, date: null }).texte).quoi, JSON.parse(enPlace).quoi)
})

test('stock COMMITTÉ : chaque entrée nomme sa famille, son chapitre et sa référence', () => {
  const entrees = lireEntreesDeSite(STOCK_PATH)
  for (const e of entrees) {
    assert.ok(FAMILLES.includes(e.famille), `famille inconnue : ${JSON.stringify(e)}`)
    assert.match(e.fichier, /^Source\/[^\\]+\/[^\\]+\.md$/, `entrée sans chapitre nommé : ${JSON.stringify(e)}`)
    assert.ok(e.ref && e.occurrence >= 1, `entrée sans réf ni occurrence : ${JSON.stringify(e)}`)
  }
})

test('stock TRUQUÉ : une entrée retirée rend son site NEUF, une entrée sans écart est SOLDÉE', () => {
  const sites = scanAll()
  const stock = lireEntreesDeSite(STOCK_PATH)
  const ecart = (s) => ecartDuVolet({ sites, stock: s, ou: 'source-format-stock.json' })
  const ampute = ecart(stock.slice(1))
  assert.equal(ampute.neuves.length, 1)
  assert.match(ampute.neuves[0], /site NEUF/)
  assert.ok(ampute.neuves[0].includes(stock[0].fichier), `le rouge NOMME le chapitre : ${ampute.neuves[0]}`)
  assert.deepEqual(ampute.perimees, [])

  // Un livre RÉ-EXTRAIT : son écart disparaît, son entrée devient soldée et doit se retirer.
  const fantome = { ...stock[0], fichier: `${stock[0].fichier} (ré-extrait)` }
  const gonfle = ecart([...stock, fantome])
  assert.deepEqual(gonfle.neuves, [])
  assert.equal(gonfle.perimees.length, 1)
  assert.match(gonfle.perimees[0], /entrée SOLDÉE/)
})

test('l’écart est jugé FAMILLE PAR FAMILLE : le stock d’une famille ne solde pas les écarts d’une autre', () => {
  const sites = sitesDuDossier(DIR, [{ nom: '01 - _GoBack.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>x\n' }], listePour(['01 - _GoBack.md']))
  assert.equal(comptesParFamille(sites, FAMILLES)['ligne1-hors-format'], 1)
  assert.equal(comptesParFamille(sites, FAMILLES)['nom-de-signet'], 1)
  const partiel = entreesRegenerees(sites, { lot: 'x', date: 'y' }).filter((e) => e.famille === 'ligne1-hors-format')
  const { neuves, perimees } = ecartDuVolet({ sites, stock: partiel, ou: 'source-format-stock.json' })
  assert.equal(neuves.length, 1, 'la famille NON couverte reste neuve')
  assert.match(neuves[0], /^nom-de-signet ::/)
  assert.deepEqual(perimees, [], 'la famille couverte n’est pas déclarée soldée pour autant')
})

test('comptesParFamille nomme TOUTES les familles, même à zéro (une famille muette resterait invisible)', () => {
  assert.deepEqual(Object.keys(comptesParFamille([], FAMILLES)), FAMILLES)
  assert.deepEqual(Object.values(comptesParFamille([], FAMILLES)), FAMILLES.map(() => 0))
})

test('familles() n’est pas AVEUGLE : un dossier tout-défaut les rend TOUTES', () => {
  const fichiers = [
    { nom: '01 - _GoBack.md', texte: '# Titre\n\n| A | B |\n| 1 | 2 |\n\nx<sup>1</sup>\n' },
    { nom: '02 - X.md', texte: '*Folio 4+*\n\n<span id="page-6-0" data-folio="4"></span>\ny\n' },
    // Le chapitre 100 porte la largeur du dossier à TROIS : les deux autres sont alors hors largeur.
    { nom: '100 - Y.md', texte: '*Folio 5+*\n\n<span id="page-7-0" data-folio="5"></span>\nz\n' },
    indexVivant(['99 - Absent.md']),
  ]
  assert.deepEqual([...new Set(familles(fichiers))].sort(), [...FAMILLES].sort())
})

// SURVIE de l'échéance (#1820) : régénérer pour ajouter UNE entrée ne redate pas les autres. La
// règle est `survieDeLecheance` (`scripts/guards/lib/stock.mjs`) ; ce test-ci tient son CÂBLAGE —
// `entreesRegenerees`, puis `texteRegenere`, qui est ce que la commande de régénération écrit.
test('`regenerations` CONSERVE les comptes « à la naissance » du stock en place (#1739)', () => {
  const sites = sitesDuDossier(DIR, [{ nom: '01 - _GoBack.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>x\n' }], listePour(['01 - _GoBack.md']))
  const naissance = tableTotale(FAMILLES, (_f, indice) => 100 + indice)
  const quoiDe = (n) => regenerations(sites, n)[0].horsCollections
  assert.deepEqual(naissanceDu(quoiDe(naissance), FAMILLES), naissance)
  assert.notDeepEqual(naissanceDu(quoiDe(null), FAMILLES), naissance)
  assert.ok(naissanceEnPlace(STOCK_PATH, FAMILLES), 'le stock en place porte ses comptes à la naissance')
})

test('`texteRegenere` CONSERVE l’échéance d’une entrée existante, à clé identique', () => {
  const sites = sitesDuDossier(DIR, [{ nom: '01 - _GoBack.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>x\n' }], listePour(['01 - _GoBack.md']))
  const ancien = entreesRegenerees(sites, { lot: '#1739 H-0', date: '2026-09-14' })
  const rendu = entreesRegenerees(sites, { lot: '#9999 Z', date: '2030-01-01', ancien })
  assert.deepEqual(rendu, ancien, 'une régénération ne rajeunit pas une entrée inchangée')
  const [r] = regenerations(sites, null)
  assert.ok(
    texteRegenere(r, { enPlace: texteDeStock('q', ancien), lot: '#9999 Z', date: '2030-01-01' }).texte.includes('"date": "2026-09-14"'),
    'le FICHIER écrit porte la date d’origine, pas celle du run',
  )

  // Une entrée NEUVE (aucune ancienne à sa clé) prend le lot et la date du run, l'autre garde les siens.
  const neuve = entreesRegenerees(sites, { lot: '#9999 Z', date: '2030-01-01', ancien: ancien.slice(0, 1) })
  assert.deepEqual(neuve.map((e) => [e.famille, e.lot, e.date]), [
    [ancien[0].famille, '#1739 H-0', '2026-09-14'],
    ['nom-de-signet', '#9999 Z', '2030-01-01'],
  ])
})

// La `preuve` est un champ HUMAIN : la survie la porte partout où elle existe, y compris sur ce
// stock-ci, dont aucune entrée n'en porte aujourd'hui.
test('survie : une `preuve` posée à la main sur une entrée de format lui survit', () => {
  const sites = sitesDuDossier(DIR, [{ nom: '01 - X.md', texte: '*Folio 3+*\n\n<span id="page-5-0" data-folio="3"></span>x\n' }])
  const ancien = entreesRegenerees(sites, { lot: '#1739 H-0', date: '2026-09-14' }).map((e) => ({ ...e, preuve: 'PDF p.9 : lu.' }))
  assert.deepEqual(entreesRegenerees(sites, { lot: '#9999 Z', date: '2030-01-01', ancien }), ancien)
})

// --- MOBILIER DE PAGE (#1739) : la famille `mobilier`, rouge nommé sans stock ---

/** Les sites de mobilier d'un livre à onglets, chaque texte passé par `retouche(nom, texte)`. */
const mobilierAvec = (id, retouche = (_, t) => t, exemptions = EXEMPTIONS_MOBILIER) => {
  const dir = livreExtraitDe(id).dir.split('\\').join('/')
  return mobilierDuDossier(dir, (nom) => retouche(nom, readText(`${dir}/${nom}`)), decoupeDe(id), ongletsDe(id), { exemptions })
}
const LIVRES_A_ONGLETS = livresDecoupes().filter((id) => ongletsDe(id) != null)

test('mobilier : l’arbre est VERT — aucun site hors exemption, toute exemption couvre ses `jetons` sites', () => {
  assert.ok(LIVRES_A_ONGLETS.length, 'aucun livre à onglets : la famille serait muette')
  assert.deepEqual(mobilierAll(), [])
})

test('mobilier : un chiffre d’onglet RÉINJECTÉ en ligne seule ou dans une ligne ROUGIT, nommé à sa ligne', () => {
  for (const id of LIVRES_A_ONGLETS) {
    const liste = decoupeDe(id)
    const i = liste.findIndex((e) => chiffresDes(ongletsDe(id), fenetreDe(e)).size)
    const x = [...chiffresDes(ongletsDe(id), fenetreDe(liste[i]))][0]
    const cible = nomsDeLaListe(liste)[i]
    const sites = mobilierAvec(id, (nom, t) => (nom === cible ? [t, '', x, '', `fin de paragraphe ${x}`].join('\n') : t))
    const rouges = rougesDuMobilier(sites)
    assert.equal(rouges.length, 2, `${id} : ${JSON.stringify(rouges)}`)
    assert.ok(rouges.every((r) => r.file.endsWith(`/${cible}`) && r.ref.includes(`« ${x} »`)))
    assert.deepEqual(rouges.map((r) => r.ref.split(' ')[1]), ['romain-seul', 'mot'])
  }
})

test('mobilier : le pronom « I » EXEMPTÉ ne rougit pas ; sans son exemption il rougirait, et une exemption qui ne couvre rien rougit', () => {
  for (const id of LIVRES_A_ONGLETS) {
    const exemptes = mobilierAvec(id).filter((s) => s.exemption)
    assert.ok(exemptes.length, `${id} : aucun site exempté mesuré`)
    assert.deepEqual(rougesDuMobilier(mobilierAvec(id)), [])
    const sans = mobilierAvec(id, undefined, [])
    assert.equal(rougesDuMobilier(sans, []).length, exemptes.length)
    const morte = { fichier: exemptes[0].fichier, motif: /^aucune ligne ne porte ce texte$/, jetons: 1, raison: 'banc' }
    const avecMorte = [...EXEMPTIONS_MOBILIER, morte]
    assert.deepEqual(rougesDuMobilier(mobilierAvec(id, undefined, avecMorte), avecMorte).map((r) => r.ref), [`exemption qui couvre 0 site(s) pour 1 déclaré(s) : ${morte.motif}`])
  }
})

test('mobilier : un chiffre d’onglet AJOUTÉ à une ligne EXEMPTÉE rougit — l’exemption couvre ses `jetons`, pas la ligne', () => {
  for (const id of LIVRES_A_ONGLETS) {
    const [cible] = mobilierAvec(id).filter((s) => s.exemption)
    const nom = cible.fichier.slice(cible.fichier.lastIndexOf('/') + 1)
    const retouche = (n, t) => (n !== nom ? t : t.split('\n').map((l, j) => (j === cible.ligne - 1 ? `${l} ${cible.jeton}` : l)).join('\n'))
    const rouges = rougesDuMobilier(mobilierAvec(id, retouche))
    assert.equal(rouges.length, 1, `${id} : ${JSON.stringify(rouges)}`)
    assert.ok(rouges[0].file === cible.fichier && rouges[0].ref.startsWith(`l.${cible.ligne} mot « ${cible.jeton} »`))
  }
})

// --- TITRES SOUDÉS (#1739) : la famille `titre-soude`, rouge nommé sans stock ---

test('livresATitres : la seule liste des livres à gabarit de titre, chacun avec son gabarit', () => {
  const ids = livresATitres()
  assert.ok(ids.includes('core-rulebook-5e'), ids.join(', '))
  for (const id of ids) assert.ok(gabaritTitreDe(id), id)
})

test('titre-soude : l’arbre est VERT — aucun titre soudé ni titre à deux gras dans un livre à gabarit', () => {
  assert.ok(livresATitres().length, 'aucun livre à gabarit de titre : la famille serait muette')
  assert.deepEqual(titresSoudesAll(), [])
})

test('titre-soude : un titre RE-SOUDÉ à son corps ROUGIT, nommé à sa ligne', () => {
  for (const id of livresATitres()) {
    const dir = livreExtraitDe(id).dir.split('\\').join('/')
    const liste = decoupeDe(id)
    const nom = nomsDeLaListe(liste).find((n) => /^# \*\*[^*]+\*\*\n\n[A-Z]/m.test(readText(`${dir}/${n}`)))
    const resoude = (n, t) => (n === nom ? t.replace(/^# (\*\*[^*]+\*\*)\n\n(?=[A-Z])/m, '$1 ') : t)
    const rouges = titresSoudesDuDossier(dir, (n) => resoude(n, readText(`${dir}/${n}`)), liste)
    assert.equal(rouges.length, 1, id)
    assert.match(rouges[0].ref, /^l\.\d+ p5 : \*\*/)
    assert.equal(rouges[0].file, `${dir}/${nom}`)
  }
})
