// Banc de `nomAscii` (#1699) — la table est FERMÉE : chaque ligne y a son cas, et un caractère
// hors table LÈVE. Joué par `npm run test:raw` (`node --test`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { nomAscii } from './nom-ascii.mjs'
import { estNomDExtraction, graphieDeChapitre, largeurDeChapitre } from '../../src/data/source/decoupe.ts'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const estAscii = (s) => [...s].every((c) => c.codePointAt(0) >= 0x20 && c.codePointAt(0) <= 0x7e)

test('table fermée — une ligne, un cas', () => {
  assert.equal(nomAscii('06 - La province d’Ubersreik.md'), "06 - La province d'Ubersreik.md")
  assert.equal(nomAscii('11 - Hire ‘em and Fire ‘Em.md'), "11 - Hire 'em and Fire 'Em.md")
  assert.equal(nomAscii('“Cite”.md'), '"Cite".md')
  // « » : supprimés AVEC l'espace intérieur, l'espace extérieur reste (il sépare deux mots)
  assert.equal(nomAscii("04 - « L'abominable » Halagrundsor.md"), "04 - L'abominable Halagrundsor.md")
  assert.equal(nomAscii('03 - CHAPITRE 1 - « Easter eggs ».md'), '03 - CHAPITRE 1 - Easter eggs.md')
  assert.equal(nomAscii('04 - Hysh — Domaine de la Lumiere.md'), '04 - Hysh - Domaine de la Lumiere.md')
  assert.equal(nomAscii('A – B'), 'A - B')
  assert.equal(nomAscii('04 - Sur la route de Bogenhafen….md'), '04 - Sur la route de Bogenhafen....md')
  assert.equal(nomAscii("14 - Les Vents a lœuvre.md"), '14 - Les Vents a loeuvre.md')
  assert.equal(nomAscii('Œuvre'), 'OEuvre')
  assert.equal(nomAscii('ægis / Ægis'), 'aegis / AEgis')
  assert.equal(nomAscii('15 - Part Two- Howl if You Need Me￼.md'), '15 - Part Two- Howl if You Need Me.md')
  // combinants : é À Ö ç î ô ä è ê â
  assert.equal(nomAscii('07 - Carrières.md'), '07 - Carrieres.md')
  assert.equal(
    nomAscii("01 - CRÉDITS À Â Ç Î Ö â ä é ê î ô ö.md"),
    '01 - CREDITS A A C I O a a e e i o o.md',
  )
})

test('ce n’est PAS un slug : casse, espaces (double compris), points, parenthèses, & conservés', () => {
  assert.equal(
    nomAscii('Warhammer - Hommes & Bêtes  du Vieux-Monde (Édition) PDF'),
    'Warhammer - Hommes & Betes  du Vieux-Monde (Edition) PDF',
  )
})

test('les 3 cas NFD réels du disque (« Boîte », i + U+0302)', () => {
  const nfd = "Boîte d'Initiation WFRP 4e Edition VF"
  assert.equal(nfd.normalize('NFC'), "Boîte d'Initiation WFRP 4e Edition VF")
  assert.equal(nomAscii(nfd), "Boite d'Initiation WFRP 4e Edition VF")
  assert.equal(nomAscii('01 - Coffre de Démarrage WFRP 4e Edition VF.md'), '01 - Coffre de Demarrage WFRP 4e Edition VF.md')
  assert.equal(nomAscii('02 - Contenue Du Coffe de Démarrage.md'), '02 - Contenue Du Coffe de Demarrage.md')
})

test('un titre qui se VIDE reste dans la forme canonique `NN - <titre>.md`', () => {
  // `12.md` sortirait du motif d'extraction (`estNomDExtraction`, la forme UNE que tous les
  // scanners lisent), et que `buildFolioToc` exige pour porter le chapitre à l'index.
  assert.equal(nomAscii('12 - ￼.md'), '12 - Sans titre.md')
  assert.equal(nomAscii('12 - .md'), '12 - Sans titre.md')
  assert.ok(estNomDExtraction(nomAscii('12 - ￼.md')))
  assert.ok(!estNomDExtraction('12.md'))
})

test('un nom qui se réduit au VIDE LÈVE (un fichier a un nom)', () => {
  assert.throws(() => nomAscii('  '), /nom VIDE/)
  assert.throws(() => nomAscii('￼'), /nom VIDE/)
})

test('espaces de fin retirés, avant l’extension comme en fin de nom', () => {
  assert.equal(nomAscii('07 - Chimère .md'), '07 - Chimere.md')
  assert.equal(nomAscii('Un dossier '), 'Un dossier')
})

test('idempotence', () => {
  for (const n of [
    "04 - « L'abominable » Halagrundsor.md",
    '04 - Hysh — Domaine de la Lumière.md',
    '12 - ￼.md',
    '12 - Sans titre.md',
    "Boîte d'Initiation WFRP 4e Edition VF",
    'Warhammer - Hommes & Bêtes  du Vieux-Monde (Édition) PDF',
  ]) {
    assert.equal(nomAscii(nomAscii(n)), nomAscii(n))
    assert.ok(estAscii(nomAscii(n)))
  }
})

test('un caractère HORS table LÈVE, nominativement (la table se déclare, elle n’absorbe pas)', () => {
  assert.throws(() => nomAscii('09 - Ω mega.md'), (e) => /U\+03A9/.test(e.message) && /hors table/.test(e.message))
  assert.throws(() => nomAscii('09 - 中.md'), /U\+4E2D/)
})

// CÂBLAGE des scripts de découpe : les tables de titres ne sont pas exportées (ces scripts LISENT
// leur source au chargement), le banc les mesure donc dans leur TEXTE — les titres qu'ils écrivent
// passent la table, et l'appel à `nomAscii` est présent à chaque site d'écriture de nom.
const lire = (rel) => readFileSync(new URL(rel, new URL('file:///' + RACINE.replace(/\\/g, '/'))), 'utf8')

test('les titres de `split-vdm.mjs` (— et œ) rendent des noms ASCII', () => {
  const texte = lire('scripts/raw/split-vdm.mjs')
  const debut = texte.indexOf('const CHAPTERS')
  const bloc = texte.slice(debut, texte.indexOf('\n]', debut))
  const titres = [...bloc.matchAll(/^\s*\[(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/gm)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"))
  assert.equal(titres.length, 15)
  assert.ok(titres.some((t) => /[^\x20-\x7e]/.test(t)), 'le banc mesurerait un corpus déjà ASCII')
  for (const [i, t] of titres.entries()) {
    assert.ok(estAscii(nomAscii(`${graphieDeChapitre(i + 1, largeurDeChapitre(titres.length))} - ${t}.md`)), t)
  }
})

test('les trois scripts de découpe ÉCRIVENT par `nomAscii` (dossier de sortie ET nom de chapitre)', () => {
  // Le dossier de sortie : la valeur même passe par la fonction.
  assert.match(lire('scripts/raw/split-vdm.mjs'), /const OUT = nomAscii\(/)
  assert.match(lire('scripts/raw/split-mdg.mjs'), /const OUT = nomAscii\(/)
  assert.match(lire('scripts/raw/marker-split.mjs'), /const outDir = nomAscii\(/)
  for (const rel of ['scripts/raw/split-vdm.mjs', 'scripts/raw/split-mdg.mjs', 'scripts/raw/marker-split.mjs']) {
    const texte = lire(rel)
    assert.match(texte, /from '\.\.\/source\/nom-ascii\.mjs'/, rel)
    // Chaque nom écrit sous le dossier de sortie est soit une constante ASCII littérale, soit un
    // `nomAscii(…)`, soit une variable ASSIGNÉE depuis `nomAscii(…)`.
    for (const m of texte.matchAll(/join\((?:OUT|outDir), *([^,)]+)/g)) {
      const argument = m[1].trim()
      const litteralAscii = /^'[\x20-\x7e]*'$/.test(argument)
      const varDeNomAscii = /^[A-Za-z_$][\w$]*$/.test(argument) && texte.includes(`const ${argument} = nomAscii(`)
      assert.ok(
        /nomAscii\(/.test(argument) || litteralAscii || varDeNomAscii,
        `${rel} : le nom écrit \`${argument}\` ne passe pas par nomAscii`,
      )
    }
  }
})
