// Banc du RE-COUPEUR de `Source/` (`scripts/raw/recouper-source.mjs`, #1739), sur un livre FORGÉ —
// aucun livre du dépôt n'est lu ici : le geste est PUR (`recouper`), sa coquille d'entrée/sortie
// n'ajoute que le disque. Le livre forgé porte les pièges mesurés sur un vrai livre : deux sections
// sur une MÊME page, un titre à MOBILIER de gouttière hors du gras, un titre SANS gras, un homonyme
// du gabarit de profil APRÈS sa section, et un fichier SANS titre imprimé.
// Ce que le banc EXIGE : la coupe, l'en-tête de pages partagées, l'identité À L'OCTET du flux, le
// REFUS quand elle est rompue, l'IDEMPOTENCE, et le recalage d'une entrée de stock AVEC sa `preuve`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aUneCleDeSection, carteDesSlugs, entreesScindees, rapporteeEnLigne, suiviBloque, contenuDe, fluxDe, indexDe, planDe, recalerStock, recouper } from './recouper-source.mjs'
import { carteDeLignes } from './lib/carte-lignes.mjs'
import { hunksDe } from '../guards/lib/hunks.mjs'

const CH1 = [
  '*Pages PDF 1-2*',
  '',
  '# **ALPHA**',
  'la prose d’alpha',
  '',
  '# **BETA** V',
  'la prose de beta',
  '',
  '# GAMMA',
  '| clé | valeur |',
  '| --- | --- |',
  '| a | 1 |',
  '',
].join('\n')
const CH2 = [
  '*Pages PDF 3-4*',
  '',
  '# **DELTA**',
  'la prose de delta',
  '',
  '### **ALPHA**',
  'étiquette du gabarit de profil, homonyme d’ALPHA',
  '',
].join('\n')
// Aucun titre imprimé : la planche de fin. Sa coupe vient de l'ancre de page de son chapitre.
const CH3 = ['*Pages PDF 5*', '', 'une planche muette', ''].join('\n')

const ANCIENS = [{ nom: '1 - Alpha.md', texte: CH1 }, { nom: '2 - Delta.md', texte: CH2 }, { nom: '3 - Planche.md', texte: CH3 }]
// La PLAGE est de la DONNÉE, lue au livre : `page` ET `pageFin` à chaque entrée, les voisins
// PARTAGEANT au plus une page. Les deux outils la COPIENT — aucun ne la calcule.
const LISTE = [
  { titre: 'Alpha', ouverture: 'ALPHA', page: 1, pageFin: 2 },
  { titre: 'Beta', ouverture: 'BETA', page: 2, pageFin: 2 },
  { titre: 'Gamma', ouverture: 'GAMMA', page: 2, pageFin: 3 },
  { titre: 'Delta', ouverture: 'DELTA', page: 3, pageFin: 4 },
  { titre: 'Planche', page: 5, pageFin: 5 },
]

test('#1739 : le flux est le corps des chapitres en service, en-têtes retirés, joints par une ligne vide', () => {
  const { flux, debuts } = fluxDe(ANCIENS)
  assert.equal(flux.split('\n')[0], '# **ALPHA**')
  assert.deepEqual(debuts, [0, 11, 17])
})

test('#1739 : un fichier par entrée, la page PARTAGÉE réclamée par les deux voisins', () => {
  const { plan, introuvables, ecart } = recouper(ANCIENS, LISTE)
  assert.deepEqual(introuvables, [])
  assert.equal(ecart, null)
  assert.deepEqual(plan.map((e) => `${e.nom} ${e.span}`), [
    '01 - Alpha.md 1-2', '02 - Beta.md 2', '03 - Gamma.md 2-3', '04 - Delta.md 3-4', '05 - Planche.md 5',
  ])
})

test('#1739 : l’homonyme du gabarit de profil n’ouvre aucun fichier — la coupe reste séquentielle', () => {
  const { contenus } = recouper(ANCIENS, LISTE)
  assert.ok(contenus.get('04 - Delta.md').includes('### **ALPHA**'), 'l’homonyme reste dans la section qui le porte')
  assert.equal(contenus.get('01 - Alpha.md'), '*Pages PDF 1-2*\n\n# **ALPHA**\nla prose d’alpha\n')
})

test('#1739 : un fichier SANS titre imprimé coupe à l’ancre de page de son chapitre', () => {
  const { contenus } = recouper(ANCIENS, LISTE)
  assert.equal(contenus.get('05 - Planche.md'), '*Pages PDF 5*\n\nune planche muette\n')
})

test('#1739 : sans ancre pour sa page, un fichier sans titre est NOMMÉ introuvable — aucune devinette', () => {
  const liste = LISTE.map((e) => (e.titre === 'Planche' ? { ...e, page: 9 } : e))
  const { plan, introuvables } = recouper(ANCIENS, liste)
  assert.deepEqual(plan, [])
  assert.deepEqual(introuvables.map((i) => i.cle), ['Planche'])
})

test('#1739 : un titre d’ouverture absent du flux est NOMMÉ, et rien n’est produit', () => {
  const { plan, introuvables } = recouper(ANCIENS, [...LISTE, { titre: 'Omega', ouverture: 'OMEGA', page: 5, pageFin: 5 }])
  assert.deepEqual(plan, [])
  assert.deepEqual(introuvables.map((i) => i.cle), ['Omega'])
})

test('#1739 : le flux reconstruit est identique À L’OCTET au flux lu', () => {
  const r = recouper(ANCIENS, LISTE)
  const refait = fluxDe(r.plan.map((e) => ({ nom: e.nom, texte: r.contenus.get(e.nom) })))
  assert.equal(refait.flux, r.flux)
  assert.equal(Buffer.byteLength(refait.flux), Buffer.byteLength(r.flux))
})

// MORSURE du contrôle à l'octet : un corps auquel il manque son saut de ligne final en reçoit un,
// et le flux reconstruit porte alors un octet de plus — `ecart` le dit, et `main` refuse d'écrire.
test('#1739 : un octet ajouté au corps rompt le contrôle — `ecart` le nomme', () => {
  const tronque = ANCIENS.map((f, i) => (i === 2 ? { ...f, texte: f.texte.replace(/\n$/, '') } : f))
  const { ecart } = recouper(tronque, LISTE)
  assert.ok(ecart, 'le contrôle à l’octet doit voir l’octet ajouté')
  assert.equal(ecart.apres.length, ecart.avant.length + 1)
})

test('#1739 : IDEMPOTENT — rejoué sur sa propre sortie, il rend les mêmes fichiers', () => {
  const un = recouper(ANCIENS, LISTE)
  const deux = recouper(un.plan.map((e) => ({ nom: e.nom, texte: un.contenus.get(e.nom) })), LISTE)
  assert.deepEqual(deux.introuvables, [])
  assert.equal(deux.ecart, null)
  assert.deepEqual([...deux.contenus], [...un.contenus])
  assert.equal(indexDe('Livre forgé', deux.plan), indexDe('Livre forgé', un.plan))
})

test('#1739 : une entrée de stock keyée par chemin et par section SUIT, sa `preuve` avec elle', () => {
  const { carte } = recouper(ANCIENS, LISTE)
  const racine = 'Source/Livre forge'
  const entrees = [
    { famille: 'br-litteral', fichier: `${racine}/1 - Alpha.md`, ref: 'gamma#1 :: cle|valeur', occurrence: 1, lot: '#X', date: '2026-01-01', preuve: 'PDF p.2 : …' },
    { famille: 'br-litteral', fichier: 'Source/Autre livre/01 - X.md', ref: 'y#1 :: a', occurrence: 1, lot: '#X', date: '2026-01-01' },
  ]
  const { entrees: apres, recalees, orphelines } = recalerStock(entrees, racine, carte)
  assert.deepEqual(orphelines, [])
  assert.equal(recalees.length, 1)
  assert.equal(apres[0].fichier, `${racine}/03 - Gamma.md`)
  assert.equal(apres[0].ref, 'gamma#1 :: cle|valeur')
  assert.equal(apres[0].preuve, 'PDF p.2 : …')
  assert.equal(apres[0].date, '2026-01-01')
  assert.deepEqual(apres[1], entrees[1], 'une entrée d’un autre livre ne bouge pas')
})

test('#1739 : une entrée de stock qu’aucune section ne porte est NOMMÉE, jamais devinée', () => {
  const { carte } = recouper(ANCIENS, LISTE)
  const racine = 'Source/Livre forge'
  const entrees = [{ famille: 'sans-folio', fichier: `${racine}/1 - Alpha.md`, ref: '3 chapitre(s)', occurrence: 1 }]
  const { entrees: apres, recalees, orphelines } = recalerStock(entrees, racine, carte)
  assert.deepEqual(recalees, [])
  assert.deepEqual(orphelines, [`${racine}/1 - Alpha.md :: 3 chapitre(s)`])
  assert.deepEqual(apres, entrees)
})

test('#1739 : `planDe` et `contenuDe` sont PURS — mêmes entrées, mêmes sorties', () => {
  const lignes = fluxDe(ANCIENS).flux.split('\n')
  const a = planDe(lignes, LISTE, new Map([[1, 0], [3, 11], [5, 17]]))
  const b = planDe(lignes, LISTE, new Map([[1, 0], [3, 11], [5, 17]]))
  assert.deepEqual(a, b)
  assert.equal(contenuDe(lignes, a.plan[0]), contenuDe(lignes, b.plan[0]))
})

// ---------- --suivre-diff : carte de SLUGS dérivée de la carte de lignes EXACTE ----------
// Un chapitre ÉDITÉ EN PLACE : un romain d'onglet ôté d'un titre, une ligne de romain nu supprimée,
// un titre inchangé, un titre soudé scindé en deux. Le diff est celui que `git diff -U0` écrit.
const HEAD_EDITE = ['*Pages PDF 1-2*', '', '### IV SELECTION OF POISONS', 'texte', 'IV', '### LEAPING', 'texte', '### ALPHA BETA', 'texte', ''].join('\n')
const ARBRE_EDITE = ['*Pages PDF 1-2*', '', '### SELECTION OF POISONS', 'texte', '### LEAPING', 'texte', '### ALPHA', '### BETA', 'texte', ''].join('\n')
const DIFF_EDITE = ['@@ -3 +3 @@', '-### IV SELECTION OF POISONS', '+### SELECTION OF POISONS', '@@ -5 +4,0 @@', '-IV', '@@ -8 +7,2 @@', '-### ALPHA BETA', '+### ALPHA', '+### BETA'].join('\n')

test('#1739 : carte de slugs — titre renommé EN PLACE suivi, titre inchangé gardé, titre SCINDÉ rapporté', () => {
  const { carte, rapportees } = carteDesSlugs('09 - X.md', HEAD_EDITE, ARBRE_EDITE, carteDeLignes(hunksDe(DIFF_EDITE)))
  assert.deepEqual(Object.fromEntries([...carte].map(([k, v]) => [k, v.ref])), {
    '09 - X.md :: #1': '#1',
    '09 - X.md :: iv-selection-of-poisons#1': 'selection-of-poisons#1',
    '09 - X.md :: leaping#1': 'leaping#1',
  })
  assert.deepEqual(rapportees, ['09 - X.md :: alpha-beta#1 (l.8) — hunk ambigu, candidates l.7/8'])
})

test('#1739 : la carte de slugs se branche sur `recalerStock` — la clé suit, le titre scindé reste NOMMÉ', () => {
  const racine = 'Source/Livre forge'
  const { carte } = carteDesSlugs('09 - X.md', HEAD_EDITE, ARBRE_EDITE, carteDeLignes(hunksDe(DIFF_EDITE)))
  const entrees = [
    { famille: 'br-litteral', fichier: `${racine}/09 - X.md`, ref: 'iv-selection-of-poisons#1 :: name|source', occurrence: 1, preuve: 'PDF p.2' },
    { famille: 'br-litteral', fichier: `${racine}/09 - X.md`, ref: 'leaping#1 :: difficulty|action', occurrence: 1 },
    { famille: 'br-litteral', fichier: `${racine}/09 - X.md`, ref: 'alpha-beta#1 :: a|b', occurrence: 1 },
  ]
  const { entrees: apres, recalees, orphelines } = recalerStock(entrees, racine, carte)
  assert.equal(apres[0].ref, 'selection-of-poisons#1 :: name|source')
  assert.equal(apres[0].preuve, 'PDF p.2')
  assert.deepEqual(apres[1], entrees[1])
  assert.deepEqual(recalees, ['09 - X.md :: iv-selection-of-poisons#1 :: name|source  →  09 - X.md :: selection-of-poisons#1 :: name|source'])
  assert.deepEqual(orphelines, [`${racine}/09 - X.md :: alpha-beta#1 :: a|b`])
})

test('#1739 : un titre devenu LÉGENDE de table suit la section qui porte l’en-tête de sa table ; devenu prose, il reste RAPPORTÉ (CRB 027:47)', () => {
  const head = ['### **SNEAKING AROUND**', '', 'texte', '', '## <span id="p"></span>**EXAMPLES**', '', '| Difficulty | Action |', '|---|---|', '| Easy | Hide |', '', '### **NOTE**', '', 'fin', ''].join('\n')
  const arbre = ['### **SNEAKING AROUND**', '', 'texte', '', '<span id="p"></span>**EXAMPLES**', '', '| Difficulty | Action |', '|---|---|', '| Easy | Hide |', '', '**NOTE**', '', 'fin', ''].join('\n')
  const diff = '@@ -5 +5 @@\n-## <span id="p"></span>**EXAMPLES**\n+<span id="p"></span>**EXAMPLES**\n@@ -11 +11 @@\n-### **NOTE**\n+**NOTE**\n'
  const { carte, rapportees } = carteDesSlugs('027 - X.md', head, arbre, carteDeLignes(hunksDe(diff)))
  assert.equal(carte.get('027 - X.md :: examples#1')?.ref, 'sneaking-around#1')
  assert.deepEqual(rapportees, ["027 - X.md :: note#1 (l.11) — l.11 n'est plus un titre"])
})

test('#1739 : compte ÉGAL sans correspondance (scission + ligne vide ôtée, diff git réel) — le titre est RAPPORTÉ, jamais réécrit', () => {
  const head = 'a\n\n#### **Bounce** XII **Cold-blooded**\n\nbody\n'
  const arbre = 'a\n\n#### **Bounce**\n#### **Cold-blooded**\nbody\n'
  const diff = '@@ -3,2 +3,2 @@\n-#### **Bounce** XII **Cold-blooded**\n-\n+#### **Bounce**\n+#### **Cold-blooded**\n'
  const { carte, rapportees } = carteDesSlugs('x.md', head, arbre, carteDeLignes(hunksDe(diff)))
  assert.equal(carte.has('x.md :: bounce-xii-cold-blooded#1'), false)
  assert.deepEqual(rapportees, ['x.md :: bounce-xii-cold-blooded#1 (l.3) — hunk ambigu, candidates l.3/4'])
})

test('#1739 : --suivre-diff ne porte que les clés de SECTION — une clé de fichier passe inchangée, sans orpheline', () => {
  const racine = 'Source/Livre forge'
  const entrees = [{ famille: 'sans-folio', fichier: `${racine}/001 - Cover.md`, ref: '122 chapitre(s)', occurrence: 1 }]
  const r = recalerStock(entrees, racine, new Map(), { portee: aUneCleDeSection })
  assert.deepEqual(r, { entrees, recalees: [], orphelines: [] })
})

test('#1739 : --suivre-diff est BLOQUÉ (rien écrit, sortie en échec) par une entrée orpheline — un titre rapporté ne bloque que si une entrée le keye', () => {
  assert.equal(suiviBloque([{ orphelines: [] }]), false)
  assert.equal(suiviBloque([{ orphelines: ['Source/L/x.md :: a#1 :: k'] }]), true)
})

test('#1739 : un titre RAPPORTÉ sans entrée keyée est listé « aucun stock keyé » et ne bloque pas ; keyé, son entrée orpheline BLOQUE (CRB 018, hunk ambigu)', () => {
  const racine = 'Source/Livre forge'
  const { carte, rapportees } = carteDesSlugs('09 - X.md', HEAD_EDITE, ARBRE_EDITE, carteDeLignes(hunksDe(DIFF_EDITE)))
  const sans = [recalerStock([{ famille: 'br-litteral', fichier: `${racine}/09 - X.md`, ref: 'leaping#1 :: a|b', occurrence: 1 }], racine, carte, { portee: aUneCleDeSection })]
  assert.equal(suiviBloque(sans), false)
  assert.deepEqual(rapportees.map((r) => rapporteeEnLigne(r, racine, sans.flatMap((s) => s.orphelines))), ['09 - X.md :: alpha-beta#1 (l.8) — hunk ambigu, candidates l.7/8 — aucun stock keyé'])
  const avec = [recalerStock([{ famille: 'br-litteral', fichier: `${racine}/09 - X.md`, ref: 'alpha-beta#1 :: a|b', occurrence: 1 }], racine, carte, { portee: aUneCleDeSection })]
  assert.equal(suiviBloque(avec), true)
  assert.deepEqual(rapportees.map((r) => rapporteeEnLigne(r, racine, avec.flatMap((s) => s.orphelines))), ['09 - X.md :: alpha-beta#1 (l.8) — hunk ambigu, candidates l.7/8'])
  assert.equal(rapporteeEnLigne('10 - Y.md — absent de HEAD', racine, [`${racine}/10 - Y.md :: z#1 :: k`]), '10 - Y.md — absent de HEAD')
})

// Titres réparés (#1739, 3b-3b-2) : un titre DÉPLACÉ suit sa ligne neuve ; un titre NEUF scinde la
// section qui le précède, et les entrées qui y sont keyées sont RAPPORTÉES. Diff git réel (-U0).
const HEAD_TITRES = ['*P*', '', '### **Wounds**', '', 'table', '', '### **Spellcaster**', '', 'corps S', '', '### **Skittish**', '', 'corps K', '', '### **Stupid**', '', 'Aimed body', ''].join('\n')
const ARBRE_TITRES = ['*P*', '', '### **Wounds**', '', 'table', '', '### **Skittish**', '', 'corps K', '', '### **Spellcaster**', '', 'corps S', '', '### **Stupid**', '', '#### **Aimed Shots**', '', 'Aimed body', ''].join('\n')
const DIFF_TITRES = ['@@ -6,0 +7,4 @@', '+### **Skittish**', '+', '+corps K', '+', '@@ -11,4 +14,0 @@', '-### **Skittish**', '-', '-corps K', '-', '@@ -16,0 +17,2 @@', '+#### **Aimed Shots**', '+'].join('\n')

test('#1739 : un titre DÉPLACÉ (sa ligne ôtée, son slug sur UNE ligne neuve) suit sa ligne neuve ; un titre NEUF scinde la section qui le précède', () => {
  const { carte, rapportees, scindees } = carteDesSlugs('115 - X.md', HEAD_TITRES, ARBRE_TITRES, carteDeLignes(hunksDe(DIFF_TITRES)))
  assert.deepEqual(rapportees, [])
  assert.equal(carte.get('115 - X.md :: skittish#1').ref, 'skittish#1')
  assert.deepEqual(scindees, [{ cle: '115 - X.md :: wounds#1', par: 'skittish#1 (l.7)' }, { cle: '115 - X.md :: stupid#1', par: 'aimed-shots#1 (l.17)' }])
})

test('#1739 : une entrée keyée sur une section SCINDÉE est rapportée et BLOQUE le suivi ; les autres passent', () => {
  const racine = 'Source/Livre forge'
  const scindees = [{ cle: '036 - X.md :: melee#1', par: 'aimed-shots#1 (l.168)' }]
  const entrees = [
    { famille: 'donnee-en-tete', fichier: `${racine}/036 - X.md`, ref: 'melee#1 :: a|b', occurrence: 1 },
    { famille: 'donnee-en-tete', fichier: `${racine}/036 - X.md`, ref: 'scatter#1 :: 1|2|3', occurrence: 1 },
  ]
  const sur = entreesScindees(entrees, racine, scindees)
  assert.deepEqual(sur, [`${racine}/036 - X.md :: melee#1 :: a|b  ← section scindée par aimed-shots#1 (l.168)`])
  assert.equal(suiviBloque([], sur), true)
  assert.equal(suiviBloque([], []), false)
})
