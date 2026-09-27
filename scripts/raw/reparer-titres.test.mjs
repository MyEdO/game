// Banc de la RÉPARATION des titres (`reparer-titres.mjs`, #1739) : chaque forme de la sonde appliquée à
// un livre forgé de deux fichiers, les blancs du bloc posé, le refus d'un site périmé, la fidélité
// au multi-ensemble des mots du LIVRE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { infidelite, reparerLivre } from './reparer-titres.mjs'

const A = [
  'Intro.', '',
  '**Gamma** Gamma body.', '',
  '### **Beta**', '',
  '**Alpha** Beta body.', '',
  'Alpha body.', '',
  '**Iota**', '',
  'Iota body.', '',
  '**6. X** Delta body.', '',
  '### **Theta**', '',
  'Kappa body.', '',
  '### **Omega**', '',
  'Omega body.', '',
  '### **Zeta**', '',
  'Zeta body.',
].join('\n')
const B = ['*Pages*', '', '**Surprised** Foreign body.', ''].join('\n')
const TEXTES = new Map([['001', A], ['002', B]])
const SITES = [
  { forme: 'S', site: '001:3', titreMd: '**Gamma**', ligneTitre: '### **Gamma**', titre: 'Gamma' },
  { forme: 'F', site: '001:7', titreMd: '**Alpha**', cible: '001:9', ligneTitre: '### **Alpha**', titre: 'Alpha' },
  { forme: 'B', site: '001:11', titreMd: '**Iota**', ligneTitre: '### **Iota**', titre: 'Iota' },
  { forme: 'doublon', site: '001:15', texteMd: '**6. X**', titre: 'Delta' },
  { forme: 'M', site: '001:17', titreMd: '### **Theta**', cible: '001:19', ligneTitre: '### **Theta**', titre: 'Theta' },
  { forme: "S'", site: null, cible: '001:13', ligneTitre: '### **Restored**', titre: 'Restored' },
  { forme: 'O', site: '001:25', titreMd: '### **Zeta**', devant: '001:21', titre: 'Zeta' },
  { forme: 'F', site: '002:3', titreMd: '**Surprised**', cible: '001:23', ligneTitre: '### **Surprised**', titre: 'Surprised' },
  { forme: 'N', site: '001:5', titre: 'Beta' },
]

test('chaque forme appliquée : S détaché, F/M retiré et posé devant son corps (même entre fichiers), B promu, S′ inséré, O déplacé, débris retiré', () => {
  const { textes, refus, appliques } = reparerLivre(TEXTES, SITES)
  assert.deepEqual(refus, [])
  assert.equal(appliques.length, 8)
  assert.equal(textes.get('001'), [
    'Intro.', '',
    '### **Gamma**', '', 'Gamma body.', '',
    '### **Beta**', '', 'Beta body.', '',
    '### **Alpha**', '', 'Alpha body.', '',
    '### **Iota**', '',
    '### **Restored**', '', 'Iota body.', '',
    'Delta body.', '',
    '### **Theta**', '', 'Kappa body.', '',
    '### **Zeta**', '', 'Zeta body.', '',
    '### **Omega**', '',
    '### **Surprised**', '', 'Omega body.',
  ].join('\n'))
  assert.equal(textes.get('002'), ['*Pages*', '', 'Foreign body.', ''].join('\n'))
})

test('fidélité au LIVRE : ajoutés = les mots des S′, retirés = ceux des débris ; un déplacement entre fichiers se compense', () => {
  const { textes } = reparerLivre(TEXTES, SITES)
  assert.equal(infidelite(TEXTES, textes, SITES), null)
  const trafique = new Map(textes).set('002', `${textes.get('002')}mot\n`)
  assert.match(infidelite(TEXTES, trafique, SITES), /mots ajoutés .*mot×1/)
})

test('un site PÉRIMÉ (ligne qui ne porte plus ce que la sonde a vu) est REFUSÉ, nommé — rejeu d’un JSON sur un livre réparé', () => {
  const { textes } = reparerLivre(TEXTES, SITES)
  const { refus } = reparerLivre(textes, SITES)
  assert.ok(refus.some((r) => /^001:3 S « Gamma » : la ligne ne s'ouvre plus sur « \*\*Gamma\*\* »/.test(r)), refus.join('\n'))
  assert.ok(refus.some((r) => /S′ « Restored » : « ### \*\*Restored\*\* » déjà dans le fichier/.test(r)))
})

test('sans site, rien ne bouge : le texte réparé est rendu tel quel', () => {
  const { textes } = reparerLivre(TEXTES, SITES)
  const r = reparerLivre(textes, [])
  assert.deepEqual([...r.textes], [...textes])
  assert.deepEqual([r.refus, r.appliques, r.recolles], [[], [], []])
})

const P_TEXTE = new Map([['107', ['see page 356', '', '**Infected:** Wounded opponents must take an', '', '**Easy (+4 SL)**', '', '**Endurance** Test to avoid a Festering Wound', '', '**Night Vision:** See clearly', ''].join('\n')]])
const P_SITES = [
  { forme: 'P', site: '107:5', avec: '107:3', ligneMd: '**Easy (+4 SL)**', titre: 'Easy (+4 SL)' },
  { forme: 'P', site: '107:7', avec: '107:5', ligneMd: '**Endurance** Test to avoid a Festering Wound', titre: 'Endurance Test to avoid a Festering Wound' },
]

test('P (CRB 107 l.147-151) : les sites de la sonde recollés de la plus basse à la plus haute — trois morceaux, un paragraphe', () => {
  const { textes, refus, recolles } = reparerLivre(P_TEXTE, P_SITES)
  assert.deepEqual(refus, [])
  assert.deepEqual(recolles, [{ nnn: '107', ligne: 7, avec: 5 }, { nnn: '107', ligne: 5, avec: 3 }])
  assert.equal(textes.get('107'), ['see page 356', '', '**Infected:** Wounded opponents must take an **Easy (+4 SL) Endurance** Test to avoid a Festering Wound', '', '**Night Vision:** See clearly', ''].join('\n'))
  assert.equal(infidelite(P_TEXTE, textes, P_SITES), null)
})

test('P PÉRIMÉ : rejoué sur le livre recollé, chaque site est REFUSÉ, nommé, rien ne bouge', () => {
  const { textes } = reparerLivre(P_TEXTE, P_SITES)
  const r = reparerLivre(textes, P_SITES)
  assert.deepEqual(r.refus, ['107:7 P : la ligne n\'est plus « **Endurance** Test to avoid a Festering Wound »', '107:5 P : la ligne n\'est plus « **Easy (+4 SL)** »'])
  assert.deepEqual(r.textes, textes)
})

test('S soudé DANS le gras de l’étiquette, blanc de tête (CRB 018 l.108) : le titre détaché, le gras refermé des deux côtés', () => {
  const avant = new Map([['018', ['Read/Write **Trappings:** Writing Kit', '', ' **Adviser — Silver 3 Skills:** Consume Alcohol, Cool', ''].join('\n')]])
  const sites = [{ forme: 'S', site: '018:3', titreMd: '**Adviser — Silver 3', ligneTitre: '#### **Adviser — Silver 3**', titre: 'Adviser — Silver 3' }]
  const { textes, refus } = reparerLivre(avant, sites)
  assert.deepEqual(refus, [])
  assert.equal(textes.get('018'), ['Read/Write **Trappings:** Writing Kit', '', '#### **Adviser — Silver 3**', '', '**Skills:** Consume Alcohol, Cool', ''].join('\n'))
  assert.equal(infidelite(avant, textes, sites), null)
})

const TEXTE_018 = new Map([['018', [
  '#### **SOLDIER ADVANCE SCHEME** 2', '',
  '- **Recruit Brass 5** 1 6',
  '- **Skills:** Athletics, *Melee (Any One)*, Melee (Basic) 3', '',
  '**Talents:** Beneath Notice, Gregarious,', '',
  'Read/Write **Trappings:** Writing', '',
  'Kit', '',
].join('\n')]])
const SITES_018 = [
  { forme: 'A', site: '018:1', jeton: '2', titre: '2' },
  { forme: 'A', site: '018:3', jeton: '1', titre: '1' },
  { forme: 'A', site: '018:3', jeton: '6', titre: '6' },
  { forme: 'A', site: '018:4', jeton: '3', titre: '3' },
  { forme: 'T', site: '018:3', avant: 'Recruit', apres: 'Brass', titre: 'Recruit — Brass 5' },
  { forme: 'G', site: '018:4', texteMd: '*Melee (Any One)*', titre: 'Melee (Any One)' },
  { forme: 'P', site: '018:10', avec: '018:8', ligneMd: 'Kit', etiquette: null, titre: 'Kit' },
  { forme: 'P', site: '018:8', avec: '018:6', ligneMd: 'Read/Write **Trappings:** Writing', etiquette: '**Trappings:**', titre: 'Read/Write' },
]

test('A, T, G, P (CRB 018 p.43-46) : appels retirés, tiret rendu, gras italique rendu, ligne coupée recollée et coupée à l’étiquette', () => {
  const { textes, refus } = reparerLivre(TEXTE_018, SITES_018)
  assert.deepEqual(refus, [])
  assert.equal(textes.get('018'), [
    '#### **SOLDIER ADVANCE SCHEME**', '',
    '- **Recruit — Brass 5**',
    '- **Skills:** Athletics, ***Melee (Any One)***, Melee (Basic)', '',
    '**Talents:** Beneath Notice, Gregarious, Read/Write', '',
    '**Trappings:** Writing Kit', '',
  ].join('\n'))
  assert.equal(infidelite(TEXTE_018, textes, SITES_018), null)
  assert.match(infidelite(TEXTE_018, textes, SITES_018.filter((s) => s.forme !== 'A')), /mots retirés 1×1 2×1 3×1 6×1/)
})

test('A, T, G PÉRIMÉS : rejoués sur le livre réparé, chacun est REFUSÉ, nommé', () => {
  const { textes } = reparerLivre(TEXTE_018, SITES_018)
  const { refus } = reparerLivre(textes, SITES_018.filter((s) => s.forme !== 'P'))
  assert.equal(refus.length, 5)
  assert.ok(refus.every((r) => / : la ligne ne porte plus ce que la sonde a vu$/.test(r)), refus.join('\n'))
})

const TEXTE_060 = new Map([['060', [
  '**Seat of Power:** Middenheim, Middenland **Head of the Cult:** Jarrick Valgeir, Ar-Ulric', '',
  '**Primary Orders:** Order of the Howling Wolf, Order of the', '',
  'White Wolf **Major Festivals:** Campaign Start, Hochwinter, Campaign End **Important Holy Texts:** *Liber Lupus*, *Teutognengeschichte*, *The* ', '',
  '*Ulric Creed* **Common Holy Symbols:** White wolves',
].join('\n')]])
const SITES_060 = [
  { forme: 'E', site: '060:1', etiquette: '**Head of the Cult:**', titre: 'Head of the Cult:' },
  { forme: 'E', site: '060:5', etiquette: '**Important Holy Texts:**', titre: 'Important Holy Texts:' },
  { forme: 'P', site: '060:5', avec: '060:3', ligneMd: TEXTE_060.get('060').split('\n')[4], etiquette: '**Major Festivals:**', titre: 'White Wolf' },
  { forme: 'P', site: '060:7', avec: '060:5', ligneMd: TEXTE_060.get('060').split('\n')[6], etiquette: '**Common Holy Symbols:**', titre: 'Ulric Creed' },
]

test('E, P (CRB 060 p.213) : libellés soudés coupés, paragraphes recollés, emphase `*The*` + `*Ulric Creed*` refaite une', () => {
  const { textes, refus } = reparerLivre(TEXTE_060, SITES_060)
  assert.deepEqual(refus, [])
  assert.equal(textes.get('060'), [
    '**Seat of Power:** Middenheim, Middenland', '',
    '**Head of the Cult:** Jarrick Valgeir, Ar-Ulric', '',
    '**Primary Orders:** Order of the Howling Wolf, Order of the White Wolf', '',
    '**Major Festivals:** Campaign Start, Hochwinter, Campaign End', '',
    '**Important Holy Texts:** *Liber Lupus*, *Teutognengeschichte*, *The Ulric Creed*', '',
    '**Common Holy Symbols:** White wolves',
  ].join('\n'))
  assert.equal(infidelite(TEXTE_060, textes, SITES_060), null)
  const { refus: perimes } = reparerLivre(textes, SITES_060.filter((s) => s.forme === 'E'))
  assert.equal(perimes.length, 2)
})

test('G APRÈS P (CRB 018 p.84) : le gras italique se rend dans la ligne recollée — celle de son site, ou celle où un P l’a recollée —, l’emphase refaite une', () => {
  const texte = new Map([['018', ['**Skills:** Athletics, Intimidate, *Melee* ', '', '*(Basic)* Melee (Brawling), *Cool*'].join('\n')]])
  const sites = [
    { forme: 'G', site: '018:1', texteMd: '*Melee (Basic)*', titre: 'Melee (Basic)' },
    { forme: 'G', site: '018:3', texteMd: '*Cool*', titre: 'Cool' },
    { forme: 'P', site: '018:3', avec: '018:1', ligneMd: '*(Basic)* Melee (Brawling), *Cool*', etiquette: null, titre: '(Basic) Melee (Brawling), Cool' },
  ]
  const { textes, refus } = reparerLivre(texte, sites)
  assert.deepEqual(refus, [])
  assert.equal(textes.get('018'), '**Skills:** Athletics, Intimidate, ***Melee (Basic)*** Melee (Brawling), ***Cool***')
})

test('J et P au joint `/` (CRB 018 p.50, p.107) : `Read/ Write` et `Read/` + `Write` rendent `Read/Write`', () => {
  const texte = new Map([['018', ['**Talents:** Kingpin, Read/ Write', '', '**Talents:** Petty Magic, Read/', '', 'Write, Second Sight'].join('\n')]])
  const sites = [
    { forme: 'J', site: '018:1', avant: 'Read/', apres: 'Write', titre: 'Read/ Write' },
    { forme: 'P', site: '018:5', avec: '018:3', ligneMd: 'Write, Second Sight', etiquette: null, titre: 'Write, Second Sight' },
  ]
  const { textes, refus } = reparerLivre(texte, sites)
  assert.deepEqual(refus, [])
  assert.equal(textes.get('018'), ['**Talents:** Kingpin, Read/Write', '', '**Talents:** Petty Magic, Read/Write, Second Sight'].join('\n'))
  assert.equal(infidelite(texte, textes, sites), null)
})

const D_TEXTE = new Map([['018', ['**Trappings:** Warehouse', '', 'for the world.', '', '## <span id="page-61-0" data-folio="62"></span>**FLAGELLANT**', '', 'and only through suffering can they hope to win divine deliverance', '', 'Most Flagellants wander', ''].join('\n')]])
const D_SITES = [{ forme: 'D', site: '018:3', avec: '018:7', ligneMd: 'for the world.', titre: 'for the world.' }]

test('D (CRB 018 l.1106, p.62) : la ligne déplacée rejoint la prose qu’elle suit au PDF et quitte sa place ; rejouée, REFUSÉE', () => {
  const { textes, refus, appliques } = reparerLivre(D_TEXTE, D_SITES)
  assert.deepEqual(refus, [])
  assert.deepEqual(appliques, ['D 018:3 → 018:7 « for the world. »'])
  assert.equal(textes.get('018'), ['**Trappings:** Warehouse', '', '## <span id="page-61-0" data-folio="62"></span>**FLAGELLANT**', '', 'and only through suffering can they hope to win divine deliverance for the world.', '', 'Most Flagellants wander', ''].join('\n'))
  assert.equal(infidelite(D_TEXTE, textes, D_SITES), null)
  assert.deepEqual(reparerLivre(textes, D_SITES).refus, ['018:3 D : la ligne n\'est plus « for the world. »'])
})

test('S′ déjà dans le fichier sous une AUTRE forme (ancre, niveau, emphase) : refusé ; imprimé deux fois et porté une, posé (CRB 070:161, 013:63)', () => {
  const texte = ['## <span id="page-237-0" data-folio="238"></span>MINOR MISCAST TABLE', '', '| d100 | Effect |', '', '#### **RANDOM TABLE**', '', '| a | b |', ''].join('\n')
  const site = (ligneTitre, cible, comptage) => ({ forme: "S'", site: null, cible, ligneTitre, titre: ligneTitre, ...(comptage ? { comptage } : {}) })
  const { refus } = reparerLivre(new Map([['070', texte]]), [site('#### **MINOR MISCAST TABLE**', '070:3')])
  assert.deepEqual(refus, ['070:3 S′ « #### **MINOR MISCAST TABLE** » : « #### **MINOR MISCAST TABLE** » déjà dans le fichier (« ## <span id="page-237-0" data-folio="238"></span>MINOR MISCAST TABLE »)'])
  const deux = reparerLivre(new Map([['013', texte]]), [site('#### **RANDOM TABLE**', '013:3', { auPdf: 2, auMd: 1 })])
  assert.deepEqual([deux.refus, deux.textes.get('013').split('\n').filter((l) => /RANDOM TABLE/.test(l)).length], [[], 2])
  assert.equal(reparerLivre(new Map([['013', texte]]), [site('#### **RANDOM TABLE**', '013:3', { auPdf: 1, auMd: 1 })]).refus.length, 1)
})

test('L et legende-absente (CRB 028:27, 036:23) : titre et bannière rendus en légende `**X**`, légende absente posée ; ajoutés = ses mots, rejoués : REFUSÉS', () => {
  const md = [
    'Prose.', '',
    '### <span id="page-1-0"></span>**FIRST TABLE**', '',
    '| Roll | Result |', '|---|---|', '| a | x |', '',
    '| | BANNER TABLE | |', '|--|--|--|', '| d10 | Obstacle |', '| 1 | Wagon |', '',
    '| d100 | Location |', '|---|---|', '| 01–09 | Head |',
  ].join('\n')
  const sites = [
    { forme: 'L', site: '001:3', titreMd: '### <span id="page-1-0"></span>**FIRST TABLE**', ligneLegende: '<span id="page-1-0"></span>**FIRST TABLE**', titre: 'FIRST TABLE' },
    { forme: 'L', site: '001:9', titreMd: '| | BANNER TABLE | |', ligneLegende: '**BANNER TABLE**', enTete: 'rangee', titre: 'BANNER TABLE' },
    { forme: 'legende-absente', site: null, cible: '001:14', ligneLegende: '**HIT LOCATIONS**', comptage: { auPdf: 1, auMd: 0 }, titre: 'HIT LOCATIONS' },
  ]
  const textes = new Map([['001', md]])
  const { textes: apres, refus } = reparerLivre(textes, sites)
  assert.deepEqual(refus, [])
  assert.equal(apres.get('001'), [
    'Prose.', '',
    '<span id="page-1-0"></span>**FIRST TABLE**', '',
    '| Roll | Result |', '|---|---|', '| a | x |', '',
    '**BANNER TABLE**', '',
    '| d10 | Obstacle |   |', '|-----|----------|---|', '| 1 | Wagon |', '',
    '**HIT LOCATIONS**', '',
    '| d100 | Location |', '|---|---|', '| 01–09 | Head |',
  ].join('\n'))
  assert.equal(infidelite(textes, apres, sites), null)
  assert.match(infidelite(textes, apres, sites.slice(0, 2)), /mots ajoutés HIT×1 LOCATIONS×1 ≠ mots des S′ et des légendes absentes ∅/)
  assert.equal(reparerLivre(apres, sites).refus.length, 3)
})
