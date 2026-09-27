// FIXTURES des détecteurs purs de la HAUTEUR (#1847) — sans Chrome ni serveur (gate `test:recette`,
// `scripts/gates/testsParGate.mjs`).
// COUVERTURE, à énoncer et non à supposer : CHAQUE détecteur a ici son cas ROUGE (le relevé qui
// porte le défaut, repris des MESURES du ticket) et son cas VERT (le même relevé assaini) — un
// détecteur sans cas rouge ne mesure rien, un détecteur sans cas vert crie sur tout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  scrollportDePage, commandesInatteignables, corpsDeModaleEcrase, courantHorsChamp, piedHorsChamp,
  contenuSousLeBord, ecranNomme, enfantsQuiSeChevauchent, ongletHorsDeVue, nomRecouvert,
} from './detecteurs-hauteur.mjs'

// ── SCROLLPORT DE PAGE — mesure du ticket #1847 : à 1366×650, la carte du menu principal fait 782px
//    et ce qui défile est la surface plein champ qui la porte (`.menu { overflow-y: auto }`). ─────
const FENETRE_PORTABLE = { largeur: 1366, hauteur: 650 }
const menuQuiDefileLaPage = () => ({
  vue: '1366×650 (portable)',
  ecran: 'menu',
  page: { scrollH: 782, clientH: 650 },
  fenetre: FENETRE_PORTABLE,
  defileurs: [],
})

test('surface PLEIN CHAMP qui défile : scrollport de page sous un autre nom — défaut nommé', () => {
  // Mesure du ticket : la page, elle, ne déborde pas d'un pixel — c'est `.menu` qui absorbe tout,
  // et il couvre le viewport. Le détecteur qui ne regarderait que `document.scrollingElement`
  // serait AVEUGLE ici, et le remède du menu ne se prouverait par rien.
  const d = scrollportDePage({
    vue: '1366×650 (portable)',
    ecran: 'menu',
    page: { scrollH: 650, clientH: 650 },
    fenetre: FENETRE_PORTABLE,
    defileurs: [{ sel: '.menu.tx-ink', scrollH: 782, clientH: 650, boite: { left: 0, top: 0, right: 1366, bottom: 650 } }],
  })
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /« \.menu\.tx-ink » couvre TOUT le viewport et défile de 132px/)
})

test('CADRE borné qui défile dans son écran : aucun défaut, si haut soit son contenu', () => {
  // Le même débord, dans une boîte qui ne couvre PAS le viewport (en-tête et actions restent
  // ancrés autour d'elle) : c'est le défilement légitime, celui que le remède installe.
  assert.deepEqual(scrollportDePage({
    vue: '1366×650 (portable)',
    ecran: 'menu',
    page: { scrollH: 650, clientH: 650 },
    fenetre: FENETRE_PORTABLE,
    defileurs: [{ sel: '.menu-card-body', scrollH: 566, clientH: 434, boite: { left: 403, top: 104, right: 963, bottom: 538 } }],
  }), [])
})

test('menu plus haut que la fenêtre : la PAGE défile — défaut nommé, avec sa mesure', () => {
  const d = scrollportDePage(menuQuiDefileLaPage())
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /la PAGE défile de 132px/)
  assert.match(d[0], /aucun cadre défilant ne le recueille/)
})

test('page qui déborde ALORS QU’un cadre défilant est monté : le défaut NOMME le cadre', () => {
  // Un cadre présent mais qui n'absorbe rien est pire qu'aucun cadre : le message doit le dire,
  // sinon on cherche le remède du mauvais côté.
  const d = scrollportDePage({
    ...menuQuiDefileLaPage(),
    defileurs: [{ sel: '.menu-card-body', scrollH: 700, clientH: 400 }],
  })
  assert.equal(d.length, 1)
  assert.match(d[0], /\.menu-card-body/)
})

test('CONTENU DE 5130px qui défile DANS son cadre : aucun défaut', () => {
  // Cas VERT obligatoire (verdict §7) : le Compendium porte un `.screen-scroll` de 5130px de
  // contenu. C'est LÉGITIME — la page, elle, ne bouge pas d'un pixel, et tout reste atteignable
  // sans quitter l'écran. Un détecteur qui rougirait ici interdirait toute liste longue.
  assert.deepEqual(scrollportDePage({
    vue: '1366×650 (portable)',
    ecran: 'compendium',
    page: { scrollH: 650, clientH: 650 },
    fenetre: FENETRE_PORTABLE,
    defileurs: [{ sel: '.screen-scroll', scrollH: 5130, clientH: 457, boite: { left: 0, top: 121, right: 1366, bottom: 578 } }],
  }), [])
})

test('arrondi de sous-pixel : pas un débord', () => {
  assert.deepEqual(scrollportDePage({ vue: '1707×780 (bureau)', ecran: 'party', page: { scrollH: 780.6, clientH: 780 }, defileurs: [] }), [])
})

test('aucune mesure de page : la sonde se déclare AVEUGLE au lieu de se taire', () => {
  const d = scrollportDePage({ vue: '360×740 (mobile)', ecran: 'editor', page: null })
  assert.equal(d.length, 1)
  assert.match(d[0], /sonde aveugle/)
})

test('CADRE qui commence SOUS la fenêtre : le défaut nomme le cadre, pas les 3px de page', () => {
  // Mesure du ticket à 360×740 : la page ne déborde que de 3px, mais la cause est un cadre entier
  // hors champ — le chiffre du débord de page était exact et trompeur.
  const d = scrollportDePage({
    vue: '360×740 (mobile)',
    ecran: 'party',
    page: { scrollH: 743, clientH: 740 },
    fenetre: { largeur: 360, hauteur: 740 },
    defileurs: [{ sel: '.party-company', scrollH: 759, clientH: 26, boite: { left: 0, top: 749.8, right: 360, bottom: 777.8 } }],
  })
  assert.equal(d.length, 2, `attendu 2 défauts, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d.join(' | '), /« \.party-company » commence SOUS la fenêtre \(haut 749\.8 pour 740px\) et porte 759px de contenu dans 26px/)
})

// ── CORPS DE MODALE ÉCRASÉ — « la fenêtre tient-elle ce qu'elle RÉCLAME ? ». Le contrat vient du
//    CSS (`--roll-fenetre`, `--roll-band-min`, `--roll-dock-min`), jamais du détecteur. ───────────
const fenetreAvantLeTicket = () => ({
  vue: '1366×650 (portable)',
  modales: [{
    quoi: '.modal', corps: { clientH: 229, scrollH: 561 },
    place: 650, boite: 405, reclame: null, plancherHaut: 0, plancherBas: 0,
  }],
})

test('fenêtre qui défile SANS contrat publié : défaut nommé — la sonde ne devient pas muette', () => {
  // L'AVANT du ticket : le voile ne déclarait aucune boîte réclamée. Sans ce cas, retirer
  // `--roll-fenetre` du CSS rendrait le détecteur silencieux au lieu de rouge.
  const d = corpsDeModaleEcrase(fenetreAvantLeTicket())
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /ne PUBLIE aucun contrat/)
  assert.match(d[0], /229px rendus sur 561px/)
})

test('même fenêtre, contrat publié : elle ne tient pas ce qu’elle réclame — défaut chiffré', () => {
  // La même boîte de 405px, confrontée aux 736px réclamés : à 650 de haut l'écran en laisse
  // 630 (650 − 12 − 8), et 405 en est loin.
  const m = fenetreAvantLeTicket()
  Object.assign(m.modales[0], { reclame: 736, plancherHaut: 12, plancherBas: 8 })
  const d = corpsDeModaleEcrase(m)
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /ne tient que 405px alors qu'elle réclame 736px et que l'écran lui en laisse 630px/)
})

test('écran trop bas : la fenêtre prend TOUT ce que l’écran laisse — aucun défaut', () => {
  // 650 de haut : la boîte réclamée n'y tient pas, la fenêtre prend 630 (les deux planchers pris).
  // Son corps défile encore, mais plus rien ne le retient — c'est l'écran qui est petit.
  const m = fenetreAvantLeTicket()
  Object.assign(m.modales[0], { boite: 630, corps: { clientH: 455, scrollH: 561 }, reclame: 736, plancherHaut: 12, plancherBas: 8 })
  assert.deepEqual(corpsDeModaleEcrase(m), [])
})

test('écran assez haut : la fenêtre tient EXACTEMENT ce qu’elle réclame — aucun défaut', () => {
  assert.deepEqual(corpsDeModaleEcrase({
    vue: '1707×780 (bureau)',
    modales: [{
      quoi: '.modal', corps: { clientH: 561, scrollH: 600 },
      place: 780, boite: 736, reclame: 736, plancherHaut: 12, plancherBas: 8,
    }],
  }), [])
})

test('corps qui NE défile pas : rien à juger, si petite soit la fenêtre', () => {
  // Une fenêtre courte (un jet d'une rangée) occupe peu de place par nature. Sans débord de
  // contenu, il n'y a aucun écrasement — sinon le détecteur crierait sur toutes les petites
  // fenêtres, et personne ne le lirait plus.
  assert.deepEqual(corpsDeModaleEcrase({
    vue: '1707×780 (bureau)',
    modales: [{
      quoi: '.modal', corps: { clientH: 120, scrollH: 120 },
      place: 780, boite: 180, reclame: 736, plancherHaut: 12, plancherBas: 8,
    }],
  }), [])
})

// ── COMMANDE INATTEIGNABLE dans une carte de menu — le CRITÈRE est ici, pas dans la sonde. ───────
test('bouton AU-DELÀ de la course restante : défaut nommé, avec son bas et la course', () => {
  // Corps qui s'arrête à 620, 80px de course restante : tout défilement mène au plus à 700.
  const d = commandesInatteignables({
    vue: '1366×650 (portable)',
    ecran: 'menu système › Options',
    cartes: [{
      sel: '.menu-card.game-menu-card', corpsBas: 620, restant: 80,
      commandes: [{ nom: 'Appliquer', bas: 812.4 }],
    }],
  })
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /« Appliquer » \(bas 812\.4\) est INATTEIGNABLE dans \.menu-card\.game-menu-card/)
  assert.match(d[0], /le corps s’?'?arrête à 620 et il ne reste que 80px de course/)
})

test('bouton SOUS LE PLI mais dans la course restante : aucun défaut', () => {
  // Même carte, bouton à 690 : le joueur l'amène sous ses yeux en défilant les 80px qui restent.
  assert.deepEqual(commandesInatteignables({
    vue: '1366×650 (portable)',
    ecran: 'menu système › Options',
    cartes: [{
      sel: '.menu-card.game-menu-card', corpsBas: 620, restant: 80,
      commandes: [{ nom: 'Appliquer', bas: 690 }],
    }],
  }), [])
})

test('carte sans course, commandes toutes dans le corps : aucun défaut', () => {
  assert.deepEqual(commandesInatteignables({
    vue: '1366×650 (portable)',
    ecran: 'menu',
    cartes: [{ sel: '.menu-card', corpsBas: 540, restant: 0, commandes: [{ nom: 'Nouvelle partie', bas: 320 }] }],
  }), [])
})

// ── ACTEUR COURANT HORS CHAMP — la frise d'initiative défilée, l'entrée au trait passée à droite. ──
test('acteur au trait hors de sa piste : défaut nommé, avec le côté et la mesure', () => {
  const d = courantHorsChamp({
    vue: '1366×650 (portable)',
    courant: { nom: 'Gunnar', left: 1180, right: 1268, top: 96, bottom: 164 },
    piste: { left: 130, right: 1240, top: 90, bottom: 170 },
  })
  assert.equal(d.length, 1, `attendu 1 défaut, obtenu ${d.length} : ${d.join(' | ')}`)
  assert.match(d[0], /« Gunnar »/)
  assert.match(d[0], /de 28px par la DROITE/)
})

test('acteur au trait ramené dans le champ : aucun défaut', () => {
  assert.deepEqual(courantHorsChamp({
    vue: '1366×650 (portable)',
    courant: { nom: 'Gunnar', left: 1150, right: 1238, top: 96, bottom: 164 },
    piste: { left: 130, right: 1240, top: 90, bottom: 170 },
  }), [])
})

test('personne au trait (pause d’initiative, combat fini) : rien à dire', () => {
  assert.deepEqual(courantHorsChamp({ vue: '1707×780 (bureau)', courant: null, piste: { left: 0, right: 100, top: 0, bottom: 10 } }), [])
})

// ── PIED DE CADRE HORS CHAMP — mesure du juge B5 (#1920) : récap de chapitre à 1366×650, le pied
//    de `ScreenShell` à 661..708 faute de corps défilant. ─────────────────────────────────────────
const recapDeChapitre = (pied) => ({ vue: '1366×650 (portable)', ecran: 'récap de chapitre', fenetre: FENETRE_PORTABLE, pieds: [pied] })

test('pied de cadre SOUS la fenêtre : défaut nommé, avec sa mesure', () => {
  const d = piedHorsChamp(recapDeChapitre({ sel: '.cadre-pied', top: 661, bottom: 708 }))
  assert.equal(d.length, 1)
  assert.match(d[0], /661\.\.708/)
  assert.match(d[0], /650px/)
})

test('pied de cadre dans la fenêtre, le corps défilant au-dessus : aucun défaut', () => {
  assert.deepEqual(piedHorsChamp(recapDeChapitre({ sel: '.cadre-pied', top: 592, bottom: 640 })), [])
})

test('pied rogné d’un sous-pixel : pas un défaut', () => {
  assert.deepEqual(piedHorsChamp(recapDeChapitre({ sel: '.cadre-pied', top: 603, bottom: 650.6 })), [])
})

// ── ÉCRAN NOMMÉ ABSENT — mesure du juge B6 (#1920) : à 900 ms d'attente, l'ouverture et le récap de
//    chapitre ne sont pas montés au relevé à 1707×780 ; le relevé n'a aucun pied, et le vert était muet. ──
test('écran à pied NOMMÉ mais absent du relevé : défaut nommé, jamais un vert', () => {
  const d = piedHorsChamp({ vue: '1707×780 (bureau)', ecran: 'récap de chapitre', fenetre: { largeur: 1707, hauteur: 780 }, piedExige: true, pieds: [] })
  assert.equal(d.length, 1)
  assert.match(d[0], /écran absent/)
})

test('écran sans pied attendu, aucun pied relevé : rien à dire', () => {
  assert.deepEqual(piedHorsChamp({ vue: '1707×780 (bureau)', ecran: 'campagne (exploration)', fenetre: { largeur: 1707, hauteur: 780 }, pieds: [] }), [])
})

// ── CONTENU SOUS LE BORD D'UN CADRE — mesure du juge B6 (#1920) : planche de navire à 360×740,
//    corps de la planche borné à 665, contenu jusqu'à 987, aucun défileur. ────────────────────────
const plancheDeNavire = (sansDefileur) => ({
  vue: '360×740 (mobile)', ecran: 'planche de navire', cadreExige: true,
  cadres: [{ sel: '.modal', bord: 665, sansDefileur }],
})

test('contenu d’un cadre sous son bord, sans défileur : défaut nommé, avec sa mesure', () => {
  const d = contenuSousLeBord(plancheDeNavire({ sel: '.station-detail', bas: 987 }))
  assert.equal(d.length, 1)
  assert.match(d[0], /bord 665/)
  assert.match(d[0], /987/)
  assert.match(d[0], /322px/)
})

test('contenu du cadre porté par un défileur (rien de libre sous le bord) : aucun défaut', () => {
  assert.deepEqual(contenuSousLeBord(plancheDeNavire(null)), [])
})

test('élément libre qui dépasse d’un sous-pixel : pas un défaut', () => {
  assert.deepEqual(contenuSousLeBord(plancheDeNavire({ sel: '.station-detail', bas: 665.8 })), [])
})

test('écran de cadre NOMMÉ mais aucun cadre relevé : défaut nommé, jamais un vert', () => {
  const d = contenuSousLeBord({ vue: '360×740 (mobile)', ecran: 'planche de navire', cadreExige: true, cadres: [] })
  assert.equal(d.length, 1)
  assert.match(d[0], /écran absent/)
})

// ── ÉCRAN NOMMÉ (juge B8, #1920) — un verdict d'écran exige CET écran, au-dessus. Sondes du juge
//    promues : `sonde-detecteurs.mjs` (« fiche absente, autre cadre présent ») et le relevé de
//    `hr.txt` à 1707×780 (fenêtre de jet montée par-dessus les écrans jugés). ─────────────────────
const VUE_BUREAU = '1707×780 (bureau)'

test('écran nommé ABSENT, un autre cadre présent : défaut nommé, le cadre présent ne vaut pas preuve', () => {
  const d = ecranNomme({ vue: VUE_BUREAU, ecran: 'fiche de personnage', nom: 'Fiche de', dialogue: null, dialogues: ['Coffre du relais'] })
  assert.equal(d.length, 1, d.join(' | '))
  assert.match(d[0], /aucun dialogue nommé « Fiche de » — écran absent, dialogues montés : « Coffre du relais »/)
})

test('écran nommé absent, rien de monté : défaut nommé', () => {
  const d = ecranNomme({ vue: VUE_BUREAU, ecran: 'butin', nom: 'Coffre', dialogue: null, dialogues: [] })
  assert.match(d[0], /aucun dialogue monté/)
})

test('écran nommé monté mais RECOUVERT par une fenêtre de jet : défaut nommé, avec ce qui le couvre', () => {
  const d = ecranNomme({
    vue: VUE_BUREAU, ecran: 'document', nom: 'Lettre de Kastor',
    dialogue: { nom: 'Lettre de Kastor Lieberung', dessus: false, cible: '.btn.btn-primary dans « Test de Perception »' },
  })
  assert.equal(d.length, 1, d.join(' | '))
  assert.match(d[0], /RECOUVERT — son geste tombe sur « \.btn\.btn-primary dans « Test de Perception » »/)
})

test('écran nommé monté et au-dessus : aucun défaut', () => {
  assert.deepEqual(ecranNomme({
    vue: VUE_BUREAU, ecran: 'document', nom: 'Lettre de Kastor',
    dialogue: { nom: 'Lettre de Kastor Lieberung', dessus: true, cible: '.btn.btn-primary' },
  }), [])
})

test('preuve DOM de `contenuSousLeBord` (sonde-r3 du juge B8) : planche de navire à 360×740 sans défileur de corps d’onglet', () => {
  // Relevé RÉEL de la sonde du juge : la planche telle quelle (vert), puis le même arbre où le
  // défileur de `.sheet-tabbody` est neutralisé dans la page (rouge, 321.9px coupés).
  assert.deepEqual(contenuSousLeBord({ vue: '360×740', ecran: 'planche de navire', cadreExige: true, cadres: [{ sel: '.modal', bord: 665.2, sansDefileur: null }] }), [])
  const d = contenuSousLeBord({ vue: '360×740', ecran: 'planche de navire', cadreExige: true, cadres: [{ sel: '.modal', bord: 665.2, sansDefileur: { sel: '.sheet-tabbody', bas: 987.1 } }] })
  assert.deepEqual(d, ["360×740 · planche de navire : dans « .modal » (bord 665.2), « .sheet-tabbody » descend à 987.1 sans défileur — 321.9px de contenu coupés, qu'aucun défilement ne ramène"])
})

// ── ENFANTS QUI SE CHEVAUCHENT (juge B9, #1920, `sonde-chevauche.mjs`) — fiche à 700×780 : rangées
//    de la grille comprimées, contenu de l'aside jusqu'à 499, corps d'onglets dès 421. ──────────────
const planche700 = (mainTop) => ({
  vue: '700×780 (mobile)', ecran: 'fiche de personnage',
  cadres: [{ sel: '.modal', fratries: [{ parent: '.sheet-layout', enfants: [
    { sel: '.sheet-aside', left: 24, right: 676, top: 112, bottom: 499 },
    { sel: '.sheet-main', left: 24, right: 676, top: mainTop, bottom: mainTop + 281 },
  ] }] }],
})

test('contenu d’une colonne qui passe sous la suivante : défaut nommé, avec sa mesure', () => {
  const d = enfantsQuiSeChevauchent(planche700(421))
  assert.deepEqual(d, ['700×780 (mobile) · fiche de personnage : dans « .modal », sous « .sheet-layout », « .sheet-aside » (112..499) et « .sheet-main » (421..702) se CHEVAUCHENT sur 78×652px — l\'un écrit sur l\'autre'])
})

test('colonnes empilées l’une sous l’autre : aucun défaut', () => {
  assert.deepEqual(enfantsQuiSeChevauchent(planche700(515)), [])
})

test('colonnes CÔTE À CÔTE, même hauteur : aucun défaut (le recouvrement se juge sur les deux axes)', () => {
  assert.deepEqual(enfantsQuiSeChevauchent({ vue: '1707×780', ecran: 'fiche', cadres: [{ sel: '.modal', fratries: [{ parent: '.sheet-layout', enfants: [
    { sel: '.sheet-aside', left: 400, right: 640, top: 112, bottom: 700 },
    { sel: '.sheet-main', left: 664, right: 1300, top: 112, bottom: 700 },
  ] }] }] }), [])
})

test('frères qui se touchent à un sous-pixel près : pas un défaut', () => {
  assert.deepEqual(enfantsQuiSeChevauchent(planche700(498.2)), [])
})

test('le détecteur juge TOUT cadre et toute fratrie, pas seulement la planche', () => {
  const d = enfantsQuiSeChevauchent({ vue: '360×740', ecran: 'document', cadres: [
    { sel: '.modal', fratries: [] },
    { sel: '.worldmap-overlay', fratries: [{ parent: '.ouv-cartes', enfants: [
      { sel: '.carte', left: 10, right: 150, top: 100, bottom: 200 },
      { sel: '.carte', left: 160, right: 300, top: 100, bottom: 200 },
      { sel: '.pied-note', left: 10, right: 300, top: 180, bottom: 220 },
    ] }] },
  ] })
  assert.equal(d.length, 2, d.join(' | '))
  assert.match(d[0], /« \.worldmap-overlay », sous « \.ouv-cartes »/)
})

// ── ONGLET CLIQUÉ HORS DE VUE — mesure du juge B10 (#1920) : fiche à 360×740, après le clic de
//    « État », la planche remonte en haut, barre d'onglets à 416px, 29px du corps en vue. ─────────
const ficheApresClic = (barreTop, extra = {}) => ({
  vue: '360×740 (mobile)', ecran: 'fiche de personnage', onglet: 'État',
  cadre: { top: 92, bottom: 648 }, barre: { top: 92 + barreTop, bottom: 92 + barreTop + 36 },
  corps: { top: 92 + barreTop + 48 }, ...extra,
})

test('clic d’onglet qui renvoie la planche en haut : la présence en vue, le corps sous le pli — défaut nommé', () => {
  assert.deepEqual(ongletHorsDeVue(ficheApresClic(416)), [
    '360×740 (mobile) · fiche de personnage › onglet « État » : la barre d\'onglets est à 416px sous le haut de la planche — la présence reste en vue et 92px du corps ouvert',
  ])
})

test('barre d’onglets en tête de la planche, corps juste dessous : aucun défaut', () => {
  assert.deepEqual(ongletHorsDeVue(ficheApresClic(0)), [])
})

test('planche en fin de course : la barre ne peut pas monter plus haut, aucun défaut', () => {
  assert.deepEqual(ongletHorsDeVue(ficheApresClic(300, { finDeCourse: true })), [])
})

test('barre d’onglets au-dessus de la planche : défaut nommé', () => {
  assert.match(ongletHorsDeVue(ficheApresClic(-40))[0], /la barre d'onglets \(52\.\.88\) sort de la planche \(92\.\.648\)/)
})

test('corps d’onglet sous le bord : défaut nommé', () => {
  const d = ongletHorsDeVue({ ...ficheApresClic(0), corps: { top: 700 } })
  assert.match(d[0], /le haut du corps d'onglet \(700\) est sous le bord de la planche \(648\)/)
})

// ── NOM DE PLANCHE RECOUVERT — mesure du juge B11 (#1920, D2) : navire à 700×780 en combat,
//    « Loup impérial » [44,75,107,28] sous la bande de groupe, 2 points sur 5. ──────────────────────
test('nom de planche sous la bande de groupe : défaut nommé, avec ce qui le couvre', () => {
  const d = nomRecouvert({ vue: '700×780 (tablette)', ecran: 'planche de navire', nom: { texte: 'Loup impérial', couverts: ['party-dock', 'party-dock'] } })
  assert.equal(d.length, 1, d.join(' | '))
  assert.match(d[0], /« Loup impérial » est RECOUVERT par « party-dock » \(2\/5 points\)/)
})

test('nom de planche dans son dialogue : aucun défaut', () => {
  assert.deepEqual(nomRecouvert({ vue: '700×780 (tablette)', ecran: 'planche de navire', nom: { texte: 'Loup impérial', couverts: [] } }), [])
})

test('aucun nom relevé : sonde aveugle, défaut nommé — jamais un vert', () => {
  assert.match(nomRecouvert({ vue: '360×740 (mobile)', ecran: 'fiche de personnage (combat)', nom: null })[0], /sonde aveugle/)
})
