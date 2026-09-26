// SONDE des TITRES D'ENTRÉE d'un livre extrait (#1739) : apparie chaque titre IMPRIMÉ au PDF (gabarit
// typographique `gabaritTitre` de `scripts/raw/decoupes/<id>.json`) à la ligne du `.md` qui précède la
// 1re ligne de SON corps, et classe chaque écart. Lecture seule : rien n'est écrit sous le dépôt.
//
// Le CORPS est l'ancre (il ne bouge jamais) : il se localise au PDF comme les lignes qui suivent le
// titre dans l'ordre de lecture (`scripts/raw/lib/colonnes.mjs`), puis dans le `.md`.
// FAMILLES : `entree` (le run de tête contient la typographie `titre`), `encadre` (le run commence par
// la typographie `encadre`, corps en prose), `tableau` (même typographie, corps en ligne de tableau `|`),
// `capitales` (le run est de la typographie `capitales` : titres de section en petites capitales, noms
// de créature compris), `intertitre` (le run commence par la typographie `intertitre` : titres du fil du
// texte d'un corps plus petit, événements et niveaux de carrière compris). `entree` et `intertitre` sont
// les familles d'ENTRÉE (`ENTREES`).
// FORMES (`FORMES`) :
//  — S : titre soudé à son corps ;
//  — F : gras de tête (hors étiquette `X:`) soudé à un corps ÉTRANGER, souvent celui de son JUMEAU
//    (titre imprimé au même y de la même page) ;
//  — M : titre migré (ligne de titre isolée, gras seul, ou groupe d'un titre composite avec son jumeau,
//    ailleurs) ; l'occurrence LIBRE la plus proche de son corps ;
//  — S′ : titre absent du livre comme titre et comme fragment, restauré ; les MENTIONS en prose sont
//    rapportées, elles ne valent pas fragment ; `S'-non-prouve` : le même hors familles d'ENTRÉE, sans
//    COMPTAGE (rapporté, jamais réparé) ;
//  — B : gras sans `#` ;
//  — O : entrée hors de l'ordre du PDF, à poser `devant` le titre qui la suit au PDF ;
//  — P, D, E, A, G, T, J : les formes du TEXTE (`formesDuTexte`) — paragraphe scindé, ligne déplacée
//    sous l'ancre d'une autre page, libellé soudé, appel de figure mêlé, gras italique perdu, tiret
//    cadratin perdu, joint `X/ Y` —, chacune PROUVÉE au PDF
//    site par site ; `paragraphe-non-prouve`, `libelle-non-prouve` et `cesure` sont rapportés, avec leur motif ;
//  — N : niveau différent du frère de même famille qui précède (rapporté) ;
//  — `corps-introuvable`, avec sa cause (`sans-ligne` : suivi d'un autre titre — rien entre eux qu'une
//    ligne sans LETTRE — que le `.md` ne départage pas ; `cle-courte` : aucune ligne de corps de deux
//    mots ; `hors-md` : corps absent des `.md` de sa page) ;
//  — glyphe-fuite : la ligne du `.md` est un caractère d'un glyphe `titre` (`gabarit.glyphes[].caracteres`)
//    suivi du titre en gras seul (`glypheFuite`) : PRÉSENT, à sa place, jamais S′ ni M ; réparé en ligne
//    de titre (glyphe ôté, niveau du frère) ;
//  — `place-non-prouvee` : hors familles d'ENTRÉE et sans COMPTAGE, sa clé est une ligne de titre LIBRE
//    d'un `.md` de sa page — présent, pas absent —, sa place non prouvée ; son corps CANDIDAT
//    (`corpsCandidat`) est rapporté quand une clé de CORPS l'a trouvé (jamais une clé de RANGÉES),
//    jamais réservé ;
//  — `cible-invalide` : une cible qui n'est pas le DÉBUT d'un bloc Markdown ;
//  — `doublon` : DÉBRIS devant un corps dont le titre est à sa place (toutes familles), un titre imprimé
//    UNE fois au PDF et porté une seconde fois par le `.md` — preuve : les deux comptes.
// AUCUNE FORME MUETTE : tout titre qui n'est pas à sa place sort en site, toutes familles, keyé par
// (page, x0, y0). Hors familles d'ENTRÉE (encadrés, tableaux, capitales), leur place dans le `.md` suit la
// mise en page, pas l'ordre du PDF : jamais O, et M seulement quand le titre qui le SUIT l'a résolu
// (`viaSuivant`, titre suivi d'un titre) ; leur S′ n'est RÉPARABLE que par COMPTAGE : un titre que les
// pages de son fichier impriment PLUS de fois que son `.md` ne le porte (capitales : une fois au moins).
// Le même comptage (zéro fois au moins), sur une légende de tableau, est `legende-absente`.
// Un corps en tableau se juge par la ligne qui précède l'EN-TÊTE de son bloc ; sa légende est un
// paragraphe `**X**` seul (`TableParse.titre`, `src/data/source/decoupe.ts`), jamais un titre :
//  — L : légende portée en ligne de titre `#` (`ligneLegende` : la même, `#` ôtés,
//    ancres de page en tête), ou en BANNIÈRE (1re rangée de la table, une seule cellule pleine :
//    `enTete` = `rangee`, la rangée suivante devient l'en-tête, ou `vide` quand une de ses cellules
//    est une PHRASE, trois mots au moins et ponctuation finale — CRB 040:13 « A single dose counts as
//    10 doses. » ; « Mod. », « Carac. » n'en sont pas).
// Un titre d'encadré sur la LIGNE DE BASE d'un autre du même gabarit (même page, même y) est un EN-TÊTE
// DE COLONNE (`colonne`), jamais une légende : rapporté, jamais réparé.
// Toute CIBLE (`cible`, `devant`) est le DÉBUT d'un bloc Markdown ; une ligne de tableau se remonte à
// l'en-tête de son bloc ; sinon le site sort en `cible-invalide`, avec sa forme visée et la ligne visée.
// `titreMd` : le texte EXACT du titre dans le `.md` (S, F, M, B, O), ce que la réparation déplace.
// Les ancres `<span id="page-…"></span>` ne comptent pas (`stripSpans`, `src/data/source/decoupe.ts`).
//
// STOCK NOMINATIF (`scripts/raw/sonde-titres-stock.json`, régime #1711) : une ENTRÉE par site émis hors
// `colonne`, clé `fichier :: ref :: occurrence` (`guards/lib/stock.mjs`, `cleDeSite`) ; `fichier` = le
// 1er `.md` de la page du titre, `ref` = forme, page et titre imprimé — l'IDENTITÉ du site, jamais une
// ligne du `.md`. Un livre sondé ne réécrit que SES entrées.
//
// Usage :
//   node scripts/raw/sonde-titres.mjs <id> [--boites <boites.json>] [--json <sortie.json>]
//   node scripts/raw/sonde-titres.mjs <id> [--boites <boites.json>] --ecrire-stock [--lot <#N …>]
//   `--boites` : le JSON de `scripts/raw/lib/pdf-lignes.py` déjà produit (sinon la sonde le produit
//   dans un dossier temporaire) ; `--json` : les sites, pour la réparation, HORS du dépôt ;
//   `--ecrire-stock` : le stock, lot REQUIS dès qu'une entrée NEUVE naît (`ecrireStockSousLot`).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decoupeDe, gabaritTitreDe, livreExtraitDe, nomsDeLaListe, normalize, readText } from './_lib.mjs'
import { lignes } from './lib/colonnes.mjs'
import { cellulesDe, estSeparateur, stripSpans } from '../../src/data/source/decoupe.ts'
import { FOLIO_ATTR, foliosRoulants } from '../../src/data/source/ancre-vide.ts'
import { grasOuvert, prosePrecedenteCoupee, recoller } from './lib/titres-soudes.mjs'
import { canoniser, relatifSousRacine } from '../docs/lib/chemin-mesure.mjs'
import { ecartDuVolet, ecrireStockSousLot, sitesEnEntrees, survieDeLecheance } from '../guards/lib/stock.mjs'
import { parCleDeSite, readStock, texteDeStock } from './stockNominatif.mjs'

const PDF_LIGNES = join(dirname(fileURLToPath(import.meta.url)), 'lib', 'pdf-lignes.py')

/** Forme de comparaison : `normalize` (emphase, tirets, apostrophes, casse), plus le glyphe de
 *  remplacement que l'extraction PDF rend pour l'apostrophe, l'échappement Markdown, les préfixes de
 *  ligne (`#`, `>`, puce `-`) et les séparateurs de cellule de tableau (`|`). PURE. */
export const cle = (s) =>
  normalize(stripSpans(String(s)).replace(/^(?:#{1,6}|>|-)\s+/, '').replace(/\\(.)/g, '$1').replace(/[\ufffd‘]/g, "'").replace(/\|/g, ' '))

const cleDeTitre = (s) => cle(s).replace(/:$/, '')

/** Clé d'un titre IMPRIMÉ : sans préfixe Markdown à ôter (`# Tentacles` est le titre). PURE. */
export const cleDuPdf = (s) => normalize(String(s).replace(/[\ufffd‘]/g, "'")).replace(/:$/, '')

const memeTypo = (s, t) => s.police === t.police && (t.taille == null || Math.abs(s.taille - t.taille) < 0.5)

/** Les RÔLES d'une police d'ornement (`gabarit.glyphes[].role`), mesurés au PDF : `titre` (ouvre un
 *  intertitre, CRB p.43-108), `puce` (item de liste), `onglet` (chiffre d'onglet de chapitre). */
export const ROLES_DE_GLYPHE = ['titre', 'puce', 'onglet']

/** Le GLYPHE d'ornement qui OUVRE la ligne (entrée de `gabarit.glyphes`, avec son `role`), ou null. PURE. */
export const glypheDeTete = (l, gabarit) => (l.spans[0] && gabarit.glyphes.find((t) => memeTypo(l.spans[0], t))) ?? null

/** Le texte d'une ligne sans son glyphe de TÊTE (vide : la ligne n'était que ce glyphe) ; un glyphe en
 *  milieu de ligne reste. PURE. */
export const sansGlyphe = (l, gabarit) => (glypheDeTete(l, gabarit) ? l.texte.trimStart().slice(l.spans[0].texte.length).trim() : l.texte)

/** Le texte porte-t-il une LETTRE ? Une ligne qui n'en porte aucune (glyphe seul, chiffres d'appel
 *  isolés) n'est pas un corps. PURE. */
export const aDesLettres = (texte) => /\p{L}/u.test(texte)

/** Position de `k` dans `c` sur FRONTIÈRE DE MOT (bord ou espace de part et d'autre), -1 sinon. PURE. */
export const surMot = (c, k) => {
  for (let i = c.indexOf(k); i >= 0; i = c.indexOf(k, i + 1)) if ((i === 0 || c[i - 1] === ' ') && (i + k.length === c.length || c[i + k.length] === ' ')) return i
  return -1
}

/**
 * Les TITRES imprimés d'une page, dans l'ordre de lecture : une ligne dont le RUN de tête (spans
 * consécutifs aux typographies du gabarit) CONTIENT la typographie `titre` (entrée), COMMENCE par
 * `encadre` (encadré ou tableau), par `capitales` ou par `intertitre`, et dont aucun span n'est d'une typographie
 * `exclusions`. Un span d'une police GLYPHE (`gabarit.glyphes`) en TÊTE de ligne est un ornement : hors
 * du run et du texte ; en milieu de ligne, il reste ; de rôle `titre`, il ouvre un intertitre dans la
 * POLICE d'intertitre à toute taille (CRB p.76). Un span de la police de tête à taille MOINDRE, suivi
 * de la typographie de tête ou de la fin de ligne, appartient au run (CRB p.7). `texte` = la ligne quand
 * le run la couvre (espacement lu par pdfminer : `T`+`roll` = `Troll`), sinon les spans du run séparés
 * d'une espace. Un titre imprimé sur DEUX lignes (lignes de
 * titre consécutives, même gabarit, même colonne, interligne < 1,4 × la taille) est UN titre ; `fin` =
 * l'indice de sa dernière ligne. PURE.
 * @returns {{ index: number, fin: number, texte: string, gabarit: 'entree' | 'encadre' | 'capitales' | 'intertitre' }[]}
 */
export function titresDeLaPage(lignesDeLaPage, gabarit) {
  const out = []
  const familles = [
    ['entree', [gabarit.titre, ...gabarit.accompagnement], gabarit.titre],
    ['encadre', [gabarit.encadre], gabarit.encadre],
    ['capitales', [gabarit.capitales], gabarit.capitales],
    ['intertitre', [gabarit.intertitre], gabarit.intertitre],
  ]
  lignesDeLaPage.forEach((l, index) => {
    if (l.spans.some((s) => gabarit.exclusions.some((t) => memeTypo(s, t)))) return
    const glyphe = glypheDeTete(l, gabarit)
    const g = glyphe ? 1 : 0
    for (const [nom, typosDuGabarit, teteDuGabarit] of familles) {
      const aToutCorps = nom === 'intertitre' && glyphe?.role === 'titre'
      const tete = aToutCorps ? { police: teteDuGabarit.police } : teteDuGabarit
      const typos = aToutCorps ? [tete] : typosDuGabarit
      let n = g
      const reduit = (k) => k > g && tete.taille != null && l.spans[k].police === tete.police && l.spans[k].taille < tete.taille - 0.5 && (k + 1 === l.spans.length || memeTypo(l.spans[k + 1], tete))
      while (n < l.spans.length && (typos.some((t) => memeTypo(l.spans[n], t)) || reduit(n))) n++
      const run = l.spans.slice(g, n)
      if (run.some((s) => memeTypo(s, tete))) {
        const texte = n === l.spans.length ? sansGlyphe(l, gabarit) : run.map((s) => s.texte).join(' ')
        const p = out.at(-1)
        const q = lignesDeLaPage[index - 1]
        if (p && p.fin === index - 1 && p.gabarit === nom && q.colonne === l.colonne && q.y0 - l.y0 > 0 && q.y0 - l.y0 < 1.4 * l.spans[g].taille) {
          Object.assign(p, { fin: index, texte: `${p.texte} ${texte}` })
        } else out.push({ index, fin: index, texte, gabarit: nom })
        return
      }
    }
  })
  return out
}

/** Clés de CORPS d'un titre, une par ligne qui le suit dans l'ordre de lecture (3 au plus) : ses 8
 *  premiers mots, sans le dernier au-delà de 3 (césure possible), 2 mots au moins. Une ligne du PDF ne
 *  déborde jamais sur la suivante : le `.md` peut couper là où le PDF enchaîne. PURE. */
export function clesDeCorps(suivantes) {
  const cles = []
  for (const l of suivantes) {
    const m = cle(l).split(' ').filter(Boolean)
    const k = (m.length > 3 ? m.slice(0, -1) : m).slice(0, 8)
    if (k.length >= 2) cles.push(k.join(' '))
    if (cles.length === 3) break
  }
  return cles
}

/** Ligne de titre Markdown : `{ niveau, texte, groupes }` (groupes gras), ou null. PURE. */
export function enTete(ligne) {
  const m = /^(#{1,6})\s+(.*)$/.exec(stripSpans(ligne))
  if (!m) return null
  return { niveau: m[1].length, texte: cleDeTitre(m[2]), groupes: [...m[2].matchAll(/\*\*([^*]+)\*\*/g)].map((g) => cleDeTitre(g[1])) }
}

/** BANNIÈRE d'une ligne de table (≥ 2 cellules, une seule pleine) : sa clé de titre, ou null. PURE. */
export const banniereDe = (ligne) => {
  if (!/^\s*\|/.test(stripSpans(ligne ?? ''))) return null
  const cellules = cellulesDe(stripSpans(ligne))
  const pleines = cellules.filter(Boolean)
  return cellules.length >= 2 && pleines.length === 1 ? cleDeTitre(pleines[0]) : null
}

/** Ligne FAITE d'un seul groupe gras (titre sans `#`) : son texte, ou null. PURE. */
export const grasSeul = (ligne) => {
  const m = /^\*\*([^*]+)\*\*\s*$/.exec(stripSpans(ligne).trimStart())
  return m ? cleDeTitre(m[1]) : null
}

/** Ligne du `.md` faite d'un caractère de glyphe `titre` (`gabarit.glyphes[].caracteres`, mesurés au PDF),
 *  d'une espace et d'un gras seul : `{ glyphe, texte }` (texte = clé du gras), ou null. PURE. */
export const glypheFuite = (ligne, gabarit) => {
  const m = /^(\S) \*\*([^*]+)\*\*\s*$/u.exec(stripSpans(ligne).trimStart())
  return m && gabarit.glyphes.some((g) => g.role === 'titre' && g.caracteres.includes(m[1])) ? { glyphe: m[1], texte: cleDeTitre(m[2]) } : null
}

/** La ligne EST un titre de clé `k` — ligne de titre, gras seul (légende `**X**`), ou gras à glyphe
 *  FUITÉ (`glypheFuite`) : jamais son propre corps. PURE. */
export const estLeTitre = (ligne, k, gabarit) => enTete(ligne)?.texte === k || grasSeul(ligne) === k || glypheFuite(ligne, gabarit)?.texte === k

/** Groupe gras de TÊTE d'une ligne (après `#` éventuels) : `{ texte, reste, etiquette }` —
 *  `etiquette` : le groupe finit par `:` (étiquette en ligne, `**Combat Reflexes:** …`) —, ou null. PURE. */
export const grasDeTete = (ligne) => {
  const m = /^(?:#{1,6}\s+)?\*\*([^*]+)\*\*\s*(.*)$/.exec(stripSpans(ligne).trimStart())
  return m ? { texte: cleDeTitre(m[1]), reste: m[2], etiquette: /:\s*$/.test(m[1]) } : null
}

/** Le texte EXACT d'un titre de clé `k` dans sa ligne `.md` : le plus court préfixe (`#` compris)
 *  de clé `k`, sinon le groupe gras de clé `k` (titre composite), sinon null. PURE. */
export function texteExact(ligne, k) {
  for (const m of ligne.matchAll(/\s|$/g)) {
    const p = ligne.slice(0, m.index).trim()
    if (p && cleDeTitre(p) === k) return p
  }
  return [...ligne.matchAll(/\*\*[^*]+\*\*/g)].find((g) => cleDeTitre(g[0]) === k)?.[0] ?? null
}

/** La casse d'un titre du `.md` : `titre` (chaque mot capitalisé), `majuscules`, ou `autre`. PURE. */
export const casseDe = (texte) => {
  const mots = texte.match(/\p{L}+/gu) ?? []
  if (mots.length && mots.every((m) => m === m.toUpperCase()) && mots.some((m) => m.length > 1)) return 'majuscules'
  return mots.length && mots.every((m) => m[0] === m[0].toUpperCase() && m.slice(1) === m.slice(1).toLowerCase()) ? 'titre' : 'autre'
}

/** Le texte `texte` dans la casse `casse` (`casseDe`), ou null pour `autre`. PURE. */
export const enCasse = (texte, casse) =>
  casse === 'majuscules' ? texte.toUpperCase() : casse === 'titre' ? texte.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : null

/** Indices de la plus longue sous-suite croissante de `vals` (ordre du PDF tenu par le `.md`). PURE. */
export function plusLongueCroissante(vals) {
  const pred = new Array(vals.length).fill(-1)
  const fins = []
  vals.forEach((v, i) => {
    let lo = 0
    let hi = fins.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (vals[fins[mid]] < v) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) pred[i] = fins[lo - 1]
    fins[lo] = i
  })
  const garde = new Set()
  for (let i = fins.at(-1) ?? -1; i >= 0; i = pred[i]) garde.add(i)
  return garde
}

/**
 * Le CLASSEMENT (PUR) : `pages` = `[{ page, lignes }]` dans l'ordre de lecture (`lib/colonnes.mjs`),
 * `fichiers` = `[{ nom, page, pageFin, lignes }]` dans l'ordre du livre, `gabarit` = `gabaritTitre`.
 * Rend `{ sites, titres }` : un site par écart, `titres` = tous les titres du PDF avec leur forme et leur
 * famille (`ok` compris).
 */
export function classer(pages, fichiers, gabarit) {
  const flux = pages.flatMap((p) => p.lignes.map((l) => ({ ...l, page: p.page })))
  const debutDePage = new Map()
  let n = 0
  for (const p of pages) {
    debutDePage.set(p.page, n)
    n += p.lignes.length
  }
  const titres = pages.flatMap((p) =>
    titresDeLaPage(p.lignes, gabarit).map((t) => ({ ...t, index: debutDePage.get(p.page) + t.index, fin: debutDePage.get(p.page) + t.fin, page: p.page })),
  )
  const estTitre = new Set(titres.flatMap((t) => Array.from({ length: t.fin - t.index + 1 }, (_, k) => t.index + k)))
  const cles = fichiers.map((f) => f.lignes.map(cle))
  const fichiersDeLaPage = (p) => [...fichiers.keys()].filter((i) => fichiers[i].page <= p + 1 && p <= fichiers[i].pageFin)
  const precedente = (fi, li) => {
    for (let f = fi, l = li - 1; f >= 0; f--, l = f >= 0 ? fichiers[f].lignes.length - 1 : 0) {
      for (; l >= 0; l--) if (fichiers[f].lignes[l].trim() && !/^\*Pages PDF/.test(fichiers[f].lignes[l])) return { f, l }
    }
    return null
  }
  const tousTitres = new Set(titres.map((t) => cleDuPdf(t.texte)))
  const clesDuFlux = flux.map((l) => ({ page: l.page, cle: cleDuPdf(l.texte) }))
  // DÉBRIS `k` devant un corps du fichier `f` : texte imprimé au PDF sur ses pages et porté plus de fois
  // par son `.md` (doublon). Un autre texte n'est pas un débris : la clé de corps a été trouvée plus
  // loin dans sa ligne.
  const debris = (k, f) => {
    const auPdf = clesDuFlux.filter((l) => fichiers[f].page <= l.page && l.page <= fichiers[f].pageFin && l.cle.startsWith(k))
    const auMd = cles[f].flatMap((c, j) => (c.startsWith(k) ? [adresse(f, j)] : []))
    if (auPdf.length && auMd.length > auPdf.length) return { forme: 'doublon', texte: k, auMd, auPdf: auPdf.map((l) => `p.${l.page} « ${l.cle} »`) }
    return null
  }
  const pris = new Set()
  let curseur = { f: -1, l: -1 }
  const adresse = (f, l) => `${fichiers[f].nom.slice(0, 3)}:${l + 1}`
  const ligneDeTable = (s) => /^\s*\|/.test(stripSpans(s ?? ''))
  /** L'en-tête du bloc de tableau contigu qui porte la ligne `l` (la ligne elle-même hors tableau). */
  const enteteDeTable = (f, l) => {
    const x = fichiers[f].lignes
    if (ligneDeTable(x[l])) while (l > 0 && ligneDeTable(x[l - 1])) l--
    return l
  }
  /** Une LÉGENDE de table : un gras seul dont la ligne non vide suivante est une ligne de tableau. */
  const legendeDeTable = (f, l) => {
    const x = fichiers[f].lignes
    if (!grasSeul(x[l])) return false
    let k = l + 1
    while (k < x.length && !x[k].trim()) k++
    return ligneDeTable(x[k])
  }
  /** Le nombre de clés `suite` que porte la section du `.md` ouverte à la ligne `v` (jusqu'au titre ou
   *  à la légende de table suivants). */
  const corroboration = (v, suite) => {
    let fin = v.l + 1
    while (fin < cles[v.f].length && !enTete(fichiers[v.f].lignes[fin]) && !legendeDeTable(v.f, fin)) fin++
    const section = cles[v.f].slice(v.l, fin).join(' ')
    return suite.filter((k) => surMot(section, k) >= 0).length
  }

  // Règle du DOUBLON inversée : les pages du fichier de son corps impriment le titre PLUS de fois que
  // ce `.md` ne le porte, `plancher` fois au moins (capitales : 1, le `.md` a gardé l'en-tête de profil,
  // perdu le titre ; tableau : 0, la table imprimée sous sa légende est la preuve).
  const comptage = (t, plancher) => {
    const f = t.corps.f
    const auPdf = clesDuFlux.filter((l) => fichiers[f].page <= l.page && l.page <= fichiers[f].pageFin && l.cle === t.cle).length
    const auMd = cles[f].filter((c) => c === t.cle).length
    return auMd >= plancher && auPdf > auMd ? { auPdf, auMd } : null
  }
  /** Le COMPTAGE qui prouve l'absence d'un titre hors ENTRÉES (capitales, tableau), ou null. */
  const compteDe = (t) => (t.famille === 'capitales' && t.corps ? comptage(t, 1) : t.famille === 'tableau' ? comptage(t, 0) : null)
  /** Hors ENTRÉES et sans COMPTAGE, sa clé est une ligne de titre LIBRE d'un `.md` de sa page : présent,
   *  sa place non prouvée — son corps n'est qu'un CANDIDAT, il ne se réserve pas ; rapporté seulement
   *  quand une clé de CORPS l'a trouvé, jamais une clé de RANGÉES (`parRangees`). */
  const placeNonProuvee = (t) => !ENTREES.has(t.famille) && !compteDe(t)
    && fichiersDeLaPage(t.page).some((fi) => fichiers[fi].lignes.some((x, li) => !pris.has(`titre ${fi}:${li}`) && enTete(x)?.texte === t.cle))
  for (const t of titres) {
    const l = flux[t.index]
    Object.assign(t, { colonne: l.colonne, x0: l.x0, y0: l.y0, cle: cleDuPdf(t.texte), famille: t.gabarit })
    // Une ligne IMPRIMÉE que pdfminer rend en plusieurs boîtes (même page, colonne et y) est UNE ligne,
    // ses morceaux de gauche à droite.
    const morceaux = []
    for (let i = t.fin + 1; i < flux.length && morceaux.length < 6 && flux[i].page <= t.page + 1; i++) {
      if (estTitre.has(i)) break
      const p = morceaux.at(-1)?.[0]
      if (p && p.page === flux[i].page && p.colonne === flux[i].colonne && Math.abs(p.y0 - flux[i].y0) < 1) morceaux.at(-1).push(flux[i])
      else morceaux.push([flux[i]])
    }
    const suivantes = morceaux.map((m) => m.sort((x, y) => x.x0 - y.x0).map((x) => sansGlyphe(x, gabarit)).filter(Boolean).join(' ')).filter(Boolean)
    t.corpsPdf = suivantes[0] ?? null
    t.cles = clesDeCorps(suivantes)
    // Une table dont chaque colonne est lue en colonne de page (CRB p.175, p.366) : son corps se lit en
    // RANGÉES, de haut en bas, sous le titre.
    if (!t.cles.length && t.gabarit === 'encadre') {
      const rangees = []
      const dessous = flux.filter((x, i) => x.page === t.page && x.y0 < l.y0 && !estTitre.has(i)).sort((a, b) => b.y0 - a.y0 || a.x0 - b.x0)
      for (const x of dessous) {
        const r = rangees.at(-1)
        if (r && Math.abs(r[0].y0 - x.y0) < 1) r.push(x)
        else if (rangees.length < 6) rangees.push([x])
        else break
      }
      t.cles = clesDeCorps(rangees.map((r) => r.map((x) => x.texte).join(' ')))
      t.parRangees = true
    }
    t.corps = null
    // Une clé à PLUSIEURS candidats se départage par les clés suivantes que porte la section de chacun
    // (jusqu'au titre suivant) : le mieux corroboré l'emporte ; aucun corroboré, la clé suivante est
    // essayée, puis le 1er choix revient (CRB p.176, p.335, p.367).
    let repli = null
    for (const [i, k] of t.cles.entries()) {
      const vus = fichiersDeLaPage(t.page).flatMap((fi) =>
        cles[fi].flatMap((c, j) => (surMot(c, k) >= 0 && !estLeTitre(fichiers[fi].lignes[j], t.cle, gabarit) && !pris.has(`corps ${fi}:${j}:${k}`) ? [{ f: fi, l: j, cle: k }] : [])),
      )
      const choix = (vs) => vs.find((v) => v.f > curseur.f || (v.f === curseur.f && v.l > curseur.l)) ?? vs[0] ?? null
      if (vus.length < 2) {
        t.corps = choix(vus)
        if (t.corps) break
        continue
      }
      const notes = vus.map((v) => corroboration(v, t.cles.slice(i + 1)))
      const max = Math.max(...notes)
      repli ??= choix(vus)
      if (!max) continue
      t.corps = choix(vus.filter((_, n) => notes[n] === max))
      break
    }
    t.corps ??= repli
    if (!t.corps) {
      t.forme = 'corps-introuvable'
      t.cause = !suivantes.some(aDesLettres) ? 'sans-ligne' : !t.cles.length ? 'cle-courte' : 'hors-md'
      continue
    }
    curseur = t.corps
    const { f, l: li, cle: k } = t.corps
    pris.add(`corps ${f}:${li}:${k}`)
    if (t.gabarit === 'encadre' && ligneDeTable(fichiers[f].lignes[li])) t.famille = 'tableau'
    const pos = surMot(cles[f][li], k)
    const prefixe = cles[f][li].slice(0, pos).trim().replace(/:$/, '')
    if (pos > 0 && prefixe === t.cle) {
      t.forme = 'S'
      t.titreMd = { f, l: li }
      pris.add(`titre ${f}:${li}`)
      continue
    }
    {
      // Un corps en LISTE se lit dès sa 1re puce : on remonte les puces qui précèdent la ligne trouvée ;
      // un corps en TABLEAU, dès l'en-tête de son bloc.
      let depuis = enteteDeTable(f, li)
      while (/^- /.test(fichiers[f].lignes[depuis] ?? '') && /^- /.test(fichiers[f].lignes[precedente(f, depuis)?.l ?? -1] ?? '') && precedente(f, depuis).f === f) {
        depuis = precedente(f, depuis).l
      }
      const p = precedente(f, depuis)
      const h = p && enTete(fichiers[p.f].lignes[p.l])
      if (h && h.texte === t.cle) {
        t.forme = 'ok'
        if (t.famille === 'tableau') t.enTitre = true
        if (pos > 0 && !tousTitres.has(prefixe) && !/^\s*\|/.test(fichiers[f].lignes[li])) {
          t.debris = debris(prefixe, f)
          if (t.debris) t.debris.texteMd = texteExact(fichiers[f].lignes[li], prefixe)
        }
        t.titreMd = { ...p, niveau: h.niveau }
        pris.add(`titre ${p.f}:${p.l}`)
        continue
      }
      const fuite = p && glypheFuite(fichiers[p.f].lignes[p.l], gabarit)
      if (fuite && fuite.texte === t.cle) {
        Object.assign(t, { forme: 'glyphe-fuite', titreMd: p, glyphe: fuite.glyphe })
        pris.add(`titre ${p.f}:${p.l}`)
        continue
      }
      if (p && grasSeul(fichiers[p.f].lignes[p.l]) === t.cle) {
        t.forme = t.famille === 'tableau' ? 'ok' : 'B'
        t.titreMd = p
        pris.add(`titre ${p.f}:${p.l}`)
        continue
      }
      if (t.famille === 'tableau' && banniereDe(fichiers[f].lignes[depuis]) === t.cle) {
        t.forme = 'L'
        t.banniere = { f, l: depuis }
        continue
      }
    }
    t.forme = 'absent'
    if (placeNonProuvee(t)) pris.delete(`corps ${f}:${li}:${k}`)
  }

  // Titre SUIVI d'un titre (`sans-ligne`, rien entre eux qu'une ligne sans LETTRE : glyphe seul, chiffres
  // d'appel d'un exemple légendé, CRB p.43) : résolu du
  // DERNIER au premier, par le suivant. À sa place si la ligne du `.md` qui précède le titre du suivant
  // (ok, S, B, glyphe-fuite) est lui — les lignes sans LETTRE sautées, des DEUX côtés — ; sinon absent
  // devant le titre du suivant ; suivant absent (M, F, S′) : absent, cible = celle du suivant.
  for (let i = titres.length - 2; i >= 0; i--) {
    const [t, u] = [titres[i], titres[i + 1]]
    if (t.forme !== 'corps-introuvable' || t.cause !== 'sans-ligne' || flux.slice(t.fin + 1, u.index).some((x) => aDesLettres(sansGlyphe(x, gabarit)))) continue
    if (u.titreMd && ['ok', 'S', 'B', 'glyphe-fuite'].includes(u.forme)) {
      let p = precedente(u.titreMd.f, u.titreMd.l)
      while (p && !aDesLettres(stripSpans(fichiers[p.f].lignes[p.l]))) p = precedente(p.f, p.l)
      const ligne = p && !pris.has(`titre ${p.f}:${p.l}`) ? fichiers[p.f].lignes[p.l] : null
      const h = ligne && enTete(ligne)
      delete t.cause
      t.corps = { f: u.titreMd.f, l: u.titreMd.l }
      if (h && h.texte === t.cle) Object.assign(t, { forme: 'ok', titreMd: { ...p, niveau: h.niveau } })
      else if (ligne && grasSeul(ligne) === t.cle) Object.assign(t, { forme: 'B', titreMd: p })
      else if (ligne && glypheFuite(ligne, gabarit)?.texte === t.cle) Object.assign(t, { forme: 'glyphe-fuite', titreMd: p, glyphe: glypheFuite(ligne, gabarit).glyphe })
      else Object.assign(t, { forme: 'absent', viaSuivant: true })
      if (t.titreMd) pris.add(`titre ${p.f}:${p.l}`)
    } else if (u.forme === 'absent' && u.corps) {
      delete t.cause
      Object.assign(t, { forme: 'absent', viaSuivant: true, corps: u.corps })
    }
  }

  // Titre ABSENT devant son corps : son occurrence LIBRE la plus proche (fichiers de sa page, puis le
  // livre ; dans un fichier, la plus petite distance en lignes à son corps, sinon au titre à sa place de
  // sa page — `repere` —, la première à distance égale). Ne vaut titre ou fragment qu'une ligne de titre
  // isolée ou un gras seul (M : familles d'ENTRÉE, ou tout titre que son suivant a résolu, `viaSuivant`),
  // un groupe d'un titre composite avec son JUMEAU (familles d'ENTRÉE), ou un gras de TÊTE de ligne qui
  // n'est pas une étiquette (`X:`) : soudé au corps de son jumeau ou à un autre corps (F, toute famille).
  // Le reste est MENTION.
  const jumeaux = (t) => titres.filter((u) => u !== t && u.page === t.page && Math.abs(u.y0 - t.y0) <= 2)
  // EN-TÊTE DE COLONNE, jamais légende : un titre d'encadré sur la ligne de base d'un autre du même
  // gabarit, même page (CRB p.149, p.188 : Δy 0 ; encadrés voisins p.130 : Δy 1,88, tables voisines
  // p.189 : Δy 1,13).
  const memeLigneDeBase = (t, u) => u !== t && u.page === t.page && Math.abs(u.y0 - t.y0) < 0.5
  for (const t of titres) if (t.gabarit === 'encadre' && titres.some((u) => u.gabarit === 'encadre' && memeLigneDeBase(t, u))) t.forme = 'colonne'
  for (const t of titres) if (t.enTitre && t.forme === 'ok') t.forme = 'L'
  const ordreDeRecherche = (p) => [...new Set([...fichiersDeLaPage(p), ...fichiers.keys()])]
  const repere = (t, fi) => {
    if (t.corps?.f === fi) return t.corps.l
    const i = titres.indexOf(t)
    const ancre = (j) => titres[j].forme === 'ok' && titres[j].titreMd?.f === fi
    for (let j = i - 1; j >= 0 && titres[j].page === t.page; j--) if (ancre(j)) return titres[j].titreMd.l
    for (let j = i + 1; j < titres.length && titres[j].page === t.page; j++) if (ancre(j)) return titres[j].titreMd.l
    return 0
  }
  for (const t of titres.filter((x) => x.forme === 'absent')) {
    const siens = jumeaux(t)
    const entree = ENTREES.has(t.famille)
    let vu = null
    for (const fi of ordreDeRecherche(t.page)) {
      const vus = []
      for (let li = 0; li < fichiers[fi].lignes.length; li++) {
        if (pris.has(`titre ${fi}:${li}`)) continue
        let vu = null
        const ligne = fichiers[fi].lignes[li]
        const h = enTete(ligne)
        const tete = grasDeTete(ligne)
        if ((entree || t.viaSuivant) && h && h.texte === t.cle) vu = { forme: 'M', f: fi, l: li, comment: 'ligne de titre isolée' }
        else if ((entree || t.viaSuivant) && grasSeul(ligne) === t.cle) vu = { forme: 'M', f: fi, l: li, comment: 'gras seul' }
        else if (entree && h && h.groupes.includes(t.cle) && siens.some((u) => h.groupes.includes(u.cle))) {
          vu = { forme: 'M', f: fi, l: li, comment: 'groupe d’un titre composite avec son jumeau' }
        } else if (tete && tete.texte === t.cle && !tete.etiquette && tete.reste.trim()) {
          const jumeau = siens.some((u) => u.cles.some((k) => cle(tete.reste).startsWith(k)))
          vu = { forme: 'F', f: fi, l: li, comment: jumeau ? 'soudé en tête du corps de son jumeau' : 'soudé en tête d’un corps étranger' }
        }
        if (vu) vus.push(vu)
      }
      if (vus.length) {
        const ref = repere(t, fi)
        vu = vus.reduce((a, b) => (Math.abs(b.l - ref) < Math.abs(a.l - ref) ? b : a))
        break
      }
    }
    if (vu) {
      Object.assign(t, { forme: vu.forme, titreMd: { f: vu.f, l: vu.l }, comment: vu.comment })
      if (!vu.comment.startsWith('groupe')) pris.add(`titre ${vu.f}:${vu.l}`)
      continue
    }
    // Hors ENTRÉES : le COMPTAGE prouve l'absence ; sans lui, une ligne de titre LIBRE de sa clé dans un
    // `.md` de sa page dit le titre PRÉSENT, sa place non prouvée (`place-non-prouvee`) ; sinon
    // l'absence reste non prouvée.
    const compte = compteDe(t)
    if (placeNonProuvee(t)) {
      Object.assign(t, { forme: 'place-non-prouvee', corpsCandidat: t.parRangees ? null : t.corps, corps: null })
      continue
    }
    t.forme = ENTREES.has(t.famille) || compte ? "S'" : "S'-non-prouve"
    t.mentions = fichiers.flatMap((fx, fi) => fx.lignes.flatMap((x, li) => (cles[fi][li].includes(t.cle) ? [adresse(fi, li)] : [])))
    if (compte) t.comptage = compte
  }

  // O : l'entrée (titre et corps) hors de la plus longue sous-suite qui tient l'ordre du PDF, parmi les
  // ENTRÉES seules (`ENTREES` ; encadrés, tableaux et capitales suivent la mise en page).
  const places = titres.filter((t) => t.corps && ENTREES.has(t.famille))
  const tenus = plusLongueCroissante(places.map((t) => t.corps.f * 1e6 + t.corps.l))
  places.forEach((t, i) => {
    if (!tenus.has(i)) t.hors = true
  })

  // N : niveau différent du frère de même famille qui le précède dans le même fichier.
  const dernier = new Map()
  for (const t of titres) {
    if (t.forme !== 'ok') continue
    const k = `${t.famille} ${t.titreMd.f}`
    const avant = dernier.get(k)
    if (avant && avant.titreMd.niveau !== t.titreMd.niveau) {
      t.niveauErratique = { niveau: t.titreMd.niveau, frere: avant.texte, niveauFrere: avant.titreMd.niveau }
    }
    dernier.set(k, t)
  }

  // Toute CIBLE (`cible`, `devant`) est le DÉBUT d'un bloc Markdown : ligne non vide, en tête de fichier
  // ou après une ligne vide ou un titre. Une ligne de tableau se remonte d'abord au DÉBUT de son bloc
  // contigu (l'en-tête). Sinon le site sort en `cible-invalide`, avec la forme visée : poser un titre là
  // casserait le bloc.
  const debutDeBloc = ({ f, l }) => {
    const x = fichiers[f].lignes
    l = enteteDeTable(f, l)
    return x[l]?.trim() && (l === 0 || !x[l - 1].trim() || enTete(x[l - 1])) ? { f, l } : null
  }
  const sites = []
  const emettre = (s, cibles) => {
    const poses = {}
    for (const [champ, v] of Object.entries(cibles)) {
      if (!v) continue
      const d = debutDeBloc(v)
      if (!d) return sites.push({ ...s, forme: 'cible-invalide', formeVisee: s.forme, champ, [champ]: adresse(v.f, v.l), ligneCible: fichiers[v.f].lignes[v.l] })
      poses[champ] = adresse(d.f, d.l)
    }
    sites.push({ ...s, ...poses })
  }
  const cible = (t) => (t.corps ? adresse(t.corps.f, t.corps.l) : null)
  const ouEst = (t) => t.titreMd ?? t.corps
  const exact = (t) => (t.titreMd ? texteExact(fichiers[t.titreMd.f].lignes[t.titreMd.l], t.cle) : null)
  // La LIGNE DE TITRE à poser : niveau du FRÈRE TYPOGRAPHIQUE précédent (titre du PDF de même gabarit, à
  // sa place dans le MÊME fichier que son corps ; le suivant pour le premier du fichier), gras comme lui ;
  // texte = celui du `.md` (`titreMd`), ou, restauré (S′), le texte imprimé — des capitales, dans la
  // casse du frère (le span SC700 n'en porte pas).
  const poser = (t, i, texteMd) => {
    let u = null
    const frere = (j) => titres[j].gabarit === t.gabarit && titres[j].forme === 'ok' && titres[j].titreMd.niveau != null && titres[j].titreMd.f === t.corps.f
    for (let j = i - 1; j >= 0 && !u; j--) if (frere(j)) u = titres[j]
    for (let j = i + 1; j < titres.length && !u; j++) if (frere(j)) u = titres[j]
    if (!u) return { ligneTitre: null, frere: null }
    const ligneU = stripSpans(fichiers[u.titreMd.f].lignes[u.titreMd.l]).replace(/^#{1,6}\s+/, '')
    const nu = texteMd ? texteMd.replace(/^#{1,6}\s+/, '') : ENTREES.has(t.famille) ? t.texte : enCasse(t.texte, casseDe(ligneU.replace(/\*/g, '')))
    const texte = nu && /^\*\*[^*]+\*\*/.test(ligneU) && !nu.startsWith('**') ? `**${nu}**` : nu && grasOuvert(nu) ? `${nu}**` : nu
    return { ligneTitre: texte ? `${'#'.repeat(u.titreMd.niveau)} ${texte}` : null, frere: `${adresse(u.titreMd.f, u.titreMd.l)} « ${u.texte} »` }
  }
  // L : la ligne de titre, ou la bannière, et ce qu'elle devient.
  const legende = (t) => {
    if (!t.banniere) {
      const ligne = fichiers[t.titreMd.f].lignes[t.titreMd.l]
      const [, a, b, x] = /^((?:<span[^>]*>\s*<\/span>\s*)*)#{1,6}\s+((?:<span[^>]*>\s*<\/span>\s*)*)(.*)$/.exec(ligne)
      const nu = x.replace(/\s+#+\s*$/, '').trim()
      return { site: adresse(t.titreMd.f, t.titreMd.l), titreMd: ligne, ligneLegende: `${a}${b.trim()}${/^\*\*[^*]+\*\*$/.test(nu) ? nu : `**${nu}**`}` }
    }
    const { f, l } = t.banniere
    const x = fichiers[f].lignes
    let r = l + 1
    while (r < x.length && estSeparateur(stripSpans(x[r]))) r++
    const phrase = cellulesDe(stripSpans(x[r] ?? '')).some((c) => /[.!?]$/.test(c) && c.split(/\s+/).length >= 3)
    const ligne = x[l]
    return { site: adresse(f, l), titreMd: ligne, ligneLegende: `**${cellulesDe(stripSpans(ligne)).filter(Boolean).join(' ')}**`, enTete: phrase ? 'vide' : 'rangee' }
  }
  // Un titre DÉPLACÉ vers un autre fichier (F, M, O) : sa page doit tenir dans la découpe de celui-ci.
  const decoupe = (t, vers) => {
    const de = t.titreMd?.f
    if (vers == null || de == null || de === vers.f) return {}
    const ok = fichiers[vers.f].page <= t.page && t.page <= fichiers[vers.f].pageFin
    return { interFichiers: `${fichiers[de].nom.slice(0, 3)} → ${fichiers[vers.f].nom.slice(0, 3)}, p.${t.page} ${ok ? 'dans' : 'HORS de'} ${fichiers[vers.f].page}-${fichiers[vers.f].pageFin}`, horsDecoupe: !ok }
  }
  titres.forEach((t, i) => {
    const base = { famille: t.famille, page: t.page, colonne: t.colonne, x0: t.x0, y0: t.y0, titre: t.texte }
    const site = t.titreMd ? adresse(t.titreMd.f, t.titreMd.l) : null
    if (t.debris) sites.push({ ...t.debris, site: cible(t), ...base })
    const pose = () => poser(t, i, t.forme === "S'" ? null : exact(t))
    if (t.forme === 'colonne') sites.push({ forme: 'colonne', site: null, ...base })
    else if (t.forme === 'S' || t.forme === 'B') sites.push({ forme: t.forme, site, titreMd: exact(t), ...pose(), ...base })
    else if (t.forme === 'glyphe-fuite') sites.push({ forme: 'glyphe-fuite', site, ligneMd: fichiers[t.titreMd.f].lignes[t.titreMd.l], glyphe: t.glyphe, titreMd: exact(t), ...pose(), ...base })
    else if (t.forme === 'F' || t.forme === 'M') emettre({ forme: t.forme, site, titreMd: exact(t), cible: cible(t), ...pose(), ...decoupe(t, t.corps), comment: t.comment, ...base }, { cible: t.corps })
    else if (t.forme === 'L') sites.push({ forme: 'L', ...legende(t), ...base })
    else if (t.forme === "S'" && t.famille === 'tableau') emettre({ forme: 'legende-absente', site: null, cible: cible(t), ligneLegende: `**${t.texte}**`, mentions: t.mentions, comptage: t.comptage, ...base }, { cible: t.corps })
    else if (t.forme === "S'") emettre({ forme: "S'", site: null, cible: cible(t), ...pose(), mentions: t.mentions, ...(t.comptage ? { comptage: t.comptage } : {}), ...base }, { cible: t.corps })
    else if (t.forme === "S'-non-prouve") sites.push({ forme: "S'-non-prouve", site: null, corps: cible(t), mentions: t.mentions, ...base })
    else if (t.forme === 'place-non-prouvee') sites.push({ forme: 'place-non-prouvee', site: null, corpsCandidat: t.corpsCandidat ? adresse(t.corpsCandidat.f, t.corpsCandidat.l) : null, ...base })
    else if (t.forme === 'corps-introuvable') sites.push({ forme: 'corps-introuvable', site: null, cause: t.cause, corpsPdf: t.corpsPdf, ...base })
    if (t.hors) {
      const suivant = titres.slice(i + 1).find((u) => ENTREES.has(u.famille) && ouEst(u))
      const devant = suivant && ouEst(suivant)
      emettre({ forme: 'O', site, titreMd: exact(t), corps: cible(t), devant: devant ? adresse(devant.f, devant.l) : null, titreSuivant: suivant?.texte ?? null, ...decoupe(t, devant), ...base }, { devant })
    }
    if (t.niveauErratique) sites.push({ forme: 'N', site, ...t.niveauErratique, ...base })
  })

  sites.push(...formesDuTexte({ pages, flux, fichiers, cles, adresse, estTitre, titres }))
  return { sites, titres }
}

/**
 * Les formes du TEXTE (#1739) : la prose que l'extraction a coupée, mêlée ou dépouillée de sa
 * typographie, chacune PROUVÉE au PDF site par site. PURE.
 *  — P : paragraphe scindé — la ligne `i` du `.md`, que précède une prose coupée `j`
 *    (`lib/titres-soudes.mjs#prosePrecedenteCoupee`), commence par la ligne `b` du PDF qui SUIT `a`, fin
 *    de `j`, dans la même colonne, sans retrait de `b` sur `a` ; `b` n'ouvre pas un libellé (gras de tête qui porte `:`), le 1er mot
 *    de `b` ne tenait pas sur `a` (`marge` de `lib/colonnes.mjs#lignes`) — ou le texte CONTINUE : `a` finit
 *    sur `,`, `-` ou `/`, ou `b` s'ouvre en minuscule (`par`) —, et la typographie CONTINUE de `a` à
 *    `b` (même police, ou `b` tout en gras poursuivi en gras). Sans aucune des deux preuves, la ligne à
 *    candidat unique est rapportée (`paragraphe-non-prouve`) ; le joint `X-`/`X/` + `y` d'une CÉSURE (le
 *    livre imprime `Xy`, jamais `X-y`/`X/y`) aussi (`cesure`). Si `i` porte ensuite un libellé `**X:**`
 *    qui ouvre une ligne du PDF après `b`, la ligne se COUPE avant lui (`etiquette`). Entre deux preuves,
 *    l'emphase du `.md` de part et d'autre de la coupure (`*`, `**`) départage ; sans elle, pas de site ;
 *  — D : ligne déplacée — la ligne `i` du `.md` commence par la ligne `b` du PDF, que précède `a` avec
 *    la preuve de P (même colonne, sans retrait, typographie continue, 1er mot qui ne tenait pas ou texte
 *    qui continue) ; le folio de la page de `b` (lu aux ancres du livre) n'est PAS le folio roulant de `i`
 *    (`ancre-vide.ts#foliosRoulants`), c'est celui d'une autre ligne de prose `j` du fichier, qui FINIT par
 *    `a`. Une seule paire `(b, j)`, sinon pas de site. Les deux clés font au moins `CLE_MIN` caractères ;
 *    une ligne d'une page qu'aucune ancre du livre ne folioie n'a pas de folio, D ne la voit pas (mesure
 *    #1739, CRB : 378 pages PDF, 378 folioées) ;
 *  — A : appel de figure — un nombre imprimé dans une pastille (`cercles` de `lib/pdf-lignes.py`), MÊLÉ
 *    en queue de la ligne du `.md` qui porte les mots d'une ligne voisine (même colonne, 16 pt) ;
 *  — G : gras italique perdu — un run `BoldItalic` du PDF rendu `*x*` par la ligne du `.md` qui porte
 *    la ligne du PDF où il commence — à défaut, la ligne qu'un P recolle, qui le porte recollé ; si elle porte `x` sous deux emphases, l'occurrence n'est pas
 *    désignée : pas de site ;
 *  — T : tiret cadratin perdu — `X — Y` au PDF, dans une ligne ou à sa jointure (tiret qui ferme la
 *    ligne, ou qui ouvre la suivante), `X Y` dans la ligne du `.md` qui porte la ligne du tiret ;
 *  — E : libellé soudé — un libellé `**X:**` au milieu d'une ligne du `.md` OUVRE sa ligne au PDF (la
 *    ligne du `.md` porte, dès lui, cette ligne) après la ligne dont la ligne du `.md` porte la fin avant
 *    lui, et son 1er mot TENAIT sur cette ligne — ou ce libellé est absent de `enMilieu` (mesuré sur les
 *    lignes du PDF) et son compte en tête de ligne atteint `OUVERTURES_PROBANTES`, ou moins
 *    mais la ligne précédente CLÔT son élément (ni `,`, ni `-`, ni `/` final) — sinon rapporté
 *    (`libelle-non-prouve`) : la ligne se coupe avant lui. Le libellé qu'un P coupe déjà (`etiquette`) n'en est pas un.
 *  — J : joint mal fait — `X/ Y` (ou `X- Y`) dans une ligne du `.md` qui porte une ligne du PDF finie
 *    par `X/` (`X-`) que suit une ligne ouverte par `Y` ; le livre imprime `X/Y` (`X-Y`) ailleurs — pour
 *    `/`, ou ni `XY` ni `X/Y` —, jamais `XY` seul.
 * Une ligne du `.md` ne répond qu'à une ligne du PDF de SA plage de pages : de la page du titre à sa
 * place qui la précède dans son fichier à celle du titre à sa place qui la suit.
 */
// Mesure #1739 (CRB) : ouvertures de ligne des libellés que la preuve typographique de E porte — 1, 2, 3, 5 | 7, 10, 29, 257, 259.
const OUVERTURES_PROBANTES = 6
// Clé la plus courte qu'une ligne DÉPLACÉE (D) doit porter pour se juger : « for the world. » (CRB p.62) en porte 14.
const CLE_MIN = 8

function formesDuTexte({ pages, flux, fichiers, cles, adresse, estTitre, titres }) {
  const sites = []
  const reperes = fichiers.map((_, f) => titres.filter((t) => t.forme === 'ok' && t.titreMd.f === f).map((t) => ({ l: t.titreMd.l, page: t.page })).sort((x, y) => x.l - y.l))
  const surSaPage = (f, i, page) => {
    const avant = reperes[f].filter((x) => x.l <= i).at(-1)?.page ?? fichiers[f].page
    const apres = reperes[f].find((x) => x.l > i)?.page ?? fichiers[f].pageFin
    return Math.min(avant, apres) <= page && page <= Math.max(avant, apres)
  }
  const gras = (span) => /Bold/.test(span?.police ?? '')
  const suit = (a, b) => !!a && !!b && a.page === b.page && a.colonne === b.colonne && a.y0 - b.y0 > 0 && a.y0 - b.y0 < 16
  const libelle = (l) => gras(l.spans[0]) && l.spans[0].texte.includes(':')
  const nePasTenir = (a, b) => {
    const mot = b.texte.trim().split(/\s+/)[0]
    return a.x1 + ((b.x1 - b.x0) / Math.max(1, b.texte.length)) * (mot.length + 1) > a.marge
  }
  const emphaseDe = (span) => (/BoldItalic/.test(span.police) ? 'gras-italique' : /Bold/.test(span.police) ? 'gras' : /Italic/.test(span.police) ? 'italique' : 'romain')
  const emphaseMd = (bout) => (/^\*\*\*/.test(bout) ? 'gras-italique' : /^\*\*/.test(bout) ? 'gras' : /^\*/.test(bout) ? 'italique' : 'romain')
  const accord = (md, span) => md === emphaseDe(span) || (md === 'italique' && emphaseDe(span) === 'gras-italique')
  const continu = (a, b, c) => memeTypo(a.spans.at(-1), b.spans[0]) || (b.spans.every(gras) && suit(b, c) && gras(c.spans[0]))
  const prefixes = (x, y) => x.length > 0 && y.length > 0 && (x.startsWith(y) || y.startsWith(x))
  const suffixes = (x, y) => x.length > 0 && y.length > 0 && (x.endsWith(y) || y.endsWith(x))
  const surSesPages = (fx, page) => fx.page <= page && page <= fx.pageFin
  const mots = (t) => new Set(normalize(stripSpans(String(t))).match(/[\p{L}\p{N}]{3,}/gu) ?? [])
  const porte = (ligneMd, l) => {
    const m = mots(ligneMd)
    const n = [...mots(l.texte)]
    return n.length >= 2 && n.every((x) => m.has(x))
  }
  const jetons = (t) => normalize(stripSpans(String(t))).match(/[\p{L}\p{N}]+/gu) ?? []
  const echappe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lignesMd = (page, garde) => fichiers.flatMap((fx, f) => (surSesPages(fx, page) ? fx.lignes.flatMap((ligne, i) => (surSaPage(f, i, page) && garde(ligne) ? [{ f, i, ligne }] : [])) : []))
  const clot = (l) => !/[,\-/]$/.test(l.texte.trim())
  const enchaine = (a, b) => !clot(a) || /^\p{Ll}/u.test(b.texte.trim())
  const formesDuLivre = new Set(fichiers.flatMap((fx) => fx.lignes.flatMap((l) => (stripSpans(l).match(/[\p{L}\p{N}]+(?:[-/][\p{L}\p{N}]+)*/gu) ?? []).flatMap((t) => {
    const p = t.toLowerCase().match(/[\p{L}\p{N}]+|[-/]/gu)
    return [t.toLowerCase(), ...p.flatMap((x, k) => (k % 2 === 0 && p[k + 2] ? [`${x}${p[k + 1]}${p[k + 2]}`] : []))]
  }))))
  const joint = (x, sep, y) => (formesDuLivre.has(`${x}${sep}${y}`.toLowerCase()) ? 'compose' : formesDuLivre.has(`${x}${y}`.toLowerCase()) ? 'cesure' : 'inconnu')

  // P — chaque ligne candidate reçoit ses preuves ; une preuve ne sert qu'une ligne : les lignes à preuve
  // UNIQUE la prennent, et la retirent aux autres, jusqu'au point fixe ; deux lignes qui n'ont que la même
  // preuve ne l'ont ni l'une ni l'autre. Reste ambigu : pas de site.
  const demandes = []
  fichiers.forEach((fx, f) => {
    fx.lignes.forEach((ligne, i) => {
      if (!ligne.trim() || /^(#|\||- |>)/.test(ligne) || /^\*\*[^*]*:\*\*/.test(ligne)) return
      const j = prosePrecedenteCoupee(fx.lignes, i)
      if (j < 0) return
      const [ci, cj] = [cles[f][i], cles[f][j]]
      const finGrasse = /\*\*\s*$/.test(fx.lignes[j])
      const bases = flux.flatMap((b, n) => {
        const a = flux[n - 1]
        return n > 0 && surSaPage(f, i, b.page) && !estTitre.has(n) && suit(a, b) && b.x0 <= a.x0 + 2 && !libelle(b)
          && prefixes(cleDuPdf(b.texte), ci) && suffixes(cleDuPdf(a.texte), cj) && (!finGrasse || gras(a.spans.at(-1)))
          && continu(a, b, flux[n + 1]) ? [n] : []
      })
      const candidats = bases.filter((n) => nePasTenir(flux[n - 1], flux[n]) || enchaine(flux[n - 1], flux[n]))
      const finMd = [...fx.lignes[j].trimEnd()].reverse().join('')
      const accordes = candidats.filter((n) => accord(emphaseMd(finMd), flux[n - 1].spans.at(-1)) && accord(emphaseMd(ligne), flux[n].spans[0]))
      const preuves = candidats.length === 1 ? candidats : accordes
      if (preuves.length) demandes.push({ f, i, j, ligne, preuves: new Set(preuves) })
      else if (bases.length === 1) {
        const [a, b] = [flux[bases[0] - 1], flux[bases[0]]]
        sites.push({ forme: 'paragraphe-non-prouve', site: adresse(f, i), avec: adresse(f, j), motif: '1er mot qui tenait, ligne close, suite en capitale', famille: 'paragraphe', page: b.page, colonne: b.colonne, x0: b.x0, y0: b.y0, titre: b.texte, preuve: `p.${b.page} col.${b.colonne} y${Math.round(a.y0)}→${Math.round(b.y0)}` })
      }
    })
  })
  for (let change = true; change;) {
    change = false
    const seules = demandes.filter((x) => x.preuves.size === 1 && x.k == null)
    for (const d of seules) {
      if (seules.some((o) => o !== d && o.preuves.has([...d.preuves][0]))) continue
      d.k = [...d.preuves][0]
      for (const autre of demandes) if (autre !== d) autre.preuves.delete(d.k)
      change = true
    }
  }
  const jointures = []
  for (const { f, i, j, ligne, k } of demandes.filter((d) => d.k != null)) {
    const b = flux[k]
    const apres = flux.slice(k + 1, k + 9).filter((c) => c.page === b.page && c.colonne === b.colonne)
    const etiquette = [...ligne.matchAll(/\*\*([^*]+:)\*\*/g)].find((m) => m.index > 0 && apres.some((c) => cleDuPdf(c.texte).startsWith(cleDuPdf(m[1]))))?.[0] ?? null
    const coupe = /(\p{L}+)([-/])\**\s*$/u.exec(fichiers[f].lignes[j])
    const ouverture = /^\**(\p{L}+)/u.exec(ligne)
    const preuve = `p.${b.page} col.${b.colonne} y${Math.round(flux[k - 1].y0)}→${Math.round(b.y0)}`
    if (coupe && ouverture && joint(coupe[1], coupe[2], ouverture[1]) === 'cesure') {
      sites.push({ forme: 'cesure', site: adresse(f, i), avec: adresse(f, j), motif: `le livre imprime « ${coupe[1]}${ouverture[1]} », jamais « ${coupe[1]}${coupe[2]}${ouverture[1]} »`, famille: 'paragraphe', page: b.page, colonne: b.colonne, x0: b.x0, y0: b.y0, titre: b.texte, preuve })
      continue
    }
    jointures.push({ f, i: j, ligne: recoller(fichiers[f].lignes[j], etiquette ? ligne.slice(0, ligne.indexOf(etiquette, 1)).trimEnd() : ligne) })
    sites.push({ forme: 'P', site: adresse(f, i), avec: adresse(f, j), ligneMd: ligne, etiquette, par: nePasTenir(flux[k - 1], b) ? 'marge' : 'suite', famille: 'paragraphe', page: b.page, colonne: b.colonne, x0: b.x0, y0: b.y0, titre: b.texte, preuve })
  }

  // D — la page PDF de chaque ancre (`id="page-K-…"` : page K + 1) porte son folio imprimé
  const folioDePage = new Map()
  const ANCRE_PAGE = new RegExp(`id="page-(\\d+)-\\d+"[^>]*${FOLIO_ATTR.source}`, 'g')
  for (const fx of fichiers) for (const m of fx.lignes.join('\n').matchAll(ANCRE_PAGE)) folioDePage.set(Number(m[1]) + 1, Number(m[2]))
  const parTete = new Map()
  flux.forEach((b, n) => {
    const k = cleDuPdf(b.texte)
    if (n > 0 && k.length >= CLE_MIN) parTete.set(k.slice(0, CLE_MIN), [...(parTete.get(k.slice(0, CLE_MIN)) ?? []), n])
  })
  const prose = (l) => !!l.trim() && !/^(#|\||- |>|\*Pages PDF)/.test(l)
  fichiers.forEach((fx, f) => {
    const roulant = foliosRoulants(fx.lignes)
    const folioDe = (i) => roulant[i]
    fx.lignes.forEach((ligne, i) => {
      const ci = cles[f][i]
      if (!prose(ligne) || ci.length < CLE_MIN || folioDe(i) == null) return
      const preuves = (parTete.get(ci.slice(0, CLE_MIN)) ?? []).flatMap((n) => {
        const [a, b] = [flux[n - 1], flux[n]]
        const folio = folioDePage.get(b.page)
        if (folio == null || folio === folioDe(i) || !surSesPages(fx, b.page) || estTitre.has(n) || !suit(a, b) || b.x0 > a.x0 + 2 || libelle(b)) return []
        if (!prefixes(cleDuPdf(b.texte), ci) || !continu(a, b, flux[n + 1]) || !(nePasTenir(a, b) || enchaine(a, b))) return []
        const ka = cleDuPdf(a.texte)
        return fx.lignes.flatMap((lj, j) => (j !== i && prose(lj) && folioDe(j) === folio && suffixes(ka, cles[f][j]) ? [{ n, j }] : []))
      })
      if (preuves.length !== 1) return
      const [{ n, j }] = preuves
      const [a, b] = [flux[n - 1], flux[n]]
      sites.push({ forme: 'D', site: adresse(f, i), avec: adresse(f, j), ligneMd: ligne, famille: 'paragraphe', page: b.page, colonne: b.colonne, x0: b.x0, y0: b.y0, titre: b.texte, preuve: `p.${b.page} col.${b.colonne} y${Math.round(a.y0)}→${Math.round(b.y0)}, folio ${folioDePage.get(b.page)} ≠ folio roulant ${folioDe(i)}` })
    })
  })

  // E — une preuve que deux libellés réclament ne sert aucun des deux
  const enMilieu = new Set()
  const ouvertures = new Map()
  for (const l of flux) l.spans.forEach((sp, k) => {
    if (!gras(sp) || !sp.texte.includes(':')) return
    const cleL = cleDuPdf(sp.texte.slice(0, sp.texte.indexOf(':')))
    if (/[a-z]/i.test(l.spans.slice(0, k).map((x) => x.texte).join(''))) enMilieu.add(cleL)
    else ouvertures.set(cleL, (ouvertures.get(cleL) ?? 0) + 1)
  })
  const typo = (a, cleL) => !enMilieu.has(cleL) && ((ouvertures.get(cleL) ?? 0) >= OUVERTURES_PROBANTES || clot(a))
  const faibles = []
  const libelles = []
  fichiers.forEach((fx, f) => {
    fx.lignes.forEach((ligne, i) => {
      if (!ligne.trim() || /^(#|\||- |>)/.test(ligne)) return
      for (const m of ligne.matchAll(/\*\*([^*]+:)\*\*/g)) {
        if (m.index === 0 || ligne.split(m[0]).length !== 2) continue
        if (sites.some((s) => s.forme === 'P' && s.site === adresse(f, i) && s.etiquette === m[0])) continue
        const tete = cle(ligne.slice(0, m.index))
        const queue = jetons(ligne.slice(m.index))
        const bases = flux.flatMap((c, n) => {
          const a = flux[n - 1]
          return n > 0 && surSaPage(f, i, c.page) && !estTitre.has(n) && suit(a, c) && libelle(c)
            && jetons(c.texte).every((x, k) => x === queue[k]) && suffixes(cleDuPdf(a.texte), tete) ? [n] : []
        })
        const preuves = bases.filter((n) => !nePasTenir(flux[n - 1], flux[n]) || typo(flux[n - 1], cleDuPdf(m[1])))
        if (preuves.length) libelles.push({ f, i, ligne, m, preuves })
        else if (bases.length === 1 && !enMilieu.has(cleDuPdf(m[1]))) faibles.push({ f, i, m, n: bases[0] })
      }
    })
  })
  for (const { f, i, ligne, m, preuves } of libelles) {
    if (preuves.length !== 1 || libelles.filter((x) => x.preuves.includes(preuves[0])).length !== 1) continue
    const [a, c] = [flux[preuves[0] - 1], flux[preuves[0]]]
    sites.push({ forme: 'E', site: adresse(f, i), ligneMd: ligne, etiquette: m[0], famille: 'paragraphe', page: c.page, colonne: c.colonne, x0: c.x0, y0: c.y0, titre: m[1], preuve: `p.${c.page} col.${c.colonne} y${Math.round(a.y0)}→${Math.round(c.y0)} ${!nePasTenir(a, c) ? 'tenait' : `jamais en milieu de ligne, ouvre ${ouvertures.get(cleDuPdf(m[1])) ?? 0} ligne(s)${(ouvertures.get(cleDuPdf(m[1])) ?? 0) < OUVERTURES_PROBANTES ? ', ligne précédente close' : ''}`}` })
  }
  for (const { f, i, m, n } of faibles) {
    const [a, c] = [flux[n - 1], flux[n]]
    sites.push({ forme: 'libelle-non-prouve', site: adresse(f, i), etiquette: m[0], motif: `ouvre ${ouvertures.get(cleDuPdf(m[1])) ?? 0} ligne(s) < ${OUVERTURES_PROBANTES}, ligne précédente ouverte`, famille: 'paragraphe', page: c.page, colonne: c.colonne, x0: c.x0, y0: c.y0, titre: m[1], preuve: `p.${c.page} col.${c.colonne} y${Math.round(a.y0)}→${Math.round(c.y0)}` })
  }

  // A
  const centreDans = (l, c) => {
    const x = (l.x0 + l.x1) / 2
    const y = l.y0 + l.spans[0].taille / 2
    return c.x0 <= x && x <= c.x1 && c.y0 <= y && y <= c.y1
  }
  for (const p of pages) {
    for (const c of p.cercles ?? []) {
      for (const l of p.lignes.filter((x) => /^\d+$/.test(x.texte.trim()) && centreDans(x, c))) {
        const jeton = l.texte.trim()
        const voisines = p.lignes.filter((x) => x !== l && x.colonne === l.colonne && Math.abs(x.y0 - l.y0) <= 16 && !/^\d+$/.test(x.texte.trim()))
        const vus = lignesMd(p.page, (ligne) => (/(?:\s\d+)+\s*$/.exec(ligne)?.[0].trim().split(/\s+/) ?? []).includes(jeton) && voisines.some((v) => porte(ligne, v)))
        if (vus.length !== 1) continue
        const { f, i, ligne } = vus[0]
        sites.push({ forme: 'A', site: adresse(f, i), ligneMd: ligne, jeton, famille: 'paragraphe', page: p.page, colonne: l.colonne, x0: l.x0, y0: l.y0, titre: jeton, preuve: `p.${p.page} col.${l.colonne} y${Math.round(l.y0)} pastille x${Math.round(c.x0)}-${Math.round(c.x1)}` })
      }
    }
  }

  // G
  const runs = []
  let ouvert = null
  flux.forEach((l, n) => {
    l.spans.forEach((sp, k) => {
      const bi = /BoldItalic/.test(sp.police)
      if (bi && ouvert && k === 0 && ouvert.fin === n - 1 && suit(flux[n - 1], l)) {
        ouvert.texte += ` ${sp.texte}`
        ouvert.fin = k === l.spans.length - 1 ? n : -1
      } else if (bi) {
        ouvert = { n, texte: sp.texte, police: sp.police, fin: k === l.spans.length - 1 ? n : -1 }
        runs.push(ouvert)
      } else ouvert = null
    })
    if (ouvert && ouvert.fin !== n) ouvert = null
  })
  const parLigne = new Map()
  for (const r of runs) {
    const l = flux[r.n]
    const t = r.texte.replace(/\s+/g, ' ').trim().replace(/’/g, "'")
    const re = new RegExp(`(?<!\\*)\\*${echappe(t)}\\*(?!\\*)`, 'g')
    const porteLe = (ligne) => (ligne.match(re) ?? []).length > 0 && porte(ligne, l)
    const seules = lignesMd(l.page, porteLe)
    const vus = seules.length ? seules : jointures.filter((x) => surSesPages(fichiers[x.f], l.page) && surSaPage(x.f, x.i, l.page) && porteLe(x.ligne))
    if (vus.length !== 1) continue
    const { f, i, ligne } = vus[0]
    const emphases = new Set([...ligne.matchAll(new RegExp(`(?<![\\p{L}*])(\\**)${echappe(t)}\\**(?![\\p{L}*])`, 'gu'))].map((m) => m[1].length))
    if (emphases.size > 1) continue
    const cleSite = `${f}:${i}:${t}`
    const n = parLigne.get(cleSite) ?? 0
    if (n >= ligne.match(re).length) continue
    parLigne.set(cleSite, n + 1)
    sites.push({ forme: 'G', site: adresse(f, i), ligneMd: ligne, texteMd: `*${t}*`, famille: 'paragraphe', page: l.page, colonne: l.colonne, x0: l.x0, y0: l.y0, titre: t, preuve: `p.${l.page} col.${l.colonne} y${Math.round(l.y0)} ${r.police}` })
  }

  // T
  const tirets = flux.flatMap((l, n) => {
    const [a, b] = [flux[n - 1], flux[n + 1]]
    const fin = /(\S+)\s+—$/.exec(l.texte.trim())
    const tete = /^—\s+(\S+)/.exec(l.texte.trim())
    return [
      ...[...l.texte.matchAll(/(\S+)\s+—\s+(\S+)/g)].map((m) => [l, m[1], m[2]]),
      ...(fin && suit(l, b) ? [[l, fin[1], b.texte.trim().split(/\s+/)[0]]] : []),
      ...(tete && suit(a, l) ? [[l, a.texte.trim().split(/\s+/).at(-1), tete[1]]] : []),
    ]
  })
  for (const [l, avant, apres] of tirets) {
    if (!/\p{L}/u.test(avant) || !/\p{L}/u.test(apres)) continue
    const re = new RegExp(`(^|[^\\p{L}])${echappe(avant)} ${echappe(apres)}(?!\\p{L})`, 'u')
    const vus = lignesMd(l.page, (ligne) => re.test(stripSpans(ligne).replace(/\*/g, '')) && porte(ligne, l))
    if (vus.length !== 1) continue
    const { f, i, ligne } = vus[0]
    sites.push({ forme: 'T', site: adresse(f, i), ligneMd: ligne, avant, apres, famille: 'paragraphe', page: l.page, colonne: l.colonne, x0: l.x0, y0: l.y0, titre: l.texte, preuve: `p.${l.page} col.${l.colonne} y${Math.round(l.y0)} « ${avant} — ${apres} »` })
  }

  // J — une preuve que deux joints réclament ne sert aucun des deux
  const joints = []
  fichiers.forEach((fx, f) => fx.lignes.forEach((ligne, i) => {
    for (const m of ligne.matchAll(/(\p{L}+)([-/]) (\p{L}+)/gu)) {
      const verdict = joint(m[1], m[2], m[3])
      if (ligne.split(m[0]).length !== 2 || verdict === 'cesure' || (m[2] === '-' && verdict !== 'compose')) continue
      const preuves = flux.flatMap((l, n) => surSaPage(f, i, l.page) && suit(l, flux[n + 1]) && l.texte.trim().endsWith(`${m[1]}${m[2]}`) && flux[n + 1].texte.trim().startsWith(m[3]) && porte(ligne, l) ? [n] : [])
      if (preuves.length) joints.push({ f, i, ligne, m, preuves })
    }
  }))
  for (const { f, i, ligne, m, preuves } of joints) {
    if (preuves.length !== 1 || joints.filter((x) => x.preuves.includes(preuves[0])).length !== 1) continue
    const l = flux[preuves[0]]
    sites.push({ forme: 'J', site: adresse(f, i), ligneMd: ligne, avant: `${m[1]}${m[2]}`, apres: m[3], famille: 'paragraphe', page: l.page, colonne: l.colonne, x0: l.x0, y0: l.y0, titre: m[0], preuve: `p.${l.page} col.${l.colonne} y${Math.round(l.y0)} « …${m[1]}${m[2]} » ↵ « ${m[3]}… »` })
  }
  return sites
}

/** Le livre `id` sur le disque : ses fichiers `.md` (liste de découpe) et son gabarit. */
function livre(id) {
  const l = livreExtraitDe(id)
  if (!l) throw new Error(`sonde-titres : aucun livre extrait d'id « ${id} » au registre`)
  const dir = String(l.dir).split('\\').join('/').replace(/\/$/, '')
  const liste = decoupeDe(id)
  const fichiers = nomsDeLaListe(liste).map((nom, i) => ({
    nom,
    page: liste[i].page,
    pageFin: liste[i].pageFin,
    lignes: readText(`${dir}/${nom}`).split('\n'),
  }))
  return { dir, fichiers, gabarit: gabaritTitreDe(id) }
}

/** Les sites d'un livre sur le disque : `boites` = le JSON de `pdf-lignes.py` (sinon lu au PDF). */
export function sondeDuLivre(id, boites = null) {
  const { dir, fichiers, gabarit } = livre(id)
  if (!gabarit) return null
  const brut = boites ?? boitesDuPdf(id)
  return { dir, fichiers, ...classer(brut.map((p) => ({ page: p.page, lignes: lignes(p.boites), cercles: p.cercles ?? [] })), fichiers, gabarit) }
}

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'sonde-titres-stock.json')
const QUOI =
  'Sites de la SONDE des TITRES (`scripts/raw/sonde-titres.mjs`, #1739 #1820) qu’aucune réparation ne ' +
  'consomme : N, corps-introuvable, place-non-prouvee, paragraphe-non-prouve, et toute forme émise hors ' +
  '`colonne` (en-tête de colonne, jamais un écart). Une ENTRÉE par SITE, clé `fichier :: ref :: occurrence` ' +
  '(régime #1711) ; `fichier` = le 1er `.md` de la page du titre, `ref` = forme, page et titre imprimé : ' +
  'l’IDENTITÉ du site, jamais une ligne du `.md`. Mesuré au PDF, qu’aucun dépôt ne suit : le test ne le ' +
  'confronte que là où le PDF est présent. Ce fichier ne décroît que quand un site disparaît.'

/** Les sites d'une sonde en sites NOMINAUX `{ file, ref }`, dans l'ordre d'émission (`colonne` exclue). */
export const sitesNominaux = ({ dir, fichiers, sites }) =>
  sites.filter((s) => s.forme !== 'colonne').map((s) => ({
    file: `${dir}/${fichiers.find((f) => f.page <= s.page && s.page <= f.pageFin)?.nom ?? '---'}`,
    ref: `${s.forme} :: p.${s.page} :: « ${s.titre} »`,
  }))

/** Les ENTRÉES du stock pour la sonde d'un livre : les siennes remesurées, celles des autres livres tenues. */
export const entreesDe = (sonde, { lot, date, ancien = [] }) => [
  ...ancien.filter((e) => !e.fichier.startsWith(`${sonde.dir}/`)),
  ...survieDeLecheance(sitesEnEntrees(sitesNominaux(sonde)), { lot, date, ancien }),
].sort(parCleDeSite)

/** ÉCART au stock des sites d'un livre, dans les deux sens. */
export const ecartDuStock = (sonde, stock) =>
  ecartDuVolet({ sites: sitesNominaux(sonde), stock: stock.filter((e) => e.fichier.startsWith(`${sonde.dir}/`)), ou: 'sonde-titres-stock.json' })

/** Les boîtes du PDF d'un livre (`lib/pdf-lignes.py`, dossier temporaire effacé). */
export function boitesDuPdf(id) {
  const dir = mkdtempSync(join(tmpdir(), 'sonde-titres-'))
  try {
    const sortie = join(dir, 'boites.json')
    execFileSync('python', [PDF_LIGNES, id, sortie], { stdio: ['ignore', 'ignore', 'inherit'] })
    return JSON.parse(readFileSync(sortie, 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FORMES = ['S', 'F', 'M', "S'", 'B', 'glyphe-fuite', 'O', 'L', 'colonne', "S'-non-prouve", 'place-non-prouvee', 'P', 'D', 'E', 'A', 'G', 'T', 'J', 'paragraphe-non-prouve', 'libelle-non-prouve', 'cesure', 'legende-absente', 'N', 'corps-introuvable', 'cible-invalide', 'doublon']
const FAMILLES = ['entree', 'encadre', 'tableau', 'capitales', 'intertitre']
/** Les familles d'ENTRÉE : titres du fil du texte, dans l'ordre du PDF, sondés dans toutes leurs formes. */
const ENTREES = new Set(['entree', 'intertitre'])

function main() {
  const args = process.argv.slice(2)
  const opt = (nom) => {
    const i = args.indexOf(nom)
    return i >= 0 ? args[i + 1] : null
  }
  const id = args.find((a, i) => !a.startsWith('--') && !['--boites', '--json', '--lot'].includes(args[i - 1]))
  if (!id) {
    console.error('usage : node scripts/raw/sonde-titres.mjs <id> [--boites <boites.json>] [--json <sortie.json> | --ecrire-stock [--lot <#N …>]]')
    process.exitCode = 2
    return
  }
  const sortie = opt('--json')
  if (sortie && relatifSousRacine(canoniser(RACINE), sortie) !== null) {
    console.error(`sonde-titres : --json ${sortie} est sous le dépôt — la sonde n'écrit rien sous le dépôt`)
    process.exitCode = 2
    return
  }
  const sonde = sondeDuLivre(id, opt('--boites') ? JSON.parse(readFileSync(opt('--boites'), 'utf8')) : null)
  if (!sonde) {
    console.error(`sonde-titres : ${id} déclare \`gabaritTitre: null\` — aucun titre à sonder`)
    return
  }
  if (args.includes('--ecrire-stock')) {
    const ancien = readStock(STOCK_PATH)
    const r = ecrireStockSousLot(
      args,
      (lot, date) => { const entrees = entreesDe(sonde, { lot, date, ancien }); return { entrees, texte: texteDeStock(QUOI, entrees) } },
      (texte) => writeFileSync(STOCK_PATH, texte),
      STOCK_PATH,
    )
    ;(r.code ? console.error : console.log)(r.message)
    process.exitCode = r.code
    return
  }
  const { sites, titres } = sonde
  for (const fam of FAMILLES) {
    const de = titres.filter((t) => t.famille === fam)
    console.log(`${id} [${fam}] : ${de.length} titres au PDF, ${de.filter((t) => t.forme === 'ok').length} à leur place`)
  }
  for (const f of FORMES) {
    const de = sites.filter((s) => s.forme === f)
    const parFamille = FAMILLES.map((fam) => `${fam} ${de.filter((s) => s.famille === fam).length}`).join(' · ')
    const parFichier = {}
    for (const s of de) {
      const k = (s.site ?? s.cible ?? '---').slice(0, 3)
      parFichier[k] = (parFichier[k] ?? 0) + 1
    }
    console.log(`== ${f} : ${de.length} (${parFamille})  ${Object.entries(parFichier).map(([k, v]) => `${k}×${v}`).join(' ')}`)
    for (const s of de) {
      const ou = `p.${s.page} col.${s.colonne} x=${s.x0.toFixed(1)} y=${s.y0.toFixed(1)}`
      const extra = s.avec ? ` -> recollée à ${s.avec} [${s.preuve}]` : s.devant ? ` -> devant ${s.devant} (« ${s.titreSuivant} »)` : s.cible ? ` -> devant ${s.cible}` : ''
      const v = `${s.titreMd ? ` titreMd « ${s.titreMd} »` : ''}${s.ligneTitre !== undefined ? ` → « ${s.ligneTitre} » (frère ${s.frere})` : ''}${s.comptage ? ` (PDF ${s.comptage.auPdf} / .md ${s.comptage.auMd})` : ''}${s.interFichiers ? ` [${s.interFichiers}]` : ''}${s.mentions?.length ? ` mentions ${s.mentions.slice(0, 5).join(',')}…` : ''}${s.texteMd ? ` texteMd « ${s.texteMd} »` : ''}`
      const nv = s.forme === 'N' ? ` niveau ${s.niveau} ≠ ${s.niveauFrere} de « ${s.frere} »` : ''
      const c = s.cause ? ` (${s.cause}) corps PDF « ${String(s.corpsPdf ?? '').slice(0, 50)} »` : ''
      const d = s.texte ? ` débris « ${s.texte} »${s.auMd ? ` .md ${s.auMd.join(',')} / PDF ${s.auPdf.join(',')}` : ''}` : ''
      console.log(`  [${s.famille}] ${s.site ?? '---'}${extra} « ${s.titre} » ${ou}${s.comment ? ` [${s.comment}]` : ''}${v}${nv}${c}${d}`)
    }
  }
  if (sortie) writeFileSync(sortie, `${JSON.stringify({ livre: id, sites }, null, 1)}\n`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
