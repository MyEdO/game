// DÉTECTEUR de la sonde HUD (#1806) — `defauts()` est PURE : elle ne lit qu'une mesure. C'est donc
// elle qu'on teste, à fixtures, sans Chrome ni serveur (gate `test:recette`, `scripts/gates/testsParGate.mjs`).
// COUVERTURE, à énoncer et non à supposer : CHAQUE verdict de `defauts` a ici son cas ROUGE (la
// mesure qui porte le défaut) ET son cas VERT (la même mesure assainie) — un détecteur sans cas
// rouge ne mesure rien, un détecteur sans cas vert crie sur tout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defauts, defautsMatrice, defautsMatriceGroupe, defautsTactile, defautsCompacite, trancheMatrice } from './hud-clickables.mjs'

/** Mesure de COMBAT sans aucun défaut (le cas vert de référence). */
const combat = () => ({
  largeur: 360,
  hauteur: 740,
  grossier: false,
  cibles: null,
  combat: true,
  rail: { dissous: true, ouvreurs: [{ i: 0, label: 'Dossier du navire', position: 'absolute', ok: true, hitBy: 'rien', rect: { x: 300, y: 400, w: 44, h: 44 } }] },
  frise: { rect: { x: 58, y: 34, w: 298, h: 52 }, roundPremier: true, roundDansColonne: true, courantEntier: true,
    defilable: true, suivants: { attendus: 3, entiers: 3 },
    bande: true, margeDroite: 4, roundVisible: true, teteMesuree: true, teteDecouverte: null,
    teteSurCartouche: null, piedMesure: false, piedRogne: null, pas: { min: 40, max: 40 }, auTraitVisible: true,
    auTrait: { lisere: 3.84, controle: null, rogne: { haut: 0, bas: -4.2, gauche: 0, droite: -8.1 }, sousCartouche: null,
      caret: { h: 10, cache: 0, horsChamp: 0 } } },
  groupe: { cartes: 4, lignes: 1, poignee: null, total: 4, defilementSecours: true, defile: false, bas: 30, replie: false,
    detail: [{ w: 79, nom: true, vie: true, vieSurPortrait: true, rognee: false }] },
  portraits: [{ i: 0, rendu: true, ok: true, hitBy: 'rien', rect: { x: 10, y: 140, w: 44, h: 44 } }],
  objectif: null,
  feedXfrise: null,
  piste: { scrollWidth: 633, clientWidth: 294, bande: 294, defile: true, tientDansLaBande: true },
  tiroir: { ouvert: true, rect: { x: 200, y: 120, w: 160, h: 240 }, surPont: null },
  dock: { rect: { x: 0, y: 380, w: 360, h: 260 } },
  dockBtns: [{ i: 0, label: 'Attaquer', rendu: true, ok: true, entier: true, hitBy: 'rien', rect: { x: 8, y: 400, w: 60, h: 40 } }],
})

/** Mesure d'EXPLORATION sans aucun défaut. */
const exploration = () => ({
  largeur: 360,
  hauteur: 740,
  grossier: false,
  cibles: null,
  combat: false,
  rail: null,
  frise: null,
  groupe: { cartes: 4, lignes: 1, poignee: null, total: 4, defilementSecours: true, defile: false, bas: 30, replie: false,
    detail: [{ w: 79, nom: true, vie: true, vieSurPortrait: true, rognee: false }] },
  portraits: [{ i: 0, rendu: true, ok: true, hitBy: 'rien', rect: { x: 10, y: 10, w: 44, h: 44 } }],
  objectif: { marge: 0, avale: false, hitBy: 'boîte au ras de la tête (aucune marge morte)' },
  feedXfrise: null,
  piste: null,
  tiroir: { ouvert: false, rect: null, surPont: null },
  dock: null,
  dockBtns: [],
})

/** La mesure `m` doit lever EXACTEMENT un défaut, dont le texte porte `motif`. */
function rouge(m, phase, motif) {
  const d = defauts(m, phase)
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], motif)
}

// ── Les deux cas VERTS : sans eux, chaque cas rouge pourrait n'être qu'un détecteur qui crie ──────
test('mesure de combat saine : aucun défaut', () => {
  assert.deepEqual(defauts(combat(), 'combat'), [])
})

test('mesure d’exploration saine : aucun défaut', () => {
  assert.deepEqual(defauts(exploration(), 'exploration'), [])
})

// ── Rail dissous : l'ouvreur d'écran porte son propre ancrage ─────────────────────────────────────
test('ouvreur du rail dissous en FLUX : défaut nommé', () => {
  const m = combat()
  m.rail.ouvreurs[0].position = 'static'
  rouge(m, 'combat', /retombe dans le stage/)
})

test('rail dissous SANS aucun ouvreur : la sonde se déclare AVEUGLE, elle ne se tait pas', () => {
  const m = combat()
  m.rail.ouvreurs = []
  rouge(m, 'combat', /le rail d'outils est dissous et ne porte aucun ouvreur d'écran — sonde aveugle/)
})

test('rail NON dissous : la position en flux ne dit rien (le rail porte alors l’ancrage)', () => {
  const m = combat()
  m.rail.dissous = false
  m.rail.ouvreurs[0].position = 'static'
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('ouvreur du rail RECOUVERT : défaut nommé, recouvrant compris', () => {
  const m = combat()
  m.rail.ouvreurs[0].ok = false
  m.rail.ouvreurs[0].hitBy = 'combat-feed <DIV>'
  rouge(m, 'combat', /ne reçoit pas son clic — recouvert par combat-feed/)
})

// ── Bande de groupe : UNE ligne ──────────────────────────────────────────────────────────────────
test('piste du groupe ENROULÉE : défaut nommé, aux deux phases', () => {
  for (const [m, phase] of [[combat(), 'combat'], [exploration(), 'exploration']]) {
    m.groupe.lignes = 2
    rouge(m, phase, /s'enroule sur 2 lignes/)
  }
})

// ── Bande REPLIÉE (≤560) : mesurée le 2026-09-20 — `.pd-track { display: none }`, les tuiles ont un
//    rect 0×0. Une boîte non RENDUE n'a pas de clic à recevoir ; c'est la POIGNÉE qui porte alors
//    l'affordance, et c'est elle qui doit être atteignable. ──────────────────────────────────
test('bande REPLIÉE dont la poignée reçoit son clic : aucun défaut', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: true, ok: true, hitBy: 'rien', rect: { x: 65, y: 10, w: 122, h: 20 } } }
  m.portraits = m.portraits.map((p) => ({ ...p, rendu: false, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 0, y: 0, w: 0, h: 0 } }))
  assert.deepEqual(defauts(m, 'exploration'), [])
})

test('bande REPLIÉE dont la poignée n’est PAS RENDUE : le groupe est hors d’atteinte', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: false, ok: false, hitBy: 'rien', rect: { x: 0, y: 0, w: 0, h: 0 } } }
  m.portraits = []
  const d = defauts(m, 'exploration')
  assert.equal(d.length, 2, d.join(' | '))
  assert.match(d[0], /la poignée du groupe replié n'est pas rendue/)
})

test('bande REPLIÉE dont la poignée est RECOUVERTE : défaut nommé', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: true, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 65, y: 10, w: 122, h: 20 } } }
  m.portraits = m.portraits.map((p) => ({ ...p, rendu: false, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 0, y: 0, w: 0, h: 0 } }))
  rouge(m, 'exploration', /la poignée du groupe replié .* ne reçoit pas son clic/)
})

test('bande sans carte rendue NI poignée : le groupe est hors d’atteinte', () => {
  const m = combat()
  m.groupe = { cartes: 0, lignes: 0, poignee: null }
  rouge(m, 'combat', /n'offre aucune poignée — il est hors d'atteinte/)
})

test('portrait NON RENDU : jamais « recouvert » (faux positif de bande repliée)', () => {
  const m = exploration()
  m.groupe = { cartes: 0, lignes: 0, poignee: { rendu: true, ok: true, hitBy: 'rien', rect: {} } }
  m.portraits = [{ i: 0, rendu: false, ok: false, hitBy: 'iso-stage <svg>', rect: { x: 0, y: 0, w: 0, h: 0 } }]
  assert.deepEqual(defauts(m, 'exploration'), [])
})

// ── Frise : réserve de droite et tête visible ────────────────────────────────────────────────────
test('frise en BANDE qui réserve sa droite : défaut au-delà de 8px', () => {
  const m = combat()
  m.frise.margeDroite = 168
  rouge(m, 'combat', /réserve 168px à sa droite/)
})

test('frise en COLONNE : la marge de droite ne dit rien (la colonne vit à gauche)', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.margeDroite = 1100
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('cartouche de Round HORS CHAMP à fond de défilement : défaut nommé', () => {
  const m = combat()
  m.frise.roundVisible = false
  rouge(m, 'combat', /le cartouche de Round sort du champ/)
})

test('cartouche de Round ABSENT : la sonde se déclare AVEUGLE, elle ne se tait pas', () => {
  const m = combat()
  m.frise.roundVisible = null
  rouge(m, 'combat', /sonde aveugle sur la tête de frise/)
})

test('vignette VISIBLE dans la tête de frise, piste défilée : défaut chiffré', () => {
  const m = combat()
  m.frise.teteDecouverte = { ox: 51, oy: 9, quoi: 'vignette' }
  rouge(m, 'combat', /vignette se voit dans la tête de frise sur 51×9px/)
})

// Le MOBILIER en débord (score, chevron, pastille d'état) sort du rect de sa cellule : le verdict le
// NOMME par sa classe, une sonde qui n'itère que les vignettes le manquerait (#1867).
test('BADGE de score visible dans la tête : défaut nommé par son mobilier', () => {
  const m = combat()
  m.frise.teteDecouverte = { ox: 5, oy: 4, quoi: 'is-score' }
  rouge(m, 'combat', /is-score se voit dans la tête de frise sur 5×4px/)
})

test('mobilier qui PEINT SUR le cartouche (rang égal) : défaut chiffré, rangs dits', () => {
  const m = combat()
  m.frise.teteSurCartouche = { ox: 20, oy: 16, quoi: 'is-score', rang: 2, rangRound: 2 }
  rouge(m, 'combat', /is-score peint SUR le cartouche de Round \(20×16px, rang 2 contre 2\)/)
})

test('tête de frise COUVERTE par le cartouche : rien à dire', () => {
  const m = combat()
  m.frise.teteDecouverte = null
  m.frise.teteSurCartouche = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// Un axe qui ne défile pas ne peut RIEN découvrir : le contrat y est intestable, pas violé. L'état
// est porté par la mesure (`teteMesuree`), que le relevé imprime — il ne se change pas en défaut.
test('axe qui NE DÉFILE PAS : aucun verdict de tête (l’état est porté par la mesure)', () => {
  const m = combat()
  m.frise.teteMesuree = false
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── PIED de la colonne : l'arrondi au pas promet une dernière entrée ENTIÈRE au repos ──────────────
test('entrée du PIED rognée au repos : défaut chiffré', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = true
  m.frise.piedRogne = { debord: 9, zone: 380, reserve: 6 }
  rouge(m, 'combat', /l'entrée du pied déborde de 9px la zone utile de 380px — la hauteur de piste n'est pas un nombre entier d'entrées/)
})

// L'arrondi au pas suppose une hauteur d'entrée CONSTANTE. Le pas se juge SEUL : une entrée plus
// haute que les autres ne rogne le pied qu'aux positions où elle tombe dans la zone utile — le
// verdict du pied ne la verrait pas partout, celui du pas si.
test('pas d’entrée NON CONSTANT : défaut chiffré, sans attendre un pied rogné', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = true
  m.frise.piedRogne = null
  m.frise.pas = { min: 50, max: 62.3 }
  rouge(m, 'combat', /le pas d'entrée n'est pas constant \(50px à 62\.3px\) — l'arrondi de la hauteur de piste au pas ne peut pas tomber juste/)
})

// ── RELIEF de la vignette AU TRAIT : la peinture ne réserve rien d'elle-même ────────────────────
test('vignette au trait qui RECOUVRE un contrôle : défaut nommé, cible et surface', () => {
  const m = combat()
  m.frise.auTrait.controle = { ox: 8.3, oy: 18, quoi: 'is-first', sienne: true }
  rouge(m, 'combat', /la vignette au trait recouvre is-first \(8\.3×18px, sa propre entrée\) — un contrôle recouvert ne reçoit pas son clic/)
})

test('boîte peinte ROGNÉE par un bord du champ : défaut chiffré, côté nommé', () => {
  const m = combat()
  m.frise.auTrait.rogne.bas = 4.8
  rouge(m, 'combat', /la boîte peinte de la vignette au trait dépasse de 4\.8px le bord bas du champ de la piste — son liseré \(3\.84px\) y est rogné/)
})

test('chevron de l’unité au trait MASQUÉ par le cartouche : défaut chiffré', () => {
  const m = combat()
  m.frise.auTrait.caret.cache = 10.8
  rouge(m, 'combat', /le chevron de l'unité au trait est masqué sur 10\.8px de 10px/)
})

test('aucune unité au trait (pause d’initiative) : aucun verdict de relief', () => {
  const m = combat()
  m.frise.auTrait = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('pas d’entrée constant : rien à dire', () => {
  const m = combat()
  m.frise.pas = { min: 50, max: 50 }
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('colonne qui ne défile pas : aucun verdict de pied (l’arrondi n’y est pas en jeu)', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = false
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('colonne défilée dont le pied tient entier : rien à dire', () => {
  const m = combat()
  m.frise.bande = false
  m.frise.piedMesure = true
  m.frise.piedRogne = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// La BANDE horizontale n'a pas d'arrondi au pas : son pied ne se juge pas, et l'absence de mesure
// n'y est pas un aveuglement.
test('bande horizontale : aucun verdict de pied', () => {
  const m = combat()
  m.frise.piedMesure = false
  assert.deepEqual(defauts(m, 'combat'), [])
})

test('acteur AU TRAIT hors du champ de la frise : défaut nommé', () => {
  const m = combat()
  m.frise.auTraitVisible = false
  rouge(m, 'combat', /l'acteur au trait est hors du champ de la frise/)
})

test('aucune entrée au trait (pause d’initiative) : rien à ramener, aucun verdict', () => {
  const m = combat()
  m.frise.auTraitVisible = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── Pont de console ──────────────────────────────────────────────────────────────────────────────
test('console ABSENTE en combat : sonde aveugle', () => {
  const m = combat()
  m.dock = null
  rouge(m, 'combat', /aucune console .* sonde aveugle/)
})

test('console SANS case : sonde aveugle', () => {
  const m = combat()
  m.dockBtns = []
  rouge(m, 'combat', /ne porte aucune case — sonde aveugle/)
})

test('case de console RECOUVERTE : défaut nommé', () => {
  const m = combat()
  m.dockBtns[0].ok = false
  m.dockBtns[0].hitBy = 'initiative-strip <DIV>'
  rouge(m, 'combat', /la case « Attaquer ».*recouverte par initiative-strip/)
})

// ── Tiroir du journal : sa réserve du bas se juge OUVERT ───────────────────────────────
test('tiroir du journal OUVERT qui recouvre la console : défaut chiffré', () => {
  const m = combat()
  m.tiroir.surPont = { ox: 160, oy: 74 }
  rouge(m, 'combat', /le tiroir du journal ouvert recouvre la console de 160×74px/)
})

test('tiroir du journal qui ne s’ouvre pas : sonde aveugle sur sa réserve', () => {
  const m = combat()
  m.tiroir = { ouvert: false, rect: null, surPont: null }
  rouge(m, 'combat', /le tiroir du journal ne s'ouvre pas/)
})

test('aucun tiroir monté : rien à dire (l’écran ne le porte pas)', () => {
  const m = combat()
  m.tiroir = null
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── Fil, piste ───────────────────────────────────────────────────────────────────────────────────
test('le fil recouvre la frise : défaut chiffré', () => {
  const m = combat()
  m.feedXfrise = { ox: 30, oy: 16 }
  rouge(m, 'combat', /recouvre la frise d'initiative de 30×16px/)
})

test('piste qui DÉBORDE de sa bande : défaut nommé', () => {
  const m = combat()
  m.piste.clientWidth = 633
  m.piste.tientDansLaBande = false
  rouge(m, 'combat', /déborde de sa bande/)
})

test('piste plus longue que la bande qui NE DÉFILE PAS : défaut nommé', () => {
  const m = combat()
  m.piste.defile = false
  rouge(m, 'combat', /ne défile pas/)
})

test('piste qui tient d’un bloc : le défilement n’est pas exigé', () => {
  const m = combat()
  m.piste = { scrollWidth: 200, clientWidth: 294, bande: 294, defile: false, tientDansLaBande: true }
  assert.deepEqual(defauts(m, 'combat'), [])
})

// ── Exploration : objectif et portraits ──────────────────────────────────────────────────────────
test('bandeau d’objectif ABSENT : sonde aveugle sur la zone morte', () => {
  const m = exploration()
  m.objectif = null
  rouge(m, 'exploration', /aucun bandeau d'objectif — sonde aveugle/)
})

test('zone morte de l’objectif qui AVALE le clic : défaut chiffré', () => {
  const m = exploration()
  m.objectif = { marge: 420, avale: true, hitBy: 'objective-banner <DIV>' }
  rouge(m, 'exploration', /420px de carte à droite de l'objectif avalent les clics/)
})

test('aucun portrait de groupe : sonde aveugle', () => {
  const m = exploration()
  m.portraits = []
  rouge(m, 'exploration', /aucun portrait de groupe — sonde aveugle/)
})

test('portrait de groupe RECOUVERT EN COMBAT (volet déplié sous le fil) : défaut nommé', () => {
  const m = combat()
  m.portraits[0].ok = false
  m.portraits[0].hitBy = 'combat-feed <DIV>'
  rouge(m, 'combat', /le portrait 0 du groupe ne reçoit pas son clic — recouvert par combat-feed/)
})

test('portrait de groupe RECOUVERT : défaut nommé', () => {
  const m = exploration()
  m.portraits[0].ok = false
  m.portraits[0].hitBy = 'objective-banner <DIV>'
  rouge(m, 'exploration', /le portrait 0 du groupe ne reçoit pas son clic/)
})

// ══ MATRICE RESPONSIVE §12 (docs/superpowers/specs/2026-07-31-hud-combat-exploration-design.md) ══
// Une mesure SAINE par tranche : la colonne d'initiative à gauche au-dessus de 700, la bande sous le
// groupe en dessous, le pont de bord à bord dans son budget de hauteur.
function saine(largeur) {
  const m = combat()
  m.largeur = largeur
  m.hauteur = 780
  const colonne = largeur > 700
  m.frise.bande = !colonne
  m.frise.rect = colonne ? { x: 10, y: 70, w: 86, h: 400 } : { x: 4, y: 140, w: largeur - 8, h: 52 }
  m.dock.rect = { x: 0, y: 780 - 150, w: largeur, h: 150 }
  return m
}

/** La liste doit porter EXACTEMENT un défaut, dont le texte porte `motif`. */
function unSeul(liste, motif) {
  assert.equal(liste.length, 1, `attendu 1 défaut, obtenu ${liste.length} : ${liste.join(' | ')}`)
  assert.match(liste[0], motif)
}

test('tranches du §12 : bornes 900 / 700 / 560, 360 dans la tranche <=560', () => {
  assert.deepEqual([1707, 901, 900, 701, 700, 561, 560, 360].map(trancheMatrice),
    ['>900', '>900', '701–900', '701–900', '561–700', '561–700', '<=560', '<=560'])
})

test('mesures saines aux quatre tranches : aucun défaut de matrice', () => {
  for (const l of [1707, 900, 700, 360]) assert.deepEqual(defautsMatrice(saine(l), 'combat'), [], `${l}px`)
})

// ── Groupe ──
test('carte du groupe NON RENDUE : défaut compté', () => {
  const m = saine(1707)
  m.groupe.cartes = 3
  unSeul(defautsMatrice(m, 'combat'), /1 carte\(s\) du groupe sur 4 ne sont pas rendues/)
})

test('piste du groupe SANS défilement de secours : défaut nommé', () => {
  const m = saine(360)
  m.groupe.defilementSecours = false
  unSeul(defautsMatriceGroupe(m, 'combat (groupe déplié)'), /aucun défilement horizontal de secours/)
})

test('carte sans VIE : défaut à toute tranche', () => {
  for (const l of [1707, 900, 700, 360]) {
    const m = saine(l)
    m.groupe.detail[0].vie = false
    unSeul(defautsMatrice(m, 'combat'), /la carte 0 du groupe ne rend pas sa vie/)
  }
})

test('carte sans NOM : défaut à TOUTE tranche, <=560 compris', () => {
  for (const l of [1707, 900, 700, 360]) {
    const m = saine(l)
    m.groupe.detail[0].nom = false
    unSeul(defautsMatrice(m, 'combat'), /la carte 0 du groupe ne rend pas son nom/)
  }
})

test('R-M1, tuile du groupe sous 44px de large à <=560 : défaut chiffré ; au-dessus, rien', () => {
  const m = saine(360)
  m.groupe.detail[0].w = 30
  unSeul(defautsMatriceGroupe(m, 'combat (groupe déplié)'), /la tuile 0 du groupe fait 30px de large — sous 44px/)
  const large = saine(700)
  large.groupe.detail[0].w = 30
  assert.deepEqual(defautsMatriceGroupe(large, 'combat'), [])
})

test('R-M1, tuile ROGNÉE par le champ d’une piste qui ne défile pas à <=560 : défaut ; piste qui défile, ou au-dessus, rien', () => {
  const m = saine(360)
  m.groupe.detail[0].rognee = true
  unSeul(defautsMatriceGroupe(m, 'combat (groupe déplié)'), /la tuile 0 du groupe est rognée par le champ de la piste, qui ne défile pas/)
  m.groupe.defile = true
  assert.deepEqual(defautsMatriceGroupe(m, 'combat (groupe déplié)'), [])
  const large = saine(700)
  large.groupe.detail[0].rognee = true
  assert.deepEqual(defautsMatriceGroupe(large, 'combat'), [])
})

test('vie NON superposée au portrait : défaut à 561–700 seulement', () => {
  const m = saine(700)
  m.groupe.detail[0].vieSurPortrait = false
  unSeul(defautsMatrice(m, 'combat'), /la vie de la carte 0 du groupe n'est pas superposée à son portrait/)
  const large = saine(900)
  large.groupe.detail[0].vieSurPortrait = false
  assert.deepEqual(defautsMatrice(large, 'combat'), [])
})

test('bande repliée (aucune carte rendue) : la colonne Groupe ne juge rien', () => {
  const m = saine(360)
  m.groupe = { cartes: 0, lignes: 0, total: 4, detail: [], defilementSecours: null, bas: 30, replie: true, poignee: null }
  assert.deepEqual(defautsMatriceGroupe(m, 'combat'), [])
})

// ── Initiative ──
test('frise en BANDE au-dessus de 700 : défaut nommé', () => {
  const m = saine(900)
  m.frise.bande = true
  unSeul(defautsMatrice(m, 'combat'), /la frise d'initiative est en bande — la tranche la veut en colonne/)
})

test('frise en COLONNE à 700 et moins : défaut nommé', () => {
  const m = saine(700)
  m.frise.bande = false
  unSeul(defautsMatrice(m, 'combat'), /la frise d'initiative est en colonne — la tranche la veut en bande horizontale/)
})

test('colonne d’initiative à DROITE au-delà de 900 : défaut chiffré', () => {
  const m = saine(1707)
  m.frise.rect = { x: 1600, y: 70, w: 86, h: 400 }
  unSeul(defautsMatrice(m, 'combat'), /la colonne d'initiative n'est pas à gauche \(centre à 1643px\)/)
})

test('cartouche de Round qui n’ouvre PAS la frise : défaut nommé', () => {
  const m = saine(700)
  m.frise.roundPremier = false
  unSeul(defautsMatrice(m, 'combat'), /le cartouche de Round n'est pas la première entrée de la frise/)
})

test('bande d’initiative qui MORD sur le groupe à 561–700 : défaut chiffré ; sous lui, rien', () => {
  const m = saine(700)
  m.groupe.bas = 129.6
  m.frise.rect.y = 84
  unSeul(defautsMatrice(m, 'combat'), /la bande d'initiative \(haut 84px\) n'est pas sous le groupe \(bas 129.6px\)/)
  m.frise.rect.y = 130
  assert.deepEqual(defautsMatrice(m, 'combat'), [])
})

test('courant + deux suivants PAS tous entiers à <=560 : défaut compté ; au-dessus, rien', () => {
  const m = saine(360)
  m.frise.suivants = { attendus: 3, entiers: 2 }
  unSeul(defautsMatrice(m, 'combat'), /2 entrée\(s\) sur 3 \(courant \+ deux suivants\) entières/)
  const large = saine(700)
  large.frise.suivants = { attendus: 3, entiers: 2 }
  assert.deepEqual(defautsMatrice(large, 'combat'), [])
})

test('cartouche de Round HORS de la colonne au-delà de 900 : défaut nommé ; en bande, rien', () => {
  const m = saine(1707)
  m.frise.roundDansColonne = false
  unSeul(defautsMatrice(m, 'combat'), /le cartouche de Round n'est pas intégré à la colonne d'initiative/)
  const bande = saine(700)
  bande.frise.roundDansColonne = false
  assert.deepEqual(defautsMatrice(bande, 'combat'), [])
})

test('entrée au trait PAS entière dans le champ à 701–900 : défaut nommé ; ailleurs, rien', () => {
  const m = saine(900)
  m.frise.courantEntier = false
  unSeul(defautsMatrice(m, 'combat'), /l'entrée au trait n'est pas entière dans le champ de la frise/)
  const large = saine(1707)
  large.frise.courantEntier = false
  assert.deepEqual(defautsMatrice(large, 'combat'), [])
})

test('aucune entrée au trait à 701–900 : la sonde se déclare AVEUGLE sur le courant entier', () => {
  const m = saine(900)
  m.frise.courantEntier = null
  unSeul(defautsMatrice(m, 'combat'), /aucune entrée au trait — sonde aveugle sur le courant entier/)
})

test('piste d’initiative NON défilable en bande (561–700 et <=560) : défaut nommé ; en colonne, rien', () => {
  for (const l of [700, 360]) {
    const m = saine(l)
    m.frise.defilable = false
    unSeul(defautsMatrice(m, 'combat'), /la piste d'initiative n'est pas défilable/)
  }
  const colonne = saine(900)
  colonne.frise.defilable = false
  assert.deepEqual(defautsMatrice(colonne, 'combat'), [])
})

test('aucune entrée au trait (pause d’initiative) : aucun verdict de suivants', () => {
  const m = saine(360)
  m.frise.suivants = null
  assert.deepEqual(defautsMatrice(m, 'combat'), [])
})

// ── Dock ──
test('pont qui ne va PAS de bord à bord : défaut chiffré', () => {
  const m = saine(900)
  m.dock.rect = { x: 0, y: 600, w: 880, h: 150 }
  unSeul(defautsMatrice(m, 'combat'), /le pont ne va pas de bord à bord \(0\.\.880px sur 900px\)/)
})

test('pont au-delà de 21 % de la hauteur dès 1280 : défaut chiffré ; sous 1280, rien', () => {
  const m = saine(1707)
  m.dock.rect.h = 187.3
  unSeul(defautsMatrice(m, 'combat'), /le pont prend 24\.0 % de la hauteur \(plafond 21 % dès 1280px\)/)
  const moyen = saine(1100)
  moyen.dock.rect.h = 187.3
  assert.deepEqual(defautsMatrice(moyen, 'combat'), [])
})

test('pont compact au-delà de 45 % de la hauteur à <=560 : défaut chiffré', () => {
  const m = saine(360)
  m.dock.rect.h = 442
  unSeul(defautsMatrice(m, 'combat'), /le pont compact prend 56\.7 % de la hauteur \(plafond 45 %\)/)
})

test('case de console NON ENTIÈRE dans l’écran : défaut nommé ; non rendue, rien', () => {
  const m = saine(900)
  m.dockBtns[0].entier = false
  unSeul(defautsMatrice(m, 'combat'), /la case « Attaquer ».*n'est pas entière dans l'écran/)
  m.dockBtns[0].rendu = false
  assert.deepEqual(defautsMatrice(m, 'combat'), [])
})

// ── Cibles tactiles (pointer: coarse) ──
test('cible tactile sous 44px : défaut chiffré ; à 44, rien', () => {
  const m = saine(360)
  m.grossier = true
  m.cibles = [{ label: 'Menu', w: 44, h: 44 }, { label: 'Journal', w: 44, h: 36 }]
  unSeul(defautsTactile(m, 'combat'), /la commande « Journal » offre 44×36px — cible tactile sous 44px/)
  m.cibles[1].h = 44
  assert.deepEqual(defautsTactile(m, 'combat'), [])
})

test('pointeur grossier NON émulé, ou aucune commande : la sonde se déclare aveugle', () => {
  const m = saine(360)
  unSeul(defautsTactile(m, 'combat'), /le pointeur grossier n'est pas émulé — sonde aveugle/)
  m.grossier = true
  m.cibles = []
  unSeul(defautsTactile(m, 'combat'), /aucune commande vissée rendue — sonde aveugle/)
})

// ── Compacité (série de largeurs) ──
test('cartes du groupe PAS plus compactes qu’au-delà de 900 : défaut aux deux tranches moyennes', () => {
  const serie = [saine(1707), saine(900), saine(700)]
  for (const m of serie) m.groupe.detail[0].w = 88
  serie[1].frise.rect.w = 80
  const d = defautsCompacite(serie, 'combat')
  assert.equal(d.length, 2, d.join(' | '))
  assert.match(d[0], /900px \(§12 701–900\) : la carte du groupe fait 88px, pas plus compacte que 88px à 1707px/)
  assert.match(d[1], /700px \(§12 561–700\) : la carte du groupe fait 88px/)
})

test('cartes compactées et colonne réduite : aucun défaut', () => {
  const serie = [saine(1707), saine(900), saine(700)]
  serie[0].groupe.detail[0].w = 88
  serie[1].groupe.detail[0].w = 80
  serie[2].groupe.detail[0].w = 72
  serie[1].frise.rect.w = 80
  assert.deepEqual(defautsCompacite(serie, 'combat'), [])
})

test('colonne d’initiative PAS réduite à 701–900 : défaut chiffré', () => {
  const serie = [saine(1707), saine(900)]
  serie[0].groupe.detail[0].w = 88
  serie[1].groupe.detail[0].w = 80
  serie[1].frise.rect.w = 86
  unSeul(defautsCompacite(serie, 'combat'), /la colonne d'initiative fait 86px, pas plus réduite que 86px à 1707px/)
})

test('série SANS mesure au-delà de 900 : rien à comparer', () => {
  assert.deepEqual(defautsCompacite([saine(900), saine(700)], 'combat'), [])
})
