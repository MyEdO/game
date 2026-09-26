// RE-COUPE un livre déjà extrait au GRAIN DE SES SECTIONS (#1739) : le FLUX est fait des `.md` EN
// SERVICE du livre — jamais la sortie Marker, qui ne porte pas les réparations de contenu faites au
// `.md` (§ 7 de `docs/ajouter-un-livre-source.md`) —, les frontières viennent de la LISTE DE DÉCOUPE
// du livre (`scripts/raw/decoupes/<id>.json`) et la coupe se fait à la LIGNE du titre d'ouverture
// (`lib/marker-pages.mjs#couperAuxTitres`).
//
// FORME jamais SENS (#1739, #1388) : REFUS D'ÉCRIRE tant que le flux reconstruit depuis les fichiers
// écrits n'est pas identique À L'OCTET au flux lu. Cet outil ne déplace que des frontières de
// fichier.
//
// Le code ne NOMME aucun livre : le livre est un argument, sa liste est de la donnée, son dossier et
// son titre viennent du registre (`src/data/books.json`). Migrer le livre N+1 coûte UN fichier de
// donnée, zéro ligne ici.
//
// PORTÉE de la coupe, dite : la recherche est SÉQUENTIELLE (chaque titre après la coupe précédente),
// ce qui écarte un homonyme situé APRÈS la section qu'il double. Un homonyme situé AVANT ne tombe
// que par la fenêtre de PAGE, dont un flux de `.md` ne dispose pas (les ancres de page y sont rares) :
// la carte émise (`--carte`) est ce qui se relit pour le vérifier.
//
// Usage    : node scripts/raw/recouper-source.mjs <id du livre> [--dry] [--carte <fichier>]
//            node scripts/raw/recouper-source.mjs <id du livre> --suivre-diff [--dry]
// `--suivre-diff` ne re-coupe rien : les `.md` ont été édités EN PLACE, et les stocks suivent la
// carte de SLUGS dérivée du diff `git HEAD` → arbre (`carteDesSlugs`) — à lancer AVANT de committer.
// Idempotent : rejoué sur un livre déjà au grain, il n'écrit rien et sort 0.
import { writeFileSync, rmSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { listerDossier } from '../guards/lib/lister.mjs'
import { decoupeDe, livreExtraitDe, readText } from './_lib.mjs'
import { couperAuxTitres } from './lib/marker-pages.mjs'
import { carteDuFichier, destinEnTexte } from './lib/carte-lignes.mjs'
import { INDEX } from './check-source-format.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import {
  estNomDExtraction, graphieDeChapitre, largeurDeChapitre, ligne1DePlage, numeroDuFichier,
  parseChapitre, plageDeLigne1, plageEnTexte, tablesOf,
} from '../../src/data/source/decoupe.ts'

/** Les `.md` de CHAPITRE d'un dossier, dans l'ordre de leur numéro — le FLUX du livre. */
export function chapitresEnService(dir) {
  return listerDossier(dir, { absent: 'lever' })
    .filter((n) => n.endsWith('.md') && numeroDuFichier(n) != null)
    .sort((a, b) => numeroDuFichier(a) - numeroDuFichier(b))
}

/** Nombre de lignes d'EN-TÊTE d'un chapitre : la ligne `*Pages PDF X-Y*` et la ligne vide qui la
 *  suit, ou 0 quand le fichier n'en porte pas — un livre sorti d'une autre chaîne d'extraction. */
export function lignesDEntete(lignes) {
  if (plageDeLigne1(lignes[0] ?? '') == null) return 0
  return lignes[1] === '' ? 2 : 1
}

/**
 * FLUX d'un livre : le corps de chaque chapitre (en-tête retiré), dans l'ordre, joint par une ligne
 * vide. C'est LA définition du « avant / après à l'octet » — les deux côtés passent par elle.
 * @param {{ nom: string, texte: string }[]} fichiers
 * @returns {{ flux: string, corps: string[], debuts: number[] }} `debuts` = indice de ligne, dans le
 *   flux, où commence le corps de chaque fichier.
 */
export function fluxDe(fichiers) {
  const corps = []
  const debuts = []
  let lignes = 0
  for (const { texte } of fichiers) {
    const l = texte.split('\n')
    const c = l.slice(lignesDEntete(l)).join('\n')
    debuts.push(lignes)
    lignes += c.split('\n').length
    corps.push(c)
  }
  return { flux: corps.join('\n'), corps, debuts }
}

/**
 * PLAN de re-découpe : une entrée par fichier à écrire, avec sa coupe, sa plage de lignes du flux,
 * son nom et son en-tête de pages. PUR.
 *
 * La plage `*Pages PDF X-Y*` est COPIÉE de la liste (`page`, `pageFin`) — elle est lue au LIVRE,
 * elle ne se calcule nulle part.
 *
 * Une entrée SANS titre imprimé n'a aucune ligne à reconnaître : sa coupe vient des ANCRES de page
 * du flux — la ligne où s'ouvrait le chapitre en service qui DÉCLARAIT cette page de début. Sans
 * ancre pour sa page, elle est NOMMÉE introuvable ; aucune coupe n'est devinée à sa place.
 * @param {string[]} lignes flux découpé en lignes
 * @param {{ titre: string, ouverture?: string, page: number, pageFin: number }[]} liste
 * @param {Map<number, number>} ancres page de début déclarée → ligne du flux
 */
export function planDe(lignes, liste, ancres = new Map()) {
  const sansAncre = liste.filter((e) => e.ouverture == null && !ancres.has(e.page))
    .map((e) => ({ cle: e.titre, ouverture: `(aucun titre imprimé, page ${e.page})`, depuis: 0, avant: lignes.length }))
  const { coupes, introuvables } = couperAuxTitres(lignes, liste.map((e) => ({
    cle: e.titre,
    ouverture: e.ouverture ?? null,
    ...(e.ouverture == null && ancres.has(e.page) ? { depuis: ancres.get(e.page) } : {}),
  })))
  if (introuvables.length || sansAncre.length) return { plan: [], introuvables: [...introuvables, ...sansAncre] }
  const largeur = largeurDeChapitre(liste.length)
  const plan = liste.map((e, i) => {
    return {
      nom: nomAscii(`${graphieDeChapitre(i + 1, largeur)} - ${e.titre}.md`),
      titre: e.titre,
      page: e.page,
      pageFin: e.pageFin,
      span: spanDe(e),
      de: coupes[i].ligne,
      a: i + 1 < coupes.length ? coupes[i + 1].ligne : lignes.length,
    }
  })
  return { plan, introuvables: [] }
}

/** Le CONTENU d'un fichier du plan : son en-tête, une ligne vide, puis sa tranche de flux TELLE
 *  QUELLE. Un corps qui ne finit pas par un saut de ligne en reçoit un — le seul octet que cet
 *  outil peut ajouter, et le contrôle à l'octet le voit. */
export const contenuDe = (lignes, e) => {
  const corps = lignes.slice(e.de, e.a).join('\n')
  return `${ligne1DePlage(e.page, e.pageFin)}\n\n${corps}${corps.endsWith('\n') ? '' : '\n'}`
}

/**
 * PLAGE d'une entrée de liste, en texte — une COPIE de la donnée : les deux découpeurs passent par
 * elle, et la forme vient de `plageEnTexte`. Une entrée sans plage lisible LÈVE en se NOMMANT : la
 * plage se lit au LIVRE, elle ne se déduit pas de la liste.
 * @param {{ titre: string, page: number, pageFin: number }} e @returns {string}
 */
export function spanDe(e) {
  try {
    return plageEnTexte(e.page, e.pageFin)
  } catch (err) {
    throw new Error(`recouper-source : « ${e.titre} » n'a pas de plage lisible — ${err.message}`, { cause: err })
  }
}

/** L'INDEX du dossier, à la forme que le découpeur produit. */
export const indexDe = (titreDuLivre, plan) =>
  `# ${titreDuLivre} — Index\n\n${plan.map((e) => `- [${e.nom.replace(/\.md$/, '')}](<${e.nom}>) — p.${e.span}`).join('\n')}\n`

/* ─── CARTE ancien → nouveau, et recalage des stocks ─────────────────────────────────────────── */

/** Section (`slug`, `occ`) → indice de ligne dans le FLUX, pour un fichier et son décalage. */
function sectionsAuFlux(texte, debut) {
  const entete = lignesDEntete(texte.split('\n'))
  const out = new Map()
  for (const s of parseChapitre(texte).sections) out.set(`${s.slug}#${s.occ}`, debut + (s.line - 1) - entete)
  return out
}

/**
 * CARTE des sections : `<ancien fichier> :: <slug>#<occ>` → `{ fichier, ref }` nouveaux. C'est elle
 * qui fait SUIVRE une entrée de stock keyée par chemin et par section (`slug#occ :: …`), sa `preuve`
 * et sa date avec elle.
 */
export function carteDesSections(anciens, debuts, plan, contenus) {
  const parLigne = new Map()
  plan.forEach((e) => {
    for (const [cle, ligne] of sectionsAuFlux(contenus.get(e.nom), e.de)) parLigne.set(ligne, { fichier: e.nom, ref: cle })
  })
  const carte = new Map()
  anciens.forEach(({ nom, texte }, i) => {
    for (const [cle, ligne] of sectionsAuFlux(texte, debuts[i])) {
      const cible = parLigne.get(ligne)
      if (cible) carte.set(`${nom} :: ${cle}`, cible)
    }
  })
  return carte
}

/**
 * ANCRES de page d'un flux : page de DÉBUT déclarée par un chapitre en service → ligne de son corps
 * dans le flux. Elles ne servent qu'à couper les fichiers SANS titre imprimé.
 * @returns {Map<number, number>}
 */
export function ancresDe(anciens, debuts) {
  const ancres = new Map()
  anciens.forEach(({ texte }, i) => {
    const plage = plageDeLigne1(texte.split('\n')[0] ?? '')
    if (plage && !ancres.has(plage.page)) ancres.set(plage.page, debuts[i])
  })
  return ancres
}

/**
 * LE GESTE, PUR : des chapitres en service et une liste de découpe → le plan, le contenu de chaque
 * fichier, la carte des sections, et le VERDICT à l'octet. Aucun accès disque ; `main` n'est que sa
 * coquille d'entrée/sortie.
 * @param {{ nom: string, texte: string }[]} anciens
 * @param {{ titre: string, ouverture?: string, page: number, pageFin: number }[]} liste
 * @returns {{ plan: object[], contenus: Map<string, string>, carte: Map<string, object>,
 *   introuvables: object[], ecart: { avant: string, apres: string, index: number } | null,
 *   flux: string, debuts: number[] }}
 */
export function recouper(anciens, liste) {
  const avant = fluxDe(anciens)
  const lignes = avant.flux.split('\n')
  const { plan, introuvables } = planDe(lignes, liste, ancresDe(anciens, avant.debuts))
  if (introuvables.length) return { plan: [], contenus: new Map(), carte: new Map(), introuvables, ecart: null, ...avant }
  const contenus = new Map(plan.map((e) => [e.nom, contenuDe(lignes, e)]))
  const apres = fluxDe(plan.map((e) => ({ nom: e.nom, texte: contenus.get(e.nom) })))
  const ecart = apres.flux === avant.flux ? null : {
    avant: avant.flux, apres: apres.flux,
    index: [...avant.flux].findIndex((c, k) => c !== apres.flux[k]),
  }
  const carte = ecart ? new Map() : carteDesSections(anciens, avant.debuts, plan, contenus)
  return { plan, contenus, carte, introuvables: [], ecart, ...avant }
}

/** Les stocks NOMINATIFS du dossier des gardes — tout `*-stock.json` : aucun n'est nommé ici. */
const stocksNominatifs = (dir) =>
  listerDossier(dir, { absent: 'vide' }).filter((n) => n.endsWith('-stock.json')).map((n) => join(dir, n))

const CLE_DE_REF = /^([a-z0-9-]*)#(\d+)(?= ::|$)/

/** L'entrée est-elle keyée par SECTION (`slug#occ :: …`) ? Les autres (clé de fichier, compte…) ne
 *  relèvent pas d'une carte de slugs. */
export const aUneCleDeSection = (e) => CLE_DE_REF.test(String(e.ref ?? ''))

/**
 * RECALE les entrées d'un stock qui pointent un `.md` du livre : le chemin suit la carte, et la
 * `ref` prend l'occurrence que la section a dans son NOUVEAU fichier. Rend les entrées recalées et
 * celles qu'aucune section ne porte — jamais devinées. `portee` restreint les entrées concernées ;
 * les autres passent inchangées.
 * @returns {{ entrees: object[], recalees: string[], orphelines: string[] }}
 */
export function recalerStock(entrees, racine, carte, { portee = () => true } = {}) {
  const recalees = []
  const orphelines = []
  const out = entrees.map((e) => {
    const chemin = e.fichier ?? e.file
    if (typeof chemin !== 'string' || !chemin.startsWith(`${racine}/`) || !portee(e)) return e
    const ancien = chemin.slice(racine.length + 1)
    const m = CLE_DE_REF.exec(String(e.ref ?? ''))
    const cible = m ? carte.get(`${ancien} :: ${m[0]}`) : null
    if (!cible) { orphelines.push(`${chemin} :: ${e.ref}`); return e }
    const neuf = { ...e, [e.fichier != null ? 'fichier' : 'file']: `${racine}/${cible.fichier}`, ref: String(e.ref).replace(CLE_DE_REF, cible.ref) }
    if (cible.fichier === ancien && neuf.ref === e.ref) return e
    recalees.push(`${ancien} :: ${e.ref}  →  ${cible.fichier} :: ${neuf.ref}`)
    return neuf
  })
  return { entrees: out, recalees, orphelines }
}

/** La ligne `n` porte-t-elle la légende `**X**` d'une table de la section ? PUR. */
const legendeALaLigne = (section, n) =>
  tablesOf(section).some(({ block, table }) => {
    const i = section.blocks.indexOf(block)
    return table.titre != null && i > 0 && section.blocks[i - 1].line === n
  })

/**
 * CARTE des sections d'un fichier ÉDITÉ EN PLACE, dérivée de sa carte de lignes EXACTE
 * (`lib/carte-lignes.mjs`) — même forme que `carteDesSections`, pour `recalerStock` : la ligne de
 * titre de `slug#occ` suit la carte, et le titre qui s'y trouve donne le nouveau `slug#occ`
 * (`parseChapitre`). Le préambule (`#1`, section sans titre que `parseChapitre` ouvre toujours en
 * tête) va au préambule. Un titre DÉPLACÉ (sa ligne supprimée, son slug sur UNE seule ligne de titre
 * neuve) suit sa ligne neuve. Un titre devenu LÉGENDE de table (sa ligne est le `**X**` qui titre la
 * table suivante, `tablesOf`) suit la section qui porte l'en-tête de sa table (#1739). Un titre
 * supprimé, pris dans un hunk ambigu (titre scindé), ou dont la ligne n'est plus un titre est
 * RAPPORTÉ avec sa raison — jamais deviné. Une ligne de titre NEUVE
 * (aucune ligne de HEAD n'y mène) SCINDE la section qui la précède : la clé HEAD de celle-ci est
 * rendue dans `scindees`, pour que les entrées qui y sont keyées soient rapportées. PUR.
 * @param {string} nom fichier (relatif au dossier du livre) @param {string} texteHead @param {string} texteArbre
 * @param {(n: number) => ({ ligne: number } | { supprimee: true } | { ambigue: true, candidates: number[] })} carteLignes
 * @returns {{ carte: Map<string, { fichier: string, ref: string }>, rapportees: string[], scindees: { cle: string, par: string }[] }}
 */
export function carteDesSlugs(nom, texteHead, texteArbre, carteLignes) {
  const [preambule, ...titres] = parseChapitre(texteHead).sections
  const sectionsArbre = parseChapitre(texteArbre).sections
  const parLigne = new Map(sectionsArbre.slice(1).map((s) => [s.line, `${s.slug}#${s.occ}`]))
  const images = new Set()
  texteHead.split('\n').forEach((_, n) => {
    const d = carteLignes(n + 1)
    if ('ligne' in d) images.add(d.ligne)
  })
  const neuves = sectionsArbre.slice(1).filter((s) => !images.has(s.line))
  const carte = new Map([[`${nom} :: ${preambule.slug}#${preambule.occ}`, { fichier: nom, ref: `${preambule.slug}#${preambule.occ}` }]])
  const rapportees = []
  const deplacees = new Set()
  for (const s of titres) {
    const cle = `${s.slug}#${s.occ}`
    const destin = carteLignes(s.line)
    const ref = 'ligne' in destin ? parLigne.get(destin.ligne) : undefined
    if (ref) { carte.set(`${nom} :: ${cle}`, { fichier: nom, ref }); continue }
    const porteuse = 'ligne' in destin ? sectionsArbre.findLast((x) => x.line <= destin.ligne) : undefined
    if (porteuse && legendeALaLigne(porteuse, destin.ligne)) {
      carte.set(`${nom} :: ${cle}`, { fichier: nom, ref: `${porteuse.slug}#${porteuse.occ}` })
      continue
    }
    const memes = 'supprimee' in destin ? neuves.filter((n) => n.slug === s.slug && !deplacees.has(n)) : []
    if (memes.length === 1) {
      deplacees.add(memes[0])
      carte.set(`${nom} :: ${cle}`, { fichier: nom, ref: `${memes[0].slug}#${memes[0].occ}` })
      continue
    }
    rapportees.push(`${nom} :: ${cle} (l.${s.line}) — ${'ligne' in destin ? `l.${destin.ligne} n'est plus un titre` : destinEnTexte(destin)}`)
  }
  const cleHead = new Map([...carte].map(([k, v]) => [v.ref, k]))
  const scindees = neuves.flatMap((n) => {
    const avant = sectionsArbre[sectionsArbre.indexOf(n) - 1]
    const cle = cleHead.get(`${avant.slug}#${avant.occ}`)
    return cle ? [{ cle, par: `${n.slug}#${n.occ} (l.${n.line})` }] : []
  })
  return { carte, rapportees, scindees }
}

/** Le recalage de TOUS les stocks nominatifs de `scripts/raw` par une carte de sections — aucun
 *  stock n'est nommé dans ce code. Rend les stocks touchés, texte réécrit compris. */
function stocksRecales(racine, carte, options) {
  const stocks = []
  for (const chemin of stocksNominatifs(join('scripts', 'raw'))) {
    const brut = JSON.parse(readText(chemin))
    if (!Array.isArray(brut.entrees)) continue
    const r = recalerStock(brut.entrees, racine, carte, options)
    if (!r.recalees.length && !r.orphelines.length) continue
    stocks.push({ chemin, texte: `${JSON.stringify({ ...brut, entrees: r.entrees }, null, 2)}\n`, ...r })
  }
  return stocks
}

function afficherStocks(stocks) {
  for (const s of stocks) {
    console.log(`  stock ${s.chemin} : ${s.recalees.length} entrée(s) recalée(s), ${s.orphelines.length} sans section porteuse`)
    for (const r of s.recalees) console.log(`    RECALÉE : ${r}`)
    for (const o of s.orphelines) console.log(`    NON RECALÉE : ${o}`)
  }
}

/** Les entrées de stock keyées sur une section SCINDÉE par un titre neuf : `chemin :: ref  ← titre`.
 *  Leur texte a pu passer dans la section neuve — jamais deviné. PUR. */
export function entreesScindees(entrees, racine, scindees) {
  const par = new Map(scindees.map((x) => [x.cle, x.par]))
  return entrees.flatMap((e) => {
    const chemin = e.fichier ?? e.file
    const m = CLE_DE_REF.exec(String(e.ref ?? ''))
    if (typeof chemin !== 'string' || !chemin.startsWith(`${racine}/`) || !m) return []
    const k = `${chemin.slice(racine.length + 1)} :: ${m[0]}`
    return par.has(k) ? [`${chemin} :: ${e.ref}  ← section scindée par ${par.get(k)}`] : []
  })
}

/** Un suivi de diff est BLOQUÉ tant qu'une entrée keyée par section reste sans section porteuse — dont
 *  toute entrée keyée sur un titre RAPPORTÉ — ou qu'une entrée est keyée sur une section scindée : rien
 *  n'est deviné, donc rien n'est écrit. Un titre rapporté qu'aucune entrée ne keye ne bloque pas. PUR. */
export const suiviBloque = (stocks, scindees = []) => scindees.length > 0 || stocks.some((s) => s.orphelines.length > 0)

/** Un titre RAPPORTÉ (`fichier :: slug#occ (…) — raison`, ou `fichier — raison`) en ligne de rapport :
 *  « aucun stock keyé » quand aucune entrée orpheline ne pointe sa section (ou son fichier). PUR. */
export function rapporteeEnLigne(rapportee, racine, orphelines) {
  const cle = rapportee.split(/ \(l\.| — /)[0]
  const keyee = orphelines.some((o) => o.startsWith(`${racine}/${cle} `))
  return `${rapportee}${keyee ? '' : ' — aucun stock keyé'}`
}

/**
 * `--suivre-diff` : les `.md` du livre ont été ÉDITÉS EN PLACE (aucun fichier renommé) ; chaque
 * entrée keyée par section suit la carte de SLUGS dérivée du diff `git HEAD` → arbre de travail de
 * chaque chapitre. Sort en échec, sans rien écrire, tant que `suiviBloque`.
 */
function suivreLeDiff(dir, racine, DRY) {
  const carte = new Map()
  const rapportees = []
  const scindees = []
  for (const nom of chapitresEnService(dir)) {
    const texteArbre = readText(join(dir, nom))
    const git = carteDuFichier(`${racine}/${nom}`)
    if (!git) { rapportees.push(`${nom} — absent de HEAD`); continue }
    const r = carteDesSlugs(nom, git.texteHead, texteArbre, git.carte)
    for (const [k, v] of r.carte) carte.set(k, v)
    rapportees.push(...r.rapportees)
    scindees.push(...r.scindees)
  }
  const stocks = stocksRecales(racine, carte, { portee: aUneCleDeSection })
  const surScindees = stocksNominatifs(join('scripts', 'raw')).flatMap((chemin) => {
    const brut = JSON.parse(readText(chemin))
    return Array.isArray(brut.entrees) ? entreesScindees(brut.entrees, racine, scindees).map((e) => `${chemin} : ${e}`) : []
  })
  console.log(`${racine} : carte de slugs par diff — ${carte.size} section(s) portée(s), ${rapportees.length} rapportée(s), ${scindees.length} section(s) scindée(s).`)
  const orphelines = stocks.flatMap((s) => s.orphelines)
  for (const r of rapportees) console.log(`  RAPPORTÉE : ${rapporteeEnLigne(r, racine, orphelines)}`)
  for (const e of surScindees) console.log(`  SECTION SCINDÉE : ${e}`)
  afficherStocks(stocks)
  if (suiviBloque(stocks, surScindees)) {
    console.log('BLOQUÉ — entrée(s) sans section porteuse ou keyée(s) sur une section scindée : à trancher à la main ; rien n\'est écrit.')
    process.exitCode = 1
    return
  }
  if (DRY) { console.log('--dry : rien écrit'); return }
  for (const s of stocks) writeFileSync(s.chemin, s.texte)
  console.log(stocks.length ? 'écrit' : 'aucun stock à recaler')
}

/* ─── CLI ────────────────────────────────────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2)
  const DRY = args.includes('--dry')
  const iCarte = args.indexOf('--carte')
  const fichierCarte = iCarte >= 0 ? args[iCarte + 1] : null
  const id = args.find((a) => !a.startsWith('--') && a !== fichierCarte)

  const livre = livreExtraitDe(id)
  if (!livre) {
    console.error(`recouper-source : « ${id} » n'est pas l'id d'un livre EXTRAIT de src/data/books.json`)
    process.exit(1)
  }
  const dir = livre.dir
  const racine = String(dir).split('\\').join('/').replace(/\/$/, '')
  if (args.includes('--suivre-diff')) { suivreLeDiff(dir, racine, DRY); return }
  const liste = decoupeDe(livre.id)

  const anciensNoms = chapitresEnService(dir)
  const anciens = anciensNoms.map((nom) => ({ nom, texte: readText(join(dir, nom)) }))
  const { plan, contenus, carte, introuvables, ecart, flux, debuts } = recouper(anciens, liste)
  if (introuvables.length) {
    console.error(`TITRES D'OUVERTURE INTROUVABLES dans le flux de ${racine} : ${introuvables.length} — rien n'est écrit.`)
    for (const i of introuvables) console.error(`  « ${i.ouverture} » (fichier « ${i.cle} »), cherché à partir de la ligne ${i.depuis} du flux`)
    process.exit(1)
  }
  if (ecart) {
    const i = ecart.index
    console.error(`REFUS : le flux reconstruit diffère du flux lu (${ecart.avant.length} octets → ${ecart.apres.length}, premier écart à ${i}) — rien n'est écrit.`)
    console.error(`  lu    : ${JSON.stringify(ecart.avant.slice(Math.max(0, i - 60), i + 60))}`)
    console.error(`  écrit : ${JSON.stringify(ecart.apres.slice(Math.max(0, i - 60), i + 60))}`)
    process.exit(1)
  }

  const index = indexDe(basename(racine), plan)
  const aSupprimer = listerDossier(dir, { absent: 'vide' })
    .filter((n) => n.endsWith('.md') && estNomDExtraction(n) && !contenus.has(n) && n !== INDEX)
  const aEcrire = plan.filter((e) => !existsSync(join(dir, e.nom)) || readText(join(dir, e.nom)) !== contenus.get(e.nom))
  const indexAEcrire = !existsSync(join(dir, INDEX)) || readText(join(dir, INDEX)) !== index

  const stocks = stocksRecales(racine, carte)

  const lignesCarte = [
    `# Carte de re-découpe — ${racine}`,
    '',
    `${anciens.length} fichier(s) en service → ${plan.length} fichier(s) au grain des sections ; flux de ${flux.length} octets, ${flux.split('\n').length} lignes.`,
    '',
    '| nouveau fichier | pages | lignes du flux | ancien fichier |',
    '| --- | --- | --- | --- |',
    ...plan.map((e) => {
      const i = debuts.findLastIndex((d) => d <= e.de)
      return `| ${e.nom} | ${e.span} | ${e.de}-${e.a - 1} | ${anciens[i].nom} |`
    }),
  ].join('\n')

  console.log(`${racine} : ${anciens.length} → ${plan.length} fichier(s) ; flux identique à l'octet (${flux.length} octets).`)
  console.log(`  à écrire : ${aEcrire.length} fichier(s)${indexAEcrire ? ' + index' : ''} ; à supprimer : ${aSupprimer.length}`)
  afficherStocks(stocks)

  if (DRY) {
    console.log(lignesCarte)
    console.log('--dry : rien écrit')
    return
  }

  for (const nom of aSupprimer) rmSync(join(dir, nom))
  for (const e of aEcrire) writeFileSync(join(dir, e.nom), contenus.get(e.nom))
  if (indexAEcrire) writeFileSync(join(dir, INDEX), index)
  for (const s of stocks) writeFileSync(s.chemin, s.texte)
  if (fichierCarte) writeFileSync(fichierCarte, `${lignesCarte}\n`)
  console.log(aEcrire.length || aSupprimer.length || indexAEcrire ? 'écrit' : 'déjà au grain — aucun changement')
}

const estMain = process.argv[1] && process.argv[1].endsWith('recouper-source.mjs')
if (estMain) main()
