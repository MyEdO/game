// INTÉGRITÉ des LISTES DE DÉCOUPE (`scripts/raw/decoupes/<id du livre>.json`, #1739) : une liste est
// une PROMESSE sur le registre des livres (son nom de fichier est un id de `books.json`) et sur le
// grain que le dépôt s'impose (un fichier par section, qui OUVRE sur le titre de son nom). Deux
// choses qu'un schéma ne peut pas tenir — zod ne voit ni l'autre fichier, ni la règle du grain.
// La garde vit donc ICI, à côté du lecteur unique (`_lib.mjs#decoupeDe`), sous `npm run test:raw`.
// Le CONTRAT : le nom du fichier est l'id d'un livre COUVERT par l'Atlas ; le `book` déclaré le
// redit ; chaque entrée porte exactement son jeu de clés ; les pages sont croissantes (deux entrées
// peuvent partager une page : on coupe à la LIGNE du titre, pas à la page) ; aucune entrée n'est
// saisie deux fois ; chaque titre de fichier survit à `nomAscii` sans changer (le nom écrit sous
// `Source/` est celui de la donnée) ; `onglets` est déclaré, bien formé et couvre chaque chapitre, `gabaritOnglet` l'accompagne ; `gabaritTitre` est déclaré et bien formé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DECOUPES_DIR, decoupeDe, estLivreExtrait, livresDecoupes, ongletsDe, REGISTRE_LIVRES } from './_lib.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import { titreDuFichier } from '../../src/data/source/decoupe.ts'
import { ROLES_DE_GLYPHE } from './sonde-titres.mjs'

const LIVRES_COUVERTS = new Map(REGISTRE_LIVRES.filter(estLivreExtrait).map((b) => [b.id, b]))
const IDS = livresDecoupes()

test('#1739 : au moins une liste de découpe existe — un dossier vide rendrait ce banc VERT À VIDE', () => {
  assert.ok(IDS.length, 'scripts/raw/decoupes/ ne porte aucune liste')
})

test('#1739 : le nom de chaque liste est l’id d’un livre du registre COUVERT par l’Atlas', () => {
  const inconnus = IDS.filter((id) => !LIVRES_COUVERTS.has(id))
  assert.deepEqual(inconnus, [], 'un fichier de découpe se nomme par l’`id` STABLE de son livre')
})

const CLES = { obligatoires: ['titre', 'page', 'pageFin'], facultatives: ['ouverture', 'chapitre'] }

test('#1739 : chaque entrée porte EXACTEMENT son jeu de clés — une clé inconnue est une faute muette', () => {
  const fautes = []
  for (const id of IDS) {
    const admises = new Set([...CLES.obligatoires, ...CLES.facultatives])
    decoupeDe(id).forEach((e, i) => {
      const ou = `${id} #${i + 1}`
      for (const k of Object.keys(e)) if (!admises.has(k)) fautes.push(`${ou} — clé INCONNUE \`${k}\``)
      for (const k of CLES.obligatoires) if (!(k in e)) fautes.push(`${ou} — clé MANQUANTE \`${k}\``)
      for (const k of ['page', 'pageFin']) {
        if (!Number.isInteger(e[k]) || e[k] <= 0) fautes.push(`${ou} — \`${k}\` doit être un entier positif, pas ${JSON.stringify(e[k])}`)
      }
      for (const k of ['titre', 'ouverture', 'chapitre']) {
        if (k in e && (typeof e[k] !== 'string' || !e[k].trim())) fautes.push(`${ou} — \`${k}\` doit être une chaîne non vide`)
      }
    })
  }
  assert.deepEqual(fautes, [], `jeu de clés violé :\n${fautes.join('\n')}`)
})

// La PLAGE est lue au LIVRE et COPIÉE par les outils : c'est donc ICI, et nulle part ailleurs, que
// sa cohérence se juge. Le livre est un PAVAGE de ses pages : les fichiers se suivent sans trou, et
// deux voisins PARTAGENT au plus UNE page (la section suivante qui n'ouvre pas la sienne).
test('#1739 : les plages pavent le livre — débuts croissants, aucun trou, au plus UNE page partagée', () => {
  const fautes = []
  for (const id of IDS) {
    const l = decoupeDe(id)
    if (l[0].page !== 1) fautes.push(`${id} — le premier fichier ouvre p.${l[0].page}, pas p.1`)
    l.forEach((e, i) => {
      if (e.pageFin < e.page) fautes.push(`${id} #${i + 1} — pageFin ${e.pageFin} avant page ${e.page}`)
      const s = l[i + 1]
      if (!s) return
      if (s.page <= e.page && s.page !== e.page) fautes.push(`${id} #${i + 2} — début ${s.page} avant ${e.page}`)
      if (s.page !== e.pageFin && s.page !== e.pageFin + 1) {
        fautes.push(`${id} #${i + 2} — début p.${s.page} pour une fin précédente p.${e.pageFin} : ${s.page > e.pageFin + 1 ? 'TROU' : 'recouvrement de plus d’une page'}`)
      }
    })
  }
  assert.deepEqual(fautes, [], `les plages ne pavent pas le livre :\n${fautes.join('\n')}`)
})

// Le PREMIER niveau du sommaire ne se perd pas à la découpe : on lit le livre CHAPITRE par chapitre
// autant qu'élément par élément (#1388). Un chapitre est donc un SEGMENT de la liste — et quand le
// livre imprime une page d'ouverture à son titre, c'est la PREMIÈRE entrée du segment qui la porte.
test('#1388 : les entrées d’un chapitre sont CONTIGUËS, et son titre n’ouvre que sa première', () => {
  const fautes = []
  for (const id of IDS) {
    const l = decoupeDe(id)
    const vus = []
    let courant = null
    l.forEach((e, i) => {
      const c = e.chapitre ?? null
      if (c === courant) return
      if (c != null && vus.includes(c)) fautes.push(`${id} #${i + 1} — le chapitre « ${c} » revient à « ${e.titre} » après avoir été quitté`)
      if (c != null) vus.push(c)
      courant = c
    })
    const premiere = new Map()
    l.forEach((e, i) => { if (e.chapitre != null && !premiere.has(e.chapitre)) premiere.set(e.chapitre, i) })
    l.forEach((e, i) => {
      if (e.ouverture == null || e.chapitre == null) return
      if (e.ouverture === e.chapitre && premiere.get(e.chapitre) !== i) {
        fautes.push(`${id} #${i + 1} — « ${e.titre} » ouvre sur le titre du chapitre « ${e.chapitre} » sans en être la première entrée`)
      }
    })
  }
  assert.deepEqual(fautes, [], `le premier niveau du sommaire est rompu :\n${fautes.join('\n')}`)
})

// Un même TITRE peut revenir (le CRB imprime `POISONS` deux fois, aux règles et au guide d'achat) :
// le numéro sépare les fichiers. Ce qui ne peut pas revenir, c'est l'entrée ENTIÈRE — même titre,
// même ouverture, même page : ce serait une ligne saisie deux fois, et la seconde couperait à vide.
test('#1739 : aucune entrée n’est saisie deux fois (titre, ouverture et page identiques)', () => {
  const fautes = []
  for (const id of IDS) {
    const vus = new Set()
    for (const e of decoupeDe(id)) {
      const cle = `${e.titre} :: ${e.ouverture ?? ''} :: ${e.page}`
      if (vus.has(cle)) fautes.push(`${id} — ${cle}`)
      vus.add(cle)
    }
  }
  assert.deepEqual(fautes, [], `entrée(s) en double :\n${fautes.join('\n')}`)
})

// Le titre de la donnée EST celui du fichier écrit : s'il change en passant par `nomAscii`, le nom
// sur le disque ne serait plus celui que la liste déclare, et la garde `ouverture` comparerait un
// titre imprimé à un nom que personne n'a voulu.
test('#1739 : tout titre de fichier survit à `nomAscii` sans changer', () => {
  const fautes = []
  for (const id of IDS) {
    for (const e of decoupeDe(id)) {
      const nom = nomAscii(`01 - ${e.titre}.md`)
      if (titreDuFichier(nom) !== e.titre) fautes.push(`${id} — « ${e.titre} » → « ${titreDuFichier(nom)} »`)
    }
  }
  assert.deepEqual(fautes, [], `titres non ASCII :\n${fautes.join('\n')}`)
})

// Les ONGLETS DE CHAPITRE se lisent au PDF (`scripts/raw/onglets.py`, jamais joué ici : pas de PDF en
// CI) ; ce banc tient leur FORME contre la liste elle-même. Le champ est REQUIS : `null` DÉCLARE un
// livre sans onglet imprimé, son absence ne dit rien.
// Même motif que `scripts/raw/onglets.py` (sonde Python qui écrit la donnée) : deux langages, une définition.
const ROMAIN = /^(?=[IVXLC])C{0,3}(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

test('#1739 : `onglets` est déclaré — un tableau non vide, ou `null`', () => {
  const fautes = IDS.filter((id) => {
    const o = ongletsDe(id)
    return o !== null && !(Array.isArray(o) && o.length)
  }).map((id) => `${id}.json — \`onglets\` = ${JSON.stringify(ongletsDe(id))}`)
  assert.deepEqual(fautes, [], `\`onglets\` non déclaré :\n${fautes.join('\n')}`)
})

test('#1739 : chaque onglet porte un chiffre romain valide et une étendue `[a, b]` dans le livre, disjointe et ordonnée', () => {
  const fautes = []
  for (const id of IDS) {
    const onglets = ongletsDe(id)
    if (!Array.isArray(onglets)) continue
    const derniere = Math.max(...decoupeDe(id).map((e) => e.pageFin))
    onglets.forEach((o, i) => {
      const ou = `${id} onglet #${i + 1}`
      const cles = Object.keys(o ?? {}).sort().join(',')
      if (cles !== 'chiffre,pages') fautes.push(`${ou} — clés ${cles}, attendu chiffre,pages`)
      if (typeof o?.chiffre !== 'string' || !ROMAIN.test(o.chiffre)) fautes.push(`${ou} — chiffre romain invalide ${JSON.stringify(o?.chiffre)}`)
      const [a, b, ...reste] = Array.isArray(o?.pages) ? o.pages : []
      if (reste.length || !Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > derniere) {
        fautes.push(`${ou} — étendue ${JSON.stringify(o?.pages)} hors de [1, ${derniere}] ou mal formée`)
        return
      }
      const avant = onglets[i - 1]?.pages
      if (Array.isArray(avant) && a <= avant[1]) fautes.push(`${ou} — [${a}, ${b}] chevauche ou précède [${avant.join(', ')}]`)
    })
  }
  assert.deepEqual(fautes, [], `onglets mal formés :\n${fautes.join('\n')}`)
})

// Le GABARIT d'onglet est ce que la sonde lit : présent si et seulement si `onglets` l'est, et bien formé.
test('#1739 : `gabaritOnglet` est non nul si et seulement si `onglets` l’est, et porte police, taille et bandeHaute', () => {
  const fautes = []
  for (const id of IDS) {
    const brut = JSON.parse(readFileSync(join(DECOUPES_DIR, `${id}.json`), 'utf8'))
    const g = brut.gabaritOnglet
    if (g === undefined) { fautes.push(`${id}.json — \`gabaritOnglet\` absent`); continue }
    if ((g === null) !== (brut.onglets === null)) fautes.push(`${id}.json — \`gabaritOnglet\` ${g === null ? 'nul' : 'non nul'} pour des \`onglets\` ${brut.onglets === null ? 'nuls' : 'non nuls'}`)
    if (g === null) continue
    const cles = Object.keys(g ?? {}).sort().join(',')
    if (cles !== 'bandeHaute,police,taille') fautes.push(`${id}.json — clés du gabarit ${cles}, attendu bandeHaute,police,taille`)
    if (typeof g.police !== 'string' || !g.police.trim() || g.police.includes('+')) fautes.push(`${id}.json — \`police\` ${JSON.stringify(g.police)} : un nom sans préfixe de sous-ensemble`)
    for (const k of ['taille', 'bandeHaute']) {
      if (typeof g[k] !== 'number' || !(g[k] > 0)) fautes.push(`${id}.json — \`${k}\` ${JSON.stringify(g[k])} : un nombre de pt positif`)
    }
  }
  assert.deepEqual(fautes, [], `gabarit d’onglet incohérent :\n${fautes.join('\n')}`)
})

// Le GABARIT des titres d'entrée est ce que la sonde `scripts/raw/sonde-titres.mjs` lit : REQUIS,
// `null` déclare un livre non sondé ; sinon sept clés, chaque typographie `{ police, taille? }`, chaque
// police d'ORNEMENT (`glyphes`) `{ police, role, caracteres }`, rôle parmi `ROLES_DE_GLYPHE`, caractères
// mesurés au PDF (un caractère chacun, au moins un).
test('#1739 : `gabaritTitre` est déclaré — `null`, ou `{ titre, accompagnement, encadre, capitales, intertitre, exclusions, glyphes }` bien formés', () => {
  const fautes = []
  const typo = (ou, t, tailleRequise) => {
    const cles = Object.keys(t ?? {}).sort().join(',')
    if (cles !== 'police,taille' && (tailleRequise || cles !== 'police')) fautes.push(`${ou} — clés ${cles || '(aucune)'}`)
    if (typeof t?.police !== 'string' || !t.police.trim() || t.police.includes('+')) fautes.push(`${ou} — \`police\` ${JSON.stringify(t?.police)} : un nom sans préfixe de sous-ensemble`)
    if ('taille' in (t ?? {}) && !(typeof t.taille === 'number' && t.taille > 0)) fautes.push(`${ou} — \`taille\` ${JSON.stringify(t.taille)} : un corps en pt positif`)
  }
  for (const id of IDS) {
    const g = JSON.parse(readFileSync(join(DECOUPES_DIR, `${id}.json`), 'utf8')).gabaritTitre
    if (g === undefined) { fautes.push(`${id}.json — \`gabaritTitre\` absent`); continue }
    if (g === null) continue
    const cles = Object.keys(g).sort().join(',')
    if (cles !== 'accompagnement,capitales,encadre,exclusions,glyphes,intertitre,titre') fautes.push(`${id}.json — clés du gabarit ${cles}, attendu accompagnement,capitales,encadre,exclusions,glyphes,intertitre,titre`)
    typo(`${id}.json titre`, g.titre, true)
    typo(`${id}.json encadre`, g.encadre, true)
    typo(`${id}.json capitales`, g.capitales, false)
    typo(`${id}.json intertitre`, g.intertitre, true)
    for (const k of ['accompagnement', 'exclusions']) {
      if (!Array.isArray(g[k])) { fautes.push(`${id}.json — \`${k}\` doit être un tableau`); continue }
      g[k].forEach((t, i) => typo(`${id}.json ${k}[${i}]`, t, k === 'accompagnement'))
    }
    if (!Array.isArray(g.glyphes)) fautes.push(`${id}.json — \`glyphes\` doit être un tableau`)
    else g.glyphes.forEach((t, i) => {
      const cles = Object.keys(t ?? {}).sort().join(',')
      if (cles !== 'caracteres,police,role') fautes.push(`${id}.json glyphes[${i}] — clés ${cles || '(aucune)'}, attendu caracteres,police,role : une police d'ornement se lit à toute taille`)
      else typo(`${id}.json glyphes[${i}]`, { police: t.police }, false)
      if (!ROLES_DE_GLYPHE.includes(t?.role)) fautes.push(`${id}.json glyphes[${i}] — \`role\` ${JSON.stringify(t?.role)} : un rôle parmi ${ROLES_DE_GLYPHE.join(', ')}`)
      if (!Array.isArray(t?.caracteres) || !t.caracteres.length || t.caracteres.some((c) => typeof c !== 'string' || [...c].length !== 1 || !c.trim())) fautes.push(`${id}.json glyphes[${i}] — \`caracteres\` ${JSON.stringify(t?.caracteres)} : les caractères mesurés au PDF, un chacun`)
    })
  }
  assert.deepEqual(fautes, [], `gabarit de titre mal formé :\n${fautes.join('\n')}`)
})

// Tout CHAPITRE de la liste imprime son onglet quelque part : son segment de pages rencontre au moins
// une étendue.

test('#1739 : chaque `chapitre` de la liste est couvert par au moins une étendue d’onglet', () => {
  const fautes = []
  for (const id of IDS) {
    const onglets = ongletsDe(id)
    if (!Array.isArray(onglets)) continue
    const segments = new Map()
    for (const e of decoupeDe(id)) {
      if (e.chapitre == null) continue
      const s = segments.get(e.chapitre)
      segments.set(e.chapitre, s ? [s[0], Math.max(s[1], e.pageFin)] : [e.page, e.pageFin])
    }
    for (const [c, [a, b]] of segments) {
      if (!onglets.some((o) => o.pages[0] <= b && a <= o.pages[1])) fautes.push(`${id} — « ${c} » p.${a}-${b} : aucune étendue d’onglet`)
    }
  }
  assert.deepEqual(fautes, [], `chapitre(s) sans onglet :\n${fautes.join('\n')}`)
})

test('#1739 : le `book` déclaré dans le fichier redit le nom du fichier', () => {
  const fautes = []
  for (const id of IDS) {
    const brut = JSON.parse(readFileSync(join(DECOUPES_DIR, `${id}.json`), 'utf8'))
    if (brut.book !== id) fautes.push(`${id}.json — \`book\` = ${JSON.stringify(brut.book)}`)
    if (typeof brut.quoi !== 'string' || !brut.quoi.trim()) fautes.push(`${id}.json — \`quoi\` vide : un registre dit ce qu'il est`)
  }
  assert.deepEqual(fautes, [], `en-tête de liste :\n${fautes.join('\n')}`)
})
