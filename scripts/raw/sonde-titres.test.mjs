// SONDE des TITRES (#1739) : `classer` sur une page forgée et un `.md` forgé qui portent chaque forme.
// Le corps est l'ancre : chaque titre se juge par la ligne qui précède la 1re ligne de SON corps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { boitesDuPdf, classer, ecartDuStock, glypheFuite, grasDeTete, plusLongueCroissante, sansGlyphe, sondeDuLivre, STOCK_PATH } from './sonde-titres.mjs'
import { infidelite, reparerLivre } from './reparer-titres.mjs'
import { decoupeDe, gabaritTitreDe, livreExtraitDe, nomsDeLaListe, pdfDe, readText } from './_lib.mjs'
import { readStock } from './stockNominatif.mjs'
import { lignes } from './lib/colonnes.mjs'
import { pageCrb } from './lib/fixtures/page-crb.mjs'

const GABARIT = {
  titre: { police: 'ACaslonPro-Bold', taille: 12 },
  accompagnement: [{ police: 'ACaslonPro-Italic', taille: 12 }],
  encadre: { police: 'CaslonAntique-Bold', taille: 15 },
  capitales: { police: 'CaslonAntique-Bold-SC700' },
  intertitre: { police: 'ACaslonPro-Bold', taille: 10 },
  exclusions: [{ police: 'CaslonAntique-Bold', taille: 12 }],
  glyphes: [{ police: 'crossbatstfb', role: 'titre', caracteres: ['h', 'H'] }, { police: 'onlyskulls', role: 'puce', caracteres: ['0'] }],
}
const L = (colonne, y0, texte, police = 'ACaslonPro-Regular', taille = 9) => ({ colonne, x0: 58 + 244 * colonne, y0, texte, spans: [{ texte, police, taille }] })
const T = (colonne, y0, texte) => L(colonne, y0, texte, 'ACaslonPro-Bold', 12)

const PAGES = [
  {
    page: 10,
    lignes: [
      L(0, 750, 'Coda words appear once here'),
      T(0, 700, 'Alpha'),
      L(0, 690, 'Alpha body text one two three'),
      T(0, 600, 'Gamma'),
      L(0, 590, 'Gamma body words appear here'),
      T(0, 500, 'Delta'),
      L(0, 490, 'Delta corps texte vient ici'),
      T(0, 400, 'Theta'),
      L(0, 390, 'Theta body is here now'),
      T(0, 300, 'Iota'),
      L(0, 290, 'Iota corps en gras seul'),
      L(0, 200, 'BOX TITLE', 'CaslonAntique-Bold', 15),
      L(0, 190, 'cell a cell b'),
      L(0, 150, 'STATBLOC', 'CaslonAntique-Bold', 12),
      L(0, 100, 'SIDEBAR', 'CaslonAntique-Bold', 15),
      L(0, 90, 'Sidebar prose runs along here'),
      T(1, 700, 'Beta'),
      L(1, 690, 'Beta body words here now'),
      T(1, 600, 'Eps'),
      L(1, 590, 'Eps corps ligne encore la'),
      T(1, 500, 'Zeta'),
      L(1, 490, 'Zeta words for zeta entry'),
      T(1, 400, 'Kappa'),
      T(1, 350, 'Lambda'),
      L(1, 340, 'Lambda corps words go here'),
      T(1, 300, 'Mu'),
      L(1, 290, 'Mu corps words also here'),
      L(1, 200, 'Troll', 'CaslonAntique-Bold-SC700', 18),
      L(1, 190, 'Trolls are big and hungry'),
      L(1, 150, 'Wolf', 'CaslonAntique-Bold-SC700', 18),
      L(1, 140, 'Wolves hunt in packs here'),
      L(1, 120, 'Ogre', 'CaslonAntique-Bold-SC700', 18),
      L(1, 110, 'Ogres are huge brutes here'),
      L(1, 100, 'OGRE', 'CaslonAntique-Bold', 12),
      L(1, 80, 'Career Path', 'CaslonAntique-Bold-SC700', 18),
      L(1, 70, 'Career path body words go'),
      T(1, 50, 'Rho'),
      L(1, 40, 'Rho corps words sit here'),
    ],
  },
]
const MD = [
  '*Pages PDF 10-10*',
  'Alpha body text one two three',
  '### **Beta**',
  '**Alpha** Beta body words here now',
  '**Gamma** Gamma body words appear here',
  'Delta corps texte vient ici',
  '**Delta:** une étiquette, une mention',
  '### **Theta**',
  'Un paragraphe étranger.',
  'Theta body is here now',
  '**Iota**',
  'Iota corps en gras seul',
  '#### BOX TITLE',
  '| cell a | cell b |',
  '### **Zeta**',
  'Zeta words for zeta entry',
  '### **Eps**',
  'Eps corps ligne encore la',
  'Coda words appear once here',
  '### **Lambda**',
  'Coda words appear once here Lambda corps words go here',
  '### **Mu**',
  '10 11 Mu corps words also here',
  '#### SIDEBAR',
  'Autre paragraphe.',
  'Sidebar prose runs along here',
  '**Troll** Trolls are big and hungry',
  '## Wolf',
  'Wolves hunt in packs here',
  'Ogres are huge brutes here',
  '#### **OGRE**',
  'Career path body words go',
  '# <span id="page-10-0"></span>**Rho**',
  'Rho corps words sit here',
]
const FICHIERS = [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: MD.flatMap((l, i) => (i ? ['', l] : [l])) }]

const { sites, titres } = classer(PAGES, FICHIERS, GABARIT)
const titre = (t) => titres.find((x) => x.texte === t)
const site = (f, t) => sites.find((s) => s.forme === f && s.titre === t)

test('#1739 : titre à sa place, familles entrée et tableau, exclusion typographique', () => {
  assert.equal(titre('Beta').forme, 'ok')
  assert.deepEqual([titre('BOX TITLE').famille, titre('BOX TITLE').forme], ['tableau', 'L'])
  assert.equal(titre('STATBLOC'), undefined)
})

test('#1739 : famille « capitales » — le nom de créature SC700 est un titre : S soudé à son corps, ou à sa place', () => {
  assert.deepEqual([site('S', 'Troll')?.famille, site('S', 'Troll')?.site], ['capitales', '001:53'])
  assert.deepEqual([titre('Wolf')?.famille, titre('Wolf')?.forme], ['capitales', 'ok'])
})

test('#1739 : S′ de capitales par COMPTAGE — imprimé plus de fois que le `.md` ne le porte, restauré dans la forme de ses frères ; sans comptage, `S\'-non-prouve` : rapporté, jamais réparé', () => {
  const s = site("S'", 'Ogre')
  assert.deepEqual([s?.famille, s?.cible, s?.ligneTitre, s?.frere, s?.comptage], ['capitales', '001:59', '## Ogre', '001:55 « Wolf »', { auPdf: 2, auMd: 1 }])
  const cp = sites.filter((x) => x.titre === 'Career Path')
  assert.deepEqual(cp.map((x) => [x.forme, x.famille, x.corps]), [["S'-non-prouve", 'capitales', '001:63']])
  const { appliques, refus } = reparerLivre(new Map([['001', FICHIERS[0].lignes.join('\n')]]), cp)
  assert.deepEqual([appliques, refus], [[], []], 'la réparation ne consomme pas un S′ non prouvé')
})

test('#1739 : une ancre `<span id="page-…">` devant un titre ne le cache pas', () => {
  assert.equal(titre('Rho').forme, 'ok')
})

test('#1739 : S soudé à son corps ; F soudé au corps de son jumeau, cible devant son propre corps', () => {
  assert.equal(site('S', 'Gamma').site, '001:9')
  assert.deepEqual([site('F', 'Alpha').site, site('F', 'Alpha').cible], ['001:7', '001:3'])
})

test('#1739 : `titreMd` — le texte EXACT du titre dans le `.md`, que la réparation déplace', () => {
  assert.deepEqual(
    [site('S', 'Gamma'), site('F', 'Alpha'), site('M', 'Theta'), site('B', 'Iota'), site('O', 'Eps'), site('S', 'Troll')].map((x) => x.titreMd),
    ['**Gamma**', '**Alpha**', '### **Theta**', '**Iota**', '### **Eps**', '**Troll**'],
  )
})

test('#1739 : S′ — une étiquette `**X:**` est une MENTION, pas un fragment ; la ligne restaurée porte le texte imprimé', () => {
  const s = site("S'", 'Delta')
  assert.equal(s.ligneTitre, '### **Delta**')
  assert.equal(s.cible, '001:11')
  assert.ok(s.mentions.includes('001:13'))
})

test('#1739 : M ligne de titre isolée ailleurs ; B gras seul ; un titre SUIVI d’un titre se juge par le suivant — absent, restauré devant le titre du suivant', () => {
  assert.deepEqual([site('M', 'Theta').site, site('M', 'Theta').cible], ['001:15', '001:19'])
  assert.equal(site('B', 'Iota').site, '001:21')
  assert.deepEqual([site("S'", 'Kappa')?.cible, site("S'", 'Kappa')?.ligneTitre], ['001:39', '### **Kappa**'])
})

test('#1739 : O — l’entrée hors de l’ordre du PDF se pose DEVANT le titre qui la suit au PDF', () => {
  const o = site('O', 'Eps')
  assert.deepEqual([o.site, o.corps, o.devant, o.titreSuivant], ['001:33', '001:35', '001:29', 'Zeta'])
})

test('#1739 : encadré — jamais un M ; sa clé en ligne de titre LIBRE du `.md` : présent, `place-non-prouvee`, jamais S′ ; le corps CANDIDAT rapporté, jamais réservé ; la réparation ne le consomme pas', () => {
  assert.deepEqual([titre('SIDEBAR').famille, titre('SIDEBAR').forme, titre('SIDEBAR').corps], ['encadre', 'place-non-prouvee', null])
  const s = sites.filter((x) => x.titre === 'SIDEBAR')
  assert.deepEqual(s.map((x) => [x.forme, x.corpsCandidat, x.cible ?? null]), [['place-non-prouvee', '001:51', null]])
  assert.deepEqual(reparerLivre(new Map([['001', FICHIERS[0].lignes.join('\n')]]), s), { textes: new Map([['001', FICHIERS[0].lignes.join('\n')]]), appliques: [], refus: [], recolles: [] })
})

test('#1739 : débris devant un corps à sa place — doublon d’un texte imprimé une fois ; des nombres ne sont pas un débris de titre (mobilier)', () => {
  const d = site('doublon', 'Lambda')
  assert.deepEqual([d?.site, d?.auMd, d?.auPdf.length], ['001:41', ['001:37', '001:41'], 1])
  assert.equal(titre('Lambda').forme, 'ok')
  assert.equal(titre('Mu').forme, 'ok')
  assert.equal(sites.some((x) => x.titre === 'Mu'), false)
})

test('#1739 : grasDeTete distingue l’étiquette ; plusLongueCroissante garde l’ordre majoritaire', () => {
  assert.equal(grasDeTete('**Combat Reflexes:** texte').etiquette, true)
  assert.equal(grasDeTete('**Surprised** Multiple').etiquette, false)
  assert.deepEqual([...plusLongueCroissante([1, 2, 9, 3, 4])].sort(), [0, 1, 3, 4])
})

test('#1739 : `--json` sous la racine du dépôt est REFUSÉ avant toute lecture du PDF (exit 2, rien d’écrit)', () => {
  const sortie = fileURLToPath(new URL('./sites-refuses.json', import.meta.url))
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./sonde-titres.mjs', import.meta.url)), 'core-rulebook-5e', '--json', sortie], { encoding: 'utf8' })
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /sous le dépôt/)
  assert.equal(existsSync(sortie), false)
})

test('#1739 : toute cible est le DÉBUT d’un bloc — une ligne de tableau se remonte à l’EN-TÊTE de son bloc (CRB p.145, p.339)', () => {
  const { pages, fichiers } = JSON.parse(readFileSync(new URL('./lib/fixtures/cibles-crb.json', import.meta.url), 'utf8'))
  const reels = classer(pages, fichiers, gabaritTitreDe('core-rulebook-5e')).sites
  const bu = reels.find((x) => x.titre === 'STINKING DRUNK')
  assert.deepEqual([bu.forme, bu.titreMd], ['F', '**STINKING DRUNK**'])
  const [, lb] = bu.cible.split(':').map(Number)
  const l028 = fichiers.find((x) => x.nom.startsWith('028')).lignes
  assert.match(l028[lb - 1], /^\| 1d10 +\| Outcome/)
  assert.equal(l028[lb - 2], '')
  const sq = reels.find((x) => x.titre === 'skeleTon')
  assert.equal(sq.forme, 'F')
  const [f, l] = sq.cible.split(':').map(Number)
  const lignes = fichiers.find((x) => x.nom.startsWith(String(f).padStart(3, '0'))).lignes
  assert.match(lignes[l - 1], /^Skeletons are the fleshless bones/)
  assert.equal(lignes[l - 2], '')
})

test('#1739 : une cible au milieu d’un paragraphe sort en cible-invalide, avec sa forme visée', () => {
  const pages = [{ page: 10, lignes: [T(0, 700, 'Omega'), L(0, 690, 'Omega corps words go here')] }]
  const lignes = ['Intro line here', 'Omega corps words go here', '', '**Omega** Autre corps étranger ici']
  const [s] = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT).sites
  assert.deepEqual([s.forme, s.formeVisee, s.champ, s.cible, s.ligneCible], ['cible-invalide', 'F', 'cible', '001:2', 'Omega corps words go here'])
})

test('#1739 : la ligne de titre POSÉE — niveau et gras du frère typographique précédent (le suivant pour le premier), texte du `.md`', () => {
  assert.deepEqual([site('S', 'Gamma').ligneTitre, site('S', 'Gamma').frere], ['### **Gamma**', '001:5 « Beta »'])
  assert.deepEqual([site('M', 'Theta').ligneTitre, site('B', 'Iota').ligneTitre], ['### **Theta**', '### **Iota**'])
  assert.deepEqual([site('S', 'Troll').ligneTitre, site('S', 'Troll').frere], ['## **Troll**', '001:55 « Wolf »'])
})

test('#1739 : une ligne imprimée en deux boîtes (même y) est UNE ligne de corps, ses morceaux de gauche à droite', () => {
  const morceau = (x0, texte) => ({ colonne: 0, x0, y0: 490, texte, spans: [{ texte, police: 'ACaslonPro-Regular', taille: 9 }] })
  const pages = [{ page: 10, lignes: [T(0, 500, 'Nostrum'), morceau(120, 'Range: Touch'), morceau(58, 'CN: 0')] }]
  const lignes = ['#### **Nostrum**', '', '**CN:** 0 **Range:** Touch']
  const { titres: ts } = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT)
  assert.deepEqual([ts[0].forme, ts[0].cles], ['ok', ['cn: 0 range:']])
})

test('#1739 : le frère qui donne le niveau est dans le MÊME fichier — le premier titre d’un fichier prend le suivant, jamais le dernier du fichier précédent', () => {
  const pages = [
    { page: 10, lignes: [T(0, 700, 'Aa'), L(0, 690, 'Aa corps words go here')] },
    { page: 11, lignes: [T(0, 700, 'Bb'), L(0, 690, 'Bb corps words go here'), T(0, 600, 'Cc'), L(0, 590, 'Cc corps words go here')] },
  ]
  const fichiers = [
    { nom: '001 - Un.md', page: 10, pageFin: 10, lignes: ['## **Aa**', '', 'Aa corps words go here'] },
    { nom: '002 - Deux.md', page: 11, pageFin: 11, lignes: ['**Bb** Bb corps words go here', '', '#### **Cc**', '', 'Cc corps words go here'] },
  ]
  const s = classer(pages, fichiers, GABARIT).sites.find((x) => x.titre === 'Bb')
  assert.deepEqual([s?.forme, s?.ligneTitre, s?.frere], ['S', '#### **Bb**', '002:3 « Cc »'])
})

test('#1739 : un titre imprimé sur DEUX lignes (même gabarit, même colonne, interligne serré) est UN titre (CRB p.170)', () => {
  const E = (y0, texte) => L(0, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [E(229, 'THE HEAL SKILL AND'), E(215, 'BLEEDING CONDITIONS'), L(0, 200, 'Heal skill prose words here')] }]
  const lignes = ['#### THE HEAL SKILL AND BLEEDING CONDITIONS', '', 'Heal skill prose words here']
  const r = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT)
  assert.deepEqual(r.titres.map((t) => [t.texte, t.forme]), [['THE HEAL SKILL AND BLEEDING CONDITIONS', 'ok']])
  assert.deepEqual(r.sites, [])
})

/** Ligne du PDF forgée : morceaux `[texte, gras]`, `x1` à 4,5 pt par caractère ; `marge` (bord droit de
 *  la boîte) = `x1` par défaut — la ligne remplit sa boîte. */
const G = (colonne, y0, morceaux, { x0 = 58, marge = null, police = 'ACaslonPro' } = {}) => {
  const texte = morceaux.map(([t]) => t).join(' ')
  const x1 = x0 + 4.5 * texte.length
  return { colonne, x0, x1, y0, marge: marge ?? x1, texte, spans: morceaux.map(([t, gras]) => ({ texte: t, police: `${police}-${gras === 'i' ? 'Italic' : gras === 'bi' ? 'BoldItalic' : gras ? 'Bold' : 'Regular'}`, taille: 9 })) }
}
const formesDe = (lignes, md, formes, cercles = []) =>
  classer([{ page: 10, lignes, cercles }], [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT).sites.filter((s) => formes.includes(s.forme))

test('#1739 : P — paragraphe scindé, PROUVÉ au PDF : lignes consécutives, typographie continue, 1er mot qui ne tenait pas (CRB p.338, p.46, p.45)', () => {
  const lignes = [
    G(0, 384, [['see page 356']]),
    G(0, 371, [['Infected:', true], ['Wounded opponents must take an']]),
    G(0, 358, [['Easy (+4 SL)', true]]),
    G(0, 345, [['Endurance', true], ['Test to avoid a Festering Wound']]),
    G(1, 300, [['Trappings:', true], ['Hammer and Nails, Pile of Leaflets, Writing']]),
    G(1, 287, [['Kit']]),
    G(1, 200, [['Talents:', true], ['Beneath Notice, Gregarious,']]),
    G(1, 187, [['Read/Write']]),
    G(1, 174, [['Trappings:', true], ['Writing Kit']]),
  ]
  const md = [
    'see page 356', '', '**Infected:** Wounded opponents must take an', '', '**Easy (+4 SL)**', '', '**Endurance** Test to avoid a Festering Wound', '',
    '**Trappings:** Hammer and Nails, Pile of Leaflets, Writing', '', 'Kit', '',
    '**Talents:** Beneath Notice, Gregarious,', '', 'Read/Write **Trappings:** Writing Kit',
  ]
  assert.deepEqual(formesDe(lignes, md, ['P']).map((s) => [s.site, s.avec, s.etiquette, s.preuve]), [
    ['001:5', '001:3', null, 'p.10 col.0 y371→358'],
    ['001:7', '001:5', null, 'p.10 col.0 y358→345'],
    ['001:11', '001:9', null, 'p.10 col.1 y300→287'],
    ['001:15', '001:13', '**Trappings:**', 'p.10 col.1 y200→187'],
  ])
  assert.deepEqual(formesDe(lignes, md, ['E']), [], 'le libellé qu’un P coupe n’est pas un E')
})

test('#1739 : P — pas de preuve, pas de site : repère de liste (CRB p.36), libellé, ligne FINIE avant la marge, retrait (citation, CRB p.26), typographie rompue', () => {
  const lignes = [
    G(0, 580, [['A)', true], ['Choose a Class and Career available']]),
    G(0, 567, [['or', 'i']]),
    G(0, 554, [['B)', true], ['Roll on your Species table']]),
    G(0, 400, [['Skills: Charm, Gossip', true]]),
    G(0, 387, [['Talents:', true], ['Craftsman, Strong Back']]),
    G(1, 300, [['Duration:', true], ['6 rounds']], { marge: 290 }),
    G(1, 287, [['Your target gains +10 Toughness']]),
    G(1, 200, [['On Dwarfs', true]]),
    G(1, 191, [['When High King Ironbeard made a gift', 'bi']], { x0: 64, police: 'CaslonAntique' }),
    G(1, 178, [['of Ghal Maraz to Sigmar it was more', 'bi']], { x0: 64, police: 'CaslonAntique' }),
  ]
  const md = [
    '**A)** Choose a Class and Career available *or*', '', '**B)** Roll on your Species table', '',
    '**Skills: Charm, Gossip**', '', '**Talents:** Craftsman, Strong Back', '',
    '**Duration:** 6 rounds', '', 'Your target gains +10 Toughness', '',
    '**On Dwarfs**', '', '*When High King Ironbeard made a gift of Ghal Maraz to Sigmar it was more*',
  ]
  assert.deepEqual(formesDe(lignes, md, ['P']), [])
})

test('#1739 : A — un nombre imprimé DANS une pastille est un appel de figure, mêlé en queue de la ligne voisine (CRB p.43)', () => {
  const lignes = [G(1, 252, [['SOLDIER ADVANCE SCHEME', true]]), G(1, 100, [['Seven words and']]), { ...G(1, 239, [['2']], { x0: 304 }), x1: 310 }, G(1, 169, [['Recruit — Brass 5', true]], { x0: 319 }), { ...G(1, 169, [['1']], { x0: 304 }), x1: 310 }, { ...G(1, 169, [['6']], { x0: 412 }), x1: 418 }, { ...G(1, 100, [['7']], { x0: 304 }), x1: 310 }]
  const cercles = [{ x0: 299, y0: 234, x1: 314, y1: 249 }, { x0: 299, y0: 164, x1: 314, y1: 179 }, { x0: 407, y0: 164, x1: 422, y1: 179 }]
  const md = ['#### **SOLDIER ADVANCE SCHEME** 2', '', '- **Recruit Brass 5** 1 6', '', 'Seven words and 7']
  assert.deepEqual(formesDe(lignes, md, ['A'], cercles).map((s) => [s.site, s.jeton]).sort(), [['001:1', '2'], ['001:3', '1'], ['001:3', '6']])
})

test('#1739 : G — gras italique du PDF rendu `*x*` (CRB p.46), jamais sur une ligne qui porte le mot sous deux emphases (CRB p.254) ; T — tiret cadratin du PDF perdu (CRB p.43, p.131)', () => {
  const lignes = [
    G(0, 300, [['Skills:', true], ['Art (Writing),'], ['Charm', 'bi'], [', Consume Alcohol']]),
    G(0, 200, [['Difficulty — set by the GM, with easier tasks']]),
    G(0, 100, [['Recruit — Brass 5', true]]),
    G(1, 300, [['make a Hard (-2 SL) Channelling (', true], ['Ulgu', 'bi'], [') Test to make', true]]),
  ]
  const md = ['**Skills:** Art (Writing), *Charm*, Consume Alcohol', '', '- Difficulty set by the GM, with easier tasks', '', '- **Recruit Brass 5**', '', 'Lore (*Charm*) elsewhere', '', 'Strands of *Ulgu*, obfuscating. You may make a **Hard (-2 SL) Channelling (***Ulgu***)** Test to make it move']
  const sites = formesDe(lignes, md, ['G', 'T'])
  assert.deepEqual(sites.map((s) => [s.forme, s.site, s.texteMd ?? `${s.avant}|${s.apres}`]), [['G', '001:1', '*Charm*'], ['T', '001:3', 'Difficulty|set'], ['T', '001:5', 'Recruit|Brass']])
})

test('#1739 : famille « intertitre » (CRB p.46, p.92, p.171, p.193) — F soudé au corps de son jumeau, S soudé DANS le gras de l’étiquette, B à blanc de tête, titre sur deux lignes ; niveau du frère intertitre', () => {
  const I = (colonne, y0, texte) => L(colonne, y0, texte, 'ACaslonPro-Bold', 10)
  const pages = [{
    page: 10,
    lignes: [
      I(0, 700, '36–39: Cures'), L(0, 690, 'Cures body words go here'),
      I(0, 600, '40–42: Levy'), L(0, 590, 'Levy body words sit here'),
      I(0, 300, 'Inflicting Critical Wounds'), I(0, 287, 'on an Opponent with 0 Wounds'), L(0, 277, 'Damage words reduce here now'),
      I(1, 600, '69–73: Tax Collector'), L(1, 590, 'Tax body words are here'),
      I(1, 500, 'Adviser — Silver 3'), L(1, 490, 'Skills: Consume Alcohol, Cool'),
      I(1, 400, 'Explorer — Silver 5'), L(1, 390, 'Explorer body words go here'),
    ],
  }]
  const md = [
    '#### **36–39: Cures**', 'Cures body words go here', 'Levy body words sit here',
    '#### **Inflicting Critical Wounds on an Opponent with 0 Wounds**', 'Damage words reduce here now',
    '#### **69–73: Tax Collector**', '**40–42: Levy** Tax body words are here',
    ' **Adviser — Silver 3 Skills:** Consume Alcohol, Cool', ' **Explorer — Silver 5**', 'Explorer body words go here',
  ]
  const r = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: md.flatMap((l, i) => (i ? ['', l] : [l])) }], GABARIT)
  const de = (f, t) => r.sites.find((s) => s.forme === f && s.titre === t)
  assert.deepEqual([de('F', '40–42: Levy')?.famille, de('F', '40–42: Levy')?.site, de('F', '40–42: Levy')?.cible, de('F', '40–42: Levy')?.ligneTitre], ['intertitre', '001:13', '001:5', '#### **40–42: Levy**'])
  assert.deepEqual([de('S', 'Adviser — Silver 3')?.site, de('S', 'Adviser — Silver 3')?.titreMd, de('S', 'Adviser — Silver 3')?.ligneTitre], ['001:15', '**Adviser — Silver 3', '#### **Adviser — Silver 3**'])
  assert.deepEqual([de('B', 'Explorer — Silver 5')?.site, de('B', 'Explorer — Silver 5')?.ligneTitre], ['001:17', '#### **Explorer — Silver 5**'])
  assert.equal(r.titres.find((t) => t.texte === 'Inflicting Critical Wounds on an Opponent with 0 Wounds')?.forme, 'ok')
  assert.deepEqual(r.sites.map((s) => s.forme).sort(), ['B', 'F', 'S'])
})

test('#1739 : P — un gras de tête qui porte `:` ouvre un libellé, jamais une suite (CRB p.337)', () => {
  const lignes = [G(0, 522, [['Hand Weapon: (40/+7)', true]]), G(0, 509, [['Optional Bow and Arrows: (35/+7) 50 yards,', true]])]
  assert.deepEqual(formesDe(lignes, ['**Hand Weapon: (40/+7)**', '', '**Optional Bow and Arrows: (35/+7) 50 yards,** *Impale*'], ['P']), [])
})

test('#1739 : P — deux preuves au texte égal : l’emphase du `.md` départage (CRB p.338) ; deux lignes qui n’ont que la même preuve ne l’ont ni l’une ni l’autre (CRB p.336-337)', () => {
  const deux = [
    G(0, 371, [['Infected:', true], ['Wounded opponents must take an'], ['Easy (+4 SL)', true]]),
    G(0, 358, [['Endurance', true], ['Test to avoid a Festering Wound']]),
    G(1, 271, [['Infected:', true], ['Wounded opponents must take an'], ['Easy (+4 SL)', 'i']]),
    G(1, 258, [['Endurance', 'i'], ['Test to avoid a Festering Wound']]),
  ]
  const md = ['**Infected:** Wounded opponents must take an *Easy (+4 SL)*', '', '*Endurance* Test to avoid a Festering Wound']
  assert.deepEqual(formesDe(deux, md, ['P']).map((s) => s.preuve), ['p.10 col.1 y271→258'])
  const une = [G(0, 341, [['Optional Shield:', true], ['+2 AP when Opposing']]), G(0, 328, [['an attack with Dodge']])]
  const md2 = ['**Optional Shield:** +2 AP when Opposing', '', 'an attack with Dodge', '', '**Optional Shield:** +2 AP when Opposing', '', 'an attack with Dodge']
  assert.equal(formesDe(une, md2, ['P']).length, 0)
  assert.equal(formesDe(une, md2.slice(0, 3), ['P']).length, 1)
  const cedee = [
    G(0, 371, [['Wounded opponents must take an', 'i']]), G(0, 358, [['Easy test to avoid', 'i']]),
    G(1, 271, [['Wounded opponents must take an', 'bi']]), G(1, 258, [['Easy test to avoid', 'bi']]),
  ]
  const md3 = ['*Wounded opponents must take an*', '', '*Easy test to avoid*', '', '***Wounded opponents must take an***', '', '***Easy test to avoid***']
  assert.deepEqual(formesDe(cedee, md3, ['P']).map((s) => [s.site, s.preuve]).sort(), [['001:3', 'p.10 col.0 y371→358'], ['001:7', 'p.10 col.1 y271→258']], 'la preuve prise par une ligne est retirée aux autres')
})

test('#1739 : une ligne du `.md` ne répond qu’au PDF de SA plage de pages, bornée par les titres à leur place', () => {
  const pages = [
    { page: 10, lignes: [T(0, 700, 'Alpha'), L(0, 690, 'Alpha body words go here')], cercles: [] },
    { page: 11, lignes: [T(0, 700, 'Beta'), L(0, 690, 'Beta body words go here')], cercles: [] },
    { page: 12, lignes: [T(0, 700, 'Gamma'), L(0, 690, 'Gamma body words go here'), G(0, 600, [['Recruit — Brass 5', true]])], cercles: [] },
  ]
  const md = ['### **Alpha**', '', 'Alpha body words go here', '', '- **Recruit Brass 5**', '', '### **Beta**', '', 'Beta body words go here', '', '### **Gamma**', '', 'Gamma body words go here', '', '#### **Recruit — Brass 5**']
  const { sites } = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 12, lignes: md }], GABARIT)
  assert.deepEqual(sites.filter((s) => s.forme === 'T'), [])
})

test('#1739 : E — un libellé soudé en milieu de ligne OUVRE sa ligne au PDF, son 1er mot tenait sur la précédente, ou le livre ne l’imprime jamais en milieu de ligne — rare, après une ligne close (CRB p.213, p.308) ; pas après une ligne pleine pour un libellé imprimé aussi en milieu de ligne (CRB p.257), ni sur une ligne du PDF qui n’est pas celle du `.md` (CRB p.257), ni sur une preuve que deux lignes réclament', () => {
  const lignes = [
    G(0, 645, [['Seat of Power:', true], ['Middenheim, Middenland']], { marge: 290 }),
    G(0, 632, [['Head of the Cult:', true], ['Jarrick Valgeir, Ar-Ulric']], { marge: 290 }),
    G(0, 593, [['Major Festivals:', true], ['Campaign Start, Hochwinter, Campaign End']]),
    G(0, 580, [['Important Holy Texts:', true], ['Liber Lupus']]),
    G(0, 520, [['Target:', true], ['Special'], ['Duration:', true], ['Willpower days']]),
    G(0, 500, [['Wounded opponents must take an Easy Test to avoid a wound']]),
    G(0, 487, [['Duration:', true], ['Instant']]),
    G(0, 450, [['Traits:', true], ['Armour 2, Bite,']]),
    G(0, 437, [['Night Vision:', true], ['See clearly']]),
    G(1, 593, [['CN:', true], ['8']], { marge: 540 }),
    G(1, 580, [['Target:', true], ['Special']], { marge: 540 }),
    G(1, 400, [['CN:', true], ['4']], { marge: 540 }),
    G(1, 387, [['Range:', true], ['You']], { marge: 540 }),
  ]
  const md = ['**Seat of Power:** Middenheim, Middenland **Head of the Cult:** Jarrick Valgeir, Ar-Ulric', '', '**Major Festivals:** Campaign Start, Hochwinter, Campaign End **Important Holy Texts:** Liber Lupus', '', 'Wounded opponents must take an Easy Test to avoid a wound **Duration:** Instant', '', '**Traits:** Armour 2, Bite, **Night Vision:** See clearly', '', '**CN:** 8 **Target:** 1', '', '**CN:** 4 **Range:** You', '', '**CN:** 4 **Range:** You']
  assert.deepEqual(formesDe(lignes, md, ['E']).map((s) => [s.site, s.etiquette, s.preuve]), [['001:1', '**Head of the Cult:**', 'p.10 col.0 y645→632 tenait'], ['001:3', '**Important Holy Texts:**', 'p.10 col.0 y593→580 jamais en milieu de ligne, ouvre 1 ligne(s), ligne précédente close']])
  assert.deepEqual(formesDe(lignes, md, ['libelle-non-prouve']).map((s) => [s.site, s.etiquette, s.motif]), [['001:7', '**Night Vision:**', 'ouvre 1 ligne(s) < 6, ligne précédente ouverte']], 'un libellé rare après une ligne ouverte (`,`) : rapporté, jamais coupé')
})

test('#1739 : T — le tiret cadratin qui FERME une ligne du PDF, ou qui ouvre la suivante (CRB p.254, p.158)', () => {
  const lignes = [
    G(0, 567, [['see through the Spell or end its effects —']]),
    G(0, 554, [['they merely understand it is an illusion']]),
    G(1, 300, [['to match the fastest Pursuer']]),
    G(1, 287, [['— the one with the highest Movement']]),
  ]
  const md = ['see through the Spell or end its effects they merely understand it is an illusion', '', 'to match the fastest Pursuer the one with the highest Movement']
  assert.deepEqual(formesDe(lignes, md, ['T']).map((s) => [s.site, s.avant, s.apres]), [['001:1', 'effects', 'they'], ['001:3', 'Pursuer', 'the']])
})

test('#1739 : G — un gras italique coupé par un paragraphe scindé se lit dans la ligne que le P recolle (CRB p.84)', () => {
  const lignes = [
    G(0, 353, [['Skills:', true], ['Athletics, Consume Alcohol, Cool, Dodge,']]),
    G(0, 340, [['Endurance, Entertain (Taunt), Gossip, Intimidate,'], ['Melee', 'bi']]),
    G(0, 327, [['(Basic)', 'bi'], ['Melee (Brawling)']]),
  ]
  const md = ['**Skills:** Athletics, Consume Alcohol, Cool, Dodge, Endurance, Entertain (Taunt), Gossip, Intimidate, *Melee* ', '', '*(Basic)* Melee (Brawling)']
  assert.deepEqual(formesDe(lignes, md, ['P', 'G']).map((s) => [s.forme, s.site, s.avec ?? s.texteMd]), [['P', '001:3', '001:1'], ['G', '001:1', '*Melee (Basic)*']])
})

test('#1739 : P — la ligne qui TENAIT mais dont le texte continue (`,` final, suite en minuscule) est une suite (CRB p.337, p.352) ; sans preuve, rapportée', () => {
  const lignes = [
    G(0, 260, [['Infected:', true], ['Wounded opponents must take']], { marge: 290 }),
    G(0, 247, [['an Easy (+4 SL) Endurance Test to']], { marge: 290 }),
    G(0, 200, [['Leadership 25,']], { marge: 290 }),
    G(0, 187, [['Melee (Basic 60, Polearm 60)']], { marge: 290 }),
    G(0, 150, [['Wounded opponents must take an']], { marge: 290 }),
    G(0, 137, [['Easy (+4 SL) test']], { marge: 290 }),
  ]
  const md = ['**Infected:** Wounded opponents must take', '', 'an Easy (+4 SL) Endurance Test to', '', 'Climb 50, Leadership 25,', '', 'Melee (Basic 60, Polearm 60)', '', 'Wounded opponents must take an', '', 'Easy (+4 SL) test']
  assert.deepEqual(formesDe(lignes, md, ['P']).map((s) => [s.site, s.par]), [['001:3', 'suite'], ['001:7', 'suite']])
  assert.deepEqual(formesDe(lignes, md, ['paragraphe-non-prouve']).map((s) => [s.site, s.avec]), [['001:11', '001:9']])
})

test('#1739 : joint de fin de ligne — `Read/` + `Write` : P recollé sans espace ; J pour `Read/ Write` déjà recollé avec l’espace ; la CÉSURE (`Xy` seul au livre) est rapportée ; `X- y` sans `X-y` au livre n’est pas un joint (trait suspendu), ni `X/ y` que le PDF imprime au milieu d’une ligne (CRB p.50, p.107, p.259)', () => {
  const lignes = [
    G(0, 300, [['Talents:', true], ['Argumentative, Kingpin, Read/']]),
    G(0, 287, [['Write']]),
    G(1, 300, [['Talents:', true], ['Petty Magic, Read/']]),
    G(1, 287, [['Write, Second Sight']]),
    G(1, 200, [['a masterful demon-']]),
    G(1, 187, [['stration of power']]),
    G(0, 100, [['make an Unopposed Acid-']]),
    G(0, 87, [['and Poison-type attack']]),
    G(0, 60, [['shown on the Character Sheet and/or the entry']]),
    G(0, 47, [['or the relevant rule']]),
  ]
  const md = ['**Talents:** Argumentative, Kingpin, Read/ Write', '', '**Talents:** Petty Magic, Read/', '', 'Write, Second Sight', '', 'a masterful demon-', '', 'stration of power', '', 'the demonstration ends', '', 'make an Unopposed Acid- and Poison-type attack', '', 'shown on the Character Sheet and/ or the entry']
  assert.deepEqual(formesDe(lignes, md, ['J']).map((s) => [s.site, s.avant, s.apres]), [['001:1', 'Read/', 'Write']])
  assert.deepEqual(formesDe(lignes, md, ['P', 'cesure']).map((s) => [s.forme, s.site]), [['P', '001:5'], ['cesure', '001:9']])
})

test('#1739 : D — ligne déplacée sous l’ancre d’une autre page (CRB p.62, .md 018 l.1106, pages pdfminer réelles) : recollée à la prose que le PDF lui fait suivre ; à sa place, ou sans preuve de P, pas de site', () => {
  const { md } = JSON.parse(readFileSync(new URL('./lib/fixtures/ligne-deplacee-crb.json', import.meta.url), 'utf8'))
  const pages = [61, 62].map((n) => ({ page: n, lignes: lignes(pageCrb(n)), cercles: [] }))
  const sondeDe = (p, texte) => classer(p, [{ nom: '018 - Class and Careers.md', page: 61, pageFin: 62, lignes: texte }], gabaritTitreDe('core-rulebook-5e')).sites.filter((s) => s.forme === 'D')
  const i = md.indexOf('for the world.')
  const j = md.findIndex((l) => l.endsWith('win divine deliverance'))
  assert.deepEqual(sondeDe(pages, md).map((s) => [s.site, s.avec, s.preuve]), [[`018:${i + 1}`, `018:${j + 1}`, 'p.62 col.0 y554→541, folio 62 ≠ folio roulant 61']])
  const aSaPlace = md.flatMap((l, k) => (k === i ? [] : k === j ? [l, '', md[i]] : [l]))
  assert.deepEqual(sondeDe(pages, aSaPlace), [], 'sous l’ancre de SA page, la ligne n’est pas déplacée')
  const rompue = pages.map((p) => ({ ...p, lignes: p.lignes.map((l) => (l.texte === 'for the world.' ? { ...l, spans: l.spans.map((s) => ({ ...s, police: 'CaslonAntique' })) } : l)) }))
  assert.deepEqual(sondeDe(rompue, md), [], 'typographie rompue de `a` à `b` : pas de preuve de P, pas de site')
})

test('#1739 : légende de TABLE (CRB p.164, p.191, pages pdfminer réelles) — jugée au-dessus de l’EN-TÊTE de son bloc ; absente du `.md`, `legende-absente` par comptage ; en ligne de titre, L', () => {
  const { fichiers } = JSON.parse(readFileSync(new URL('./lib/fixtures/legendes-crb.json', import.meta.url), 'utf8'))
  const pages = [164, 191].map((n) => ({ page: n, lignes: lignes(pageCrb(n)), cercles: [] }))
  const { sites: ss, titres: ts } = classer(pages, fichiers, gabaritTitreDe('core-rulebook-5e'))
  const hit = ts.find((t) => t.texte === 'HIT LOCATIONS')
  assert.deepEqual([hit.famille, hit.forme], ['tableau', "S'"])
  const s = ss.find((x) => x.titre === 'HIT LOCATIONS')
  assert.deepEqual([s?.forme, s?.cible, s?.comptage, s?.ligneTitre, s?.ligneLegende], ['legende-absente', '036:23', { auPdf: 1, auMd: 0 }, undefined, '**HIT LOCATIONS**'])
  const adv = ts.find((t) => t.texte === 'ADVANCEMENT XP COSTS')
  assert.notEqual(adv.corps.l, adv.titreMd?.l + 2, 'le corps apparié est une ligne AU MILIEU du bloc')
  assert.deepEqual([adv.famille, adv.forme, adv.titreMd?.l + 1], ['tableau', 'L', 33])
  const l = ss.find((x) => x.titre === 'ADVANCEMENT XP COSTS')
  assert.deepEqual([l?.forme, l?.site, l?.ligneLegende], ['L', '045:33', '**ADVANCEMENT XP COSTS**'])
})

test('#1739 : légendes de TABLE — corps départagé par les clés suivantes de sa section ; titres sur une même ligne de base : en-têtes de colonne ; en titre ou en bannière, L ; absente, posée ; réparées, à leur place', () => {
  const E = (colonne, y0, texte) => L(colonne, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{
    page: 10,
    lignes: [
      E(0, 700, 'FIRST TABLE'), L(0, 690, 'Roll Result'), L(0, 680, 'alpha row one here'),
      E(0, 600, 'SECOND TABLE'), L(0, 590, 'Roll Result'), L(0, 580, 'beta row two here'),
      E(0, 500, 'SIDEBAR'), L(0, 490, 'Sidebar prose runs along here'),
      E(0, 400, 'THIRD TABLE'), L(0, 390, 'Die Outcome'), L(0, 380, 'gamma row three here'),
      E(1, 650, 'COL A'), L(1, 640, 'delta row four here'),
      E(2, 650, 'COL B'), L(2, 640, 'epsilon row five here'),
      E(3, 701, 'BANNER TABLE'), L(3, 690, 'Roll Result'), L(3, 680, 'eta row seven here'),
      E(4, 702, 'DOSE TABLE'), L(4, 690, 'Tiny A single dose counts.'), L(4, 680, 'Little Four doses count'),
      E(5, 703, 'ABBR TABLE'), L(5, 690, 'Mod. Carac. Aug.'), L(5, 680, 'theta row eight here'),
    ],
  }]
  const md = [
    '*Pages PDF 10-10*',
    '#### **FIRST TABLE**', '| Roll | Result |\n|---|---|\n| alpha row one here | x |',
    '#### **UNTITLED**', '| Roll | Result |\n|---|---|\n| zeta row six here | z |',
    '#### **SECOND TABLE**', '| Roll | Result |\n|---|---|\n| beta row two here | y |',
    '### **SIDEBAR**', 'Sidebar prose runs along here',
    'Intro prose line.', '| Die | Outcome |\n|---|---|\n| gamma row three here | w |',
    'Before columns prose.', '| Name | Other |\n|---|---|\n| delta row four here | epsilon row five here |',
    'Banner prose.', '| | BANNER TABLE |\n|---|---|\n| Roll | Result |\n| eta row seven here | e |',
    'Dose prose.', '| DOSE TABLE | |\n|---|---|\n| Tiny | A single dose counts. |\n| Little | Four doses count |',
    'Abbr prose.', '| ABBR TABLE | | |\n|---|---|---|\n| Mod. | Carac. | Aug. |\n| theta row eight here | t | u |',
  ].flatMap((l, i) => (i ? ['', ...l.split('\n')] : [l]))
  const livre = (lignes) => classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT)
  const { sites: ss, titres: ts } = livre(md)
  const forme = (t) => ts.find((x) => x.texte === t).forme
  assert.deepEqual(['FIRST TABLE', 'SECOND TABLE', 'SIDEBAR', 'BANNER TABLE', 'DOSE TABLE'].map(forme), ['L', 'L', 'ok', 'L', 'L'], 'tables voisines, Δy 1 : légendes chacune')
  const s = ss.find((x) => x.titre === 'THIRD TABLE')
  assert.deepEqual([s?.forme, s?.cible, s?.ligneTitre, s?.ligneLegende], ['legende-absente', '001:27', undefined, '**THIRD TABLE**'])
  const l = (t) => { const x = ss.find((y) => y.titre === t); return [x?.forme, x?.site, x?.ligneLegende, x?.enTete] }
  assert.deepEqual(l('FIRST TABLE'), ['L', '001:3', '**FIRST TABLE**', undefined])
  assert.deepEqual(l('BANNER TABLE'), ['L', '001:39', '**BANNER TABLE**', 'rangee'])
  assert.deepEqual(l('DOSE TABLE'), ['L', '001:46', '**DOSE TABLE**', 'vide'], 'une rangée dont une cellule est une phrase n’est pas un en-tête')
  assert.deepEqual(l('ABBR TABLE'), ['L', '001:53', '**ABBR TABLE**', 'rangee'], 'une abréviation (« Mod. ») n’est pas une phrase')
  assert.equal(ss.some((x) => x.forme === "S'" && x.famille === 'tableau'), false)
  assert.deepEqual([forme('COL A'), forme('COL B')], ['colonne', 'colonne'])
  assert.deepEqual(ss.filter((x) => x.titre === 'COL A' || x.titre === 'COL B').map((x) => x.forme), ['colonne', 'colonne'], 'deux titres sur une ligne de base : en-têtes de colonne, rapportés, aucune légende posée')

  const { textes, refus } = reparerLivre(new Map([['001', md.join('\n')]]), ss)
  assert.deepEqual(refus, [])
  const repare = textes.get('001').split('\n')
  const apres = livre(repare)
  assert.deepEqual(['FIRST TABLE', 'SECOND TABLE', 'THIRD TABLE', 'BANNER TABLE', 'DOSE TABLE'].map((t) => apres.titres.find((x) => x.texte === t).forme), ['ok', 'ok', 'ok', 'ok', 'ok'])
  assert.deepEqual(apres.sites.filter((x) => x.famille === 'tableau').map((x) => x.forme), ['colonne', 'colonne'], 'rejouée sur le livre réparé, la sonde ne relève plus aucune légende')
  const bloc = (t) => { const i = repare.indexOf(`**${t}**`); return repare.slice(i, i + 5) }
  assert.deepEqual(bloc('FIRST TABLE'), ['**FIRST TABLE**', '', '| Roll | Result |', '|---|---|', '| alpha row one here | x |'])
  assert.deepEqual(bloc('BANNER TABLE'), ['**BANNER TABLE**', '', '| Roll | Result |', '|------|--------|', '| eta row seven here | e |'])
  assert.deepEqual(bloc('DOSE TABLE'), ['**DOSE TABLE**', '', '|   |   |', '|---|---|', '| Tiny | A single dose counts. |'])
})

test('#1739 : la LÉGENDE `**X**` d’une table borne la section que corrobore une clé de corps (CRB 038 p.176, LEG CRITICAL WOUNDS)', () => {
  const E = (colonne, y0, texte) => L(colonne, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [E(0, 700, 'B TABLE'), L(0, 690, 'Roll Result'), L(0, 680, 'beta row two here')] }]
  const md = ['*Pages PDF 10-10*', '', '**A TABLE**', '', '| Roll | Result |', '|---|---|', '| alpha row one here | x |', '', '**B TABLE**', '', '| Roll | Result |', '|---|---|', '| beta row two here | y |']
  const { titres: ts } = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  const b = ts.find((x) => x.texte === 'B TABLE')
  assert.deepEqual([b.forme, b.corps.l + 1], ['ok', 11])
})

test('#1739 : table lue colonne par colonne (CRB p.175, BODY CRITICAL WOUNDS) — le corps se lit en RANGÉES sous le titre', () => {
  const E = (colonne, y0, texte) => L(colonne, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [L(0, 690, 'd100'), L(0, 680, 'alpha row here'), L(1, 690, 'Description Wounds'), E(2, 700, 'BODY TABLE'), L(2, 690, '0'), L(2, 680, '1')] }]
  const md = ['*Pages PDF 10-10*', '', '# **BODY TABLE**', '', '| d100 | Description | Wounds |', '|---|---|---|', '| alpha row here | x | 1 |']
  const { titres: ts } = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  const b = ts.find((x) => x.texte === 'BODY TABLE')
  assert.deepEqual([b.famille, b.forme, b.corps?.l + 1], ['tableau', 'L', 5])
})

test('#1739 : une ligne de titre de la clé du titre n’est jamais son propre corps (CRB p.39, 015:43 CLASS TRAPPINGS) — le corps est l’en-tête de la table, la légende portée en titre est L', () => {
  const E = (colonne, y0, texte) => L(colonne, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [E(0, 700, 'CLASS TRAPPINGS'), L(0, 690, 'Class Trappings'), L(0, 680, 'Academics Sling Bag with Kit')] }]
  const md = ['*Pages PDF 10-10*', '', '# **CLASS TRAPPINGS**', '', '| Class | Trappings |', '|---|---|', '| Academics | Sling Bag with Kit |']
  const livre = (lignes) => classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes }], GABARIT)
  const { titres: ts, sites: ss } = livre(md)
  const t = ts.find((x) => x.texte === 'CLASS TRAPPINGS')
  assert.deepEqual([t.famille, t.forme, t.corps?.l + 1], ['tableau', 'L', 5])
  assert.deepEqual(ss.map((s) => [s.forme, s.site, s.ligneLegende]), [['L', '001:3', '**CLASS TRAPPINGS**']])
  const repare = livre(reparerLivre(new Map([['001', md.join('\n')]]), ss).textes.get('001').split('\n'))
  assert.deepEqual([repare.titres[0].forme, repare.sites], ['ok', []], 'réparée en légende `**X**`, la sonde la voit à sa place : la légende n’est pas non plus son propre corps')
})

/** Une page de CARRIÈRE forgée (CRB p.45) : « Career Path » en capitales, puis les niveaux (glyphe de tête +
 *  intertitre), chacun suivi de ses libellés. */
const NIVEAU = (y0, texte) => ({ colonne: 1, x0: 302, y0, texte: `h ${texte}`, spans: [{ texte: 'h', police: 'crossbatstfb', taille: 7 }, { texte: ` ${texte}`, police: 'ACaslonPro-Bold', taille: 10 }] })
const CARRIERE = [{
  page: 10,
  lignes: [
    L(1, 400, 'Career Path', 'CaslonAntique-Bold-SC700', 16), NIVEAU(385, 'Aide — Silver 1'),
    L(1, 370, 'Skills: Bribery, Charm, Evaluate, Gossip'), L(1, 357, 'Talents: Beneath Notice, Etiquette'),
    NIVEAU(300, 'Adviser — Silver 3'), L(1, 285, 'Skills: Consume Alcohol, Cool, Gossip'),
  ],
}]
const carriere = (md) => classer(CARRIERE, [{ nom: '018 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
/** L'exemple légendé d'une autre page porte le même « ## **Career Path** », LIBRE : un leurre, loin. */
const LEURRE = ['## **Career Path**', '', 'Example prose one.', '', 'Example prose two.', '', 'Example prose three.', '', 'Example prose four.', '']
const AIDE = ['**Skills:** Bribery, Charm, Evaluate, Gossip', '', '**Talents:** Beneath Notice, Etiquette', '']
const ADVISER = ['#### **Adviser — Silver 3**', '', '**Skills:** Consume Alcohol, Cool, Gossip']
const lieu = (r, t) => { const x = r.titres.find((u) => u.texte === t); return [x.forme, x.titreMd ? `018:${x.titreMd.l + 1}` : null, x.corps ? `018:${x.corps.l + 1}` : null] }

test('#1739 : un titre MIGRÉ se lit à son occurrence LIBRE la plus PROCHE de son corps, jamais à la première du fichier (CRB 018 : 98↔100, paire Career Path + Aide déplacée, occurrence après le corps)', () => {
  const enPlace = carriere([...LEURRE, '## **Career Path**', '', '#### **Aide — Silver 1**', '', ...AIDE, ...ADVISER])
  assert.deepEqual([lieu(enPlace, 'Career Path')[0], lieu(enPlace, 'Aide — Silver 1')[0]], ['ok', 'ok'])
  assert.deepEqual(enPlace.sites.filter((s) => s.famille !== 'paragraphe'), [])

  const permute = carriere([...LEURRE, '#### **Aide — Silver 1**', '', '## **Career Path**', '', ...AIDE, ...ADVISER])
  assert.deepEqual(lieu(permute, 'Career Path'), ['M', '018:13', '018:15'])
  assert.deepEqual(lieu(permute, 'Aide — Silver 1'), ['M', '018:11', '018:15'])
  assert.deepEqual(permute.sites.filter((s) => s.forme === 'M').map((s) => [s.titre, s.site, s.cible]), [['Career Path', '018:13', '018:15'], ['Aide — Silver 1', '018:11', '018:15']])

  const paire = carriere([...LEURRE, ...AIDE, '## **Career Path**', '', '#### **Aide — Silver 1**', '', ...ADVISER])
  assert.deepEqual(lieu(paire, 'Career Path'), ['M', '018:15', '018:11'])
  assert.deepEqual(lieu(paire, 'Aide — Silver 1'), ['M', '018:17', '018:11'])

  const apres = carriere([...LEURRE, '#### **Aide — Silver 1**', '', AIDE[0], '', '## **Career Path**', '', ...AIDE.slice(2), ...ADVISER])
  assert.deepEqual(lieu(apres, 'Aide — Silver 1'), ['ok', '018:11', '018:13'])
  assert.deepEqual(lieu(apres, 'Career Path'), ['M', '018:15', '018:11'], 'l’occurrence après le corps, à 4 lignes, l’emporte sur le leurre à 10')
})

test('#1739 : un span de la police de tête à taille MOINDRE appartient au run du titre (CRB p.7, « 5TH ») — le titre est entier, à sa place, rien n’est posé (régression 004:73)', () => {
  const E = (y0, texte) => L(1, y0, texte, 'CaslonAntique-Bold', 15)
  const roleplay = { colonne: 1, x0: 302, y0: 529.3, texte: 'ROLEPLAY 5TH EDITION', spans: [{ texte: 'ROLEPLAY 5', police: 'CaslonAntique-Bold', taille: 15 }, { texte: 'TH', police: 'CaslonAntique-Bold', taille: 8.7 }, { texte: 'EDITION', police: 'CaslonAntique-Bold', taille: 15 }] }
  const pages = [{ page: 10, lignes: [E(543.3, 'WARHAMMER FANTASY'), roleplay, L(1, 515, 'Warhammer Fantasy Roleplay is a venerable game, and this')] }]
  const md = ['*Pages PDF 10-10*', '', '#### **WARHAMMER FANTASY ROLEPLAY 5TH EDITION**', '', '**Warhammer Fantasy Roleplay** is a venerable game, and this is its fifth edition.']
  const { titres: ts, sites: ss } = classer(pages, [{ nom: '004 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  assert.deepEqual(ts.map((t) => [t.texte, t.forme]), [['WARHAMMER FANTASY ROLEPLAY 5TH EDITION', 'ok']])
  assert.deepEqual(ss, [])
})

test('#1739 : glyphe d’ORNEMENT (`gabarit.glyphes`) — en TÊTE de ligne, hors du titre et des clés ; en MILIEU de ligne, il reste (CRB p.43 « three marked with h »)', () => {
  const milieu = { colonne: 0, x0: 58, y0: 690, texte: 'three marked with h, one marked on green', spans: [{ texte: 'three marked with', police: 'ACaslonPro-Regular', taille: 9 }, { texte: 'h', police: 'crossbatstfb', taille: 7 }, { texte: ', one marked on green', police: 'ACaslonPro-Regular', taille: 9 }] }
  assert.equal(sansGlyphe(milieu, GABARIT), 'three marked with h, one marked on green')
  assert.equal(sansGlyphe(NIVEAU(385, 'Recruit — Brass 5'), GABARIT), 'Recruit — Brass 5')
  const pages = [{ page: 10, lignes: [T(0, 700, 'Omicron'), milieu, NIVEAU(600, 'Recruit — Brass 5'), L(0, 590, 'Skills: Athletics, Climb, Cool, Dodge')] }]
  const md = ['### **Omicron**', '', 'three marked with h, one marked on green', '', '#### **Recruit — Brass 5**', '', '**Skills:** Athletics, Climb, Cool, Dodge']
  const { titres: ts, sites: ss } = classer(pages, [{ nom: '018 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  assert.deepEqual(ts.map((t) => [t.texte, t.famille, t.forme]), [['Omicron', 'entree', 'ok'], ['Recruit — Brass 5', 'intertitre', 'ok']])
  assert.deepEqual(ss, [])
})

test('#1739 : présent ≠ absent — un titre de table sans place prouvée dont la clé est une ligne de titre LIBRE de sa page est `place-non-prouvee`, jamais S′ ; son corps CANDIDAT est rapporté, ni gardé ni réservé (CRB p.216, 063:11 CHIEF GODS)', () => {
  const E = (colonne, y0, texte) => L(colonne, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [E(0, 700, 'CHIEF GODS'), L(0, 690, 'Sphere'), L(0, 680, 'Warriors, courage')] }]
  const md = ['*Pages PDF 10-10*', '', '### **CHIEF GODS**', '', '#### **Dwarfs**', '', '| God | Sphere |', '|---|---|', '| Grimnir | Warriors, courage |']
  const { titres: ts, sites: ss } = classer(pages, [{ nom: '063 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  const t = ts.find((x) => x.texte === 'CHIEF GODS')
  assert.deepEqual([t.forme, t.corps, t.corpsCandidat?.l + 1], ['place-non-prouvee', null, 9])
  assert.deepEqual(ss.map((s) => [s.forme, s.corpsCandidat, s.cible ?? null]), [['place-non-prouvee', '063:9', null]])
  assert.deepEqual(reparerLivre(new Map([['063', md.join('\n')]]), ss).appliques, [])
})

test('#1739 : présent ≠ absent — le corps CANDIDAT d’un `place-non-prouvee` n’est pas réservé : le titre qui le suit au PDF s’y lit à sa place', () => {
  const E = (colonne, y0, texte) => L(colonne, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [E(0, 700, 'CHIEF GODS'), L(0, 690, 'Grimnir warriors and courage'), T(0, 600, 'Grimnir'), L(0, 590, 'Grimnir warriors and courage')] }]
  const md = ['*Pages PDF 10-10*', '', '### **CHIEF GODS**', '', 'Intro prose.', '', '### **Grimnir**', '', 'Grimnir warriors and courage']
  const { titres: ts } = classer(pages, [{ nom: '063 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  assert.deepEqual(ts.map((t) => [t.texte, t.forme, t.corps ? t.corps.l + 1 : null, t.corpsCandidat ? t.corpsCandidat.l + 1 : null]), [['CHIEF GODS', 'place-non-prouvee', null, 9], ['Grimnir', 'ok', 9, null]])
})

test('#1739 : rôle de glyphe (`gabarit.glyphes[].role`) — un glyphe `titre` suivi de la POLICE d’intertitre, à toute taille, ouvre un intertitre (CRB p.76 « Scion — Gold 1 », Bold/9) ; un glyphe `puce` jamais', () => {
  const tete = (police, y0, texte) => ({ colonne: 1, x0: 302, y0, texte: `x ${texte}`, spans: [{ texte: 'x', police, taille: 7 }, { texte: ` ${texte}`, police: 'ACaslonPro-Bold', taille: 9 }] })
  const pages = [{ page: 10, lignes: [tete('crossbatstfb', 600, 'Scion — Gold 1'), L(1, 590, 'Skills: Charm, Gossip, Leadership'), tete('onlyskulls', 500, 'Bullet bold words'), L(1, 490, 'Bullet prose runs on here')] }]
  const md = ['*Pages PDF 10-10*', '', '#### **Scion — Gold 1**', '', '**Skills:** Charm, Gossip, Leadership', '', '**Bullet bold words**', '', 'Bullet prose runs on here']
  const { titres: ts } = classer(pages, [{ nom: '018 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  assert.deepEqual(ts.map((t) => [t.texte, t.famille, t.forme]), [['Scion — Gold 1', 'intertitre', 'ok']])
})

test('#1739 : titre SUIVI d’un titre — une ligne SANS LETTRE entre eux (chiffres d’appel, CRB p.43) ne les sépare pas : « Career Path » se lit par le niveau qui le suit, à sa place', () => {
  const appels = [{ ...CARRIERE[0], lignes: [CARRIERE[0].lignes[0], L(1, 393, '1 2'), ...CARRIERE[0].lignes.slice(1)] }]
  const r = classer(appels, [{ nom: '018 - Forge.md', page: 10, pageFin: 10, lignes: ['## **Career Path**', '', '#### **Aide — Silver 1**', '', ...AIDE, ...ADVISER] }], GABARIT)
  assert.deepEqual([lieu(r, 'Career Path'), lieu(r, 'Aide — Silver 1')[0]], [['ok', '018:1', '018:3'], 'ok'])
})

/** PLAFOND du stock — il vit ICI, jamais dans la sonde ni dans la lib (`guards/lib/stock.mjs`). */
const PLAFOND = 367
/** Le PDF du CRB, ou `null` là où il n'est pas (aucun dépôt ne suit un PDF : la CI ne l'a pas). */
const PDF_CRB = (() => { try { return pdfDe('core-rulebook-5e') } catch { return null } })()
/** Les boîtes du PDF du CRB, lues UNE fois pour les tests qui en ont besoin. */
let boitesCrb = null
const boitesDuCrb = () => (boitesCrb ??= boitesDuPdf('core-rulebook-5e'))

test('#1820 le stock de la sonde est PLAFONNÉ : il ne décroît que quand un site disparaît', () => {
  assert.ok(readStock(STOCK_PATH).length <= PLAFOND, `stock ${readStock(STOCK_PATH).length} > plafond ${PLAFOND}`)
})

test('#1820 stock COMMITTÉ de la sonde (CRB) : chaque site émis hors `colonne` y a son entrée, aucune entrée n’est soldée', { skip: PDF_CRB ? false : 'PDF du CRB absent de cet arbre' }, () => {
  const { neuves, perimees } = ecartDuStock(sondeDuLivre('core-rulebook-5e', boitesDuCrb()), readStock(STOCK_PATH))
  assert.deepEqual(neuves, [], `site(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) soldée(s) :\n${perimees.join('\n')}`)
})

test('#1739 : présent ≠ absent — un corps CANDIDAT trouvé par une clé de RANGÉES (table lue colonne par colonne) n’est jamais rapporté ; seul le candidat d’une clé de CORPS l’est (CRB p.184 COMPLETE CONDITION LIST)', () => {
  const E = (colonne, y0, texte) => L(colonne, y0, texte, 'CaslonAntique-Bold', 15)
  const pages = [{ page: 10, lignes: [E(0, 700, 'CONDITIONS'), L(0, 690, 'Ablaze'), L(1, 690, 'Bleeding')] }]
  const md = ['*Pages PDF 10-10*', '', '### **CONDITIONS**', '', 'Intro prose.', '', '### **Other**', '', 'Ablaze Bleeding and more']
  const { titres: ts, sites: ss } = classer(pages, [{ nom: '041 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  const t = ts.find((x) => x.texte === 'CONDITIONS')
  assert.deepEqual([t.forme, t.corps, t.corpsCandidat], ['place-non-prouvee', null, null])
  assert.deepEqual(ss.map((s) => [s.forme, s.titre, s.corpsCandidat]), [['place-non-prouvee', 'CONDITIONS', null]])
})

test('#1739 : glyphe FUITÉ dans le `.md` — un caractère d’un glyphe `titre` (`gabarit.glyphes[].caracteres`) suivi du titre en gras seul est ce titre, PRÉSENT : `glyphe-fuite`, jamais S′ ni M ; réparé en ligne de titre au niveau du frère, le glyphe seul mot retiré, puis à sa place (CRB p.76, 018 d’origin/main « h **Scion — Gold 1** »)', () => {
  const niveau9 = (y0, texte) => ({ colonne: 1, x0: 302, y0, texte: `h ${texte}`, spans: [{ texte: 'h', police: 'crossbatstfb', taille: 7 }, { texte: ` ${texte}`, police: 'ACaslonPro-Bold', taille: 9 }] })
  const pages = [{ page: 10, lignes: [L(1, 400, 'Career Path', 'CaslonAntique-Bold-SC700', 16), niveau9(385, 'Scion — Gold 1'), L(1, 370, 'Skills: Consume Alcohol, Gamble, Gossip'), NIVEAU(300, 'Noble — Gold 2'), L(1, 285, 'Skills: Charm, Gossip, Leadership')] }]
  const md = ['## **Career Path**', '', 'h **Scion — Gold 1**', '', '**Skills:** Consume Alcohol, Gamble, Gossip', '', '#### **Noble — Gold 2**', '', '**Skills:** Charm, Gossip, Leadership']
  const sonder = (lignesMd) => classer(pages, [{ nom: '018 - Forge.md', page: 10, pageFin: 10, lignes: lignesMd }], GABARIT)
  const { titres: ts, sites: ss } = sonder(md)
  assert.deepEqual(ts.map((t) => [t.texte, t.forme]), [['Career Path', 'ok'], ['Scion — Gold 1', 'glyphe-fuite'], ['Noble — Gold 2', 'ok']])
  assert.deepEqual(ss.map((s) => [s.forme, s.site, s.ligneMd, s.glyphe, s.ligneTitre]), [['glyphe-fuite', '018:3', 'h **Scion — Gold 1**', 'h', '#### **Scion — Gold 1**']])
  const avant = new Map([['018', md.join('\n')]])
  const r = reparerLivre(avant, ss)
  assert.deepEqual([r.appliques, r.refus, infidelite(avant, r.textes, ss)], [['glyphe-fuite 018:3 « Scion — Gold 1 » = « #### **Scion — Gold 1** »'], [], null])
  assert.equal(r.textes.get('018').split('\n')[2], '#### **Scion — Gold 1**')
  assert.match(infidelite(avant, r.textes, []), /mots retirés h×1/, 'le glyphe retiré est COMPTÉ : sans son site, la fidélité refuse')
  const apres = sonder(r.textes.get('018').split('\n'))
  assert.deepEqual([apres.titres.map((t) => t.forme), apres.sites], [['ok', 'ok', 'ok'], []])
  assert.equal(glypheFuite('0 **Scion — Gold 1**', GABARIT), null, 'un caractère de PUCE n’est pas un glyphe de titre')
})

test('#1739 : titre SUIVI d’un titre — les lignes SANS LETTRE se sautent des DEUX côtés : au `.md` aussi, le titre qui précède le titre du suivant par-dessus une table de chiffres est à sa place, jamais M ni S′', () => {
  const pages = [{ page: 10, lignes: [T(0, 700, 'Alpha'), L(0, 690, '7'), T(0, 600, 'Beta'), L(0, 590, 'Beta body words here now')] }]
  const md = ['### **Alpha**', '', '| 7 |', '', '### **Beta**', '', 'Beta body words here now']
  const { titres: ts, sites: ss } = classer(pages, [{ nom: '001 - Forge.md', page: 10, pageFin: 10, lignes: md }], GABARIT)
  assert.deepEqual(ts.map((t) => [t.texte, t.forme, t.titreMd ? t.titreMd.l + 1 : null]), [['Alpha', 'ok', 1], ['Beta', 'ok', 5]])
  assert.deepEqual(ss, [])
})

/** Le lot qui a restauré Dog, Griffon, Varghulf et Skeleton : ses `.md` d'AVANT, lus dans l'historique git. */
const AVANT_AF2A = 'af2a08ab1^'
const historique = spawnSync('git', ['cat-file', '-e', AVANT_AF2A], { encoding: 'utf8' }).status === 0

test('#1739 la RÉPARATION ne contredit pas la SONDE : rejouée depuis les `.md` d’af2a08ab1^ (CRB 105, 106, 108), les S′ prouvés par COMPTAGE à côté de l’en-tête de profil (Dog, Griffon, Varghulf) et le F de Skeleton sont APPLIQUÉS, sans aucun refus', { skip: !PDF_CRB ? 'PDF du CRB absent de cet arbre' : !historique ? `${AVANT_AF2A} absent de l’historique` : false }, () => {
  const id = 'core-rulebook-5e'
  const dir = String(livreExtraitDe(id).dir).split('\\').join('/').replace(/\/$/, '')
  const liste = decoupeDe(id)
  const texte = (nom) => (/^10[568] /.test(nom)
    ? spawnSync('git', ['show', `${AVANT_AF2A}:${dir}/${nom}`], { encoding: 'utf8', maxBuffer: 1e8 }).stdout
    : readText(`${dir}/${nom}`))
  const textes = new Map(nomsDeLaListe(liste).map((nom) => [nom.slice(0, 3), texte(nom)]))
  const fichiers = nomsDeLaListe(liste).map((nom, i) => ({ nom, page: liste[i].page, pageFin: liste[i].pageFin, lignes: textes.get(nom.slice(0, 3)).split('\n') }))
  const pages = boitesDuCrb().map((p) => ({ page: p.page, lignes: lignes(p.boites), cercles: p.cercles ?? [] }))
  const { sites } = classer(pages, fichiers, gabaritTitreDe(id))
  const r = reparerLivre(textes, sites)
  assert.deepEqual(r.refus, [])
  assert.deepEqual(r.appliques.filter((a) => /« (dog|griffon|varghUlf|skeleTon) »/.test(a)), [
    "S' --- → 105:43 « dog » = « # **Dog** »",
    "S' --- → 106:251 « griffon » = « # **Griffon** »",
    'F 108:93 → 108:43 « skeleTon » = « # **Skeleton** »',
    "S' --- → 108:363 « varghUlf » = « # **Varghulf** »",
  ])
})
