// RÉPARATION des TITRES D'ENTRÉE d'un livre extrait (#1739) : applique aux `.md` en service les sites
// que la SONDE relève (`sonde-titres.mjs`, JSON `--json` ou sonde rejouée). Elle ne relève rien
// elle-même.
//
// Règle utilisateur, verbatim (2026-09-20) : « Il est interdit de réécrire le texte. On peut réparer
// le texte s'il est tronqué/mélangé car l'extraction n'est pas parfaite. »
// Invariant : chaque titre d'entrée du PDF est une ligne de titre isolée qui précède la 1re ligne de
// SON corps ; le corps ne bouge pas (sauf O, l'entrée entière).
//  — S : `titreMd` détaché de la tête de sa ligne, posé en ligne de titre devant elle ;
//  — F, M : `titreMd` RETIRÉ de la tête de la ligne étrangère (vide, elle part avec les blancs), posé
//    devant `cible` ;
//  — B : le gras seul devient la ligne de titre ;
//  — glyphe-fuite : la ligne `<glyphe> **X**` (`ligneMd`) devient la ligne de titre, le glyphe ôté ;
//  — S′ : la ligne de titre restaurée posée devant `cible` ;
//  — O : l'entrée entière (sa ligne de titre jusqu'au titre suivant) posée devant `devant` ;
//  — doublon : le débris `texteMd` retiré de la tête de sa ligne ;
//  — A : les appels de figure `jeton` retirés de la queue de leur ligne ;
//  — G : `texteMd` (`*x*`) devient `***x***` dans sa ligne, APRÈS les P : dans celle où un P l'a recollée ;
//  — T : `avant apres` devient `avant — apres` dans sa ligne ;
//  — E : la ligne coupée avant son `etiquette`, qui ouvre un paragraphe ;
//  — J : `avant apres` devient `avantapres` dans sa ligne (`Read/ Write` → `Read/Write`) ;
//  — P : la ligne recollée à la ligne de prose `avec` (`lib/titres-soudes.mjs#recoller`), les lignes
//    entre elles ôtées ; avec une `etiquette`, seule la tête qui la précède se recolle, la ligne repart
//    à l'étiquette ; de la plus basse à la plus haute, une chaîne de morceaux se recolle entière.
//  — D : la ligne déplacée recollée à la ligne de prose `avec`, qu'elle suit au PDF ; elle quitte sa place ;
//  — L : la ligne de titre devient `ligneLegende` ; une bannière sort de sa table, posée `ligneLegende`
//    au-dessus, la rangée suivante devient l'en-tête (`enTete` `rangee`, séparateur recalé sur la
//    largeur de la table) ou un en-tête VIDE à cette largeur est posé (`vide`) ;
//  — legende-absente : `ligneLegende` posée devant `cible`.
// La ligne de titre posée est `ligneTitre` de la sonde (texte du `.md`, niveau du frère typographique).
// Un titre posé est un bloc : une ligne vide avant et après, jamais deux vides de suite.
// REFUS D'ÉCRIRE : un site dont la ligne ne porte plus ce que la sonde a vu (rejeu d'un JSON périmé),
// un S′ dont le fichier porte déjà autant de lignes de sa clé (`cle` de la sonde : ancres, `#`, emphase
// ôtés) que ses pages en impriment (`comptage.auPdf`, une sans comptage),
// deux gestes sur une ligne, ou un MULTI-ENSEMBLE DES MOTS du livre qui gagne autre chose que les mots
// des S′ et des légendes absentes ou perd autre chose que les débris, les appels de figure et les
// glyphes fuités.
//
// Usage : node scripts/raw/reparer-titres.mjs <id du livre> [--sites <json> | --boites <json>] [--apply]
// Sans `--apply`, rend ce qu'il ferait. Idempotent : rejoué sur un livre réparé, il n'écrit rien.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decoupeDe, livreExtraitDe, nomsDeLaListe, readText } from './_lib.mjs'
import { grasOuvert, recoller } from './lib/titres-soudes.mjs'
import { motsDe, ecartDeMots } from './reparer-mobilier.mjs'
import { cle, enTete, sondeDuLivre } from './sonde-titres.mjs'
import { cellulesDe, estSeparateur, stripSpans } from '../../src/data/source/decoupe.ts'

const FORMES = new Set(['S', 'F', 'M', 'B', 'glyphe-fuite', "S'", 'O', 'doublon', 'L', 'legende-absente'])
const LIGNE_DE_TABLE = /^\s*\|/

/** L'en-tête d'une table rendu à `largeur` colonnes (`''` : en-tête VIDE), complété de cellules vides,
 *  et son séparateur recalé sur ses cellules. PURE. */
export function enTeteALaLargeur(entete, largeur) {
  const cellules = entete.trim() ? entete.trim().replace(/^\|/, '').replace(/\|$/, '').split('|') : []
  while (cellules.length < largeur) cellules.push('   ')
  return [`|${cellules.join('|')}|`, `|${cellules.map((c) => '-'.repeat(Math.max(3, c.length))).join('|')}|`]
}
/** `NNN:l` → rang de tri, de la plus basse ligne à la plus haute. PURE. */
const rang = (adresse) => {
  const [nnn, l] = adresse.split(':')
  return [nnn, Number(l)]
}

/** `NNN:l` → `{ nnn, i }` (i : indice 0-based). PURE. */
const lieu = (adresse) => {
  const [nnn, l] = adresse.split(':')
  return { nnn, i: Number(l) - 1 }
}

/**
 * Les textes réparés d'un livre — PUR. `textes` : `Map<nnn, texte>` ; `sites` : ceux de la sonde.
 * @returns {{ textes: Map<string, string>, appliques: string[], refus: string[], recolles: { nnn: string, ligne: number, avec: number }[] }}
 */
export function reparerLivre(textes, sites) {
  const lignes = new Map([...textes].map(([k, t]) => [k, t.split('\n')]))
  const slots = new Map([...lignes].map(([k, ls]) => [k, ls.map((texte) => ({ texte, avant: [], touche: false }))]))
  const refus = []
  const appliques = []
  const slot = (adresse) => {
    const { nnn, i } = lieu(adresse)
    return slots.get(nnn)?.[i] ?? null
  }
  const retoucher = (adresse, texte) => {
    const s = slot(adresse)
    if (s.touche) return refus.push(`${adresse} : deux gestes sur une ligne`)
    Object.assign(s, { texte, touche: true })
  }
  const detacher = (site, tete) => {
    const s = slot(site.site)
    const texte = s?.texte.trimStart()
    if (!s || !tete || !texte.startsWith(tete)) return refus.push(`${site.site} ${site.forme} « ${site.titre} » : la ligne ne s'ouvre plus sur « ${tete} »`)
    const reste = texte.slice(tete.length).trimStart()
    return reste && grasOuvert(tete) ? `**${reste}` : reste
  }
  const poser = (adresse, bloc) => {
    const s = slot(adresse)
    if (!s) return refus.push(`${adresse} : ligne absente`)
    s.avant.push(bloc)
  }
  for (const site of sites.filter((x) => FORMES.has(x.forme))) {
    const avant = refus.length
    if (['S', 'F', 'M', 'B', 'glyphe-fuite', "S'"].includes(site.forme) && !site.ligneTitre) refus.push(`${site.site ?? site.cible} ${site.forme} « ${site.titre} » : aucune ligne de titre à poser`)
    else if (site.forme === 'S') {
      const reste = detacher(site, site.titreMd)
      if (typeof reste === 'string') { retoucher(site.site, reste); poser(site.site, [site.ligneTitre]) }
    } else if (site.forme === 'F' || site.forme === 'M') {
      const reste = detacher(site, site.titreMd)
      if (typeof reste === 'string') { retoucher(site.site, reste); poser(site.cible, [site.ligneTitre]) }
    } else if (site.forme === 'B') {
      if (slot(site.site)?.texte.trim() !== site.titreMd) refus.push(`${site.site} B « ${site.titre} » : la ligne n'est plus « ${site.titreMd} »`)
      else retoucher(site.site, site.ligneTitre)
    } else if (site.forme === 'glyphe-fuite') {
      if (slot(site.site)?.texte !== site.ligneMd) refus.push(`${site.site} glyphe-fuite « ${site.titre} » : la ligne n'est plus « ${site.ligneMd} »`)
      else retoucher(site.site, site.ligneTitre)
    } else if (site.forme === "S'") {
      const deja = lignes.get(lieu(site.cible).nnn).filter((l) => cle(l) === cle(site.ligneTitre))
      if (deja.length >= (site.comptage?.auPdf ?? 1)) refus.push(`${site.cible} S′ « ${site.titre} » : « ${site.ligneTitre} » déjà dans le fichier (« ${deja.join(' », « ')} »)`)
      else poser(site.cible, [site.ligneTitre])
    } else if (site.forme === 'O') {
      const { nnn, i } = lieu(site.site)
      const ls = lignes.get(nnn)
      if (ls[i] !== site.titreMd) { refus.push(`${site.site} O « ${site.titre} » : la ligne n'est plus « ${site.titreMd} »`); continue }
      let k = i + 1
      while (k < ls.length && !enTete(ls[k])) k += 1
      let fin = k
      while (fin > i && !ls[fin - 1].trim()) fin -= 1
      for (let r = i; r < k; r += 1) retoucher(`${nnn}:${r + 1}`, null)
      poser(site.devant, ls.slice(i, fin))
    } else if (site.forme === 'L' && site.enTete == null) {
      if (slot(site.site)?.texte !== site.titreMd) refus.push(`${site.site} L « ${site.titre} » : la ligne n'est plus « ${site.titreMd} »`)
      else retoucher(site.site, site.ligneLegende)
    } else if (site.forme === 'L') {
      const { nnn, i } = lieu(site.site)
      const ls = lignes.get(nnn)
      if (ls?.[i] !== site.titreMd) { refus.push(`${site.site} L « ${site.titre} » : la ligne n'est plus « ${site.titreMd} »`); continue }
      let fin = i
      while (fin + 1 < ls.length && LIGNE_DE_TABLE.test(stripSpans(ls[fin + 1]))) fin += 1
      const largeur = Math.max(...ls.slice(i, fin + 1).map((l) => cellulesDe(stripSpans(l)).length))
      let r = i + 1
      while (r <= fin && estSeparateur(stripSpans(ls[r]))) r += 1
      retoucher(site.site, null)
      poser(site.site, [site.ligneLegende])
      for (let k = i + 1; k < r; k += 1) retoucher(`${nnn}:${k + 1}`, null)
      const [entete, separateur] = enTeteALaLargeur(site.enTete === 'vide' ? '' : ls[r], largeur)
      retoucher(`${nnn}:${r + 1}`, site.enTete === 'vide' ? [entete, separateur, ls[r]].join('\n') : [entete, separateur].join('\n'))
    } else if (site.forme === 'legende-absente') {
      const deja = lignes.get(lieu(site.cible).nnn).filter((l) => cle(l) === cle(site.ligneLegende))
      if (deja.length >= site.comptage.auPdf) refus.push(`${site.cible} legende-absente « ${site.titre} » : « ${site.ligneLegende} » déjà dans le fichier`)
      else poser(site.cible, [site.ligneLegende])
    } else if (site.forme === 'doublon') {
      const reste = detacher(site, site.texteMd)
      if (typeof reste === 'string') retoucher(site.site, reste)
    }
    if (refus.length === avant) appliques.push(`${site.forme} ${site.site ?? '---'}${site.cible ? ` → ${site.cible}` : site.devant ? ` → ${site.devant}` : ''} « ${site.titre} »${site.ligneTitre ? ` = « ${site.ligneTitre} »` : ''}`)
  }
  const enPlace = (site, faire) => {
    const { nnn, i } = lieu(site.site)
    const s = slots.get(nnn)?.[i]
    const neuf = s && typeof s.texte === 'string' ? faire(s.texte) : null
    if (neuf == null) return refus.push(`${site.site} ${site.forme} « ${site.titre} » : la ligne ne porte plus ce que la sonde a vu`)
    s.texte = neuf
    return appliques.push(`${site.forme} ${site.site} « ${site.titre} »`)
  }
  const echappe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const appels = new Map()
  for (const site of sites.filter((x) => x.forme === 'A')) appels.set(site.site, [...(appels.get(site.site) ?? []), site])
  for (const groupe of appels.values()) {
    enPlace(groupe[0], (t) => {
      const m = /(?:\s+\d+)+\s*$/.exec(t)
      const dits = (m?.[0].trim().split(/\s+/) ?? []).sort().join(' ')
      return m && dits === groupe.map((g) => g.jeton).sort().join(' ') ? t.slice(0, m.index) : null
    })
  }
  for (const site of sites.filter((x) => x.forme === 'T')) {
    const re = new RegExp(`(^|[^\\p{L}*])(\\**${echappe(site.avant)}) (${echappe(site.apres)})(?!\\p{L})`, 'u')
    enPlace(site, (t) => (re.test(t) ? t.replace(re, '$1$2 — $3') : null))
  }
  for (const site of sites.filter((x) => x.forme === 'J')) {
    const mal = `${site.avant} ${site.apres}`
    enPlace(site, (t) => (t.split(mal).length === 2 ? t.replace(mal, `${site.avant}${site.apres}`) : null))
  }
  for (const site of sites.filter((x) => x.forme === 'E')) {
    enPlace(site, (t) => {
      const k = t.indexOf(site.etiquette, 1)
      return k > 0 && t.split(site.etiquette).length === 2 ? `${t.slice(0, k).trimEnd()}\n\n${t.slice(k)}` : null
    })
  }
  const recolles = []
  const fusions = new Map()
  const parLeBas = sites.filter((x) => x.forme === 'P').sort((x, y) => {
    const [a, b] = [rang(x.site), rang(y.site)]
    return a[0] === b[0] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1
  })
  for (const site of parLeBas) {
    const { nnn, i } = lieu(site.site)
    const j = lieu(site.avec).i
    const ss = slots.get(nnn)
    if (lignes.get(nnn)?.[i] !== site.ligneMd) { refus.push(`${site.site} P : la ligne n'est plus « ${site.ligneMd} »`); continue }
    if (ss.slice(j, i + 1).some((s) => s.touche)) { refus.push(`${site.site} P : ligne déjà retouchée`); continue }
    const texte = ss[i].texte
    const coupe = site.etiquette ? texte.indexOf(site.etiquette, 1) : -1
    if (site.etiquette && coupe < 0) { refus.push(`${site.site} P : l'étiquette « ${site.etiquette} » n'est plus dans la ligne`); continue }
    ss[j].texte = recoller(ss[j].texte, coupe < 0 ? texte : texte.slice(0, coupe).trimEnd())
    for (let r = j + 1; r < i; r += 1) ss[r].texte = null
    if (coupe < 0) ss[i].texte = null
    else {
      ss[i].texte = texte.slice(coupe)
      ss[i].avant.push([])
    }
    recolles.push({ nnn, ligne: i + 1, avec: j + 1 })
    fusions.set(`${nnn}:${i}`, j)
  }
  for (const site of sites.filter((x) => x.forme === 'D')) {
    const { nnn, i } = lieu(site.site)
    const j = lieu(site.avec).i
    const ss = slots.get(nnn)
    if (lignes.get(nnn)?.[i] !== site.ligneMd) { refus.push(`${site.site} D : la ligne n'est plus « ${site.ligneMd} »`); continue }
    if (ss[i].touche || ss[j].touche || ss[i].texte !== site.ligneMd || typeof ss[j].texte !== 'string') { refus.push(`${site.site} D : ligne déjà retouchée`); continue }
    ss[j].texte = recoller(ss[j].texte, site.ligneMd)
    ss[i].texte = null
    ss[i].touche = ss[j].touche = true
    appliques.push(`D ${site.site} → ${site.avec} « ${site.titre} »`)
  }
  for (const site of sites.filter((x) => x.forme === 'G')) {
    const re = new RegExp(`(?<!\\*)${echappe(site.texteMd)}(?!\\*)`)
    const { nnn, i: i0 } = lieu(site.site)
    let i = i0
    while (!re.test(slots.get(nnn)?.[i]?.texte ?? '') && fusions.has(`${nnn}:${i}`)) i = fusions.get(`${nnn}:${i}`)
    enPlace({ ...site, site: `${nnn}:${i + 1}` }, (t) => (re.test(t) ? t.replace(re, `**${site.texteMd}**`) : null))
  }
  const out = new Map()
  for (const [nnn, ss] of slots) {
    const brut = ss.flatMap((s) => [...s.avant.flatMap((b) => ['', ...b, '']), ...(s.texte === null ? [] : [s.texte])])
    const serre = brut.filter((l, i) => l.trim() || (i > 0 && brut[i - 1].trim()))
    while (serre.length && !serre.at(-1).trim()) serre.pop()
    if (lignes.get(nnn).at(-1) === '') serre.push('')
    out.set(nnn, serre.join('\n'))
  }
  return { textes: out, appliques, refus, recolles }
}

/** Mots du livre AJOUTÉS et RETIRÉS, `Map<mot, n>` chacun (balisage exclu). PURE. */
export function ecartDuLivre(avant, apres) {
  const tout = (m) => [...m.values()].join('\n')
  return ecartDeMots(motsDe(tout(avant)), motsDe(tout(apres)))
}

/** Le verdict de fidélité au livre : `null`, ou ce qui cloche. Ajoutés = les mots des S′ et des légendes
 *  absentes ; retirés = ceux des débris, des appels de figure et des glyphes fuités. PURE. */
export function infidelite(avant, apres, sites) {
  const { retires, ajoutes } = ecartDuLivre(avant, apres)
  const dit = (m) => [...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, n]) => `${k}×${n}`).join(' ') || '∅'
  const poses = motsDe(sites.flatMap((s) => (s.forme === "S'" ? [s.ligneTitre] : s.forme === 'legende-absente' ? [s.ligneLegende] : [])).join('\n'))
  if (dit(ajoutes) !== dit(poses)) return `mots ajoutés ${dit(ajoutes)} ≠ mots des S′ et des légendes absentes ${dit(poses)}`
  const retirables = motsDe(sites.flatMap((s) => (s.forme === 'doublon' ? [s.texteMd] : s.forme === 'A' ? [s.jeton] : s.forme === 'glyphe-fuite' ? [s.glyphe] : [])).join('\n'))
  if (dit(retires) !== dit(retirables)) return `mots retirés ${dit(retires)} ≠ mots des débris, des appels et des glyphes fuités ${dit(retirables)}`
  return null
}

function main() {
  const args = process.argv.slice(2)
  const opt = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : null)
  const id = args.find((a, i) => !a.startsWith('--') && !['--sites', '--boites'].includes(args[i - 1]))
  if (!id) { console.error('usage : node scripts/raw/reparer-titres.mjs <id du livre> [--sites <json> | --boites <json>] [--apply]'); process.exitCode = 2; return }
  const livre = livreExtraitDe(id)
  if (!livre) { console.error(`reparer-titres : aucun livre extrait d'id « ${id} » au registre`); process.exitCode = 2; return }
  const dir = String(livre.dir).split('\\').join('/').replace(/\/$/, '')
  const noms = new Map(nomsDeLaListe(decoupeDe(id)).map((nom) => [nom.slice(0, nom.indexOf(' ')), nom]))
  const avant = new Map([...noms].map(([k, nom]) => [k, readText(`${dir}/${nom}`)]))
  const sites = opt('--sites')
    ? JSON.parse(readFileSync(opt('--sites'), 'utf8')).sites
    : (sondeDuLivre(id, opt('--boites') ? JSON.parse(readFileSync(opt('--boites'), 'utf8')) : null)?.sites ?? [])
  const { textes, appliques, refus, recolles } = reparerLivre(avant, sites)
  for (const r of refus) console.log(`REFUS ${r}`)
  const faute = refus.length ? null : infidelite(avant, textes, sites)
  if (faute) console.log(`REFUS : ${faute}`)
  if (refus.length || faute) { console.log('rien n’est écrit : un refus au moins.'); process.exitCode = 1; return }
  for (const a of appliques) console.log(`  ${a}`)
  for (const r of recolles) console.log(`  P ${r.nnn}:${r.ligne} recollée à ${r.nnn}:${r.avec}`)
  const changes = [...textes].filter(([k, t]) => t !== avant.get(k))
  console.log(`${appliques.length} site(s), ${recolles.length} paragraphe(s) recollé(s), ${changes.length} fichier(s)${args.includes('--apply') ? ' écrit(s)' : ' à écrire — --apply pour écrire'}`)
  if (args.includes('--apply')) for (const [k, t] of changes) writeFileSync(`${dir}/${noms.get(k)}`, t)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
